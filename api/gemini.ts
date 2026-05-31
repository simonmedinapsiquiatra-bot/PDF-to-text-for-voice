import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  const { action, text, lang, userApiKey, model } = body;

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
    let systemPrompt = '';

    if (action === 'corregir') {
      systemPrompt = `Actúas como un editor de textos profesional y corrector de estilo especializado en adaptaciones lingüísticas de alta calidad. Tu tarea es corregir errores tipográficos, ortográficos, gramaticales y anomalías de extracción de PDF (como palabras cortadas o caracteres con acentuación separada) en el texto que se te proporciona, el cual está escrito en el idioma ${lang?.toUpperCase() || 'ES'}.

Instrucciones estrictas de corrección:
1. Normalización Unicode: Repara palabras deformadas por la codificación del PDF o el OCR (ej: convierte 'cl ínica' en 'clínica', 'mostrí ó' en 'mostró', 'tenaní' en 'tenían', 'exper íencia' en 'experiencia', 'relació n' en 'relación', 'diagnstico' en 'diagnóstico').
2. Corrección de saltos de sílabas residuales: Une palabras que se cortaron al final del renglón (ej. 'pre- valencia' a 'prevalencia').
3. Respetar jerga médica/técnica: NO modifiques siglas válidas como 'TCA', 'AN', 'BN', 'SCOFF' ni nombres de fármacos o diagnósticos válidos (como 'bulimia', 'lisdexamfetamina', 'anorexia'). No intentes simplificar la terminología científica ni cambiar el estilo del texto original.
4. Mantener la estructura exacta: No agregues resúmenes, no cambies párrafos de lugar, y no agregues explicaciones, notas editoriales ni saludos. Entrega estrictamente el texto corregido.`;
    } else if (action === 'ocr') {
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
- Notas al pie en línea: Identifica el texto de las notas al pie de página. Elimina el número o símbolo de llamada, e integra la explicación de la nota al pie de forma natural e inmediatamente después del concepto aludido en el párrafo principal (puedes usar paréntesis o comas para integrarlo). Elimina la sección original de notas al pie.
- Números Romanos: Convierte todos los números romanos a su equivalente en texto o número arábigo según el contexto (ej. "Siglo XX" a "Siglo veinte", "Juan Carlos I" a "Juan Carlos Primero", "Capítulo IV" a "Capítulo cuatro").
- Abreviaturas: Expande abreviaturas comunes para su correcta pronunciación (ej. "Dr." a "Doctor", "EE.UU." a "Estados Unidos", "aprox." a "aproximadamente").
- Tablas y cuadros: Si encuentras una tabla con datos crudos, omítela por completo. Si contiene texto discursivo importante, reescríbelo en formato de párrafo fluido.

Entrega únicamente el texto final procesado y listo para ser enviado al motor TTS. No incluyas explicaciones, saludos ni comentarios sobre las ediciones realizadas.`;
    } else {
      // Default: Limpieza y optimización TTS (procesarFragmentoTexto)
      systemPrompt = `Actúa como un procesador de texto avanzado diseñado para optimizar documentos para sistemas Text-to-Speech (TTS). Tu objetivo es generar un texto fluido, continuo y de fácil escucha, eliminando cualquier interrupción visual o académica.

Ejecuta el procesamiento en dos fases secuenciales:

FASE 1: Limpieza Estructural (Prioriza Regex y coincidencia de patrones)
Elimina o corrige estrictamente los siguientes elementos:
- Guiones de separación silábica: Une palabras separadas por saltos de línea (ej. medi-\\ncina a medicina).
- Cabeceras, pies de página y numeración: Elimina cualquier texto repetitivo en los margins y los números de página aislados.
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
    resultText = resultText.replace(/\*\*/g, "").replace(/^#+\s/gm, "");

    return res.status(200).json({ result: resultText });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
