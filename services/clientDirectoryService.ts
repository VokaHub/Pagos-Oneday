export interface ClientDirectoryItem {
  nombre: string;
  telefono: string;
  email?: string;
}

export const CLIENT_FORM_SHEET_ID = '1FKcCl_7mQyfcyDhY64XMehfTfhzlyTkIOXVgdB3Bp74';
export const ONEDAY_CLIENT_DIRECTORY_CACHE_KEY = 'oneday_live_client_directory_cache';
export const ONEDAY_CLIENT_DIRECTORY_SCRIPT_URL_KEY = 'oneday_client_directory_script_url';

export function cleanClientName(rawName: string): string {
  if (!rawName) return '';
  // Eliminar anotaciones entre paréntesis (ej. nombres de pacientes o notas secundarias)
  let name = rawName.replace(/[\(\[\{].*?[\)\]\}]/g, '');
  // Limpiar espacios múltiples y caracteres raros
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

export function cleanClientPhone(rawPhone: string): string {
  if (!rawPhone) return '';
  // Si viene con múltiples números separados por coma o barra, tomar el primero
  const firstPhone = String(rawPhone).split(/[,;\/]/)[0];
  let digits = firstPhone.replace(/\D/g, '');
  // Si incluye código de área 502 y tiene 11 dígitos, normalizar a los 8 dígitos locales
  if (digits.length === 11 && digits.startsWith('502')) {
    digits = digits.slice(3);
  }
  return digits;
}

/**
 * Consulta la hoja de Google Sheets de respuestas mediante la API pública JSONP (Google Visualization).
 * Este método funciona 100% en el navegador, incluso en Vercel o sitios estáticos,
 * ya que un tag <script> NO está sujeto a las restricciones de CORS del navegador.
 */
function fetchClientsViaGvizJsonp(sheetId = CLIENT_FORM_SHEET_ID): Promise<ClientDirectoryItem[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve([]);
    }

    const callbackName = `__oneday_gviz_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    let isSettled = false;

    const cleanup = () => {
      if (isSettled) return;
      isSettled = true;
      try {
        delete (window as any)[callbackName];
      } catch {}
      const scriptEl = document.getElementById(callbackName);
      if (scriptEl && scriptEl.parentNode) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 8000);

    (window as any)[callbackName] = (response: any) => {
      clearTimeout(timeoutId);
      cleanup();

      try {
        if (!response || !response.table || !Array.isArray(response.table.cols) || !Array.isArray(response.table.rows)) {
          return resolve([]);
        }

        const cols: string[] = response.table.cols.map((c: any) =>
          (c?.label || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        );

        let nameIdx = cols.findIndex(c => c.includes('nombre'));
        let phoneIdx = cols.findIndex(c => c.includes('tel') || c.includes('cel') || c.includes('phone'));
        let emailIdx = cols.findIndex(c => c.includes('correo') || c.includes('email'));

        // Si los encabezados vinieron en la primera fila de datos en vez de las columnas
        let startRow = 0;
        if (nameIdx === -1 && response.table.rows.length > 0) {
          const firstRowCells = response.table.rows[0]?.c || [];
          const headerValues = firstRowCells.map((cell: any) =>
            String(cell?.v || cell?.f || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
          );
          nameIdx = headerValues.findIndex(h => h.includes('nombre'));
          phoneIdx = headerValues.findIndex(h => h.includes('tel') || h.includes('cel') || h.includes('phone'));
          emailIdx = headerValues.findIndex(h => h.includes('correo') || h.includes('email'));
          if (nameIdx !== -1) {
            startRow = 1;
          }
        }

        if (nameIdx === -1) {
          return resolve([]);
        }

        const clients: ClientDirectoryItem[] = [];
        const seenNames = new Set<string>();

        for (let i = startRow; i < response.table.rows.length; i++) {
          const row = response.table.rows[i];
          const cells = row?.c || [];

          const rawName = nameIdx >= 0 && cells[nameIdx] ? (cells[nameIdx].v ?? cells[nameIdx].f ?? '') : '';
          const rawPhone = phoneIdx >= 0 && cells[phoneIdx] ? (cells[phoneIdx].v ?? cells[phoneIdx].f ?? '') : '';
          const rawEmail = emailIdx >= 0 && cells[emailIdx] ? (cells[emailIdx].v ?? cells[emailIdx].f ?? '') : '';

          const nombre = cleanClientName(String(rawName));
          const telefono = cleanClientPhone(String(rawPhone));
          const email = String(rawEmail).trim();

          if (!nombre || nombre.length < 2) continue;

          const normName = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (!seenNames.has(normName)) {
            seenNames.add(normName);
            clients.push({ nombre, telefono, email });
          }
        }

        resolve(clients);
      } catch (err) {
        console.warn('[clientDirectoryService] Error procesando JSONP:', err);
        resolve([]);
      }
    };

    const script = document.createElement('script');
    script.id = callbackName;
    script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=responseHandler:${callbackName}&_t=${Date.now()}`;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeoutId);
      cleanup();
      resolve([]);
    };

    (document.head || document.body).appendChild(script);
  });
}

