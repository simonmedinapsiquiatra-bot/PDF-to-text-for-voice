
```notebook-python
# ==============================================================================
# DR. MEDIA V4.4 PRO - TURBO SPEED & LATENCY OPTIMIZATION
# ==============================================================================
# !pip install -q pymupdf requests torch transformers accelerate bitsandbytes tqdm

import os
import re
import glob
import json
import time
import unicodedata
import warnings
import concurrent.futures
import threading
from typing import List, Dict, Any, Optional
import requests
import fitz  # PyMuPDF
from tqdm.auto import tqdm
from google.colab import drive, userdata

DEBUG_FOLDER = "/content/debug_blocks"
os.makedirs(DEBUG_FOLDER, exist_ok=True)

warnings.filterwarnings("ignore")
os.environ["TRANSFORMERS_VERBOSITY"] = "error"

model_lock = threading.Lock()
print_lock = threading.Lock()

drive.mount('/content/drive', force_remount=True)
FOLDER_PATH = "/content/drive/MyDrive/Colab Notebooks/textos e"

def get_colab_key(key_name: str) -> str:
    try:
        val = userdata.get(key_name)
        return val if val else ""
    except Exception: return os.getenv(key_name, "")

GEMINI_KEY = get_colab_key('GEMINI_API_KEY')
GROQ_KEY = get_colab_key('GROQ_API_KEY')
OPENROUTER_KEY = get_colab_key('OPENROUTER_API_KEY')

# Priorizamos modelos 'Flash' y 'Lite' para mínima latencia
PROVIDERS = [
    {"name": "gemini", "type": "api", "key": GEMINI_KEY, "models": ["gemini-2.0-flash-lite", "gemini-1.5-flash-8b"]},
    {"name": "groq", "type": "api", "key": GROQ_KEY, "models": ["llama-3.3-70b-specdec", "llama-3.1-8b-instant"]},
    {"name": "openrouter", "type": "api", "key": OPENROUTER_KEY, "models": ["google/gemini-2.0-flash-lite-preview-02-05:free"]}
]

_LOCAL_PIPE = None

def get_local_pipe():
    global _LOCAL_PIPE
    with model_lock:
        if _LOCAL_PIPE is None:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
            model_name = "Qwen/Qwen2.5-1.5B-Instruct"
            tokenizer = AutoTokenizer.from_pretrained(model_name, clean_up_tokenization_spaces=False)
            model = AutoModelForCausalLM.from_pretrained(model_name, torch_dtype=torch.float16, device_map="auto")
            _LOCAL_PIPE = pipeline("text-generation", model=model, tokenizer=tokenizer)
    return _LOCAL_PIPE

def chat_local(prompt: str, system_prompt: str) -> str:
    pipe = get_local_pipe()
    messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}]
    # Parámetros optimizados para velocidad de inferencia
    out = pipe(messages, max_new_tokens=1200, do_sample=False, pad_token_id=pipe.tokenizer.eos_token_id)
    return out[0]['generated_text'][-1]['content'].strip()

def extraer_texto_pdf(pdf_path: str) -> str:
    texto = []
    with fitz.open(pdf_path) as doc:
        for page in doc:
            texto.append(page.get_text("text"))
    return "\n\n".join(texto)

def dividir_en_bloques(texto: str, palabras_max: int = 1000) -> List[str]:
    words = texto.split()
    return [" ".join(words[i:i+palabras_max]) for i in range(0, len(words), palabras_max)]

SYSTEM_PROMPT = "Limpia este texto para TTS: sin citas, bibliografía ni notas. JSON: {\"adapted_text\": \"...\"}"

def sanitize_json(raw: str) -> str:
    try:
        cleaned = re.sub(r"^```json\s*|\s*```$", "", raw.strip(), flags=re.I)
        return json.loads(cleaned).get("adapted_text", raw)
    except: return raw

def call_api(provider: dict, prompt: str, system: str) -> Optional[str]:
    if not provider.get("key"): return None
    try:
        if provider["name"] == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{provider['models'][0]}:generateContent?key={provider['key']}"
            # Timeout agresivo para no bloquear el flujo
            r = requests.post(url, json={"contents": [{"parts": [{"text": f"{system}\n\n{prompt}"}]}], "generationConfig": {"responseMimeType": "application/json"}}, timeout=15)
            if r.status_code == 200: return r.json()['candidates'][0]['content']['parts'][0]['text']
        else:
            endpoint = "https://api.groq.com/openai/v1/chat/completions" if provider["name"] == "groq" else "https://openrouter.ai/api/v1/chat/completions"
            headers = {"Authorization": f"Bearer {provider['key']}"}
            payload = {"model": provider['models'][0], "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}], "response_format": {"type": "json_object"}}
            r = requests.post(endpoint, headers=headers, json=payload, timeout=15)
            if r.status_code == 200: return r.json()['choices'][0]['message']['content']
    except: pass
    return None

def chat_hibrido(message: str, system_prompt: str, b_idx: int, pdf_name: str) -> str:
    for p in PROVIDERS:
        res = call_api(p, message, system_prompt)
        if res: return sanitize_json(res)
    try:
        return chat_local(message, system_prompt)
    except:
        debug_path = os.path.join(DEBUG_FOLDER, f"FAIL_{b_idx}.txt")
        with open(debug_path, "w") as f: f.write(message)
        return "[ERROR]"

def procesar_un_bloque(indice: int, bloque: str, pdf_name: str) -> tuple:
    return indice, chat_hibrido(bloque, SYSTEM_PROMPT, indice, pdf_name)

def procesar_carpeta(folder_path: str):
    pdfs = glob.glob(os.path.join(folder_path, "*.pdf"))
    for pdf in pdfs:
        out_path = pdf.replace(".pdf", "_tts.txt")
        if os.path.exists(out_path): continue

        pdf_name = os.path.basename(pdf)
        print(f"📄 {pdf_name}")
        bloques = dividir_en_bloques(extraer_texto_pdf(pdf))
        resultados = [None] * len(bloques)

        # Aumentamos workers a 10 para máxima concurrencia
        with tqdm(total=len(bloques), desc="Progreso") as pbar:
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                futuros = {executor.submit(procesar_un_bloque, i, b, pdf_name): i for i, b in enumerate(bloques)}
                for futuro in concurrent.futures.as_completed(futuros):
                    idx, res = futuro.result()
                    resultados[idx] = res
                    pbar.update(1)

        with open(out_path, "w", encoding="utf-8") as f: f.write("\n\n".join(filter(None, resultados)))
    print("🏁 Turbo Proceso Finalizado.")

procesar_carpeta(FOLDER_PATH)
```
