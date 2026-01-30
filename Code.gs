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
    
    // A. Unir guiones de fin de línea
    textoCompleto = textoCompleto.replace(/-\s*\n/g, ""); 
    textoCompleto = textoCompleto.replace(/-\s/g, "");

    // B. Eliminar Referencias APA simples (ej: (Berrios, 2011))
    textoCompleto = textoCompleto.replace(/\([\w\s&.,]+, \d{4}[a-z]?\)/g, "");

    // C. Limpieza línea por línea
    var lineas = textoCompleto.split('\n');
    var lineasLimpias = [];
    var notasAlPie = {};
    
    // Frases a eliminar (Añade aquí las que detectes nuevas)
    const FRASES_A_ELIMINAR = ["EPISTEMOLOGÍA DE LA PSIQUIATRÍA", "Germán E. Berrios", "Rogelio Luque", "INTRODUCCIÓN", "--- PAGE", "Triacastela"];

    // Palabras clave para detectar notas al pie cortas (ej: "Ibid.")
    const SHORT_FOOTNOTE_KEYWORDS = ["ibid", "idem", "op. cit.", "loc. cit.", "cfr.", "cf.", "véase", "ver", "supra", "infra", "vid.", "pág", "p."];

    for (var i = 0; i < lineas.length; i++) {
      var linea = lineas[i].trim();
      
      if (linea.length < 2 || /^\d+$/.test(linea)) continue; // Omitir # página
      if (FRASES_A_ELIMINAR.some(f => linea.includes(f))) continue; // Omitir headers

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

    // D. Romanos a Arábigos
    const romanos = { " I ": " 1 ", " II ": " 2 ", " III ": " 3 ", " IV ": " 4 ", " V ": " 5 ", " VI ": " 6 ", " VII ": " 7 ", " VIII ": " 8 ", " IX ": " 9 ", " X ": " 10 ", " XIX ": " 19 ", " XX ": " 20 ", " XXI ": " 21 " };
    const regexRomanos = new RegExp("(?<= )(" + Object.keys(romanos).map(k => k.trim()).join("|") + ")(?= )", "g");
    textoCompleto = textoCompleto.replace(regexRomanos, function(match) {
      return romanos[" " + match + " "].trim();
    });

    // E. Reinsertar Notas
    textoCompleto = textoCompleto.replace(/(\w+)\s*[\(\[](\d+)[\)\]]?|(\w+?)\s*(\d+)/g, function(match, w1, n1, w3, n4) {
      var word = w1 || w3;
      var num = n1 || n4;
      if (Object.prototype.hasOwnProperty.call(notasAlPie, num)) {
        return `${word} [Nota: ${notasAlPie[num]}] `;
      }
      return match;
    });

    // 4. Guardar TXT Final
    var nombreTxt = archivoPDF.getName().replace(".pdf", " (Audio).txt");
    carpetaDestino.createFile(nombreTxt, textoCompleto, MimeType.PLAIN_TEXT);
    
    // 5. Borrar Temp
    Drive.Files.remove(docId);
    
    return "✅ ¡Listo! Archivo guardado en: " + carpetaDestino.getName();
    
  } catch (e) {
    throw new Error(e.toString());
  }
}
