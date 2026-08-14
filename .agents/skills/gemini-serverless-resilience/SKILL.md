---
name: gemini-serverless-resilience
description: Guidelines for managing Vercel Serverless Function limits, Gemini API calls, exponential backoff, and IndexedDB caching.
---

# Gemini API & Serverless Orchestration Skill

## Target Modules
- `api/gemini.ts` (Serverless Handler)
- `src/main.ts` (`ejecutarIAFlujoTexto`, `fetchGeminiConCache`)

## Key Rules
1. **Chunking & Limits**:
   - Enforce document splitting into ~2500-word blocks to stay within Vercel execution timeouts.
2. **Caching First**:
   - Every Gemini request must query `IndexedDB` cache before initiating an HTTP fetch.
3. **Error Handling**:
   - Retries must use exponential backoff to handle HTTP 429 (Rate Limits) gracefully without failing the user's progress bar.
