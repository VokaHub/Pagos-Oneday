// Vercel Serverless Function para /api/client-directory
const CLIENT_FORM_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1FKcCl_7mQyfcyDhY64XMehfTfhzlyTkIOXVgdB3Bp74/export?format=csv';

function cleanClientName(rawName) {
  if (!rawName) return '';
  let name = rawName.replace(/[\(\[\{].*?[\)\]\}]/g, '');
  return name.replace(/\s+/g, ' ').trim();
}

function cleanClientPhone(rawPhone) {
  if (!rawPhone) return '';
  const firstPhone = String(rawPhone).split(/[,;\/]/)[0];
  let digits = firstPhone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('502')) {
    digits = digits.slice(3);
  }
  return digits;
}

function parseCSV(text) {
  const rows = [];
  let currentRow = [];
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const resp = await fetch(`${CLIENT_FORM_SHEET_URL}&_t=${Date.now()}`, {
      headers: { 'User-Agent': 'OneDaySpaces/1.0' }
    });

    if (!resp.ok) {
      return res.status(502).json({ status: 'error', message: 'Error al contactar Google Sheets' });
    }

    const csvText = await resp.text();
    const rows = parseCSV(csvText);

    if (rows.length <= 1) {
      return res.json({ status: 'success', count: 0, clients: [] });
    }

    const headers = rows[0].map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
    const nameIdx = headers.findIndex(h => h.includes('nombre'));
    const phoneIdx = headers.findIndex(h => h.includes('tel') || h.includes('cel') || h.includes('phone'));
    const emailIdx = headers.findIndex(h => h.includes('correo') || h.includes('email'));

    const clients = [];
    const seenNames = new Set();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawName = nameIdx >= 0 && row[nameIdx] ? row[nameIdx] : '';
      const rawPhone = phoneIdx >= 0 && row[phoneIdx] ? row[phoneIdx] : '';
      const rawEmail = emailIdx >= 0 && row[emailIdx] ? row[emailIdx] : '';

      const nombre = cleanClientName(rawName);
      const telefono = cleanClientPhone(rawPhone);
      const email = rawEmail ? rawEmail.trim() : '';

      if (!nombre || nombre.length < 2) continue;

      const normName = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!seenNames.has(normName)) {
        seenNames.add(normName);
        clients.push({ nombre, telefono, email });
      }
    }

    return res.status(200).json({
      status: 'success',
      count: clients.length,
      clients
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Error interno del servidor'
    });
  }
}
