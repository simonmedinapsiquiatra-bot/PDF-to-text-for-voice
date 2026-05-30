# 📚 Dr. Media - Transcriptor Total (Optimizado para TTS)

Esta es una aplicación web ultra-premium basada en **Google Apps Script** y la **API de Gemini (Google AI)** diseñada para transcribir y optimizar libros y documentos PDF de forma que sean perfectos para motores de **Texto a Voz (Text-to-Speech / TTS)**.

El objetivo principal es eliminar de forma inteligente cualquier obstáculo de lectura en audio (como citas bibliográficas parentéticas, guiones de salto de línea, URLs complejas, llamadas a figuras/tablas, números romanos y abreviaturas) e integrar de forma fluida las notas al pie dentro de la lectura principal.

---

## 🎯 ¿Cómo funciona? (Estrategia de Doble Canal: Local + IA)

Para superar los límites de tamaño de archivo y tiempo de ejecución, la aplicación implementa una **estrategia de doble canal**, permitiendo extracción instantánea y procesamiento profundo de IA optativo:

1.  **Carga Local y Extracción Instantánea**: El usuario carga un archivo PDF local en el navegador mediante drag-and-drop. Inmediatamente, la aplicación extrae el texto usando PDF.js en paralelo (hasta 3 hilos concurrentes).
2.  **Algoritmos de NLP Local**: Antes de enviar cualquier texto a la nube, se ejecutan en el navegador complejos algoritmos heurísticos en JavaScript para la limpieza inicial:
    *   **Deduplicación Dinámica**: Detecta y elimina automáticamente cabeceras y pies de página recurrentes analizando la coincidencia inter-página, sin necesidad de escribir reglas manuales por libro.
    *   **Reconstrucción de Párrafos (Heurística de Puntuación)**: Elimina los saltos de línea molestos de PDF si la línea anterior no termina en puntuación, generando párrafos fluidos y naturales.
    *   **Fusión Inteligente de Guiones (De-hyphenation)**: Une palabras cortadas por saltos de página o límites de margen (ej. `medi- \ncina` a `medicina`).
    *   **Colapso de Texto Vertical**: Detecta y elimina marcas de agua o textos verticales en los márgenes.
3.  **Descarga Local Inmediata**: En segundos, el usuario puede descargar el texto ya limpio y optimizado con NLP local para TTS de todos los archivos procesados.
4.  **IA Semántica Optativa (Gemini Flash)**: Si el usuario requiere una adaptación más compleja, puede pulsar el botón de "Iniciar IA" en una tarjeta. El archivo se fragmentará en bloques de 5 páginas y se enviará al servidor de Google Apps Script.
5.  **Adaptación Semántica por IA**: La IA ejecuta una limpieza estructural estricta (eliminando bibliografía, llamadas a tablas) y adapta el texto al oído (integrando notas al pie, traduciendo números romanos y expandiendo abreviaturas). La transcripción enriquecida resultante puede descargarse independientemente.

---

## ✨ Características de Diseño y UI (Ultra-Premium)

*   **Estética Moderna e Interfaz Oscura**: Diseño elegante y futurista optimizado con **Tailwind CSS** y la tipografía **Outfit** de Google Fonts.
*   **Tarjetas de Archivos Individuales**: Cada archivo cargado obtiene su propia tarjeta interactiva con metadatos y dos canales de acción: "Descargar Original (Local)" y "Limpiar con IA".
*   **Zona Dropzone Interactiva**: Área de drag-and-drop para cargar múltiples PDFs simultáneamente.
*   **Barra de Progreso Dual**: Visualización en tiempo real del progreso de la extracción local y, de ser iniciada, una barra secundaria para el procesamiento asíncrono en la nube.
*   **Consola de Log Interactiva (Terminal)**: Terminal en pantalla que muestra el flujo de trabajo en tiempo real, desde los recuentos del OCR local hasta la respuesta de las peticiones a Gemini.
*   **Autodetector de Modelo**: El backend analiza los modelos disponibles en tu API Key y prioriza de forma dinámica la última versión de **Gemini Flash** para máxima eficiencia.

---

## 🏗️ Estructura del Proyecto

```bash
├── Code.gs             # Código backend de Google Apps Script (Controlador, API Gemini, Autodetector de modelo)
├── Index.html          # Interfaz de usuario frontal premium en Tailwind CSS y PDF-Lib para procesamiento cliente-servidor
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

## 🧠 Instrucciones del Prompt de la IA (Gemini Flash)

El prompt estructural inyectado en el motor de la IA lectora está diseñado meticulosamente para actuar en dos fases secuenciales:

### FASE 1: Limpieza Estructural
*   Une palabras cortadas al final del renglón (ej. `medi- \ncina` a `medicina`).
*   Elimina cabeceras, pies de página y numeraciones repetitivas aisladas.
*   Filtra URLs completas, emails y citas parentéticas estilo APA o numéricas (ej. `(García, 2018)` o `[3]`).
*   Suprime por completo bibliografías, secciones de referencias al final y afiliaciones de autores.
*   Elimina llamados visuales a gráficos (ej. `(Ver Figura 1)` o `(Tabla 3)`).
*   Limpia caracteres basura (`---`, `***`, `===`) y reemplaza viñetas complejas (`►`, `♦`) por puntuación estándar.

### FASE 2: Adaptación Semántica para TTS
*   **Notas al pie en línea**: Inserta las notas explicativas inmediatamente después del concepto aludido en el párrafo utilizando paréntesis o comas de forma natural, eliminando la sección original de notas al pie.
*   **Números Romanos**: Traduce números romanos a palabras legibles según el contexto (ej. `"Siglo XX"` a `"Siglo veinte"` o `"Capítulo IV"` a `"Capítulo cuatro"`).
*   **Abreviaturas**: Expande de forma natural términos como `"Dr."` a `"Doctor"`, `"EE.UU."` a `"Estados Unidos"`, `"aprox."` a `"aproximadamente"`.
*   **Tablas Complejas**: Omite tablas de datos crudos crípticos y reescribe las tablas discursivas en formato de párrafo continuo.

---

## 📄 Licencia

Este proyecto está bajo la licencia **ISC**.
