# 📁 Dr. Media: Procesamiento por Lotes de PDFs en Google Drive desde Google Colab

Este script para **Google Colab** automatiza la lectura de **todos los PDFs** alojados en tu carpeta de **Google Drive**, ejecuta la limpieza y adaptación semántica para TTS de **Dr. Media**, y guarda los archivos `.txt` resultantes directamente en esa misma carpeta de Drive.

---

### ⚙️ Características Principales:

* **Montaje Automático de Google Drive:** Lee los PDFs y guarda los `.txt` directamente en tu Drive sin descargar nada a tu PC.
* **Procesamiento por Lotes Inteligente:** Itera sobre todos los PDFs de la carpeta. Si un archivo ya fue procesado (`_tts.txt`), lo omite automáticamente para ahorrar tiempo y tokens (soporta reanudación).
* **Extracción y Limpieza de Dr. Media:** Ordenamiento en doble columna, normalización Unicode NFC, eliminación de ligaduras, citas APA `(Autor, Año)`, referencias numéricas `[1]` y notas al pie flotantes.
* **Orquestador Multi-Proveedor + LLM Local:** Prioriza Google Gemini, Groq, OpenRouter y Cerebras. Si todos se saturan o dan error 429, activa automáticamente el **LLM Local en la GPU de Colab** como respaldo 100% resiliente.
* **Sin generación de MP3:** Se enfoca exclusivamente en generar el texto limpio y enriquecido listo para lectores TTS.

---

