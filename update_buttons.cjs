const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

const targetStr = `<div class="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
              <button onclick="descargarLocalEspecifico('\${fileObj.id}')" class="flex-1 sm:flex-none px-3 py-2.5 sm:py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl sm:rounded-lg flex items-center justify-center gap-1.5 touch-press cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Descargar Local
              </button>
              <button onclick="verTextoEspecifico('\${fileObj.id}', 'local')" class="flex-1 sm:flex-none px-3 py-2.5 sm:py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl sm:rounded-lg flex items-center justify-center gap-1.5 touch-press cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Ver Texto
              </button>
            </div>`;

const newStr = `<div class="grid grid-cols-3 sm:flex gap-2 w-full sm:w-auto">
              <button onclick="descargarLocalEspecifico('\${fileObj.id}')" class="flex-1 sm:flex-none px-2 py-2.5 sm:py-2 text-[11px] sm:text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl sm:rounded-lg flex items-center justify-center gap-1 touch-press cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span class="hidden sm:inline">Descargar Local</span><span class="sm:hidden">Descargar</span>
              </button>
              <button onclick="verTextoEspecifico('\${fileObj.id}', 'local')" class="flex-1 sm:flex-none px-2 py-2.5 sm:py-2 text-[11px] sm:text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl sm:rounded-lg flex items-center justify-center gap-1 touch-press cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Ver Texto
              </button>
              <button onclick="abrirLimpiezaManual('\${fileObj.id}')" class="flex-1 sm:flex-none px-2 py-2.5 sm:py-2 text-[11px] sm:text-xs font-semibold bg-rose-600/90 hover:bg-rose-500 text-white border border-rose-500/40 rounded-xl sm:rounded-lg flex items-center justify-center gap-1 shadow-md touch-press cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Limpiar Manual
              </button>
            </div>`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('src/main.ts', code);
