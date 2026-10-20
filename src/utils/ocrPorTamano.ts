/**
 * Reparto de un bloque OCR en sub-PDFs que quepan en una petición a Vercel.
 *
 * Vercel rechaza (413 FUNCTION_PAYLOAD_TOO_LARGE) cualquier cuerpo de más de
 * 4,5 MB. Un bloque de páginas escaneadas en base64 lo supera con facilidad, así
 * que se parte por la mitad hasta que cada trozo quepa.
 */

/**
 * Tope de caracteres base64 por envío. Deja margen bajo los 4,5 MB para el
 * resto del JSON (claves, modelo, idioma).
 */
export const MAX_BASE64_POR_ENVIO = 4_000_000;

/** Marca del error de una sola página que no cabe; clasificarError lo reconoce. */
export const ERROR_PAGINA_DEMASIADO_GRANDE = 'PAGINA_DEMASIADO_GRANDE';

export interface TrozoOcr {
  indices: number[];
  base64: string;
}

/**
 * Construye los sub-PDFs de `indices`, partiendo por la mitad los que excedan
 * `maxBase64`. Conserva el orden de las páginas. Si una única página no cabe,
 * lanza un error con ERROR_PAGINA_DEMASIADO_GRANDE: no hay forma de enviarla.
 */
export async function trozosBajoLimite(
  indices: number[],
  construir: (indices: number[]) => Promise<string>,
  maxBase64: number = MAX_BASE64_POR_ENVIO
): Promise<TrozoOcr[]> {
  const base64 = await construir(indices);
  if (base64.length <= maxBase64) return [{ indices, base64 }];

  if (indices.length === 1) {
    const mb = (base64.length * 0.75 / 1024 / 1024).toFixed(1);
    throw new Error(
      `${ERROR_PAGINA_DEMASIADO_GRANDE}: la página ${indices[0] + 1} ocupa ${mb} MB y supera el límite de envío de Vercel (4,5 MB).`
    );
  }

  const mitad = Math.ceil(indices.length / 2);
  const primeros = await trozosBajoLimite(indices.slice(0, mitad), construir, maxBase64);
  const resto = await trozosBajoLimite(indices.slice(mitad), construir, maxBase64);
  return [...primeros, ...resto];
}
