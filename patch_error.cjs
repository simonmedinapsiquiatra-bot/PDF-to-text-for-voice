const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

const errorTarget = `      else if (fileObj.status === 'error') {
        statusHtml = \`<span class="text-[11px] sm:text-xs font-semibold text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full border border-red-400/20">Error</span>\`;
        
      }`;

const errorReplacement = `      else if (fileObj.status === 'error') {
        statusHtml = \`<span class="text-[11px] sm:text-xs font-semibold text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full border border-red-400/20">Error</span>\`;
        actionsHtml = \`
          <div class="mt-4 flex pt-3 border-t border-slate-800/80">
              <button onclick="reprocesarArchivoCompleto('\${fileObj.id}')" class="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-[11px] sm:text-xs font-semibold bg-amber-600/90 hover:bg-amber-500 text-white border border-amber-500/40 rounded-xl sm:rounded-lg flex items-center justify-center gap-1 shadow-md touch-press cursor-pointer" title="Reintentar desde cero">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Reprocesar archivo
              </button>
          </div>
        \`;
      }`;

code = code.replace(errorTarget, errorReplacement);
fs.writeFileSync('src/main.ts', code);
