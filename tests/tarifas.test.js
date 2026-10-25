import test from 'node:test';
import assert from 'node:assert';
import { costeEstimadoUSD, resumenVacio, sumarUso, describirUso } from '../src/ia/tarifas.ts';
import { usoDeGemini } from '../src/ia/proveedores.ts';

test('El coste cobra el razonamiento como salida', () => {
  // 1M de entrada a 0,75 + (0,5M salida + 0,5M razonamiento) a 3,75
  assert.strictEqual(costeEstimadoUSD('models/gemini-3.8-flash', { entrada: 1_000_000, salida: 500_000, razonamiento: 500_000 }), 4.5);
  assert.strictEqual(costeEstimadoUSD('openai/gpt-oss-120b', { entrada: 10, salida: 10, razonamiento: 0 }), null);
});

test('Los tokens de Gemini salen de usageMetadata', () => {
  assert.deepStrictEqual(
    usoDeGemini({ usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 900, thoughtsTokenCount: 300 } }),
    { entrada: 1200, salida: 900, razonamiento: 300 }
  );
  assert.strictEqual(usoDeGemini({}), undefined);
});

test('El resumen suma llamadas, caché y proveedores sin tarifa', () => {
  const r = resumenVacio();
  sumarUso(r, 'gemini-3.8-flash', { entrada: 10_000, salida: 4_000, razonamiento: 1_000 });
  sumarUso(r, '', null);
  sumarUso(r, 'openai/gpt-oss-120b', { entrada: 500, salida: 200, razonamiento: 0 });
  assert.strictEqual(r.llamadas, 2);
  assert.strictEqual(r.desdeCache, 1);
  assert.strictEqual(r.entrada, 10_500);
  assert.ok(r.costeIncompleto);
  assert.ok(Math.abs(r.costeUSD - (10_000 * 0.75 + 5_000 * 3.75) / 1e6) < 1e-12);
  const texto = describirUso(r);
  assert.ok(texto.includes('2 llamadas + 1 desde caché'));
  assert.ok(texto.includes('coste estimado ≈ 0,03 USD'));
  assert.ok(texto.includes('sin contar proveedores sin tarifa'));
});
