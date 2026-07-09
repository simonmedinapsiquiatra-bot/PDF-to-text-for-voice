import type { VercelRequest, VercelResponse } from '@vercel/node';

function autodetectarLenguaje(texto: string): 'es' | 'en' {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  const body = req.body || {};
  const { action, text, lang, userApiKey, userGroqApiKey, model } = body;

  if (!text) {
    return res.status(400).json({ error: 'Falta el parámetro "text"' });
  }

  // Resolver la API Key: preferir la provista por el usuario, luego la del entorno de Vercel
  const apiKey = (userApiKey && userApiKey.trim() !== '') ? userApiKey.trim() : process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({ 
      error: 'No se configuró ninguna API Key. Agrégala en la configuración de la app (icono de engranaje) o configúrala en Vercel.' 
    });
  }

  // Determinar modelo
  const defaultModel = 'gemini-3.5-flash'; // O gemini-1.5-flash
  const activeModel = (model && model.trim() !== '' && model !== 'auto') ? model.trim() : defaultModel;

  // Asegurar formato correcto del modelo sin duplicar el prefijo 'models/' en la llamada
  let modelPath = activeModel;
  if (!modelPath.startsWith('models/')) {
    modelPath = 'models/' + modelPath;
  }

  try {
    let detectedLang = (lang === 'es' || lang === 'en') ? lang : '';
    if (action !== 'ocr' && (!detectedLang && text)) {
      detectedLang = autodetectarLenguaje(text);
    }
    if (!detectedLang) {
      detectedLang = 'es'; // default fallback
    }

    let systemPrompt = '';

    if (action === 'corregir') {
      if (detectedLang === 'en') {
        systemPrompt = `Act as a professional copyeditor and style corrector specializing in high-quality text cleanup. Your task is to correct typographical, spelling, and grammatical errors, as well as PDF extraction anomalies (such as split words or character accentuation issues) in the provided text, which is written in ENGLISH.

Strict cleanup instructions:
1. Unicode Normalization: Repair words deformed by PDF encoding or OCR (e.g., reconstruct words that have weird spacing, broken accents, or malformed characters).
2. Fix broken hyphenations: Rejoin words that were split at line breaks (e.g., 'pre- valence' to 'prevalence').
3. Respect medical/technical jargon: DO NOT modify acronyms (like 'TCA', 'AN', 'BN', 'SCOFF', 'PTSD', 'ADHD') or names of drugs or valid diagnoses. Do not simplify scientific terminology or alter the style of the original text.
4. Maintain exact structure: Do not add summaries, do not change paragraph order, and do not add explanations, editorial notes, or greetings. Return strictly the corrected text.
5. LANGUAGE CONSERVATION: Keep the text in English. DO NOT translate it to Spanish or any other language under any circumstances.
6. MARKER PRESERVATION: If you find titles marked with "# " and surrounded by spaces (e.g., "\\n\\n    \\n\\n# TITLE\\n\\n    \\n\\n"), you must preserve them EXACTLY as they are, without altering the "#" symbol or the surrounding blank spaces.`;
      } else {
        systemPrompt = `Actúas como un editor de textos profesional y corrector de estilo especializado en adaptaciones lingüísticas de alta calidad. Tu tarea es corregir errores tipográficos, ortográficos, gramaticales y anomalías de extracción de PDF (como palabras cortadas o caracteres con acentuación separada) en el texto que se te proporciona, el cual está escrito en el idioma ESPAÑOL.

Instrucciones estrictas de corrección:
1. Normalización Unicode: Repara palabras deformadas por la codificación del PDF o el OCR (ej: convierte 'cl ínica' en 'clínica', 'mostrí ó' en 'mostró', 'tenaní' en 'tenían', 'exper íencia' en 'experiencia', 'relació n' en 'relación', 'diagnstico' en 'diagnóstico').
2. Corrección de saltos de sílabas residuales: Une palabras que se cortaron al final del renglón (ej. 'pre- valencia' a 'prevalencia').
3. Respetar jerga médica/técnica: NO modifiques siglas válidas como 'TCA', 'AN', 'BN', 'SCOFF' ni nombres de fármacos o diagnósticos válidos (como 'bulimia', 'lisdexamfetamina', 'anorexia'). No intentes simplificar la terminología científica ni cambiar el estilo del texto original.
4. Mantener la estructura exacta: No agregues resúmenes, no cambies párrafos de lugar, y no agregues explicaciones, notas editoriales ni saludos. Entrega estrictamente el texto corregido.
5. CONSERVACIÓN DE IDIOMA: Mantén el texto en español. NO lo traduzcas al inglés ni a ningún otro idioma bajo ninguna circunstancia.
6. PRESERVACIÓN DE MARCADORES: Si encuentras títulos marcados con "# " y rodeados de espacios (ej. "\\n\\n    \\n\\n# TITULO\\n\\n    \\n\\n"), debes conservarlos EXACTAMENTE igual, sin alterar el símbolo "#" ni los espacios en blanco que los rodean.`;
      }
    } else {
      // Default: Limpieza y optimización TTS (procesarFragmentoTexto) u OCR
      if (detectedLang === 'en') {
        systemPrompt = `Act as an advanced text processor designed to optimize documents for Text-to-Speech (TTS) systems. Your goal is to generate a fluid, continuous, and easy-to-listen text, removing any visual or academic interruptions.

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
- Chapter Separators: DO NOT artificially inject or hallucinate chapter titles or separators. Leave the original structure of the document intact without inserting synthetic chapter headings.
- Inline footnotes: Identify footnote text. Remove the call number or symbol, and integrate the footnote explanation naturally and immediately after the concept referred to in the main paragraph (use parentheses or commas to integrate it). Remove the original footnote section.
- Roman Numerals: Convert all Roman numerals to their text or Arabic equivalent depending on the context (e.g., "Century XX" to "Century twenty", "Chapter IV" to "Chapter four").
- Abbreviations: Expand common abbreviations for correct pronunciation (e.g., "Dr." to "Doctor", "e.g." to "for example", "approx." to "approximately").
- Tables, figures, and charts: If you find a table, figure, chart, or diagram in the document, describe or summarize it in a discursive and fluid way, strictly integrating this context: "In the document/book there is a table/figure/diagram that can be summarized as [fluid summary or explanation of its data or content in paragraph format]".
- LANGUAGE CONSERVATION: Process the text in its original language (e.g., if the document is in English, keep it in English; if it is in Spanish, keep it in Spanish). DO NOT translate it under any circumstances.
- MARKER PRESERVATION (CRITICAL): The text already contains objective chapter markers formatted exactly as "\\n\\n    \\n\\n# [Title]\\n\\n    \\n\\n". YOU MUST NOT MODIFY, DELETE, OR REFORMAT THESE MARKERS. Keep the "#" symbol and the exact blank spaces around them intact, as they are used by the system to generate TTS pauses.

Deliver only the final processed text ready to be sent to the TTS engine. Do not include explanations, greetings, or comments about the edits made.`;
      } else {
        systemPrompt = `Actúa como un procesador de texto avanzado diseñado para optimizar documentos para sistemas Text-to-Speech (TTS). Tu objetivo es generar un texto fluido, continuo y de fácil escucha, eliminando cualquier interrupción visual o académica.

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
- Separadores de capítulo: NO inyectes ni alucines títulos de capítulos o separadores artificialmente. Mantén intacta la estructura original del documento sin insertar encabezados sintéticos.
- Notas al pie en línea: Identifica el texto de las notas al pie de página. Elimina el número o símbolo de llamada, e integra la explicación de la nota al pie de forma natural e inmediatamente después del concepto aludido en el párrafo principal (puedes usar paréntesis o comas para integrarlo). Elimina la sección original de notas al pie.
- Números Romanos: Convierte todos los números romanos a su equivalente en texto o número arábigo según el contexto (ej. "Siglo XX" a "Siglo veinte", "Juan Carlos I" a "Juan Carlos Primero", "Capítulo IV" a "Capítulo cuatro").
- Abreviaturas: Expande abreviaturas comunes para su correcta pronunciación (ej. "Dr." a "Doctor", "EE.UU." a "Estados Unidos", "aprox." a "aproximadamente").
- Tablas, figuras y esquemas: Si encuentras una tabla, figura, cuadro o esquema en el documento, descríbela o resúmela de forma discursiva y fluida integrando este contexto exacto: "En el documento/libro hay una tabla/figura/esquema que se puede resumir como [resumen o explicación fluida de sus datos o contenido en formato de párrafo]".
- CONSERVACIÓN DE IDIOMA: Procesa el texto en su idioma original (ej: si el documento está en inglés, mantenlo en inglés; si está en español, mantenlo en español). NO lo traduzcas bajo ninguna circunstancia.
- PRESERVACIÓN DE MARCADORES (CRÍTICO): El texto ya contiene marcadores de capítulo objetivos formateados exactamente como "\\n\\n    \\n\\n# [Título]\\n\\n    \\n\\n". NO DEBES MODIFICAR, ELIMINAR NI REFORMATEAR ESTOS MARCADORES. Conserva intacto el símbolo "#" y los espacios en blanco exactos que los rodean, ya que el sistema los usa para generar pausas TTS.

Entrega únicamente el texto final procesado y listo para ser enviado al motor TTS. No incluyas explicaciones, saludos ni comentarios sobre las ediciones realizadas.`;
      }
    }

    const payload: any = {
      contents: [{
        parts: [
          { text: systemPrompt }
        ]
      }],
      generationConfig: { temperature: 0.1 }
    };

    if (action === 'ocr') {
      payload.contents[0].parts.push({
        inline_data: {
          mime_type: 'application/pdf',
          data: text // text contiene el base64 del PDF
        }
      });
    } else {
      payload.contents[0].parts.push({
        text: (action === 'corregir' ? 'TEXTO A CORREGIR:\n\n' : 'TEXTO A OPTIMIZAR:\n\n') + text
      });
    }

    // Vercel soporta fetch nativo en Node 18+
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    
    // --- FALLBACK A GROQ ---
    if (response.status === 429 || response.status === 402 || response.status === 403) {
      const groqKey = (userGroqApiKey && userGroqApiKey.trim() !== '') ? userGroqApiKey.trim() : process.env.GROQ_API_KEY;
      if (groqKey) {
        if (action === 'ocr') {
           return res.status(429).json({ error: 'Límite de cuota excedido en Gemini (Error 429). El Fallback a Groq no está disponible para archivos PDF binarios (solo extracción local de texto).' });
        }
        
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: (action === 'corregir' ? 'TEXTO A CORREGIR:\n\n' : 'TEXTO A OPTIMIZAR:\n\n') + text }
            ],
            temperature: 0.1
          })
        });

        const groqJson = await groqResponse.json();
        if (groqResponse.ok && groqJson.choices && groqJson.choices.length > 0) {
          let resultText = groqJson.choices[0].message.content;
          resultText = resultText.replace(/\*\*/g, "");
          return res.status(200).json({ result: resultText });
        } else {
           return res.status(500).json({ error: `Fallback a Groq falló: ${groqJson.error?.message || 'Error desconocido'}` });
        }
      }
    }
    // --- FIN FALLBACK ---

    let json: any = {};
    try {
      if (responseText) {
        json = JSON.parse(responseText);
      }
    } catch (e) {
      return res.status(response.status || 500).json({ 
        error: `La respuesta de Google no es un JSON válido. Status: ${response.status}. Contenido: ${responseText.substring(0, 200)}` 
      });
    }

    if (json.error) {
      return res.status(response.status || 500).json({ error: json.error.message || 'Error desconocido de la API de Google' });
    }

    if (!response.ok) {
      return res.status(response.status || 500).json({ 
        error: `Error de API de Google (Status ${response.status}): ${responseText || 'Respuesta vacía'}` 
      });
    }

    if (!json.candidates || json.candidates.length === 0 || !json.candidates[0].content) {
      return res.status(500).json({ error: 'La IA no devolvió candidatos. Posible bloqueo de contenido por seguridad.' });
    }

    let resultText = json.candidates[0].content.parts[0].text;
    // Eliminamos solo asteriscos de negrita, pero conservamos los '#' de los títulos objetivos
    resultText = resultText.replace(/\*\*/g, "");

    return res.status(200).json({ result: resultText });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
