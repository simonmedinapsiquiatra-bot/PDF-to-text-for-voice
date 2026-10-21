/**
 * Control de qué páginas web pueden usar el proxy /api/gemini.
 *
 * El proxy gasta las claves de API guardadas en el servidor, así que solo
 * atiende a la propia app (mismo dominio) y a los orígenes que se añadan en la
 * variable de entorno ORIGENES_PERMITIDOS, separados por comas.
 *
 * Esto impide que otra web use el proxy desde el navegador de sus visitantes.
 * Un script fuera del navegador puede falsificar la cabecera Origin, así que no
 * sustituye a un límite de peticiones en el firewall de Vercel.
 */

function normalizar(origen: string): string {
  return origen.trim().replace(/\/+$/, '').toLowerCase();
}

/** Lista de orígenes extra a partir del valor de ORIGENES_PERMITIDOS. */
export function origenesExtra(valorEntorno: string | undefined): string[] {
  return (valorEntorno || '')
    .split(',')
    .map(normalizar)
    .filter(Boolean);
}

/** El origen pertenece al mismo dominio que atiende la petición. */
export function esMismoOrigen(origen: string, host: string | undefined): boolean {
  if (!host) return false;
  try {
    return new URL(origen).host.toLowerCase() === host.trim().toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Decide si se atiende la petición. Los navegadores envían Origin en todo POST,
 * también en los del mismo dominio, así que una petición sin él no viene de la app.
 */
export function origenPermitido(
  origen: string | undefined,
  host: string | undefined,
  extras: string[]
): boolean {
  if (!origen) return false;
  return esMismoOrigen(origen, host) || extras.includes(normalizar(origen));
}
