---
name: tts-linguistic-normalizer
description: Handles medical/psychiatric acronym expansion, Roman numeral conversion, Unicode NFC normalization, and TTS pronunciation fixes.
---

# TTS Linguistic Normalizer Skill

## Target Modules
- `src/utils/textCleaner.ts` (`limpiarTextoLocal`, `expandirSiglasPsiquiatria`, `numeroAPalabras`)
- `tests/reglas.test.js` & `tests/limpieza.test.js`

## Key Rules
1. **Lookbehind Safeguards**:
   - When expanding Roman numerals (I-XXX) or single-letter acronyms, always enforce negative lookbehinds/lookaheads so personal initials (e.g., `Dr. J. I. Castro`) are preserved intact.
2. **Bilingual Support**:
   - Validate terms against the auto-detected language (`es` vs `en`).
3. **Unit Test Requirement**:
   - Any new regex or acronym added to the dictionary must have a corresponding test case in `tests/reglas.test.js`.
