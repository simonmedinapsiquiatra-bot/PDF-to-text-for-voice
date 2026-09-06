/**
 * Clasificación de errores y espera entre reintentos de las llamadas a la IA.
 *
 * Los dos flujos de la app (texto y OCR) reintentan con la misma política; solo
 * cambian los mensajes que escriben en la terminal. Esa política vive aquí.
 */

export type TipoError = 'cuota' | 'timeout' | 'no_encontrado' | 'servidor' | 'desconocido';

/**
 * Clasifica el mensaje de error para decidir cuánto esperar antes de reintentar.
 * El orden de comprobación importa: un 429 es cuota aunque también mencione otra cosa.
 */
export function clasificarError(mensaje: string): TipoError {
  const msg = mensaje || '';
  const enMinusculas = msg.toLowerCase();

  if (msg.includes('429') || enMinusculas.includes('quota') || enMinusculas.includes('rate limit')) return 'cuota';
  if (msg.includes('504') || msg.includes('timeout') || msg.includes('Respuesta no válida')) return 'timeout';
  if (msg.includes('404') || msg.includes('not found')) return 'no_encontrado';
  if (msg.includes('500') || msg.includes('503') || msg.includes('502')) return 'servidor';
  return 'desconocido';
}

/**
 * Espera ante un límite de cuota: retroceso exponencial de 15 s con factor 1,5,
 * salvo que el proveedor indique en el propio error cuándo reintentar.
 */
export function esperaPorCuota(mensaje: string, intento: number): number {
  const indicado = (mensaje || '').match(/retry in ([\d\.]+)s/);
  if (indicado) return Math.ceil(parseFloat(indicado[1]) * 1000) + 2000;
  return 15000 * Math.pow(1.5, intento - 1);
}

/** Hilos paralelos por archivo: 15 en la capa de pago, 10 en Turbo y 5 en modo normal. */
export function calcularConcurrencia(esPayg: boolean, esTurbo: boolean): number {
  if (esPayg) return 15;
  if (esTurbo) return 10;
  return 5;
}

export const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));
