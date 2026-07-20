# 📚 Dr. Media - Transcriptor Total (Optimizado para TTS)

Esta es una aplicación web ultra-premium basada en **Vercel** (con backend en **Serverless Functions** de Node.js) y la **API de Gemini (Google AI)** diseñada para transcribir, limpiar y optimizar libros y documentos PDF de forma que sean perfectos para motores de **Texto a Voz (Text-to-Speech / TTS)**.

El objetivo principal es eliminar de forma inteligente cualquier obstáculo de lectura en audio (como citas bibliográficas parentéticas, guiones de salto de línea, URLs complejas, llamadas a figuras/tablas, números romanos y abreviaturas) e integrar de forma fluida las notas al pie dentro de la lectura principal, asegurando una pronunciación y coherencia perfectas.

---

## 🎯 ¿Cómo funciona? (Estrategia de Triple Canal: Extracción + IA + Calidad Lingüística)

La aplicación implementa una **estrategia de tres fases secuenciales** para superar los límites de tamaño de archivo y tiempo de ejecución, combinando velocidad local y razonamiento semántico avanzado:

### Fase 1: Extracción Local y Reconstrucción de Diseño (Layout-Aware)

El usuario carga un archivo PDF en el navegador mediante drag-and-drop. De inmediato, la aplicación realiza:

* **Extracción Paralela Local**: Extrae texto usando PDF.js en paralelo (hasta 3 hilos concurrentes).
* **Extracción Inteligente de Capítulos Nativos (Bookmarks)**: Lee la tabla de contenidos (Outlines) incrustada originalmente en el archivo PDF y correlaciona cada título de capítulo exacto con su número de página para la segmentación y navegación TTS.
* **Detección e Hilado de Doble Columna (Multi-column segmenter)**: Analiza el histograma de coordenadas horizontales (`x`) de todos los fragmentos y calcula el espacio del canal central (gutter). Si detecta un diseño de doble columna (menos del 15% de líneas cruzando el centro), segmenta la página en dos y une la columna izquierda primero, seguida de la columna derecha. **¡Esto elimina por completo el mezclado de frases que arruina la lógica de lectura!**
* **Omisión Selectiva de Tablas en Local**: Remueve automáticamente tablas completas en el flujo de texto local utilizando una heurística inteligente (detectando marcadores como `Tabla \d+` y evaluando la vuelta al texto discursivo normal). Esto previene que filas sueltas, celdas rotas o números dispersos de tablas interrumpan la narración TTS offline.
* **Limpieza de Colaboradores y Bibliografía (Local)**: Detecta y elimina automáticamente largas listas de colaboradores institucionales, afiliaciones y referencias bibliográficas al final de los capítulos utilizando heurísticas avanzadas, asegurando una lectura limpia ininterrumpida sin consumir llamadas de IA.
* **Deduplicación Dinámica**: Detecta y elimina automáticamente cabeceras y pies de página recurrentes analizando la coincidencia inter-página, sin necesidad de escribir reglas manuales por libro.
* **Reconstrucción de Párrafos**: Elimina los saltos de línea molestos de PDF si la línea anterior no termina en puntuación fuerte, generando párrafos continuos y naturales.
* **Fusión Inteligente de Guiones (De-hyphenation)**: Une palabras cortadas por límites de margen (ej. `medi- \ncina` a `medicina`).
* **Colapso de Texto Vertical**: Detecta y elimina marcas de agua o textos verticales en los márgenes.

### Fase 2: Selección Pre-IA y Adaptación Semántica (Modelos Gemini)

Si el usuario requiere una adaptación más compleja, puede pulsar "Iniciar IA", lo que abrirá el **Modal interactivo de Selección Pre-IA**:
* **Optimización Quirúrgica**: Permite al usuario procesar todo el libro, seleccionar un *rango numérico de páginas*, o elegir **capítulos específicos** en base a los marcadores nativos del PDF.
* **Nombramiento Dinámico**: El nombre del archivo exportado reflejará automáticamente qué partes se procesaron (ej. `(Caps 1-3).epub`).

Una vez hecha la selección, el archivo se fragmentará en bloques dinámicos basados en densidad de palabras (~2500 palabras por bloque) y se enviará al backend de Vercel en la nube (`/api/gemini`):

