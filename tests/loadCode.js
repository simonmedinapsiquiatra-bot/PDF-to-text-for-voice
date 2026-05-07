const fs = require('fs');
const vm = require('vm');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '../Code.gs'), 'utf8');

// Mock Google Apps Script globals that are used at top-level or by the functions we test
const context = {
  console: console,
  // parsearReglas and aplicarReglas don't seem to use Apps Script globals directly,
  // but the file contains other functions that do.
  // We just need the ones we want to test.
};

vm.createContext(context);
vm.runInContext(code, context);

module.exports = {
  parsearReglas: context.parsearReglas,
  aplicarReglas: context.aplicarReglas
};
