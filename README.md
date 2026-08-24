# 🎧 Dr. Media - Transcriptor Total

**Dr. Media** es una aplicación web de vanguardia diseñada para procesar, limpiar y transformar libros, artículos y documentos académicos (PDF/EPUB) en transcripciones de texto altamente optimizadas para sistemas *Text-to-Speech* (TTS). 

Combina procesamiento local avanzado (NLP), Web Workers para corrección ortográfica offline y la inteligencia artificial multimodal de **Gemini** para generar un flujo de audio sin interrupciones, omitiendo cabeceras, pies de página, tablas, citas y referencias bibliográficas que normalmente romperían la experiencia de escucha.

---

## ✨ Características Principales

* **Limpieza Híbrida Local + IA**: Desguionizado automático, expansión de siglas médicas, omisión de referencias y limpieza de ruidos locales mediante heurística.
* **Limpieza Manual Point-and-Click**: Visor avanzado del texto original que permite al usuario hacer clic en textos basura ("Boberg et al.") y purgarlos globalmente del documento.
* **Filtros de Limpieza Inteligente**: Algoritmo que detecta patrones repetitivos en las páginas (autores, revistas, DOIs) para que el usuario los excluya automáticamente antes de que toquen la IA.
* **Caché Persistente en IndexedDB**: Almacena localmente las respuestas de Gemini (hasheadas) para ahorrar tokens y acelerar reprocesamientos en el mismo documento.
* **Flujo OCR Inteligente**: Para PDFs escaneados, convierte cada página en imágenes y usa Gemini Multimodal para transcribirlas visualmente.
* **Progreso Proporcional de IA (Fases 1, 2 y 3)**: Barra de carga transparente y granular que traza el progreso a través de transcripción de bloques (0-80%), revisión orgánica de fronteras (80-85%) y corrección ortográfica de IA (85-100%).
* **Reproductor TTS Interactivo**: Teleprompter sincronizado que resalta la palabra exacta que el navegador está pronunciando.

---

## 🏗️ Arquitectura del Sistema y Flujo de Datos

El sistema está orquestado casi en su totalidad por el frontend (TypeScript) delegando la seguridad de las claves a un proxy Serverless. El núcleo reside en `src/main.ts`, que coordina la interfaz, los Workers y la IA.

### 1. Extracción Local y Parsing (Fase 1)
Cuando el usuario sube un archivo, el sistema no lo envía a la IA de inmediato. 
* **`procesarArchivoLocal(fileObj)` / `procesarEpubLocal(fileObj)`**: 
  1. Extrae el texto usando `pdf.js` o `epub.js`.
  2. Extrae marcadores nativos (índice) para permitir procesamiento por capítulos.
  3. Ejecuta **Deduplicación Dinámica NLP**: Compara las primeras y últimas líneas de todas las páginas para detectar matemáticamente cabeceras o pies de página recurrentes y eliminarlos del texto crudo.
  4. Pasa por el módulo local `aplicarFiltrosInteligentesAlTexto()` y `removerReferenciasYAutores()` para pre-limpiar el texto y ahorrar tokens.

### 2. Segmentación y Procesamiento de IA (Fase 2)
Una vez extraído el texto local (o si es OCR), el usuario decide enviar el texto a Gemini (`iniciarIAEspecifico`).
* **`ejecutarIAFlujoTexto(fileObj)` / `ejecutarIAFlujoOCR(fileObj)`**:
  * **Chunking**: Divide el libro en bloques de ~10-15 páginas.
  * Lanza múltiples Web Workers ligeros (concurrencia paralela) para procesar múltiples bloques a la vez.
* **`fetchGeminiConCache(payload, label)`**:
  * Es el *Gateway* de IA. Hashea el texto de entrada.
  * Busca en **IndexedDB** (`getFromCache(hash)`). Si el bloque ya fue procesado, devuelve el resultado al instante (0 ms, 0 tokens).
  * Si hay una petición de "Reprocesar" (`ignoreCache = true`), salta la lectura en caché, va al endpoint `/api/gemini`, y sobreescribe (`saveToCache`) con los nuevos resultados.