* **Limpieza Estructural Estricta**: La IA elimina por completo bibliografías, secciones de referencias al final y afiliaciones de autores.
* **Notas al Pie en Línea**: Inserta notas explicativas inmediatamente después del concepto aludido en el párrafo principal mediante paréntesis o comas de forma natural.
* **Traducción de Números Romanos**: Traduce números romanos a palabras legibles según el contexto (ej. `"Siglo XX"` a `"Siglo veinte"` o `"Capítulo IV"` a `"Capítulo cuatro"`).
* **Tratamiento Semántico de Tablas**: A diferencia del flujo local, la IA no borra las tablas, sino que las interpreta y reescribe de forma continua y narrada, convirtiendo datos duros en explicaciones perfectamente fluidas para ser leídas por voz.

### Exportación Dinámica (TXT vs EPUB)
El sistema decide de forma inteligente el formato de exportación dependiendo de la longitud del documento original:
* **Libros extensos (> 50 páginas originales)**: Exportados automáticamente en **formato `.epub`**. Contienen los marcadores de capítulo completamente funcionales basados en la extracción original y están altamente optimizados para ser leídos por *Voice Aloud Reader* u otras aplicaciones TTS.
* **Artículos y Papers (< 50 páginas originales)**: Exportados en texto plano (`.txt`) para simplificar y aligerar la lectura de documentos cortos.

### Fase 3: Control de Calidad Lingüístico y Corrección Ortográfica Híbrida

Tanto al final del procesamiento local como del de la IA, el texto pasa por un módulo de calidad lingüística bilingüe autodetectado:

1. **Normalización Unicode NFC**: Resuelve instantáneamente y sin conexión a Internet los molestos acentos y diacríticos rotos u OCR flotantes comunes de los PDFs (ej: transforma `cl ínica` en `clínica`, `desarroll ó` en `desarrolló`, `relació n` en `relación`).
2. **Autodetección de Idioma**: Analiza la frecuencia de palabras funcionales comunes (*el, de, y* en español vs. *the, of, and* en inglés) para decidir qué conjunto de diccionarios y reglas aplicar.
3. **Corrección Ortográfica Inteligente (Opción A - Gemini)**: Envía los bloques de texto a la API de Gemini (Serverless) con un prompt ultra-enfocado a la restauración gramatical, que cura de forma contextual palabras inexistentes o ligaduras mal interpretadas (`mostrí ó` → `mostró`, `tenaní` → `tenían`), **respetando en todo momento la jerga y tecnicismos médicos**.
4. **Corrección Hunspell en Hilo Secundario (Opción B - Web Worker)**: Botón interactivo en cada tarjeta de archivo que permite aplicar corrección ortográfica local usando un **Web Worker nativo estándar**. Esto descarga los diccionarios (.aff y .dic) bajo demanda en segundo plano (ahorrando megabytes en el peso inicial de la app) y realiza la corrección sin congelar la pestaña ni un solo milisegundo. Si los cambios no satisfacen al usuario, puede revertirlos instantáneamente con el botón **"Volver a Versión Pura"**.
5. **Diccionario Bilingüe de Siglas Clínicas y Dosis**: Traduce acrónimos a su equivalente hablado natural según el idioma del documento (ej. en español `TCA` → *"trastorno de la conducta alimentaria"*, en inglés `TCA` → *"tricyclic antidepressant"*; `mg` → *"miligramos"*, `mcg`/`μg` → *"microgramos"*).
6. **Expansión Avanzada de Números Romanos (I–XXX)**: Convierte números romanos del I al XXX a sus equivalentes en palabras (ordinales y cardinales), con salvaguardas inteligentes mediante lookbehind/lookahead negativos para proteger iniciales de nombres propios (ej. `Dr. J. I. Castro` no se modifica, pero `siglo XX` se convierte a `siglo veinte`).

---

## 🧠 Diccionario de Siglas Psiquiátricas y Unidades Médicas Integradas

Para garantizar que el motor TTS lea las siglas como palabras y no letra por letra, el sistema expande las siguientes nomenclaturas clínicas:

