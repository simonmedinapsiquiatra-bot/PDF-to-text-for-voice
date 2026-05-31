// @ts-ignore
import Typo from 'typo-js';

let dictionary: any = null;
let currentLang: string = '';

self.onmessage = function(e) {
  const { type, lang, affData, dicData, words } = e.data;

  if (type === 'init') {
    if (dictionary && currentLang === lang) {
      self.postMessage({ type: 'init_complete', success: true });
      return;
    }
    
    try {
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
};
