# 📁 Dr. Media V5 Pro: Optimizado para Google Colab

Este script para **Google Colab** automatiza la lectura de **todos los PDFs** alojados en tu carpeta de **Google Drive**, ejecuta la limpieza de **Dr. Media** y guarda los archivos `.txt` resultantes directamente en tu Drive.

## 🚀 Novedades en V5 Pro
- **UI Interactiva**: Usa el formulario de Colab a la derecha para configurar opciones sin tocar el código.
- **Guardado Incremental**: Guarda el progreso bloque por bloque. Si Colab se desconecta por tiempo límite, no pierdes el trabajo.
- **Control de Tasa de APIs**: Ajustado para evitar bloqueos por rate-limit (Error 429) en cuentas gratuitas de Gemini/Groq.
- **Resiliencia Local Optimizada**: LLM Local (Qwen 1.5B/7B) cargado en 4-bit para evitar cuelgues (OOM) en la GPU T4 gratuita de Colab.
- **Comprobador de Hardware (GPU)**: Te avisa visualmente si estás en una sesión lenta de CPU.

---

```python
# @title 🛠️ Configuración y Ejecución de Dr. Media V5 Pro
# @markdown Configura las rutas y parámetros y luego presiona el botón de **Play** a la izquierda.

# ==============================================================================
# PARAMETROS INTERACTIVOS COLAB (Formulario)
# ==============================================================================
FOLDER_PATH = "/content/drive/MyDrive/CREACION DE APPS/PDF TEXT TO VOICE" # @param {type:"string"}
PALABRAS_POR_BLOQUE = 1500 # @param {type:"slider", min:500, max:3000, step:100}
MAX_WORKERS_API = 3 # @param {type:"slider", min:1, max:20, step:1}
# Nota: Si usas APIs gratuitas, mantener MAX_WORKERS_API entre 2 y 4 evita bloqueos por exceso de peticiones.

# ==============================================================================
# INSTALACIÓN Y DEPENDENCIAS
# ==============================================================================
import os
import sys
from IPython.display import display, HTML

def show_alert(title, msg, color="blue"):
    display(HTML(f"""
    <div style="padding:15px; margin:10px 0; border-left:5px solid {color}; background:#f9f9f9; color:#333;">
        <h4 style="margin:0 0 5px 0;">{title}</h4>
        <p style="margin:0;">{msg}</p>
    </div>
    """))

# Install quietly if not present
try:
    import fitz
    import bitsandbytes
except ImportError:
    show_alert("Instalando dependencias", "Por favor espera mientras se descargan las librerías necesarias...", "blue")
    !pip install -q pymupdf requests torch transformers accelerate bitsandbytes tqdm pydantic
    import fitz

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
import torch
from tqdm.notebook import tqdm
from google.colab import drive, userdata

warnings.filterwarnings("ignore")
os.environ["TRANSFORMERS_VERBOSITY"] = "error"

# ==============================================================================
# VALIDACIÓN DE HARDWARE (GPU)
# ==============================================================================
if not torch.cuda.is_available():
    show_alert("⚠️ GPU No Detectada", 
               "Estás ejecutando Colab en modo CPU (muy lento). Ve a <b>Entorno de ejecución > Cambiar tipo de entorno de ejecución</b> y selecciona <b>T4 GPU</b>.", 
               "red")
else:
    show_alert("✅ Hardware Óptimo", f"GPU Detectada: {torch.cuda.get_device_name(0)}.", "green")

# ==============================================================================
# MONTAJE DE DRIVE
# ==============================================================================
drive.mount('/content/drive', force_remount=True)

if not os.path.exists(FOLDER_PATH):
    show_alert("❌ Error de Ruta", f"La carpeta {FOLDER_PATH} no existe en tu Google Drive.", "red")
    raise FileNotFoundError("Revisa FOLDER_PATH en el formulario.")

# ==============================================================================
# GESTIÓN DE SECRETOS (API KEYS)
# ==============================================================================
def get_colab_key(key_name: str) -> str:
    try:
        val = userdata.get(key_name)
        return val if val else ""
    except Exception: 
        return os.getenv(key_name, "")

# Extraemos las llaves (soportando los nombres exactos de tu imagen)
GEMINI_KEY = get_colab_key('GEMINI_API_KEY') or get_colab_key('GEMINI_AI')
GROQ_KEY = get_colab_key('GROQ_API_KEY') or get_colab_key('GROQ_API')
OPENROUTER_KEY = get_colab_key('OPENROUTER_API_KEY') or get_colab_key('OPENROUTER_API') or get_colab_key('OPENROU')

missing_keys = [k for k, v in zip(["GEMINI", "GROQ", "OPENROUTER"], [GEMINI_KEY, GROQ_KEY, OPENROUTER_KEY]) if not v]
if missing_keys:
    show_alert("🔑 Faltan API Keys", 
               f"No se encontraron llaves válidas para: {', '.join(missing_keys)} en los secretos de Colab. Revisa que el 'Acceso desde el notebook' esté activado.", 
               "orange")

# Priorizamos modelos 'Flash' y 'Lite' para mínima latencia
PROVIDERS = [
    {"name": "gemini", "type": "api", "key": GEMINI_KEY, "models": ["gemini-2.0-flash", "gemini-1.5-flash"]},
    {"name": "groq", "type": "api", "key": GROQ_KEY, "models": ["llama-3.3-70b-specdec", "llama-3.1-8b-instant"]},
    {"name": "openrouter", "type": "api", "key": OPENROUTER_KEY, "models": ["google/gemini-2.0-flash-lite-preview-02-05:free", "openai/gpt-oss-120b:free"]}
]

# ==============================================================================
# CARGA DEL LLM LOCAL (CUANTIZADO 4-BIT PARA COLAB)
# ==============================================================================
_LOCAL_PIPE = None
model_lock = threading.Lock()
api_error_log = []

def get_local_pipe():
    global _LOCAL_PIPE
    with model_lock:
        if _LOCAL_PIPE is None:
            show_alert("⚙️ Iniciando LLM Local", "Las APIs fallaron o están sin cuota. Cargando Qwen 1.5B Instruct como respaldo de emergencia en memoria GPU (4-bit)...", "orange")
            from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline, BitsAndBytesConfig
            model_name = "Qwen/Qwen2.5-1.5B-Instruct"
            
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.float16
            ) if torch.cuda.is_available() else None
            
            tokenizer = AutoTokenizer.from_pretrained(model_name, clean_up_tokenization_spaces=False)
            model = AutoModelForCausalLM.from_pretrained(
                model_name, 
                quantization_config=bnb_config,
                device_map="auto" if torch.cuda.is_available() else "cpu",
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                low_cpu_mem_usage=True
            )
            _LOCAL_PIPE = pipeline("text-generation", model=model, tokenizer=tokenizer)
            show_alert("✅ LLM Local Listo", "El modelo de respaldo está listo. El proceso será más lento pero no se detendrá.", "green")
    return _LOCAL_PIPE

def chat_local(prompt: str, system_prompt: str) -> str:
    pipe = get_local_pipe()
    messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}]
    out = pipe(messages, max_new_tokens=1500, do_sample=False, pad_token_id=pipe.tokenizer.eos_token_id)
    return out[0]['generated_text'][-1]['content'].strip()

# ==============================================================================
# LIMPIEZA REGEX DETERMINISTA
# ==============================================================================
L = r'[A-Za-záéíóúñüÁÉÍÓÚÑÜ]'
Lmin = r'[a-záéíóúñü]'

def limpiar_texto_local(texto: str) -> str:
    if not texto: return ""
    res = unicodedata.normalize('NFC', texto)
    res = re.sub(rf'(^|[^{L}])((?:{L}[\s\t]+){{2,}}{L})(?=[^{L}]|$)', lambda m: m.group(1) + re.sub(r'[\s\t]+', '', m.group(2)), res)
    for lig, rep in {'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl'}.items(): res = res.replace(lig, rep)
    res = re.sub(rf'({L})\s*-\s*\n\s*({L})', r'\1\2', res)
    res = re.sub(rf'({L})\s*-\s+({Lmin})', r'\1\2', res)
    res = re.sub(r'\((?:[A-ZÁÉÍÓÚÑüÜa-záéíóúñüÜ\s&.,;\-]|et\s+al\.)+,\s*\d{4}[a-z]?\)', '', res)
    res = re.sub(r'\[\d+(?:\s*[–,\-]\s*\d+)*\]', '', res)
    res = re.sub(r'\(\d+(?:\s*[–,\-]\s*\d+)*\)', '', res)
    res = re.sub(r'https?://\S+', '', res, flags=re.IGNORECASE)
    res = re.sub(r'www\.\S+', '', res, flags=re.IGNORECASE)
    res = re.sub(r'[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}', '', res)
    res = re.sub(r'\(\s*(?:Ver|Véase|véase|ver)?\s*(?:Figura|Tabla|Gráfico|Ilustración)\s+[\d\s]+\s*\)', '', res, flags=re.IGNORECASE)
    res = re.sub(r'[ \t]+', ' ', res)
    res = re.sub(r'^ +| +$', '', res, flags=re.MULTILINE)
    res = re.sub(r'\n{3,}', '\n\n', res)
    return res.strip()

def extraer_texto_pdf(pdf_path: str) -> str:
    texto = []
    with fitz.open(pdf_path) as doc:
        for page in doc:
            texto.append(limpiar_texto_local(page.get_text("text")))
    return "\n\n".join(texto)

def dividir_en_bloques(texto: str, palabras_max: int = 1500) -> List[str]:
    words = texto.split()
    return [" ".join(words[i:i+palabras_max]) for i in range(0, len(words), palabras_max)]

# ==============================================================================
# IA Y ORQUESTADOR
# ==============================================================================
SYSTEM_PROMPT = """Actúa como un procesador de texto avanzado diseñado para optimizar documentos para sistemas Text-to-Speech (TTS). 
Genera un texto fluido y de fácil escucha. Convierte números romanos a texto, integra notas al pie, expande abreviaturas y resume tablas. 
Entrega ESTRICTAMENTE JSON: {"adapted_text": "..."}"""

def sanitize_json(raw: str) -> str:
    try:
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.I)
        return json.loads(cleaned).get("adapted_text", raw)
    except: return raw

def call_api(provider: dict, prompt: str, system: str) -> Optional[str]:
    if not provider.get("key"): return None
    
    # Intentamos 2 veces por proveedor para manejar rate-limits ligeros (429)
    for attempt in range(2):
        try:
            if provider["name"] == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{provider['models'][0]}:generateContent?key={provider['key']}"
                r = requests.post(url, json={"contents": [{"parts": [{"text": f"{system}\n\n{prompt}"}]}], "generationConfig": {"responseMimeType": "application/json"}}, timeout=30)
            else:
                endpoint = "https://api.groq.com/openai/v1/chat/completions" if provider["name"] == "groq" else "https://openrouter.ai/api/v1/chat/completions"
                headers = {"Authorization": f"Bearer {provider['key']}", "Content-Type": "application/json"}
                payload = {"model": provider['models'][0], "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}], "response_format": {"type": "json_object"}}
                r = requests.post(endpoint, headers=headers, json=payload, timeout=30)
            
            if r.status_code == 200:
                if provider["name"] == "gemini":
                    return r.json()['candidates'][0]['content']['parts'][0]['text']
                else:
                    return r.json()['choices'][0]['message']['content']
            elif r.status_code == 429: # Too many requests (Rate limit)
                time.sleep(4) # Esperamos 4 segundos y reintentamos
                continue
            else:
                api_error_log.append(f"Error {r.status_code} en {provider['name']}: {r.text[:100]}")
                break # Si es otro error (ej. llave inválida), no reintentamos
        except Exception as e:
            api_error_log.append(f"Timeout/Red en {provider['name']}: {str(e)}")
            break
            
    return None

def chat_hibrido(message: str, system_prompt: str, b_idx: int) -> str:
    for p in PROVIDERS:
        res = call_api(p, message, system_prompt)
        if res: return sanitize_json(res)
    
    # Si todas las APIs fallan, usamos el modelo local
    try:
        return sanitize_json(chat_local(message, system_prompt))
    except Exception as e:
        return f"[ERROR LOCAL: {str(e)}]\n\n{message}"

def procesar_un_bloque(indice: int, bloque: str) -> tuple:
    return indice, chat_hibrido(bloque, SYSTEM_PROMPT, indice)

# ==============================================================================
# PROCESAMIENTO EN LOTE (CON GUARDADO INCREMENTAL)
# ==============================================================================
pdfs = glob.glob(os.path.join(FOLDER_PATH, "*.pdf")) + glob.glob(os.path.join(FOLDER_PATH, "*.PDF"))
pdfs = list(dict.fromkeys(pdfs)) # Eliminar duplicados

if not pdfs:
    show_alert("⚠️ Sin archivos", f"No se encontraron archivos PDF en {FOLDER_PATH}", "orange")
else:
    show_alert("🚀 Iniciando Turbo Batch", f"Encontrados {len(pdfs)} PDFs. Iniciando procesamiento a {MAX_WORKERS_API} hilos concurrentes...", "blue")

for idx, pdf in enumerate(pdfs, 1):
    out_path = pdf.rsplit('.', 1)[0] + "_tts.txt"
    partial_path = out_path.replace(".txt", "_parcial.txt")
    pdf_name = os.path.basename(pdf)
    
    if os.path.exists(out_path):
        print(f"⏩ [{idx}/{len(pdfs)}] Omitiendo (Ya procesado): {pdf_name}")
        continue

    print(f"📄 [{idx}/{len(pdfs)}] Extrayendo y limpiando: {pdf_name}...")
    texto_puro = extraer_texto_pdf(pdf)
    bloques = dividir_en_bloques(texto_puro, PALABRAS_POR_BLOQUE)
    
    if not bloques: continue
    resultados = [None] * len(bloques)

    with tqdm(total=len(bloques), desc=f"IA Procesando", leave=False) as pbar:
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS_API) as executor:
            futuros = {executor.submit(procesar_un_bloque, i, b): i for i, b in enumerate(bloques)}
            for futuro in concurrent.futures.as_completed(futuros):
                i, res = futuro.result()
                resultados[i] = res
                pbar.update(1)
                
                # GUARDADO INCREMENTAL: Si se corta Colab, el archivo "_parcial.txt" tendrá el progreso.
                with open(partial_path, "w", encoding="utf-8") as f_parcial:
                    f_parcial.write("\n\n".join(filter(None, resultados)))

    # Cuando termina exitosamente, creamos el archivo final y borramos el parcial
    texto_final = "\n\n".join(filter(None, resultados))
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(texto_final)
    if os.path.exists(partial_path): os.remove(partial_path)
    
    print(f"💾 Guardado en Drive: {os.path.basename(out_path)}\n")

if api_error_log:
    print("\n--- Registro de Errores de API (Oculto si no hubo problemas) ---")
    for err in set(api_error_log): print("-", err)

show_alert("🏁 Proceso Finalizado", "Todos los PDFs han sido convertidos para TTS.", "green")
```
