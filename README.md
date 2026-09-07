# 🎧 Dr. Media - Conversor y Limpiador de PDF/EPUB a Texto TTS

**Dr. Media** es una aplicación web de procesamiento de documentos que transforma libros, artículos y literatura académica en formato **PDF y EPUB** en transcripciones limpias, continuas y optimizadas para lectores y sintetizadores de voz (*Text-to-Speech* o TTS).

Combina extracción y normalización local en el navegador, Web Workers para corrección ortográfica offline y soporte para múltiples proveedores de Inteligencia Artificial (**Gemini, Groq, Cerebras, OpenRouter y Hugging Face**) para eliminar ruidos de lectura como cabeceras, números de página, pies de página, tablas, citas entre corchetes y listas de referencias bibliográficas.

> El resultado son archivos `.txt` (documentos cortos) o `.epub` con capítulos (documentos largos) listos para cargar en cualquier lector de voz externo. La app **no reproduce audio por sí misma**.

---

## ✨ Características Principales

* **Limpieza Híbrida (Local + IA)**:
  * **Extracción Local Rápida**: Desguionizado, recomposición de palabras partidas entre líneas y páginas, expansión de siglas médicas/técnicas, omisión de bloques de referencias y colaboradores, y limpieza mediante heurísticas deterministas.
  * **Procesamiento Asistido por IA**: Reescritura y formateo continuo en párrafos naturales sin interrupciones, listo para TTS.
* **Soporte Multi-Proveedor de IA** (con cadena de *fallback* automática):
  * **Google Gemini** — modelos seleccionables: `gemini-3.5-flash` (por defecto), `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-2.5-flash`, además del modo *Auto*.
  * **Groq** — `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen-qwq-32b`.
  * **Cerebras** — `gpt-oss-120b`.
  * **OpenRouter** — `openrouter/free`, `nvidia/nemotron-3-ultra:free`.
  * **Hugging Face Inference API** — `Meta-Llama-3.1-8B-Instruct`, `Phi-3.5-mini-instruct`, `Mixtral-8x7B-Instruct-v0.1`.
* **Modo Turbo y Control de Concurrencia**:
  * Rotación *round-robin* entre los proveedores activos con reintentos y espera adaptativa ante límites de tasa (*rate limits* 429).
  * Hilos paralelos por archivo según la configuración: **5** en modo estándar, **10** con Modo Turbo, **15** con la capa *Pay-As-You-Go* de Gemini (en PAYG y en OCR se usa exclusivamente Gemini, sin fallbacks).
* **Filtros de Limpieza Inteligente**:
  * Escaneo automático de líneas redundantes (cabeceras, autores, nombres de revistas, DOIs, ISSN) a través de las páginas de los documentos cargados.
  * Gestión de reglas con persistencia en `localStorage` y exclusión previa a la IA para ahorrar tokens y tiempo.
* **Herramienta de Limpieza Manual (Point-and-Click)**:
  * Visor interactivo del texto extraído para buscar, seleccionar y purgar patrones o cadenas repetitivas en todo el documento antes de enviarlo a la IA.
* **Corrector Ortográfico Hunspell Offline**:
  * Web Worker en segundo plano con diccionarios de español e inglés (`typo-js` + archivos `.aff`/`.dic` servidos localmente) para resolver errores de OCR y ligaduras sin enviar datos al exterior.
* **Doble Flujo OCR para Documentos Escaneados**:
  * **OCR local (Tesseract.js)**: si una página no contiene texto digital, se renderiza a canvas y se transcribe en el navegador.
  * **OCR multimodal (Gemini)**: cuando el PDF completo se detecta como escaneado (promedio de caracteres por página muy bajo), se divide con `pdf-lib` en sub-PDFs por bloque y se envían en binario (base64, `application/pdf`) al modelo para su transcripción.
* **Procesamiento Selectivo y por Capítulos**:
  * Modal de selección flexible: procesar todo el documento, un rango de páginas específico o capítulos detectados mediante marcadores e índices nativos del PDF/EPUB.
* **Caché Persistente en IndexedDB**:
  * Base `DrMediaCacheDB` que almacena resultados por hash **SHA-256** del contenido para evitar llamadas redundantes a las APIs y permitir reanudación instantánea. Incluye opción de *Forzar reprocesamiento* y de restablecer la caché de un documento concreto.
* **Extracción de Metadatos y Renombrado Automático**:
  * La IA identifica título, autor y año (descartando nombres de revistas y etiquetas de sección) y los usa para nombrar el archivo exportado: `(Año)(Título)(Autor).epub`.
* **Revisión de Fronteras entre Bloques**:
  * Una pasada adicional (`boundary_merge`) sutura los límites entre lotes procesados para evitar frases cortadas o repetidas en el ensamblado final.
