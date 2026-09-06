import test from 'node:test';
import assert from 'node:assert';
// Se prueban los módulos que realmente ejecuta la aplicación (src/main.ts los importa).
import { removerReferenciasYAutores, esFinDeReferencias, calcularScoreReferencia } from '../src/utils/textRules.ts';

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