| Sigla / Abrev.                              | Idioma Detectado: Español (`es`)                          | Idioma Detectado: Inglés (`en`)                  |
| :------------------------------------------ | :----------------------------------------------------------- | :-------------------------------------------------- |
| **TCA** / **TCAs**              | trastorno(s) de la conducta alimentaria                      | tricyclic antidepressant(s)*(Evita colisión)*    |
| **AN** / **BN**                 | anorexia nerviosa / bulimia nerviosa                         | anorexia nerviosa / bulimia nerviosa                |
| **TA** / **BED**                | trastorno por atracón                                       | binge eating disorder*( BED es solo mayúsculas)* |
| **TOC** / **OCD**               | trastorno obsesivo compulsivo                                | obsessive-compulsive disorder                       |
| **TAG** / **GAD**               | trastorno de ansiedad generalizada                           | generalized anxiety disorder                        |
| **TDAH** / **ADHD**             | trastorno por déficit de atención e hiperactividad         | attention-deficit hyperactivity disorder            |
| **TEA** / **ASD**               | trastorno del espectro autista                               | autism spectrum disorder                            |
| **TLP** / **BPD**               | trastorno límite de la personalidad                         | borderline personality disorder                     |
| **TAB** / **BD**                | trastorno afectivo bipolar                                   | bipolar disorder                                    |
| **TDM** / **MDD**               | trastorno depresivo mayor                                    | major depressive disorder                           |
| **TEPT** / **PTSD**             | trastorno de estrés postraumático                          | post-traumatic stress disorder                      |
| **TEPT-C** / **CPTSD**          | trastorno de estrés postraumático complejo                 | complex post-traumatic stress disorder              |
| **TUS** / **SUD**               | trastorno por uso de sustancias                              | substance use disorder                              |
| **TID** / **DID**               | trastorno de identidad disociativo                           | dissociative identity disorder                      |
| **TDC** / **BDD**               | trastorno dismórfico corporal                               | body dysmorphic disorder                            |
| **TEC** / **ECT**               | terapia electroconvulsiva                                    | electroconvulsive therapy                           |
| **TCC** / **CBT**               | terapia cognitivo conductual                                 | cognitive behavioral therapy                        |
| **EMDR**                              | desensibilización por movimientos oculares                  | eye movement desensitization and reprocessing       |
| **EMTr** / **rTMS**             | estimulación magnética transcraneal repetitiva             | repetitive transcranial magnetic stimulation        |
| **PANSS**                             | escala de los síndromes positivo y negativo                 | positive and negative syndrome scale                |
| **TP** / **TPs** / **PD** | trastorno(s) de la personalidad                              | personality disorder(s)                             |
| **IMC** / **BMI**               | índice de masa corporal                                     | body mass index                                     |
| **APA**                               | Asociación Psiquiátrica Americana                          | American Psychiatric Association                    |
| **ISRS** / **SSRI**             | inhibidores selectivos de la recaptación de serotonina      | selective serotonin reuptake inhibitor              |
| **IRSN** / **SNRI**             | inhibidores de la recaptación de serotonina y noradrenalina | serotonin-norepinephrine reuptake inhibitor         |
| **mg** / **ml**                 | miligramos / mililitros                                      | milligrams / milliliters                            |
| **mcg** / **μg**               | microgramos                                                  | micrograms                                          |
| **g** / **kg**                  | gramos / kilogramos*(con número previo)*                  | grams / kilograms*(con número previo)*           |

### Números Romanos Expandidos (I–XXX)

| Romano     | Español                                                                                                                  |
| :--------- | :------------------------------------------------------------------------------------------------------------------------ |
| I – X     | primero, segundo, tercero, cuarto, quinto, sexto, séptimo, octavo, noveno, décimo                                       |
| XI – XX   | once, doce, trece, catorce, quince, dieciséis, diecisiete, dieciocho, diecinueve, veinte                                 |
| XXI – XXX | veintiuno, veintidós, veintitrés, veinticuatro, veinticinco, veintiséis, veintisiete, veintiocho, veintinueve, treinta |

> **Salvaguarda de iniciales**: Las reglas para `I` y `V` utilizan lookbehind/lookahead negativos avanzados para no reemplazar iniciales de nombres propios (ej. `Dr. J. I. Castro` permanece intacto).

---

## ✨ Características de Diseño y UI (Ultra-Premium)

