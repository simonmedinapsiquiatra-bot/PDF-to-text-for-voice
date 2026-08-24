const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

const targetStr = `(window as any).confirmarSeleccionIA = async function() {
       if (!fileIdParaModalIA) return;
       const targetFileId = fileIdParaModalIA;
       const fileObj = loadedFiles.find(f => f.id === targetFileId);
       if (!fileObj || fileObj.status === 'processing_ai') return;
       
       fileIdParaModalIA = null;`;

const newStr = `(window as any).confirmarSeleccionIA = async function() {
       if (!fileIdParaModalIA) return;
       const targetFileId = fileIdParaModalIA;
       const fileObj = loadedFiles.find(f => f.id === targetFileId);
       if (!fileObj || fileObj.status === 'processing_ai') return;
       
       fileIdParaModalIA = null;
       
       const forceReprocessEl = document.getElementById('aiForceReprocess') as HTMLInputElement;
       if (forceReprocessEl && forceReprocessEl.checked) {
           log(\`[\${fileObj.name}] Ignorando caché previo por solicitud del usuario...\`);
           await clearAllCache();
           if (fileObj.aiChunks) {
              for (const chunk of fileObj.aiChunks) {
                 chunk.status = 'pending';
                 chunk.textResult = '';
              }
           }
       }`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('src/main.ts', code);
