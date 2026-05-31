import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Preferred code is server/Code.gs which contains parsearReglas
let codePath = path.join(__dirname, '../server/Code.gs');
if (!fs.existsSync(codePath)) {
  codePath = path.join(__dirname, '../Código.js');
}

const code = fs.readFileSync(codePath, 'utf8');

// Mock Google Apps Script globals that are used at top-level or by the functions we test
const context = {
  console: console,
  HtmlService: {
    createHtmlOutputFromFile: () => ({
      setTitle: () => ({
        setXFrameOptionsMode: () => ({
          addMetaTag: () => {}
        })
      })
    })
  },
  PropertiesService: {
    getUserProperties: () => ({
      getProperty: () => '',
      setProperty: () => '',
      deleteProperty: () => ''
    })
  },
  CacheService: {
    getScriptCache: () => ({
      get: () => null,
      put: () => null
    })
  },
  UrlFetchApp: {
    fetch: () => ({
      getContentText: () => '{}'
    })
  },
  Utilities: {
    sleep: () => {}
  }
};

vm.createContext(context);
vm.runInContext(code, context);

export const parsearReglas = context.parsearReglas;
export const aplicarReglas = context.aplicarReglas;
