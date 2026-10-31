/**
 * Reparto del texto final en capítulos (para el EPUB) y limpieza de símbolos
 * que no se deben leer en voz alta. Antes vivían en src/main.ts sin pruebas.
 */
import { esTituloDeSeccion, limpiarEncabezadosFalsos } from './marcadores.ts';

export interface Capitulo {
  titulo: string;
  contenido: string;
}

/** Quita símbolos de formato (=====, ***, emojis) que el TTS leería en voz alta. */
export function limpiarParaTTS(texto: string): string {
  if (!texto) return '';
  let res = texto;
  // 1. Filas de símbolos de formato (=======, -------, *******, #######)
  res = res.replace(/[=\-_*~#|]{2,}/g, ' ');
  // 2. Emojis e iconos sin sentido en TTS
  res = res.replace(/[📖🎧]/g, ' ');
  // 3. Símbolos decorativos sueltos al principio y al final de las líneas
  res = res.replace(/^[=\-_*~|]+\s*/gm, '');
  res = res.replace(/\s*[=\-_*~|]+$/gm, '');
  // 4. Espacios y saltos de línea
  res = res.replace(/ {2,}/g, ' ');
  res = res.replace(/\n{3,}/g, '\n\n');
  return res.trim();
}

/**
 * Número de un encabezado "Capítulo 3", "Parte II", "Part One", "Sección 2.1".
 * Sin él, cualquier párrafo que empezara por "Parte de…" o "Sección de…" se
 * convertía en capítulo.
 */
const NUMERO_DE_CAPITULO = '(?:\\d+(?:\\.\\d+)*|[IVXLCDM]{1,7}|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|primer[ao]?|segund[ao]|tercer[ao]?|cuart[ao]|quint[ao]|one|two|three|four|five|six|seven|eight|nine|ten)';
const ENCABEZADO_NUMERADO = new RegExp(
  `^[ \\t]*(capítulo|capitulo|chapter|parte|part|sección|seccion|section|módulo|modulo|module)[ \\t]+(${NUMERO_DE_CAPITULO})\\b[ \\t]*[:.\\-–]?[ \\t]*([^\\n]*)$`,
  'gim'
);

/** Divide el texto en capítulos. Sin encabezados reconocibles, devuelve uno solo. */
export function extraerCapitulos(texto: string): Capitulo[] {
  if (!texto) return [];

  const textClean = limpiarEncabezadosFalsos(limpiarParaTTS(texto.replace(/\r\n/g, '\n')));
  const marcas: { index: number; length: number; titulo: string }[] = [];
  let match: RegExpExecArray | null;

  // 1. Marcadores "# Título" de la extracción local; la línea entera, y solo si es un título
  const regexObjetivo = /^[ \t]*#[ \t]+([^\n]{3,})$/gm;
  while ((match = regexObjetivo.exec(textClean)) !== null) {
    const titulo = match[1].replace(/[=\-_*~#|📖🎧]+/g, '').trim();
    if (!esTituloDeSeccion(titulo)) continue;
    marcas.push({ index: match.index, length: match[0].length, titulo });
  }

  // 2. Sin marcadores (OCR, EPUB de entrada): encabezados numerados como "Capítulo 3: …"
  if (marcas.length === 0) {
    ENCABEZADO_NUMERADO.lastIndex = 0;
    while ((match = ENCABEZADO_NUMERADO.exec(textClean)) !== null) {
      const etiqueta = match[1];
      const resto = match[3].replace(/[=\-_*~#|📖🎧]+/g, '').replace(/\s+/g, ' ').trim();
      const titulo = `${etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1)} ${match[2]}${resto ? ': ' + resto : ''}`;
      if (!esTituloDeSeccion(titulo)) continue;
      marcas.push({ index: match.index, length: match[0].length, titulo });
    }
  }

  // 3. Último recurso: títulos cortos en MAYÚSCULAS solos en su línea, con al
  //    menos una palabra de cuatro letras (descarta siglas sueltas como "DSM-5-TR")
  if (marcas.length === 0) {
    const regexMayusculas = /^[ \t]*([A-ZÁÉÍÓÚÑ\d][A-ZÁÉÍÓÚÑ\d \t:,\-]{4,59})[ \t]*$/gm;
    while ((match = regexMayusculas.exec(textClean)) !== null) {
      const titulo = match[1].trim();
      if (!/[A-ZÁÉÍÓÚÑ]{4,}/.test(titulo) || !esTituloDeSeccion(titulo)) continue;
      marcas.push({ index: match.index, length: match[0].length, titulo });
    }
  }

  if (marcas.length === 0) {
    return [{ titulo: 'Documento Completo', contenido: textClean.trim() }];
  }

  marcas.sort((a, b) => a.index - b.index);
  const capitulos: Capitulo[] = [];

  const inicio = textClean.substring(0, marcas[0].index).trim();
  if (inicio.length > 50) {
    capitulos.push({ titulo: 'Inicio / Introducción', contenido: inicio });
  }
  marcas.forEach((marca, i) => {
    const desde = marca.index + marca.length;
    const hasta = i + 1 < marcas.length ? marcas[i + 1].index : textClean.length;
    const contenido = textClean.substring(desde, hasta).trim();
    if (contenido.length > 0) {
      capitulos.push({ titulo: marca.titulo, contenido: `${marca.titulo}.\n\n${contenido}` });
    }
  });
  return capitulos;
}

/**
 * Texto para descargar como TXT. Los marcadores "# Título" sirven para repartir
 * capítulos en el EPUB, pero en un TXT el lector de voz puede leer el "#"; se
 * convierten en una línea de título terminada en punto, que hace la pausa.
 */
export function textoParaTxt(texto: string): string {
  return (texto || '')
    .replace(/^[ \t]*#[ \t]+([^\n]+)$/gm, (_l, titulo) => {
      const t = titulo.trim();
      return /[.!?:]$/.test(t) ? t : `${t}.`;
    })
    // Las líneas con solo espacios que rodeaban el marcador
    .replace(/\n[ \t]+(?=\n)/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Reparte un texto en "páginas" de unas `palabrasPorPagina` palabras sin
 * cortar párrafos. Un EPUB no tiene páginas: cada fichero del spine puede ser
 * un capítulo entero, y contarlos como páginas decidía mal entre TXT y EPUB
 * y daba bloques demasiado grandes a la IA.
 */
export function paginarTexto(texto: string, palabrasPorPagina = 350): string[] {
  const parrafos = (texto || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const paginas: string[] = [];
  let actual: string[] = [];
  let palabras = 0;
  for (const parrafo of parrafos) {
    const n = parrafo.split(/\s+/).length;
    if (palabras > 0 && palabras + n > palabrasPorPagina) {
      paginas.push(actual.join('\n\n'));
      actual = [];
      palabras = 0;
    }
    actual.push(parrafo);
    palabras += n;
  }
  if (actual.length) paginas.push(actual.join('\n\n'));
  return paginas;
}
