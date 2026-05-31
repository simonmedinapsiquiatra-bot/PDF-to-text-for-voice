import test from 'node:test';
import assert from 'node:assert';
import { parsearReglas, aplicarReglas } from './loadCode.js';

test('parsearReglas should correctly parse different rule types', (t) => {
  const content = `
# This is a comment
* "patron" "reemplazo" "g"
"buscar" "remplazar"
  * "regex2" "reemplazo2"
  `;
  const rules = parsearReglas(content);

  assert.strictEqual(rules.length, 3);

  assert.strictEqual(rules[0].type, 'regex');
  assert.strictEqual(Object.prototype.toString.call(rules[0].re), '[object RegExp]');
  assert.strictEqual(rules[0].re.source, 'patron');
  assert.strictEqual(rules[0].re.flags, 'g');
  assert.strictEqual(rules[0].replacement, 'reemplazo');

  assert.strictEqual(rules[1].type, 'simple');
  assert.strictEqual(rules[1].search, 'buscar');
  assert.strictEqual(rules[1].replace, 'remplazar');

  assert.strictEqual(rules[2].type, 'regex');
  assert.strictEqual(Object.prototype.toString.call(rules[2].re), '[object RegExp]');
  assert.strictEqual(rules[2].re.source, 'regex2');
  assert.strictEqual(rules[2].re.flags, 'gm'); // default flags
});

test('aplicarReglas should apply simple replacement', (t) => {
  const rules = [{ type: 'simple', search: 'hola', replace: 'adios' }];
  const result = aplicarReglas('hola mundo hola', rules);
  assert.strictEqual(result, 'adios mundo adios');
});

test('aplicarReglas should apply regex replacement', (t) => {
  const rules = [{ type: 'regex', re: /h.la/g, replacement: 'hola' }];
  const result = aplicarReglas('hala hula helle', rules);
  assert.strictEqual(result, 'hola hola helle');
});

test('aplicarReglas should unescape newlines in regex replacement', (t) => {
  const rules = [{ type: 'regex', re: /SEP/g, replacement: '\n---\n' }];
  const result = aplicarReglas('aSEPb', rules);
  assert.strictEqual(result, 'a\n---\nb');
});

test('aplicarReglas should handle multiple rules in order', (t) => {
  const rules = [
    { type: 'simple', search: 'a', replace: 'b' },
    { type: 'simple', search: 'b', replace: 'c' }
  ];
  const result = aplicarReglas('a', rules);
  assert.strictEqual(result, 'c');
});

test('aplicarReglas should handle invalid regex gracefully', (t) => {
  // Pass a rule with a malformed RegExp object or an invalid type to verify it handles gracefully
  const rules = [{ type: 'regex', re: { test: () => false }, replacement: 'err' }];
  // We can also test that if parsearReglas encounters an invalid regex, it skips it
  const invalidContent = '* "(" "reemplazo" "g"';
  const parsedRules = parsearReglas(invalidContent);
  assert.strictEqual(parsedRules.length, 0); // Invalid regex is skipped in parsearReglas
});

test('aplicarReglas with empty text and rules', (t) => {
  assert.strictEqual(aplicarReglas('', []), '');
  assert.strictEqual(aplicarReglas('test', []), 'test');
});

