function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Conversor PDF a Audio-Libro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- FUNCIONES DE BÚSQUEDA PARA LA INTERFAZ ---

function buscarArchivos(query) {
  var files = DriveApp.searchFiles('title contains "' + query + '" and mimeType = "application/pdf" and trashed = false');
  var resultados = [];
  while (files.hasNext()) {
    var file = files.next();
    resultados.push({ id: file.getId(), name: file.getName() });
    if (resultados.length >= 10) break; // Limitar a 10 resultados para velocidad
  }
  return resultados;
}

function buscarCarpetas(query) {
  var folders = DriveApp.searchFolders('title contains "' + query + '" and trashed = false');
  var resultados = [];
  while (folders.hasNext()) {
    var folder = folders.next();
    resultados.push({ id: folder.getId(), name: folder.getName() });
    if (resultados.length >= 10) break;
  }
  return resultados;
}

// --- CONSTANTES Y REGLAS ---
const DEFAULT_RULES = `# Reglas de reemplazo para Conversor PDF
# Formato Regex: * "patron" "reemplazo" "flags"
# Formato Simple: "buscar" "reemplazo"

# --- Limpieza General ---
* "-\\s*\\n" "" "gm"
* "-\\s" "" "gm"
* "\\([\\w\\s&.,]+, \\d{4}[a-z]?\\)" "" "gm"
* "\\[\\d+(?:[–,-]\\s*\\d+)*\\]" "" "gm"
* "https?:\\/\\/\\S+" "" "gm"

# --- Navegación Auditiva ---
* "Case Vignette" "\\n\\n [--- INICIO DE CASO CLÍNICO ---] \\n" "gmi"
* "Key Points" "\\n [PUNTOS CLAVE] \\n" "gmi"

# --- Frases a Eliminar (Línea completa) ---
* "^.*EPISTEMOLOGÍA DE LA PSIQUIATRÍA.*$" "" "gm"
* "^.*Germán E. Berrios.*$" "" "gm"
* "^.*Rogelio Luque.*$" "" "gm"
* "^.*INTRODUCCIÓN.*$" "" "gm"
* "^.*--- PAGE.*$" "" "gm"
* "^.*Triacastela.*$" "" "gm"
* "^.*Psychiatry Update.*$" "" "gm"
* "^.*Jonathan D. Avery.*$" "" "gm"
* "^.*David Hankins.*$" "" "gm"
* "^.*Springer.*$" "" "gm"
* "^.*ISSN .*$" "" "gm"
* "^.*ISBN .*$" "" "gm"
* "^.*doi\\.org.*$" "" "gm"
* "^.*Addiction Medicine.*$" "" "gm"
* "^.*Keywords:.*$" "" "gm"

# --- Números Romanos ---
* "(?<= )I(?= )" "1" "g"
* "(?<= )II(?= )" "2" "g"
* "(?<= )III(?= )" "3" "g"
* "(?<= )IV(?= )" "4" "g"
* "(?<= )V(?= )" "5" "g"
* "(?<= )VI(?= )" "6" "g"
* "(?<= )VII(?= )" "7" "g"
* "(?<= )VIII(?= )" "8" "g"
* "(?<= )IX(?= )" "9" "g"
* "(?<= )X(?= )" "10" "g"
* "(?<= )XIX(?= )" "19" "g"
* "(?<= )XX(?= )" "20" "g"
* "(?<= )XXI(?= )" "21" "g"
`;

function obtenerReglas() {
  const fileName = "reglas-globales.txt";
  const files = DriveApp.searchFiles('title = "' + fileName + '" and trashed = false');
  let content = "";

  if (files.hasNext()) {
    content = files.next().getBlob().getDataAsString();
  } else {
    // Crear archivo por defecto
    DriveApp.getRootFolder().createFile(fileName, DEFAULT_RULES);
    content = DEFAULT_RULES;
  }

  return parsearReglas(content);
}

function parsearReglas(content) {
  const rules = [];
  const lines = content.split('\n');

  // Regex para parsear línea: * "patron" "reemplazo" "flags" (opcional)
  const regexLine = /^\s*\*\s*"(.+?)"\s+"(.*?)"(?:\s+"([a-z]+)")?\s*$/;
  // Regex para línea simple: "buscar" "reemplazo"
  const simpleLine = /^\s*"(.+?)"\s+"(.*?)"\s*$/;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    var matchRegex = line.match(regexLine);
    if (matchRegex) {
      rules.push({
        type: 'regex',
        pattern: matchRegex[1],
        replacement: matchRegex[2],
        flags: matchRegex[3] || 'gm'
      });
      continue;
    }

    var matchSimple = line.match(simpleLine);
    if (matchSimple) {
      rules.push({
        type: 'simple',
        search: matchSimple[1],
        replace: matchSimple[2]
      });
    }
  }
  return rules;
}

function aplicarReglas(texto, reglas) {
  var resultado = texto;
  for (var i = 0; i < reglas.length; i++) {
    var rule = reglas[i];
    if (rule.type === 'regex') {
      try {
        var replacement = rule.replacement.replace(/\\n/g, '\n'); // Unescape newlines
        var re = new RegExp(rule.pattern, rule.flags);
        resultado = resultado.replace(re, replacement);
      } catch (e) {
        console.error("Error aplicando regla regex: " + rule.pattern, e);
      }
    } else {
      // Simple replacement (all occurrences)
      resultado = resultado.replaceAll(rule.search, () => rule.replace);
    }
  }
  return resultado;
}