* **Exportación**:
  * Documentos de **más de 50 páginas** → `.epub` generado con JSZip, con capítulos, `content.opf` y `toc.ncx`.
  * Documentos más cortos → `.txt` plano.
  * Descarga individual o de todos los documentos de la sesión (texto original extraído y/o texto limpio por IA), además de copiado al portapapeles.
* **PWA con soporte offline**:
  * `manifest.json` para instalación como aplicación y Service Worker (`sw.js`) que precachea el *app shell* y las librerías principales.
* **Terminal de proceso integrada**: registro en vivo de extracción, canales concurrentes, proveedores usados, reintentos y errores.

---

## 🏗️ Arquitectura y Flujo de Procesamiento

El sistema opera con un frontend en TypeScript (Vite + Tailwind CSS) y un servidor Express que expone `/api/gemini` como proxy único para todos los proveedores de IA (las claves nunca se envían directamente desde el navegador a los proveedores).

```
┌─────────────────────────────────────────────────────────────┐
│                      Subida de Archivos                     │
│                  (PDF Digital, PDF Escaneado, EPUB)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Fase 1: Extracción Local                    │
│  - PDF.js / Epub.js + Detección de marcadores nativos       │
│  - OCR local con Tesseract.js en páginas sin texto digital   │
│  - Deduplicación de cabeceras/pies de página                │
│  - Limpieza de guiones, números de página y referencias     │
│  - Aplicación de Filtros Inteligentes y limpieza manual     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Fase 2: Procesamiento con IA (Opcional)        │
│  - Selección: Todo / Rango / Capítulos específicos          │
│  - Segmentación en bloques de 5 páginas                     │
│  - Consulta a IndexedDB (Caché por hash SHA-256)            │
│  - Proxy /api/gemini → Gemini / Groq / Cerebras / OpenRouter│
│    / Hugging Face (rotación Turbo y fallback en cascada)    │
│  - Flujo alterno OCR multimodal para PDFs escaneados        │
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
│                 Salida / Exportación                        │
│  - Vista previa del texto y copiado al portapapeles         │
│  - Renombrado automático por metadatos (Año/Título/Autor)   │
│  - Descarga .TXT (≤50 págs) o .EPUB con capítulos (>50)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Estructura del Proyecto

```text
├── api/
│   └── gemini.ts              # Handler del proxy: prompts, routing multi-proveedor, fallbacks y OCR
├── public/
│   ├── dictionaries/
│   │   ├── es/                # es.aff / es.dic (Hunspell español)
│   │   ├── en_US.aff
│   │   └── en_US.dic
│   ├── icon.svg               # Icono de la aplicación
│   ├── manifest.json          # Manifiesto PWA
│   └── sw.js                  # Service Worker (precaché del app shell)
├── src/
│   ├── main.ts                # Orquestador principal (UI, estado, extracción, flujos de IA, exportación)
│   ├── hunspellWorker.ts      # Web Worker de corrección ortográfica offline (typo-js optimizado)
│   ├── styles/
│   │   └── index.css          # Estilos globales con Tailwind CSS
│   └── utils/                 # Fuente única de la limpieza: la comparten la app,
│                               # las pruebas y los scripts de evaluación
│       ├── charClasses.ts     # Clases de caracteres con diacríticos
│       ├── textCleaner.ts     # Limpieza estructural del texto extraído
│       ├── textRules.ts       # Idioma, siglas, referencias y títulos de portada
│       └── pdfLayout.ts       # Orden de lectura y extracción por página (PDF.js)
├── tests/
│   ├── limpieza.test.js       # Pruebas de omisión de referencias, colaboradores y conflictos de interés
│   └── correcciones.test.js   # Pruebas de desguionado, siglas, uniones y limpieza local
├── scripts/
│   └── evaluar_titulos_papers.js  # Evalúa la detección de títulos sobre una carpeta de PDFs
├── pruebas/                   # Material de prueba y reportes generados
├── .github/
│   └── workflows/ci.yml       # Integración continua: tipos, pruebas, build y duplicación
├── .jscpd.json                # Umbral del detector de código duplicado
├── index.html                 # Interfaz de usuario, modales y carga de librerías por CDN
├── server.ts                  # Servidor Express + middleware de Vite / estáticos de producción
├── metadata.json              # Metadatos del entorno y capacidades de la app
├── package.json               # Dependencias y scripts
├── tsconfig.json              # Configuración de TypeScript
└── vite.config.js             # Configuración del empaquetador Vite
```

---

## 🧰 Stack y Dependencias

**Instaladas vía npm:** Express 5, Vite 8, Tailwind CSS 4, TypeScript, tsx, esbuild, `typo-js` y `pdfjs-dist` (esta última solo para los scripts offline).

**Cargadas por CDN desde `index.html`** (requieren conexión en la primera carga; luego el Service Worker cachea parte de ellas):

| Librería | Uso |
|---|---|
| PDF.js 3.4.120 | Extracción de texto y renderizado de páginas |
| pdf-lib | División del PDF en sub-documentos para OCR multimodal |
| Tesseract.js 4 | OCR local en el navegador |
| Epub.js | Lectura de archivos EPUB |
| JSZip 3.10.1 | Empaquetado del EPUB de salida |

---

## 🚀 Instalación y Uso Local

### Prerrequisitos
- **Node.js 22.18 o superior** (las pruebas importan módulos `.ts` directamente)
- **npm**, **pnpm** o **yarn**

### 1. Clonar e Instalar Dependencias
```bash
git clone https://github.com/simonmedinapsiquiatra-bot/PDF-to-text-for-voice.git
cd PDF-to-text-for-voice
npm install
```

### 2. Variables de Entorno (Opcional)
Copia `.env.example` a `.env` en la raíz para predefinir credenciales en el servidor:
```env
GEMINI_API_KEY=tu_clave_gemini_aqui
GROQ_API_KEY=tu_clave_groq_aqui
CEREBRAS_API_KEY=tu_clave_cerebras_aqui
OPENROUTER_API_KEY=tu_clave_openrouter_aqui
HUGGINGFACE_API_KEY=tu_clave_huggingface_aqui
```
*Nota: los usuarios también pueden configurar sus propias API Keys desde el modal de ajustes de la aplicación; en ese caso se guardan en el `localStorage` del navegador y tienen prioridad sobre las del servidor.*

### 3. Iniciar el Servidor de Desarrollo
```bash
npm run dev
```
La aplicación queda disponible en `http://localhost:3000` (puerto fijo en `server.ts`).

