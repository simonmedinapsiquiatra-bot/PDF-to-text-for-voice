const GEMINI_API_KEY = 'AIzaSyBejrBOSi3jeYjphCfVqPf5thEK1ogvSlU';

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Dr. Media - Transcriptor Total')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Función que procesa pequeños fragmentos (Chunking)
 * Es muy rápida porque solo maneja ~15 páginas a la vez.
 */
function procesarFragmento(base64Data, label) {
  try {
    const modelo = detectarMejorModeloFlash();
    
    const systemPrompt = `Actúa como un procesador de texto avanzado diseñado para optimizar documentos para sistemas Text-to-Speech (TTS). Tu objetivo es generar un texto fluido, continuo y de fácil escucha, eliminando cualquier interrupción visual o académica.

Ejecuta el procesamiento en dos fases secuenciales:

FASE 1: Limpieza Estructural (Prioriza Regex y coincidencia de patrones)
Elimina o corrige estrictamente los siguientes elementos:
- Guiones de separación silábica: Une palabras separadas por saltos de línea (ej. medi-\\ncina a medicina).
- Cabeceras, pies de página y numeración: Elimina cualquier texto repetitivo en los márgenes y los números de página aislados.
- URLs y correos: Elimina enlaces web completos (http..., www...) y direcciones de correo electrónico.
- Citas académicas integradas: Elimina corchetes [1], superíndices de referencias bibliográficas, y citas parentéticas estilo APA (Autor, Año).
- Listas de autores y bibliografía: Elimina por completo las secciones de referencias bibliográficas al final del texto y las afiliaciones institucionales de los autores al inicio.
- Llamados a gráficos: Elimina textos entre paréntesis o comas que digan "(Ver Figura X)", "(Tabla Y)", "(Gráfico Z)".
- Caracteres basura: Elimina secuencias de formato (---, ***, ===) y reemplaza viñetas complejas por puntuación estándar (comas o puntos).

FASE 2: Adaptación Semántica para TTS (Análisis contextual)
Modifica el texto resultante aplicando estas reglas de fluidez:
- Notas al pie en línea: Identifica el texto de las notas al pie de página. Elimina el número o símbolo de llamada, e integra la explicación de la nota al pie de forma natural e inmediatamente después del concepto aludido en el párrafo principal (puedes usar paréntesis o comas para integrarlo). Elimina la sección original de notas al pie.
- Números Romanos: Convierte todos los números romanos a su equivalente en texto o número arábigo según el contexto (ej. "Siglo XX" a "Siglo veinte", "Juan Carlos I" a "Juan Carlos Primero", "Capítulo IV" a "Capítulo cuatro").
- Abreviaturas: Expande abreviaturas comunes para su correcta pronunciación (ej. "Dr." a "Doctor", "EE.UU." a "Estados Unidos", "aprox." a "aproximadamente").
- Tablas y cuadros: Si encuentras una tabla con datos crudos, omítela por completo. Si contiene texto discursivo importante, reescríbelo en formato de párrafo fluido.

Entrega únicamente el texto final procesado y listo para ser enviado al motor TTS. No incluyas explicaciones, saludos ni comentarios sobre las ediciones realizadas.`;

    const payload = {
      "contents": [{
        "parts": [
          { "text": systemPrompt },
          { "inline_data": { "mime_type": "application/pdf", "data": base64Data } }
        ]
      }],
      "generationConfig": { "temperature": 0.1 }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/${modelo}:generateContent?key=${GEMINI_API_KEY}`;
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());

    if (json.error) {
      // Manejo básico de límite de velocidad (Rate Limit)
      if (json.error.code === 429) {
        Utilities.sleep(3000); // Esperar 3 segundos
        return procesarFragmento(base64Data, label); // Reintentar
      }
      throw new Error(json.error.message);
    }
    
    let texto = json.candidates[0].content.parts[0].text;
    
    // Limpieza de seguridad post-generación (por si acaso quedan marcas de formato)
    texto = texto.replace(/\*\*/g, "").replace(/^#+\s/gm, "");

    return texto;

  } catch (e) {
    return `[ERROR LECTURA ${label}: ${e.toString()}]`;
  }
}

/**
 * Función que procesa texto plano directamente.
 * Es extremadamente rápida porque no requiere subir pesados fragmentos PDF
 * y procesa directamente el texto extraído localmente por el navegador.
 */
function procesarFragmentoTexto(rawText, label) {
  try {
    const modelo = detectarMejorModeloFlash();
    
    const systemPrompt = `Actúa como un procesador de texto avanzado diseñado para optimizar documentos para sistemas Text-to-Speech (TTS). Tu objetivo es generar un texto fluido, continuo y de fácil escucha, eliminando cualquier interrupción visual o académica.

Ejecuta el procesamiento en dos fases secuenciales:

FASE 1: Limpieza Estructural (Prioriza Regex y coincidencia de patrones)
Elimina o corrige estrictamente los siguientes elementos:
- Guiones de separación silábica: Une palabras separadas por saltos de línea (ej. medi-\\ncina a medicina).
- Cabeceras, pies de página y numeración: Elimina cualquier texto repetitivo en los márgenes y los números de página aislados.
- URLs y correos: Elimina enlaces web completos (http..., www...) y direcciones de correo electrónico.
- Citas académicas integradas: Elimina corchetes [1], superíndices de referencias bibliográficas, y citas parentéticas estilo APA (Autor, Año).
- Listas de autores y bibliografía: Elimina por completo las secciones de referencias bibliográficas al final del texto y las afiliaciones institucionales de los autores al inicio.
- Llamados a gráficos: Elimina textos entre paréntesis o comas que digan "(Ver Figura X)", "(Tabla Y)", "(Gráfico Z)".
- Caracteres basura: Elimina secuencias de formato (---, ***, ===) y reemplaza viñetas complejas por puntuación estándar (comas o puntos).

FASE 2: Adaptación Semántica para TTS (Análisis contextual)
Modifica el texto resultante aplicando estas reglas de fluidez:
- Notas al pie en línea: Identifica el texto de las notas al pie de página. Elimina el número o símbolo de llamada, e integra la explicación de la nota al pie de forma natural e inmediatamente después del concepto aludido en el párrafo principal (puedes usar paréntesis o comas para integrarlo). Elimina la sección original de notas al pie.
- Números Romanos: Convierte todos los números romanos a su equivalente en texto o número arábigo según el contexto (ej. "Siglo XX" a "Siglo veinte", "Juan Carlos I" a "Juan Carlos Primero", "Capítulo IV" a "Capítulo cuatro").
- Abreviaturas: Expande abreviaturas comunes para su correcta pronunciación (ej. "Dr." a "Doctor", "EE.UU." a "Estados Unidos", "aprox." a "aproximadamente").
- Tablas y cuadros: Si encuentras una tabla con datos crudos, omítela por completo. Si contiene texto discursivo importante, reescríbelo en formato de párrafo fluido.

Entrega únicamente el texto final procesado y listo para ser enviado al motor TTS. No incluyas explicaciones, saludos ni comentarios sobre las ediciones realizadas.`;

    const payload = {
      "contents": [{
        "parts": [
          { "text": systemPrompt },
          { "text": "TEXTO A OPTIMIZAR:\n\n" + rawText }
        ]
      }],
      "generationConfig": { "temperature": 0.1 }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/${modelo}:generateContent?key=${GEMINI_API_KEY}`;
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());

    if (json.error) {
      if (json.error.code === 429) {
        Utilities.sleep(3000);
        return procesarFragmentoTexto(rawText, label);
      }
      throw new Error(json.error.message);
    }
    
    let texto = json.candidates[0].content.parts[0].text;
    texto = texto.replace(/\*\*/g, "").replace(/^#+\s/gm, "");

    return texto;

  } catch (e) {
    return `[ERROR LECTURA ${label}: ${e.toString()}]`;
  }
}

// Detector de Modelo Flash con Caching
function detectarMejorModeloFlash() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("mejor_modelo_flash");
  if (cached) return cached;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
    const response = UrlFetchApp.fetch(url);
    const json = JSON.parse(response.getContentText());
    
    const modelosFlash = json.models.filter(m => 
      m.name.includes('flash') && m.supportedGenerationMethods.includes('generateContent')
    );

    if (!modelosFlash.length) return 'models/gemini-1.5-flash';

    modelosFlash.sort((a, b) => {
      const vA = parseFloat(a.name.match(/gemini-(\d+(\.\d+)?)/)?.[1] || 0);
      const vB = parseFloat(b.name.match(/gemini-(\d+(\.\d+)?)/)?.[1] || 0);
      return vB - vA;
    });

    const mejor = modelosFlash[0].name;
    cache.put("mejor_modelo_flash", mejor, 21600); // Guardar en caché por 6 horas (21600 segundos)
    return mejor;
  } catch (e) {
    return 'models/gemini-1.5-flash';
  }
}

// --- FUNCIONES AUXILIARES PARA REGLAS (Utilizadas para Pruebas Unitarias y Limpieza Secundarias) ---

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
      try {
        rules.push({
          type: 'regex',
          re: new RegExp(matchRegex[1], matchRegex[3] || 'gm'),
          replacement: matchRegex[2].replace(/\\n/g, '\n')
        });
      } catch (e) {
        console.error("Error al parsear regla regex: " + matchRegex[1], e);
      }
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
      resultado = resultado.replace(rule.re, rule.replacement);
    } else {
      // Simple replacement (all occurrences)
      resultado = resultado.replaceAll(rule.search, () => rule.replace);
    }
  }
  return resultado;
}