// --- LÓGICA DE CONVERSIÓN (Tu lógica personalizada) ---

function procesarPDF(fileId, folderId) {
  try {
    // 1. Obtener archivo y carpeta
    var archivoPDF = DriveApp.getFileById(fileId);
    var carpetaDestino = DriveApp.getFolderById(folderId);
    
    // 2. OCR (Convertir a Doc temporal)
    var recurso = {
      title: "[TEMP] " + archivoPDF.getName(),
      mimeType: MimeType.GOOGLE_DOCS,
      parents: [{id: folderId}] // Poner temporalmente en la carpeta destino
    };
    
    // Usamos la API avanzada (Drive.Files.insert)
    var pdfBlob = archivoPDF.getBlob();
    var archivoNuevo = Drive.Files.insert(recurso, pdfBlob, {ocr: true, ocrLanguage: "es"});
    var docId = archivoNuevo.id;
    
    // 3. Limpieza del Texto
    var doc = DocumentApp.openById(docId);
    var body = doc.getBody();

    var textoCompleto = "";
    var numChildren = body.getNumChildren();
    var stopExtraction = false;

    for (var k = 0; k < numChildren; k++) {
      if (stopExtraction) break;
      var child = body.getChild(k);
      var type = child.getType();

      if (type == DocumentApp.ElementType.PARAGRAPH) {
        var p = child.asParagraph();
        var text = p.getText().trim();

        // Detener si es Referencias/Bibliografía (Mayúsculas y Negrita)
        if (/^(REFERENCIAS|BIBLIOGRAFÍA)$/.test(text)) {
           if (p.editAsText().isBold() === true) {
             stopExtraction = true;
             continue;
           }
        }
        if (text.length > 0) textoCompleto += text + "\n";
      }
      else if (type == DocumentApp.ElementType.TABLE) {
        var table = child.asTable();
        for (var r = 0; r < table.getNumRows(); r++) {
          var row = table.getRow(r);
          for (var c = 0; c < row.getNumCells(); c++) {
             var cellText = row.getCell(c).getText().trim();
             if (cellText.length > 0) textoCompleto += cellText + "\n";
          }
        }
      }
      else if (type == DocumentApp.ElementType.LIST_ITEM) {
        var item = child.asListItem();
        var itemText = item.getText().trim();
        if (itemText.length > 0) textoCompleto += itemText + "\n";
      }
    }
    
    // 4. Aplicar Reglas Globales (Externas)
    var reglas = obtenerReglas();
    textoCompleto = aplicarReglas(textoCompleto, reglas);

    // 5. Limpieza línea por línea y Notas
    var lineas = textoCompleto.split('\n');
    var lineasLimpias = [];
    var notasAlPie = {};
    
    // Palabras clave para detectar notas al pie cortas (ej: "Ibid.")
    const SHORT_FOOTNOTE_KEYWORDS = ["ibid", "idem", "op. cit.", "loc. cit.", "cfr.", "cf.", "véase", "ver", "supra", "infra", "vid.", "pág", "p."];

    for (var i = 0; i < lineas.length; i++) {
      var linea = lineas[i].trim();
      
      if (linea.length < 2 || /^\d+$/.test(linea)) continue; // Omitir # página

      // Detectar notas al pie (MEJORADO)
      // Soporta formatos: "1. Texto", "1) Texto", "[1] Texto", "(1) Texto"
      var matchNota = linea.match(/^(?:(\d+)[\.\)]|\[(\d+)\]|\((\d+)\))\s+(.*)/);

      if (matchNota) {
        var num = matchNota[1] || matchNota[2] || matchNota[3];
        var contenido = matchNota[4];

        // Si es larga o contiene palabras clave de cita, es nota
        if (linea.length > 20 || SHORT_FOOTNOTE_KEYWORDS.some(kw => contenido.toLowerCase().includes(kw))) {
           notasAlPie[num] = contenido;
           continue;
        }
      }
      lineasLimpias.push(linea);
    }
    textoCompleto = lineasLimpias.join("\n");

    // 6. Reinsertar Notas
    textoCompleto = textoCompleto.replace(/(\w+)\s*[\(\[](\d+)[\)\]]?|(\w+?)\s*(\d+)/g, function(match, w1, n1, w3, n4) {
      var word = w1 || w3;
      var num = n1 || n4;
      if (Object.prototype.hasOwnProperty.call(notasAlPie, num)) {
        return `${word} [Nota: ${notasAlPie[num]}] `;
      }
      return match;
    });

    // 7. Guardar TXT Final
    var nombreTxt = archivoPDF.getName().replace(".pdf", " (Audio).txt");
    carpetaDestino.createFile(nombreTxt, textoCompleto, MimeType.PLAIN_TEXT);
    
    // 8. Borrar Temp
    Drive.Files.remove(docId);
    
    return "✅ ¡Listo! Archivo guardado en: " + carpetaDestino.getName();
    
  } catch (e) {
    throw new Error(e.toString());
  }
}
