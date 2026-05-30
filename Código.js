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
    
    const systemPrompt = `
      Actúa como un transcriptor médico profesional.
      Estás recibiendo una SECCIÓN PARCIAL de un libro.
      
      OBJETIVO:
      Transcribe TODO el texto de estas páginas. No resumas.
      
      REGLAS DE FORMATO:
      1. PROHIBIDO MARKDOWN: Nada de negritas (**), cursivas (*), ni encabezados (#). Solo texto plano.
      2. Notas al pie: Si son explicativas, ponlas entre paréntesis "(Nota: ...)". Si son solo citas bibliográficas (ej: Smith, 2020), elimínalas.
      3. Tablas: Transcríbelas como párrafos descriptivos.
      4. Si el texto se corta a mitad de frase al final, déjalo cortado (la siguiente parte lo completará).
      5. Ignora encabezados repetitivos (ej: Título del libro en cada página).
    `;

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
    
    // Limpieza de seguridad
    texto = texto.replace(/\*\*/g, "").replace(/^#+\s/gm, "");

    return texto;

  } catch (e) {
    return `[ERROR LECTURA ${label}: ${e.toString()}]`;
  }
}

// Detector de Modelo Flash
function detectarMejorModeloFlash() {
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

    return modelosFlash[0].name;
  } catch (e) {
    return 'models/gemini-1.5-flash';
  }
}
