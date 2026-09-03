import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// CORS configuration to allow cross-origin requests from preview iframe and client portal
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwVXWa8SL7Z5SGHhdlKduGb1LpuQrbgeIAheETA9VxQRHKC6eQABYzQzs8CuY0pQOhCrQ/exec';
const ACTIVE_DEPLOYMENT_SUBSTRING = 'AKfycbwVXWa8SL7Z5SGHhdlKduGb1LpuQrbgeIAheETA9VxQRHKC6eQABYzQzs8CuY0pQOhCrQ';

function resolveWebhookUrl(requestedUrl?: string): string {
  if (
    requestedUrl &&
    requestedUrl.trim().startsWith('http') &&
    requestedUrl.includes(ACTIVE_DEPLOYMENT_SUBSTRING)
  ) {
    return requestedUrl.trim();
  }
  return DEFAULT_WEBHOOK_URL;
}

// In-memory cache for Google Sheets payments
let cachedSheetPayments: { timestamp: number; data: any[] } = { timestamp: 0, data: [] };
const CACHE_TTL_MS = 30 * 1000; // 30 second cache

// Fetch payments from Google Sheets Webhook
async function fetchSheetPayments(forceRefresh = false, webhookUrl?: string) {
  const url = resolveWebhookUrl(webhookUrl);
  const now = Date.now();
  if (!forceRefresh && cachedSheetPayments.data.length > 0 && (now - cachedSheetPayments.timestamp) < CACHE_TTL_MS) {
    return cachedSheetPayments.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);
    const resp = await fetch(`${url}?action=getPayments&t=${now}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const rawText = await resp.text();
      try {
        const data = JSON.parse(rawText);
        if (data.status === 'success' && Array.isArray(data.pagos)) {
          cachedSheetPayments = { timestamp: now, data: data.pagos };
          return data.pagos;
        }
      } catch {
        // Non-JSON response (HTML), ignore
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.log('[Google Sheets] Petición cancelada por tiempo de espera');
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
const handleGetSheetsPayments = async (req: express.Request, res: express.Response) => {
  try {
    const force = req.query.force === 'true' || req.query.refresh === 'true';
    const customUrl = typeof req.query.url === 'string' ? req.query.url : undefined;
    const pagos = await fetchSheetPayments(force, customUrl);
    res.json({
      status: 'success',
      count: pagos.length,
      pagos
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error?.message || 'Error al obtener pagos de Google Sheets' });
  }
};

app.get('/api/sheets-payments', handleGetSheetsPayments);
app.get('/api/google-sheets/payments', handleGetSheetsPayments);

// Save payment to Google Sheets
app.post('/api/save-payment', async (req, res) => {
  try {
    const payload = req.body;
    const requestedUrl = typeof req.query.url === 'string' 
      ? req.query.url 
      : (payload?.customWebhookUrl || undefined);
    const targetUrl = resolveWebhookUrl(requestedUrl);

    // Normalize payload fields for Google Apps Script
    const normalizedPayload = {
      ...payload,
      cliente: payload.cliente || 'Cliente',
      oficina: payload.oficina || '',
      horas: Number(payload.horas) || 1,
      monto: Number(payload.monto) || 0,
      fechaServicio: payload.fechaServicio || payload.fecha || '',
      fechaPago: payload.fechaPago || payload.fecha || new Date().toISOString().split('T')[0],
      metodoPago: payload.metodoPago || 'Transferencia Bancaria',
      estado: payload.estado || 'Pagado',
      notas: payload.notas || '',
      comprobanteUrl: payload.comprobanteUrl || (typeof payload.comprobanteImg === 'string' && payload.comprobanteImg.startsWith('http') ? payload.comprobanteImg : ''),
      comprobanteImg: payload.comprobanteImg || '',
    };

    console.log(`[Google Sheets Proxy] Guardando pago para "${normalizedPayload.cliente}" (${normalizedPayload.oficina}) por Q${normalizedPayload.monto}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(normalizedPayload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const rawText = await resp.text();
    let result: any;
    try {
      result = JSON.parse(rawText);
    } catch {
      console.warn('[Google Sheets] Respuesta de Apps Script no fue JSON válido:', rawText.slice(0, 160));
      return res.status(200).json({
        status: 'success',
        message: 'Registro procesado por Google Sheets',
        comprobanteUrl: ''
      });
    }

    console.log(`[Google Sheets Proxy] Resultado: ${result.status || 'ok'} - ${result.message || ''}`);
    cachedSheetPayments.timestamp = 0; // Invalidate cache immediately
    res.json(result);
  } catch (error: any) {
    console.error('[Google Sheets] Error al guardar pago:', error?.message || error);
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
