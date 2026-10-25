/**
 * Recuento de tokens y coste estimado del procesamiento con IA.
 *
 * Los tokens son exactos: los informa el proveedor en cada respuesta. El coste
 * es una estimación con las tarifas de referencia de TARIFAS_USD_POR_MILLON;
 * la factura real puede variar (descuentos, impuestos, cambio de moneda).
 */

export interface UsoTokens {
  entrada: number;
  salida: number;
  /** Tokens de razonamiento; se facturan como salida. */
  razonamiento: number;
}

/**
 * Tarifas de pago en USD por millón de tokens (octubre de 2026). Gemini 3.5
 * Flash-Lite figura en la página oficial de precios; 3.8 y 3.6 Flash usan la
 * tarifa de lanzamiento publicada por fuentes externas, vigente hasta el 31 de
 * diciembre de 2026. Revísalas en https://ai.google.dev/gemini-api/docs/pricing
 */
export const TARIFAS_USD_POR_MILLON: Record<string, { entrada: number; salida: number }> = {
  'gemini-3.8-flash': { entrada: 0.75, salida: 3.75 },
  'gemini-3.6-flash': { entrada: 0.75, salida: 3.75 },
  'gemini-3.5-flash-lite': { entrada: 0.30, salida: 2.50 },
};

/** Coste estimado en USD de una respuesta, o null si no hay tarifa para el modelo. */
export function costeEstimadoUSD(modelo: string, uso: UsoTokens): number | null {
  const tarifa = TARIFAS_USD_POR_MILLON[(modelo || '').replace(/^models\//, '')];
  if (!tarifa) return null;
  return (uso.entrada * tarifa.entrada + (uso.salida + uso.razonamiento) * tarifa.salida) / 1_000_000;
}

/** Acumulado de un documento a lo largo de todas sus llamadas a la IA. */
export interface ResumenUso extends UsoTokens {
  llamadas: number;
  desdeCache: number;
  costeUSD: number;
  /** Alguna respuesta vino de un modelo sin tarifa: el coste se queda corto. */
  costeIncompleto: boolean;
}

export function resumenVacio(): ResumenUso {
  return { entrada: 0, salida: 0, razonamiento: 0, llamadas: 0, desdeCache: 0, costeUSD: 0, costeIncompleto: false };
}

/** Suma una respuesta al resumen. Sin `uso` cuenta como respuesta de la caché. */
export function sumarUso(resumen: ResumenUso, modelo: string, uso?: UsoTokens | null): void {
  if (!uso) {
    resumen.desdeCache++;
    return;
  }
  resumen.llamadas++;
  resumen.entrada += uso.entrada;
  resumen.salida += uso.salida;
  resumen.razonamiento += uso.razonamiento;
  const coste = costeEstimadoUSD(modelo, uso);
  if (coste === null) resumen.costeIncompleto = true;
  else resumen.costeUSD += coste;
}

/** Texto para el registro: "52.310 tokens (…) · coste estimado ≈ 0,07 USD". */
export function describirUso(resumen: ResumenUso): string {
  const n = (x: number) => x.toLocaleString('es-ES');
  const total = resumen.entrada + resumen.salida + resumen.razonamiento;
  const partes = [`${n(total)} tokens (entrada ${n(resumen.entrada)}, salida ${n(resumen.salida)}, razonamiento ${n(resumen.razonamiento)})`];
  partes.push(`${resumen.llamadas} llamada${resumen.llamadas === 1 ? '' : 's'}${resumen.desdeCache ? ` + ${resumen.desdeCache} desde caché` : ''}`);
  const coste = resumen.costeUSD < 0.01 && resumen.costeUSD > 0
    ? 'menos de 0,01 USD'
    : `${resumen.costeUSD.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
  partes.push(`coste estimado ≈ ${coste}${resumen.costeIncompleto ? ' (sin contar proveedores sin tarifa)' : ''}`);
  return partes.join(' · ');
}
