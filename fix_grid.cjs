const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

code = code.replace(
    '<div class="grid grid-cols-3 sm:flex gap-2 w-full sm:w-auto">',
    '<div class="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">'
);

fs.writeFileSync('src/main.ts', code);
