# 🎧 Dr. Media - Conversor y Limpiador de PDF/EPUB a Texto TTS

**Dr. Media** es una aplicación web de procesamiento de documentos diseñada para transformar libros, artículos y literatura académica en formato **PDF y EPUB** en transcripciones limpias, continuas y optimizadas para lectores y sintetizadores de voz (*Text-to-Speech* o TTS).

Combina extracción y normalización local en el navegador (NLP), Web Workers para corrección ortográfica offline y soporte para múltiples proveedores de Inteligencia Artificial (**Gemini, Groq, Cerebras, OpenRouter y Hugging Face**) para eliminar ruidos de lectura como cabeceras, números de página, pies de página, tablas, citas entre corchetes y listas de referencias bibliográficas.

---

## ✨ Características Principales

* **Limpieza Híbrida (Local + IA)**:
  * **Extracción Local Rápida**: Desguionizado, recomposición de palabras partidas, expansión de siglas médicas/técnicas, omisión de bloques de referencias y limpieza mediante heurísticas deterministas.
  * **Procesamiento Asistido por IA**: Reescritura y formateo continuo en párrafos naturales sin interrupciones, listo para TTS.
* **Soporte Multi-Proveedor de IA**:
  * **Google Gemini** (Gemini 2.5/3.5 Flash, Pro con modo Auto).
  * **Groq** (Llama 3.3 70B Versatile, Mixtral).
  * **Cerebras** (Inferencia ultra-rápida con Llama 3.3 70B).
  * **OpenRouter** (Llama 3.3, Claude, Gemini Flash, etc.).
  * **Hugging Face Inference API** (Qwen 2.5, DeepSeek R1 / Llama).
* **Modo Turbo**: Despacho simultáneo y rotación inteligente de solicitudes entre múltiples proveedores activos con fallback automático ante límites de tasa (*rate limits* 429).
* **Filtros de Limpieza Inteligente**:
  * Escaneo automático de líneas redundantes (cabeceras, autores, nombres de revistas, DOIs, ISSN) a través de las páginas del documento.
  * Gestión de reglas con persistencia en `localStorage` y exclusión previa a la IA para ahorrar tokens y tiempo.
* **Herramienta de Limpieza Manual (Point-and-Click)**:
  * Visor interactivo del texto extraído para buscar, seleccionar y purgar patrones o cadenas repetitivas en tiempo real.
* **Corrector Ortográfico Hunspell Offline**:
  * Web Worker en segundo plano con diccionarios en español e inglés (`typokit`) para resolver errores de OCR y ligaduras sin enviar datos al exterior.
* **Flujo OCR Multimodal para Documentos Escaneados**:
  * Renderizado de páginas a imágenes en canvas para transcripción visual con modelos multimodales de Gemini.
* **Procesamiento Selectivo y por Capítulos**:
  * Modal de selección flexible: procesar todo el documento, un rango de páginas específico o capítulos detectados mediante marcadores e índices nativos del PDF/EPUB.
* **Caché Persistente en IndexedDB**:
  * Almacena resultados procesados mediante hashes SHA-256 para evitar llamadas redundantes a las APIs y permitir reanudación instantánea.
* **Reproductor TTS con Teleprompter**:
  * Lector de voz integrado en el navegador (`SpeechSynthesis`) con sincronización y resaltado palabra por palabra.
* **Descarga Flexible**:
  * Exportación en `.txt` individual o descarga masiva de todos los documentos en un archivo comprimido `.zip` (`JSZip`).

---

## 🏗️ Arquitectura y Flujo de Procesamiento

El sistema opera con un frontend reactivo en TypeScript y una función serverless `/api/gemini` que actúa como proxy seguro para peticiones de IA.

