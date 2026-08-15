declare const google: any;
declare function log(message: string, type?: string): void;

    export function openConfigModal() {
      const savedKey = localStorage.getItem('dr_media_gemini_api_key') || '';
      const savedModel = localStorage.getItem('dr_media_gemini_model') || 'auto';
      const savedTier = localStorage.getItem('dr_media_gemini_tier') || 'free';
      
      const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
      if (apiKeyInput) apiKeyInput.value = savedKey;
      
      const modelSelect = document.getElementById('geminiModelSelect') as HTMLSelectElement;
      if (modelSelect) modelSelect.value = savedModel;
      
      const tierSelect = document.getElementById('geminiTierSelect') as HTMLSelectElement;
      if (tierSelect) tierSelect.value = savedTier;
      
      const modal = document.getElementById('configModal');
      if (modal) modal.classList.remove('hidden');
    }
    
    export function closeConfigModal() {
      const modal = document.getElementById('configModal');
      if (modal) modal.classList.add('hidden');
      const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
      if (apiKeyInput) apiKeyInput.type = 'password';
    }
    
    export function saveConfigModal() {
      const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
      const newKey = apiKeyInput ? apiKeyInput.value.trim() : '';
      
      const modelSelect = document.getElementById('geminiModelSelect') as HTMLSelectElement;
      const newModel = modelSelect ? modelSelect.value : 'auto';
      
      const tierSelect = document.getElementById('geminiTierSelect') as HTMLSelectElement;
      const newTier = tierSelect ? tierSelect.value : 'free';
      
      // Guardar modelo seleccionado
      localStorage.setItem('dr_media_gemini_model', newModel);
      localStorage.setItem('dr_media_gemini_tier', newTier);
      
      if (newKey) {
        localStorage.setItem('dr_media_gemini_api_key', newKey);
        google.script.run
          .withSuccessHandler((msg: any) => {
            log(msg, "success");
          })
          .withFailureHandler((err: any) => {
            log("Error al respaldar clave en el servidor: " + err.message, "error");
          })
          .guardarApiKeyUsuario(newKey);
      } else {
        localStorage.removeItem('dr_media_gemini_api_key');
        google.script.run
          .withSuccessHandler((msg: any) => {
            log(msg, "success");
          })
          .guardarApiKeyUsuario("");
      }
      closeConfigModal();
      log("Configuración guardada exitosamente.", "success");
    }
    
    export function getStoredApiKey() {
      return localStorage.getItem('dr_media_gemini_api_key') || '';
    }

    export function getStoredModel() {
      return localStorage.getItem('dr_media_gemini_model') || 'auto';
    }

    export function getStoredGeminiTier() {
      return localStorage.getItem('dr_media_gemini_tier') || 'free';
    }

    export function toggleKeyVisibility() {
      const input = document.getElementById('apiKeyInput') as HTMLInputElement;
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
      } else {
        input.type = 'password';
      }
    }

    export function copiarApiKeyAlPortapapeles() {
      const input = document.getElementById('apiKeyInput') as HTMLInputElement;
      const key = input ? input.value.trim() : '';
      if (!key) {
        log("No hay ninguna clave para copiar.", "error");
        return;
      }
      
      navigator.clipboard.writeText(key).then(() => {
        log("Clave de API copiada al portapapeles con éxito.", "success");
      }).catch(err => {
        log("No se pudo copiar de forma automática. Selecciona la clave de forma manual.", "error");
      });
    }

    // Inicializar sincronización de la API Key al cargar la aplicación
    window.addEventListener('DOMContentLoaded', () => {
      const localKey = getStoredApiKey();
      if (localKey) {
        google.script.run.guardarApiKeyUsuario(localKey);
      } else {
        google.script.run.withSuccessHandler((serverKey: any) => {
          if (serverKey) {
            localStorage.setItem('dr_media_gemini_api_key', serverKey);
            log("API Key recuperada con éxito de tus propiedades de Google Apps Script.", "success");
          }
        }).obtenerApiKeyUsuario();
      }
    });
