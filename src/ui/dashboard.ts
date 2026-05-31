
    export function openConfigModal() {
      const savedKey = localStorage.getItem('dr_media_gemini_api_key') || '';
      const savedModel = localStorage.getItem('dr_media_gemini_model') || 'auto';
      
      document.getElementById('apiKeyInput').value = savedKey;
      document.getElementById('geminiModelSelect').value = savedModel;
      
      document.getElementById('configModal').classList.remove('hidden');
    }
    
    export function closeConfigModal() {
      document.getElementById('configModal').classList.add('hidden');
      document.getElementById('apiKeyInput').type = 'password';
    }
    
    export function saveConfigModal() {
      const newKey = document.getElementById('apiKeyInput').value.trim();
      const newModel = document.getElementById('geminiModelSelect').value;
      
      // Guardar modelo seleccionado
      localStorage.setItem('dr_media_gemini_model', newModel);
      
      if (newKey) {
        localStorage.setItem('dr_media_gemini_api_key', newKey);
        google.script.run
          .withSuccessHandler((msg) => {
            log(msg, "success");
          })
          .withFailureHandler((err) => {
            log("Error al respaldar clave en el servidor: " + err.message, "error");
          })
          .guardarApiKeyUsuario(newKey);
      } else {
        localStorage.removeItem('dr_media_gemini_api_key');
        google.script.run
          .withSuccessHandler((msg) => {
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

    export function toggleKeyVisibility() {
      const input = document.getElementById('apiKeyInput');
      if (input.type === 'password') {
        input.type = 'text';
      } else {
        input.type = 'password';
      }
    }

    export function copiarApiKeyAlPortapapeles() {
      const input = document.getElementById('apiKeyInput');
      const key = input.value.trim();
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
        google.script.run.withSuccessHandler((serverKey) => {
          if (serverKey) {
            localStorage.setItem('dr_media_gemini_api_key', serverKey);
            log("API Key recuperada con éxito de tus propiedades de Google Apps Script.", "success");
          }
        }).obtenerApiKeyUsuario();
      }
    });