### 3. Revisión Orgánica y Ensamblado (Fase 3)
La barra de progreso pasa del 80% al 100% en esta fase.
* **`revisarFronterasEntreBatches()`**:
  Analiza la cola del Bloque A y la cabeza del Bloque B. Si detecta que la oración quedó cortada abruptamente (ej. Bloque A termina en "el paciente pre-", Bloque B inicia con "senta fiebre"), llama a un prompt especializado de Gemini que sutura el texto para que el flujo sea perfecto.
* **`aplicarCorreccionOrtograficaCompleta()`**:
  1. Ejecuta el diccionario nativo `initHunspellWorker()` en segundo plano corrigiendo ligaduras OCR obvias.
  2. Expande siglas médicas (`expandirSiglasPsiquiatria()`).
  3. Ejecuta pasadas de corrección contextual usando la IA (Bloques de ~12,000 caracteres) para entender la semántica y corregir errores dependientes de contexto (ej. tildes diacríticas complejas).

### 4. Interfaz, Estado y Reproducción (UI & TTS)
* **`renderFileCard(fileObj)`**: Máquina de estados visual. Se llama después de cada pequeño avance para repintar los porcentajes (`localProgress`, `aiProgress`) y renderizar los botones dinámicamente.
* **`reprocesarArchivoCompleto(fileId)`**: Disparado por el botón "Reprocesar". Resetea el objeto del archivo, inyecta el flag `ignoreCache = true` y lo envía a la Fase 1.
* **`iniciarReproduccionSegmentada()`**: Instancia `SpeechSynthesis`. Detecta los eventos `onboundary` para actualizar la interfaz del teleprompter sincronizando audio y video.

---

## 📂 Estructura de Directorios

```text
├── index.html              # Plantilla HTML base (UI, Modales, Tailwind)
├── api/                    # Backend Serverless (Vercel)
│   └── gemini.ts           # Proxy POST para aislar la clave API de Gemini
├── public/                 # Archivos estáticos y Web Workers
│   └── dictionaries/       # .aff y .dic (Hunspell español e inglés)
├── src/                    
│   ├── main.ts             # 🧠 Orquestador Global (Estado, DOM, flujos, IndexedDB)
│   ├── hunspellWorker.ts   # Web Worker para typo.js offline asíncrono
│   ├── styles/
│   │   └── index.css       # Configuración Tailwind CSS v4
│   └── utils/
│       └── textCleaner.ts  # Regex externas y reglas lingüísticas aisladas
├── tests/                  # Pruebas Unitarias Node.js
│   ├── limpieza.test.js    
│   └── reglas.test.js      
├── vite.config.js          # Configuración de empaquetado
├── tsconfig.json           # Tipados TypeScript
└── package.json            # Dependencias y scripts
```

---

## 🚀 Desarrollo y Despliegue

### Requisitos Locales
- Node.js ≥ 18
- NPM o Yarn

### Instalación y Ejecución Local
```bash
npm install
npm run dev
```
La aplicación se servirá en `http://localhost:5173`. Para usar la IA de forma local sin el backend Serverless de Vercel, deberás introducir tu clave API directamente en el modal de configuración *"Configuración API"*.

### Testing
Para ejecutar la suite de pruebas unitarias sobre las lógicas de limpieza (`textCleaner.ts`):
```bash
npm test
```

### ☁️ Despliegue en Producción (Vercel)
Este repositorio está altamente optimizado para desplegarse de manera nativa en Vercel.

1. Importa el repositorio a tu cuenta de Vercel.
2. Vercel detectará el framework **Vite** automáticamente y ejecutará `npm run build`.
3. Todo el código de `/api` se compilará en **Serverless Functions** Node.js.
4. En la configuración del proyecto (Vercel > Settings > Environment Variables), puedes agregar `GEMINI_API_KEY` para pre-autorizar el backend.

---

## 📜 Licencia
Este proyecto está bajo la licencia **ISC**.
