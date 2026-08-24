const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

const targetStr = `async function iniciarIAEspecifico(fileId: string) {
      const fileObj = loadedFiles.find(f => f.id === fileId);
      if (!fileObj || fileObj.status !== 'extracted') return;
      
      fileIdParaModalIA = fileId;`;

const newStr = `async function iniciarIAEspecifico(fileId: string) {
      const fileObj = loadedFiles.find(f => f.id === fileId);
      if (!fileObj || fileObj.status !== 'extracted') return;
      
      fileIdParaModalIA = fileId;
      const forceReprocessEl = document.getElementById('aiForceReprocess') as HTMLInputElement;
      if (forceReprocessEl) forceReprocessEl.checked = false;`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('src/main.ts', code);
