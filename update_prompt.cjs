const fs = require('fs');
let code = fs.readFileSync('api/gemini.ts', 'utf8');

code = code.replace(
    '- Listas de autores y bibliografía: Elimina por completo las secciones de referencias bibliográficas al final del texto. NO elimines el nombre de los autores principales al inicio del documento.',
    `- Metadatos Académicos y Autores: Si hay una lista de autores larga, resúmela a solo el autor principal seguido de "y colaboradores" (ej. "Mateo Boberg y colaboradores"). Elimina por completo: Palabras clave (Keywords), afiliaciones institucionales, detalles de correspondencia, secciones de contribuciones de autores (Author contributions), financiación (Funding), agradecimientos (Acknowledgments), conflictos de interés (Conflict of interest), notas del editor (Publisher's note), y declaraciones sobre IA.\\n- Bibliografía: Elimina por completo las secciones de referencias bibliográficas al final del texto.\\n- Sin HTML ni código oculto: Genera SOLO texto plano legible en voz alta. Está ESTRICTAMENTE PROHIBIDO usar etiquetas HTML (como <span style="display:none">), CSS, o formatos ocultos.`
);

fs.writeFileSync('api/gemini.ts', code);
