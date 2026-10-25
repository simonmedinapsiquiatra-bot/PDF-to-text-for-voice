import test from 'node:test';
import assert from 'node:assert';
import { insertarMarcadores, formatoMarcador } from '../src/utils/marcadores.ts';
import { palabrasProtegidas } from '../src/utils/ortografia.ts';
import { expandirSiglasPsiquiatria, quitarExpansionesDuplicadas, extraerTituloDePortada } from '../src/utils/textRules.ts';
import { limpiarTextoLocal } from '../src/utils/textCleaner.ts';
import { promptDeSistema, notaDeContinuacion } from '../src/ia/prompts.ts';

test('El marcador de sección sustituye a la línea de su título, no va al principio de la página', () => {
  const pagina = 'final de la introducción, que sigue\naquí.\n\nMethod\n\nParticipants\n\nThe initial dataset comprised';
  const resultado = insertarMarcadores(pagina, ['Method', 'Participants']);
  assert.ok(resultado.startsWith('final de la introducción'));
  assert.ok(resultado.includes(formatoMarcador('Method')));
  assert.ok(resultado.includes(formatoMarcador('Participants')));
  // El título original no queda duplicado como texto suelto
  assert.strictEqual(resultado.match(/Method/g).length, 1);
  assert.ok(resultado.indexOf('# Method') < resultado.indexOf('# Participants'));
});

test('Un título partido en dos líneas también se ubica', () => {
  const pagina = 'texto previo.\n\nLimitations and future\ndirections\n\nThe sample comprised';
  const resultado = insertarMarcadores(pagina, ['Limitations and future directions']);
  assert.ok(resultado.startsWith('texto previo.'));
  assert.ok(resultado.includes('# Limitations and future directions'));
});

test('Un título que no aparece en la página se antepone, como antes', () => {
  const resultado = insertarMarcadores('texto sin el título', ['Results']);
  assert.ok(resultado.startsWith(formatoMarcador('Results')));
  // Una mención en mitad de una frase no cuenta como título
  const mencion = insertarMarcadores('see the Results section below', ['Results']);
  assert.ok(mencion.startsWith(formatoMarcador('Results')));
});

test('El corrector protege nombres propios y términos repetidos', () => {
  const texto = "Welch's ANOVA and the Likert scale. Fung and Cheung found loadings and more loadings. A typo: concentracion.";
  const protegidas = palabrasProtegidas(texto);
  for (const palabra of ['Welch', 'Likert', 'Fung', 'Cheung', 'loadings']) {
    assert.ok(protegidas.includes(palabra), palabra);
  }
  // Un error aislado en minúscula sigue siendo corregible
  assert.ok(!protegidas.includes('concentracion'));
});

test('Expandir una sigla junto a su forma completa no la duplica', () => {
  const original = 'such as Eye Movement Desensitization and Reprocessing (EMDR) to assess';
  assert.strictEqual(
    expandirSiglasPsiquiatria(original, 'en'),
    'such as Eye Movement Desensitization and Reprocessing to assess'
  );
  assert.strictEqual(quitarExpansionesDuplicadas('la terapia (la terapia) y otra (cosa)'), 'la terapia y otra (cosa)');
  // Un paréntesis distinto no se toca
  assert.strictEqual(quitarExpansionesDuplicadas('depression (major) here'), 'depression (major) here');
});

test('Los prompts de TTS incluyen las reglas de números, listas, tablas y autores', () => {
  for (const lang of ['en', 'es']) {
    const prompt = promptDeSistema('texto', lang);
    assert.ok(!prompt.includes('documento/libro') && !prompt.includes('document/book'), lang);
    assert.ok(/NUMBERS AND STATISTICS|NÚMEROS Y ESTADÍSTICAS/.test(prompt), lang);
    assert.ok(/colleagues|colaboradores/.test(prompt), lang);
    assert.ok(/NEVER in the middle of a sentence|NUNCA en mitad de una frase/.test(prompt), lang);
  }
});

test('La limpieza local conserva los rangos de una lista de categorías', () => {
  const texto = 'interpreted using the following categories: normal (≤ 9), mild (10–13), moderate (14–20),\nsevere (21–27), and extremely severe (≥ 28).';
  const limpio = limpiarTextoLocal(texto);
  for (const rango of ['(10–13)', '(14–20)', '(21–27)']) assert.ok(limpio.includes(rango), rango);
  // Las citas numéricas sueltas se siguen quitando
  assert.ok(!limpiarTextoLocal('Varios estudios lo confirman (1–4) en adultos.').includes('(1–4)'));
  assert.ok(!limpiarTextoLocal('Lo demostraron (3) y otros (5,6) después.').includes('(5,6)'));
});

test('La limpieza local no confunde los decimales con notas al pie', () => {
  assert.ok(limpiarTextoLocal('exemption under Sect. 5.1.12–5.1.18 of the National Statement').includes('5.1.18'));
  assert.ok(limpiarTextoLocal('a strong correlation (r = .50 and p < .001) here').includes('.50'));
  // Una nota al pie pegada a una palabra se sigue quitando
  assert.ok(!limpiarTextoLocal('Los resultados fueron concluyentes.24 Además').includes('24'));
});

test('El título de portada no arrastra las marcas "##" del extractor', () => {
  const portada = '## I don’t feel like myself: mapping dissociative symptoms across\n\n## depression severity in a clinical population';
  assert.ok(!extraerTituloDePortada(portada).includes('#'));
  // Y el marcador encuentra un título marcado con "##"
  assert.ok(insertarMarcadores('texto.\n\n## Results\n\nVisual inspection', ['Results']).startsWith('texto.'));
});

test('Los bloques posteriores al primero reciben el aviso de continuación', () => {
  assert.ok(notaDeContinuacion('en').includes('NOT the beginning'));
  assert.ok(notaDeContinuacion('es').includes('NO es el inicio'));
  for (const lang of ['en', 'es']) {
    assert.ok(/Parentheses|Paréntesis/.test(promptDeSistema('texto', lang)), lang);
  }
});

test('Los prompts de TTS prohíben símbolos, siglas entre paréntesis y siglas deletreadas', () => {
  for (const lang of ['en', 'es']) {
    const prompt = promptDeSistema('texto', lang);
    assert.ok(/Never output the symbols|Nunca dejes los símbolos/.test(prompt), lang);
    assert.ok(/known as|conocido como/.test(prompt), lang);
    assert.ok(/OSDD one|OSDD uno/.test(prompt), lang);
  }
  // La continuación ya no da por presentadas todas las siglas
  assert.ok(notaDeContinuacion('en').includes('must still be expanded'));
  assert.ok(notaDeContinuacion('es').includes('debe desarrollarse'));
});
