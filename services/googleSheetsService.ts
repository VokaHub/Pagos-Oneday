import { Payment, Oficina } from '../types';

export const GOOGLE_SHEETS_STORAGE_KEY = 'oneday_google_sheets_webhook_url';

export const DEFAULT_GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwVXWa8SL7Z5SGHhdlKduGb1LpuQrbgeIAheETA9VxQRHKC6eQABYzQzs8CuY0pQOhCrQ/exec';

export interface GoogleSheetsConfig {
  webhookUrl: string;
  autoSync: boolean;
}

export interface SheetPaymentRow {
  fechaRegistro?: string;
  id?: string;
  cliente?: string;
  telefono?: string;
  oficina?: string;
  horas?: number | string;
  monto?: number | string;
  fechaServicio?: string;
  fechaPago?: string;
  metodoPago?: string;
  estado?: string;
  notas?: string;
  comprobanteUrl?: string;
  [key: string]: any;
}

export interface ClientPaymentSubmission {
  id?: string;
  cliente: string;
  telefono?: string;
  email?: string;
  oficina: Oficina | string;
  horas: number;
  monto: number;
  boleta?: string;
  fechaServicio: string;
  fechaPago?: string;
  metodoPago?: string;
  requiereFactura?: boolean;
  nit?: string;
  nombreFactura?: string;
  notas?: string;
  comprobanteImg?: string;
  comprobanteUrl?: string;
}

const ACTIVE_DEPLOYMENT_SUBSTRING = 'AKfycbwVXWa8SL7Z5SGHhdlKduGb1LpuQrbgeIAheETA9VxQRHKC6eQABYzQzs8CuY0pQOhCrQ';

export const getGoogleSheetsConfig = (): GoogleSheetsConfig => {
  try {
    const saved = localStorage.getItem(GOOGLE_SHEETS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const url = parsed.webhookUrl;
      // Auto-migrate if empty or if pointing to an older deployment
      if (!url || typeof url !== 'string' || !url.includes(ACTIVE_DEPLOYMENT_SUBSTRING)) {
        const freshConfig: GoogleSheetsConfig = {
          webhookUrl: DEFAULT_GOOGLE_SHEETS_WEBHOOK_URL,
          autoSync: parsed.autoSync ?? true,
        };
        saveGoogleSheetsConfig(freshConfig);
        return freshConfig;
      }
      return {
        webhookUrl: parsed.webhookUrl || DEFAULT_GOOGLE_SHEETS_WEBHOOK_URL,
        autoSync: parsed.autoSync ?? true,
      };
    }
  } catch (e) {
    console.error('Error al leer configuración de Google Sheets:', e);
  }
  return {
    webhookUrl: DEFAULT_GOOGLE_SHEETS_WEBHOOK_URL,
    autoSync: true,
  };
};

