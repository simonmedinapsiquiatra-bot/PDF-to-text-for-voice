// Reconstrucción del orden de lectura a partir de los fragmentos posicionados
// que devuelve PDF.js. La comparten la app y los scripts de evaluación.

export function reconstructColumnText(colFragments, marginX) {
  if (colFragments.length === 0) return "";
  
  const lineMap = new Map();
  const yTolerance = 2;
  
  for (const frag of colFragments) {
    const x = frag.x;
    const y = frag.y;
    const height = frag.height;
    
    let matchedKey = null;
    for (const [key, line] of lineMap) {
      if (Math.abs(line.y - y) < yTolerance) {
        matchedKey = key;
        break;
      }
    }
    
    if (matchedKey !== null) {
      const line = lineMap.get(matchedKey);
      line.fragments.push({ x, str: frag.str });
      line.xMin = Math.min(line.xMin, x);
      line.height = Math.max(line.height, height);
    } else {
      lineMap.set(y, { y, xMin: x, height, fragments: [{ x, str: frag.str }] });
    }
  }
  
  const lines = Array.from(lineMap.values());
  lines.sort((a, b) => b.y - a.y);
  
  for (const line of lines) {
    line.fragments.sort((a, b) => a.x - b.x);
    let lineText = "";
    let lastFragX = null;
    let lastFragEnd = 0;
    for (const frag of line.fragments) {
      if (lastFragX !== null) {
        const gap = frag.x - lastFragEnd;
        if (gap > line.height * 0.15 && !lineText.endsWith(" ") && !frag.str.startsWith(" ")) {
          lineText += " ";
        }
      }
      lineText += frag.str;
      lastFragX = frag.x;
      lastFragEnd = frag.x + (frag.str.length * line.height * 0.45);
    }
    line.text = lineText;
  }
  
  const nonEmptyLines = lines.filter(l => l.text.trim().length > 0);
  
  if (nonEmptyLines.length === 0) return "";
  if (nonEmptyLines.length === 1) return nonEmptyLines[0].text.trim();
  
  const gaps = [];
  for (let i = 1; i < nonEmptyLines.length; i++) {
    const gap = Math.abs(nonEmptyLines[i - 1].y - nonEmptyLines[i].y);
    if (gap > 0.5) gaps.push(gap);
  }
  
  let medianGap = nonEmptyLines[0].height * 1.2;
  if (gaps.length >= 3) {
    const sorted = [...gaps].sort((a, b) => a - b);
    medianGap = sorted[Math.floor(sorted.length / 2)];
  } else if (gaps.length > 0) {
    medianGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  }
  
  let textoCompleto = "";
  const avgHeight = nonEmptyLines.reduce((s, l) => s + l.height, 0) / nonEmptyLines.length;
  const headingKeywordRegex = /^(?:CAPÍTULO|CAPITULO|SECCIÓN|SECCION|PARTE|INTRODUCCIÓN|INTRODUCCION|PRÓLOGO|PROLOGO|EPÍLOGO|EPILOGO|CONCLUSIÓN|CONCLUSIONES|BIBLIOGRAFÍA|BIBLIOGRAFIA|APÉNDICE|APENDICE|ANEXO|CHAPTER|SECTION|APPENDIX)\b/i;
  const allCapsHeadingRegex = /^(?:\d+\.\s+)?[A-ZÁÉÍÓÚÑÜ0-9]{3,}(?:\s+[A-ZÁÉÍÓÚÑÜ0-9]{2,})*[\s:]*$/;
  const numberedHeadingRegex = /^(\d{1,2}(?:\.\d{1,2}){0,4})(?:[.)])?\s+.+$/;
  const romanHeadingRegex = /^([IVXLCDM]{1,8})(?:[.)])\s+.+$/i;
  const letterHeadingRegex = /^([A-Z])(?:[.)])\s+.+$/;

  const detectHeadingLevel = (lineText: string, lineHeight: number): number => {
    const text = lineText.trim().replace(/\s+/g, ' ');
    if (!text || text.length < 2 || text.length > 200) return 0;
    if (/[.!?;]\s*$/.test(text) || /^[-•*]\s+/.test(text)) return 0;
    const wordCount = text.split(' ').filter(Boolean).length;
    if (wordCount > 18) return 0;

    const isLargerFont = lineHeight > avgHeight * 1.35;
    const isKeywordHeading = headingKeywordRegex.test(text);
    const isAllCapsHeading = allCapsHeadingRegex.test(text);

    const numericMatch = text.match(numberedHeadingRegex);
    if (numericMatch) {
      const depth = (numericMatch[1].match(/\./g) || []).length + 1;
      return Math.min(6, Math.max(2, depth + 1));
    }
    if (romanHeadingRegex.test(text)) return 2;
    if (letterHeadingRegex.test(text)) return 3;
    if (isKeywordHeading) return 1;
    if (isAllCapsHeading) return 2;
    if (isLargerFont) return 2;
    return 0;
  };
  
  for (let i = 0; i < nonEmptyLines.length; i++) {
    const currLine = nonEmptyLines[i];
    const currText = currLine.text.trim();
    
    const isSmallerFont = currLine.height < avgHeight * 0.75;
    const headingLevel = detectHeadingLevel(currText, currLine.height);
    const isTitle = headingLevel > 0;
    
    if (i === 0) {
      if (isTitle) {
         const headingPrefix = '#'.repeat(Math.min(6, Math.max(1, headingLevel)));
         textoCompleto += `\n\n    \n\n${headingPrefix} ${currText}\n\n    \n\n`;
      } else {
         textoCompleto += currText;
      }
      continue;
    }
    
    const prevLine = nonEmptyLines[i - 1];
    const gap = Math.abs(prevLine.y - currLine.y);
    const prevText = prevLine.text.trim();
    const prevHeadingLevel = detectHeadingLevel(prevText, prevLine.height);
    const isIndented = Math.round(currLine.xMin) > marginX + avgHeight * 0.6;
    const prevEndsSentence = /[.!?:»]\s*$/.test(prevText);
    
    let esPárrafoNuevo = false;
    
    if (isSmallerFont && prevLine.height >= avgHeight * 0.9) {
      esPárrafoNuevo = true;
    } else if (prevHeadingLevel > 0) {
      esPárrafoNuevo = true;
    } else if (gap > medianGap * 1.3) {
      esPárrafoNuevo = true;
    } else if (isIndented && prevEndsSentence) {
      esPárrafoNuevo = true;
    } else if (gap > medianGap * 1.1 && prevEndsSentence) {
      esPárrafoNuevo = true;
    }
    
    if (isTitle) {
      // Inyectamos un espaciador silente visual y markdown para los títulos
      const headingPrefix = '#'.repeat(Math.min(6, Math.max(1, headingLevel)));
      textoCompleto += `\n\n    \n\n${headingPrefix} ${currText}\n\n    \n\n`;
    } else if (esPárrafoNuevo) {
      textoCompleto += "\n\n" + currText;
    } else {
      if (!textoCompleto.endsWith(" ") && !textoCompleto.endsWith("\n") && !currText.startsWith(" ")) {
        textoCompleto += " ";
      }
      textoCompleto += currText;
    }
  }
  
  return textoCompleto;
}

