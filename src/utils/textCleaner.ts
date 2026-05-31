declare const log: any;
declare const pdfjsLib: any;
declare const PDFLib: any;
declare let loadedFiles: any;
declare const CONCURRENCY: any;
declare const CHUNK_SIZE: any;
declare function getStoredApiKey(): string;
declare function getStoredModel(): string;
declare const google: any;
declare const Typo: any;

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
      res = res.replace(new RegExp(`(${L}|[.!?:;»"])(\\d{1,2}(?:\\s*,\\s*\\d{1,2})*)(?=\\s|$|${Lmay})`, 'g'), (match, before, num) => {
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

      // D4. Eliminar saltos de línea sueltos dentro de párrafos
      res = res.replace(/([^\n])\n(?!\n)([^\n])/g, (match, before, after) => {
        if (/[.!?:»5]\s*$/.test(before) && /^\s*[A-ZÁÉÍÓÚÑÜ]/.test(after)) {
          return before + "\n\n" + after;
        }
        return before + " " + after;
      });

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

    function esPaginaDeIndice(textoPagina) {
      if (!textoPagina) return false;
      const regexPuntosIndice = /(?:\.{3,}|\.{2,}\s+\.{2,}|(?:\.\s*){4,})\s*\d+/g;
      const coincidencias = textoPagina.match(regexPuntosIndice);
      const numCoincidencias = coincidencias ? coincidencias.length : 0;
      const tienePalabraIndice = /\b(?:ÍNDICE|Índice|INDICE|Tabla de Contenidos|Contenido|Contenidos|PRÓLOGO|Prólogo|PROLOGO)\b/i.test(textoPagina);
      return (tienePalabraIndice && numCoincidencias >= 2) || (numCoincidencias >= 3);
    }

    function esPaginaEditorial(textoPagina) {
      if (!textoPagina) return false;
      const clean = textoPagina.replace(/\s+/g, "").toLowerCase()
                               .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const tieneCopyright = /©\d{4}|\(c\)\d{4}/.test(clean);
      const tieneISBN = /isbn|97884|978-84/.test(clean);
      const tieneCEDRO = /cedro/i.test(clean);
      const tieneEdicionDigital = /ediciondigital|reproduccion,distribucion|comunicacionpublica|editorialherder/.test(clean);
      
      const esCopyright = (tieneCopyright && (tieneISBN || tieneCEDRO || tieneEdicionDigital)) || 
                           (tieneISBN && (tieneCEDRO || tieneEdicionDigital));

      const tieneColeccion = /titulosdelacoleccion|psicopatologiaypsicoterapia|psicosis\(3p\)|coleccionpsicopatologia/.test(clean);
      const tieneEdiciones = /herdereditorial|edicionespublicadas|otrostitulos|cubiertagabriel|disenodelacubierta/.test(clean);
      const esCatalogo = tieneColeccion || (tieneEdiciones && (tieneISBN || tieneCopyright));

      return esCopyright || esCatalogo;
    }

    async function extraerTextoDePagina(page) {
      const textContent = await page.getTextContent();
      const items = textContent.items;
      
      if (items.length === 0) return "";
      
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

    /**
     * Reconstruye el texto continuo de un conjunto de fragmentos de una sola columna.
     */
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
      
      let textoCompleto = nonEmptyLines[0].text.trim();
      const avgHeight = nonEmptyLines.reduce((s, l) => s + l.height, 0) / nonEmptyLines.length;
      
      for (let i = 1; i < nonEmptyLines.length; i++) {
        const prevLine = nonEmptyLines[i - 1];
        const currLine = nonEmptyLines[i];
        const gap = Math.abs(prevLine.y - currLine.y);
        const prevText = prevLine.text.trim();
        const currText = currLine.text.trim();
        
        const isSmallerFont = currLine.height < avgHeight * 0.75;
        const isIndented = Math.round(currLine.xMin) > marginX + avgHeight * 0.6;
        const prevEndsSentence = /[.!?:»5]\s*$/.test(prevText);
        
        const isHeading = /^\s*(?:\d+\.\s+[A-ZÁÉÍÓÚÑÜ]|[A-ZÁÉÍÓÚÑÜ]{2,}[\s:]|CAPÍTULO|CAPITULO|INTRODUCCIÓN|INTRODUCCION|PARTE\s|PRÓLOGO|PROLOGO|EPÍLOGO|EPILOGO|CONCLUSIÓN|CONCLUSIONES|BIBLIOGRAFÍA|BIBLIOGRAFIA|APÉNDICE|ANEXO)/i.test(currText)
                     && currText.length < 200;
        
        let esPárrafoNuevo = false;
        
        if (isSmallerFont && prevLine.height >= avgHeight * 0.9) {
          esPárrafoNuevo = true;
        } else if (isHeading) {
          esPárrafoNuevo = true;
        } else if (gap > medianGap * 1.3) {
          esPárrafoNuevo = true;
        } else if (isIndented && prevEndsSentence) {
          esPárrafoNuevo = true;
        } else if (gap > medianGap * 1.1 && prevEndsSentence) {
          esPárrafoNuevo = true;
        }
        
        if (esPárrafoNuevo) {
          textoCompleto += "\n\n" + currText;
        } else {
          if (!textoCompleto.endsWith(" ") && !currText.startsWith(" ")) {
            textoCompleto += " ";
          }
          textoCompleto += currText;
        }
      }
      
      return textoCompleto;
    }

    function extraerTituloDePortada(textoPortada) {
      if (!textoPortada) return "TÍTULO NO DETECTADO";
      
      // 1. Unir letras separadas por espacios (ej. "P A L A B R A" -> "PALABRA")
      let port = textoPortada.replace(/([A-Za-záéíóúñüÁÉÍÓÚÑüÜ])\s+(?=[A-Za-záéíóúñüÁÉÍÓÚÑüÜ]\s)/g, "$1");
      
      // 2. Dividir en líneas usando saltos de línea reales de la portada antes de colapsar espacios
      const lineasRaw = port.split(/\r?\n/);
      const lineasValidas = [];
      
      for (let i = 0; i < lineasRaw.length; i++) {
        // Eliminar caracteres de control y normalizar espacios horizontales
        let l = lineasRaw[i].replace(/[\x00-\x1F\x7F-\x9F]/g, "").replace(/[ \t]+/g, " ").trim();
        if (!l) continue;
        
        // Excluir líneas irrelevantes, créditos editoriales, URLs o avisos de lectura online
        if (l.length <= 4) continue;
        if (/©|isbn|barcelona|editorial|derechos|epub|edicion|herder|cedro|impreso|all rights reserved|coordinador|director/i.test(l)) continue;
        if (/www\.|sonepsyn|leeronline|http|descargado|online/i.test(l)) continue;
        if (/también puedes leer|tambien puedes leer|leer online|psicopatologia|psicoterapia|coleccion|titulos/i.test(l)) continue;
        
        // Debe contener al menos 3 caracteres alfanuméricos reales para ser un título
        const lettersAndDigits = l.replace(/[^a-zA-ZáéíóúñüÁÉÍÓÚÑÜ0-9]/g, "");
        if (lettersAndDigits.length < 3) continue;
        
        lineasValidas.push(l);
      }
      
      // El título y subtítulo suelen estar en las primeras 2 líneas válidas de la portada
      const lineasTitulo = lineasValidas.slice(0, 2);
      
      if (lineasTitulo.length === 0) {
        return "TÍTULO NO DETECTADO";
      }
      
      return lineasTitulo.join(" - ").toUpperCase();
    }


    // --- GESTIÓN DE ARCHIVOS Y MULTI-PROCESAMIENTO ---

    async function startProcessFiles(files) {
      if (!files || files.length === 0) return;
      
      // Cambiar vistas de la UI
      document.getElementById('uploadArea').classList.add('hidden');
      document.getElementById('controlBar').classList.remove('hidden');
      document.getElementById('fileListContainer').classList.remove('hidden');
      document.getElementById('terminalContainer').classList.remove('hidden');
      
      log(`Inicializando la carga de ${files.length} archivo(s)...`);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type !== 'application/pdf') {
          log(`[Error] El archivo "${file.name}" no es un documento PDF. Omitiendo.`, 'error');
          continue;
        }
        
        // Crear objeto del archivo
        const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const fileObj = {
          id: fileId,
          file: file,
          name: file.name,
          size: file.size,
          totalPages: 0,
          status: 'loading',
          localProgress: 0,
          localText: '',
          aiProgress: 0,
          aiText: '',
          isDigital: true,
          pagesData: [],
          titulo: 'TÍTULO NO DETECTADO',
          aiChunks: [],
          aiStatusText: 'Pendiente de inicio'
        };
        
        loadedFiles.push(fileObj);
        renderFileCard(fileObj);
        
        // Ejecutar extracción local en paralelo
        procesarArchivoLocal(fileObj);
      }
    }

    // Extracción de Texto Local
    async function procesarArchivoLocal(fileObj) {
      try {
        log(`[${fileObj.name}] Leyendo archivo en memoria...`);
        const arrayBuffer = await fileObj.file.arrayBuffer();
        
        log(`[${fileObj.name}] Extrayendo capa de texto local digital...`);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        fileObj.totalPages = pdf.numPages;
        renderFileCard(fileObj);
        
        let rawPagesData = [];
        let totalChars = 0;
        let indexPagesOmitted = 0;
        
        for (let i = 1; i <= fileObj.totalPages; i++) {
          const page = await pdf.getPage(i);
          const pageRawText = await extraerTextoDePagina(page);
          page.cleanup(); // <-- FREE MEMORY PER PAGE
          
          if (i === 1) {
            let detected = extraerTituloDePortada(pageRawText);
            if (detected === "TÍTULO NO DETECTADO") {
              const fallback = fileObj.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").toUpperCase();
              fileObj.titulo = fallback;
              log(`[${fileObj.name}] 📖 Título no legible en portada. Usando nombre de archivo como fallback: "${fallback}"`, 'success');
            } else {
              fileObj.titulo = detected;
              log(`[${fileObj.name}] 📖 Título Detectado: "${fileObj.titulo}"`, 'success');
            }
            renderFileCard(fileObj);
            continue;
          }

          // Filtrar páginas de índice/editorial
          if (esPaginaDeIndice(pageRawText)) {
            log(`[${fileObj.name}] Página ${i} es Índice/Contenido. Se omitirá del texto procesado.`, 'success');
            indexPagesOmitted++;
            continue;
          }

          if ((i <= 15 || i >= fileObj.totalPages - 15) && esPaginaEditorial(pageRawText)) {
            log(`[${fileObj.name}] Página ${i} es Editorial/Créditos. Se omitirá del texto procesado.`, 'success');
            indexPagesOmitted++;
            continue;
          }
          
          totalChars += pageRawText.length;
          
          // Guardar texto crudo para análisis previo de cabeceras
          rawPagesData.push({
            pageNum: i,
            text: pageRawText
          });
          
          // Actualizar progreso local
          fileObj.localProgress = Math.round((i / fileObj.totalPages) * 100);
          if (i % 10 === 0 || i === fileObj.totalPages) {
            renderFileCard(fileObj);
          }
        }
        
        pdf.destroy(); // <-- FREE PDF DOCUMENT MEMORY

        // --- NLP HEURISTIC: DEDUPLICACIÓN DINÁMICA DE CABECERAS Y PIES DE PÁGINA EN TEXTO CRUDO ---
        let headersFooters = [];
        log(`[${fileObj.name}] Ejecutando Deduplicación Dinámica NLP...`);
        if (rawPagesData.length > 3) {
          const lineasPorPagina = rawPagesData.map(p => p.text.split('\n'));
          const lineasSospechosas = new Map();
          
          for (let p = 0; p < lineasPorPagina.length; p++) {
            const lineas = lineasPorPagina[p];
            const topLines = lineas.slice(0, 4);
            const bottomLines = lineas.slice(-4);
            
            [...topLines, ...bottomLines].forEach(line => {
              const cleanLine = line.trim();
              const generalizedLine = cleanLine.replace(/\d+/g, '#').trim();
              
              if (generalizedLine.length > 3 && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(generalizedLine)) {
                lineasSospechosas.set(generalizedLine, (lineasSospechosas.get(generalizedLine) || 0) + 1);
              }
            });
          }
          
          const umbral = Math.max(3, Math.floor(rawPagesData.length * 0.03));
          headersFooters = Array.from(lineasSospechosas.entries())
            .filter(([_, count]) => count >= umbral)
            .map(([line, _]) => line);
          
          if (headersFooters.length > 0) {
            log(`[${fileObj.name}] 🤖 NLP detectó ${headersFooters.length} patrones repetitivos de cabecera/pie. Eliminando...`, 'success');
          }
        }

        // --- PROCESAMIENTO Y LIMPIEZA CON DEDUPLICACIÓN PRE-FUSIÓN ---
        let hasBodyStarted = false;
        const paginasCuerpo = [];
        const paginasPreliminares = [];

        for (let p = 0; p < rawPagesData.length; p++) {
          const pObj = rawPagesData[p];
          let pText = pObj.text;

          // Si hay patrones detectados, removerlos de los extremos del texto crudo
          if (headersFooters.length > 0) {
            const lineas = pText.split('\n');
            const safeBody = lineas.slice(5, -5);
            const topCandidates = lineas.slice(0, 5);
            const bottomCandidates = lineas.slice(-5);
            
            const filterCandidates = (candidates) => {
               return candidates.filter(line => {
                  const generalizedLine = line.trim().replace(/\d+/g, '#').trim();
                  return !headersFooters.includes(generalizedLine);
               });
            };
            
            pText = [...filterCandidates(topCandidates), ...safeBody, ...filterCandidates(bottomCandidates)].join('\n');
          }

          // Ejecutar limpiarTextoLocal sobre la página limpia de cabeceras
          const cleanedText = limpiarTextoLocal(pText);

          // Rastrear inicio del cuerpo
          if (!hasBodyStarted) {
            const regexInicio = /\b(?:INTRODUCCIÓN|INTRODUCCION|CAPÍTULO\s*(?:1|I)\b|CAPITULO\s*(?:1|I)\b|PRIMERA\s*PARTE|1\s*\.\s*(?:LOS|L\s*OS)\s+PRIMEROS|EMOCIONES\s+Y\s+CAVILACIONES)\b/i;
            if (regexInicio.test(pObj.text)) {
              hasBodyStarted = true;
              const match = pObj.text.match(regexInicio);
              log(`[${fileObj.name}] 🚀 Comienzo real detectado en Pág. ${pObj.pageNum}: "${match[0]}"`, 'success');
              paginasCuerpo.push(cleanedText);
            } else {
              paginasPreliminares.push(cleanedText);
            }
          } else {
            paginasCuerpo.push(cleanedText);
          }
        }

        fileObj.pagesData = hasBodyStarted ? paginasCuerpo : paginasPreliminares;

        // Clean references/contributors on the entire document to handle page overflows correctly
        log(`[${fileObj.name}] Removiendo colaboradores, autores y referencias bibliográficas localmente...`);
        let docText = fileObj.pagesData.join('\n\n--- PAGE_BREAK ---\n\n');
        docText = removerReferenciasYAutores(docText);
        fileObj.pagesData = docText.split('\n\n--- PAGE_BREAK ---\n\n');
        
        // Ensamblar texto y limpiar uniones entre páginas
        log(`[${fileObj.name}] Optimizando uniones de páginas localmente...`);
        let combined = fileObj.pagesData.join('\n\n');
        combined = limpiarUnionesEntrePaginas(combined);
        
        // Omitir tablas en local para evitar interrupciones en TTS
        log(`[${fileObj.name}] Removiendo tablas del flujo local...`);
        combined = omitirTablasLocal(combined);
        
        // Aplicar corrector ortográfico y gramatical multilingüe híbrido
        combined = await aplicarCorreccionOrtograficaCompleta(combined, fileObj, 'Local');
        
        fileObj.localText = `===========================================================\n📖 TÍTULO: ${fileObj.titulo}\n===========================================================\n\n` + combined;
        
        // Determinar si es escaneado u OCR necesario
        const avgChars = totalChars / fileObj.totalPages;
        fileObj.isDigital = avgChars > 60;
        
        fileObj.status = 'extracted';
        fileObj.localProgress = 100;
        renderFileCard(fileObj);
        
        if (fileObj.isDigital) {
          log(`[${fileObj.name}] Extracción Local completada con éxito. Listo para descarga local o IA.`, 'success');
        } else {
          fileObj.isDigital = false;
          log(`[${fileObj.name}] ⚠️ PDF escaneado (sin texto digital). Se requerirá procesamiento con IA (OCR) obligatoriamente para obtener texto.`, 'error');
        }
        
        // Actualizar estados de botones de descarga globales
        verificarBotonesGlobales();
        
      } catch (err) {
        log(`[${fileObj.name}] Error en extracción local: ${err.message}`, 'error');
        console.error(err);
        fileObj.status = 'error';
        renderFileCard(fileObj);
      }
    }

    // Iniciar IA para un archivo específico (Llamado desde el botón de la tarjeta)
    async function iniciarIAEspecifico(fileId) {
      const fileObj = loadedFiles.find(f => f.id === fileId);
      if (!fileObj || fileObj.status !== 'extracted') return;
      
      fileObj.status = 'processing_ai';
      fileObj.aiProgress = 0;
      fileObj.aiStatusText = 'Inicializando IA...';
      renderFileCard(fileObj);
      
      log(`[${fileObj.name}] Iniciando procesamiento por IA (Optativo)...`);
      
      try {
        if (fileObj.isDigital) {
          await ejecutarIAFlujoTexto(fileObj);
        } else {
          await ejecutarIAFlujoOCR(fileObj);
        }
      } catch (err) {
        log(`[${fileObj.name}] Error en procesamiento por IA: ${err.message}`, 'error');
        fileObj.status = 'error';
        renderFileCard(fileObj);
      }
    }

    // FLUJO IA 1: PROCESAMIENTO TEXTO A TEXTO (ULTRA-RÁPIDO)
    async function ejecutarIAFlujoTexto(fileObj) {
      const totalPages = fileObj.pagesData.length;
      
      // Estrategia Dinámica: calcular bloques según densidad de palabras para evitar límites de salida
      const targetWords = 2500; // Objetivo óptimo de palabras por llamada (~3300 tokens de salida, muy seguro bajo el límite de 8192 tokens)
      const maxPagesPerChunk = 12; // Límite superior de páginas para evitar timeouts de ejecución en Google Apps Script
      
      fileObj.aiChunks = [];
      let currentChunkPages = [];
      let currentChunkWords = 0;
      let chunkId = 1;
      
      for (let p = 0; p < totalPages; p++) {
        const pageText = fileObj.pagesData[p] || '';
        const wordCount = pageText.trim().split(/\s+/).filter(Boolean).length;
        
        // Si ya tenemos páginas en el bloque y sumar esta página excede el objetivo o el máximo de páginas
        if (currentChunkPages.length > 0 && 
            (currentChunkWords + wordCount > targetWords || currentChunkPages.length >= maxPagesPerChunk)) {
          
          const startPage = currentChunkPages[0];
          const endPage = currentChunkPages[currentChunkPages.length - 1] + 1;
          
          fileObj.aiChunks.push({
            id: chunkId++,
            startPage,
            endPage,
            textToSend: fileObj.pagesData.slice(startPage, endPage).join('\n\n'),
            status: 'pending',
            textResult: ''
          });
          
          currentChunkPages = [];
          currentChunkWords = 0;
        }
        
        currentChunkPages.push(p);
        currentChunkWords += wordCount;
      }
      
      // Insertar el bloque remanente
      if (currentChunkPages.length > 0) {
        const startPage = currentChunkPages[0];
        const endPage = currentChunkPages[currentChunkPages.length - 1] + 1;
        
        fileObj.aiChunks.push({
          id: chunkId++,
          startPage,
          endPage,
          textToSend: fileObj.pagesData.slice(startPage, endPage).join('\n\n'),
          status: 'pending',
          textResult: ''
        });
      }
      
      const totalChunks = fileObj.aiChunks.length;
      log(`[${fileObj.name}] Estrategia de IA Dinámica: ${totalChunks} bloques de texto plano basados en densidad de palabras (Objetivo: ~${targetWords} palabras por bloque).`);
      
      renderFileCard(fileObj);
      
      let completedCount = 0;
      let nextChunkIndex = 0;
      
      async function aiTextWorker(workerId) {
        while (nextChunkIndex < fileObj.aiChunks.length) {
          const currentIdx = nextChunkIndex++;
          const chunk = fileObj.aiChunks[currentIdx];
          chunk.status = 'processing';
          renderFileCard(fileObj);
          
          log(`[${fileObj.name}][Canal ${workerId}] Optimizando bloque ${chunk.id} (Págs ${chunk.startPage + 1}-${chunk.endPage})...`);
          
          try {
            const result = await new Promise((resolve, reject) => {
              google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .procesarFragmentoTexto(chunk.textToSend, `Libro: ${fileObj.name} - Bloque ${chunk.id}`, getStoredApiKey(), getStoredModel());
            });
            
            if (result.startsWith('[ERROR LECTURA')) {
              throw new Error(result);
            }
            
            chunk.textResult = result;
            chunk.status = 'completed';
            log(`[${fileObj.name}][Canal ${workerId}] Bloque ${chunk.id} optimizado con éxito.`, 'success');
          } catch (err) {
            chunk.status = 'failed';
            log(`[${fileObj.name}][Canal ${workerId}] ERROR en bloque ${chunk.id}: ${err.message}`, 'error');
            chunk.textResult = `\n[Error al procesar bloque ${chunk.id} (Páginas ${chunk.startPage + 1} a ${chunk.endPage}): ${err.message}]\n`;
          }
          
          completedCount++;
          fileObj.aiProgress = Math.round((completedCount / totalChunks) * 100);
          renderFileCard(fileObj);
        }
      }
      
      // Lanzar workers paralelos según concurrencia
      const workers = [];
      for (let w = 1; w <= Math.min(CONCURRENCY, totalChunks); w++) {
        workers.push(aiTextWorker(w));
      }
      
      await Promise.all(workers);
      
      // Compilar texto final
      log(`[${fileObj.name}] Ensamblando y compilando transcripción optimizada final...`);
      
      let transcriptText = "";
      for (const chunk of fileObj.aiChunks) {
        transcriptText += chunk.textResult + "\n\n";
      }
      
      // Aplicar corrector ortográfico multilingüe (híbrido) a la salida de la IA
      transcriptText = await aplicarCorreccionOrtograficaCompleta(transcriptText, fileObj, 'IA');
      
      let fullTranscript = `TRANSCRIPCIÓN OPTIMIZADA PARA TEXT-TO-SPEECH (TTS) (MODO ALTA VELOCIDAD)\n`;
      fullTranscript += `Archivo de origen: ${fileObj.name}\n`;
      fullTranscript += `Páginas totales: ${totalPages}\n`;
      fullTranscript += `Generado por: Dr. Media AI\n`;
      fullTranscript += `===========================================================\n\n`;
      fullTranscript += transcriptText;
      
      fileObj.aiText = fullTranscript;
      fileObj.status = 'completed_ai';
      fileObj.aiProgress = 100;
      renderFileCard(fileObj);
      
      log(`[${fileObj.name}] ¡Procesamiento por IA finalizado con éxito!`, 'success');
      
      // Descarga automática individual
      downloadTxtFile(fileObj.name.replace(/\.[^/.]+$/, "") + " (Limpio TTS por IA).txt", fileObj.aiText);
      
      // Actualizar estado de botones de descarga globales
      verificarBotonesGlobales();
    }

    // FLUJO IA 2: PROCESAMIENTO OCR BINARIO (PARA IMÁGENES/ESCANÉADOS)
    async function ejecutarIAFlujoOCR(fileObj) {
      log(`[${fileObj.name}] Leyendo binario PDF para corte de imágenes OCR...`);
      const arrayBuffer = await fileObj.file.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      const totalPages = fileObj.totalPages;
      const totalChunks = Math.ceil(totalPages / CHUNK_SIZE);
      
      fileObj.aiChunks = [];
      for (let i = 0; i < totalChunks; i++) {
        const startPage = i * CHUNK_SIZE;
        const endPage = Math.min(startPage + CHUNK_SIZE, totalPages);
        fileObj.aiChunks.push({
          id: i + 1,
          startPage,
          endPage,
          status: 'pending',
          textResult: ''
        });
      }
      
      renderFileCard(fileObj);
      
      let completedCount = 0;
      let nextChunkIndex = 0;
      
      async function aiPdfWorker(workerId) {
        while (nextChunkIndex < fileObj.aiChunks.length) {
          const currentIdx = nextChunkIndex++;
          const chunk = fileObj.aiChunks[currentIdx];
          chunk.status = 'processing';
          renderFileCard(fileObj);
          
          log(`[${fileObj.name}][Canal ${workerId}] Generando e interpretando imagen para OCR en bloque ${chunk.id} (Págs ${chunk.startPage + 1}-${chunk.endPage})...`);
          
          try {
            // Crear PDF parcial de estas páginas
            const subPdf = await PDFLib.PDFDocument.create();
            const pageIndices = [];
            for (let j = chunk.startPage; j < chunk.endPage; j++) {
              pageIndices.push(j);
            }
            const copiedPages = await subPdf.copyPages(pdfDoc, pageIndices);
            copiedPages.forEach(p => subPdf.addPage(p));
            const base64Chunk = await subPdf.saveAsBase64();
            
            log(`[${fileObj.name}][Canal ${workerId}] Subiendo binario a Gemini OCR...`);
            
            const result = await new Promise((resolve, reject) => {
              google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .procesarFragmento(base64Chunk, `OCR: ${fileObj.name} - Bloque ${chunk.id}`, getStoredApiKey(), getStoredModel());
            });
            
            if (result.startsWith('[ERROR LECTURA')) {
              throw new Error(result);
            }
            
            chunk.textResult = result;
            chunk.status = 'completed';
            log(`[${fileObj.name}][Canal ${workerId}] Bloque OCR ${chunk.id} finalizado.`, 'success');
          } catch (err) {
            chunk.status = 'failed';
            log(`[${fileObj.name}][Canal ${workerId}] ERROR en bloque OCR ${chunk.id}: ${err.message}`, 'error');
            chunk.textResult = `\n[Error en OCR de bloque ${chunk.id} (Páginas ${chunk.startPage + 1} a ${chunk.endPage}): ${err.message}]\n`;
          }
          
          completedCount++;
          fileObj.aiProgress = Math.round((completedCount / totalChunks) * 100);
          renderFileCard(fileObj);
        }
      }
      
      const workers = [];
      for (let w = 1; w <= Math.min(CONCURRENCY, totalChunks); w++) {
        workers.push(aiPdfWorker(w));
      }
      
      await Promise.all(workers);
      
      log(`[${fileObj.name}] Ensamblando transcripción OCR final...`);
      
      let transcriptText = "";
      for (const chunk of fileObj.aiChunks) {
        transcriptText += chunk.textResult + "\n\n";
      }
      
      // Aplicar corrector ortográfico multilingüe (híbrido) a la salida de OCR
      transcriptText = await aplicarCorreccionOrtograficaCompleta(transcriptText, fileObj, 'OCR');
      
      let fullTranscript = `TRANSCRIPCIÓN OCR OPTIMIZADA PARA TEXT-TO-SPEECH (TTS) (MODO IMAGEN)\n`;
      fullTranscript += `Archivo de origen: ${fileObj.name}\n`;
      fullTranscript += `Páginas totales: ${totalPages}\n`;
      fullTranscript += `Generado por: Dr. Media AI\n`;
      fullTranscript += `===========================================================\n\n`;
      fullTranscript += transcriptText;
      
      fileObj.aiText = fullTranscript;
      fileObj.status = 'completed_ai';
      fileObj.aiProgress = 100;
      renderFileCard(fileObj);
      
      log(`[${fileObj.name}] ¡Proceso OCR por IA completado con éxito!`, 'success');
      
      // Descarga automática individual
      downloadTxtFile(fileObj.name.replace(/\.[^/.]+$/, "") + " (OCR Limpio TTS por IA).txt", fileObj.aiText);
      
      // Actualizar estado de botones de descarga globales
      verificarBotonesGlobales();
    }


    // --- ACCIONES DE DESCARGA INDIVIDUALES ---

    function descargarLocalEspecifico(fileId) {
      const fileObj = loadedFiles.find(f => f.id === fileId);
      if (fileObj && fileObj.localText) {
        log(`[${fileObj.name}] Descargando texto original extraído localmente...`, 'success');
        const defaultName = fileObj.name.replace(/\.[^/.]+$/, "") + " (Texto Original Extraído).txt";
        downloadTxtFile(defaultName, fileObj.localText);
      }
    }

    function descargarIAEspecifico(fileId) {
      const fileObj = loadedFiles.find(f => f.id === fileId);
      if (fileObj && fileObj.aiText) {
        log(`[${fileObj.name}] Descargando texto optimizado por IA...`, 'success');
        const defaultName = fileObj.name.replace(/\.[^/.]+$/, "") + " (Limpio TTS por IA).txt";
        downloadTxtFile(defaultName, fileObj.aiText);
      }
    }


    // --- RENDERIZADO DE INTERFAZ DE TARJETAS ---
    function renderFileCard(fileObj) {
      const grid = document.getElementById('fileCardsGrid');
      let card = document.getElementById('card_' + fileObj.id);
      
      if (!card) {
        card = document.createElement('div');
        card.id = 'card_' + fileObj.id;
        card.className = 'bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden transition-all duration-300 group hover:border-indigo-500/30';
        grid.appendChild(card);
      }

      let statusHtml = '';
      let progressHtml = '';
      let actionsHtml = '';

      if (fileObj.status === 'loading') {
        statusHtml = `<span class="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md border border-amber-400/20 animate-pulse">Cargando PDF...</span>`;
        progressHtml = `<div class="w-full bg-slate-800 rounded-full h-1.5 mt-4 overflow-hidden"><div class="bg-amber-400 h-1.5 rounded-full transition-all duration-300" style="width: 50%"></div></div>`;
      } 
      else if (fileObj.status === 'extracted') {
        statusHtml = `<span class="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md border border-emerald-400/20">Extracción Local Completa</span>`;
        progressHtml = `<div class="w-full bg-slate-800 rounded-full h-1.5 mt-4 overflow-hidden"><div class="bg-emerald-400 h-1.5 rounded-full transition-all duration-300" style="width: 100%"></div></div>`;
        
        actionsHtml = `
          <div class="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-800">
            <button onclick="descargarLocalEspecifico('${fileObj.id}')" class="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-600 rounded-lg flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Descargar Local
            </button>
            <button onclick="verTextoEspecifico('${fileObj.id}', 'local')" class="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-600 rounded-lg flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              Ver Texto Local
            </button>
            <button onclick="iniciarIAEspecifico('${fileObj.id}')" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white border border-indigo-500 rounded-lg flex items-center gap-1.5 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Iniciar Limpieza IA
            </button>
          </div>
        `;
      }
      else if (fileObj.status === 'processing_ai') {
        statusHtml = `<span class="text-xs font-semibold text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded-md border border-indigo-400/20 flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping"></span> IA Procesando...
        </span>`;
        progressHtml = `
          <div class="flex justify-between text-[10px] text-slate-400 mt-3 mb-1">
            <span>Progreso IA</span>
            <span>${fileObj.aiProgress}%</span>
          </div>
          <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div class="bg-indigo-500 h-1.5 rounded-full transition-all duration-300 relative" style="width: ${fileObj.aiProgress}%">
              <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
          <p class="text-[10px] text-indigo-400/60 mt-1.5 italic">${fileObj.aiStatusText}</p>
        `;
      }
      else if (fileObj.status === 'completed_ai') {
        statusHtml = `<span class="text-xs font-semibold text-purple-400 bg-purple-400/10 px-2 py-1 rounded-md border border-purple-400/20">Procesamiento IA Completado</span>`;
        progressHtml = `<div class="w-full bg-slate-800 rounded-full h-1.5 mt-4 overflow-hidden"><div class="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-300" style="width: 100%"></div></div>`;
        
        actionsHtml = `
          <div class="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-800">
            <button onclick="descargarLocalEspecifico('${fileObj.id}')" class="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 rounded-lg flex items-center gap-1.5">
              Descargar Original
            </button>
            <button onclick="descargarIAEspecifico('${fileObj.id}')" class="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg flex items-center gap-1.5 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Descargar Limpio (IA)
            </button>
            <button onclick="verTextoEspecifico('${fileObj.id}', 'ai')" class="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-600 rounded-lg flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              Ver Texto (IA)
            </button>
          </div>
        `;
      }
      else if (fileObj.status === 'error') {
        statusHtml = `<span class="text-xs font-semibold text-red-400 bg-red-400/10 px-2 py-1 rounded-md border border-red-400/20">Error</span>`;
        progressHtml = `<div class="w-full bg-slate-800 rounded-full h-1.5 mt-4 overflow-hidden"><div class="bg-red-500 h-1.5 rounded-full" style="width: 100%"></div></div>`;
      }

      const iconColor = fileObj.isDigital ? 'text-blue-400' : 'text-amber-400';
      const typeLabel = fileObj.isDigital ? 'Texto Digital' : 'Escaneado/OCR';

      card.innerHTML = `
        <div class="flex justify-between items-start gap-4">
          <div class="flex items-start gap-3 overflow-hidden">
            <div class="p-2 bg-slate-800/80 rounded-lg border border-slate-700/50 flex-shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="${iconColor}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div class="min-w-0">
              <h4 class="text-sm font-semibold text-slate-200 truncate pr-4" title="${fileObj.name}">${fileObj.name}</h4>
              <p class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                <span>${fileObj.totalPages} págs</span>
                <span class="w-1 h-1 rounded-full bg-slate-600"></span>
                <span>${(fileObj.size / 1024 / 1024).toFixed(2)} MB</span>
                <span class="w-1 h-1 rounded-full bg-slate-600"></span>
                <span class="${iconColor} opacity-80">${typeLabel}</span>
              </p>
              ${fileObj.titulo !== 'TÍTULO NO DETECTADO' ? `<p class="text-[10px] text-emerald-400/80 mt-1 truncate">📖 ${fileObj.titulo}</p>` : ''}
            </div>
          </div>
          <div class="flex-shrink-0">
            ${statusHtml}
          </div>
        </div>
        </div>
        ${progressHtml}
        ${actionsHtml}
        <div id="preview_${fileObj.id}" class="hidden mt-4 bg-slate-950 border border-slate-700 p-3 rounded-lg max-h-60 overflow-y-auto text-xs text-slate-300 font-mono whitespace-pre-wrap"></div>
      `;
    }

    // --- LÓGICA DE DESCARGA GLOBAL (DERECHA, BAJO EL TÍTULO) ---

    function verificarBotonesGlobales() {
      const anyLocal = loadedFiles.some(f => f.localText);
      const anyAI = loadedFiles.some(f => f.aiText);
      
      const localBtn = document.getElementById('downloadAllLocalBtn');
      const aiBtn = document.getElementById('downloadAllAIBtn');
      
      if (anyLocal) {
        localBtn.disabled = false;
        localBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        localBtn.disabled = true;
        localBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
      
      if (anyAI) {
        aiBtn.disabled = false;
        aiBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        aiBtn.disabled = true;
        aiBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }

    async function descargarTodosLocales() {
      const finishedFiles = loadedFiles.filter(f => f.localText);
      if (finishedFiles.length === 0) return;
      
      log("Generando descarga de todos los textos locales extraídos...");
      
      for (const fileObj of finishedFiles) {
        const defaultName = fileObj.name.replace(/\.[^/.]+$/, "") + " (Texto Original Extraído).txt";
        downloadTxtFile(defaultName, fileObj.localText);
        await new Promise(r => setTimeout(r, 600)); // Evita que el navegador bloquee descargas múltiples
      }
      
      log("Descarga de múltiples textos locales finalizada.", 'success');
    }

    async function descargarTodosIA() {
      const finishedFiles = loadedFiles.filter(f => f.aiText);
      if (finishedFiles.length === 0) return;
      
      log("Generando descarga de todas las transcripciones IA...");
      
      for (const fileObj of finishedFiles) {
        const defaultName = fileObj.name.replace(/\.[^/.]+$/, "") + " (Limpio TTS por IA).txt";
        downloadTxtFile(defaultName, fileObj.aiText);
        await new Promise(r => setTimeout(r, 600)); // Evita que el navegador bloquee descargas múltiples
      }
      
      log("Descarga de múltiples transcripciones IA finalizada.", 'success');
    }

    function verTextoEspecifico(fileId, tipo) {
      const fileObj = loadedFiles.find(f => f.id === fileId);
      if (!fileObj) return;
      
      const previewDiv = document.getElementById('preview_' + fileId);
      if (!previewDiv) return;
      
      if (!previewDiv.classList.contains('hidden')) {
        previewDiv.classList.add('hidden'); // Toggle para cerrar
        return;
      }
      
      const texto = tipo === 'local' ? fileObj.localText : fileObj.aiText;
      previewDiv.textContent = texto || 'Texto no disponible.';
      previewDiv.classList.remove('hidden');
    }

    // Función genérica para descargar .TXT en navegador
    function downloadTxtFile(filename, text) {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }

export let typoInstances = {};


    export function autodetectarLenguaje(texto) {
      if (!texto) return 'es';
      const cleanText = texto.toLowerCase();
      
      const palabrasES = [' el ', ' de ', ' la ', ' que ', ' en ', ' los ', ' las ', ' un ', ' una ', ' con ', ' para ', ' por ', ' esta ', ' como ', ' es ', ' y '];
      const palabrasEN = [' the ', ' of ', ' and ', ' to ', ' in ', ' that ', ' is ', ' was ', ' for ', ' on ', ' with ', ' as ', ' by ', ' this ', ' it ', ' a '];
      
      let countES = 0;
      let countEN = 0;
      
      for (const w of palabrasES) {
        const matches = cleanText.match(new RegExp(w, 'g'));
        if (matches) countES += matches.length;
      }
      
      for (const w of palabrasEN) {
        const matches = cleanText.match(new RegExp(w, 'g'));
        if (matches) countEN += matches.length;
      }
      
      return countES >= countEN ? 'es' : 'en';
    }

    export async function cargarDiccionarioLocal(lang) {
      if (typoInstances[lang]) return typoInstances[lang];
      
      const affUrl = lang === 'es' 
        ? 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/es/index.aff'
        : 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/en/index.aff';
        
      const dicUrl = lang === 'es'
        ? 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/es/index.dic'
        : 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/en/index.dic';
        
      log(`[Corrector Local] Descargando diccionario hunspell para '${lang.toUpperCase()}'...`);
      
      const [affData, dicData] = await Promise.all([
        fetch(affUrl).then(r => r.text()),
        fetch(dicUrl).then(r => r.text())
      ]);
      
      log(`[Corrector Local] Diccionario '${lang.toUpperCase()}' cargado. Inicializando...`);
      const dictionary = new Typo(lang, affData, dicData, { platform: 'any' });
      typoInstances[lang] = dictionary;
      return dictionary;
    }

    export function omitirTablasLocal(texto) {
      if (!texto) return "";
      const lineas = texto.split('\n\n');
      const resultado = [];
      let enTabla = false;
      
      for (let i = 0; i < lineas.length; i++) {
        const para = lineas[i].trim();
        if (!para) continue;
        
        // Detectar el inicio de una tabla por encabezados estándar (Tabla, Cuadro, Table, Chart)
        const esInicioTabla = /^(?:Tabla|Table|Cuadro|Gráfico|Grafico|Figura|Figure|Chart)\s+\d+/i.test(para);
        
        if (esInicioTabla) {
          enTabla = true;
          // Omitimos el título de la tabla
          continue;
        }
        
        if (enTabla) {
          // Evaluar si es el final de la tabla y retorno al texto discursivo
          const palabras = para.split(/\s+/).filter(p => p.length > 0);
          const tienePuntuacionFinal = /[.!?»"”]\s*$/.test(para);
          
          // Un párrafo normal suele ser largo (más de 15 palabras), tener puntuación final y no ser una viñeta
          const esTextoNormal = palabras.length > 15 && tienePuntuacionFinal && !/^\s*•/.test(para);
          
          if (esTextoNormal) {
            enTabla = false; // Fin de la tabla, volvemos a texto normal
          } else {
            // Mientras estemos en la tabla, omitimos sus filas
            continue;
          }
        }
        
        resultado.push(para);
      }
      
      return resultado.join('\n\n');
    }

    export function expandirSiglasPsiquiatria(texto, lang) {
      if (!texto) return "";
      let res = texto;
      
      if (lang === 'es') {
        const siglasES = [
          // Plurales primero para evitar que coincida la raíz singular
          { re: /\bTCAs\b/g, rep: "trastornos de la conducta alimentaria" },
          { re: /\btcas\b/g, rep: "trastornos de la conducta alimentaria" },
          { re: /\bTCA\b/g, rep: "trastorno de la conducta alimentaria" },
          { re: /\btca\b/g, rep: "trastorno de la conducta alimentaria" },
          
          { re: /\bAN\b/g, rep: "anorexia nerviosa" },
          { re: /\bBN\b/g, rep: "bulimia nerviosa" },
          
          { re: /\bTOCs\b/g, rep: "trastornos obsesivo compulsivos" },
          { re: /\btocs\b/g, rep: "trastornos obsesivo compulsivos" },
          { re: /\bTOC\b/g, rep: "trastorno obsesivo compulsivo" },
          { re: /\btoc\b/g, rep: "trastorno obsesivo compulsivo" },
          
          { re: /\bTAG\b/g, rep: "trastorno de ansiedad generalizada" },
          { re: /\btag\b/g, rep: "trastorno de ansiedad generalizada" },
          
          { re: /\bTDAH\b/g, rep: "trastorno por déficit de atención e hiperactividad" },
          { re: /\btdah\b/g, rep: "trastorno por déficit de atención e hiperactividad" },
          
          { re: /\bTEA\b/g, rep: "trastorno del espectro autista" }, // Solo mayúsculas para evitar 'tea' (infusión)
          { re: /\bTLP\b/g, rep: "trastorno límite de la personalidad" },
          { re: /\btlp\b/g, rep: "trastorno límite de la personalidad" },
          
          { re: /\bTAB\b/g, rep: "trastorno afectivo bipolar" },
          { re: /\btab\b/g, rep: "trastorno afectivo bipolar" },
          
          { re: /\bTA\b/g, rep: "trastorno por atracón" }, // Solo mayúsculas para evitar 'ta' coloquial
          
          { re: /\bISRS\b/g, rep: "inhibidores selectivos de la recaptación de serotonina" },
          { re: /\bisrs\b/g, rep: "inhibidores selectivos de la recaptación de serotonina" },
          { re: /\bIRSN\b/g, rep: "inhibidores de la recaptación de serotonina y noradrenalina" },
          { re: /\birsn\b/g, rep: "inhibidores de la recaptación de serotonina y noradrenalina" },
          
          { re: /\bIMC\b/g, rep: "índice de masa corporal" },
          { re: /\bimc\b/g, rep: "índice de masa corporal" },
          
          { re: /\bAPA\b/g, rep: "Asociación Psiquiátrica Americana" },
          { re: /\bVO\b/g, rep: "vía oral" },
          
          // --- Nuevas siglas incorporadas desde la carpeta Papers ---
          { re: /\bTEPT-C\b/g, rep: "trastorno de estrés postraumático complejo" },
          { re: /\btept-c\b/g, rep: "trastorno de estrés postraumático complejo" },
          { re: /\bTEPT\b/g, rep: "trastorno de estrés postraumático" },
          { re: /\btept\b/g, rep: "trastorno de estrés postraumático" },
          { re: /\bTPET\b/g, rep: "trastorno de estrés postraumático" }, // Variante por error común
          { re: /\btpet\b/g, rep: "trastorno de estrés postraumático" },
          
          { re: /\bTDM\b/g, rep: "trastorno depresivo mayor" },
          { re: /\btdm\b/g, rep: "trastorno depresivo mayor" },
          
          { re: /\bTUS\b/g, rep: "trastorno por uso de sustancias" },
          { re: /\btus\b/g, rep: "trastorno por uso de sustancias" },
          
          { re: /\bTID\b/g, rep: "trastorno de identidad disociativo" },
          { re: /\btid\b/g, rep: "trastorno de identidad disociativo" },
          
          { re: /\bTDC\b/g, rep: "trastorno dismórfico corporal" },
          { re: /\btdc\b/g, rep: "trastorno dismórfico corporal" },
          
          { re: /\bTEC\b/g, rep: "terapia electroconvulsiva" },
          { re: /\btec\b/g, rep: "terapia electroconvulsiva" },
          
          { re: /\bTCC\b/g, rep: "terapia cognitivo conductual" },
          { re: /\btcc\b/g, rep: "terapia cognitivo conductual" },
          
          { re: /\bEMDR\b/g, rep: "desensibilización y reprocesamiento por movimientos oculares" },
          { re: /\bemdr\b/g, rep: "desensibilización y reprocesamiento por movimientos oculares" },
          
          { re: /\bEMTr\b/g, rep: "estimulación magnética transcraneal repetitiva" },
          { re: /\bemtr\b/g, rep: "estimulación magnética transcraneal repetitiva" },
          
          { re: /\bPANSS\b/g, rep: "escala de los síndromes positivo y negativo" },
          { re: /\bpanss\b/g, rep: "escala de los síndromes positivo y negativo" },
          
          { re: /\bTPs\b/g, rep: "trastornos de la personalidad" },
          { re: /\btps\b/g, rep: "trastornos de la personalidad" },
          { re: /\bTP\b/g, rep: "trastorno de la personalidad" }, // Solo mayúsculas para evitar 'tp'
          
          // Números Romanos (Ordinales I-X, Cardinales XI-XXX con salvaguardas para iniciales de nombres)
          { re: /\bXXX\b/g, rep: "treinta" },
          { re: /\bXXIX\b/g, rep: "veintinueve" },
          { re: /\bXXVIII\b/g, rep: "veintiocho" },
          { re: /\bXXVII\b/g, rep: "veintisiete" },
          { re: /\bXXVI\b/g, rep: "veintiséis" },
          { re: /\bXXV\b/g, rep: "veinticinco" },
          { re: /\bXXIV\b/g, rep: "veinticuatro" },
          { re: /\bXXIII\b/g, rep: "veintitrés" },
          { re: /\bXXII\b/g, rep: "veintidós" },
          { re: /\bXXI\b/g, rep: "veintiuno" },
          { re: /\bXX\b/g, rep: "veinte" },
          { re: /\bXIX\b/g, rep: "diecinueve" },
          { re: /\bXVIII\b/g, rep: "dieciocho" },
          { re: /\bXVII\b/g, rep: "diecisiete" },
          { re: /\bXVI\b/g, rep: "dieciséis" },
          { re: /\bXV\b/g, rep: "quince" },
          { re: /\bXIV\b/g, rep: "catorce" },
          { re: /\bXIII\b/g, rep: "trece" },
          { re: /\bXII\b/g, rep: "doce" },
          { re: /\bXI\b/g, rep: "once" },
          { re: /\bX\b/g, rep: "décimo" },
          { re: /\bIX\b/g, rep: "noveno" },
          { re: /\bVIII\b/g, rep: "octavo" },
          { re: /\bVII\b/g, rep: "séptimo" },
          { re: /\bVI\b/g, rep: "sexto" },
          { re: /(?<![A-Z]\.\s+)\bV\b(?!\.\s*[A-Z]\.)/g, rep: "quinto" },
          { re: /\bIV\b/g, rep: "cuarto" },
          { re: /\bIII\b/g, rep: "tercero" },
          { re: /\bII\b/g, rep: "segundo" },
          { re: /(?<![A-Z]\.\s+)\bI\b(?!\.\s*[A-Z]\.)/g, rep: "primero" },
          
          // Elementos temporales e históricos
          { re: /\ba\.\s*de\s*c\./gi, rep: "antes de cristo" },
          { re: /\ba\.\s*c\./gi, rep: "antes de cristo" },
          { re: /\bd\.\s*de\s*c\./gi, rep: "después de cristo" },
          { re: /\bd\.\s*c\./gi, rep: "después de cristo" },
          
          // Unidades de medida (con o sin número previo, ej: 10mg o 10 mg)
          { re: /\b(\d+)\s*mg\b/gi, rep: "$1 miligramos" },
          { re: /\b(\d+)\s*ml\b/gi, rep: "$1 mililitros" },
          { re: /\b(\d+)\s*kg\b/gi, rep: "$1 kilogramos" },
          { re: /\b(\d+)\s*mcg\b/gi, rep: "$1 microgramos" },
          { re: /\b(\d+)\s*μg\b/g, rep: "$1 microgramos" },
          { re: /\b(\d+)\s*g\b/gi, rep: "$1 gramos" }, // Solo gramos con número previo
          
          { re: /\bmg\b/gi, rep: "miligramos" },
          { re: /\bml\b/gi, rep: "mililitros" },
          { re: /\bmcg\b/gi, rep: "microgramos" }
        ];
        
        for (const rule of siglasES) {
          res = res.replace(rule.re, rule.rep);
        }
      } 
      else if (lang === 'en') {
        const siglasEN = [
          { re: /\bTCAs\b/g, rep: "tricyclic antidepressants" },
          { re: /\btcas\b/g, rep: "tricyclic antidepressants" },
          { re: /\bTCA\b/g, rep: "tricyclic antidepressant" },
          { re: /\btca\b/g, rep: "tricyclic antidepressant" },
          
          { re: /\bEDs\b/g, rep: "eating disorders" },
          { re: /\beds\b/g, rep: "eating disorders" },
          { re: /\bED\b/g, rep: "eating disorder" }, // Solo mayúsculas para evitar 'ed' (nombre propio)
          
          { re: /\bAN\b/g, rep: "anorexia nervosa" },
          { re: /\bBN\b/g, rep: "bulimia nervosa" },
          { re: /\bBED\b/g, rep: "binge eating disorder" }, // Solo mayúsculas para evitar 'bed' (cama)
          
          { re: /\bOCD\b/g, rep: "obsessive-compulsive disorder" },
          { re: /\bocd\b/g, rep: "obsessive-compulsive disorder" },
          
          { re: /\bGAD\b/g, rep: "generalized anxiety disorder" },
          { re: /\bgad\b/g, rep: "generalized anxiety disorder" },
          
          { re: /\bADHD\b/g, rep: "attention-deficit hyperactivity disorder" },
          { re: /\badhd\b/g, rep: "attention-deficit hyperactivity disorder" },
          
          { re: /\bASD\b/g, rep: "autism spectrum disorder" },
          { re: /\basd\b/g, rep: "autism spectrum disorder" },
          
          { re: /\bBPD\b/g, rep: "borderline personality disorder" },
          { re: /\bbpd\b/g, rep: "borderline personality disorder" },
          
          { re: /\bMDD\b/g, rep: "major depressive disorder" },
          { re: /\bmdd\b/g, rep: "major depressive disorder" },
          
          { re: /\bCBT-E\b/g, rep: "enhanced cognitive behavioral therapy" },
          { re: /\bcbt-e\b/g, rep: "enhanced cognitive behavioral therapy" },
          { re: /\bCBT\b/g, rep: "cognitive behavioral therapy" },
          { re: /\bcbt\b/g, rep: "cognitive behavioral therapy" },
          
          { re: /\bIPT\b/g, rep: "interpersonal psychotherapy" },
          { re: /\bipt\b/g, rep: "interpersonal psychotherapy" },
          
          { re: /\bSSRIs\b/g, rep: "selective serotonin reuptake inhibitors" },
          { re: /\bssris\b/g, rep: "selective serotonin reuptake inhibitors" },
          { re: /\bSSRI\b/g, rep: "selective serotonin reuptake inhibitor" },
          { re: /\bssri\b/g, rep: "selective serotonin reuptake inhibitor" },
          
          { re: /\bSNRIs\b/g, rep: "serotonin-norepinephrine reuptake inhibitors" },
          { re: /\bsnris\b/g, rep: "serotonin-norepinephrine reuptake inhibitors" },
          { re: /\bSNRI\b/g, rep: "serotonin-norepinephrine reuptake inhibitor" },
          { re: /\bsnri\b/g, rep: "serotonin-norepinephrine reuptake inhibitor" },
          
          { re: /\bBMI\b/g, rep: "body mass index" },
          { re: /\bbmi\b/g, rep: "body mass index" },
          
          { re: /\bAPA\b/g, rep: "American Psychiatric Association" },
          
          // --- Nuevas siglas incorporadas desde la carpeta Papers ---
          { re: /\bCPTSD\b/g, rep: "complex post-traumatic stress disorder" },
          { re: /\bcptsd\b/g, rep: "complex post-traumatic stress disorder" },
          { re: /\bPTSD\b/g, rep: "post-traumatic stress disorder" },
          { re: /\bptsd\b/g, rep: "post-traumatic stress disorder" },
          
          { re: /\bSUDs\b/g, rep: "substance use disorders" },
          { re: /\bsuds\b/g, rep: "substance use disorders" },
          { re: /\bSUD\b/g, rep: "substance use disorder" }, // Solo mayúsculas
          
          { re: /\bDID\b/g, rep: "dissociative identity disorder" },
          { re: /\bdid\b/g, rep: "dissociative identity disorder" },
          
          { re: /\bDPD\b/g, rep: "depersonalization-derealization disorder" },
          { re: /\bdpd\b/g, rep: "depersonalization-derealization disorder" },
          
          { re: /\bBDD\b/g, rep: "body dysmorphic disorder" },
          { re: /\bbdd\b/g, rep: "body dysmorphic disorder" },
          
          { re: /\bSZ\b/g, rep: "schizophrenia" }, // Solo mayúsculas para evitar 'sz' (letra/abreviación)
          { re: /\bSCZ\b/g, rep: "schizophrenia" },
          { re: /\bscz\b/g, rep: "schizophrenia" },
          
          { re: /\bECT\b/g, rep: "electroconvulsive therapy" },
          { re: /\bect\b/g, rep: "electroconvulsive therapy" },
          
          { re: /\bEMDR\b/g, rep: "eye movement desensitization and reprocessing" },
          { re: /\bemdr\b/g, rep: "eye movement desensitization and reprocessing" },
          
          { re: /\brTMS\b/g, rep: "repetitive transcranial magnetic stimulation" },
          { re: /\brtms\b/g, rep: "repetitive transcranial magnetic stimulation" },
          
          { re: /\bPANSS\b/g, rep: "positive and negative syndrome scale" },
          { re: /\bpanss\b/g, rep: "positive and negative syndrome scale" },
          
          { re: /\bSCID\b/g, rep: "structured clinical interview for DSM" },
          { re: /\bscid\b/g, rep: "structured clinical interview for DSM" },
          
          { re: /\bHAM-D\b/g, rep: "Hamilton depression rating scale" },
          { re: /\bham-d\b/g, rep: "Hamilton depression rating scale" },
          
          { re: /\bBDI\b/g, rep: "Beck depression inventory" },
          { re: /\bbdi\b/g, rep: "Beck depression inventory" },
          
          { re: /\bYMRS\b/g, rep: "Young mania rating scale" },
          { re: /\bymrs\b/g, rep: "Young mania rating scale" },
          
          { re: /\bACT\b/g, rep: "acceptance and commitment therapy" }, // Solo mayúsculas para evitar 'act' (verbo/acción)
          
          { re: /\bPDs\b/g, rep: "personality disorders" },
          { re: /\bpds\b/g, rep: "personality disorders" },
          { re: /\bPD\b/g, rep: "personality disorder" }, // Solo mayúsculas para evitar 'pd'
          
          // Roman Numerals (Ordinals)
          { re: /\bII\b/g, rep: "second" },
          { re: /\bIII\b/g, rep: "third" },
          { re: /\bIV\b/g, rep: "fourth" },
          { re: /\bV\b/g, rep: "fifth" },
          { re: /\bVI\b/g, rep: "sixth" },
          { re: /\bVII\b/g, rep: "seventh" },
          { re: /\bVIII\b/g, rep: "eighth" },
          { re: /\bIX\b/g, rep: "ninth" },
          { re: /\bX\b/g, rep: "tenth" },
          
          // Historical / Temporal Elements
          { re: /\bb\.\s*c\./gi, rep: "before christ" },
          { re: /\ba\.\s*d\./gi, rep: "anno domini" },
          { re: /\ba\.\s*de\s*c\./gi, rep: "before christ" },
          { re: /\ba\.\s*c\./gi, rep: "before christ" },
          
          // Unidades de medida (con o sin número previo, ej: 10mg o 10 mg)
          { re: /\b(\d+)\s*mg\b/gi, rep: "$1 milligrams" },
          { re: /\b(\d+)\s*ml\b/gi, rep: "$1 milliliters" },
          { re: /\b(\d+)\s*kg\b/gi, rep: "$1 kilograms" },
          { re: /\b(\d+)\s*mcg\b/gi, rep: "$1 micrograms" },
          { re: /\b(\d+)\s*μg\b/g, rep: "$1 micrograms" },
          { re: /\b(\d+)\s*g\b/gi, rep: "$1 grams" }, // Solo gramos con número previo
          
          { re: /\bmg\b/gi, rep: "milligrams" },
          { re: /\bml\b/gi, rep: "milliliters" },
          { re: /\bmcg\b/gi, rep: "micrograms" }
        ];
        
        for (const rule of siglasEN) {
          res = res.replace(rule.re, rule.rep);
        }
      }
      
      return res;
    }

    export async function aplicarCorreccionOrtograficaCompleta(texto, fileObj, contextLabel) {
      if (!texto) return "";
      
      log(`[${fileObj.name}][${contextLabel}] Iniciando control de calidad lingüístico y ortográfico...`);
      
      // 1. Normalización Unicode NFC (reune acentos flotantes en un solo caracter de forma local e instantánea!)
      let textNorm = texto.normalize('NFC');
      
      // 2. Corregir ligaduras y deformaciones tipográficas OCR ultra-comunes en español
      textNorm = textNorm
        .replace(/cl\s+ínica/gi, "clínica")
        .replace(/mostrí\s+ó/g, "mostró")
        .replace(/tenaní/g, "tenían")
        .replace(/pises/g, "países")
        .replace(/pases\s+occidentales/g, "países occidentales")
        .replace(/diagn\s*ó\s*stico/gi, "diagnóstico")
        .replace(/diagnstico/gi, "diagnóstico")
        .replace(/relaci\s*ó\s*n/gi, "relación")
        .replace(/atrac\s*ó\s*n/gi, "atracón")
        .replace(/conducta\s+alimentaria/gi, "conducta alimentaria")
        .replace(/\bter ía\b/g, "tenía")
        .replace(/as\s+í\s+tambi/g, "así tambi")
        .replace(/tambi\s*é\s*n/g, "también");
        
      const lang = autodetectarLenguaje(textNorm);
      log(`[${fileObj.name}][${contextLabel}] Idioma detectado: ${lang.toUpperCase()}`);
      
      // 2.5 Expandir siglas psiquiátricas y de dosis médicas exclusivas de idioma detectado
      log(`[${fileObj.name}][${contextLabel}] Expandiendo siglas médicas para optimización de pronunciación TTS...`);
      textNorm = expandirSiglasPsiquiatria(textNorm, lang);
      
      const userApiKey = getStoredApiKey();
      let geminiFailed = false;
      let correctedText = "";
      
      // Opción A: Intentar corregir con Gemini Flash (Lógica inteligente con contexto)
      try {
        log(`[${fileObj.name}][${contextLabel}] Enviando texto a Gemini Flash para corrección ortográfica contextual por IA (Opción A)...`);
        
        // Dividir el texto en bloques de ~12,000 caracteres para evitar timeouts de Apps Script
        const maxChunkSize = 12000;
        const paragraphs = textNorm.split('\n\n');
        let chunks = [];
        let currentChunk = "";
        
        for (const para of paragraphs) {
          if ((currentChunk + para).length > maxChunkSize) {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = para;
          } else {
            currentChunk = currentChunk ? currentChunk + "\n\n" + para : para;
          }
        }
        if (currentChunk) chunks.push(currentChunk);
        
        log(`[${fileObj.name}][${contextLabel}] Procesando en ${chunks.length} bloques de corrección por IA...`);
        
        let correctedChunks = [];
        for (let i = 0; i < chunks.length; i++) {
          log(`[${fileObj.name}][${contextLabel}] Corrigiendo bloque ${i + 1}/${chunks.length} por IA...`);
          const res = await new Promise((resolve, reject) => {
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .corregirTextoGemini(chunks[i], lang, userApiKey, getStoredModel());
          });
          
          if (res.startsWith('[ERROR CORRECCION GEMINI')) {
            throw new Error(res);
          }
          correctedChunks.push(res);
        }
        
        correctedText = correctedChunks.join('\n\n');
        log(`[${fileObj.name}][${contextLabel}] ¡Corrección por IA finalizada exitosamente!`, 'success');
        return correctedText;
        
      } catch (err) {
        log(`[${fileObj.name}][${contextLabel}] ⚠️ Opción A (IA) falló o cuota de API excedida: ${err.message}. Procediendo con corrector local Hunspell (Opción B) offline...`, 'error');
        geminiFailed = true;
      }
      
      // Opción B Fallback: Spellcheck local con diccionarios de Hunspell y Typo.js
      if (geminiFailed) {
        try {
          const dictionary = await cargarDiccionarioLocal(lang);
          
          // Escanear palabras en busca de errores
          const words = textNorm.match(/[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]+/g) || [];
          const uniqueWords = [...new Set(words)];
          
          let misspelledCount = 0;
          let suspiciousWords = [];
          
          for (const word of uniqueWords) {
            if (word.length <= 3) continue; // ignorar conectores cortos
            if (word === word.toUpperCase()) continue; // ignorar acrónimos
            
            const isOk = dictionary.check(word);
            if (!isOk) {
              misspelledCount++;
              if (suspiciousWords.length < 15) {
                suspiciousWords.push(word);
              }
            }
          }
          
          log(`[${fileObj.name}][${contextLabel}][Opción B] Escaneo finalizado. Palabras dudosas o siglas: ${misspelledCount}`, 'success');
          if (suspiciousWords.length > 0) {
            log(`[Opción B] Palabras sospechosas identificadas: ${suspiciousWords.join(', ')}`);
          }
          log(`[${fileObj.name}][${contextLabel}] Normalización Unicode NFC y heurísticas locales completadas con éxito.`, 'success');
          
          return textNorm;
        } catch (err) {
          log(`[${fileObj.name}][${contextLabel}][Opción B] Fallback local falló: ${err.message}. Se devuelve texto normalizado NFC sin corregir diccionarios.`, 'error');
          return textNorm;
        }
      }
      return textNorm;
    }

export function removerReferenciasYAutores(texto: string): string {
  if (!texto) return "";
  
  const lineas = texto.split('\n\n');
  const resultado: string[] = [];
  
  let enReferencias = false;
  let enColaboradores = false;
  
  // Expresiones regulares para detectar cabeceras de bloques
  const regexReferenciasHeader = /^(References|Bibliografía|Bibliografia|Bibliography|Referencias Bibliográficas|Referencias Bibliograficas|Referencias)\s*$/i;
  const regexColaboradoresHeader = /^(Contributors|Colaboradores|List of Contributors|Lista de Colaboradores|Autores|Autores de la obra)\s*$/i;
  
  // Límites para detener la eliminación de colaboradores
  const regexFinColaboradores = /^(Preface|Prefacio|Prólogo|Prologo|Introduction|Introducción|Introduccion|Chapter\s+\d+|Capítulo\s+\d+|Capitulo\s+\d+|PART\s+[I|V|X\d]+|PARTE\s+[I|V|X\d]+|\d+\s+[A-ZÁÉÍÓÚÑÜ])\b/i;

  for (let i = 0; i < lineas.length; i++) {
    const para = lineas[i].trim();
    if (!para) {
      resultado.push(lineas[i]); // Mantener párrafos vacíos para estructura
      continue;
    }
    
    // Preservar marcadores de página pase lo que pase
    if (para === '--- PAGE_BREAK ---') {
      resultado.push(lineas[i]);
      continue;
    }
    
    // Si estamos en modo colaboradores, revisar si llegamos al final del bloque
    if (enColaboradores) {
      if (regexFinColaboradores.test(para)) {
        enColaboradores = false; // Detener la eliminación
      } else {
        // Omitir este párrafo (colaborador o afiliación)
        continue;
      }
    }
    
    // Si estamos en modo referencias, revisar si llegamos al final del bloque
    if (enReferencias) {
      // Determinar si es un inicio de capítulo/sección nuevo o texto normal que detiene la eliminación
      const esFinReferencias = esFinDeReferencias(para);
      if (esFinReferencias) {
        enReferencias = false; // Detener la eliminación
      } else {
        // Omitir este párrafo (referencia bibliográfica)
        continue;
      }
    }
    
    // Detectar inicio de colaboradores
    if (regexColaboradoresHeader.test(para)) {
      enColaboradores = true;
      continue; // Omitir el encabezado "Contributors"
    }
    
    // Detectar inicio de referencias
    if (regexReferenciasHeader.test(para)) {
      enReferencias = true;
      continue; // Omitir el encabezado "References"
    }
    
    // Filtrar individualmente párrafos sueltos de conflicto de interés
    if (/^(Disclosure of Competing Interests|Conflict of Interest|Conflicts of Interest|Declaración de intereses|Conflictos de interés|Conflicto de intereses)\b/i.test(para)) {
      continue;
    }
    if (/^The following contributors to this book have indicated/i.test(para)) {
      continue;
    }
    
    resultado.push(lineas[i]);
  }
  
  return resultado.join('\n\n');
}

function esFinDeReferencias(para: string): boolean {
  const cleanPara = para.trim();
  if (!cleanPara) return false;
  
  // 1. Cabeceras claras de secciones/capítulos
  const regexHeading = /^(Preface|Prefacio|Prólogo|Prologo|Introduction|Introducción|Introduccion|Chapter\s+\d+|Capítulo\s+\d+|Capitulo\s+\d+|PART\s+[I|V|X\d]+|PARTE\s+[I|V|X\d]+|\d+\s+[A-ZÁÉÍÓÚÑÜ])\b/i;
  if (regexHeading.test(cleanPara)) return true;
  

  
  // 2. Firmas o nombres de autores con títulos médicos académicos
  if ((/\b(M\.D\.|Ph\.D\.|M\.P\.H\.|Dr\.P\.H\.|M\.S\.)(?![a-zA-Z])|\b(PhD|MD|MPH|DFAPA)\b/i.test(cleanPara)) && cleanPara.length < 300) {
    return true;
  }// 3. Párrafos normales de texto discursivo
  const score = calcularScoreReferencia(cleanPara);
  if (score < 3 && cleanPara.length > 250) {
    return true; // Es texto normal largo, detener la eliminación
  }
  
  return false;
}

function calcularScoreReferencia(texto: string): number {
  let score = 0;
  
  // Contiene un año de publicación
  if (/\b(19|20)\d{2}\b/.test(texto)) score += 2;
  
  // Contiene un patrón de volumen/páginas: ej "60:565–571", "30:67-76"
  if (/\b\d+\s*:\s*\d+(?:[–-]\d+)?\b/.test(texto)) score += 3;
  
  // Contiene et al.
  if (/\bet\s+al\b/i.test(texto)) score += 3;
  
  // Contiene doi: o PMID
  if (/doi:|pmid|pmcid/i.test(texto)) score += 4;
  
  // Contiene abreviaturas típicas de revistas médicas
  if (/\b(Psychiatry|Journal|Lancet|Bull|Med|Rev|Clin|Sci|Am\s+J|J\s+Clin|PLoS|Acad)\b/i.test(texto)) score += 2;
  
  // Contiene palabras típicas de editoriales de libros
  if (/\b(Press|University|Arlington|Edition|Publishing)\b/i.test(texto)) score += 1;
  
  // Patrón de nombre de autor al inicio (Ej: "Brown AS,")
  if (/^[A-Z][a-zñáéíóúü]+ [A-Z]{1,2}\b/.test(texto)) score += 2;
  
  return score;
}

