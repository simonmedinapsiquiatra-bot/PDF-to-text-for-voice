import type { Request, Response } from 'express';
import { autodetectarLenguaje } from '../src/utils/textRules.ts';
import { promptDeSistema, etiquetaDeEntrada, promptDeMetadatos, SISTEMA_METADATOS } from './prompts.ts';
import {
  ejecutarCascada,
  jerarquiaGemini,
  MODELO_GEMINI_POR_DEFECTO,
  ORDEN_PROVEEDORES,
  type Claves,
} from './proveedores.ts';

/**
 * Normaliza y valida la salida JSON de corrección y limpieza para TTS (dr-media-ai-guardrail)
 */
function sanitizeGuardrailResponse(rawText: string): string {
  let cleaned = rawText.trim();

  // Extraer bloque JSON si el modelo lo envolvió en markdown y añadió texto extra
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) {
    cleaned = match[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    const finalText = parsed.adapted_text || parsed.adaptedText || parsed.text || parsed.corrected_text || parsed.texto_adaptado;
    if (finalText) {
      parsed.adapted_text = finalText.replace(/\*\*/g, "");
      if (!Array.isArray(parsed.removed_elements)) parsed.removed_elements = [];
      if (!Array.isArray(parsed.flagged_omissions)) parsed.flagged_omissions = [];

      return JSON.stringify({
        adapted_text: parsed.adapted_text,
        removed_elements: parsed.removed_elements,
        flagged_omissions: parsed.flagged_omissions
      });
    }
  } catch (e) {
    // Fallback si no es JSON válido
  }

  return JSON.stringify({
    adapted_text: cleaned.replace(/\*\*/g, ""),
    removed_elements: [],
    flagged_omissions: ["Formato no estructurado devuelto por la IA"]
  });
}

/** Resuelve cada clave: la que envía el usuario manda sobre la del servidor. */
function resolverClaves(body: any): Claves {
  const elegir = (delUsuario: string | undefined, delEntorno: string | undefined) =>
    (delUsuario && delUsuario.trim() !== '') ? delUsuario.trim() : delEntorno;

  return {
    gemini: elegir(body.userApiKey, process.env.GEMINI_API_KEY),
    groq: elegir(body.userGroqApiKey, process.env.GROQ_API_KEY),
    cerebras: elegir(body.userCerebrasApiKey, process.env.CEREBRAS_API_KEY),
    openrouter: elegir(body.userOpenRouterApiKey, process.env.OPENROUTER_API_KEY),
    huggingface: elegir(body.userHuggingFaceApiKey, process.env.HUGGINGFACE_API_KEY),
  };
}

export default async function handler(req: Request, res: Response) {
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
  const { action, text, lang, model, preferredProvider, geminiTier } = body;

  if (!text) {
    return res.status(400).json({ error: 'Falta el parámetro "text"' });
  }

  const claves = resolverClaves(body);

  if (!Object.values(claves).some(Boolean)) {
    return res.status(400).json({
      error: 'No se configuró ninguna API Key. Agrégala en la configuración de la app (icono de engranaje) o configúrala en el archivo .env del servidor.'
    });
  }

  // Modelo de Google pedido, normalizado a la forma "models/<id>"
  const activeModel = (model && model.trim() !== '' && model !== 'auto') ? model.trim() : MODELO_GEMINI_POR_DEFECTO;
  const modelosGemini = jerarquiaGemini(activeModel.startsWith('models/') ? activeModel : 'models/' + activeModel);

  try {
    let detectedLang: 'es' | 'en' = (lang === 'es' || lang === 'en') ? lang : 'es';
    if (action !== 'ocr' && lang !== 'es' && lang !== 'en' && text) {
      detectedLang = autodetectarLenguaje(text);
    }

    // --- ACCIÓN: METADATA ---
    if (action === 'metadata') {
      const prompt = promptDeMetadatos(text);

      const { respuesta } = await ejecutarCascada({
        orden: ORDEN_PROVEEDORES,
        claves,
        modelosGemini,
        payloadGemini: {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        },
        systemPrompt: SISTEMA_METADATOS,
        userPrompt: prompt,
      });

      if (respuesta) {
        return res.status(200).json({
          result: respuesta.contenido,
          provider: respuesta.proveedor,
          modelUsed: respuesta.modelo,
        });
      }

      return res.status(200).json({
        result: '{"title": "Desconocido", "author": "Desconocido", "year": "Desconocido"}',
        provider: 'fallback',
        modelUsed: 'local-heuristic'
      });
    }

    // --- ACCIÓN: CORREGIR O ADAPTAR PARA TTS ---
    const systemPrompt = promptDeSistema(action, detectedLang);

    const payload: any = {
      contents: [{
        parts: [
          { text: systemPrompt }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            adapted_text: { type: "STRING" },
            removed_elements: { type: "ARRAY", items: { type: "STRING" } },
            flagged_omissions: { type: "ARRAY", items: { type: "STRING" } }
          },
          required: ["adapted_text", "removed_elements", "flagged_omissions"]
        }
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
      payload.contents[0].parts.push({ text: etiquetaDeEntrada(action) + text });
    }

    const userPromptText = etiquetaDeEntrada(action) + text;

    // MODO TURBO CAÓTICO: el proveedor preferido encabeza la cascada.
    // En OCR (multimodal) y en la capa de pago solo se usa Gemini.
    const orden = (preferredProvider && ORDEN_PROVEEDORES.includes(preferredProvider))
      ? [preferredProvider, ...ORDEN_PROVEEDORES.filter(p => p !== preferredProvider)]
      : ORDEN_PROVEEDORES;
    const soloGemini = action === 'ocr' || geminiTier === 'payg';

    const { respuesta, ultimoError } = await ejecutarCascada({
      orden: soloGemini ? ['gemini'] : orden,
      claves,
      modelosGemini,
      payloadGemini: payload,
      systemPrompt,
      userPrompt: userPromptText,
      soloGemini,
    });

    if (respuesta) {
      return res.status(200).json({
        result: sanitizeGuardrailResponse(respuesta.contenido),
        provider: respuesta.proveedor,
        modelUsed: respuesta.modelo,
      });
    }

    if (action === 'ocr') {
      return res.status(429).json({
        error: 'Límite de cuota excedido en Gemini (Error 429). El Fallback a otros proveedores no está disponible para archivos PDF binarios (solo extracción local de texto).'
      });
    }

    // Si fallaron todos los proveedores, retornar 503 con detalle
    return res.status(503).json({
      error: `Todos los proveedores de IA fallaron o agotaron cuota. Último error: ${ultimoError || 'Sin respuesta válida'}`
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
