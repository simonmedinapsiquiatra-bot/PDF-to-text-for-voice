---
name: web-worker-spellchecker
description: Manages non-blocking Hunspell / Typo.js spellchecking in secondary threads.
---

# Web Worker Spellchecker Skill

## Target Modules
- `src/hunspellWorker.ts`
- `public/dictionaries/`

## Key Rules
1. **Non-blocking Execution**:
   - Heavy string diffs or Typo.js spellchecking MUST run inside `hunspellWorker.ts` to prevent UI lag.
2. **Lazy Loading**:
   - `.aff` and `.dic` dictionary files must be loaded asynchronously on demand based on `autodetectarLenguaje`.
