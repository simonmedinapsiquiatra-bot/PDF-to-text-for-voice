import test from 'node:test';
import assert from 'node:assert';
import { construirArchivosEpub, nombreArchivoEpub, escaparXml } from '../src/utils/epub.ts';
import { esTituloDeSeccion } from '../src/utils/marcadores.ts';

const capitulos = [
  { titulo: 'PRÓLOGO', contenido: 'PRÓLOGO.\n\nSOBRE EL PROGRAMA\n\nLos retos & los "sueños" <de> los supervivientes.' },
  { titulo: 'ENRAIZAMIENTO', contenido: 'El enraizamiento ofrece ayuda.' },
];

test('El EPUB declara el identificador que usa y lo repite en el índice', () => {
  const a = construirArchivosEpub({ titulo: 'Tener los pies en la tierra', idioma: 'es', capitulos, uuid: '1234-abcd' });
  assert.strictEqual(Object.keys(a)[0], 'mimetype');
  assert.strictEqual(a['mimetype'], 'application/epub+zip');
  const opf = a['OEBPS/content.opf'];
  const idRef = opf.match(/unique-identifier="([^"]+)"/)[1];
  assert.ok(new RegExp(`<dc:identifier id="${idRef}"[^>]*>urn:uuid:1234-abcd</dc:identifier>`).test(opf));
  assert.ok(a['OEBPS/toc.ncx'].includes('<meta name="dtb:uid" content="urn:uuid:1234-abcd"/>'));
  assert.ok(opf.includes('<dc:language>es</dc:language>'));
  // Cada capítulo del manifiesto existe y está en el spine
  for (const id of ['chapter_1', 'chapter_2']) {
    assert.ok(a[`OEBPS/${id}.xhtml`]);
    assert.ok(opf.includes(`<itemref idref="${id}"/>`));
  }
});

test('Los capítulos usan XHTML 1.1, escapan el texto y no repiten el título', () => {
  const a = construirArchivosEpub({ titulo: 'T', idioma: 'en', capitulos, uuid: 'u' });
  const cap = a['OEBPS/chapter_1.xhtml'];
  assert.ok(cap.includes('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"'));
  assert.ok(!cap.includes('<meta charset'));
  assert.ok(cap.includes('Los retos &amp; los &quot;sueños&quot; &lt;de&gt; los supervivientes.'));
  // "PRÓLOGO." solo repetía el título
  assert.strictEqual(cap.match(/PRÓLOGO/g).length, 2); // <title> y <h2>
  assert.ok(cap.includes('<p>SOBRE EL PROGRAMA</p>'));
  assert.strictEqual(escaparXml('a\u0007b'), 'ab');
});

test('El nombre del archivo lleva una sola extensión .epub', () => {
  assert.strictEqual(nombreArchivoEpub('(2026)(Tener los pies)(Brand).epub'), '(2026)(Tener los pies)(Brand).epub');
  assert.strictEqual(nombreArchivoEpub('libro.epub.epub'), 'libro.epub');
  assert.strictEqual(nombreArchivoEpub('libro (Limpio).txt'), 'libro (Limpio).epub');
});

test('Un marcador del PDF que es un trozo de frase no es título de sección', () => {
  assert.ok(esTituloDeSeccion('PRÓLOGO'));
  assert.ok(esTituloDeSeccion('Limitations and future directions'));
  assert.ok(esTituloDeSeccion('Módulo 1: Enraizamiento'));
  assert.ok(!esTituloDeSeccion('parte del estudio de la Red TOP DD, ofrecimos la primera versión de este programa a personas que habían'));
  assert.ok(!esTituloDeSeccion('introducción al programa FSG para sacarle el máximo partido, que sigue a este prólogo.'));
  assert.ok(!esTituloDeSeccion('Aunque trabajar para enraizarte y para mantenerte en ese estado es una parte crucial para ayudarte,'));
  assert.ok(!esTituloDeSeccion(''));
});

test('Una frase marcada como título vuelve a unirse; un título real se respeta', async () => {
  const { limpiarEncabezadosFalsos } = await import('../src/utils/marcadores.ts');
  const texto = 'pueden beneficiarse del tratamiento del trauma. Como\n\n    \n\n# parte del estudio de la Red TOP DD, ofrecimos la primera versión de este programa a personas que habían sufrido traumas.\n\n    \n\n# ENRAIZAMIENTO\n\n    \n\nEl enraizamiento ofrece ayuda.';
  const limpio = limpiarEncabezadosFalsos(texto);
  assert.ok(limpio.includes('del trauma. Como parte del estudio de la Red TOP DD, ofrecimos la primera versión de este programa a personas que habían sufrido traumas.'));
  assert.ok(!limpio.includes('# parte'));
  assert.ok(limpio.includes('# ENRAIZAMIENTO'));
});
