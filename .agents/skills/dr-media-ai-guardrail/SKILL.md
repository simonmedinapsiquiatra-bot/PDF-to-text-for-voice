---
name: dr-media-ai-guardrail
description: Enforces structured AI audit responses and validation checks on Gemini outputs to detect text omissions or unwanted modifications. Use when updating prompts in api/gemini.ts or handling AI responses in src/main.ts.
---

# Dr. Media - AI Guardrail & Self-Audit Skill

## Objective
Utilize a lightweight verification step or structured JSON schema to make Gemini report *what* it removed or modified during restructuring.

## Operational Rules
1. **Structured Audited Output**:
   - When requesting structural cleanup from Gemini, enforce a JSON output contract:
     ```json
     {
       "adapted_text": "Texto procesado para TTS...",
       "removed_elements": ["Bibliografía pág 12", "Tabla 2 de datos estáticos"],
       "flagged_omissions": []
     }
     ```
2. **Validation Loop**:
   - If `flagged_omissions` contains non-structural text, automatically flag the chunk in the UI so the user can review the Diff before exporting to EPUB/TXT.
