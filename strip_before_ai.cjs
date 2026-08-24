const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

const targetStr = `if (fileObj.isDigital && fileObj.rawPagesData) {
          const selectedRawPages = fileObj.rawPagesData.filter((p: any) => selectedPages.includes(p.pageNum));
          let paginasLimpias = selectedRawPages.map((p: any) => limpiarTextoLocal(p.text));
          let docText = paginasLimpias.join('\\n\\n--- PAGE_BREAK ---\\n\\n');
          docText = removerReferenciasYAutores(docText);
          fileObj.pagesData = docText.split('\\n\\n--- PAGE_BREAK ---\\n\\n');
       }`;

const newStr = `if (fileObj.isDigital && fileObj.rawPagesData) {
          const selectedRawPages = fileObj.rawPagesData.filter((p: any) => selectedPages.includes(p.pageNum));
          let paginasLimpias = selectedRawPages.map((p: any) => limpiarTextoLocal(p.text));
          let docText = paginasLimpias.join('\\n\\n--- PAGE_BREAK ---\\n\\n');
          docText = removerReferenciasYAutores(docText);
          // Eliminar filtros inteligentes ANTES de enviar a la IA
          docText = aplicarFiltrosInteligentesAlTexto(docText);
          fileObj.pagesData = docText.split('\\n\\n--- PAGE_BREAK ---\\n\\n');
       }`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('src/main.ts', code);
