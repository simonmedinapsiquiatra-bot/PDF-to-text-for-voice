const GEMINI_API_KEY = '';

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Dr. Media - Transcriptor Total')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Guarda la API Key de forma segura en las propiedades de usuario de Google Apps Script.
 */
function guardarApiKeyUsuario(key) {
  if (!key || key.trim() === '') {
    PropertiesService.getUserProperties().deleteProperty('GEMINI_API_KEY');
    return "Clave de API eliminada.";
  }
  PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', key.trim());
  return "Clave de API guardada de forma segura en tus propiedades de usuario de Google Apps Script.";
}

/**
 * Obtiene la API Key guardada de las propiedades de usuario.
 */
function obtenerApiKeyUsuario() {
  return PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || "";
}

/**
 * Función que procesa pequeños fragmentos (Chunking)
 * Es muy rápida porque solo maneja ~15 páginas a la vez.
 */
function procesarFragmento(base64Data, label, userApiKey, modeloSeleccionado, lenguaje) {
  try {
    const apiKey = userApiKey && userApiKey.trim() !== '' ? userApiKey : obtenerApiKeyUsuario();
    if (!apiKey) {
      throw new Error("No se ha configurado ninguna API Key de Gemini. Por favor, haz clic en el icono de engranaje en la esquina superior derecha e ingresa tu clave.");
    }
    const modelo = modeloSeleccionado && modeloSeleccionado.trim() !== '' ? modeloSeleccionado.trim() : detectarMejorModeloFlash(apiKey);
    
    const lang = (lenguaje === 'es' || lenguaje === 'en') ? lenguaje : 'es';
    const systemPrompt = obtenerSystemPrompt('ocr', lang);

    const payload = {
      "contents": [{
        "parts": [
          { "text": systemPrompt },
          { "inline_data": { "mime_type": "application/pdf", "data": base64Data } }
        ]
      }],
      "generationConfig": { "temperature": 0.1 }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/${modelo}:generateContent?key=${apiKey}`;
    
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
        return procesarFragmento(base64Data, label, userApiKey); // Reintentar
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
function procesarFragmentoTexto(rawText, label, userApiKey, modeloSeleccionado, lenguaje) {
  try {
    const apiKey = userApiKey && userApiKey.trim() !== '' ? userApiKey : obtenerApiKeyUsuario();
    if (!apiKey) {
      throw new Error("No se ha configurado ninguna API Key de Gemini. Por favor, haz clic en el icono de engranaje en la esquina superior derecha e ingresa tu clave.");
    }
    const modelo = modeloSeleccionado && modeloSeleccionado.trim() !== '' ? modeloSeleccionado.trim() : detectarMejorModeloFlash(apiKey);
    
    const lang = (lenguaje === 'es' || lenguaje === 'en') ? lenguaje : autodetectarLenguaje(rawText);
    const systemPrompt = obtenerSystemPrompt('texto', lang);

    const payload = {
      "contents": [{
        "parts": [
          { "text": systemPrompt },
          { "text": "TEXTO A OPTIMIZAR:\n\n" + rawText }
        ]
      }],
      "generationConfig": { "temperature": 0.1 }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/${modelo}:generateContent?key=${apiKey}`;
    
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
        return procesarFragmentoTexto(rawText, label, userApiKey);
      }
      throw new Error(json.error.message);
    }
    
    let texto = json.candidates[0].content.parts[0].text;
    texto = texto.replace(/\*\*/g, "");

    return texto;

  } catch (e) {
    return `[ERROR LECTURA ${label}: ${e.toString()}]`;
  }
}

