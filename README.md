# 🎧 Dr. Media - Conversor y Limpiador de PDF/EPUB a Texto TTS

**Dr. Media** es una aplicación web de procesamiento de documentos que transforma libros, artículos y literatura académica en formato **PDF y EPUB** en transcripciones limpias, continuas y optimizadas para lectores y sintetizadores de voz (*Text-to-Speech* o TTS).

Combina extracción y normalización local en el navegador, Web Workers para corrección ortográfica offline y soporte para múltiples proveedores de Inteligencia Artificial (**Gemini, Groq, Cerebras, OpenRouter y Hugging Face**) para eliminar ruidos de lectura como cabeceras, números de página, pies de página, tablas, citas entre corchetes y listas de referencias bibliográficas.

> El resultado son archivos `.txt` (documentos cortos) o `.epub` con capítulos (documentos largos) listos para cargar en cualquier lector de voz externo. La app **no reproduce audio por sí misma**.

* **Repositorio oficial (GitHub):** [https://github.com/simonmedinapsiquiatra-bot/PDF-to-text-for-voice](https://github.com/simonmedinapsiquiatra-bot/PDF-to-text-for-voice)
* **Plataforma de despliegue:** Configurado para **Vercel** (despliegue continuo desde la rama `main`).

---

## ✨ Características Principales

* **Limpieza Híbrida (Local + IA)**:
  * **Extracción Local Rápida**: Desguionizado, recomposición de palabras partidas entre líneas y páginas, expansión de siglas médicas/técnicas, omisión de bloques de referencias y colaboradores, y limpieza mediante heurísticas deterministas. Conserva los decimales (`94.16`, `5.1.18`) y los rangos de una lista de categorías (`mild (10–13), moderate (14–20)`), que antes se confundían con notas al pie y citas.
  * **Títulos de sección en su sitio**: los marcadores nativos del PDF se colocan en la línea donde aparece cada título (no al principio de la página), usando todos los marcadores de cada página.
  * **Procesamiento Asistido por IA**: Reescritura y formateo continuo en párrafos naturales sin interrupciones, listo para TTS.
* **Texto pensado para escuchar** (reglas del prompt de TTS, en inglés y español):
  * **Cifras**: conserva sin redondear las que sostienen los hallazgos (muestras, porcentajes principales, *odds ratios*, puntos de corte, años) y quita la notación secundaria (desviaciones típicas, intervalos de confianza, estadísticos W/F/t, grados de libertad, `n =`), o la dice con palabras.
  * **Listas largas**: más de cuatro elementos con cifras se resumen con los más relevantes y el rango.
  * **Símbolos y paréntesis**: nunca deja `<`, `>`, `≤`, `≥` ni `=`; evita los paréntesis y presenta las etiquetas con "known as" / "conocido como".
  * **Siglas**: cada escala se presenta una sola vez ("the Multidimensional Inventory of Dissociation, known as the MID-60"); las siglas con cifras se escriben como en el original (`OSDD-1`, `DSM-5-TR`); las que solo se definían en una leyenda se desarrollan.
  * **Autores y cabecera**: con más de dos autores, el primero y "y colaboradores"; título, autores y revista en frases separadas.
  * **Tablas y figuras**: una o dos frases naturales ("La tabla 1 muestra…"), una sola vez y al final del párrafo, nunca en mitad de una frase.
  * **Bloques de continuación**: los bloques posteriores al primero reciben un aviso para no volver a presentar el título, los autores ni las escalas.
* **Modo de lectura** (se elige en "Selección para IA" y se recuerda para la próxima vez):
  * **Fiel al original**: aplica las reglas de cifras anteriores; conserva los números clave tal cual.
  * **Interpretado para escuchar**: pensado para escuchar un *paper* sin formación estadística. Reduce las cifras al mínimo (muestra, porcentajes clave, puntos de corte) y traduce las estadísticas a lenguaje claro: correlaciones como relación débil, moderada o fuerte; *odds ratios* como "unas cinco veces más probable"; valores p como "estadísticamente significativo"; tamaños del efecto como pequeño, mediano o grande. Resume los métodos estadísticos en una o dos frases y nunca añade conclusiones que los autores no sacan. El archivo se descarga con el sufijo ", interpretado".
* **Soporte Multi-Proveedor de IA** (con cadena de *fallback* automática):
  * **Google Gemini** — modelos seleccionables: `gemini-3.8-flash` (por defecto y recomendado), `gemini-3.6-flash`, `gemini-3.5-flash-lite`, además del modo *Auto* (usa 3.8 Flash). Si había guardado un modelo que Google retiró, la app lo cambia por su sustituto: 3.7 Flash → 3.8 Flash y 3.5 Flash → 3.6 Flash.
  * **Groq** — `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen-qwq-32b`.
  * **Cerebras** — `gpt-oss-120b`.
  * **OpenRouter** — `openrouter/free`, `nvidia/nemotron-3-ultra:free`.
  * **Hugging Face Inference API** — `Meta-Llama-3.1-8B-Instruct`, `Phi-3.5-mini-instruct`, `Mixtral-8x7B-Instruct-v0.1`.
* **Modo Turbo y Control de Concurrencia**:
  * Rotación *round-robin* entre los proveedores activos con reintentos y espera adaptativa ante límites de tasa (*rate limits* 429).
  * Hilos paralelos por archivo según la configuración: **5** en modo estándar, **10** con Modo Turbo, **15** con la capa *Pay-As-You-Go* de Gemini (en PAYG y en OCR se usa exclusivamente Gemini, sin fallbacks).
  * El texto se divide en bloques de unas **1500 palabras** (máximo 12 páginas) para que cada llamada termine dentro del plazo de la función en Vercel.
* **Filtros de Limpieza Inteligente**:
  * Escaneo automático de líneas redundantes (cabeceras, autores, nombres de revistas, DOIs, ISSN) a través de las páginas de los documentos cargados.
  * Gestión de reglas con persistencia en `localStorage` y exclusión previa a la IA para ahorrar tokens y tiempo.
* **Herramienta de Limpieza Manual (Point-and-Click)**:
  * Visor interactivo del texto extraído para buscar, seleccionar y purgar patrones o cadenas repetitivas en todo el documento antes de enviarlo a la IA.
* **Corrector Ortográfico Hunspell Offline**:
  * Web Worker en segundo plano con diccionarios de español e inglés (`typo-js` + archivos `.aff`/`.dic` servidos localmente) para resolver errores de OCR y ligaduras sin enviar datos al exterior.
  * Solo se aplica a la extracción local: el texto de la IA ya viene corregido. No toca palabras con mayúscula inicial (apellidos, escalas) ni términos que se repiten en el documento.
* **Doble Flujo OCR para Documentos Escaneados**:
  * **OCR local (Tesseract.js)**: si una página no contiene texto digital, se renderiza a canvas y se transcribe en el navegador.
  * **OCR multimodal (Gemini)**: cuando el PDF completo se detecta como escaneado (promedio de caracteres por página muy bajo), se divide con `pdf-lib` en sub-PDFs de 5 páginas y se envían en binario (base64, `application/pdf`) al modelo para su transcripción. Si un sub-PDF supera el límite de envío de Vercel (4,5 MB), se parte por la mitad hasta que cada trozo quepa; una página suelta que no cabe se marca como error sin reintentos inútiles.
* **Procesamiento Selectivo y por Capítulos**:
  * Modal de selección flexible: procesar todo el documento, un rango de páginas específico o capítulos detectados mediante marcadores e índices nativos del PDF/EPUB.
* **Caché Persistente en IndexedDB**:
  * Base `DrMediaCacheDB` que almacena resultados por hash **SHA-256** del contenido para evitar llamadas redundantes a las APIs y permitir reanudación instantánea. Incluye la casilla *Ignorar caché previo* al iniciar la IA y la opción de restablecer la caché de un documento concreto.
* **Extracción de Metadatos y Renombrado Automático**:
  * La IA identifica título, autor y año (descartando nombres de revistas y etiquetas de sección) y los usa para nombrar el archivo exportado: `(Año)(Título)(Autor).epub`.
* **Tokens y coste por documento**:
  * Al terminar la IA, el registro y la tarjeta del documento muestran los tokens usados (entrada, salida y razonamiento, tal como los informa el proveedor), cuántas llamadas se hicieron y cuántas salieron de la caché, y un **coste estimado en USD**.
  * El coste usa las tarifas de referencia de `src/ia/tarifas.ts` (el razonamiento se cobra como salida); la factura real puede variar. Los proveedores sin tarifa cuentan sus tokens pero no su coste.
* **Revisión de Fronteras entre Bloques**:
  * Una pasada adicional (`boundary_merge`) sutura los límites entre lotes procesados para evitar frases cortadas o repetidas en el ensamblado final.
* **Exportación**:
  * Documentos de **más de 50 páginas** → `.epub` generado con JSZip, con capítulos, `content.opf` y `toc.ncx`.
  * Documentos más cortos → `.txt` plano.
  * Descarga individual o de todos los documentos de la sesión (texto original extraído y/o texto limpio por IA), además de copiado al portapapeles.
* **PWA con soporte offline**:
  * `manifest.json` para instalación como aplicación y Service Worker (`sw.js`) que precachea el *app shell* y las librerías principales.
* **Interfaz**:
  * **Estado del proceso**: una línea en lenguaje claro con la última novedad; el registro técnico completo (canales, proveedores, reintentos y errores) queda plegado tras "Ver detalle".
  * **Indicador de IA**: "IA lista (Gemini, Groq…)" cuando hay claves guardadas en el navegador, o "IA vía servidor" cuando se usarán las del servidor.
  * **Tarjeta de cada documento**: el título detectado como encabezado, un solo botón destacado por paso (Iniciar Limpieza IA o Descargar Limpio) y solo los pasos de progreso que aplican.

---

## 🏗️ Arquitectura y Flujo de Procesamiento

El sistema opera con un frontend en TypeScript (Vite + Tailwind CSS) y un backend unificado que expone `/api/gemini` como proxy para todos los proveedores de IA (las claves nunca se envían directamente desde el navegador a las APIs externas). Este backend corre localmente con Express (`server.ts`) y en producción como Serverless Function nativa en Vercel (`api/gemini.ts`, configurada con 300 s en `vercel.json`, el máximo del plan Hobby con Fluid Compute). La cascada de proveedores se corta a los 280 s y responde un 504 claro, que el navegador reintenta, en vez de dejar que Vercel mate la función. Las peticiones a Gemini piden razonamiento bajo (`thinkingLevel: low`): los modelos 3.x razonan a nivel medio por defecto, lo que alarga cada respuesta sin mejorar la limpieza del texto.

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
│  - Bloques de ~1500 palabras (OCR: 5 págs. bajo 4,5 MB)     │
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
│  - Corrección por IA (Hunspell solo en la extracción local) │
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
│   └── gemini.ts              # Handler del proxy: valida la petición, arma el payload y responde
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
│   ├── ia/                    # Módulos que solo usa el handler. Fuera de api/ porque
│   │                           # Vercel convierte en función cada fichero de ese directorio
│   │   ├── origen.ts          # Qué webs pueden usar el proxy (mismo dominio + ORIGENES_PERMITIDOS)
│   │   ├── prompts.ts         # Prompts de sistema (corregir, TTS, uniones y metadatos)
│   │   ├── tarifas.ts         # Tarifas de referencia y recuento de tokens y coste por documento
│   │   └── proveedores.ts     # Cascada Gemini → Groq → Cerebras → OpenRouter → Hugging Face, con plazo de 280 s y razonamiento bajo
│   └── utils/                 # Fuente única de la limpieza: la comparten la app,
│                               # las pruebas y los scripts de evaluación
│       ├── cacheIA.ts         # Caché IndexedDB de respuestas de la IA (sin las claves en el hash)
│       ├── charClasses.ts     # Clases de caracteres con diacríticos
│       ├── marcadores.ts      # Coloca los títulos de sección en la línea donde aparecen
│       ├── ocrPorTamano.ts    # Reparte el OCR en sub-PDFs bajo el límite de 4,5 MB de Vercel
│       ├── ortografia.ts      # Palabras que Hunspell no corrige (nombres propios, términos repetidos)
│       ├── reintentos.ts      # Clasificación de errores y espera entre reintentos
│       ├── textCleaner.ts     # Limpieza estructural del texto extraído
│       ├── textRules.ts       # Idioma, siglas, referencias y títulos de portada
│       └── pdfLayout.ts       # Orden de lectura y extracción por página (PDF.js)
├── tests/
│   ├── limpieza.test.js       # Pruebas de omisión de referencias, colaboradores y conflictos de interés
│   ├── correcciones.test.js   # Pruebas de desguionado, siglas, uniones y limpieza local
│   ├── proxy.test.js          # Pruebas de origen permitido, reparto OCR, clave de caché y plazo de la cascada
│   ├── reintentos.test.js     # Pruebas de clasificación de errores y esperas
│   └── tts.test.js            # Pruebas de títulos de sección, corrector, siglas duplicadas y prompts de TTS
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
├── vercel.json                # Tiempo máximo de ejecución de la función /api/gemini
└── vite.config.js             # Configuración del empaquetador Vite
```

> **Despliegue en Vercel:** el runtime de Node transpila `api/*.ts` fichero a
> fichero (no los empaqueta) y despliega solo los `.js` resultantes. Por sí solo
> no reescribe los especificadores, así que un `import ... from './prompts.ts'`
> apuntaría a un fichero que no existe en la función y la tumbaría al arrancar
> con `ERR_MODULE_NOT_FOUND` (HTTP 500 `FUNCTION_INVOCATION_FAILED` en cada
> petición). De eso se encarga `rewriteRelativeImportExtensions` en
> `tsconfig.json`: el emitido importa `./prompts.js`, que sí se despliega.
>
> Por eso mismo los módulos del handler viven en `src/ia/` y no en `api/`:
> Vercel convierte en función cada fichero de `api/`, y un módulo auxiliar allí
> quedaría expuesto como un endpoint sin manejador.

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
# Opcional: otros dominios, separados por comas, que pueden usar /api/gemini
ORIGENES_PERMITIDOS=https://mi-dominio.com
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

### 5. Compilar y Servir en Producción (Node.js Local)
```bash
npm run build      # Genera dist/ (cliente Vite + dist/server.cjs con esbuild)
NODE_ENV=production npm start
```
> `NODE_ENV=production` es necesario: sin esa variable el servidor intenta levantar el middleware de desarrollo de Vite.

---

## ☁️ Despliegue en Producción (Vercel)

La aplicación está preparada para ejecutarse en **Vercel** como una arquitectura híbrida de SPA estática y funciones Serverless:

* **Repositorio vinculado:** Conectado al repositorio de GitHub [`simonmedinapsiquiatra-bot/PDF-to-text-for-voice`](https://github.com/simonmedinapsiquiatra-bot/PDF-to-text-for-voice).
* **Despliegue Continuo (CI/CD):** Cada `git push` o fusión de Pull Request a la rama `main` dispara automáticamente un despliegue de producción en Vercel.
* **Frontend estático:** Vite genera los archivos compilados en `dist/`, distribuidos a través del CDN global de Vercel.
* **Serverless Function (Proxy de IA):** El archivo [`api/gemini.ts`](api/gemini.ts) opera de forma nativa como función sin servidor en la ruta `/api/gemini` (con tiempo límite de 300 segundos configurado en [`vercel.json`](vercel.json)), gestionando de forma segura las consultas hacia Gemini, Groq, Cerebras, OpenRouter y Hugging Face.
* **Variables de Entorno en Vercel:** Puedes configurar las API Keys predeterminadas en el panel de Vercel (*Settings > Environment Variables*):
  * `GEMINI_API_KEY`
  * `GROQ_API_KEY`
  * `CEREBRAS_API_KEY`
  * `OPENROUTER_API_KEY`
  * `HUGGINGFACE_API_KEY`
  * `ORIGENES_PERMITIDOS` (opcional): otros dominios, separados por comas, que pueden usar `/api/gemini`. El dominio propio de la app no hace falta añadirlo.
  
  *(Nota: Los usuarios también pueden configurar sus propias API Keys personales desde la interfaz de la aplicación. Se guardan sin cifrar en el navegador y viajan al proxy en cada petición, que las usa y no las almacena).*

---

## ⚙️ Configuración de Proveedores de IA

Desde el botón **"Configuración API"** (icono de engranaje) en la barra superior puedes:
1. **Elegir la capa de uso de Gemini:** *Capa Gratuita* (límites de Google, con fallbacks a otros proveedores activos) o *Pay-As-You-Go / Prepago*. La opción prepago es la más rápida (con Gemini 3.8 Flash un artículo suele costar unos céntimos; consulta las tarifas actuales en Google AI Studio), elimina pausas por rate limits y habilita hasta 15 hilos en paralelo.
2. **Seleccionar el Modelo:** modo *Auto* o un modelo Gemini específico de la generación actual:
   * **`gemini-3.8-flash`** *(Recomendado y por defecto)*: El modelo Flash estable más reciente (septiembre de 2026), con contexto de 1M tokens.
   * **`gemini-3.6-flash`**: Alternativa estable. Google podría retirarlo pronto; si deja de responder, la cascada pasa a los siguientes modelos.
   * **`gemini-3.5-flash-lite`**: Máxima velocidad y consumo reducido de tokens.
   *(Nota: Google marcó como obsoletos Gemini 3.7 Flash y 3.5 Flash en octubre de 2026 y redirige sus peticiones a 3.8 Flash y 3.6 Flash; la app ya no los ofrece. Gemini 2.5 está discontinuado.)*
3. **Ingresar API Keys:** claves personales de Gemini, Groq, Cerebras, OpenRouter o Hugging Face (con enlaces directos a cada consola).
4. **Activar Modo Turbo:** procesa con 10 canales concurrentes rotando entre los proveedores activos.
5. **Gestionar Filtros Inteligentes:** escanear los documentos cargados para identificar y suprimir textos repetitivos automáticamente.

---

## 🔒 Privacidad

- La extracción, la limpieza local y la corrección ortográfica Hunspell ocurren **íntegramente en el navegador**.
- Solo el texto (o los bloques PDF en el flujo OCR) enviado a la fase de IA sale del equipo, y siempre a través del proxy local `/api/gemini` hacia el proveedor elegido.
- Las claves introducidas en la interfaz se guardan sin cifrar en el `localStorage` del navegador y se envían al proxy en cada petición, que no las almacena; las del archivo `.env` o de Vercel permanecen en el servidor.
- El proxy `/api/gemini` solo atiende peticiones del propio dominio de la app y de los orígenes listados en `ORIGENES_PERMITIDOS`; responde 403 a cualquier otro. Esto impide que otra web gaste las claves del servidor desde el navegador de sus visitantes, pero un script fuera del navegador puede falsificar la cabecera `Origin`: si hay claves guardadas en Vercel, conviene además una regla de límite de peticiones en el firewall del proyecto.

---

## 🩺 Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Al reprocesar sale el mismo resultado que antes | La caché de IndexedDB devuelve la respuesta guardada. Al iniciar la limpieza con IA, marca **Ignorar caché previo**, o restablece la caché del documento con el icono de papelera de su tarjeta. |
| `403 Origen no permitido` | La app se abre desde un dominio distinto al del proyecto en Vercel. Añádelo a `ORIGENES_PERMITIDOS`. |
| `504` / "Timeout" en algunos bloques | Un proveedor tardó más de 280 s. La app reintenta sola; si es frecuente, prueba un modelo más rápido (`gemini-3.5-flash-lite`) o la capa *Pay-As-You-Go*. |
| Bloque OCR "demasiado grande" | Una sola página escaneada supera los 4,5 MB que admite Vercel. Usa el OCR local o reduce la resolución del PDF. |
| "IA vía servidor" en la cabecera | No hay claves guardadas en este navegador; se usarán las del servidor si existen. Añade las tuyas en Configuración. |

---

## 📄 Licencia

Este proyecto está bajo la licencia **ISC**.