export async function extraerTextoDePagina(page, ocrFallback = null) {
  const textContent = await page.getTextContent();
  const items = textContent.items;
  
  if (items.length === 0) {
    // Página sin texto digital: la transcribe quien nos pase un OCR
    // (la app inyecta Tesseract; los scripts de evaluación no usan ninguno).
    if (!ocrFallback) return "";
    try {
      return await ocrFallback(page);
    } catch (e) {
      console.error("Local OCR failed:", e);
      return "";
    }
  }
  
  // 1. Recopilar fragmentos de texto con estimación de límites horizontales
  const fragments = [];
  let minX = Infinity;
  let maxX = -Infinity;
  
  for (let k = 0; k < items.length; k++) {
    const item = items[k];
    const str = item.str;
    if (!str && str !== " ") continue;
    
    const x = item.transform[4];
    const y = item.transform[5];
    const height = Math.abs(item.transform[0] || item.transform[3] || 10);
    const width = item.width || (str.length * height * 0.45);
    
    fragments.push({ x, y, width, height, str });
    
    if (x < minX) minX = x;
    if (x + width > maxX) maxX = x + width;
  }
  
  if (fragments.length === 0) return "";
  
  // 2. Heurística para detección de doble columna
  const pageWidth = maxX - minX;
  const midX = minX + pageWidth / 2;
  const gutterWidth = pageWidth * 0.08; // 8% del ancho como canal central (gutter)
  const gutterLeft = midX - gutterWidth / 2;
  const gutterRight = midX + gutterWidth / 2;
  
  let crossingCount = 0;
  
  // Agrupar alturas de y en cubos aproximados para contar líneas estimadas
  const yCoords = fragments.map(f => Math.round(f.y / 5) * 5);
  const uniqueY = [...new Set(yCoords)];
  const totalLinesEstimate = uniqueY.length;
  
  // Contar fragmentos que atraviesan físicamente el canal central
  for (const f of fragments) {
    const fEnd = f.x + f.width;
    if (f.x < gutterLeft && fEnd > gutterRight) {
      crossingCount++;
    }
  }
  
  // Si menos del 15% de las líneas cruzan el canal, y hay suficiente texto, es diseño de dos columnas
  const isTwoColumn = totalLinesEstimate > 5 && (crossingCount / totalLinesEstimate) < 0.15;
  
  let textoCompleto = "";
  
  if (isTwoColumn) {
    // Dividir fragmentos en Columna Izquierda y Columna Derecha
    const leftFragments = [];
    const rightFragments = [];
    
    for (const f of fragments) {
      const fCenter = f.x + f.width / 2;
      if (fCenter < midX) {
        leftFragments.push(f);
      } else {
        rightFragments.push(f);
      }
    }
    
    // Reconstruir cada columna de forma independiente
    const leftText = reconstructColumnText(leftFragments, minX);
    const rightText = reconstructColumnText(rightFragments, midX);
    
    textoCompleto = leftText + "\n\n" + rightText;
  } else {
    // Reconstrucción de columna única estándar
    textoCompleto = reconstructColumnText(fragments, minX);
  }
  
  return textoCompleto;
}
