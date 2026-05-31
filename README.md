# 📚 Dr. Media - Transcriptor Total (Optimizado para TTS)

Esta es una aplicación web ultra-premium basada en **Google Apps Script** y la **API de Gemini (Google AI)** diseñada para transcribir, limpiar y optimizar libros y documentos PDF de forma que sean perfectos para motores de **Texto a Voz (Text-to-Speech / TTS)**.

El objetivo principal es eliminar de forma inteligente cualquier obstáculo de lectura en audio (como citas bibliográficas parentéticas, guiones de salto de línea, URLs complejas, llamadas a figuras/tablas, números romanos y abreviaturas) e integrar de forma fluida las notas al pie dentro de la lectura principal, asegurando una pronunciación y coherencia perfectas.

---

## 🎯 ¿Cómo funciona? (Estrategia de Triple Canal: Extracción + IA + Calidad Lingüística)

La aplicación implementa una **estrategia de tres fases secuenciales** para superar los límites de tamaño de archivo y tiempo de ejecución, combinando velocidad local y razonamiento semántico avanzado:

### Fase 1: Extracción Local y Reconstrucción de Diseño (Layout-Aware)
El usuario carga un archivo PDF en el navegador mediante drag-and-drop. De inmediato, la aplicación realiza:
*   **Extracción Paralela Local**: Extrae texto usando PDF.js en paralelo (hasta 3 hilos concurrentes).
*   **Detección e Hilado de Doble Columna (Multi-column segmenter)**: Analiza el histograma de coordenadas horizontales (`x`) de todos los fragmentos y calcula el espacio del canal central (gutter). Si detecta un diseño de doble columna (menos del 15% de líneas cruzando el centro), segmenta la página en dos y une la columna izquierda primero, seguida de la columna derecha. **¡Esto elimina por completo el mezclado de frases que arruina la lógica de lectura!**
*   **Omisión Selectiva de Tablas en Local**: Remueve automáticamente tablas completas en el flujo de texto local utilizando una heurística inteligente (detectando marcadores como `Tabla \d+` y evaluando la vuelta al texto discursivo normal). Esto previene que filas sueltas, celdas rotas o números dispersos de tablas interrumpan la narración TTS offline.
*   **Deduplicación Dinámica**: Detecta y elimina automáticamente cabeceras y pies de página recurrentes analizando la coincidencia inter-página, sin necesidad de escribir reglas manuales por libro.
*   **Reconstrucción de Párrafos**: Elimina los saltos de línea molestos de PDF si la línea anterior no termina en puntuación fuerte, generando párrafos continuos y naturales.
*   **Fusión Inteligente de Guiones (De-hyphenation)**: Une palabras cortadas por límites de margen (ej. `medi- \ncina` a `medicina`).
*   **Colapso de Texto Vertical**: Detecta y elimina marcas de agua o textos verticales en los márgenes.

### Fase 2: Adaptación Semántica por IA (Modelos Gemini)
Si el usuario requiere una adaptación más compleja, puede pulsar "Iniciar IA". El archivo se fragmentará en bloques de 5 páginas y se enviará al servidor de Google Apps Script utilizando el modelo Gemini seleccionado en la configuración:
*   **Limpieza Estructural Estricta**: La IA elimina por completo bibliografías, secciones de referencias al final y afiliaciones de autores.
*   **Notas al Pie en Línea**: Inserta notas explicativas inmediatamente después del concepto aludido en el párrafo principal mediante paréntesis o comas de forma natural.
*   **Traducción de Números Romanos**: Traduce números romanos a palabras legibles según el contexto (ej. `"Siglo XX"` a `"Siglo veinte"` o `"Capítulo IV"` a `"Capítulo cuatro"`).
*   **Tratamiento Semántico de Tablas**: A diferencia del flujo local, la IA no borra las tablas, sino que las interpreta y reescribe de forma continua y narrada, convirtiendo datos duros en explicaciones perfectamente fluidas para ser leídas por voz.

