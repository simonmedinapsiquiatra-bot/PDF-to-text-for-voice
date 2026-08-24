const fs = require('fs');
let code = fs.readFileSync('api/gemini.ts', 'utf8');

code = code.replace(
    '\\n- Bibliografía',
    '\n- Bibliografía'
).replace(
    '\\n- Sin HTML',
    '\n- Sin HTML'
);

fs.writeFileSync('api/gemini.ts', code);