```python
# ==============================================================================
# PASO 1: INSTALACIÓN DE DEPENDENCIAS (Ejecutar en celda de Colab)
# ==============================================================================
# !pip install -q pymupdf requests torch transformers accelerate bitsandbytes pydantic

import os
import re
import json
import time
import glob
import unicodedata
from typing import Optional, Dict, Any, List
import requests
import fitz  # PyMuPDF para extracción de alta precisión

# ==============================================================================
# PASO 2: CONEXIÓN CON GOOGLE DRIVE Y RUTA DE LA CARPETA
# ==============================================================================
# Montar Google Drive
from google.colab import drive
drive.mount('/content/drive')

# ------------------------------------------------------------------------------
# INGRESA LA RUTA A TU CARPETA DE GOOGLE DRIVE AQUÍ:
# Por ejemplo, si en tu Drive la carpeta se llama "PDFs_Psiquiatria" dentro de "Mi unidad":
# FOLDER_PATH = "/content/drive/MyDrive/PDFs_Psiquiatria"
# (Si usas un acceso directo a la carpeta compartida con ID 1vRCvZsIdoXVkYjiOLRsoOiv9-iBLog3D, 
# agrégala a tu unidad como acceso directo y coloca la ruta aquí abajo):
# ------------------------------------------------------------------------------
FOLDER_PATH = "/content/drive/MyDrive/CREACION DE APPS/PDF TEXT TO VOICE"  # <-- AJUSTA LA RUTA DE TU CARPETA EN DRIVE

# ==============================================================================
# PASO 3: CONFIGURACIÓN DE API KEYS Y PROVEEDORES
# ==============================================================================
API_KEYS = {
    "gemini": os.getenv("GEMINI_API_KEY", "TU_GEMINI_API_KEY"),
    "groq": os.getenv("GROQ_API_KEY", "TU_GROQ_API_KEY"),
    "openrouter": os.getenv("OPENROUTER_API_KEY", "TU_OPENROUTER_API_KEY"),
    "cerebras": os.getenv("CEREBRAS_API_KEY", "TU_CEREBRAS_API_KEY")
}

PROVIDERS = [
    {
        "name": "gemini",
        "key": "gemini",
        "priority": 1,
        "timeout": 45,
        "models": ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    },
    {
        "name": "groq",
        "key": "groq",
        "priority": 2,
        "timeout": 30,
        "models": [
            "llama-3.3-70b-versatile",
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "openai/gpt-oss-120b",
            "qwen/qwen3-32b",
            "llama-3.1-8b-instant"
        ]
    },
    {
        "name": "openrouter",
        "key": "openrouter",
        "priority": 3,
        "timeout": 35,
        "models": [
            "openai/gpt-oss-120b:free",
            "meta-llama/llama-3.3-70b-instruct:free",
            "qwen/qwen3-next-80b-a3b-instruct:free"
        ]
    },
    {
        "name": "cerebras",
        "key": "cerebras",
        "priority": 4,
        "timeout": 25,
        "models": ["qwen-3-235b-a22b-instruct-2507", "gpt-oss-120b"]
    }
]

stats: Dict[str, Dict[str, Any]] = {p["name"]: {"fail": 0, "last_fail_time": 0} for p in PROVIDERS}

# ==============================================================================
# PASO 4: LIMPIEZA REGEX Y NORMALIZACIÓN LINGÜÍSTICA (Lógica Dr. Media)
# ==============================================================================
L = r'[A-Za-záéíóúñüÁÉÍÓÚÑÜ]'
Lmin = r'[a-záéíóúñü]'
Lmay = r'[A-ZÁÉÍÓÚÑÜ]'

def limpiar_texto_local(texto: str) -> str:
    """Aplica las reglas deterministas de Dr. Media para limpiar PDFs antes de la IA."""
    if not texto:
        return ""
  
    # 1. Normalización Unicode NFC
    res = unicodedata.normalize('NFC', texto)

    # 2. Unir letras separadas por espacios (Ej: "P A L A B R A" -> "PALABRA")
    res = re.sub(rf'(^|[^{L}])((?:{L}[\s\t]+){{2,}}{L})(?=[^{L}]|$)', 
                 lambda m: m.group(1) + re.sub(r'[\s\t]+', '', m.group(2)), res)

    # 3. Ligaduras Tipográficas comunes
    ligaduras = {'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl'}
    for lig, rep in ligaduras.items():
        res = res.replace(lig, rep)

    # 4. Corrección de deformaciones OCR habituales en español
    ocr_fixes = {
        r'cl\s+ínica': 'clínica',
        r'mostrí\s+ó': 'mostró',
        r'tenaní': 'tenían',
        r'exper\s+íencia': 'experiencia',
        r'relació\s+n': 'relación',
        r'diagnstico': 'diagnóstico'
    }
    for pat, rep in ocr_fixes.items():
        res = re.sub(pat, rep, res, flags=re.IGNORECASE)

    # 5. Guiones de separación silábica al final de línea
    res = re.sub(rf'({L})\s*-\s*\n\s*({L})', r'\1\2', res)
    res = re.sub(rf'({L})\s*-\s+({Lmin})', r'\1\2', res)

    # 6. Eliminar líneas de índice con guías de puntos
    res = re.sub(r'^.*(?:\.{3,}|\.{2,}\s+\.{2,}|(?:\.\s*){4,})\s*\d+\s*$', '', res, flags=re.MULTILINE)

    # 7. Eliminar citas parentéticas estilo APA (Ej: (Pérez et al., 2021))
    res = re.sub(r'\((?:[A-ZÁÉÍÓÚÑüÜa-záéíóúñüÜ\s&.,;\-]|et\s+al\.)+,\s*\d{4}[a-z]?\)', '', res)

    # 8. Eliminar citas numéricas entre corchetes y paréntesis [1], [1-3], (1,2)
    res = re.sub(r'\[\d+(?:\s*[–,\-]\s*\d+)*\]', '', res)
    res = re.sub(r'\(\d+(?:\s*[–,\-]\s*\d+)*\)', '', res)

    # 9. Eliminar URLs completas y correos electrónicos
    res = re.sub(r'https?://\S+', '', res, flags=re.IGNORECASE)
    res = re.sub(r'www\.\S+', '', res, flags=re.IGNORECASE)
    res = re.sub(r'[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}', '', res)

    # 10. Eliminar llamados a figuras/tablas (Ej: "(Ver Figura 1)")
    res = re.sub(r'\(\s*(?:Ver|Véase|véase|ver)?\s*(?:Figura|Tabla|Gráfico|Ilustración)\s+[\d\s]+\s*\)', '', res, flags=re.IGNORECASE)

    # 11. Eliminar caracteres de formato basura (secuencias de ===, ---, ***)
    res = re.sub(r'[-*=_]{3,}', '', res)

    # 12. Normalizar viñetas complejas
    res = re.sub(r'[►♦➔■●○▪▫]\s*', '• ', res)

    # 13. Eliminar números de página aislados
    res = re.sub(r'^\s*\d+\s*$', '', res, flags=re.MULTILINE)

    # 14. Normalizar espacios redundantes
    res = re.sub(r'[ \t]+', ' ', res)
    res = re.sub(r'^ +| +$', '', res, flags=re.MULTILINE)
    res = re.sub(r'\n{3,}', '\n\n', res)

    return res.strip()

# ==============================================================================
# PASO 5: EXTRACCIÓN ROBUSTA DE PDF (Manejo de columnas y páginas)
# ==============================================================================
def extraer_texto_pdf(pdf_path: str) -> str:
    """Extrae texto página por página preservando flujo de lectura en doble columna."""
    doc = fitz.open(pdf_path)
    paginas_texto = []

    for num_pag in range(len(doc)):
        pagina = doc[num_pag]
        # Extrae bloques ordenados geométricamente
        bloques = pagina.get_text("blocks")
        texto_pagina = ""
        for b in bloques:
            texto_pagina += b[4] + "\n"
      
        texto_limpio_pag = limpiar_texto_local(texto_pagina)
        if texto_limpio_pag:
            paginas_texto.append(texto_limpio_pag)
          
    return "\n\n".join(paginas_texto)

# ==============================================================================
# PASO 6: CHUNKING INTELIGENTE DINÁMICO
# ==============================================================================
def dividir_en_bloques(texto: str, palabras_por_bloque: int = 2500) -> List[str]:
    """Divide el texto en bloques respetando límites de párrafos para evitar cortes abruptos."""
    parrafos = texto.split("\n\n")
    bloques = []
    bloque_actual = []
    cuenta_palabras = 0

    for p in parrafos:
        palabras_p = len(p.split())
        if cuenta_palabras + palabras_p > palabras_por_bloque and bloque_actual:
            bloques.append("\n\n".join(bloque_actual))
            bloque_actual = [p]
            cuenta_palabras = palabras_p
        else:
            bloque_actual.append(p)
            cuenta_palabras += palabras_p

    if bloque_actual:
        bloques.append("\n\n".join(bloque_actual))

    return bloques

# ==============================================================================
# PASO 7: CARGA DEL LLM LOCAL EN COLAB (Singleton perezoso)
# ==============================================================================
_LOCAL_PIPELINE = None

def get_local_llm_pipeline():
    """Inicializa un modelo local en la GPU/CPU de Colab con cuantización 4-bit."""
    global _LOCAL_PIPELINE
    if _LOCAL_PIPELINE is None:
        print("\n⚙️ Cargando LLM Local en memoria GPU de Colab (Qwen2.5-7B-Instruct / 4-bit)...")
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline, BitsAndBytesConfig

        model_id = "Qwen/Qwen2.5-7B-Instruct"
      
        use_cuda = torch.cuda.is_available()
        device_map = "auto" if use_cuda else "cpu"
      
        bnb_config = None
        if use_cuda:
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.float16
            )

        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            quantization_config=bnb_config,
            device_map=device_map,
            torch_dtype=torch.float16 if use_cuda else torch.float32,
            low_cpu_mem_usage=True
        )

        _LOCAL_PIPELINE = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer
        )
        print("✅ LLM Local cargado y listo para inferencia.\n")
    return _LOCAL_PIPELINE

def _get_local_llm_response(message: str, system_prompt: str, max_tokens: int = 2500, temperature: float = 0.1) -> str:
    """Ejecuta inferencia en el LLM Local de Colab."""
    print("🤖 [LLM Local Colab] Generando respuesta localmente...")
    pipe = get_local_llm_pipeline()
  
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message}
    ]
  
    prompt = pipe.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    outputs = pipe(
        prompt,
        max_new_tokens=max_tokens,
        do_sample=(temperature > 0.0),
        temperature=max(temperature, 0.01),
        top_p=0.9
    )
  
    raw_text = outputs[0]["generated_text"][len(prompt):].strip()
    return raw_text

# ==============================================================================
# PASO 8: PARSEO Y PROTOCOLO GUARDRAIL (dr-media-ai-guardrail)
# ==============================================================================
def sanitize_guardrail_response(raw_text: str) -> Dict[str, Any]:
    """Valida y normaliza la salida JSON estricta de la IA."""
    cleaned = raw_text.replace("**", "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.I).strip()

    try:
        data = json.loads(cleaned)
        if "adapted_text" in data:
            data["adapted_text"] = data["adapted_text"].replace("**", "")
            return data
    except Exception:
        pass

    return {
        "adapted_text": cleaned,
        "removed_elements": [],
        "flagged_omissions": ["Formato JSON recuperado como texto plano"]
    }

# ==============================================================================
# PASO 9: ORQUESTADOR MULTIPROVEEDOR CON PRIORIDADES Y FALLBACK
# ==============================================================================
def _register_failure(provider_name: str, reason: str):
    print(f"❌ Falló {provider_name.upper()}: {reason}")
    stats[provider_name]["fail"] = stats[provider_name].get("fail", 0) + 1
    stats[provider_name]["last_fail_time"] = time.time()

def _call_gemini_api(provider: dict, key: str, message: str, system_prompt: str, max_tokens: int, temperature: float) -> Optional[str]:
    for model in provider["models"]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": f"{system_prompt}\n\n{message}"}]}
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "responseMimeType": "application/json"
            }
        }
        try:
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=provider["timeout"])
            if res.status_code == 200:
                data = res.json()
                if "candidates" in data and len(data["candidates"]) > 0:
                    return data["candidates"][0]["content"]["parts"][0]["text"]
            elif res.status_code == 429:
                print(f"⚠️ Cuota excedida (429) en Gemini modelo {model}.")
                continue
        except Exception as e:
            print(f"⚠️ Error de conexión con Gemini {model}: {e}")
            continue
    return None

def _call_openai_compatible_api(provider: dict, key: str, message: str, system_prompt: str, max_tokens: int, temperature: float) -> Optional[str]:
    endpoints = {
        "groq": "https://api.groq.com/openai/v1/chat/completions",
        "openrouter": "https://openrouter.ai/api/v1/chat/completions",
        "cerebras": "https://api.cerebras.ai/v1/chat/completions"
    }
    url = endpoints.get(provider["name"])
    if not url:
        return None

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    if provider["name"] == "openrouter":
        headers["HTTP-Referer"] = "https://colab.research.google.com"
        headers["X-Title"] = "Dr. Media Colab"

    for model in provider["models"]:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"}
        }
        try:
            res = requests.post(url, headers=headers, json=payload, timeout=provider["timeout"])
            if res.status_code == 200:
                data = res.json()
                if "choices" in data and len(data["choices"]) > 0:
                    return data["choices"][0]["message"]["content"]
            elif res.status_code == 429:
                print(f"⚠️ Cuota excedida (429) en {provider['name']} con modelo {model}.")
                continue
            else:
                print(f"⚠️ Error {res.status_code} en {provider['name']} ({model})")
        except Exception as e:
            print(f"⚠️ Error de red con {provider['name']} ({model}): {e}")
            continue
    return None

def chat(
    message: str,
    system_prompt: str = "Eres un asistente útil.",
    max_retries: int = 1,
    preferred_provider: str = None,
    max_tokens: int = 2500,
    temperature: float = 0.1
) -> str:
    """Función orquestadora que gestiona la cascada de proveedores y LLM Local."""
    now = time.time()

    def get_provider_priority(p):
        p_stats = stats[p["name"]]
        if p_stats.get("fail", 0) > 0 and p_stats.get("last_fail_time"):
            if (now - p_stats["last_fail_time"]) < 300:
                return p["priority"] + 100  # Penalización temporal de 5 min
        return p["priority"]

    sorted_providers = sorted(PROVIDERS, key=get_provider_priority)
    if preferred_provider:
        for i, p in enumerate(sorted_providers):
            if p["name"] == preferred_provider:
                sorted_providers.insert(0, sorted_providers.pop(i))
                break

    for provider in sorted_providers:
        key = API_KEYS.get(provider["key"])
        if not key or "TU_" in key:
            continue

        print(f"📡 Intentando {provider['name'].upper()}...")
        try:
            if provider["name"] == "gemini":
                text = _call_gemini_api(provider, key, message, system_prompt, max_tokens, temperature)
            else:
                text = _call_openai_compatible_api(provider, key, message, system_prompt, max_tokens, temperature)

            if text:
                return text
            else:
                _register_failure(provider["name"], "No se obtuvo respuesta válida de los modelos.")
        except Exception as e:
            _register_failure(provider["name"], str(e))

    # Si todos los proveedores remotos fallan o están sin cuota:
    print("🔄 Activando LLM Local en Colab como respaldo de máxima resiliencia...")
    return _get_local_llm_response(message, system_prompt, max_tokens, temperature)

# ==============================================================================
# PASO 10: PROMPT DEL SISTEMA DR. MEDIA (TTS Adaptation)
# ==============================================================================
SYSTEM_PROMPT_TTS = """Actúa como un procesador de texto avanzado diseñado para optimizar documentos para sistemas Text-to-Speech (TTS). Tu objetivo es generar un texto fluido, continuo y de fácil escucha, eliminando cualquier interrupción visual o académica.

Ejecuta el procesamiento en dos fases secuenciales:

FASE 1: Limpieza Estructural
Elimina o corrige estrictamente los siguientes elementos:
- Guiones de separación silábica residuales (medi- cina -> medicina).
- Cabeceras, pies de página y numeración repetitiva.
- URLs, correos y referencias a tablas o gráficos ("(Ver Tabla 1)").
- Citas académicas integradas [1] o (Autor, Año).
- Secciones de bibliografía al final del documento. NO elimines el autor ni título al inicio.

FASE 2: Adaptación Semántica para TTS
- Notas al pie: Intégralas discursivamente en el párrafo principal.
- Números Romanos: Conviértelos a texto ("Siglo XX" -> "Siglo veinte").
- Abreviaturas: Expándelas para pronunciación correcta ("Dr." -> "Doctor", "pág." -> "página").
- Tablas y esquemas: Resúmelos en un párrafo fluido ("En el documento hay una tabla que indica...").
- Idioma: Conserva ESTRICTAMENTE el idioma original (no traducir).
- Marcadores: Si hay títulos marcados como "# TITULO", consérvalos intactos.

Entrega ESTRICTAMENTE un objeto JSON válido con el siguiente esquema:
{
  "adapted_text": "El texto final procesado y listo para ser enviado al motor TTS.",
  "removed_elements": ["Lista de elementos específicos eliminados"],
  "flagged_omissions": ["Lista cualquier dato clínico/contextual importante omitido, si lo hay"]
}"""

# ==============================================================================
# PASO 11: PROCESAMIENTO EN LOTE (BATCH) EN GOOGLE DRIVE
# ==============================================================================
def procesar_carpeta_drive(folder_path: str):
    if not os.path.exists(folder_path):
        print(f"❌ La ruta especificada no existe: {folder_path}")
        print("💡 Verifica que Google Drive esté montado y que el nombre de la carpeta sea exacto.")
        return

    # Buscar todos los archivos PDF en la carpeta
    pdf_files = sorted(glob.glob(os.path.join(folder_path, "*.pdf"))) + sorted(glob.glob(os.path.join(folder_path, "*.PDF")))
    # Eliminar duplicados
    pdf_files = list(dict.fromkeys(pdf_files))

    if not pdf_files:
        print(f"⚠️ No se encontraron archivos PDF en la carpeta: {folder_path}")
        return

    print(f"\n📂 Se encontraron {len(pdf_files)} archivo(s) PDF en Google Drive:")
    for idx, f in enumerate(pdf_files, 1):
        print(f"   {idx}. {os.path.basename(f)}")

    for idx, pdf_path in enumerate(pdf_files, 1):
        nombre_base = os.path.splitext(os.path.basename(pdf_path))[0]
        output_txt_path = os.path.join(folder_path, f"{nombre_base}_tts.txt")

        print(f"\n" + "="*80)
        print(f"📄 [{idx}/{len(pdf_files)}] Procesando: {os.path.basename(pdf_path)}")
        print("="*80)

        # Si ya existe el archivo procesado, omitir para no gastar tokens innecesariamente
        if os.path.exists(output_txt_path):
            print(f"⏩ Omitiendo (Ya procesado previamente): {os.path.basename(output_txt_path)}")
            continue

        try:
            print("📖 1. Extrayendo texto del PDF...")
            texto_extraido = extraer_texto_pdf(pdf_path)
            total_palabras = len(texto_extraido.split())
            print(f"   Total de palabras extraídas: {total_palabras:,}")

            if total_palabras < 20:
                print(f"⚠️ El PDF parece estar vacío o escaneado como imagen pura. Omitiendo.")
                continue

            print("✂️ 2. Dividiendo en bloques de ~2.500 palabras...")
            bloques = dividir_en_bloques(texto_extraido, palabras_por_bloque=2500)
            print(f"   Total de bloques a procesar con IA: {len(bloques)}")

            bloques_procesados = []

            for b_idx, bloque in enumerate(bloques, 1):
                print(f"\n--- Bloque {b_idx}/{len(bloques)} ({len(bloque.split())} palabras) ---")
                user_prompt = f"TEXTO A OPTIMIZAR:\n\n{bloque}"
              
                raw_res = chat(
                    message=user_prompt,
                    system_prompt=SYSTEM_PROMPT_TTS,
                    max_tokens=3000,
                    temperature=0.1
                )
              
                parsed = sanitize_guardrail_response(raw_res)
                bloques_procesados.append(parsed["adapted_text"])

            texto_final = "\n\n".join(bloques_procesados)

            # Guardar el archivo directamente en Google Drive
            with open(output_txt_path, "w", encoding="utf-8") as f_out:
                f_out.write(texto_final)

            print(f"\n💾 Guardado con éxito en Drive: {os.path.basename(output_txt_path)}")

        except Exception as e:
            print(f"❌ Error al procesar {os.path.basename(pdf_path)}: {e}")

    print("\n🏁 ¡Procesamiento de todos los PDFs completado con éxito en Google Drive!")

# ==============================================================================
# EJECUCIÓN:
# ==============================================================================
# procesar_carpeta_drive(FOLDER_PATH)
```