### Fase 3: Control de Calidad Lingüístico y Corrección Ortográfica Híbrida
Tanto al final del procesamiento local como del de la IA, el texto pasa por un módulo de calidad lingüística bilingüe autodetectado:
1.  **Normalización Unicode NFC**: Resuelve instantáneamente y sin conexión a Internet los molestos acentos y diacríticos rotos u OCR flotantes comunes de los PDFs (ej: transforma `cl ínica` en `clínica`, `desarroll ó` en `desarrolló`, `relació n` en `relación`).
2.  **Autodetección de Idioma**: Analiza la frecuencia de palabras funcionales comunes (*el, de, y* en español vs. *the, of, and* en inglés) para decidir qué conjunto de diccionarios y reglas aplicar.
3.  **Corrección Ortográfica Inteligente (Opción A - Gemini)**: Envía los bloques de texto a Gemini Flash con un prompt ultra-enfocado a la restauración gramatical, que cura de forma contextual palabras inexistentes o ligaduras mal interpretadas (`mostrí ó` $\rightarrow$ `mostró`, `tenaní` $\rightarrow$ `tenían`), **respetando en todo momento la jerga y tecnicismos médicos**.
4.  **Fallback de Diccionarios Locales (Opción B - Typo.js offline)**: Si la cuota de la API se excede o hay problemas de conexión, el sistema carga en milisegundos los diccionarios hunspell completos en español o inglés desde una red de CDN global (jsDelivr), escanea el texto en busca de errores e imprime un diagnóstico de palabras sospechosas en la consola interactiva.
5.  **Diccionario Bilingüe de Siglas Clínicas y Dosis**: Traduce acrónimos a su equivalente hablado natural según el idioma del documento (ej. en español `TCA` $\rightarrow$ *"trastorno de la conducta alimentaria"*, en inglés `TCA` $\rightarrow$ *"tricyclic antidepressant"*; `mg` $\rightarrow$ *"miligramos"*, `mcg`/`μg` $\rightarrow$ *"microgramos"*) evitando acrónimos ambiguos como `IV` o `EV` para que no colisionen con números romanos en los capítulos del libro.

---

## 🧠 Diccionario de Siglas Psiquiátricas y Unidades Médicas Integradas

Para garantizar que el motor TTS lea las siglas como palabras y no letra por letra, el sistema expande las siguientes nomenclaturas clínicas:

| Sigla / Abrev. | Idioma Detectado: Español (`es`) | Idioma Detectado: Inglés (`en`) |
| :--- | :--- | :--- |
| **TCA** / **TCAs** | trastorno(s) de la conducta alimentaria | tricyclic antidepressant(s) *(Evita colisión)* |
| **AN** / **BN** | anorexia nerviosa / bulimia nerviosa | anorexia nerviosa / bulimia nerviosa |
| **TA** / **BED** | trastorno por atracón | binge eating disorder *( BED es solo mayúsculas)* |
| **TOC** / **OCD** | trastorno obsesivo compulsivo | obsessive-compulsive disorder |
| **TAG** / **GAD** | trastorno de ansiedad generalizada | generalized anxiety disorder |
| **TDAH** / **ADHD** | trastorno por déficit de atención e hiperactividad | attention-deficit hyperactivity disorder |
| **TEA** / **ASD** | trastorno del espectro autista | autism spectrum disorder |
| **TLP** / **BPD** | trastorno límite de la personalidad | borderline personality disorder |
| **TAB** / **BD** | trastorno afectivo bipolar | bipolar disorder |
| **TDM** / **MDD** | trastorno depresivo mayor | major depressive disorder |
| **TEPT** / **PTSD** | trastorno de estrés postraumático | post-traumatic stress disorder |
| **TEPT-C** / **CPTSD** | trastorno de estrés postraumático complejo | complex post-traumatic stress disorder |
| **TUS** / **SUD** | trastorno por uso de sustancias | substance use disorder |
| **TID** / **DID** | trastorno de identidad disociativo | dissociative identity disorder |
| **TDC** / **BDD** | trastorno dismórfico corporal | body dysmorphic disorder |
| **TEC** / **ECT** | terapia electroconvulsiva | electroconvulsive therapy |
| **TCC** / **CBT** | terapia cognitivo conductual | cognitive behavioral therapy |
| **EMDR** | desensibilización por movimientos oculares | eye movement desensitization and reprocessing |
| **EMTr** / **rTMS** | estimulación magnética transcraneal repetitiva | repetitive transcranial magnetic stimulation |
| **PANSS** | escala de los síndromes positivo y negativo | positive and negative syndrome scale |
| **IMC** / **BMI** | índice de masa corporal | body mass index |
| **APA** | Asociación Psiquiátrica Americana | American Psychiatric Association |
| **mg** / **ml** | miligramos / mililitros | milligrams / milliliters |
| **mcg** / **μg** | microgramos | micrograms |
| **g** / **kg** | gramos / kilogramos *(con número previo)* | grams / kilograms *(con número previo)* |

