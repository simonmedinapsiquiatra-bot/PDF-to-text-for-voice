import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const L = '[a-zA-ZáéíóúñüÁÉÍÓÚÑÜàèìòùâêîôûäëïöüçÇ]';

        function esNombreDeRevistaOSeccion(linea) {
      if (!linea) return true;
      const l = linea.toLowerCase().trim();
      
      if (/^(revista|journal|acta|archives|annals|bulletin|cuadernos|anales|boletín|boletin)\b/i.test(l)) return true;
      if (/^(the lancet|bmj|n engl j med|new england journal|american journal|british journal|world psychiatry|uptodate|sonepsyn|sleepj|psychiatria danubina|neuropsychopharmacology|nature reviews?|springer|elsevier|wiley|cns spectrums|nutr hosp|plos one|clinical science|medical hypotheses|european psychiatry|european journal|international journal|teaching of psychology|gac sanit)\b/i.test(l)) return true;
      if (/^\[?\s*(?:rev\.?\s*med|rev\s*chil|med\s*segur|margen\s*n°?)\b/i.test(l)) return true;
      if (/\b(psiquiatría|psychiatry|neurología|neurology|neuropsiquiatría|neuropsychiatry|medicina|medicine|salud mental|mental health|psychological medicine|yoga therapy|trauma & dissociation)\b/i.test(l) &&
          /\b(revista|journal|acta|archives|vol|volumen|nº|n°|no\.|issn|doi|reviews?|guidelines?|contents lists|sciencedirect)\b/i.test(l)) return true;

      if (/^(artículo original|articulo original|original article|caso clínico|caso clinico|case report|report of a case|artículo de revisión|articulo de revision|review article|review|r e v i e w|a r t i c l e|article|articles|editorial|cartas al editor|letter to the editor|trabajo original|sección especial|seccion especial|comunicación breve|comunicacion breve|special report|special article|brief report|informe especial|comentario|opinion|personal view|guidelines?|conference paper|meeting|primer|seminar|punto de vista|faculty forum|research article|state of the art review|reviews and overviews)\b/i.test(l)) return true;

      if (/^(vol\.|volumen|volume|issue|número|numero|nº|n°|issn|doi:|https?:\/\/|received:|accepted:|revised:|advance access|email alerts|subscriptions|terms of use|commercial reprints)/i.test(l)) return true;
      if (/^vol\s*\d+/i.test(l)) return true;
      if (/^\d{4}\s*;\s*\d+/i.test(l)) return true;
      if (/^págs?\.\s*\d+/i.test(l)) return true;
      if (/\b(?:doi:\s*10\.\d+|https?:\/\/doi\.org)/i.test(l) && l.length < 150) return true;
      if (/\b(?:received|accepted|revised)\s*:\s*\d+/i.test(l)) return true;
      if (/\bcontents lists available at sciencedirect\b/i.test(l)) return true;

      if (/^(nih public access|nih-pa|author manuscript|pmc\d+|national institutes of health|public health matters|citation|hhs public access|published in final edited form as)/i.test(l)) return true;
      if (/\b(available in pmc|author manuscript)\b/i.test(l) && l.length < 120) return true;
      if (/^(abstract|resumen|summary)\s*[:.]/i.test(l)) return true;
      if (/^(official reprint|topic \d+|all topics are updated|literature review current|this topic last updated|ellos fácilmente)/i.test(l)) return true;

      if (/^[\d\s,*†‡§–\-()]+$/.test(l)) return true;

      return false;
    }

    function extraerTituloDePortada(textoPortada) {
      if (!textoPortada) return "TÍTULO NO DETECTADO";
      
      const lineasRaw = textoPortada.split(/\r?\n/);
      const lineasValidas = [];
      
      for (let i = 0; i < lineasRaw.length; i++) {
        let rawLine = lineasRaw[i]
          .replace(/^#+\s*/, '')
          .replace(/^\d{1,2}[-\/.](?:\d{1,2}|[A-Za-z]{3})[-\/.]\d{2,4}\s+/, '')
          .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
          .trim();
        if (!rawLine) continue;

        const titleMatch = rawLine.match(/\bTITLE:\s*(.+)$/i);
        if (titleMatch && titleMatch[1].length > 5) {
          rawLine = titleMatch[1].trim();
        }

        const tokens = rawLine.split(/[ \t]{2,}/);
        const wordsDesespaciadas = tokens.map(tok => {
          const trimmed = tok.trim();
          if (/^[A-Za-záéíóúñüÁÉÍÓÚÑÜ](?:[ \t][A-Za-záéíóúñüÁÉÍÓÚÑÜ])+$/.test(trimmed)) {
            return trimmed.replace(/[ \t]+/g, '');
          }
          return trimmed;
        });
        let l = wordsDesespaciadas.join(' ').replace(/[ \t]+/g, " ").trim();
        if (!l) continue;
        
        if (l.length <= 3) continue;
        if (l.split(/\s+/).length > 28) continue;
        if (/^(abstract|resumen|summary|background|objetivo|métodos|conclusiones|palabras clave|key\s*words?)\s*[:.]/i.test(l)) continue;

        if (/©|isbn|barcelona|editorial|derechos|epub|edicion|herder|cedro|impreso|all rights reserved|coordinador|director/i.test(l)) continue;
        if (/www\.|sonepsyn|leeronline|http|descargado|online/i.test(l)) continue;
        if (/también puedes leer|tambien puedes leer|leer online|psicopatologia|psicoterapia|coleccion|titulos/i.test(l)) continue;
        
        if (/^(por|by|autores?|authors?|editado por|edited by|translators?|traducido por|corresponding author|correspondence to|address correspondence to)\b/i.test(l)) continue;
        if (/\b(departamento de|facultad de|universidad de|hospital|servicio de|m\.d\.|ph\.d\.|fellow|e-mail:)\b/i.test(l) && l.length < 140) continue;
        if (/^(check for updates|email alerts|commercial reprints|subscriptions|terms of use)/i.test(l)) continue;

        if (esNombreDeRevistaOSeccion(l)) continue;

        if (/\band\b|\by\b/i.test(l) && /\b[A-Z][a-z]+\s+[A-Z]\b/.test(l) && l.length < 90) continue;
        if (/^(?:\d+[, ]+)+[A-Z]/.test(l) && l.includes(',')) continue;

        const lettersAndDigits = l.replace(/[^a-zA-ZáéíóúñüÁÉÍÓÚÑÜ0-9]/g, "");
        if (lettersAndDigits.length < 3) continue;
        
        lineasValidas.push(l);
      }
      
      if (lineasValidas.length === 0) {
        return "TÍTULO NO DETECTADO";
      }
      
      if (lineasValidas.length === 1) {
        return lineasValidas[0].toUpperCase();
      }
      
      const l1 = lineasValidas[0];
      const l2 = lineasValidas[1];
      
      if (/^[a-z(]/.test(l2) || /^(un|una|el|la|los|las|de|del|guía|guia|manual|enfoque|perspectivas)/i.test(l2)) {
        return `${l1} - ${l2}`.toUpperCase();
      }
      
      if (l1.split(/\s+/).length >= 3) {
        return l1.toUpperCase();
      }
      
      return lineasValidas.slice(0, 2).join(" - ").toUpperCase();
    }



function reconstructColumnText(colFragments, marginX) {
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
  
  const avgHeight = nonEmptyLines.reduce((s, l) => s + l.height, 0) / nonEmptyLines.length;
  let textoCompleto = "";
  
  for (let i = 0; i < nonEmptyLines.length; i++) {
    const currLine = nonEmptyLines[i];
    const currText = currLine.text.trim();
    const isSmallerFont = currLine.height < avgHeight * 0.75;
    const isLargerFont = currLine.height > avgHeight * 1.35;
    const isKeywordHeading = /^\s*(?:CAPÍTULO|CAPITULO|INTRODUCCIÓN|INTRODUCCION|PARTE\s|PRÓLOGO|PROLOGO|EPÍLOGO|EPILOGO|CONCLUSIÓN|CONCLUSIONES|BIBLIOGRAFÍA|BIBLIOGRAFIA|APÉNDICE|ANEXO)/i.test(currText);
    const isAllCapsHeading = /^\s*(?:\d+\.\s+)?[A-ZÁÉÍÓÚÑÜ]{4,}(?:\s+[A-ZÁÉÍÓÚÑÜ]{2,})*[\s:]*$/.test(currText);
    const isTitle = (isLargerFont || isKeywordHeading || isAllCapsHeading) && currText.length > 2 && currText.length < 200;
    
    if (i === 0) {
      textoCompleto += isTitle ? "\n\n# " + currText + "\n\n" : currText;
      continue;
    }
    
    const prevLine = nonEmptyLines[i - 1];
    const prevEndsSentence = /[.!?:»]\s*$/.test(prevLine.text.trim());
    let esPárrafoNuevo = isSmallerFont && prevLine.height >= avgHeight * 0.9 || prevEndsSentence;
    
    if (isTitle) {
      textoCompleto += "\n\n# " + currText + "\n\n";
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

async function extraerTextoDePagina(page) {
  const textContent = await page.getTextContent();
  const items = textContent.items;
  if (!items || items.length === 0) return "";
  
  const fragments = [];
  let minX = Infinity;
  let maxX = -Infinity;
  
  for (const item of items) {
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
  
  const pageWidth = maxX - minX;
  const midX = minX + pageWidth / 2;
  const gutterWidth = pageWidth * 0.08;
  const gutterLeft = midX - gutterWidth / 2;
  const gutterRight = midX + gutterWidth / 2;
  
  const lineBounds = new Map();
  for (const f of fragments) {
    const yKey = Math.round(f.y / 4) * 4;
    const current = lineBounds.get(yKey);
    const fEnd = f.x + f.width;
    if (current) {
      current.minX = Math.min(current.minX, f.x);
      current.maxX = Math.max(current.maxX, fEnd);
    } else {
      lineBounds.set(yKey, { minX: f.x, maxX: fEnd });
    }
  }
  
  let crossingCount = 0;
  for (const [_, bounds] of lineBounds) {
    if (bounds.minX < gutterLeft && bounds.maxX > gutterRight) {
      crossingCount++;
    }
  }
  
  const totalLinesEstimate = lineBounds.size;
  const leftFragments = [];
  const rightFragments = [];
  for (const f of fragments) {
    const fCenter = f.x + f.width / 2;
    if (fCenter < midX) leftFragments.push(f);
    else rightFragments.push(f);
  }
  
  const isTwoColumn = totalLinesEstimate > 6 && (crossingCount / totalLinesEstimate) < 0.15 && leftFragments.length > 5 && rightFragments.length > 5;
  if (isTwoColumn) {
    const leftText = reconstructColumnText(leftFragments, minX);
    const rightText = reconstructColumnText(rightFragments, midX);
    return leftText + "\n\n" + rightText;
  } else {
    return reconstructColumnText(fragments, minX);
  }
}

function getAllPdfFiles(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllPdfFiles(filePath));
      } else {
        // Incluir si termina en .pdf o si el archivo binario empieza con %PDF
        if (file.toLowerCase().endsWith('.pdf')) {
          results.push(filePath);
        } else if (!file.includes('.') && stat.size > 1000) {
          try {
            const buf = Buffer.alloc(5);
            const fd = fs.openSync(filePath, 'r');
            fs.readSync(fd, buf, 0, 5, 0);
            fs.closeSync(fd);
            if (buf.toString() === '%PDF-') {
              results.push(filePath);
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
  return results;
}

async function main() {
  const rootDir = "D:\\drive\\psiquiatria\\libros\\Papers";
  const allPdfPaths = getAllPdfFiles(rootDir);
  
  console.log(`\n================================================================`);
  console.log(`EVALUACIÓN DE SELECCIÓN DE TÍTULOS EN PAPERS (RECURSIVO)`);
  console.log(`Directorio raíz: ${rootDir}`);
  console.log(`Total de archivos PDF encontrados: ${allPdfPaths.length}`);
  console.log(`================================================================\n`);
  
  const folderGroups = new Map();
  for (const fullPath of allPdfPaths) {
    const relPath = path.relative(rootDir, fullPath);
    const folder = path.dirname(relPath);
    if (!folderGroups.has(folder)) {
      folderGroups.set(folder, []);
    }
    folderGroups.get(folder).push(fullPath);
  }
  
  let totalDetected = 0;
  let totalFallback = 0;
  let totalProcessed = 0;
  
  for (const [folder, files] of folderGroups) {
    console.log(`\n📁 CARPETA: [${folder === '.' ? 'Papers (Raíz)' : folder}] (${files.length} archivos)`);
    console.log(`----------------------------------------------------------------`);
    
    let folderDetected = 0;
    
    for (const fullPath of files) {
      const fileName = path.basename(fullPath);
      totalProcessed++;
      try {
        const data = new Uint8Array(fs.readFileSync(fullPath));
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdf = await loadingTask.promise;
        const page1 = await pdf.getPage(1);
        const textPage1 = await extraerTextoDePagina(page1);
        
        const detectedTitle = extraerTituloDePortada(textPage1);
        const fallbackTitle = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").toUpperCase();
        
        const isDetected = detectedTitle !== "TÍTULO NO DETECTADO";
        if (isDetected) {
          totalDetected++;
          folderDetected++;
        } else {
          totalFallback++;
        }
        
        console.log(`  [${isDetected ? 'OK' : 'FALLBACK'}] ${fileName}`);
        console.log(`     ↳ ${isDetected ? detectedTitle : fallbackTitle}`);
      } catch (err) {
        console.log(`  [ERROR] ${fileName}: ${err.message}`);
      }
    }
    console.log(`  📊 Tasa de detección en esta carpeta: ${folderDetected}/${files.length} (${Math.round(folderDetected/files.length*100)}%)`);
  }
  
  console.log(`\n================================================================`);
  console.log(`RESUMEN GLOBAL FINAL`);
  console.log(`================================================================`);
  console.log(`Total de Papers Analizados: ${totalProcessed}`);
  console.log(`Títulos Detectados en Portada/Pág 1: ${totalDetected} (${Math.round(totalDetected/totalProcessed*100)}%)`);
  console.log(`Fallback a Nombre de Archivo: ${totalFallback} (${Math.round(totalFallback/totalProcessed*100)}%)`);
}

main().catch(console.error);
