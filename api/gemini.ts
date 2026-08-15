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

/**
 * Normaliza y valida la salida JSON de corrección y limpieza para TTS (dr-media-ai-guardrail)
 */
function sanitizeGuardrailResponse(rawText: string): string {
  let cleaned = rawText.replace(/\*\*/g, "").trim();
  
  // Si el modelo encerró la respuesta en bloques de código markdown ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.adapted_text) {
      parsed.adapted_text = parsed.adapted_text.replace(/\*\*/g, "");
      if (!Array.isArray(parsed.removed_elements)) parsed.removed_elements = [];
      if (!Array.isArray(parsed.flagged_omissions)) parsed.flagged_omissions = [];
      return JSON.stringify(parsed);
    }
  } catch (e) {
    // Fallback si no es JSON válido
  }

  return JSON.stringify({
    adapted_text: cleaned,
    removed_elements: [],
    flagged_omissions: ["Formato no estructurado devuelto por la IA"]
  });
}

/**
 * Ejecuta llamada OpenAI-compatible genérica para proveedores de Fallback (Groq, OpenRouter, Cerebras)
 */
async function callOpenAICompatibleProvider(
  endpoint: string,
  apiKey: string,
  models: string[],
  systemPrompt: string,
  userPrompt: string,
  extraHeaders: Record<string, string> = {}
): Promise<string | null> {
  for (const model of models) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...extraHeaders
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Fallback Provider] Falló modelo ${model} (${response.status}):`, errorText.substring(0, 150));
        continue;
      }

      const json = await response.json();
      if (json.choices && json.choices.length > 0 && json.choices[0].message?.content) {
        return json.choices[0].message.content;
      }
    } catch (err: any) {
      console.warn(`[Fallback Provider] Error de red con modelo ${model}:`, err.message);
      continue;
    }
  }
  return null;
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
  const { action, text, lang, userApiKey, userGroqApiKey, userOpenRouterApiKey, userCerebrasApiKey, userHuggingFaceApiKey, model, preferredProvider } = body;

  if (!text) {
    return res.status(400).json({ error: 'Falta el parámetro "text"' });
  }

  // Resolver la API Key: preferir la provista por el usuario, luego la del entorno de Vercel
  const apiKey = (userApiKey && userApiKey.trim() !== '') ? userApiKey.trim() : process.env.GEMINI_API_KEY;
  const groqKey = (userGroqApiKey && userGroqApiKey.trim() !== '') ? userGroqApiKey.trim() : process.env.GROQ_API_KEY;
  const openRouterKey = (userOpenRouterApiKey && userOpenRouterApiKey.trim() !== '') ? userOpenRouterApiKey.trim() : process.env.OPENROUTER_API_KEY;
  const cerebrasKey = (userCerebrasApiKey && userCerebrasApiKey.trim() !== '') ? userCerebrasApiKey.trim() : process.env.CEREBRAS_API_KEY;
  const huggingFaceKey = (userHuggingFaceApiKey && userHuggingFaceApiKey.trim() !== '') ? userHuggingFaceApiKey.trim() : process.env.HUGGINGFACE_API_KEY;

  if (!apiKey && !groqKey && !openRouterKey && !cerebrasKey && !huggingFaceKey) {
    return res.status(400).json({ 
      error: 'No se configuró ninguna API Key. Agrégala en la configuración de la app (icono de engranaje) o configúrala en Vercel.' 
    });
  }

  // Lista de modelos de respaldo actualizados (Agosto 2026)
  const GROQ_FALLBACK_MODELS = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen-qwq-32b'
  ];

  const OPENROUTER_FALLBACK_MODELS = [
    'openrouter/free',
    'nvidia/nemotron-3-ultra:free'
  ];

  const CEREBRAS_FALLBACK_MODELS = [
    'gpt-oss-120b'
  ];

  const HUGGINGFACE_FALLBACK_MODELS = [
    'meta-llama/Meta-Llama-3.1-8B-Instruct',
    'microsoft/Phi-3.5-mini-instruct',
    'mistralai/Mixtral-8x7B-Instruct-v0.1'
  ];

  // Determinar modelo oficial de Google Gemini (Gemini 3.x series - Agosto 2026)
  const defaultModel = 'gemini-3.5-flash';
  const activeModel = (model && model.trim() !== '' && model !== 'auto') ? model.trim() : defaultModel;

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

    // --- ACCIÓN: METADATA ---
    if (action === 'metadata') {
      const prompt = `Analiza el inicio del siguiente documento académico/libro y extrae los metadatos principales.