// Detector de Modelo Flash con Caching
function detectarMejorModeloFlash(userApiKey) {
  const apiKey = userApiKey && userApiKey.trim() !== '' ? userApiKey : obtenerApiKeyUsuario();
  const cacheKey = "mejor_modelo_flash_" + apiKey.substring(0, 10);
  
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = UrlFetchApp.fetch(url);
    const json = JSON.parse(response.getContentText());
    
    const modelosFlash = json.models.filter(m => 
      m.name.includes('flash') && m.supportedGenerationMethods.includes('generateContent')
    );

    if (!modelosFlash.length) return 'models/gemini-3.5-flash';

    modelosFlash.sort((a, b) => {
      const vA = parseFloat(a.name.match(/gemini-(\d+(\.\d+)?)/)?.[1] || 0);
      const vB = parseFloat(b.name.match(/gemini-(\d+(\.\d+)?)/)?.[1] || 0);
      return vB - vA;
    });

    const mejor = modelosFlash[0].name;
    cache.put(cacheKey, mejor, 21600); // Guardar en caché por 6 horas (21600 segundos)
    return mejor;
  } catch (e) {
    return 'models/gemini-3.5-flash';
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

/**
 * Función correctora inteligente de ortografía, gramática y OCR con Gemini Flash.
 */
function corregirTextoGemini(rawText, lenguaje, userApiKey, modeloSeleccionado) {
  try {
    const apiKey = userApiKey && userApiKey.trim() !== '' ? userApiKey : obtenerApiKeyUsuario();
    if (!apiKey) {
      throw new Error("No se ha configurado ninguna API Key de Gemini. Por favor, haz clic en el icono de engranaje en la esquina superior derecha e ingresa tu clave.");
    }
    const modelo = modeloSeleccionado && modeloSeleccionado.trim() !== '' ? modeloSeleccionado.trim() : detectarMejorModeloFlash(apiKey);
    
    const lang = (lenguaje === 'es' || lenguaje === 'en') ? lenguaje : autodetectarLenguaje(rawText);
    const systemPrompt = obtenerSystemPrompt('corregir', lang);

    const payload = {
      "contents": [{
        "parts": [
          { "text": systemPrompt },
          { "text": "TEXTO A CORREGIR:\n\n" + rawText }
        ]
      }],
      "generationConfig": { "temperature": 0.1 }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/${modelo}:generateContent?key=${apiKey}`;
    
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
        Utilities.sleep(2000);
        return corregirTextoGemini(rawText, lenguaje, userApiKey);
      }
      throw new Error(json.error.message);
    }
    
    let texto = json.candidates[0].content.parts[0].text;
    texto = texto.replace(/\*\*/g, "").replace(/^#+\s/gm, "");
    return texto;
  } catch (e) {
    return `[ERROR CORRECCION GEMINI: ${e.toString()}]`;
  }
}

function autodetectarLenguaje(texto) {
  if (!texto) return 'es';
  const cleanText = texto.toLowerCase();
  
  const palabrasES = [' el ', ' de ', ' la ', ' que ', ' en ', ' los ', ' las ', ' un ', ' una ', ' con ', ' para ', ' por ', ' esta ', ' como ', ' es ', ' y '];
  const palabrasEN = [' the ', ' of ', ' and ', ' to ', ' in ', ' that ', ' is ', ' was ', ' for ', ' on ', ' with ', ' as ', ' by ', ' this ', ' it ', ' a '];
  
  let countES = 0;
  let countEN = 0;
  
  for (const w of palabrasES) {
    const matches = cleanText.match(new RegExp(w, 'g'));
    if (matches) countES += matches.length;
  }
  
  for (const w of palabrasEN) {
    const matches = cleanText.match(new RegExp(w, 'g'));
    if (matches) countEN += matches.length;
  }
  
  return countES >= countEN ? 'es' : 'en';
}

function obtenerSystemPrompt(action, lenguaje) {
  const lang = (lenguaje === 'es' || lenguaje === 'en') ? lenguaje : 'es';
  
  if (action === 'corregir') {
    if (lang === 'en') {
      return `Act as a professional copyeditor and style corrector specializing in high-quality text cleanup. Your task is to correct typographical, spelling, and grammatical errors, as well as PDF extraction anomalies (such as split words or character accentuation issues) in the provided text, which is written in ENGLISH.

Strict cleanup instructions:
1. Unicode Normalization: Repair words deformed by PDF encoding or OCR (e.g., reconstruct words that have weird spacing, broken accents, or malformed characters).
2. Fix broken hyphenations: Rejoin words that were split at line breaks (e.g., 'pre- valence' to 'prevalence').
3. Respect medical/technical jargon: DO NOT modify acronyms (like 'TCA', 'AN', 'BN', 'SCOFF', 'PTSD', 'ADHD') or names of drugs or valid diagnoses. Do not simplify scientific terminology or alter the style of the original text.
4. Maintain exact structure: Do not add summaries, do not change paragraph order, and do not add explanations, editorial notes, or greetings. Return strictly the corrected text.
5. LANGUAGE CONSERVATION: Keep the text in English. DO NOT translate it to Spanish or any other language under any circumstances.`;
    } else {
      return `Actúas como un editor de textos profesional y corrector de estilo especializado en adaptaciones lingüísticas de alta calidad. Tu tarea es corregir errores tipográficos, ortográficos, gramaticales y anomalías de extracción de PDF (como palabras cortadas o caracteres con acentuación separada) en el texto que se te proporciona, el cual está escrito en el idioma ESPAÑOL.

Instrucciones estrictas de corrección:
1. Normalización Unicode: Repara palabras deformadas por la codificación del PDF o el OCR (ej: convierte 'cl ínica' en 'clínica', 'mostrí ó' en 'mostró', 'tenaní' en 'tenían', 'exper íencia' en 'experiencia', 'relació n' en 'relación', 'diagnstico' en 'diagnóstico').
2. Corrección de saltos de sílabas residuales: Une palabras que se cortaron al final del renglón (ej. 'pre- valencia' a 'prevalencia').
3. Respetar jerga médica/técnica: NO modifiques siglas válidas como 'TCA', 'AN', 'BN', 'SCOFF' ni nombres de fármacos o diagnósticos válidos (como 'bulimia', 'lisdexamfetamina', 'anorexia'). No intentes simplificar la terminología científica ni cambiar el estilo del texto original.
4. Mantener la estructura exacta: No agregues resúmenes, no cambies párrafos de lugar, y no agregues explicaciones, notas editoriales ni saludos. Entrega estrictamente el texto corregido.
5. CONSERVACIÓN DE IDIOMA: Mantén el texto en español. NO lo traduzcas al inglés ni a ningún otro idioma bajo ninguna circunstancia.`;
    }
  } else {
    // Default / OCR / texto
    if (lang === 'en') {
      return `Act as an advanced text processor designed to optimize documents for Text-to-Speech (TTS) systems. Your goal is to generate a fluid, continuous, and easy-to-listen text, removing any visual or academic interruptions.

Execute the processing in two sequential phases:

PHASE 1: Structural Cleanup (Prioritize Regex and pattern matching)
Strictly remove or correct the following elements:
- Hyphenation: Rejoin words separated by line breaks (e.g., medi-\\ncine to medicine).
- Headers, footers, and page numbers: Remove any repetitive text in margins and isolated page numbers.
- URLs and emails: Remove full web links (http..., www...) and email addresses.
- Integrated academic citations: Remove brackets [1], bibliographic reference superscripts, and APA-style parenthetical citations (Author, Year).
- Author lists and bibliography: Completely remove bibliography sections at the end of the text and institutional affiliations of authors at the beginning.
- Figure/table references: Remove text in parentheses or commas that say "(See Figure X)", "(Table Y)", "(Chart Z)".
- Garbage characters: Remove formatting sequences (---, ***, ===) and replace complex bullets with standard punctuation (commas or periods).

PHASE 2: Semantic Adaptation for TTS (Contextual analysis)
Modify the resulting text applying these fluidity rules:
- Chapter Separators: Detect chapter starts or large sections and format them uniformly on an independent line as: "chapter [number in words]: [Chapter Title]" (example: "chapter one: Introduction", "chapter two: Methodology").
- Inline footnotes: Identify footnote text. Remove the call number or symbol, and integrate the footnote explanation naturally and immediately after the concept referred to in the main paragraph (use parentheses or commas to integrate it). Remove the original footnote section.
- Roman Numerals: Convert all Roman numerals to their text or Arabic equivalent depending on the context (e.g., "Century XX" to "Century twenty", "Chapter IV" to "Chapter four").
- Abbreviations: Expand common abbreviations for correct pronunciation (e.g., "Dr." to "Doctor", "e.g." to "for example", "approx." to "approximately").
- Tables, figures, and charts: If you find a table, figure, chart, or diagram in the document, describe or summarize it in a discursive and fluid way, strictly integrating this context: "In the document/book there is a table/figure/diagram that can be summarized as [fluid summary or explanation of its data or content in paragraph format]".
- LANGUAGE CONSERVATION: Process the text in its original language (e.g., if the document is in English, keep it in English; if it is in Spanish, keep it in Spanish). DO NOT translate it under any circumstances.

Deliver only the final processed text ready to be sent to the TTS engine. Do not include explanations, greetings, or comments about the edits made.`;
    } else {
      return `Actúa como un procesador de texto avanzado diseñado para optimizar documentos para sistemas Text-to-Speech (TTS). Tu objetivo es generar un texto fluido, continuo y de fácil escucha, eliminando cualquier interrupción visual o académica.

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
- Separadores de capítulo: Detecta los inicios de capítulos o grandes secciones del texto y colócalos en una línea independiente. Mantenlos exactamente como aparecen en el documento original (ej. "Capítulo 1", "1. Introducción", o solo el título del capítulo). Asegúrate de añadirles un prefijo de marcador "# " al inicio de la línea para que el sistema los detecte como títulos (ejemplo: "# Capítulo 1: Introducción").
- Notas al pie en línea: Identifica el texto de las notas al pie de página. Elimina el número o símbolo de llamada, e integra la explicación de la nota al pie de forma natural e inmediatamente después del concepto aludido en el párrafo principal (puedes usar paréntesis o comas para integrarlo). Elimina la sección original de notas al pie.
- Números Romanos: Convierte todos los números romanos a su equivalente en texto o número arábigo según el contexto (ej. "Siglo XX" a "Siglo veinte", "Juan Carlos I" a "Juan Carlos Primero", "Capítulo IV" a "Capítulo cuatro").
- Abreviaturas: Expande abreviaturas comunes para su correcta pronunciación (ej. "Dr." a "Doctor", "EE.UU." a "Estados Unidos", "aprox." a "aproximadamente").
- Tablas, figuras y esquemas: Si encuentras una tabla, figura, cuadro o esquema en el documento, descríbela o resúmela de forma discursiva y fluida integrando este contexto exacto: "En el documento/libro hay una tabla/figura/esquema que se puede resumir como [resumen o explicación fluida de sus datos o contenido en formato de párrafo]".
- CONSERVACIÓN DE IDIOMA: Procesa el texto en su idioma original (ej: si el documento está en inglés, mantenlo en inglés; si está en español, mantenlo en español). NO lo traduzcas bajo ninguna circunstancia.

Entrega únicamente el texto final procesado y listo para ser enviado al motor TTS. No incluyas explicaciones, saludos ni comentarios sobre las ediciones realizadas.`;
    }
  }
}
