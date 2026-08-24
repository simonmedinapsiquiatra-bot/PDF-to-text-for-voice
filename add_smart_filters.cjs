const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

const newCode = `
    let globalSmartFilters: string[] = [];
    let detectedSmartFilters: string[] = [];

    (window as any).escanearFiltrosInteligentes = function() {
        const container = document.getElementById('smartFiltersContainer');
        if (!container) return;
        
        let allRepeated: Record<string, number> = {};
        let hasText = false;

        loadedFiles.forEach(file => {
            if (file.localText) {
                hasText = true;
                const lines = file.localText.split('\\n');
                for (let line of lines) {
                    const clean = line.trim();
                    // Consider lines that are somewhat meaningful: e.g. "Boberg et al."
                    // Not just single characters or numbers
                    if (clean.length > 8 && clean.split(' ').length >= 2 && !/^\\d+$/.test(clean)) {
                        allRepeated[clean] = (allRepeated[clean] || 0) + 1;
                    }
                }
            }
        });

        if (!hasText) {
            container.innerHTML = '<span class="text-[11px] text-slate-500 italic">No hay textos locales extraídos aún.</span>';
            return;
        }

        const repeatedList = Object.entries(allRepeated)
            .filter(([text, count]) => count >= 2 && count <= 500) // repeated at least twice
            .sort((a, b) => b[1] - a[1]);

        if (repeatedList.length === 0) {
            container.innerHTML = '<span class="text-[11px] text-slate-500 italic">No se detectaron patrones repetitivos.</span>';
            return;
        }

        detectedSmartFilters = repeatedList.map(r => r[0]).slice(0, 50); // top 50
        
        // Clean out globalSmartFilters that don't make sense anymore? Keep them if they are selected.
        
        renderSmartFilters();
    };

    function renderSmartFilters() {
        const container = document.getElementById('smartFiltersContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        const allFiltersToRender = Array.from(new Set([...detectedSmartFilters, ...globalSmartFilters]));

        allFiltersToRender.forEach(filterText => {
            const isActive = globalSmartFilters.includes(filterText);
            
            const btn = document.createElement('button');
            btn.className = \`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors border \${
                isActive 
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }\`;
            
            btn.innerHTML = isActive 
                ? \`<span class="flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> \${filterText.length > 40 ? filterText.substring(0, 40) + '...' : filterText}</span>\`
                : filterText.length > 40 ? filterText.substring(0, 40) + '...' : filterText;
                
            btn.title = filterText;
            btn.onclick = () => {
                if (isActive) {
                    globalSmartFilters = globalSmartFilters.filter(f => f !== filterText);
                } else {
                    globalSmartFilters.push(filterText);
                }
                renderSmartFilters();
            };
            container.appendChild(btn);
        });
    }

    // Config modal opener tweak to render existing filters
    const originalOpenConfigModal = (window as any).openConfigModal;
    (window as any).openConfigModal = function() {
        if (originalOpenConfigModal) originalOpenConfigModal();
        if (detectedSmartFilters.length === 0 && globalSmartFilters.length > 0) {
            renderSmartFilters();
        }
    };
`;

code = code.replace('let logOutput = "";', newCode + '\\nlet logOutput = "";');
fs.writeFileSync('src/main.ts', code);
