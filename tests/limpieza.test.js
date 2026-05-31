import test from 'node:test';
import assert from 'node:assert';

// Copia exacta de la lógica implementada para probarla de forma aislada
function removerReferenciasYAutores(texto) {
  if (!texto) return "";
  
  const lineas = texto.split('\n\n');
  const resultado = [];
  
  let enReferencias = false;
  let enColaboradores = false;
  
  const regexReferenciasHeader = /^(References|Bibliografía|Bibliografia|Bibliography|Referencias Bibliográficas|Referencias Bibliograficas|Referencias)\s*$/i;
  const regexColaboradoresHeader = /^(Contributors|Colaboradores|List of Contributors|Lista de Colaboradores|Autores|Autores de la obra)\s*$/i;
  const regexFinColaboradores = /^(Preface|Prefacio|Prólogo|Prologo|Introduction|Introducción|Introduccion|Chapter\s+\d+|Capítulo\s+\d+|Capitulo\s+\d+|PART\s+[I|V|X\d]+|PARTE\s+[I|V|X\d]+|\d+\s+[A-ZÁÉÍÓÚÑÜ])\b/i;

  for (let i = 0; i < lineas.length; i++) {
    const para = lineas[i].trim();
    if (!para) {
      resultado.push(lineas[i]);
      continue;
    }
    
    if (para === '--- PAGE_BREAK ---') {
      resultado.push(lineas[i]);
      continue;
    }
    
    if (enColaboradores) {
      if (regexFinColaboradores.test(para)) {
        enColaboradores = false;
      } else {
        continue;
      }
    }
    
    if (enReferencias) {
      const esFinReferencias = esFinDeReferencias(para);
      if (esFinReferencias) {
        enReferencias = false;
      } else {
        continue;
      }
    }
    
    if (regexColaboradoresHeader.test(para)) {
      enColaboradores = true;
      continue;
    }
    
    if (regexReferenciasHeader.test(para)) {
      enReferencias = true;
      continue;
    }
    
    if (/^(Disclosure of Competing Interests|Conflict of Interest|Conflicts of Interest|Declaración de intereses|Conflictos de interés|Conflicto de intereses)\b/i.test(para)) {
      continue;
    }
    if (/^The following contributors to this book have indicated/i.test(para)) {
      continue;
    }
    
    resultado.push(lineas[i]);
  }
  
  return resultado.join('\n\n');
}

function esFinDeReferencias(para) {
  const cleanPara = para.trim();
  if (!cleanPara) return false;
  
  const regexHeading = /^(Preface|Prefacio|Prólogo|Prologo|Introduction|Introducción|Introduccion|Chapter\s+\d+|Capítulo\s+\d+|Capitulo\s+\d+|PART\s+[I|V|X\d]+|PARTE\s+[I|V|X\d]+|\d+\s+[A-ZÁÉÍÓÚÑÜ])\b/i;
  if (regexHeading.test(cleanPara)) return true;
  
  if ((/\b(M\.D\.|Ph\.D\.|M\.P\.H\.|Dr\.P\.H\.|M\.S\.)(?![a-zA-Z])|\b(PhD|MD|MPH|DFAPA)\b/i.test(cleanPara)) && cleanPara.length < 300) {
    return true;
  }
  
  const score = calcularScoreReferencia(cleanPara);
  if (score < 3 && cleanPara.length > 250) {
    return true;
  }
  
  return false;
}

function calcularScoreReferencia(texto) {
  let score = 0;
  if (/\b(19|20)\d{2}\b/.test(texto)) score += 2;
  if (/\b\d+\s*:\s*\d+(?:[–-]\d+)?\b/.test(texto)) score += 3;
  if (/\bet\s+al\b/i.test(texto)) score += 3;
  if (/doi:|pmid|pmcid/i.test(texto)) score += 4;
  if (/\b(Psychiatry|Journal|Lancet|Bull|Med|Rev|Clin|Sci|Am\s+J|J\s+Clin|PLoS|Acad)\b/i.test(texto)) score += 2;
  if (/\b(Press|University|Arlington|Edition|Publishing)\b/i.test(texto)) score += 1;
  if (/^[A-Z][a-zñáéíóúü]+ [A-Z]{1,2}\b/.test(texto)) score += 2;
  return score;
}

// PRUEBAS UNITARIAS

test('Debe omitir la sección de Contributors y detenerse en el Preface', (t) => {
  const input = [
    "Title of the Book",
    "Contributors",
    "Neil Krishan Aggarwal, M.D., M.B.A., M.A.",
    "Assistant Professor of Clinical Psychiatry, Department of Psychiatry, Columbia University Medical Center",
    "--- PAGE_BREAK ---",
    "Melanie Bennett, Ph.D.",
    "Professor of Psychiatry, Department of Psychiatry, University of Maryland",
    "Preface",
    "This book is intended to cover the details of mental health disorders."
  ].join('\n\n');

  const expected = [
    "Title of the Book",
    "--- PAGE_BREAK ---",
    "Preface",
    "This book is intended to cover the details of mental health disorders."
  ].join('\n\n');

  const result = removerReferenciasYAutores(input);
  assert.strictEqual(result, expected);
});

test('Debe omitir las referencias y detenerse ante el inicio de un nuevo capítulo', (t) => {
  const input = [
    "This is the end of Chapter 1 of our book.",
    "References",
    "Aguilar-Valles A, Flores C, Luheshi GN: Prenatal inflammation-induced hypoferremia. PLoS One 5:e10967, 2010 20532043",
    "--- PAGE_BREAK ---",
    "Olfson M, Gerhard T, Huang C, et al: Premature mortality among adults with schizophrenia in the United States. JAMA Psychiatry 72:1172–1181, 2015",
    "Natural History Diana O. Perkins, M.D., M.P.H.",
    "Jeffrey A. Lieberman, M.D.",
    "Schizophrenia typically emerges in late adolescence to early adulthood. Most individuals who develop schizophrenia have a chronic course."
  ].join('\n\n');

  const expected = [
    "This is the end of Chapter 1 of our book.",
    "--- PAGE_BREAK ---",
    "Natural History Diana O. Perkins, M.D., M.P.H.",
    "Jeffrey A. Lieberman, M.D.",
    "Schizophrenia typically emerges in late adolescence to early adulthood. Most individuals who develop schizophrenia have a chronic course."
  ].join('\n\n');

  const result = removerReferenciasYAutores(input);
  assert.strictEqual(result, expected);
});

test('Debe filtrar las declaraciones de conflicto de interés', (t) => {
  const input = [
    "Some text about psychiatry.",
    "Disclosure of Competing Interests: The authors have no conflicts to disclose.",
    "The following contributors to this book have indicated a financial interest in or other affiliation with a commercial supporter.",
    "Normal paragraph of the book continuation."
  ].join('\n\n');

  const expected = [
    "Some text about psychiatry.",
    "Normal paragraph of the book continuation."
  ].join('\n\n');

  const result = removerReferenciasYAutores(input);
  assert.strictEqual(result, expected);
});
