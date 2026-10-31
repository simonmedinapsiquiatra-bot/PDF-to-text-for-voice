import test from 'node:test';
import assert from 'node:assert';
import { extraerCapitulos, textoParaTxt, paginarTexto, limpiarParaTTS } from '../src/utils/capitulos.ts';

test('Sin marcadores, un párrafo que empieza por "Parte de" o "Sección de" no es capítulo', () => {
  const texto = [
    'Introducción breve del libro, con algo de contexto para empezar a leer.',
    'Parte del problema es que los supervivientes no se sienten seguros.',
    'Sección de ejercicios para practicar en casa con calma.',
    'Capítulo 3: El enraizamiento',
    'Texto del capítulo tres.',
    'PARTE II',
    'Texto de la segunda parte.',
    'DSM-5-TR',
    'Más texto.',
  ].join('\n\n');
  const titulos = extraerCapitulos(texto).map(c => c.titulo);
  assert.deepStrictEqual(titulos, ['Inicio / Introducción', 'Capítulo 3: El enraizamiento', 'PARTE II']);
});

test('Con marcadores "# Título", se usan solo los que son títulos', () => {
  const texto = 'Antes de todo hay un párrafo de presentación bastante largo para contar.\n\n# PRÓLOGO\n\nTexto del prólogo. Como\n\n# parte del estudio, ofrecimos el programa a personas que habían sufrido traumas.\n\n# MÓDULO 1\n\nEnraizamiento.';
  const capitulos = extraerCapitulos(texto);
  assert.deepStrictEqual(capitulos.map(c => c.titulo), ['Inicio / Introducción', 'PRÓLOGO', 'MÓDULO 1']);
  assert.ok(capitulos[1].contenido.includes('Como parte del estudio, ofrecimos'));
});

test('Un texto sin encabezados queda en un solo capítulo', () => {
  assert.deepStrictEqual(extraerCapitulos('Solo un párrafo.').map(c => c.titulo), ['Documento Completo']);
  assert.deepStrictEqual(extraerCapitulos(''), []);
});

test('El TXT no lleva "#": el título queda como frase con punto', () => {
  const txt = textoParaTxt('Intro.\n\n    \n\n# Method\n\n    \n\n# Participants\n\nThe sample.\n\n# Results:\n\nX.');
  assert.ok(!txt.includes('#'));
  assert.ok(txt.includes('Method.\n\nParticipants.\n\nThe sample.'));
  assert.ok(txt.includes('Results:\n\nX.'));
  assert.ok(!/\n[ \t]+\n/.test(txt));
});

test('Un EPUB de entrada se reparte en páginas sin cortar párrafos', () => {
  const parrafo = (n) => Array.from({ length: n }, () => 'palabra').join(' ');
  const texto = [parrafo(200), parrafo(200), parrafo(100), parrafo(500)].join('\n\n');
  const paginas = paginarTexto(texto, 350);
  assert.deepStrictEqual(paginas.map(p => p.split(/\s+/).length), [200, 300, 500]);
  assert.deepStrictEqual(paginarTexto(''), []);
});

test('La limpieza para TTS quita filas de símbolos y emojis', () => {
  const limpio = limpiarParaTTS('Título\n=======\n📖 Texto ***');
  assert.ok(!/[=*📖]/u.test(limpio));
  assert.deepStrictEqual(limpio.split(/\s+/), ['Título', 'Texto']);
});

test('Un título largo de artículo es título; un trozo de frase no', async () => {
  const { esTituloDeSeccion } = await import('../src/utils/marcadores.ts');
  assert.ok(esTituloDeSeccion('I don’t feel like myself: mapping dissociative symptoms across depression severity in a clinical population'));
  assert.ok(!esTituloDeSeccion('parte del estudio de la Red TOP DD, ofrecimos la primera versión de este programa a personas que habían'));
  assert.ok(!esTituloDeSeccion('Aunque trabajar para enraizarte y para mantenerte en ese estado es una parte crucial para ayudarte,'));
});

test('Unir páginas no pega los marcadores de sección a los párrafos vecinos', async () => {
  const { limpiarUnionesEntrePaginas } = await import('../src/utils/textCleaner.ts');
  const texto = 'Introducción del libro.\n\n\n\n    \n\n# PRÓLOGO\n\n    \n\n\n\nLos retos a los que se\n\nenfrentan los supervivientes.';
  const limpio = limpiarUnionesEntrePaginas(texto);
  assert.ok(limpio.includes('Introducción del libro.\n\n# PRÓLOGO\n\nLos retos'));
  // Una frase partida entre páginas se sigue uniendo
  assert.ok(limpio.includes('Los retos a los que se enfrentan los supervivientes.'));
});
