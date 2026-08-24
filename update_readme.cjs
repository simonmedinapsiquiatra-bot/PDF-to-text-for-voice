const fs = require('fs');
let text = fs.readFileSync('README.md', 'utf8');

const additionalFeatures = `* **Limpieza Manual Point-and-Click**: Visor avanzado del texto extraído originalmente que permite al usuario seleccionar con el ratón textos "basura" persistentes (ej. "Boberg et al.") y eliminarlos globalmente en todo el documento antes de procesarlo con la IA.
* **Filtros de Limpieza Inteligente**: Módulo de análisis local que escanea todos los documentos en busca de frases o estructuras ruidosas repetidas. El usuario puede marcar estos patrones para que el sistema los depure algorítmicamente antes y después del procesamiento por la IA.
* **Progreso de IA Preciso y Proporcional**: Barra de progreso transparente que no se congela, trazando en tiempo real las tres fases del proceso: Transcripción (0-80%), Revisión de fronteras (80-85%) y Corrección lingüística final (85-100%).`;

const targetStr = `* **Caché Persistente en IndexedDB**`;

text = text.replace(targetStr, additionalFeatures + '\n* **Caché Persistente en IndexedDB**');
fs.writeFileSync('README.md', text);
