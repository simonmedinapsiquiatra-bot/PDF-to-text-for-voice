import test from 'node:test';
import assert from 'node:assert';
import { clasificarError, esperaPorCuota, calcularConcurrencia } from '../src/utils/reintentos.ts';

test('Clasifica los errores de cuota por encima de los demás', () => {
  assert.strictEqual(clasificarError('Status 429: rate limit exceeded'), 'cuota');
  assert.strictEqual(clasificarError('QUOTA exceeded for model'), 'cuota');
  assert.strictEqual(clasificarError('Rate Limit alcanzado'), 'cuota');
  // Un 429 manda aunque el mensaje también hable de timeout
  assert.strictEqual(clasificarError('429 timeout'), 'cuota');
});

test('Distingue timeout, modelo inexistente y error de servidor', () => {
  assert.strictEqual(clasificarError('Status 504 gateway timeout'), 'timeout');
  assert.strictEqual(clasificarError('Respuesta no válida del servidor'), 'timeout');
  assert.strictEqual(clasificarError('Status 404: model not found'), 'no_encontrado');
  assert.strictEqual(clasificarError('Status 503 service unavailable'), 'servidor');
  assert.strictEqual(clasificarError('algo raro pasó'), 'desconocido');
  assert.strictEqual(clasificarError(''), 'desconocido');
});

test('Una función caída (cuerpo no-JSON con 500) es error de servidor, no timeout', () => {
  assert.strictEqual(
    clasificarError('Respuesta no válida del servidor (HTTP 500): A server error has occurred FUNCTION_INVOCATION_FAILED'),
    'servidor'
  );
  // Un 504 con cuerpo HTML sigue siendo timeout
  assert.strictEqual(clasificarError('Respuesta no válida del servidor (HTTP 504): <html>'), 'timeout');
});

test('La espera por cuota respeta el retraso que indica el proveedor', () => {
  assert.strictEqual(esperaPorCuota('Please retry in 7.5s', 1), 9500);
  assert.strictEqual(esperaPorCuota('retry in 0.2s', 4), 2200);
});

test('Sin indicación del proveedor, la espera crece exponencialmente desde 15 s', () => {
  assert.strictEqual(esperaPorCuota('429', 1), 15000);
  assert.strictEqual(esperaPorCuota('429', 2), 22500);
  assert.strictEqual(esperaPorCuota('429', 3), 33750);
});

test('La concurrencia depende de la capa y del modo Turbo', () => {
  assert.strictEqual(calcularConcurrencia(true, false), 15);
  assert.strictEqual(calcularConcurrencia(true, true), 15);
  assert.strictEqual(calcularConcurrencia(false, true), 10);
  assert.strictEqual(calcularConcurrencia(false, false), 5);
});