### 4. Comprobaciones
```bash
npm test           # Pruebas unitarias (Node test runner)
npm run typecheck  # Comprobación de tipos
npm run duplicados # Detector de código duplicado (jscpd)
npm run build      # Compilación
```
Estas cuatro son exactamente las que ejecuta la integración continua
(`.github/workflows/ci.yml`) en cada pull request y en cada push a `main`.
`npm run duplicados` falla si la duplicación supera el umbral de
`.jscpd.json` (2 %), para que el código repetido no vuelva a acumularse sin
que nadie lo note.

Las pruebas importan los mismos módulos de `src/utils/` que ejecuta la
aplicación, así que verifican el código real y no una copia.

Para medir la detección de títulos sobre una colección propia de PDFs:
```bash
node scripts/evaluar_titulos_papers.js /ruta/a/mis/papers
node scripts/evaluar_titulos_papers.js /ruta/a/mis/papers --markdown pruebas/reporte.md
```

### 5. Compilar y Servir en Producción
```bash
npm run build      # Genera dist/ (cliente Vite + dist/server.cjs con esbuild)
NODE_ENV=production npm start
```
> `NODE_ENV=production` es necesario: sin esa variable el servidor intenta levantar el middleware de desarrollo de Vite.

---

## ⚙️ Configuración de Proveedores de IA

Desde el botón **"Configuración API"** (icono de engranaje) en la barra superior puedes:
1. **Elegir la capa de uso de Gemini:** *Capa Gratuita* (límites de Google, con fallbacks a otros proveedores activos) o *Pay-As-You-Go / Prepago*. La opción prepago es la más rápida y económica (unos pocos centavos por libro con Gemini 3.5 Flash), elimina pausas por rate limits y habilita hasta 15 hilos en paralelo.
2. **Seleccionar el Modelo:** modo *Auto* o un modelo Gemini específico (3.5 Flash, 3.7 Flash, 3.6 Flash, 3.5 Flash-Lite, 2.5 Flash).
3. **Ingresar API Keys:** claves personales de Gemini, Groq, Cerebras, OpenRouter o Hugging Face (con enlaces directos a cada consola).
4. **Activar Modo Turbo:** procesa con 10 canales concurrentes rotando entre los proveedores activos.
5. **Gestionar Filtros Inteligentes:** escanear los documentos cargados para identificar y suprimir textos repetitivos automáticamente.

---

## 🔒 Privacidad

- La extracción, la limpieza local y la corrección ortográfica Hunspell ocurren **íntegramente en el navegador**.
- Solo el texto (o los bloques PDF en el flujo OCR) enviado a la fase de IA sale del equipo, y siempre a través del proxy local `/api/gemini` hacia el proveedor elegido.
- Las claves introducidas en la interfaz se guardan en `localStorage` del navegador; las del archivo `.env` permanecen en el servidor.

---

## 📄 Licencia

Este proyecto está bajo la licencia **ISC**.
