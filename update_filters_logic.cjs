const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

const newHelper = `
    function aplicarFiltrosInteligentesAlTexto(text: string): string {
        if (!globalSmartFilters || globalSmartFilters.length === 0) return text;
        let modified = text;
        for (const filter of globalSmartFilters) {
            const escapeRegExp = (string: string) => string.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
            // Remove the exact phrase, possibly with surrounding whitespace
            const regex = new RegExp('\\n?\\s*' + escapeRegExp(filter) + '\\s*\\n?', 'gi');
            modified = modified.replace(regex, ' ');
        }
        return modified;
    }

    async function ejecutarIAFlujoTexto`;

code = code.replace('    async function ejecutarIAFlujoTexto', newHelper);

const targetText1 = `// Compilar texto final
      log(\`[\${fileObj.name}] Ensamblando y compilando transcripción optimizada final...\`);
      
      let finalAIOutput = "";
      for (const chunk of fileObj.aiChunks) {
        finalAIOutput += chunk.textResult + "\\n\\n";
      }`;

const replacementText1 = `// Compilar texto final
      log(\`[\${fileObj.name}] Ensamblando y compilando transcripción optimizada final...\`);
      
      let finalAIOutput = "";
      for (const chunk of fileObj.aiChunks) {
        finalAIOutput += chunk.textResult + "\\n\\n";
      }
      
      // Aplicar filtros inteligentes
      finalAIOutput = aplicarFiltrosInteligentesAlTexto(finalAIOutput);`;

const targetText2 = `log(\`[\${fileObj.name}] Ensamblando transcripción OCR final...\`);
      
      let transcriptText = "";
      for (const chunk of fileObj.aiChunks) {
        transcriptText += chunk.textResult + "\\n\\n";
      }`;

const replacementText2 = `log(\`[\${fileObj.name}] Ensamblando transcripción OCR final...\`);
      
      let transcriptText = "";
      for (const chunk of fileObj.aiChunks) {
        transcriptText += chunk.textResult + "\\n\\n";
      }
      
      // Aplicar filtros inteligentes
      transcriptText = aplicarFiltrosInteligentesAlTexto(transcriptText);`;

code = code.replace(targetText1, replacementText1);
code = code.replace(targetText2, replacementText2);

fs.writeFileSync('src/main.ts', code);
