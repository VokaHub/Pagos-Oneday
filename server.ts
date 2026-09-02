import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxT4qVOcMRLxrOXW8DryQlQnyhhvULwx4TAZe9OjsVjpUdfxSNipJCw6OIL6OlR-yaHrg/exec';

// In-memory cache for Google Sheets payments
let cachedSheetPayments: { timestamp: number; data: any[] } = { timestamp: 0, data: [] };
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

// Fetch payments from Google Sheets Webhook
async function fetchSheetPayments(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSheetPayments.data.length > 0 && (now - cachedSheetPayments.timestamp) < CACHE_TTL_MS) {
    return cachedSheetPayments.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(`${DEFAULT_WEBHOOK_URL}?action=getPayments&t=${now}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      if (data.status === 'success' && Array.isArray(data.pagos)) {
        cachedSheetPayments = { timestamp: now, data: data.pagos };
        return data.pagos;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.log('[Google Sheets] Petición cancelada por tiempo de espera, usando caché');
    } else {
      console.log('[Google Sheets] Nota al sincronizar:', err?.message || err);
    }
  }

  return cachedSheetPayments.data;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Google Sheets recorded payments
app.get('/api/sheets-payments', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const pagos = await fetchSheetPayments(force);
    res.json({
      status: 'success',
      count: pagos.length,
      pagos
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error?.message || 'Error al obtener pagos de Google Sheets' });
  }
});

// Save payment to Google Sheets
app.post('/api/save-payment', async (req, res) => {
  try {
    const payload = req.body;
    const resp = await fetch(DEFAULT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await resp.json();
    cachedSheetPayments.timestamp = 0; // Invalidate cache
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error?.message || 'Error al registrar pago en Google Sheets' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ONEDAY Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