```
┌─────────────────────────────────────────────────────────────┐
│                      Subida de Archivos                     │
│                  (PDF Digital, PDF Escaneado, EPUB)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Fase 1: Extracción Local (NLP)              │
│  - PDF.js / Epub.js + Detección de marcadores nativos       │
│  - Deduplicación de cabeceras/pies de página                │
│  - Limpieza de guiones, números de página y referencias     │
│  - Aplicación de Filtros Inteligentes                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Fase 2: Procesamiento con IA (Opcional)        │
│  - Selección: Todo / Rango / Capítulos específicos          │
│  - Segmentación en bloques contextuales                     │
│  - Consulta a IndexedDB (Caché por hash de contenido)       │
│  - Despacho a Gemini / Groq / Cerebras / OpenRouter / HF    │
│  - Manejo de concurrencia y rotación Turbo                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Fase 3: Post-procesamiento                  │
│  - Revisión y sutura de fronteras entre bloques             │
│  - Corrección léxica Hunspell (Web Worker)                  │
│  - Normalización final para síntesis de voz                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Salida / Exportación / Lectura              │
│  - Visor y editor de texto                                  │
│  - Reproductor TTS con teleprompter interactivo             │
│  - Descarga de archivos TXT y empaquetado ZIP               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Estructura del Proyecto

```text
├── api/
│   └── gemini.ts              # Proxy serverless para invocación a Gemini y proveedores compatibles
├── public/
│   ├── dictionaries/          # Diccionarios .aff y .dic de Hunspell (es_ES, en_US)
│   └── icon.png               # Icono de la aplicación
├── src/
│   ├── main.ts                # Orquestador principal (UI, estado de archivos, flujos de extracción e IA)
│   ├── hunspellWorker.ts      # Web Worker asíncrono para corrección ortográfica offline
│   ├── styles/
│   │   └── index.css          # Estilos globales con Tailwind CSS
│   └── utils/
│       └── textCleaner.ts     # Módulos de limpieza léxica, regex y reglas lingüísticas
├── tests/
│   ├── limpieza.test.js       # Pruebas unitarias de limpieza y filtros
│   └── reglas.test.js         # Pruebas unitarias de desguionado, siglas y citas
├── index.html                 # Interfaz de usuario con Tailwind CSS y modales
├── metadata.json              # Metadatos del entorno y capacidades de la app
├── package.json               # Configuración de dependencias y scripts de ejecución
├── tsconfig.json              # Configuración de TypeScript
└── vite.config.js             # Configuración del empaquetador Vite
```

---

## 🚀 Instalación y Uso Local

### Prerrequisitos
- **Node.js** (versión 18 o superior)
- **npm**, **pnpm** o **yarn**

### 1. Clonar e Instalar Dependencias
```bash
git clone <url-del-repositorio>
cd pdf-to-audio-conversor
npm install
```

### 2. Variables de Entorno (Opcional)
Puedes configurar un archivo `.env` en la raíz para predefinir credenciales en el servidor:
```env
GEMINI_API_KEY=tu_clave_gemini_aqui
GROQ_API_KEY=tu_clave_groq_aqui
CEREBRAS_API_KEY=tu_clave_cerebras_aqui
OPENROUTER_API_KEY=tu_clave_openrouter_aqui
HUGGINGFACE_API_KEY=tu_clave_huggingface_aqui
```
*Nota: Los usuarios también pueden configurar sus propias API Keys directamente desde el modal de ajustes de la aplicación.*

### 3. Iniciar el Servidor de Desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000` (o el puerto configurado por el entorno).

### 4. Ejecutar Pruebas Unitarias
```bash
npm test
```

### 5. Compilar para Producción
```bash
npm run build
```

---

## ⚙️ Configuración de Proveedores de IA

Desde el botón **"Configuración API"** (icono de engranaje) en la barra superior puedes:
1. **Seleccionar el Modelo:** Elegir entre modo *Auto*, modelos específicos de Google Gemini (2.5 Flash, 3.5 Flash, Pro) o proveedores alternativos.
2. **Ingresar API Keys:** Añadir tus claves personales de Gemini, Groq, Cerebras, OpenRouter o Hugging Face.
3. **Activar Modo Turbo:** Permite procesar lotes con mayor velocidad combinando proveedores activos.
4. **Gestionar Filtros Inteligentes:** Escanear los documentos cargados para identificar y suprimir textos repetitivos automáticamente.

---

## 📄 Licencia

Este proyecto está bajo la licencia **ISC**.
