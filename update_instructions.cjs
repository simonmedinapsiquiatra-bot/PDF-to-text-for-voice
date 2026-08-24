const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldInstructions = `            <!-- Función 5 -->
            <div class="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 flex gap-3 transition-all duration-300 hover:border-slate-700/60">
              <div class="mt-0.5 h-8 w-8 bg-pink-500/10 text-pink-400 rounded-lg flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </div>
              <div>
                <h5 class="text-xs sm:text-sm font-bold text-slate-200">5. Detección de Capítulos y Pausas TTS</h5>`;

const newInstructions = `            <!-- Función 5: Limpieza Manual e Inteligente -->
            <div class="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 flex gap-3 transition-all duration-300 hover:border-slate-700/60">
              <div class="mt-0.5 h-8 w-8 bg-rose-500/10 text-rose-400 rounded-lg flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h5 class="text-xs sm:text-sm font-bold text-slate-200">5. Limpieza Manual y Filtros Inteligentes</h5>
                <p class="text-xs text-slate-400 mt-1 leading-relaxed">
                  Puedes borrar frases repetitivas a mano seleccionándolas del "Original", o usar los Filtros Inteligentes (en Configuración API) para auto-detectar y purgar autores y ruido antes de procesar con IA.
                </p>
              </div>
            </div>

            <!-- Función 6: Proceso de IA -->
            <div class="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 flex gap-3 transition-all duration-300 hover:border-slate-700/60">
              <div class="mt-0.5 h-8 w-8 bg-pink-500/10 text-pink-400 rounded-lg flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h5 class="text-xs sm:text-sm font-bold text-slate-200">6. Fases de Progreso de IA</h5>
                <p class="text-xs text-slate-400 mt-1 leading-relaxed">
                  El procesamiento de IA se divide en: Transcripción por bloques (0-80%), Revisión de fronteras entre bloques (80-85%) y Corrección contextual final (85-100%). La barra es 100% proporcional.
                </p>
              </div>
            </div>

            <!-- Función 7 -->
            <div class="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 flex gap-3 transition-all duration-300 hover:border-slate-700/60">
              <div class="mt-0.5 h-8 w-8 bg-purple-500/10 text-purple-400 rounded-lg flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </div>
              <div>
                <h5 class="text-xs sm:text-sm font-bold text-slate-200">7. Detección de Capítulos y Pausas TTS</h5>`;

html = html.replace(oldInstructions, newInstructions);
fs.writeFileSync('index.html', html);
