/**
 * Enrutado entre proveedores de IA.
 *
 * Antes esta cascada estaba escrita dos veces en api/gemini.ts (una para
 * extraer metadatos y otra para corregir/adaptar), con sus listas de modelos
 * duplicadas. Aquí vive una sola vez y ambas la reutilizan.
 */

/** Orden en que se intentan los modelos de Google, tras el que pida el usuario. */
export const CADENA_MODELOS_GEMINI = [
  'models/gemini-3.5-flash',
  'models/gemini-3.5-flash-lite',
  'models/gemini-3.7-flash',
  'models/gemini-3.6-flash',
  'models/gemini-2.5-flash',
];

export const MODELO_GEMINI_POR_DEFECTO = 'gemini-3.5-flash';

/** Proveedores compatibles con la API de OpenAI, en su orden de respaldo. */
export const PROVEEDORES_OPENAI = {
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    modelos: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen-qwq-32b'],
    cabeceras: {} as Record<string, string>,
    errorAgotado: 'Groq Cloud agotó cuota o falló.',
  },
  cerebras: {
    endpoint: 'https://api.cerebras.ai/v1/chat/completions',
    modelos: ['gpt-oss-120b'],
    cabeceras: {} as Record<string, string>,
    errorAgotado: 'Cerebras Cloud agotó cuota o falló.',
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    modelos: ['openrouter/free', 'nvidia/nemotron-3-ultra:free'],
    cabeceras: { 'HTTP-Referer': 'https://dr-media.app', 'X-Title': 'Dr. Media' } as Record<string, string>,
    errorAgotado: 'OpenRouter Free agotó cuota o falló.',
  },
  huggingface: {
    endpoint: 'https://api-inference.huggingface.co/v1/chat/completions',
    modelos: [
      'meta-llama/Meta-Llama-3.1-8B-Instruct',
      'microsoft/Phi-3.5-mini-instruct',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
    ],
    cabeceras: {} as Record<string, string>,
    errorAgotado: 'Hugging Face API falló.',
  },
};

/** Orden por defecto de la cascada: Gemini primero y luego los respaldos. */
export const ORDEN_PROVEEDORES = ['gemini', ...Object.keys(PROVEEDORES_OPENAI)];

export type Claves = Record<string, string | undefined>;

export interface RespuestaProveedor {
  proveedor: string;
  modelo: string;
  contenido: string;
}

/** Llamada genérica a un proveedor compatible con OpenAI, probando sus modelos en orden. */
export async function llamarProveedorOpenAI(
  endpoint: string,
  apiKey: string,
  models: string[],
  systemPrompt: string,
  userPrompt: string,
  extraHeaders: Record<string, string> = {}
): Promise<{ content: string; model: string } | null> {
  for (const model of models) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...extraHeaders,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Fallback Provider] Falló modelo ${model} (${response.status}):`, errorText.substring(0, 150));
        continue;
      }

      const json = await response.json();
      if (json.choices && json.choices.length > 0 && json.choices[0].message?.content) {
        return { content: json.choices[0].message.content, model: json.model || model };
      }
    } catch (err: any) {
      console.warn(`[Fallback Provider] Error de red con modelo ${model}:`, err.message);
      continue;
    }
  }
  return null;
}

/** Modelos de Gemini a intentar: el pedido por el usuario primero, sin repetir. */
export function jerarquiaGemini(modelPath: string): string[] {
  return [modelPath, ...CADENA_MODELOS_GEMINI].filter((m, i, arr) => arr.indexOf(m) === i);
}

/**
 * Recorre los proveedores en orden y devuelve la primera respuesta válida.
 * `soloGemini` corta los respaldos (OCR multimodal y capa de pago).
 */
export async function ejecutarCascada(opciones: {
  orden: string[];
  claves: Claves;
  modelosGemini: string[];
  payloadGemini: any;
  systemPrompt: string;
  userPrompt: string;
  soloGemini?: boolean;
}): Promise<{ respuesta: RespuestaProveedor | null; ultimoError: string }> {
  const { orden, claves, modelosGemini, payloadGemini, systemPrompt, userPrompt, soloGemini } = opciones;
  let ultimoError = '';

  for (const proveedor of orden) {
    if (proveedor === 'gemini') {
      if (!claves.gemini) continue;
      for (const modelo of modelosGemini) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelo}:generateContent?key=${claves.gemini}`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadGemini),
          });

          const responseText = await response.text();

          if (response.ok) {
            let json: any = null;
            try { json = JSON.parse(responseText); } catch (e) { json = null; }
            const texto = json?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (texto) {
              return { respuesta: { proveedor: 'gemini', modelo, contenido: texto }, ultimoError };
            }
          } else {
            ultimoError = `Google ${modelo} Status ${response.status}: ${responseText.substring(0, 150)}`;
          }
        } catch (netErr: any) {
          ultimoError = `Error de red con Google ${modelo}: ${netErr.message}`;
        }
      }
      continue;
    }

    const config = PROVEEDORES_OPENAI[proveedor as keyof typeof PROVEEDORES_OPENAI];
    const clave = claves[proveedor];
    if (!config || !clave || soloGemini) continue;

    const resultado = await llamarProveedorOpenAI(
      config.endpoint,
      clave,
      config.modelos,
      systemPrompt,
      userPrompt,
      config.cabeceras
    );
    if (resultado) {
      return { respuesta: { proveedor, modelo: resultado.model, contenido: resultado.content }, ultimoError };
    }
    ultimoError = config.errorAgotado;
  }

  return { respuesta: null, ultimoError };
}
