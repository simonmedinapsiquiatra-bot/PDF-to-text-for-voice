/**
 * Contenido de un EPUB 2 válido a partir de los capítulos del texto limpio.
 *
 * Solo arma los ficheros; src/main.ts los empaqueta con JSZip. Las apps de
 * lectura en voz alta suelen validar el EPUB con rigor, y el que generaba la
 * app antes fallaba en dos puntos: el package declaraba un identificador
 * (unique-identifier) que no existía, y los capítulos usaban la cabecera de
 * HTML5 en lugar de la de XHTML 1.1 que pide EPUB 2.
 */

export interface CapituloEpub {
  titulo: string;
  contenido: string;
}

export function escaparXml(texto: string): string {
  return (texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Caracteres de control que XML no admite
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function normalizar(texto: string): string {
  return texto.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Párrafos del capítulo, sin el primero si solo repite el título. */
function parrafosDe(capitulo: CapituloEpub): string[] {
  const parrafos = capitulo.contenido.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (parrafos.length > 0 && normalizar(parrafos[0]) === normalizar(capitulo.titulo)) parrafos.shift();
  return parrafos;
}

/**
 * Ficheros del EPUB, como ruta → contenido. "mimetype" debe ser el primero
 * del ZIP y sin comprimir; el orden de este objeto ya lo respeta.
 */
export function construirArchivosEpub(opciones: {
  titulo: string;
  idioma: string;
  capitulos: CapituloEpub[];
  uuid: string;
}): Record<string, string> {
  const { titulo, capitulos, uuid } = opciones;
  const idioma = opciones.idioma === 'en' ? 'en' : 'es';
  const identificador = `urn:uuid:${uuid}`;
  const archivos: Record<string, string> = {};

  archivos['mimetype'] = 'application/epub+zip';
  archivos['META-INF/container.xml'] = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  let manifest = '';
  let spine = '';
  let navPoints = '';

  capitulos.forEach((capitulo, i) => {
    const id = `chapter_${i + 1}`;
    const tituloXml = escaparXml(capitulo.titulo);
    const cuerpo = parrafosDe(capitulo)
      .map(p => `  <p>${escaparXml(p).replace(/\n/g, '<br/>')}</p>`)
      .join('\n');

    archivos[`OEBPS/${id}.xhtml`] = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${idioma}">
<head>
  <meta http-equiv="Content-Type" content="application/xhtml+xml; charset=utf-8"/>
  <title>${tituloXml}</title>
</head>
<body>
  <h2>${tituloXml}</h2>
${cuerpo}
</body>
</html>`;

    manifest += `\n    <item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`;
    spine += `\n    <itemref idref="${id}"/>`;
    navPoints += `
    <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${tituloXml}</text></navLabel>
      <content src="${id}.xhtml"/>
    </navPoint>`;
  });

  archivos['OEBPS/content.opf'] = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escaparXml(titulo)}</dc:title>
    <dc:language>${idioma}</dc:language>
    <dc:identifier id="BookId" opf:scheme="UUID">${identificador}</dc:identifier>
    <dc:creator opf:role="aut">Dr. Media TTS</dc:creator>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>${manifest}
  </manifest>
  <spine toc="ncx">${spine}
  </spine>
</package>`;

  archivos['OEBPS/toc.ncx'] = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${identificador}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escaparXml(titulo)}</text></docTitle>
  <navMap>${navPoints}
  </navMap>
</ncx>`;

  return archivos;
}

/** Nombre del archivo con una sola extensión .epub (antes salía ".epub.epub"). */
export function nombreArchivoEpub(nombre: string): string {
  return (nombre || 'documento').replace(/(\.(txt|epub))+$/i, '') + '.epub';
}
