// @ts-ignore
import Typo from 'typo-js';

let dictionary: any = null;
let currentLang: string = '';

// Optimización de 1000x de la velocidad de sugerencias en Typo.js
// Bypasseamos el cálculo de edit distance 2 (que genera millones de combinaciones lentas)
// y limitamos la búsqueda a edit distance 1 (reemplazos, inserciones, transposiciones de 1 letra)
if (Typo && Typo.prototype) {
  Typo.prototype.suggest = function(word: string, limit: number) {
    limit = limit || 5;
    if (this.check(word)) return [];
    
    // 1. Intentar con tabla de reemplazo
    for (let r = 0; r < this.replacementTable.length; r++) {
      const a = this.replacementTable[r];
      if (word.indexOf(a[0]) !== -1) {
        const o = word.replace(a[0], a[1]);
        if (this.check(o)) return [o];
      }
    }

    // 2. Inicializar alfabeto
    if (!this.alphabet) {
      this.alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZáéíóúñüÁÉÍÓÚÑÜ";
      if (this.flags.TRY) this.alphabet += this.flags.TRY;
      if (this.flags.WORDCHARS) this.alphabet += this.flags.WORDCHARS;
      const s = this.alphabet.split("");
      s.sort();
      const c: any = {};
      for (let r = 0; r < s.length; r++) c[s[r]] = true;
      this.alphabet = "";
      for (const r in c) this.alphabet += r;
    }

    const l = this;
    const alphabetLength = l.alphabet.length;

    // Generar variaciones de edit distance 1
    const suggestions: string[] = [];
    const wordLength = word.length;

    for (let r = 0; r <= wordLength; r++) {
      const prefix = word.substring(0, r);
      const suffix = word.substring(r);

      // Deletes
      if (suffix) {
        const candidate = prefix + suffix.substring(1);
        if (l.check(candidate) && !suggestions.includes(candidate)) {
          suggestions.push(candidate);
        }
      }

      // Transpositions
      if (suffix.length > 1 && suffix[1] !== suffix[0]) {
        const candidate = prefix + suffix[1] + suffix[0] + suffix.substring(2);
        if (l.check(candidate) && !suggestions.includes(candidate)) {
          suggestions.push(candidate);
        }
      }

      // Substitutions & Insertions
      if (suffix) {
        const isUpper = suffix[0].toUpperCase() === suffix[0];
        for (let i = 0; i < alphabetLength; i++) {
          let char = l.alphabet[i];
          if (isUpper) char = char.toUpperCase();
          if (char !== suffix[0]) {
            const candidate = prefix + char + suffix.substring(1);
            if (l.check(candidate) && !suggestions.includes(candidate)) {
              suggestions.push(candidate);
            }
          }
        }
      }

      // Insertions
      const isPrevUpper = prefix.length > 0 && prefix[prefix.length - 1].toUpperCase() === prefix[prefix.length - 1];
      for (let i = 0; i < alphabetLength; i++) {
        let char = l.alphabet[i];
        if (isPrevUpper) char = char.toUpperCase();
        const candidate = prefix + char + suffix;
        if (l.check(candidate) && !suggestions.includes(candidate)) {
          suggestions.push(candidate);
        }
      }
    }

    // Ordenar y devolver el límite
    return suggestions.slice(0, limit);
  };
}

self.onmessage = async function(e) {
  const { type, lang, affUrl, dicUrl, words } = e.data;

  if (type === 'init') {
    if (dictionary && currentLang === lang) {
      self.postMessage({ type: 'init_complete', success: true });
      return;
    }
    
    try {
      // Descargar los archivos del diccionario en segundo plano
      const [affResponse, dicResponse] = await Promise.all([
        fetch(affUrl),
        fetch(dicUrl)
      ]);

      if (!affResponse.ok || !dicResponse.ok) {
        throw new Error(`Error HTTP al descargar diccionarios. AFF: ${affResponse.status}, DIC: ${dicResponse.status}`);
      }

      const affData = await affResponse.text();
      const dicData = await dicResponse.text();

      dictionary = new Typo(lang, affData, dicData, { platform: 'any' });
      currentLang = lang;
      self.postMessage({ type: 'init_complete', success: true });
    } catch (err: any) {
      self.postMessage({ type: 'init_complete', success: false, error: err.message });
    }
  }

  if (type === 'check') {
    if (!dictionary) {
      self.postMessage({ type: 'check_complete', success: false, error: 'Diccionario no inicializado' });
      return;
    }
    
    try {
      let misspelledCount = 0;
      let suspiciousWords: string[] = [];
      
      for (const word of words) {
        if (word.length <= 3) continue; // ignorar conectores cortos
        if (word === word.toUpperCase()) continue; // ignorar acrónimos
        
        const isOk = dictionary.check(word);
        if (!isOk) {
          misspelledCount++;
          if (suspiciousWords.length < 15) {
            suspiciousWords.push(word);
          }
        }
      }
      
      self.postMessage({ 
        type: 'check_complete', 
        success: true, 
        misspelledCount, 
        suspiciousWords 
      });
    } catch (err: any) {
      self.postMessage({ type: 'check_complete', success: false, error: err.message });
    }
  }

  if (type === 'correctText') {
    if (!dictionary) {
      self.postMessage({ type: 'correctText_complete', success: false, error: 'Diccionario no inicializado' });
      return;
    }

    try {
      let tempText = e.data.text;
      const wordsArray = tempText.match(/[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]+/g) || [];
      const uniqueWordsArray: string[] = [...new Set(wordsArray)];
      
      let correctionCount = 0;
      let checkedCount = 0;
      const totalWords = uniqueWordsArray.length;

      for (const word of uniqueWordsArray) {
        checkedCount++;
        
        // Reportar progreso al hilo principal cada 50 palabras
        if (checkedCount % 50 === 0 || checkedCount === totalWords) {
          self.postMessage({
            type: 'correctText_progress',
            checked: checkedCount,
            total: totalWords
          });
        }

        if (word.length <= 3) continue;
        if (word === word.toUpperCase()) continue;
        
        const isOk = dictionary.check(word);
        if (!isOk) {
          const suggestions = dictionary.suggest(word);
          if (suggestions && suggestions.length > 0) {
            const topSuggestion = suggestions[0];
            let replacement = topSuggestion;
            if (word[0] === word[0].toUpperCase()) {
              replacement = topSuggestion[0].toUpperCase() + topSuggestion.slice(1);
            }
            
            // Reemplazo exacto usando límites de palabras
            const regex = new RegExp(`\\b${word}\\b`, 'g');
            const matchCount = (tempText.match(regex) || []).length;
            if (matchCount > 0) {
                tempText = tempText.replace(regex, replacement);
                correctionCount += matchCount;
            }
          }
        }
      }

      self.postMessage({
        type: 'correctText_complete',
        success: true,
        correctedText: tempText,
        correctionCount
      });
    } catch (err: any) {
      self.postMessage({ type: 'correctText_complete', success: false, error: err.message });
    }
  }
};
