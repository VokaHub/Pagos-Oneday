export interface ClientDirectoryItem {
  nombre: string;
  telefono: string;
  email?: string;
}

export const ONEDAY_CLIENT_DIRECTORY_CACHE_KEY = 'oneday_live_client_directory_cache';

export async function fetchLiveClientDirectory(force = false): Promise<ClientDirectoryItem[]> {
  try {
    const res = await fetch(`/api/client-directory${force ? '?force=true' : ''}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.clients) && data.clients.length > 0) {
        // Cachear en localStorage para disponibilidad inmediata offline
        try {
          localStorage.setItem(ONEDAY_CLIENT_DIRECTORY_CACHE_KEY, JSON.stringify(data.clients));
          
          const rawDir = localStorage.getItem('oneday_client_phone_directory') || '{}';
          const dir = JSON.parse(rawDir);
          data.clients.forEach((c: ClientDirectoryItem) => {
            if (c.nombre && c.telefono) {
              dir[c.nombre.trim()] = c.telefono.trim();
            }
          });
          localStorage.setItem('oneday_client_phone_directory', JSON.stringify(dir));
        } catch {}
        return data.clients;
      }
    }
  } catch (err) {
    console.warn('[clientDirectoryService] Error al sincronizar directorio desde backend:', err);
  }

  // Fallback desde cache local si la red falla
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
