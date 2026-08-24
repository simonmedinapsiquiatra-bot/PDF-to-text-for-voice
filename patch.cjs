const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

// 1. fetchGeminiConCache changes
const fetchTarget = `
      const payloadString = JSON.stringify(payload);
      const hash = await hashText(payloadString);
      
      const cachedResponse = await getFromCache(hash);
      if (cachedResponse) {`;
const fetchReplacement = `
      const ignoreCache = payload.ignoreCache === true;
      delete payload.ignoreCache;
      const payloadString = JSON.stringify(payload);
      const hash = await hashText(payloadString);
      
      if (!ignoreCache) {
          const cachedResponse = await getFromCache(hash);
          if (cachedResponse) {`;
code = code.replace(fetchTarget, fetchReplacement);

const fetchTarget2 = `
        return {
          text: cachedResponse,
          provider: 'caché',
          modelUsed: 'IndexedDB'
        };
      }`;
const fetchReplacement2 = `
        return {
          text: cachedResponse,
          provider: 'caché',
          modelUsed: 'IndexedDB'
        };
      }
      }`;
code = code.replace(fetchTarget2, fetchReplacement2);

// 2. Call sites
code = code.replace(
    /model: getStoredModel\(\)\s*\}\, \`\$\{fileObj\.name\}/g,
    "model: getStoredModel(),\n                ignoreCache: fileObj.ignoreCache\n              }, `${fileObj.name}"
);

code = code.replace(
    /preferredProvider: preferredProvider\s*\}\, fileObj\.name\);/g,
    "preferredProvider: preferredProvider,\n                ignoreCache: fileObj.ignoreCache\n              }, fileObj.name);"
);

// 3. New reprocesar function
const reprocesarFunc = `
    (window as any).reprocesarArchivoCompleto = async function(fileId: string) {
       const fileObj = loadedFiles.find((f: any) => f.id === fileId);
       if (!fileObj) return;
       
       if (!confirm('¿Seguro que deseas reprocesar este archivo localmente y forzar el análisis de IA desde cero (ignorando la caché previa)?')) return;
       
       fileObj.status = 'loading';
       fileObj.localProgress = 0;
       fileObj.aiProgress = 0;
       fileObj.localText = '';
       fileObj.localTextPure = '';
       fileObj.aiText = '';
       fileObj.aiChunks = [];
       fileObj.ignoreCache = true;
       
       renderFileCard(fileObj);
       
       if (fileObj.name.toLowerCase().endsWith('.epub')) {
           await procesarEpubLocal(fileObj);
       } else {
           await procesarArchivoLocal(fileObj);
       }
    };
`;

code = code.replace('    function renderFileCard(fileObj) {', reprocesarFunc + '\n    function renderFileCard(fileObj) {');

// 4. Update the renderFileCard buttons.

const btnReprocesar = `
              <button onclick="reprocesarArchivoCompleto('\${fileObj.id}')" class="flex-1 sm:flex-none px-2 py-2.5 sm:py-2 text-[11px] sm:text-xs font-semibold bg-amber-600/90 hover:bg-amber-500 text-white border border-amber-500/40 rounded-xl sm:rounded-lg flex items-center justify-center gap-1 shadow-md touch-press cursor-pointer" title="Borrar caché y reiniciar local+IA">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Reprocesar
              </button>`;

const targetExtractedBtn = `                Limpiar Manual
              </button>
            </div>
          </div>
        \`;
      }
      else if (fileObj.status === 'processing_ai') {`;

const repExtractedBtn = `                Limpiar Manual
              </button>${btnReprocesar}
            </div>
          </div>
        \`;
      }
      else if (fileObj.status === 'processing_ai') {`;

code = code.replace(targetExtractedBtn, repExtractedBtn);

const targetCompletedBtn = `                Limpiar Original
              </button>
            </div>
          </div>
        \`;
      }
      else if (fileObj.status === 'error') {`;

const repCompletedBtn = `                Limpiar Original
              </button>${btnReprocesar}
            </div>
          </div>
        \`;
      }
      else if (fileObj.status === 'error') {`;

code = code.replace(targetCompletedBtn, repCompletedBtn);

fs.writeFileSync('src/main.ts', code);