INSTRUCCIONES CRÍTICAS PARA EL TÍTULO ("title"):
1. EL TÍTULO DEBE SER EL TÍTULO ESPECÍFICO DEL ARTÍCULO O CAPÍTULO, NO EL NOMBRE DE LA REVISTA NI DE LA EDITORIAL.
2. NOMBRES DE REVISTAS / PUBLICACIONES A IGNORAR TOTALMENTE PARA EL TÍTULO (ejemplos):
   - "Revista de Psiquiatría del Uruguay", "Revista Chilena de Neuro-Psiquiatría", "Acta Psychiatrica Scandinavica", "The American Journal of Psychiatry", "Journal of Clinical Psychiatry", "The Lancet", "BMJ", "Archives of General Psychiatry", "UpToDate", "World Psychiatry", etc.
3. SECCIONES A IGNORAR: "Artículo Original", "Original Article", "Caso Clínico", "Report of a Case", "Artículo de Revisión", "Review Article", "Editorial", "Cartas al Editor", "Trabajo Original", "Sección Especial".
4. Si el documento contiene un título claro de artículo (por ejemplo: "Eficacia de la Lisdexamfetamina en Trastorno por Atracón"), ESE es el "title".
5. Si NO encuentras un título de artículo individual y solo ves el nombre de la revista o encabezados generales, responde "title": "Desconocido".

Responde ESTRICTAMENTE con un objeto JSON válido con las claves "title", "author" y "year". Si falta alguno, usa "Desconocido". No agregues ningún otro texto ni formato markdown.

TEXTO:
${text}`;
      
      const payload: any = {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      };

      if (apiKey) {
        const geminiModelsToTry = [
          modelPath,
          'models/gemini-3.5-flash',
          'models/gemini-3.5-flash-lite',
          'models/gemini-3.7-flash',
          'models/gemini-3.6-flash',
          'models/gemini-2.5-flash'
        ].filter((m, idx, arr) => arr.indexOf(m) === idx);

        for (const gemModel of geminiModelsToTry) {
          try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${gemModel}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if (response.ok) {
              const json = await response.json();
              if (json.candidates && json.candidates.length > 0 && json.candidates[0].content?.parts?.[0]?.text) {
                return res.status(200).json({ result: json.candidates[0].content.parts[0].text });
              }
            }
          } catch(e) {
            console.warn(`[Gemini Metadata] Error intentando con ${gemModel}:`, e);
          }
        }
      }

      // Fallback a Groq para metadatos
      if (groqKey) {
        const groqResult = await callOpenAICompatibleProvider(
          'https://api.groq.com/openai/v1/chat/completions',
          groqKey,
          GROQ_FALLBACK_MODELS,
          'Eres un extractor experto de metadatos bibliográficos. Devuelve ESTRICTAMENTE un JSON con title, author y year.',
          prompt
        );
        if (groqResult) {
          return res.status(200).json({ result: groqResult, provider: 'groq' });
        }
      }

      // Fallback a Cerebras para metadatos
      if (cerebrasKey) {
        const cerebrasResult = await callOpenAICompatibleProvider(
          'https://api.cerebras.ai/v1/chat/completions',
          cerebrasKey,
          CEREBRAS_FALLBACK_MODELS,
          'Eres un extractor experto de metadatos bibliográficos. Devuelve ESTRICTAMENTE un JSON con title, author y year.',
          prompt
        );
        if (cerebrasResult) {
          return res.status(200).json({ result: cerebrasResult, provider: 'cerebras' });
        }
      }

      // Fallback a OpenRouter para metadatos
      if (openRouterKey) {
        const openRouterResult = await callOpenAICompatibleProvider(
          'https://openrouter.ai/api/v1/chat/completions',
          openRouterKey,
          OPENROUTER_FALLBACK_MODELS,
          'Eres un extractor experto de metadatos bibliográficos. Devuelve ESTRICTAMENTE un JSON con title, author y year.',
          prompt,
          { 'HTTP-Referer': 'https://dr-media.app', 'X-Title': 'Dr. Media' }
        );
        if (openRouterResult) {
          return res.status(200).json({ result: openRouterResult, provider: 'openrouter' });
        }
      }

      return res.status(200).json({ result: '{"title": "Desconocido", "author": "Desconocido", "year": "Desconocido"}' });
    }

    // --- ACCIÓN: CORREGIR O ADAPTAR PARA TTS ---
    let systemPrompt = '';

    if (action === 'corregir') {
      if (detectedLang === 'en') {
        systemPrompt = `Act as a professional copyeditor and style corrector specializing in high-quality text cleanup. Your task is to correct typographical, spelling, and grammatical errors, as well as PDF extraction anomalies (such as split words or character accentuation issues) in the provided text, which is written in ENGLISH.

