const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

const newFunctions = `
    let fileIdParaLimpieza: string | null = null;

    (window as any).abrirLimpiezaManual = function(fileId: string) {
        const fileObj = loadedFiles.find(f => f.id === fileId);
        if (!fileObj || !fileObj.localText) return;
        fileIdParaLimpieza = fileId;
        const modal = document.getElementById('manualCleanupModal');
        const textarea = document.getElementById('cleanupTextarea') as HTMLTextAreaElement;
        const input = document.getElementById('cleanupTextInput') as HTMLInputElement;

        if (input) input.value = '';
        if (textarea) {
            textarea.value = fileObj.localText;
            textarea.onmouseup = textarea.ontouchend = () => {
                const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
                if (selected && selected.trim()) {
                    input.value = selected;
                }
            };
        }
        if (modal) modal.classList.remove('hidden');
    };

    (window as any).cerrarLimpiezaManual = function() {
        const modal = document.getElementById('manualCleanupModal');
        if (modal) modal.classList.add('hidden');
        fileIdParaLimpieza = null;
    };

    (window as any).ejecutarLimpiezaManual = function() {
        if (!fileIdParaLimpieza) return;
        const fileObj = loadedFiles.find(f => f.id === fileIdParaLimpieza);
        if (!fileObj) return;

        const input = document.getElementById('cleanupTextInput') as HTMLInputElement;
        const textToRemove = input ? input.value : '';
        if (!textToRemove) return;

        const textarea = document.getElementById('cleanupTextarea') as HTMLTextAreaElement;
        let currentText = fileObj.localText;

        const escapeRegExp = (string: string) => string.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
        const regex = new RegExp(escapeRegExp(textToRemove), 'g');

        const matchCount = (currentText.match(regex) || []).length;
        if (matchCount === 0) {
            alert('No se encontraron coincidencias exactas para eliminar en el texto local.\\nAsegúrate de seleccionar el texto exactamente como aparece.');
            return;
        }

        // Apply replacement
        fileObj.localText = currentText.replace(regex, '');
        if (textarea) textarea.value = fileObj.localText;
        if (input) input.value = '';

        // Invalidate AI cache since source text changed
        if (fileObj.aiChunks && fileObj.aiChunks.length > 0) {
            fileObj.aiChunks = [];
            log(\`[\${fileObj.name}] Memoria de bloques borrada debido a cambios manuales en el texto original.\`, 'warning');
        }

        alert(\`Éxito: Se eliminaron \${matchCount} apariciones de la selección en todo el documento.\`);
    };

    function verTextoEspecifico(fileId, tipo) {`;

code = code.replace('    function verTextoEspecifico(fileId, tipo) {', newFunctions);
fs.writeFileSync('src/main.ts', code);
