---
name: dr-media-integrity-audit
description: Audits text processing to prevent accidental deletion of critical narrative or medical content. Compares raw extracted text against cleaned/AI output using word ratios, diff tracking, and medical entity preservation checks. Use when modifying textCleaner.ts, gemini.ts, or adding new regex/cleaning filters.
---

# Dr. Media - Text Integrity & Diff Audit Skill

## Objective
Ensure that local cleaning (Regex) and AI transformations (Gemini) NEVER drop core narrative sentences, clinical dosages, or critical concepts without logging an audit trace.

## Key Integrity Rules
1. **Word-Count Anomaly Detection**:
   - If a processing step reduces the total word count of a chunk by **> 30%** (excluding known reference/appendix blocks), trigger a `WARNING_HIGH_TRUNCATION` flag.
2. **Medical & Entity Preservation**:
   - Verify that numbers, dosage units (`mg`, `mcg`, `ml`), and specialized terms present in the raw input are accounted for in the output.
3. **Audit Delta Trace**:
   - Store both `raw_chunk` and `processed_chunk` in IndexedDB alongside a calculated Diff summary.
   - Do not overwrite original text in the database; always maintain a bi-directional map (Pure vs. Cleaned).