* **Estética Moderna e Interfaz Oscura**: Diseño elegante y futurista optimizado con **Tailwind CSS v4** (compilado localmente vía Vite) y la tipografía **Outfit** de Google Fonts.
* **Reproductor TTS Global Integrado**: Un modal global de pantalla completa con controles unificados de audio, permitiendo cambiar de capítulo fácilmente.
* **Resaltado en Tiempo Real (TTS)**: Seguimiento visual de la lectura palabra por palabra gracias a la API `onboundary` de `SpeechSynthesis`, facilitando la inmersión y comprensión del usuario.
* **Integración con Configuración de Voz del Sistema**: Botón de acceso directo a la configuración de voz nativa del dispositivo (como el Narrador de Windows) para cambiar de voz sin salir del contexto.
* **Tarjetas de Archivos Individuales**: Cada archivo cargado obtiene su propia tarjeta interactiva con metadatos, tipo de documento (Texto Digital o Escaneado), barra de progreso individual y acciones independientes.
* **Carga Diferida de Diccionarios**: Los diccionarios Hunspell (2 MB) ya no inflan el peso inicial del sitio web. Se descargan asíncronamente desde el servidor sólo cuando el usuario presiona el botón por primera vez.
* **Web Workers Estándar**: Módulo ortográfico Hunspell ejecutándose en segundo plano real nativo del navegador, eliminando congelamientos visuales.
* **Selector de Modelos Flexible**: Permite configurar y alternar entre los modelos de la API de Gemini (como `Gemini 3.5 Flash` predeterminado para escaneos y OCR, `Gemini 3.1 Flash-Lite` para optimización rápida y económica, o `Gemini 3.1 Pro` para máxima calidad y razonamiento) con guardado persistente local (`localStorage`). El backend normaliza automáticamente los prefijos de los modelos (previniendo errores de rutas dobles) y procesa las respuestas de la API de Google de forma defensiva para asegurar la resiliencia del servicio.

---

## 🏗️ Estructura del Proyecto

```
├── Index.html              # Plantilla HTML base (cargada por Vite en desarrollo)
├── api/                    # Backend Serverless para Vercel
│   └── gemini.ts           # Endpoint serverless /api/gemini (Node.js/TS)
├── public/                 # Carpeta pública para descargas asíncronas
│   └── dictionaries/       # Diccionarios Hunspell (.aff y .dic)
├── src/                    # Código fuente TypeScript
│   ├── main.ts             # Orquestador principal (lógica, UI, estado, peticiones fetch)
│   ├── hunspellWorker.ts   # Web Worker que inicializa Typo.js y valida en segundo plano
│   ├── styles/
│   │   └── index.css       # Directivas de Tailwind CSS v4
│   ├── utils/
│   │   ├── textCleaner.ts  # Reglas Regex, OCR, limpieza lingüística
│   │   └── pdfExtractor.ts # Lectura y reconstrucción de columnas PDF
...
├── server/                 # Backend heredado de Google Apps Script (opcional)
│   ├── Code.gs             # Procesamiento en GAS
│   └── appsscript.json     # Manifiesto de GAS
├── vite.config.js          # Configuración de Vite (Tailwind v4)
├── tsconfig.json           # Configuración de TypeScript
└── package.json            # Dependencias NPM y scripts de build
```

---

## ⚙️ Desarrollo y Despliegue

### Prerrequisitos

- Node.js ≥ 18
- NPM

### Instalación

```bash
npm install
```

### Modo de Desarrollo Local (Vite)

```bash
npm run dev
```

Abre `http://localhost:5173`. Para simular la API de Gemini localmente en desarrollo, asegúrate de tener una clave de API configurada en la UI o configura un archivo `.env` local con `GEMINI_API_KEY`.

### Despliegue en Vercel (Recomendado 🚀)

El despliegue en Vercel es automático conectando tu cuenta de GitHub:

1. Conecta el repositorio de GitHub a tu cuenta de Vercel.
2. Vercel detectará que es un proyecto **Vite** y usará el comando de compilación predeterminado (`npm run build`).
3. En la sección **Environment Variables** de Vercel, agrega tu variable `GEMINI_API_KEY` para que las llamadas se realicen automáticamente usando esa clave por defecto (así no tendrás que pegar la clave en la app cada vez).
4. ¡Listo! Vercel creará un enlace permanente rápido con HTTPS seguro.

### Despliegue Heredado en Google Apps Script (Opcional)

Si aún deseas compilar todo a un solo archivo HTML y subirlo a Google Apps Script:

```bash
npm run deploy-clasp
```

---

## 📄 Licencia

Este proyecto está bajo la licencia **ISC**.
