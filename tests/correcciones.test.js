import test from 'node:test';
import assert from 'node:assert';
// Se prueban los módulos que realmente ejecuta la aplicación (src/main.ts los importa).
import { limpiarTextoLocal, limpiarUnionesEntrePaginas } from '../src/utils/textCleaner.ts';
import { expandirSiglasPsiquiatria, extraerTituloDePortada } from '../src/utils/textRules.ts';

test('Debe preservar términos médicos con números como DSM-5 y COVID-19', () => {
  const input = "El diagnóstico según el DSM-5 y las secuelas de COVID-19 fueron evaluados en la fase 1.";
  const clean = limpiarTextoLocal(input);
  assert.match(clean, /DSM-5/);
  assert.match(clean, /COVID-19/);
  assert.match(clean, /fase 1/);
});

test('Debe eliminar superíndices de citas con comas o tras puntuación final', () => {
  const input = "Los resultados fueron concluyentes.24 Además se evaluó la eficacia,1,2,3 en los pacientes.";
  const clean = limpiarTextoLocal(input);
  assert.ok(!clean.includes('.24'));
  assert.ok(!clean.includes(',1,2,3'));
  assert.match(clean, /concluyentes\./);
  assert.match(clean, /eficacia/);
});

test('No debe colapsar palabras en minúsculas como toc, tab o tag', () => {
  const input = "El paciente hizo toc toc en la puerta y presionó la tecla tab para ver el tag de la muestra.";
  const res = expandirSiglasPsiquiatria(input, 'es');
  assert.match(res, /toc toc/);
  assert.match(res, /tecla tab/);
  assert.match(res, /tag de la muestra/);
});

test('Debe expandir siglas en mayúsculas correctamente', () => {
  const input = "El paciente presenta TOC y TAG comórbido con TCA.";
  const res = expandirSiglasPsiquiatria(input, 'es');
  assert.match(res, /trastorno obsesivo compulsivo/);
  assert.match(res, /trastorno de ansiedad generalizada/);
  assert.match(res, /trastorno de la conducta alimentaria/);
});

test('Debe unir correctamente títulos con letras espaciadas de principio a fin', () => {
  const input = "T R A S T O R N O S   D E   L A   C O N D U C T A\nA L I M E N T A R I A";
  const titulo = extraerTituloDePortada(input);
  assert.strictEqual(titulo, "TRASTORNOS DE LA CONDUCTA - ALIMENTARIA");
});

test('No debe expandir palabras corrientes que coinciden con siglas en minúscula', () => {
  const es = expandirSiglasPsiquiatria('Comenta el caso con tus colegas tras el toc toc en la puerta.', 'es');
  assert.match(es, /con tus colegas/);
  assert.match(es, /el toc toc en la puerta/);

  const en = expandirSiglasPsiquiatria('The patient did not respond (eds. Smith).', 'en');
  assert.match(en, /patient did not respond/);
  assert.match(en, /\(eds\. Smith\)/);
});

test('Debe seguir expandiendo las siglas reales en mayúscula', () => {
  const es = expandirSiglasPsiquiatria('Presenta TOC, TAG y TUS comórbidos.', 'es');
  assert.match(es, /trastorno obsesivo compulsivo/);
  assert.match(es, /trastorno de ansiedad generalizada/);
  assert.match(es, /trastorno por uso de sustancias/);

  const en = expandirSiglasPsiquiatria('Diagnosed with DID and EDs.', 'en');
  assert.match(en, /dissociative identity disorder/);
  assert.match(en, /eating disorders/);
});

test('Debe conservar la separación entre palabras en títulos con letras espaciadas', () => {
  const input = 'C O N T R I B U C I O N E S   A   U N A   P S I Q U I A T R Í A\nOtto Dörr Zegers';
  assert.strictEqual(extraerTituloDePortada(input), 'CONTRIBUCIONES A UNA PSIQUIATRÍA - OTTO DÖRR ZEGERS');
});

test('No debe pegar palabras de un título que no está espaciado', () => {
  assert.strictEqual(
    extraerTituloDePortada('Psiquiatría Antropológica\nOtto Dörr Zegers'),
    'PSIQUIATRÍA ANTROPOLÓGICA - OTTO DÖRR ZEGERS'
  );
});
