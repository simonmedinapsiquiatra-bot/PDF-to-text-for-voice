/**
 * Colocación de los marcadores de sección ("# Título") que vienen de los
 * marcadores nativos del PDF.
 *
 * Un marcador del PDF solo dice en qué página empieza una sección, no en qué
 * punto de ella. Ponerlo al principio de la página dejaba "# Method" en mitad
 * del final de la introducción. Aquí se busca la línea del propio título y el
 * marcador la sustituye; solo si no aparece se recurre al principio de la página.
 */

/**
 * Un marcador del PDF sirve como título de sección. Algunos PDF traen
 * marcadores que son trozos de frase ("parte del estudio de la Red TOP DD,
 * ofrecimos…"): usados como capítulo, partían la frase en dos y repetían el
 * trozo en voz alta. Un título no empieza en minúscula, no termina en coma y
 * es corto.
 */
export function esTituloDeSeccion(titulo: string): boolean {
  const t = (titulo || '').trim();
  if (t.length < 2 || t.length > 90) return false;
  if (/^\p{Ll}/u.test(t)) return false;
  if (/[,;]$/.test(t)) return false;
  return t.split(/\s+/).length <= 14;
}

/** Formato del marcador: las líneas con un espacio generan pausas en el TTS. */
export function formatoMarcador(titulo: string): string {
  return `\n\n    \n\n# ${titulo}\n\n    \n\n`;
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Inserta los marcadores de `titulos` (en orden de aparición) en el texto de
 * una página. Cada título se busca como línea propia, tolerando saltos de línea
 * entre palabras y un punto o dos puntos final.
 */
export function insertarMarcadores(textoPagina: string, titulos: string[]): string {
  let texto = textoPagina;
  const sinUbicar: string[] = [];

  for (const titulo of titulos) {
    const palabras = titulo.trim().split(/\s+/).filter(Boolean).map(escaparRegex);
    if (palabras.length === 0) continue;

    // El extractor marca con "## " las líneas de letra grande
    const linea = new RegExp(`(^|\\n)[ \\t]*(?:#{1,6}[ \\t]*)?${palabras.join('\\s+')}[ \\t]*[.:]?[ \\t]*(?=\\n|$)`, 'i');
    const encontrado = linea.exec(texto);
    if (encontrado) {
      const inicio = encontrado.index + encontrado[1].length;
      const fin = encontrado.index + encontrado[0].length;
      texto = texto.slice(0, inicio) + formatoMarcador(titulo.trim()) + texto.slice(fin);
    } else {
      sinUbicar.push(titulo.trim());
    }
  }

  if (sinUbicar.length > 0) {
    texto = sinUbicar.map(formatoMarcador).join('') + texto;
  }
  return texto;
}
