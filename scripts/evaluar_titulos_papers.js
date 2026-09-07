/**
 * Evalúa, sobre una colección de PDFs, cuántos títulos detecta la app en la
 * portada y cuántos caen al nombre de archivo.
 *
 * Usa exactamente las mismas funciones que la aplicación (src/utils/), de modo
 * que el resultado refleja el comportamiento real y no una copia divergida.
 *
 * Uso:
 *   node scripts/evaluar_titulos_papers.js <directorio> [--markdown [salida.md]]
 */
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extraerTextoDePagina } from '../src/utils/pdfLayout.ts';
import { extraerTituloDePortada } from '../src/utils/textRules.ts';

function getAllPdfFiles(dir) {
  let results = [];
  try {
    for (const file of fs.readdirSync(dir)) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllPdfFiles(filePath));
      } else if (file.toLowerCase().endsWith('.pdf')) {
        results.push(filePath);
      } else if (!file.includes('.') && stat.size > 1000) {
        // Archivos sin extensión: se aceptan si el binario empieza por %PDF-
        try {
          const buf = Buffer.alloc(5);
          const fd = fs.openSync(filePath, 'r');
          fs.readSync(fd, buf, 0, 5, 0);
          fs.closeSync(fd);
          if (buf.toString() === '%PDF-') results.push(filePath);
        } catch (e) { /* ilegible: se omite */ }
      }
    }
  } catch (e) { /* directorio inaccesible: se omite */ }
  return results;
}

async function tituloDelPdf(fullPath) {
  const data = new Uint8Array(fs.readFileSync(fullPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page1 = await pdf.getPage(1);
  return extraerTituloDePortada(await extraerTextoDePagina(page1));
}

async function evaluar(rootDir) {
  const grupos = new Map();
  for (const fullPath of getAllPdfFiles(rootDir)) {
    const folder = path.dirname(path.relative(rootDir, fullPath));
    if (!grupos.has(folder)) grupos.set(folder, []);
    grupos.get(folder).push(fullPath);
  }

  const carpetas = [];
  let totalDetected = 0, totalFallback = 0, totalProcessed = 0;

  for (const [folder, files] of grupos) {
    const filas = [];
    let folderDetected = 0;
    for (const fullPath of files) {
      const fileName = path.basename(fullPath);
      totalProcessed++;
      try {
        const detectedTitle = await tituloDelPdf(fullPath);
        const fallbackTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').toUpperCase();
        const isDetected = detectedTitle !== 'TÍTULO NO DETECTADO';
        if (isDetected) { totalDetected++; folderDetected++; } else { totalFallback++; }
        filas.push({ estado: isDetected ? 'detectado' : 'fallback', fileName, titulo: isDetected ? detectedTitle : fallbackTitle });
      } catch (err) {
        filas.push({ estado: 'error', fileName, titulo: err.message });
      }
    }
    carpetas.push({ nombre: folder === '.' ? 'Papers (Raíz)' : folder, filas, folderDetected, total: files.length });
  }
  return { rootDir, carpetas, totalDetected, totalFallback, totalProcessed };
}

const ICONO = { detectado: '✅ Detectado', fallback: '🔄 Fallback', error: '❌ Error' };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function aConsola(r) {
  const linea = '='.repeat(64);
  console.log(`\n${linea}\nEVALUACIÓN DE SELECCIÓN DE TÍTULOS EN PAPERS (RECURSIVO)`);
  console.log(`Directorio raíz: ${r.rootDir}\nTotal de archivos PDF encontrados: ${r.totalProcessed}\n${linea}\n`);
  for (const c of r.carpetas) {
    console.log(`\n📁 CARPETA: [${c.nombre}] (${c.total} archivos)\n${'-'.repeat(64)}`);
    for (const f of c.filas) console.log(`     [${f.estado.toUpperCase()}] ${f.fileName}\n       ↳ ${f.titulo}`);
    console.log(`     📊 Tasa de detección en esta carpeta: ${c.folderDetected}/${c.total} (${pct(c.folderDetected, c.total)}%)`);
  }
  console.log(`\n${linea}\nRESUMEN GLOBAL FINAL\n${linea}`);
  console.log(`Total de Papers Analizados: ${r.totalProcessed}`);
  console.log(`Títulos Detectados en Portada/Pág 1: ${r.totalDetected} (${pct(r.totalDetected, r.totalProcessed)}%)`);
  console.log(`Fallback a Nombre de Archivo: ${r.totalFallback} (${pct(r.totalFallback, r.totalProcessed)}%)`);
}

function aMarkdown(r) {
  let md = '# Reporte de Evaluación de Títulos en Colección de Papers\n\n';
  md += `**Directorio base**: \`${r.rootDir}\`\n**Total de documentos analizados**: ${r.totalProcessed}\n\n`;
  for (const c of r.carpetas) {
    md += `## 📁 Carpeta: \`${c.nombre}\` (${c.total} archivos)\n\n| Estado | Archivo | Título Obtenido |\n|---|---|---|\n`;
    for (const f of c.filas) {
      const t = f.titulo.replace(/\|/g, '-');
      md += `| ${ICONO[f.estado]} | \`${f.fileName}\` | ${f.estado === 'detectado' ? `**${t}**` : `*${f.estado === 'error' ? `Error: ${t}` : t}*`} |\n`;
    }
    md += `\n*Tasa de detección en esta subcarpeta: **${c.folderDetected}/${c.total} (${pct(c.folderDetected, c.total)}%)***\n\n---\n\n`;
  }
  md += `## 📊 Resumen Global\n\n- **Total de Papers analizados**: ${r.totalProcessed}\n`;
  md += `- **Títulos detectados en portada / pág 1**: ${r.totalDetected} (${pct(r.totalDetected, r.totalProcessed)}%)\n`;
  md += `- **Títulos asignados por fallback limpio**: ${r.totalFallback} (${pct(r.totalFallback, r.totalProcessed)}%)\n`;
  return md;
}

const args = process.argv.slice(2);
const rootDir = args.find(a => !a.startsWith('--'));
if (!rootDir) {
  console.error('Uso: node scripts/evaluar_titulos_papers.js <directorio> [--markdown [salida.md]]');
  process.exit(1);
}
const iMd = args.indexOf('--markdown');
const resultado = await evaluar(rootDir);
if (iMd === -1) {
  aConsola(resultado);
} else {
  const salida = args[iMd + 1] && !args[iMd + 1].startsWith('--') ? args[iMd + 1] : 'pruebas/reporte_titulos_papers.md';
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  fs.writeFileSync(salida, aMarkdown(resultado), 'utf-8');
  console.log(`Reporte generado en ${salida}`);
}
