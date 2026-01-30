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
    // NOTA: El archivo blob se debe enviar correctamente
    var archivoNuevo = Drive.Files.insert(recurso, archivoPDF.getBlob(), {ocr: true, ocrLanguage: "es"});
    var docId = archivoNuevo.id;
    
    // 3. Limpieza del Texto
    var doc = DocumentApp.openById(docId);
    var body = doc.getBody();
    var textoCompleto = body.getText();
    
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
    for (var romano in romanos) {
      textoCompleto = textoCompleto.split(romano).join(romanos[romano]);
    }

    // E. Reinsertar Notas
    for (var [num, contenido] of Object.entries(notasAlPie)) {
       var marca = new RegExp(`(\\w+)[\\s]*[\\(\\[]?${num}[\\)\\]]?`, "g");
       textoCompleto = textoCompleto.replace(marca, `$1 [Nota: ${contenido}] `);
    }

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