Strict cleanup instructions:
1. Unicode Normalization: Repair words deformed by PDF encoding or OCR (e.g., reconstruct words that have weird spacing, broken accents, or malformed characters).
2. Fix broken hyphenations: Rejoin words that were split at line breaks (e.g., 'pre- valence' to 'prevalence').
3. Respect medical/technical jargon: DO NOT modify acronyms (like 'TCA', 'AN', 'BN', 'SCOFF', 'PTSD', 'ADHD') or names of drugs or valid diagnoses. Do not simplify scientific terminology or alter the style of the original text.
4. Maintain exact structure: Do not add summaries, do not change paragraph order, and do not add explanations, editorial notes, or greetings.
5. LANGUAGE CONSERVATION: Keep the text in English. DO NOT translate it to Spanish or any other language under any circumstances.
6. MARKER PRESERVATION: If you find titles marked with "# " and surrounded by spaces (e.g., "\\n\\n    \\n\\n# TITLE\\n\\n    \\n\\n"), you must preserve them EXACTLY as they are, without altering the "#" symbol or the surrounding blank spaces.
7. METADATA PRESERVATION (CRITICAL): DO NOT remove the main title of the document, the author's name(s), or the publication year if they appear at the beginning of the text.

Deliver STRICTLY a valid JSON object with this schema:
{
  "adapted_text": "The corrected text",
  "removed_elements": [],
  "flagged_omissions": []
}`;
      } else {
        systemPrompt = `Actúas como un editor de textos profesional y corrector de estilo especializado en adaptaciones lingüísticas de alta calidad. Tu tarea es corregir errores tipográficos, ortográficos, gramaticales y anomalías de extracción de PDF (como palabras cortadas o caracteres con acentuación separada) en el texto que se te proporciona, el cual está escrito en el idioma ESPAÑOL.

Instrucciones estrictas de corrección:
1. Normalización Unicode: Repara palabras deformadas por la codificación del PDF o el OCR (ej: convierte 'cl ínica' en 'clínica', 'mostrí ó' en 'mostró', 'tenaní' en 'tenían', 'exper íencia' en 'experiencia', 'relació n' en 'relación', 'diagnstico' en 'diagnóstico').
2. Corrección de saltos de sílabas residuales: Une palabras que se cortaron al final del renglón (ej. 'pre- valencia' a 'prevalencia').
3. Respetar jerga médica/técnica: NO modifiques siglas válidas como 'TCA', 'AN', 'BN', 'SCOFF' ni nombres de fármacos o diagnósticos válidos (como 'bulimia', 'lisdexamfetamina', 'anorexia'). No intentes simplificar la terminología científica ni cambiar el estilo del texto original.
4. Mantener la estructura exacta: No agregues resúmenes, no cambies párrafos de lugar, y no agregues explicaciones, notas editoriales ni saludos.
5. CONSERVACIÓN DE IDIOMA: Mantén el texto en español. NO lo traduzcas al inglés ni a ningún otro idioma bajo ninguna circunstancia.
6. PRESERVACIÓN DE MARCADORES: Si encuentras títulos marcados con "# " y rodeados de espacios (ej. "\\n\\n    \\n\\n# TITULO\\n\\n    \\n\\n"), debes conservarlos EXACTAMENTE igual, sin alterar el símbolo "#" ni los espacios en blanco que los rodean.
7. CONSERVACIÓN DE METADATOS (CRÍTICO): NO elimines el título principal del documento, ni los nombres de los autores, ni el año de publicación si aparecen al inicio del texto.

