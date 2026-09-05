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

// Client Directory from Google Forms / Spreadsheet
const CLIENT_FORM_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1FKcCl_7mQyfcyDhY64XMehfTfhzlyTkIOXVgdB3Bp74/export?format=csv';
let cachedClientDirectory: { timestamp: number; data: Array<{ nombre: string; telefono: string; email: string }> } = {
  timestamp: 0,
  data: []
};
const CLIENT_DIRECTORY_TTL_MS = 60 * 1000; // 1 minute cache

function parseSimpleCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField);
      if (currentRow.some(field => field.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(field => field.trim().length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}

function cleanClientName(rawName: string): string {
  if (!rawName) return '';
  // Eliminar anotaciones entre paréntesis (ej. nombres de pacientes o notas)
  let name = rawName.replace(/[\(\[\{].*?[\)\]\}]/g, '');
  // Reemplazar múltiples espacios
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

function cleanClientPhone(rawPhone: string): string {
  if (!rawPhone) return '';
  // Si viene con múltiples números separados por coma o barra, tomar el primero
  const firstPhone = rawPhone.split(/[,;\/]/)[0];
  let digits = firstPhone.replace(/\D/g, '');
  // Si incluye código de área 502 y tiene 11 dígitos, remover el 502
  if (digits.length === 11 && digits.startsWith('502')) {
    digits = digits.slice(3);
  }
  return digits;
}

async function fetchClientDirectory(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedClientDirectory.data.length > 0 && (now - cachedClientDirectory.timestamp) < CLIENT_DIRECTORY_TTL_MS) {
    return cachedClientDirectory.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(`${CLIENT_FORM_SHEET_URL}&_t=${now}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OneDaySpaces/1.0' }
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const csvText = await resp.text();
      const rows = parseSimpleCSV(csvText);
      if (rows.length > 1) {
        const headers = rows[0].map(h => h.toLowerCase().trim());
        const nameIdx = headers.findIndex(h => h.includes('nombre'));
        const phoneIdx = headers.findIndex(h => h.includes('tel') || h.includes('cel') || h.includes('phone'));
        const emailIdx = headers.findIndex(h => h.includes('correo') || h.includes('email'));

        const clients: Array<{ nombre: string; telefono: string; email: string }> = [];
        const seenNames = new Set<string>();

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rawName = nameIdx >= 0 && row[nameIdx] ? row[nameIdx] : '';
          const rawPhone = phoneIdx >= 0 && row[phoneIdx] ? row[phoneIdx] : '';
          const rawEmail = emailIdx >= 0 && row[emailIdx] ? row[emailIdx] : '';

          const nombre = cleanClientName(rawName);
          const telefono = cleanClientPhone(rawPhone);
          const email = rawEmail ? rawEmail.trim() : '';

          if (!nombre) continue;

          // Normalizar para evitar duplicados exactos
          const normName = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (!seenNames.has(normName)) {
            seenNames.add(normName);
            clients.push({ nombre, telefono, email });
          }
        }

        if (clients.length > 0) {
          cachedClientDirectory = { timestamp: now, data: clients };
          return clients;
        }
      }
    }
  } catch (err: any) {
    console.error('[Client Directory] Error al sincronizar directorio desde Google Sheet:', err?.message || err);
  }

  return cachedClientDirectory.data;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Endpoint para el directorio de clientes de Google Forms
app.get('/api/client-directory', async (req, res) => {
  try {
    const force = req.query.force === 'true' || req.query.refresh === 'true';
    const clients = await fetchClientDirectory(force);
    res.json({
      status: 'success',
      count: clients.length,
      clients
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error?.message || 'Error al obtener directorio' });
  }
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
      telefono: payload.telefono || '',
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
