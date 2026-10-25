import test from 'node:test';
import assert from 'node:assert';
import { origenPermitido, origenesExtra, esMismoOrigen } from '../src/ia/origen.ts';
import { trozosBajoLimite, ERROR_PAGINA_DEMASIADO_GRANDE } from '../src/utils/ocrPorTamano.ts';
import { textoDeClaveDeCache } from '../src/utils/cacheIA.ts';
import { ejecutarCascada } from '../src/ia/proveedores.ts';
import { clasificarError } from '../src/utils/reintentos.ts';

test('El proxy atiende a la propia app y rechaza otras webs', () => {
  assert.ok(origenPermitido('https://mi-app.vercel.app', 'mi-app.vercel.app', []));
  assert.ok(origenPermitido('http://localhost:3000', 'localhost:3000', []));
  assert.ok(!origenPermitido('https://otra-web.com', 'mi-app.vercel.app', []));
  // Sin cabecera Origin no viene de un navegador en la app
  assert.ok(!origenPermitido(undefined, 'mi-app.vercel.app', []));
  assert.ok(!esMismoOrigen('no es una url', 'mi-app.vercel.app'));
});

test('ORIGENES_PERMITIDOS añade dominios extra', () => {
  const extras = origenesExtra(' https://Mi-Dominio.com/ , https://otro.com');
  assert.deepStrictEqual(extras, ['https://mi-dominio.com', 'https://otro.com']);
  assert.ok(origenPermitido('https://mi-dominio.com', 'mi-app.vercel.app', extras));
  assert.deepStrictEqual(origenesExtra(undefined), []);
});

test('Un bloque OCR que excede el límite se parte por la mitad conservando el orden', async () => {
  // Cada página "pesa" 10 caracteres de base64
  const construir = async (indices) => 'x'.repeat(indices.length * 10);
  const trozos = await trozosBajoLimite([0, 1, 2, 3, 4], construir, 25);
  assert.deepStrictEqual(trozos.map(t => t.indices), [[0, 1], [2], [3, 4]]);
  assert.ok(trozos.every(t => t.base64.length <= 25));

  const sinPartir = await trozosBajoLimite([0, 1], construir, 100);
  assert.strictEqual(sinPartir.length, 1);
});

test('Una sola página que no cabe da un error que no se reintenta', async () => {
  const construir = async () => 'x'.repeat(50);
  await assert.rejects(trozosBajoLimite([7], construir, 25), (err) => {
    assert.ok(err.message.includes(ERROR_PAGINA_DEMASIADO_GRANDE));
    assert.ok(err.message.includes('página 8'));
    assert.strictEqual(clasificarError(err.message), 'demasiado_grande');
    return true;
  });
  assert.strictEqual(clasificarError('Respuesta no válida del servidor (HTTP 413): Request Entity Too Large'), 'demasiado_grande');
});

test('Las claves de API no forman parte de la clave de caché', () => {
  const base = { action: 'texto', text: 'hola', model: 'auto' };
  const conClave = { ...base, userApiKey: 'AAA', userGroqApiKey: 'BBB' };
  const otraClave = { ...base, userApiKey: 'CCC' };
  assert.strictEqual(textoDeClaveDeCache(conClave), textoDeClaveDeCache(otraClave));
  assert.notStrictEqual(textoDeClaveDeCache(base), textoDeClaveDeCache({ ...base, text: 'adiós' }));
  // No modifica la petición original
  assert.strictEqual(conClave.userApiKey, 'AAA');
});

test('La cascada se corta al agotar el plazo y lo indica', async () => {
  const fetchOriginal = globalThis.fetch;
  // AbortSignal.timeout no mantiene vivo el proceso: este intervalo sí
  const mantenerVivo = setInterval(() => {}, 1000);
  // Un proveedor que nunca responde hasta que lo aborta la señal
  globalThis.fetch = (_url, opciones) => new Promise((_, reject) => {
    opciones.signal.addEventListener('abort', () => reject(opciones.signal.reason));
  });
  try {
    const inicio = Date.now();
    const { respuesta, agotado, ultimoError } = await ejecutarCascada({
      orden: ['gemini', 'groq'],
      claves: { gemini: 'g', groq: 'q' },
      modelosGemini: ['models/a', 'models/b'],
      payloadGemini: {},
      systemPrompt: '',
      userPrompt: '',
      plazoMs: 3_500,
    });
    assert.strictEqual(respuesta, null);
    assert.strictEqual(agotado, true);
    assert.ok(ultimoError);
    assert.ok(Date.now() - inicio < 6_000);
  } finally {
    globalThis.fetch = fetchOriginal;
    clearInterval(mantenerVivo);
  }
});

test('Los modelos de Gemini retirados se sustituyen por el vigente', async () => {
  const { modeloVigente, jerarquiaGemini, CADENA_MODELOS_GEMINI } = await import('../src/ia/proveedores.ts');
  assert.strictEqual(modeloVigente('gemini-3.7-flash'), 'gemini-3.8-flash');
  assert.strictEqual(modeloVigente('models/gemini-3.5-flash'), 'models/gemini-3.6-flash');
  assert.strictEqual(modeloVigente('gemini-2.5-flash'), 'gemini-3.8-flash');
  assert.strictEqual(modeloVigente('gemini-3.8-flash'), 'gemini-3.8-flash');
  // La cascada ya no incluye modelos retirados
  assert.ok(!CADENA_MODELOS_GEMINI.some(m => /3\.7-flash|3\.5-flash$/.test(m)));
  assert.strictEqual(jerarquiaGemini('models/gemini-3.8-flash')[0], 'models/gemini-3.8-flash');
});

test('Gemini se pide con razonamiento bajo y se reintenta sin él si el modelo no lo admite', async () => {
  const { ejecutarCascada, conRazonamientoBajo } = await import('../src/ia/proveedores.ts');
  assert.deepStrictEqual(
    conRazonamientoBajo({ generationConfig: { temperature: 0.1 } }).generationConfig,
    { temperature: 0.1, thinkingConfig: { thinkingLevel: 'low' } }
  );

  const fetchOriginal = globalThis.fetch;
  const cuerpos = [];
  globalThis.fetch = async (_url, opciones) => {
    const cuerpo = JSON.parse(opciones.body);
    cuerpos.push(cuerpo);
    if (cuerpo.generationConfig?.thinkingConfig) {
      return new Response('{"error":{"message":"thinking_level is not supported"}}', { status: 400 });
    }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 });
  };
  try {
    const { respuesta } = await ejecutarCascada({
      orden: ['gemini'], claves: { gemini: 'g' }, modelosGemini: ['models/a'],
      payloadGemini: { generationConfig: { temperature: 0.1 } }, systemPrompt: '', userPrompt: '',
    });
    assert.strictEqual(respuesta.contenido, 'ok');
    assert.strictEqual(cuerpos.length, 2);
    assert.ok(cuerpos[0].generationConfig.thinkingConfig);
    assert.ok(!cuerpos[1].generationConfig.thinkingConfig);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
