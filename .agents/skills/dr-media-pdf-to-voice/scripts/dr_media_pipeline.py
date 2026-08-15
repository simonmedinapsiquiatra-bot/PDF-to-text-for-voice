# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pymupdf",
#     "requests",
#     "tqdm",
# ]
# ///

import os
import sys
import re
import glob
import json
import unicodedata
import concurrent.futures
from typing import List, Optional
import requests
from tqdm import tqdm

def get_api_keys():
    return {
        "gemini": os.environ.get("GEMINI_API_KEY", ""),
        "groq": os.environ.get("GROQ_API_KEY", ""),
        "openrouter": os.environ.get("OPENROUTER_API_KEY", "")
    }

PROVIDERS = [
    {"name": "gemini", "models": ["gemini-2.0-flash", "gemini-1.5-flash"]},
    {"name": "groq", "models": ["llama-3.3-70b-specdec", "llama-3.1-8b-instant"]},
    {"name": "openrouter", "models": ["google/gemini-2.0-flash-lite-preview-02-05:free", "openai/gpt-oss-120b:free"]}
]

L = r'[A-Za-záéíóúñüÁÉÍÓÚÑÜ]'
Lmin = r'[a-záéíóúñü]'

def limpiar_texto_local(texto: str) -> str:
    if not texto: return ""
    res = unicodedata.normalize('NFC', texto)
    # Unir letras separadas "P A L A B R A"
    res = re.sub(rf'(^|[^{L}])((?:{L}[\s\t]+){{2,}}{L})(?=[^{L}]|$)', lambda m: m.group(1) + re.sub(r'[\s\t]+', '', m.group(2)), res)
    # Ligaduras
    for lig, rep in {'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl'}.items(): res = res.replace(lig, rep)
    # Guiones salto de línea
    res = re.sub(rf'({L})\s*-\s*\n\s*({L})', r'\1\2', res)
    res = re.sub(rf'({L})\s*-\s+({Lmin})', r'\1\2', res)
    # Citas APA y números
    res = re.sub(r'\((?:[A-ZÁÉÍÓÚÑüÜa-záéíóúñüÜ\s&.,;\-]|et\s+al\.)+,\s*\d{4}[a-z]?\)', '', res)
    res = re.sub(r'\[\d+(?:\s*[–,\-]\s*\d+)*\]', '', res)
    res = re.sub(r'\(\d+(?:\s*[–,\-]\s*\d+)*\)', '', res)
    # URLs
    res = re.sub(r'https?://\S+', '', res, flags=re.IGNORECASE)
    res = re.sub(r'www\.\S+', '', res, flags=re.IGNORECASE)
    res = re.sub(r'[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}', '', res)
    # Ver figura
    res = re.sub(r'\(\s*(?:Ver|Véase|véase|ver)?\s*(?:Figura|Tabla|Gráfico|Ilustración)\s+[\d\s]+\s*\)', '', res, flags=re.IGNORECASE)
    # Formato y espacios redundantes
    res = re.sub(r'[ \t]+', ' ', res)
    res = re.sub(r'^ +| +$', '', res, flags=re.MULTILINE)
    res = re.sub(r'\n{3,}', '\n\n', res)
    return res.strip()

def extraer_texto_pdf(pdf_path: str) -> str:
    import fitz
    texto = []
    with fitz.open(pdf_path) as doc:
        for page in doc:
            texto.append(limpiar_texto_local(page.get_text("text")))
    return "\n\n".join(texto)

def dividir_en_bloques(texto: str, palabras_max: int = 1500) -> List[str]:
    words = texto.split()
    return [" ".join(words[i:i+palabras_max]) for i in range(0, len(words), palabras_max)]

SYSTEM_PROMPT = """Actúa como un procesador de texto avanzado diseñado para optimizar documentos para sistemas Text-to-Speech (TTS). 
Genera un texto fluido y de fácil escucha. Convierte números romanos a texto, integra notas al pie, expande abreviaturas y resume tablas. 
Entrega ESTRICTAMENTE JSON: {"adapted_text": "..."}"""

