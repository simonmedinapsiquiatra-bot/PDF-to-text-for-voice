---
name: dr-media-pdf-to-voice
description: Extracts text from PDF files in a directory, cleans the text using Dr. Media logic, and adapts it for Text-To-Speech (TTS) using AI. Use when the user asks to process PDFs for voice, run Dr. Media, or convert PDF to TTS.
---

# Dr. Media PDF to Voice Pipeline

This skill automates the extraction and cleaning of PDF documents to prepare them for Text-to-Speech (TTS) reading. 
It uses a multi-threaded Python script that applies deterministic cleaning (regex) and AI-based semantic adaptation.

## Usage Instructions

When the user asks you to process PDFs for TTS or run the Dr. Media pipeline:

1. **Identify the target folder**: Ask the user for the absolute path of the folder containing the PDFs they want to process.
2. **Verify prerequisites**: Ensure the `uv` tool is available. If not, use the `uv` skill to install it.
3. **Check API Keys**: Ensure you have API keys for Gemini, Groq, or OpenRouter in the environment variables (e.g. `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`). If none are available, ask the user to provide at least one, or use the `credentials` skill.
4. **Execute the pipeline**: Run the provided python script using `uv run` to ensure dependencies are isolated and handled automatically.

### Running the script

Use the `run_command` tool to execute the pipeline:

```bash
# Provide the absolute path to the folder as the argument
uv run scripts/dr_media_pipeline.py "C:\path\to\pdf\folder"
```

## How it works
The script (`scripts/dr_media_pipeline.py`) does the following:
1. Installs required dependencies via `uv` PEP 723 inline metadata (`pymupdf`, `requests`, `tqdm`).
2. Scans the provided folder for `.pdf` files.
3. Extracts text using PyMuPDF and applies Dr. Media's deterministic regex cleaning (removes citations, URLs, formats, ligatures).
4. Splits the text into chunks of ~1500 words.
5. Uses a concurrent thread pool to send chunks to AI APIs (Gemini, Groq, OpenRouter) for TTS semantic adaptation.
6. Saves the final result as `<pdf_name>_tts.txt` alongside the original PDF.