Entrega ESTRICTAMENTE un objeto JSON válido con este esquema:
{
  "adapted_text": "El texto corregido",
  "removed_elements": [],
  "flagged_omissions": []
}`;
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
- Author lists and bibliography: Completely remove bibliography sections at the end of the text. DO NOT remove the main author(s) at the very beginning of the document.
- Figure/table references: Remove text in parentheses or commas that say "(See Figure X)", "(Table Y)", "(Chart Z)".
- Garbage characters: Remove formatting sequences (---, ***, ===) and replace complex bullets with standard punctuation (commas or periods).
- METADATA PRESERVATION (CRITICAL): DO NOT remove the main document title, the author's name, or the publication year at the beginning of the text. Keep them as part of the content.

PHASE 2: Semantic Adaptation for TTS (Contextual analysis)
Modify the resulting text applying these fluidity rules:
- Chapter Separators: DO NOT artificially inject or hallucinate chapter titles or separators. Leave the original structure of the document intact without inserting synthetic chapter headings.
- Inline footnotes: Identify footnote text. Remove the call number or symbol, and integrate the footnote explanation naturally and immediately after the concept referred to in the main paragraph (use parentheses or commas to integrate it). Remove the original footnote section.
- Roman Numerals: Convert all Roman numerals to their text or Arabic equivalent depending on the context (e.g., "Century XX" to "Century twenty", "Chapter IV" to "Chapter four"). For medical diagnoses, always read them as numbers (e.g., "Bipolar I" to "Bipolar one", "Bipolar II" to "Bipolar two", never "Bipolar second").
- Abbreviations: Expand common abbreviations for correct pronunciation (e.g., "Dr." to "Doctor", "e.g." to "for example", "approx." to "approximately").
- Tables, figures, and charts: If you find a table, figure, chart, or diagram in the document, describe or summarize it in a discursive and fluid way, strictly integrating this context: "In the document/book there is a table/figure/diagram that can be summarized as [fluid summary or explanation of its data or content in paragraph format]".
- LANGUAGE CONSERVATION: Process the text in its original language (e.g., if the document is in English, keep it in English; if it is in Spanish, keep it in Spanish). DO NOT translate it under any circumstances.
- MARKER PRESERVATION (CRITICAL): The text already contains objective chapter markers formatted exactly as "\\n\\n    \\n\\n# [Title]\\n\\n    \\n\\n". YOU MUST NOT MODIFY, DELETE, OR REFORMAT THESE MARKERS. Keep the "#" symbol and the exact blank spaces around them intact, as they are used by the system to generate TTS pauses.

Deliver STRICTLY a valid JSON object with the following schema:
{
  "adapted_text": "The final processed text ready to be sent to the TTS engine.",
  "removed_elements": ["List of specific elements you removed, e.g. 'Bibliography at page X', 'Table Y'"],
  "flagged_omissions": ["List any important clinical or contextual data you omitted or summarized heavily, if any"]
}
Do not include explanations outside the JSON object.`;
      } else {
        systemPrompt = `Actúa como un procesador de texto avanzado diseñado para optimizar documentos para sistemas Text-to-Speech (TTS). Tu objetivo es generar un texto fluido, continuo y de fácil escucha, eliminando cualquier interrupción visual o académica.

Ejecuta el procesamiento en dos fases secuenciales:

FASE 1: Limpieza Estructural (Prioriza Regex y coincidencia de patrones)
Elimina o corrige estrictamente los siguientes elementos:
- Guiones de separación silábica: Une palabras separadas por saltos de línea (ej. medi-\\ncina a medicina).
- Cabeceras, pies de página y numeración: Elimina cualquier texto repetitivo en los márgenes y los números de página aislados.
- URLs y correos: Elimina enlaces web completos (http..., www...) y direcciones de correo electrónico.
- Citas académicas integradas: Elimina corchetes [1], superíndices de referencias bibliográficas, y citas parentéticas estilo APA (Autor, Año).
- Listas de autores y bibliografía: Elimina por completo las secciones de referencias bibliográficas al final del texto. NO elimines el nombre de los autores principales al inicio del documento.
- Llamados a gráficos: Elimina textos entre paréntesis o comas que digan "(Ver Figura X)", "(Tabla Y)", "(Gráfico Z)".
- Caracteres basura: Elimina secuencias de formato (---, ***, ===) y reemplaza viñetas complejas por puntuación estándar (comas o puntos).
- CONSERVACIÓN DE METADATOS (CRÍTICO): NO elimines el título principal del documento, ni el nombre del autor, ni el año de publicación al inicio del texto. Consérvalos como parte del contenido.

FASE 2: Adaptación Semántica para TTS (Análisis contextual)
Modifica el texto resultante aplicando estas reglas de fluidez:
- Separadores de capítulo: NO inyectes ni alucines títulos de capítulos o separadores artificialmente. Mantén intacta la estructura original del documento sin insertar encabezados sintéticos.
- Notas al pie en línea: Identifica el texto de las notas al pie de página. Elimina el número o símbolo de llamada, e integra la explicación de la nota al pie de forma natural e inmediatamente después del concepto aludido en el párrafo principal (puedes usar paréntesis o comas para integrarlo). Elimina la sección original de notas al pie.
- Números Romanos: Convierte todos los números romanos a su equivalente en texto o número arábigo según el contexto (ej. "Siglo XX" a "Siglo veinte", "Juan Carlos I" a "Juan Carlos Primero", "Capítulo IV" a "Capítulo cuatro"). Para diagnósticos médicos, léelos siempre como números cardinales (ej. "Bipolar I" a "Bipolar uno", "Bipolar II" a "Bipolar dos", nunca "Bipolar segundo").
- Abreviaturas: Expande abreviaturas comunes para su correcta pronunciación (ej. "Dr." a "Doctor", "EE.UU." a "Estados Unidos", "aprox." a "aproximadamente").
- Tablas, figuras y esquemas: Si encuentras una tabla, figura, cuadro o esquema en el documento, descríbela o resúmela de forma discursiva y fluida integrando este contexto exacto: "En el documento/libro hay una tabla/figura/esquema que se puede resumir como [resumen o explicación fluida de sus datos o contenido en formato de párrafo]".
- CONSERVACIÓN DE IDIOMA: Procesa el texto en su idioma original (ej: si el documento está en inglés, mantenlo en inglés; si está en español, mantenlo en español). NO lo traduzcas bajo ninguna circunstancia.
- PRESERVACIÓN DE MARCADORES (CRÍTICO): El texto ya contiene marcadores de capítulo objetivos formateados exactamente como "\\n\\n    \\n\\n# [Título]\\n\\n    \\n\\n". NO DEBES MODIFICAR, ELIMINAR NI REFORMATEAR ESTOS MARCADORES. Conserva intacto el símbolo "#" y los espacios en blanco exactos que los rodean, ya que el sistema los usa para generar pausas TTS.

Entrega ESTRICTAMENTE un objeto JSON válido con el siguiente esquema:
{
  "adapted_text": "El texto final procesado y listo para ser enviado al motor TTS.",
  "removed_elements": ["Lista de elementos específicos eliminados, ej. 'Bibliografía de la página X', 'Tabla Y'"],
  "flagged_omissions": ["Lista cualquier dato clínico o contextual importante que hayas omitido o resumido en exceso, si lo hay"]
}
No incluyas texto o explicaciones fuera del objeto JSON.`;
      }
    }

    const payload: any = {
      contents: [{
        parts: [
          { text: systemPrompt }
        ]
      }],
      generationConfig: { 
        temperature: 0.1,
        responseMimeType: "application/json"
      }
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

    const userPromptText = (action === 'corregir' ? 'TEXTO A CORREGIR:\n\n' : 'TEXTO A OPTIMIZAR:\n\n') + text;

    let lastError = '';

    // MODO TURBO CAÓTICO: Construir cadena de fallback en base a preferredProvider
    let providersOrder = ['gemini', 'groq', 'cerebras', 'openrouter', 'huggingface'];
    
    if (preferredProvider && providersOrder.includes(preferredProvider)) {
      providersOrder = [
        preferredProvider,
        ...providersOrder.filter(p => p !== preferredProvider)
      ];
    }

    if (action === 'ocr') {
      providersOrder = ['gemini']; // OCR es estrictamente multimodal
    }

    for (const provider of providersOrder) {
      if (provider === 'gemini' && apiKey) {
        const geminiHierarchy = [
          modelPath,
          'models/gemini-3.5-flash',
          'models/gemini-3.5-flash-lite',
          'models/gemini-3.7-flash',
          'models/gemini-3.6-flash',
          'models/gemini-2.5-flash'
        ].filter((m, idx, arr) => arr.indexOf(m) === idx);

        let geminiSuccess = false;
        for (const gemModel of geminiHierarchy) {
          try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/${gemModel}:generateContent?key=${apiKey}`;
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            const responseText = await response.text();

            if (response.ok) {
              let json: any = {};
              try { json = JSON.parse(responseText); } catch (e) { json = null; }

              if (json && json.candidates && json.candidates.length > 0 && json.candidates[0].content?.parts?.[0]?.text) {
                const rawAiText = json.candidates[0].content.parts[0].text;
                const sanitizedJson = sanitizeGuardrailResponse(rawAiText);
                return res.status(200).json({ result: sanitizedJson, provider: 'gemini', modelUsed: gemModel });
              }
            } else {
              lastError = `Google ${gemModel} Status ${response.status}: ${responseText.substring(0, 150)}`;
              if (response.status === 404 || response.status === 429 || response.status >= 500) {
                continue; // Saltar al siguiente modelo de Gemini
              }
            }
          } catch (netErr: any) {
            lastError = `Error de red con Google ${gemModel}: ${netErr.message}`;
            continue;
          }
        }
      }

      if (provider === 'groq' && groqKey && action !== 'ocr') {
        const groqResult = await callOpenAICompatibleProvider(
          'https://api.groq.com/openai/v1/chat/completions',
          groqKey,
          GROQ_FALLBACK_MODELS,
          systemPrompt,
          userPromptText
        );
        if (groqResult) {
          return res.status(200).json({ result: sanitizeGuardrailResponse(groqResult), provider: 'groq' });
        } else {
          lastError = 'Groq Cloud agotó cuota o falló.';
        }
      }

      if (provider === 'cerebras' && cerebrasKey && action !== 'ocr') {
        const cerebrasResult = await callOpenAICompatibleProvider(
          'https://api.cerebras.ai/v1/chat/completions',
          cerebrasKey,
          CEREBRAS_FALLBACK_MODELS,
          systemPrompt,
          userPromptText
        );
        if (cerebrasResult) {
          return res.status(200).json({ result: sanitizeGuardrailResponse(cerebrasResult), provider: 'cerebras' });
        } else {
          lastError = 'Cerebras Cloud agotó cuota o falló.';
        }
      }

      if (provider === 'openrouter' && openRouterKey && action !== 'ocr') {
        const openRouterResult = await callOpenAICompatibleProvider(
          'https://openrouter.ai/api/v1/chat/completions',
          openRouterKey,
          OPENROUTER_FALLBACK_MODELS,
          systemPrompt,
          userPromptText,
          { 'HTTP-Referer': 'https://dr-media.app', 'X-Title': 'Dr. Media' }
        );
        if (openRouterResult) {
          return res.status(200).json({ result: sanitizeGuardrailResponse(openRouterResult), provider: 'openrouter' });
        } else {
          lastError = 'OpenRouter Free agotó cuota o falló.';
        }
      }

      if (provider === 'huggingface' && huggingFaceKey && action !== 'ocr') {
        const hfResult = await callOpenAICompatibleProvider(
          'https://api-inference.huggingface.co/v1/chat/completions',
          huggingFaceKey,
          HUGGINGFACE_FALLBACK_MODELS,
          systemPrompt,
          userPromptText
        );
        if (hfResult) {
          return res.status(200).json({ result: sanitizeGuardrailResponse(hfResult), provider: 'huggingface' });
        } else {
          lastError = 'Hugging Face API falló.';
        }
      }
    }

    if (action === 'ocr') {
      return res.status(429).json({ 
        error: 'Límite de cuota excedido en Gemini (Error 429). El Fallback a otros proveedores no está disponible para archivos PDF binarios (solo extracción local de texto).' 
      });
    }

    // Si fallaron todos los proveedores, retornar 503 con detalle
    return res.status(503).json({ 
      error: `Todos los proveedores de IA fallaron o agotaron cuota. Último error: ${lastError || 'Sin respuesta válida'}` 
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