export const saveGoogleSheetsConfig = (config: GoogleSheetsConfig): void => {
  try {
    localStorage.setItem(GOOGLE_SHEETS_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error al guardar configuración de Google Sheets:', e);
  }
};

/**
 * Fetches recorded payments from Google Sheets
 */
export const fetchPaymentsFromSheet = async (
  webhookUrl?: string
): Promise<{ success: boolean; pagos: SheetPaymentRow[]; message?: string }> => {
  const url = (webhookUrl && webhookUrl.trim().startsWith('http')) 
    ? webhookUrl.trim() 
    : getGoogleSheetsConfig().webhookUrl;

  // 1. Try local server API route first (fast, handles caching & avoids browser CORS)
  try {
    const apiRes = await fetch(`/api/sheets-payments?force=true&url=${encodeURIComponent(url)}&t=${Date.now()}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.status === 'success' && Array.isArray(data.pagos)) {
        return { success: true, pagos: data.pagos };
      }
    }
  } catch (e) {
    // Continue to direct webhook if server API fails
  }

  // 2. Direct Webhook fallback
  if (!url || !url.trim().startsWith('http')) {
    return { success: false, pagos: [], message: 'URL de Google Sheets no configurada' };
  }

  try {
    const fetchUrl = `${url.trim()}?action=getPayments&t=${Date.now()}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }
    const data = await response.json();
    if (data.status === 'success' && Array.isArray(data.pagos)) {
      return { success: true, pagos: data.pagos };
    }
    return { success: false, pagos: [], message: data.message || 'Respuesta no válida de Google Sheets' };
  } catch (error: any) {
    console.error('Error obteniendo pagos de Google Sheets:', error);
    return { success: false, pagos: [], message: error?.message || 'Error de conexión con Google Sheets' };
  }
};

/**
 * Helper to submit to Google Apps Script via invisible form as the ultimate fallback
 */
function submitViaHiddenForm(url: string, data: any): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(false);

    try {
      const iframeName = `gs_frame_${Date.now()}`;
      const iframe = document.createElement('iframe');
      iframe.name = iframeName;
      iframe.style.display = 'none';

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = url;
      form.target = iframeName;
      form.style.display = 'none';

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'data';
      input.value = JSON.stringify(data);
      form.appendChild(input);

      document.body.appendChild(iframe);
      document.body.appendChild(form);

      let finished = false;
      const done = () => {
        if (!finished) {
          finished = true;
          setTimeout(() => {
            try {
              if (form.parentNode) form.parentNode.removeChild(form);
              if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            } catch {}
          }, 2000);
          resolve(true);
        }
      };

      iframe.onload = done;
      iframe.onerror = done;
      setTimeout(done, 3000);

      form.submit();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Sends a single payment or client submission to Google Sheets
 */
export const sendPaymentToGoogleSheets = async (
  payment: Payment | ClientPaymentSubmission,
  webhookUrl?: string
): Promise<{ success: boolean; message: string; comprobanteUrl?: string }> => {
  const targetUrl = (webhookUrl && webhookUrl.trim().startsWith('http') && webhookUrl.includes(ACTIVE_DEPLOYMENT_SUBSTRING))
    ? webhookUrl.trim()
    : DEFAULT_GOOGLE_SHEETS_WEBHOOK_URL;

  const rawComprobanteUrl = (payment as any).comprobanteUrl || 
    (typeof (payment as any).comprobanteImg === 'string' && (payment as any).comprobanteImg.startsWith('http') ? (payment as any).comprobanteImg : '');

  const dataToSend = {
    action: 'add_payment',
    timestamp: new Date().toISOString(),
    id: payment.id || `PAY-${Date.now()}`,
    cliente: payment.cliente || '',
    telefono: (payment as any).telefono || '',
    email: (payment as any).email || '',
    oficina: payment.oficina || '',
    horas: Number((payment as any).horas) || 1,
    monto: Number((payment as any).monto) || 0,
    boleta: (payment as any).boleta || '',
    fechaServicio: (payment as any).fechaServicio || (payment as any).fecha || '',
    fechaPago: (payment as any).fechaPago || (payment as any).fecha || new Date().toISOString().split('T')[0],
    metodoPago: (payment as any).metodoPago || 'Transferencia Bancaria',
    estado: (payment as any).estado || 'Pagado',
    requiereFactura: (payment as any).requiereFactura ? 'SÍ' : 'NO',
    nit: (payment as any).nit || '',
    nombreFactura: (payment as any).nombreFactura || '',
    notas: payment.notas || '',
    tieneComprobante: (rawComprobanteUrl || (payment as any).comprobanteImg) ? 'SÍ (Imagen cargada)' : 'NO',
    comprobanteUrl: rawComprobanteUrl,
    comprobanteImg: (payment as any).comprobanteImg || rawComprobanteUrl || '',
    customWebhookUrl: targetUrl,
  };

  // 1. Try local server proxy first (includes credentials and CORS headers)
  try {
    const serverRes = await fetch(`/api/save-payment?url=${encodeURIComponent(targetUrl)}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSend),
    });

    const contentType = serverRes.headers.get('content-type') || '';
    if (serverRes.ok && contentType.includes('application/json')) {
      const resJson = await serverRes.json();
      if (resJson.status === 'success') {
        return {
          success: true,
          message: resJson.message || 'Guardado exitosamente en Google Sheets',
          comprobanteUrl: resJson.comprobanteUrl,
        };
      }
      if (resJson.message) {
        return {
          success: false,
          message: resJson.message,
          comprobanteUrl: resJson.comprobanteUrl,
        };
      }
    }
  } catch (e) {
    console.warn('[Google Sheets] Proxy local no disponible, recurriendo a conexión directa:', e);
  }

  // 2. Direct POST to Google Apps Script Web App (native text/plain avoids browser preflight)
  if (targetUrl && targetUrl.trim().startsWith('http')) {
    try {
      const directRes = await fetch(targetUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(dataToSend),
        redirect: 'follow',
      });

      const directText = await directRes.text();
      try {
        const directJson = JSON.parse(directText);
        if (directJson.status === 'success') {
          return {
            success: true,
            message: directJson.message || 'Guardado exitosamente en Google Sheets',
            comprobanteUrl: directJson.comprobanteUrl,
          };
        }
      } catch {
        if (directRes.ok) {
          return {
            success: true,
            message: 'Datos procesados por Google Sheets con éxito.',
          };
        }
      }
    } catch (error: any) {
      console.warn('[Google Sheets] Fetch directo bloqueado por navegador, intentando vía formulario:', error);
    }

    // 3. Fallback to hidden form POST
    try {
      const formOk = await submitViaHiddenForm(targetUrl.trim(), dataToSend);
      if (formOk) {
        return {
          success: true,
          message: 'Datos enviados a Google Sheets exitosamente.',
        };
      }
    } catch (fErr) {
      console.error('[Google Sheets] Error en formulario secundario:', fErr);
    }
  }

  return {
    success: false,
    message: 'No se pudo contactar con Google Sheets. Verifique su conexión.',
  };
};

/**
 * Sends a list of payments in bulk to Google Sheets
 */
export const syncAllPaymentsToGoogleSheets = async (
  payments: Payment[],
  webhookUrl?: string
): Promise<{ success: boolean; count: number; message: string }> => {
  const url = webhookUrl || getGoogleSheetsConfig().webhookUrl;
  if (!url || !url.trim().startsWith('http')) {
    return {
      success: false,
      count: 0,
      message: 'No se ha configurado la URL del Webhook de Google Sheets.',
    };
  }

  let successCount = 0;
  for (const payment of payments) {
    const res = await sendPaymentToGoogleSheets(payment, url);
    if (res.success) {
      successCount++;
    }
  }

  return {
    success: successCount > 0,
    count: successCount,
    message: `Se sincronizaron ${successCount} de ${payments.length} pagos con Google Sheets.`,
  };
};

export const CLEAN_HEADERS_ARRAY = [
  "Fecha Registro",
  "ID Registro",
  "Cliente",
  "Teléfono",
  "Oficina",
  "Horas",
  "Monto (Q)",
  "Fecha Servicio",
  "Fecha Pago",
  "Método Pago",
  "Estado",
  "Notas",
  "Link Comprobante",
  "Vista Previa Imagen"
];

export const CLEAN_HEADERS_TSV = CLEAN_HEADERS_ARRAY.join('\t');

export const repairGoogleSheetsHeaders = async (webhookUrlOverride?: string): Promise<{ success: boolean; message: string }> => {
  const url = webhookUrlOverride || getGoogleSheetsConfig().webhookUrl;
  if (!url || !url.trim().startsWith('http')) {
    return {
      success: false,
      message: 'Ingresa primero la URL de tu Webhook de Apps Script.'
    };
  }

  try {
    const res = await fetch(url.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'reparar_encabezados' }),
      redirect: 'follow',
    });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.status === 'success') {
        return { success: true, message: json.message || 'Encabezados reparados exitosamente en Google Sheet.' };
      }
    } catch {
      if (res.ok) {
        return { success: true, message: 'Orden de encabezados actualizado en Google Sheets.' };
      }
    }
  } catch (err: any) {
    console.warn('Error reparando encabezados:', err);
  }

  return {
    success: true,
    message: 'Se envió la orden de reparación a Google Sheets. Si no se actualiza de inmediato, copia los encabezados y pégalos en la celda A1.'
  };
};

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * =========================================================================
 * ONEDAY SPACES: GOOGLE SHEETS WEBHOOK (CON TELÉFONO Y CLOUDINARY)
 * =========================================================================
 * 
 * INSTRUCCIONES DE INSTALACIÓN RÁPIDA:
 * 
 * 1. En tu hoja de cálculo (Google Sheets):
 *    Haz clic en el menú superior: Extensiones > Apps Script.
 * 2. Borra cualquier código anterior y pega TODO este código limpio.
 * 
 * 3. IMPLEMENTAR LA APLICACIÓN WEB:
 *    - Haz clic en el botón azul arriba a la derecha: "Implementar" > "Gestionar implementaciones".
 *    - Haz clic en el ícono de Lápiz (Editar).
 *    - En Versión, selecciona: "Nueva versión".
 *    - Asegúrate de que esté configurado:
 *        • Ejecutar como: "Yo" (tu correo)
 *        • Quién tiene acceso: "Cualquier persona" (Anyone)
 *    - Haz clic en "Implementar" y copia la URL que termina en "/exec".
 * =========================================================================
 */

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
    
    // Obtener pagos registrados en el Sheet
    if (action === "getPayments") {
      var pagos = obtenerPagosDeSheet();
      return responderJSON({ 
        status: "success", 
        count: pagos.length, 
        pagos: pagos 
      });
    }

    return responderJSON({ 
      status: "success", 
      message: "API OneDay Google Sheets activa y lista."
    });
  } catch (error) {
    return responderJSON({ status: "error", message: error.toString() });
  }
}

function asegurarEncabezados(sheet) {
  var encabezadosLimpios = [
    "Fecha Registro",
    "ID Registro",
    "Cliente",
    "Teléfono",
    "Oficina",
    "Horas",
    "Monto (Q)",
    "Fecha Servicio",
    "Fecha Pago",
    "Método Pago",
    "Estado",
    "Notas",
    "Link Comprobante",
    "Vista Previa Imagen"
  ];

  var lastCol = sheet.getLastColumn();
  var needsFix = false;

  if (lastCol === 0 || sheet.getLastRow() === 0) {
    needsFix = true;
  } else {
    var row1Values = sheet.getRange(1, 1, 1, Math.min(Math.max(lastCol, 1), 20)).getValues()[0];
    var colD = String(row1Values[3] || '').trim().toLowerCase();
    // Si la columna D no es Teléfono o si hay columnas sobrantes
    if (colD.indexOf('tel') === -1 || lastCol > 14) {
      needsFix = true;
    }
  }

  if (needsFix) {
    // Si hay columnas sobrantes en la hoja (de la columna 15 en adelante), limpiarlas
    if (sheet.getLastColumn() > 14) {
      sheet.getRange(1, 15, Math.max(sheet.getLastRow(), 1), sheet.getLastColumn() - 14).clearContent().clearFormat();
    }
    var range = sheet.getRange(1, 1, 1, 14);
    range.setValues([encabezadosLimpios]);
    range.setBackground("#0F172A");
    range.setFontColor("#FFFFFF");
    range.setFontWeight("bold");
    range.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }
}

function repararHoja() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  asegurarEncabezados(sheet);
}

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    
    // Aseguramos encabezados en orden correcto siempre (14 columnas con Teléfono en col D)
    asegurarEncabezados(sheet);

    if (data.action === "reparar_encabezados") {
      return responderJSON({
        status: "success",
        message: "Encabezados corregidos exitosamente en tu Google Sheet (14 columnas con Teléfono a la par de Cliente)"
      });
    }
    
    var nowStr = Utilities.formatDate(new Date(), "America/Guatemala", "yyyy-MM-dd HH:mm:ss");
    
    // URL directa del comprobante alojado en Cloudinary
    var comprobanteUrl = data.comprobanteUrl || "";
    if (!comprobanteUrl && data.comprobanteImg && typeof data.comprobanteImg === "string" && data.comprobanteImg.indexOf("http") === 0) {
      comprobanteUrl = data.comprobanteImg;
    }

    var formulaImagen = "";
    if (comprobanteUrl && comprobanteUrl.indexOf("http") === 0) {
      formulaImagen = '=IMAGE("' + comprobanteUrl + '")';
    }
    
    sheet.appendRow([
      nowStr,
      data.id || "",
      data.cliente || "",
      data.telefono || "",
      data.oficina || "",
      data.horas || 1,
      data.monto || 0,
      data.fechaServicio || "",
      data.fechaPago || "",
      data.metodoPago || "Transferencia Bancaria",
      data.estado || "Pagado",
      data.notas || "",
      comprobanteUrl || "Sin comprobante",
      formulaImagen || ""
    ]);
    
    return responderJSON({ 
      status: "success", 
      message: "Registro guardado exitosamente en Google Sheets con Teléfono y comprobante",
      comprobanteUrl: comprobanteUrl 
    });
  } catch (error) {
    return responderJSON({ status: "error", message: error.toString() });
  }
}

function obtenerPagosDeSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var lastCol = sheet.getLastColumn();
  var row1 = sheet.getRange(1, 1, 1, Math.min(Math.max(lastCol, 1), 20)).getValues()[0];
  var colDHeader = String(row1[3] || '').toLowerCase().trim();
  // Detectar si la columna D es Teléfono (14 columnas) o Oficina (13 columnas legacy)
  var hasPhoneCol = colDHeader.indexOf('tel') !== -1 || colDHeader.indexOf('cel') !== -1;

  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var pagos = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[1] && !row[2] && !row[3]) continue;
    
    var telefono = "";
    var oficina = "";
    var horasIdx = 4;
    var montoIdx = 5;
    var fServicioIdx = 6;
    var fPagoIdx = 7;
    var metodoIdx = 8;
    var estadoIdx = 9;
    var notasIdx = 10;
    var compUrlIdx = 11;

    if (hasPhoneCol) {
      telefono = row[3] ? String(row[3]).trim() : "";
      oficina = row[4] ? String(row[4]).trim() : "";
      horasIdx = 5;
      montoIdx = 6;
      fServicioIdx = 7;
      fPagoIdx = 8;
      metodoIdx = 9;
      estadoIdx = 10;
      notasIdx = 11;
      compUrlIdx = 12;
    } else {
      // Formato legacy sin columna de teléfono
      oficina = row[3] ? String(row[3]).trim() : "";
    }

    var fechaServicioStr = "";
    if (row[fServicioIdx]) {
      if (row[fServicioIdx] instanceof Date) {
        fechaServicioStr = Utilities.formatDate(row[fServicioIdx], "America/Guatemala", "yyyy-MM-dd");
      } else {
        fechaServicioStr = String(row[fServicioIdx]).trim();
      }
    }
    
    var fechaPagoStr = "";
    if (row[fPagoIdx]) {
      if (row[fPagoIdx] instanceof Date) {
        fechaPagoStr = Utilities.formatDate(row[fPagoIdx], "America/Guatemala", "yyyy-MM-dd");
      } else {
        fechaPagoStr = String(row[fPagoIdx]).trim();
      }
    }

    pagos.push({
      fechaRegistro: row[0] ? String(row[0]) : "",
      id: row[1] ? String(row[1]) : "",
      cliente: row[2] ? String(row[2]) : "",
      telefono: telefono,
      oficina: oficina,
      horas: row[horasIdx] !== undefined && row[horasIdx] !== "" ? Number(row[horasIdx]) || 1 : 1,
      monto: row[montoIdx] !== undefined && row[montoIdx] !== "" ? Number(row[montoIdx]) || 0 : 0,
      fechaServicio: fechaServicioStr,
      fechaPago: fechaPagoStr,
      metodoPago: row[metodoIdx] ? String(row[metodoIdx]) : "Transferencia Bancaria",
      estado: row[estadoIdx] ? String(row[estadoIdx]) : "Pagado",
      notas: row[notasIdx] ? String(row[notasIdx]) : "",
      comprobanteUrl: row[compUrlIdx] ? String(row[compUrlIdx]) : ""
    });
  }
  return pagos;
}

function responderJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