def sanitize_json(raw: str) -> str:
    try:
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.I)
        return json.loads(cleaned).get("adapted_text", raw)
    except: return raw

def call_api(provider: dict, keys: dict, prompt: str, system: str) -> Optional[str]:
    key = keys.get(provider["name"])
    if not key: return None
    for attempt in range(2):
        try:
            if provider["name"] == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{provider['models'][0]}:generateContent?key={key}"
                r = requests.post(url, json={"contents": [{"parts": [{"text": f"{system}\n\n{prompt}"}]}], "generationConfig": {"responseMimeType": "application/json"}}, timeout=30)
                if r.status_code == 200: return r.json()['candidates'][0]['content']['parts'][0]['text']
                elif r.status_code == 429: time.sleep(4)
            else:
                endpoint = "https://api.groq.com/openai/v1/chat/completions" if provider["name"] == "groq" else "https://openrouter.ai/api/v1/chat/completions"
                headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
                payload = {"model": provider['models'][0], "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}], "response_format": {"type": "json_object"}}
                r = requests.post(endpoint, headers=headers, json=payload, timeout=30)
                if r.status_code == 200: return r.json()['choices'][0]['message']['content']
                elif r.status_code == 429: time.sleep(4)
        except Exception as e: 
            print(f"Error calling {provider['name']}: {e}")
            break
    return None

def chat_hibrido(message: str, system_prompt: str, keys: dict) -> str:
    for p in PROVIDERS:
        res = call_api(p, keys, message, system_prompt)
        if res: return sanitize_json(res)
    return f"[ERROR: No API providers available or all failed]\n\n{message}"

def procesar_un_bloque(indice: int, bloque: str, keys: dict) -> tuple:
    return indice, chat_hibrido(bloque, SYSTEM_PROMPT, keys)

def main():
    if len(sys.argv) < 2:
        print("Usage: uv run dr_media_pipeline.py <folder_path>")
        sys.exit(1)
        
    folder_path = sys.argv[1]
    if not os.path.isdir(folder_path):
        print(f"Error: {folder_path} is not a valid directory.")
        sys.exit(1)
        
    keys = get_api_keys()
    if not any(keys.values()):
        print("Warning: No API keys found (GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY). Processing will likely fail.")

    pdfs = glob.glob(os.path.join(folder_path, "*.pdf")) + glob.glob(os.path.join(folder_path, "*.PDF"))
    pdfs = list(dict.fromkeys(pdfs))
    
    if not pdfs:
        print(f"No PDF files found in {folder_path}")
        return
        
    print(f"Found {len(pdfs)} PDFs to process.")
    
    for idx, pdf in enumerate(pdfs, 1):
        out_path = pdf.rsplit('.', 1)[0] + "_tts.txt"
        if os.path.exists(out_path):
            print(f"[{idx}/{len(pdfs)}] Skipping (already processed): {os.path.basename(pdf)}")
            continue
            
        print(f"[{idx}/{len(pdfs)}] Processing: {os.path.basename(pdf)}")
        texto_puro = extraer_texto_pdf(pdf)
        bloques = dividir_en_bloques(texto_puro, 1500)
        
        if not bloques: continue
        resultados = [None] * len(bloques)
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futuros = {executor.submit(procesar_un_bloque, i, b, keys): i for i, b in enumerate(bloques)}
            for futuro in tqdm(concurrent.futures.as_completed(futuros), total=len(bloques), desc="Chunks"):
                i, res = futuro.result()
                resultados[i] = res
                
        texto_final = "\n\n".join(filter(None, resultados))
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(texto_final)
            
        print(f"Saved: {os.path.basename(out_path)}")

if __name__ == "__main__":
    main()