---

## ✨ Características de Diseño y UI (Ultra-Premium)

*   **Estética Moderna e Interfaz Oscura**: Diseño elegante y futurista optimizado con **Tailwind CSS** y la tipografía **Outfit** de Google Fonts.
*   **Tarjetas de Archivos Individuales**: Cada archivo cargado obtiene su propia tarjeta interactiva con metadatos, tipo de documento (Texto Digital o Escaneado), barra de progreso individual y acciones independientes.
*   **Zona Dropzone Interactiva**: Área de drag-and-drop para cargar múltiples PDFs simultáneamente.
*   **Barra de Progreso Dual**: Visualización en tiempo real del progreso de la extracción local y, de ser iniciada, una barra secundaria para el procesamiento asíncrono en la nube.
*   **Consola de Log Interactiva (Terminal)**: Terminal en pantalla que muestra el flujo de trabajo en tiempo real, desde los recuentos del OCR local y la deduplicación, hasta el progreso de la corrección de diccionarios de Typo.js o cuotas de Gemini.
*   **Selector de Modelos Flexible y Persistencia Segura**: Permite configurar y alternar entre los modelos de la API de Gemini del catálogo activo (incluyendo `gemini-3.1-flash-lite` para máxima velocidad/economía, `gemini-3.5-flash` para OCR óptimo, y `gemini-3.1-pro` para máxima profundidad de razonamiento) con guardado persistente local (`localStorage`) y sincronización automática en la cuenta del usuario en Google (`UserProperties`).

---

## 🏗️ Estructura del Proyecto

```bash
├── Code.gs             # Código backend de Google Apps Script (Procesamiento por fragmentos, API Gemini, corrector por IA)
├── Index.html          # Interfaz premium en Tailwind CSS (PDF.js, motor de diseño doble columna, corrector ortográfico Typo.js)
├── .clasp.json         # Configuración del ID del proyecto Apps Script para clasp push/pull
├── .claspignore        # Archivo para evitar la subida de dependencias locales a Google Apps Script
├── package.json        # Configuración del entorno de pruebas unitarias locales con Node.js
└── tests/              # Suite de pruebas unitarias locales
    ├── loadCode.js     # Entorno virtual de pruebas
    └── reglas.test.js  # Pruebas de parseo y reemplazo
```

---

## ⚙️ Cómo Desplegar en Google Apps Script (Vía CLASP)

Gracias a la configuración de **clasp** integrada en este repositorio, puedes subir y desplegar esta aplicación web de forma instantánea:

### Paso 1: Verificar la configuración del proyecto
El archivo `.clasp.json` ya está configurado con tu ID de Apps Script:
```json
{
  "scriptId": "1545AV3QTLrVm8FZ1X-cwnF4cwkUvg9YGC_7aCf8sYVXKFiRc9tCP5fCm",
  "rootDir": "."
}
```

### Paso 2: Subir el código actualizado
Abre tu terminal en la raíz de este proyecto y ejecuta:
```bash
clasp push
```
Esto subirá inmediatamente `Code.gs`, `Index.html` y el manifest `appsscript.json` a la nube de Google Apps Script, sobreescribiendo las versiones en el servidor con este código premium optimizado.

### Paso 3: Obtener la Aplicación Web
1. Abre tu proyecto en el navegador: [Proyecto Google Apps Script](https://script.google.com/home/projects/1545AV3QTLrVm8FZ1X-cwnF4cwkUvg9YGC_7aCf8sYVXKFiRc9tCP5fCm/edit).
2. Haz clic en el botón azul **Implementar (Deploy)** > **Nueva implementación (New deployment)**.
3. Elige el tipo de implementación **Aplicación web**.
4. Configura:
   *   **Ejecutar como**: `Tú (tu cuenta de Google)`.
   *   **Quién tiene acceso**: `Solo yo` o `Cualquiera` (según tus preferencias).
5. Haz clic en **Implementar** y copia la URL de la aplicación web generada. ¡Ya puedes disfrutar de la experiencia premium de Dr. Media!

---

## 📄 Licencia

Este proyecto está bajo la licencia **ISC**.