/**
 * Consulta la API opcional de Google Apps Script si está configurada
 */
async function fetchClientsViaAppsScript(scriptUrl: string): Promise<ClientDirectoryItem[]> {
  try {
    const url = `${scriptUrl.trim()}${scriptUrl.includes('?') ? '&' : '?'}action=getClients&t=${Date.now()}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.clients) && data.clients.length > 0) {
        return data.clients.map((c: any) => ({
          nombre: cleanClientName(c.nombre || ''),
          telefono: cleanClientPhone(c.telefono || ''),
          email: c.email || '',
        })).filter((c: ClientDirectoryItem) => c.nombre.length >= 2);
      }
    }
  } catch (err) {
    console.warn('[clientDirectoryService] Error consultando Google Apps Script:', err);
  }
  return [];
}

/**
 * Consulta la ruta de API del backend / Vercel Serverless Function
 */
async function fetchClientsViaBackend(force = false): Promise<ClientDirectoryItem[]> {
  try {
    const res = await fetch(`/api/client-directory${force ? '?force=true' : ''}`);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.clients) && data.clients.length > 0) {
          return data.clients;
        }
      }
    }
  } catch (err) {
    // Es normal que falle en entornos estáticos como Vercel sin funciones
  }
  return [];
}

/**
 * Función principal para obtener el directorio de clientes en vivo.
 * Utiliza múltiples vías de alta disponibilidad:
 * 1. JSONP directo a Google Sheets (100% compatible con Vercel y sin bloqueos de CORS)
 * 2. Backend / Serverless Function /api/client-directory
 * 3. Webhook de Google Apps Script si está configurado
 * 4. Caché local en caso de desconexión
 */
export async function fetchLiveClientDirectory(force = false): Promise<ClientDirectoryItem[]> {
  // 1. Intentar consulta directa por JSONP (no sufre de CORS y funciona perfectamente en Vercel)
  try {
    const jsonpClients = await fetchClientsViaGvizJsonp();
    if (jsonpClients.length > 0) {
      saveDirectoryToCache(jsonpClients);
      return jsonpClients;
    }
  } catch (err) {
    console.warn('[clientDirectoryService] JSONP fallback falló, probando alternativas...', err);
  }

  // 2. Intentar ruta backend /api/client-directory (por si se ejecuta en Node o Vercel Serverless)
  const backendClients = await fetchClientsViaBackend(force);
  if (backendClients.length > 0) {
    saveDirectoryToCache(backendClients);
    return backendClients;
  }

  // 3. Intentar URL de Apps Script si el usuario la configuró
  try {
    const customScriptUrl = localStorage.getItem(ONEDAY_CLIENT_DIRECTORY_SCRIPT_URL_KEY);
    if (customScriptUrl && customScriptUrl.trim().startsWith('http')) {
      const appsScriptClients = await fetchClientsViaAppsScript(customScriptUrl.trim());
      if (appsScriptClients.length > 0) {
        saveDirectoryToCache(appsScriptClients);
        return appsScriptClients;
      }
    }
  } catch {}

  // 4. Fallback desde la caché local si la red o Google no responden
  try {
    const cached = localStorage.getItem(ONEDAY_CLIENT_DIRECTORY_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  return [];
}

function saveDirectoryToCache(clients: ClientDirectoryItem[]) {
  try {
    localStorage.setItem(ONEDAY_CLIENT_DIRECTORY_CACHE_KEY, JSON.stringify(clients));
    const rawDir = localStorage.getItem('oneday_client_phone_directory') || '{}';
    const dir = JSON.parse(rawDir);
    clients.forEach((c: ClientDirectoryItem) => {
      if (c.nombre && c.telefono) {
        dir[c.nombre.trim()] = c.telefono.trim();
      }
    });
    localStorage.setItem('oneday_client_phone_directory', JSON.stringify(dir));
  } catch {}
}
