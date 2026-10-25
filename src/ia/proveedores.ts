/**
 * Enrutado entre proveedores de IA.
 *
 * Antes esta cascada estaba escrita dos veces en api/gemini.ts (una para
 * extraer metadatos y otra para corregir/adaptar), con sus listas de modelos
 * duplicadas. Aquí vive una sola vez y ambas la reutilizan.
 *
 * Fuera de api/ por el mismo motivo que prompts.ts: Vercel trata cada fichero
 * de api/ como un endpoint.
 */

/** Orden en que se intentan los modelos de Google, tras el que pida el usuario. */
export const CADENA_MODELOS_GEMINI = [
  'models/gemini-3.8-flash',
  'models/gemini-3.6-flash',
  'models/gemini-3.5-flash-lite',
];

export const MODELO_GEMINI_POR_DEFECTO = 'gemini-3.8-flash';

/**
 * Modelos que Google retiró y su sustituto. Google ya redirige 3.7 Flash a
 * 3.8 Flash y 3.5 Flash a 3.6 Flash (octubre de 2026); se traducen aquí para
 * que una elección guardada con el nombre viejo use el modelo vigente.
 */
const MODELOS_SUSTITUIDOS: Record<string, string> = {
  'gemini-2.5-flash': MODELO_GEMINI_POR_DEFECTO,
  'gemini-3.5-flash': 'gemini-3.6-flash',
  'gemini-3.7-flash': 'gemini-3.8-flash',
};

/** Nombre vigente de un modelo de Gemini, con o sin el prefijo "models/". */
export function modeloVigente(modelo: string): string {
  const prefijo = modelo.startsWith('models/') ? 'models/' : '';
  const id = modelo.replace(/^models\//, '');
  return prefijo + (MODELOS_SUSTITUIDOS[id] || id);
}

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

/**
 * Tiempo total que la cascada puede gastar. vercel.json da 300 s a la función
 * (el máximo del plan Hobby con Fluid Compute): cortar antes deja responder un
 * 504 limpio en vez de que Vercel la mate.
 */
export const PLAZO_CASCADA_MS = 280_000;

/**
 * Nivel de razonamiento de Gemini. Los modelos 3.x razonan a nivel "medium"
 * por defecto antes de responder, lo que alargaba los bloques hasta el 504;
 * para limpiar y adaptar texto basta con "low", el de menor latencia.
 */
const NIVEL_RAZONAMIENTO = 'low';

/** La petición a Gemini con el nivel de razonamiento bajo. */
export function conRazonamientoBajo(payload: any): any {
  return {
    ...payload,
    generationConfig: { ...(payload?.generationConfig || {}), thinkingConfig: { thinkingLevel: NIVEL_RAZONAMIENTO } },
  };
}

/** Por debajo de este margen ya no compensa empezar otra llamada. */
const MARGEN_MINIMO_MS = 3_000;

/** Mensaje con el que se corta la cascada al agotar el plazo. */
const MENSAJE_PLAZO_AGOTADO = 'timeout: se agotó el tiempo de la función antes de obtener respuesta';

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
  extraHeaders: Record<string, string> = {},
  limite: number = Date.now() + PLAZO_CASCADA_MS
): Promise<{ content: string; model: string } | null> {
  for (const model of models) {
    const restante = limite - Date.now();
    if (restante < MARGEN_MINIMO_MS) return null;
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
        signal: AbortSignal.timeout(restante),
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

/**
 * Texto de una respuesta de Gemini: une las partes de texto que no son
 * razonamiento. Con el razonamiento activo, la primera parte puede no ser el
 * texto de la respuesta.
 */
export function textoDeRespuestaGemini(json: any): string {
  const partes = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(partes)) return '';
  return partes.filter(p => typeof p?.text === 'string' && !p.thought).map(p => p.text).join('');
}

/** El mensaje útil de un error de Google, sin el JSON que lo envuelve. */
export function resumenErrorGoogle(cuerpo: string): string {
  let mensaje = cuerpo;
  let cuota = '';
  try {
    const error = JSON.parse(cuerpo)?.error;
    if (error?.message) mensaje = `${error.status ? error.status + ': ' : ''}${error.message}`;
    // El identificador de la cuota dice si el límite es por minuto o por día
    const violacion = (error?.details || []).flatMap((d: any) => d?.violations || []).find((v: any) => v?.quotaId);
    if (violacion) cuota = ` [${violacion.quotaId}]`;
  } catch (e) { /* no era JSON: se usa tal cual */ }
  return (mensaje.replace(/\s+/g, ' ').trim().substring(0, 220) + cuota);
}

function nombreCorto(modelo: string): string {
  return modelo.replace(/^models\//, '');
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
  plazoMs?: number;
}): Promise<{ respuesta: RespuestaProveedor | null; ultimoError: string; agotado: boolean }> {
  const { orden, claves, modelosGemini, payloadGemini, systemPrompt, userPrompt, soloGemini } = opciones;
  const limite = Date.now() + (opciones.plazoMs ?? PLAZO_CASCADA_MS);
  const erroresGemini: string[] = [];
  const sinTiempo = () => limite - Date.now() < MARGEN_MINIMO_MS;
  let ultimoError = '';

  for (const proveedor of orden) {
    if (sinTiempo()) {
      return { respuesta: null, ultimoError: ultimoError || MENSAJE_PLAZO_AGOTADO, agotado: true };
    }

    if (proveedor === 'gemini') {
      if (!claves.gemini) continue;
      for (const modelo of modelosGemini) {
        if (sinTiempo()) {
          return { respuesta: null, ultimoError: ultimoError || MENSAJE_PLAZO_AGOTADO, agotado: true };
        }
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelo}:generateContent?key=${claves.gemini}`;
          const pedir = (cuerpo: any) => fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo),
            signal: AbortSignal.timeout(limite - Date.now()),
          });

          let response = await pedir(conRazonamientoBajo(payloadGemini));
          let responseText = await response.text();

          // Ante cualquier 400 se repite la petición sin el nivel de razonamiento,
          // por si es ese campo lo que el modelo rechaza, antes de pasar al siguiente.
          if (response.status === 400 && !sinTiempo()) {
            response = await pedir(payloadGemini);
            responseText = await response.text();
          }

          if (response.ok) {
            let json: any = null;
            try { json = JSON.parse(responseText); } catch (e) { json = null; }
            const texto = textoDeRespuestaGemini(json);
            if (texto) {
              return { respuesta: { proveedor: 'gemini', modelo, contenido: texto }, ultimoError, agotado: false };
            }
            erroresGemini.push(`${nombreCorto(modelo)}: respuesta sin texto (${json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason || 'sin motivo'})`);
          } else {
            erroresGemini.push(`${nombreCorto(modelo)}: Status ${response.status}: ${resumenErrorGoogle(responseText)}`);
          }
        } catch (netErr: any) {
          erroresGemini.push(`${nombreCorto(modelo)}: error de red: ${netErr.message}`);
        }
        // Todos los modelos, empezando por el principal: el último por sí solo
        // escondía por qué falló el modelo elegido.
        ultimoError = `Google ${erroresGemini.join(' | ')}`;
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
      config.cabeceras,
      limite
    );
    if (resultado) {
      return { respuesta: { proveedor, modelo: resultado.model, contenido: resultado.content }, ultimoError, agotado: false };
    }
    ultimoError = config.errorAgotado;
  }

  return { respuesta: null, ultimoError, agotado: sinTiempo() };
}
