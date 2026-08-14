---
name: pdf-layout-reconstruction
description: Rules and guidelines for modifying PDF extraction, 2-column detection, and spatial layout reconstruction in Dr. Media.
---

# PDF Layout & Column Reconstruction Skill

## Target Modules
- `src/main.ts` (`extraerTextoDePagina`, `reconstructColumnText`, `extraerCapitulos`)
- `src/utils/pdfExtractor.ts`

## Key Rules
1. **Column Detection Integrity**:
   - Always evaluate horizontal `x` coordinates and gutter margins before concatenating text.
   - Maintain the threshold check (<15% center-crossing lines) to avoid mixing left and right column phrases during TTS reading.
2. **Table & Reference Stripping**:
   - Keep local extraction fast by omitting structural tables (`omitirTablasLocal`) and long citation sections (`removerReferenciasYAutores`).
3. **Types & Coordinates**:
   - Do not break PDF.js `TextItem` coordinate mapping when transforming fragment arrays.
