const test = require('node:test');
const assert = require('node:assert');
const { parsearReglas, aplicarReglas } = require('./loadCode.js');

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
  assert.strictEqual(rules[0].pattern, 'patron');
  assert.strictEqual(rules[0].replacement, 'reemplazo');
  assert.strictEqual(rules[0].flags, 'g');

  assert.strictEqual(rules[1].type, 'simple');
  assert.strictEqual(rules[1].search, 'buscar');
  assert.strictEqual(rules[1].replace, 'remplazar');

  assert.strictEqual(rules[2].type, 'regex');
  assert.strictEqual(rules[2].pattern, 'regex2');
  assert.strictEqual(rules[2].flags, 'gm'); // default flags
});

test('aplicarReglas should apply simple replacement', (t) => {
  const rules = [{ type: 'simple', search: 'hola', replace: 'adios' }];
  const result = aplicarReglas('hola mundo hola', rules);
  assert.strictEqual(result, 'adios mundo adios');
});

test('aplicarReglas should apply regex replacement', (t) => {
  const rules = [{ type: 'regex', pattern: 'h.la', replacement: 'hola', flags: 'g' }];
  const result = aplicarReglas('hala hula helle', rules);
  assert.strictEqual(result, 'hola hola helle');
});

test('aplicarReglas should unescape newlines in regex replacement', (t) => {
  const rules = [{ type: 'regex', pattern: 'SEP', replacement: '\\n---\\n', flags: 'g' }];
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
  const rules = [{ type: 'regex', pattern: '(', replacement: 'err', flags: 'g' }];
  // Should not throw, should return original text
  const result = aplicarReglas('test', rules);
  assert.strictEqual(result, 'test');
});

test('aplicarReglas with empty text and rules', (t) => {
  assert.strictEqual(aplicarReglas('', []), '');
  assert.strictEqual(aplicarReglas('test', []), 'test');
});
