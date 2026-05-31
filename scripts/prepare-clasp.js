import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const distDir = path.join(root, 'dist');
const serverDir = path.join(root, 'server');
const oldClaspDir = path.join(root, 'dist-clasp');

// 1. Eliminar la carpeta obsoleta dist-clasp para mantener limpio el entorno
if (fs.existsSync(oldClaspDir)) {
  try {
    fs.rmSync(oldClaspDir, { recursive: true, force: true });
    console.log('🧹 Carpeta obsoleta dist-clasp eliminada con éxito.');
  } catch (err) {
    console.warn('⚠️ No se pudo eliminar dist-clasp automáticamente:', err.message);
  }
}

// 2. Renombrar index.html a Index.html en dist/ (requerido por Google Apps Script)
// En sistemas Windows (insensibles a mayúsculas), realizamos un renombrado intermedio para forzar el cambio de casing
const indexSrc = path.join(distDir, 'index.html');
const indexDest = path.join(distDir, 'Index.html');
const tempDest = path.join(distDir, 'temp_build_entry.html');

if (fs.existsSync(indexSrc)) {
  try {
    // Si ya existe Index.html, lo eliminamos
    if (fs.existsSync(indexDest) && indexSrc.toLowerCase() !== indexDest.toLowerCase()) {
      fs.unlinkSync(indexDest);
    }
    // Renombrado seguro de dos pasos para forzar casing
    fs.renameSync(indexSrc, tempDest);
    fs.renameSync(tempDest, indexDest);
    console.log('✅ Renombrado seguro dist/index.html a dist/Index.html (caso corregido)');
  } catch (err) {
    console.error('❌ Error al renombrar el archivo entry:', err.message);
    process.exit(1);
  }
} else if (!fs.existsSync(indexDest)) {
  console.error('❌ Error: No se encontró dist/index.html ni dist/Index.html. Ejecuta vite build primero.');
  process.exit(1);
}

// 3. Copiar los archivos del servidor (Code.gs, appsscript.json) directamente a dist/
const serverFiles = fs.readdirSync(serverDir);
for (const file of serverFiles) {
  const src = path.join(serverDir, file);
  const dest = path.join(distDir, file);
  if (fs.lstatSync(src).isFile()) {
    fs.copyFileSync(src, dest);
    console.log(`✅ Copiado server/${file} a dist/${file}`);
  }
}

console.log('🚀 Preparación para Clasp completada directamente en dist/. Listo para clasp push.');
