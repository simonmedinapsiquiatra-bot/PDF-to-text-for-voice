// Limpieza estructural del texto extraído. Fuente única de verdad: la usan
// src/main.ts (aplicación) y tests/ (pruebas).
import { L, Lmin, Lmay } from './charClasses.ts';

export function limpiarTextoLocal(texto) {
  if (!texto) return "";
  let res = texto;

  // A0.5 NLP HEURISTIC: Unir letras separadas por espacios (Ej: "P A L A B R A" -> "PALABRA")
  // Busca secuencias de 3 o más letras individuales separadas por espacios.
  res = res.replace(new RegExp(`(^|[^${L}])((?:${L}[ \\t]+){2,}${L})(?=[^${L}]|$)`, 'gm'), (match, prefix, spacedStr) => {
    return prefix + spacedStr.replace(/[ \\t]+/g, '');
  });

  // A0. Ligaduras Tipográficas comunes
  res = res.replace(/ﬁ/g, 'fi');
  res = res.replace(/ﬂ/g, 'fl');
  res = res.replace(/ﬀ/g, 'ff');
  res = res.replace(/ﬃ/g, 'ffi');
  res = res.replace(/ﬄ/g, 'ffl');

  // A1. Guiones de separación silábica seguidos de salto de línea dentro de la página
  res = res.replace(new RegExp(`(${L})\\s*-\\s*\\n\\s*(${L})`, 'gm'), '$1$2');
  // A2. Guiones inline con espacio (incluyendo espacio ANTES del guión)
  res = res.replace(new RegExp(`(${L})\\s*-\\s+(${Lmin})`, 'gm'), '$1$2');

  // B1. Eliminar líneas de índice con guías de puntos
  res = res.replace(/^.*(?:\.{3,}|\.{2,}\s+\.{2,}|(?:\.\s*){4,})\s*\d+\s*$/gm, "");

  // B2. Eliminar citas parentéticas estilo APA
  res = res.replace(/\((?:[A-ZÁÉÍÓÚÑüÜa-záéíóúñüÜ\s&.,;\-]|et\s+al\.)+,\s*\d{4}[a-z]?\)/g, "");
  res = res.replace(/\((?:[A-ZÁÉÍÓÚÑa-záéíóúñ\s.,&\-]+\d{4}[a-z]?[;,]?\s*)+\)/g, "");

  // B3. Eliminar citas numéricas entre corchetes y paréntesis (Ej: [1], [1-3], (1,2), (1-4))
  res = res.replace(/\[\d+(?:\s*[–,\-]\s*\d+)*\]/g, "");
  res = res.replace(/\(\d+(?:\s*[–,\-]\s*\d+)*\)/g, "");
  
  // B3b. Eliminar cabeceras específicas de UpToDate y basura
  res = res.replace(/UpToDate\s*-\s*[A-Za-z0-9\s_-]+/gi, "");
  res = res.replace(/Official reprint from UpToDate/gi, "");
  res = res.replace(/www\.uptodate\.com/gi, "");
  
  // B3c. Eliminar marcas de agua y números de página sueltos
  res = res.replace(/booksmedicos\.org/gi, "");
  res = res.replace(/^\s*[\d\s\-\|\/]+\s*$/gm, "");

  // B4. Eliminar números de superíndice de notas al pie pegados a palabras (sin espacios) o separados por comas
  res = res.replace(new RegExp(`(${L}|[.!?:;»",])(\\d{1,2}(?:\\s*,\\s*\\d{1,2})*)(?=\\s|$|${Lmay})`, 'g'), (match, before, num) => {
    // Si es un solo número entre 1 y 99, ignorar (podría ser válido)
    if (/^\d{1,2}$/.test(num)) {
      const n = parseInt(num);
      if (n >= 1 && n <= 99) return before;
    }
    // Si son varios números con comas, es un bloque de citas (ej. 2,9,10), eliminarlo
    if (num.includes(',')) return before;
    return match;
  });
  
  // B4b. Eliminar bloques de referencias bibliográficas flotantes (ej: " 2,9,10 ")
  res = res.replace(/\s+(\d{1,2}(?:,\s*\d{1,2})+)(?=\s)/g, " ");

  // B5. Eliminar URLs completas y correos electrónicos
  res = res.replace(/https?:\/\/\S+/gi, "");
  res = res.replace(/www\.\S+/gi, "");
  res = res.replace(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g, "");

  // B6. Eliminar llamados a figuras, tablas, gráficos (ahora soporta espacios entre números "13 1")
  res = res.replace(/\(\s*(?:Ver|Véase|véase|ver)?\s*(?:Figura|Tabla|Gráfico|Ilustración|Mapa)\s+[\d\s]+\s*\)/gi, "");
  res = res.replace(/,\s*(?:ver|véase)\s+(?:Figura|Tabla|Gráfico)\s+[\d\s]+/gi, "");

  // B7. Eliminar caracteres de formato basura
  res = res.replace(/[-*=_]{3,}/g, "");
  
  // B7b. Eliminar espacios antes de signos de puntuación
  res = res.replace(/\s+([.,;:!?])/g, "$1");

  // B8. Normalizar viñetas complejas
  res = res.replace(/[►♦➔■●○▪▫] /g, "• ");

  // B9. Omitir números de página aislados
  res = res.replace(/^\s*\d+\s*$/gm, "");

  // C1. Asegurar salto de párrafo ANTES de títulos de sección/capítulo
  res = res.replace(/([.!?])\s+(\d+\.\s+[A-ZÁÉÍÓÚÑÜ]{2,})/gm, "$1\n\n$2");
  
  // C2. Separar subtítulos que aparecen fundidos con el párrafo anterior
  res = res.replace(/([.!?])\s+((?:(?:Los|Las|El|La|Un|Una|De|Del)\s+)?[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+(?:\s+(?:para|de|del|y|e|en|a|los|las|el|la|con|sin|por|como|sobre|entre|desde|hasta|un|una)\s+[A-ZÁÉÍÓÚÑÜa-záéíóúñü]+)*)\s+([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü])/gm, (match, punct, heading, nextChar) => {
    const wordCount = heading.trim().split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 12 && !/^(Sin embargo|No obstante|Por ejemplo|Es decir|En cambio|Por ello|De modo|Al parecer|Del mismo|De forma|En cuanto|De ahí|En este|Por eso|Como veremos|Todos los|Aunque|Así pues|Pero la)/i.test(heading)) {
      return `${punct}\n\n${heading}\n\n${nextChar}`;
    }
    return match;
  });

  // D1. Normalizar múltiples espacios y tabuladores redundantes
  res = res.replace(/[ \t]+/g, " ");
  
  // D2. Limpiar espacios al inicio y final de cada línea
  res = res.replace(/^ +| +$/gm, "");

  // D3. Normalizar saltos de línea
  res = res.replace(/\n{3,}/g, "\n\n");

  // D4. Eliminar saltos de línea sueltos dentro de párrafos, preservando encabezados multinivel
  const headingLineRegex = /^\s*(?:(?:(?:\d{1,2}(?:\.\d{1,2}){0,4}|[IVXLCDM]{1,8}|[A-Z])(?:[.)]))\s+[^\n]{2,140}|(?:CAPÍTULO|CAPITULO|SECCIÓN|SECCION|PARTE|ANEXO|APÉNDICE|APENDICE|CHAPTER|SECTION|APPENDIX)\b[^\n]{0,140}|[A-ZÁÉÍÓÚÑÜ0-9][A-ZÁÉÍÓÚÑÜ0-9\s\-,:]{4,})\s*$/i;
  const mergedLines = [];
  const rawLines = res.split('\n');
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (mergedLines.length === 0) {
      mergedLines.push(line);
      continue;
    }
    const prev = mergedLines[mergedLines.length - 1];
    const prevTrim = prev.trim();
    const currTrim = line.trim();

    if (!prevTrim || !currTrim) {
      mergedLines.push(line);
      continue;
    }

    const prevIsHeading = headingLineRegex.test(prevTrim) && !/[.!?;]\s*$/.test(prevTrim);
    if (prevIsHeading) {
      if (mergedLines[mergedLines.length - 1] !== prevTrim) {
        mergedLines[mergedLines.length - 1] = prevTrim;
      }
      mergedLines.push("");
      mergedLines.push(currTrim);
      continue;
    }

    if (/[.!?:»"]\s*$/.test(prevTrim) && /^[A-ZÁÉÍÓÚÑÜ]/.test(currTrim)) {
      if (mergedLines[mergedLines.length - 1] !== prevTrim) {
        mergedLines[mergedLines.length - 1] = prevTrim;
      }
      mergedLines.push("");
      mergedLines.push(currTrim);
      continue;
    }

    mergedLines[mergedLines.length - 1] = `${prevTrim} ${currTrim}`;
  }
  res = mergedLines.join('\n');
  res = res.replace(/\n{3,}/g, "\n\n");

  return res;
}
export function limpiarUnionesEntrePaginas(textoCompleto) {
  if (!textoCompleto) return "";
  let res = textoCompleto;

  // --- NLP HEURISTIC: COLAPSO DE TEXTO VERTICAL (Marcas de agua en márgenes) ---
  // Si hay 4 o más saltos de línea donde cada línea es un solo caracter, los juntamos.
  res = res.replace(/(?:^[a-zA-ZáéíóúñÁÉÍÓÚÑ]\s*\n){4,}/gm, (match) => {
    return match.replace(/\n/g, '').trim() + ' ';
  });

  // 1. UNIR PALABRAS CORTADAS POR GUIONES ENTRE PÁGINAS Y DENTRO DE LA PÁGINA (De-hyphenation)
  // Detecta un guión (normal o soft-hyphen \u00AD) seguido opcionalmente de espacios/saltos, y lo une.
  res = res.replace(new RegExp(`(${L})[-_\\u00AD]\\s*\\n+\\s*(${Lmin})`, 'gm'), '$1$2');

  // 2. ELIMINAR NÚMEROS DE NOTA AL PIE PEGADOS A PALABRAS ENTRE PÁGINAS
  res = res.replace(new RegExp(`(${L})(\\d{1,3})\\s*\\n\\n\\s*(${Lmin})`, 'gm'), (match, letterBefore, num, letterAfter) => {
    return letterBefore + letterAfter;
  });

  // --- NLP HEURISTIC: RECONSTRUCCIÓN DE PÁRRAFOS (Puntuación) ---
  // 3 y 4. UNIR PÁRRAFOS ROTOS POR SALTO DE PÁGINA O ERRORES OCR
  const lineas = res.split('\n\n');
  const resultado = [];
  let buffer = "";
  
  for (let i = 0; i < lineas.length; i++) {
    const lineaActual = lineas[i].trim();
    if (!lineaActual) continue;
    
    if (buffer) {
      buffer += " " + lineaActual;
    } else {
      buffer = lineaActual;
    }
    
    if (i === lineas.length - 1) {
      resultado.push(buffer);
      break;
    }
    
    const lineaSiguiente = lineas[i + 1].trim();
    if (!lineaSiguiente) continue;
    
    const noTerminaEnPuntuacionFuerte = !/[.!?»"”')\]]\s*$/.test(buffer);
    const terminaEnComaOGuion = /[,;\-]\s*$/.test(buffer);
    const siguienteEsContinuacion = new RegExp(`^${Lmin}`).test(lineaSiguiente);
    const terminaEnConector = /\b(de|del|la|las|el|los|un|una|y|e|o|u|a|en|con|sin|por|para|que|al|se|su|no|ni|lo|the|of|and|in|to|is|are|with|for|on|as|at|by|an|or|from|this|that|which|was|were|be|been|has|have|had|but|if|then|than|their|our|my|your|his|her|its)\s*$/i.test(buffer);
    
    // Determinar si el buffer es una oración normal (y no un título o línea suelta de TOC)
    const palabras = buffer.split(/\s+/).filter(p => p.length > 0);
    let minusculas = 0;
    for (const p of palabras) {
      if (/^[a-zñáéíóúü]/.test(p)) minusculas++;
    }
    const proporcionMinusculas = palabras.length > 0 ? (minusculas / palabras.length) : 0;
    // Se reduce el umbral a >= 0.3 para permitir frases como "Durante la Edad" (1 minúscula de 3 palabras)
    const esOracionNormal = palabras.length >= 3 && proporcionMinusculas >= 0.3;
    
    let debeUnir = false;
    if (terminaEnConector || terminaEnComaOGuion) {
      debeUnir = true;
    } else if (noTerminaEnPuntuacionFuerte && siguienteEsContinuacion) {
      debeUnir = true;
    } else if (noTerminaEnPuntuacionFuerte && esOracionNormal) {
      debeUnir = true;
    } else if (noTerminaEnPuntuacionFuerte && palabras.length >= 2 && !/^(?:CAPÍTULO|CAPITULO|SECCIÓN|PARTE|ANEXO)/i.test(lineaSiguiente)) {
       // Si el buffer tiene al menos 2 palabras y no termina en puntuación, y la línea siguiente no es un título claro, forzar la unión (ayuda a "Durante la Edad \n Media")
       debeUnir = true;
    }
    
    if (!debeUnir) {
      resultado.push(buffer);
      buffer = "";
    }
  }
  
  res = resultado.join('\n\n');
  
  res = resultado.join('\n\n');

  // 5. NORMALIZACIÓN FINAL Y LIMPIEZA DE SALTOS INNECESARIOS DENTRO DE PÁRRAFOS
  // Si un salto de línea simple (\n) no tiene puntuación al final de la línea anterior, lo convertimos en espacio.
  res = res.replace(/([^.\n!?:\-»"])\n(?!\n)([A-Za-záéíóúñü])/g, '$1 $2');

  res = res.replace(/  +/g, ' ');
  res = res.replace(/\n{3,}/g, '\n\n');
  res = res.replace(/^\s+$/gm, '');

  return res;
}