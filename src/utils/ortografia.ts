/**
 * Palabras que el corrector Hunspell no debe tocar.
 *
 * El corrector sustituye cada palabra que no está en su diccionario por la
 * primera sugerencia a una letra de distancia. En textos académicos eso
 * convertía apellidos y términos técnicos en palabras comunes: Welch → Belch,
 * Fung → Bung, Likert → Likest, Wilk → Ilk.
 */

const LETRAS = /[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]+/g;

/**
 * Devuelve las palabras protegidas del texto:
 * - Las que empiezan por mayúscula: casi siempre nombres propios, apellidos o
 *   nombres de escalas, que un diccionario general no conoce.
 * - Las que aparecen más de una vez con la misma grafía: un error de OCR es
 *   aleatorio, mientras que un término repetido es casi seguro correcto.
 */
export function palabrasProtegidas(texto: string): string[] {
  const apariciones = new Map<string, number>();
  for (const palabra of texto.match(LETRAS) || []) {
    apariciones.set(palabra, (apariciones.get(palabra) || 0) + 1);
  }

  const protegidas: string[] = [];
  for (const [palabra, veces] of apariciones) {
    const empiezaEnMayuscula = palabra[0] !== palabra[0].toLowerCase();
    if (empiezaEnMayuscula || veces > 1) protegidas.push(palabra);
  }
  return protegidas;
}
