import test from 'node:test';
import assert from 'node:assert';
import { limpiarTextoLocal, limpiarUnionesEntrePaginas } from '../src/utils/textCleaner.ts';

const L = '[a-zA-ZáéíóúñüÁÉÍÓÚÑÜàèìòùâêîôûäëïöüçÇ]';

function expandirSiglasPsiquiatria(texto, lang) {
  if (!texto) return "";
  let res = texto;
  if (lang === 'es') {
    const siglasES = [
      { re: /\bTCAs\b/g, rep: "trastornos de la conducta alimentaria" },
      { re: /\bTCA\b/g, rep: "trastorno de la conducta alimentaria" },
      { re: /\bAN\b/g, rep: "anorexia nerviosa" },
      { re: /\bBN\b/g, rep: "bulimia nerviosa" },
      { re: /\bTOCs\b/g, rep: "trastornos obsesivo compulsivos" },
      { re: /\bTOC\b/g, rep: "trastorno obsesivo compulsivo" },
      { re: /\bTAG\b/g, rep: "trastorno de ansiedad generalizada" },
      { re: /\bTDAH\b/g, rep: "trastorno por déficit de atención e hiperactividad" },
      { re: /\btdah\b/g, rep: "trastorno por déficit de atención e hiperactividad" },
      { re: /\bTEA\b/g, rep: "trastorno del espectro autista" },
      { re: /\bTLP\b/g, rep: "trastorno límite de la personalidad" },
      { re: /\btlp\b/g, rep: "trastorno límite de la personalidad" },
      { re: /\bTAB\b/g, rep: "trastorno afectivo bipolar" },
      { re: /\bTA\b/g, rep: "trastorno por atracón" },
      { re: /\bISRS\b/g, rep: "inhibidores selectivos de la recaptación de serotonina" },
      { re: /\bisrs\b/g, rep: "inhibidores selectivos de la recaptación de serotonina" }
    ];
    for (const rule of siglasES) {
      res = res.replace(rule.re, rule.rep);
    }
  }
  return res;
}

function extraerTituloDePortada(textoPortada) {
  if (!textoPortada) return "TÍTULO NO DETECTADO";
  const lineasRaw = textoPortada.split(/\r?\n/);
  const lineasValidas = [];
  for (let i = 0; i < lineasRaw.length; i++) {
    let rawLine = lineasRaw[i].replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
    if (!rawLine) continue;
    const tokens = rawLine.split(/[ \t]{2,}/);
    const wordsDesespaciadas = tokens.map(tok => {
      const trimmed = tok.trim();
      if (/^[A-Za-záéíóúñüÁÉÍÓÚÑÜ](?:[ \t][A-Za-záéíóúñüÁÉÍÓÚÑÜ])+$/.test(trimmed)) {
        return trimmed.replace(/[ \t]+/g, '');
      }
      return trimmed;
    });
    let l = wordsDesespaciadas.join(' ').replace(/[ \t]+/g, " ").trim();
    if (!l || l.length <= 3) continue;
    if (/^(por|by|autores?|authors?)\b/i.test(l)) continue;
    lineasValidas.push(l);
  }
  if (lineasValidas.length === 0) return "TÍTULO NO DETECTADO";
  if (lineasValidas.length === 1) return lineasValidas[0].toUpperCase();
  return lineasValidas.slice(0, 2).join(" - ").toUpperCase();
}

test('Debe preservar términos médicos con números como DSM-5 y COVID-19', () => {
  const input = "El diagnóstico según el DSM-5 y las secuelas de COVID-19 fueron evaluados en la fase 1.";
  const clean = limpiarTextoLocal(input);
  assert.match(clean, /DSM-5/);
  assert.match(clean, /COVID-19/);
  assert.match(clean, /fase 1/);
});

test('Debe eliminar superíndices de citas con comas o tras puntuación final', () => {
  const input = "Los resultados fueron concluyentes.24 Además se evaluó la eficacia,1,2,3 en los pacientes.";
  const clean = limpiarTextoLocal(input);
  assert.ok(!clean.includes('.24'));
  assert.ok(!clean.includes(',1,2,3'));
  assert.match(clean, /concluyentes\./);
  assert.match(clean, /eficacia/);
});

test('No debe colapsar palabras en minúsculas como toc, tab o tag', () => {
  const input = "El paciente hizo toc toc en la puerta y presionó la tecla tab para ver el tag de la muestra.";
  const res = expandirSiglasPsiquiatria(input, 'es');
  assert.match(res, /toc toc/);
  assert.match(res, /tecla tab/);
  assert.match(res, /tag de la muestra/);
});

test('Debe expandir siglas en mayúsculas correctamente', () => {
  const input = "El paciente presenta TOC y TAG comórbido con TCA.";
  const res = expandirSiglasPsiquiatria(input, 'es');
  assert.match(res, /trastorno obsesivo compulsivo/);
  assert.match(res, /trastorno de ansiedad generalizada/);
  assert.match(res, /trastorno de la conducta alimentaria/);
});

test('Debe unir correctamente títulos con letras espaciadas de principio a fin', () => {
  const input = "T R A S T O R N O S   D E   L A   C O N D U C T A\nA L I M E N T A R I A";
  const titulo = extraerTituloDePortada(input);
  assert.strictEqual(titulo, "TRASTORNOS DE LA CONDUCTA - ALIMENTARIA");
});
