import { Payment, Oficina } from '../types';

export const GOOGLE_SHEETS_STORAGE_KEY = 'oneday_google_sheets_webhook_url';

export const DEFAULT_GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxT4qVOcMRLxrOXW8DryQlQnyhhvULwx4TAZe9OjsVjpUdfxSNipJCw6OIL6OlR-yaHrg/exec';

export interface GoogleSheetsConfig {
  webhookUrl: string;
  autoSync: boolean;
}

export interface SheetPaymentRow {
  fechaRegistro?: string;
  id?: string;
  cliente?: string;
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
}

export const getGoogleSheetsConfig = (): GoogleSheetsConfig => {
  try {
    const saved = localStorage.getItem(GOOGLE_SHEETS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
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
  // 1. Try local server API route first (fast, cached)
  try {
    const apiRes = await fetch(`/api/sheets-payments?t=${Date.now()}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.status === 'success' && Array.isArray(data.pagos)) {
        return { success: true, pagos: data.pagos };
      }
    }
  } catch (e) {
    // Continue to direct webhook
  }

  // 2. Fallback to direct Webhook
  const url = webhookUrl || getGoogleSheetsConfig().webhookUrl;
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
 * Sends a single payment or client submission to Google Sheets
 */
export const sendPaymentToGoogleSheets = async (
  payment: Payment | ClientPaymentSubmission,
  webhookUrl?: string
): Promise<{ success: boolean; message: string; comprobanteUrl?: string }> => {
  // Try local server API first
  try {
    const serverRes = await fetch('/api/save-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment),
    });
    if (serverRes.ok) {
      const resJson = await serverRes.json();
      if (resJson.status === 'success') {
        return {
          success: true,
          message: resJson.message || 'Guardado exitosamente en Google Sheets',
          comprobanteUrl: resJson.comprobanteUrl,
        };
      }
    }
  } catch (e) {
    // Continue with direct POST
  }

  const url = webhookUrl || getGoogleSheetsConfig().webhookUrl;
  if (!url || !url.trim().startsWith('http')) {
    return {
      success: false,
      message: 'No se ha configurado la URL del Webhook de Google Sheets.',
    };
  }

  try {
    const dataToSend = {
      action: 'add_payment',
      timestamp: new Date().toISOString(),
      id: payment.id || `PAY-${Date.now()}`,
      cliente: payment.cliente,
      telefono: (payment as any).telefono || '',
      email: (payment as any).email || '',
      oficina: payment.oficina,
      horas: (payment as any).horas || 1,
      monto: payment.monto,
      boleta: payment.boleta || '',
      fechaServicio: (payment as any).fechaServicio || (payment as any).fecha || '',
      fechaPago: (payment as any).fechaPago || (payment as any).fecha || new Date().toISOString().split('T')[0],
      metodoPago: (payment as any).metodoPago || 'Transferencia Bancaria',
      estado: (payment as any).estado || 'Pagado',
      requiereFactura: (payment as any).requiereFactura ? 'SÍ' : 'NO',
      nit: (payment as any).nit || '',
      nombreFactura: (payment as any).nombreFactura || '',
      notas: payment.notas || '',
      tieneComprobante: (payment as any).comprobanteImg ? 'SÍ (Imagen cargada)' : 'NO',
      comprobanteImg: (payment as any).comprobanteImg || '',
    };

    await fetch(url.trim(), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataToSend),
    });

    return {
      success: true,
      message: 'Datos enviados a Google Sheets con éxito.',
    };
  } catch (error: any) {
    console.error('Error enviando a Google Sheets:', error);
    return {
      success: false,
      message: error?.message || 'Error de conexión con Google Sheets.',
    };
  }
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

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * ONEDAY SPACES: GOOGLE SHEETS (PAGOS Y COMPROBANTES DRIVE)
 * Pega este código en: Extensiones > Apps Script en tu Google Sheet
 * Luego haz clic en "Implementar" > "Gestionar implementaciones" > Editar (lápiz) > "Nueva versión" > "Implementar"
 * Acceso: "Cualquier persona" (Anyone)
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

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    
    // Si la hoja está vacía, creamos los encabezados
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Fecha Registro",
        "ID Registro",
        "Cliente",
        "Oficina",
        "Horas",
        "Monto (Q)",
        "Fecha Servicio",
        "Fecha Pago",
        "Método Pago",
        "Estado",
        "Notas",
        "Link Comprobante (Drive)",
        "Vista Previa Imagen"
      ]);
      
      var headerRange = sheet.getRange(1, 1, 1, 13);
      headerRange.setBackground("#0F172A");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    
    var nowStr = Utilities.formatDate(new Date(), "America/Guatemala", "yyyy-MM-dd HH:mm:ss");
    var comprobanteUrl = "";
    var formulaImagen = "";
    
    // Si viene la imagen en base64, la guardamos automáticamente en Google Drive
    if (data.comprobanteImg && data.comprobanteImg.indexOf("base64,") !== -1) {
      try {
        var base64Data = data.comprobanteImg.split("base64,")[1];
        var contentType = data.comprobanteImg.split(";")[0].replace("data:", "") || "image/jpeg";
        var decoded = Utilities.base64Decode(base64Data);
        var nombreLimpio = (data.cliente || "Cliente").replace(/[^a-zA-Z0-9_-]/g, "_");
        var fileName = "Comprobante_" + nombreLimpio + "_" + (data.fechaServicio || "fecha") + "_" + (data.oficina || "") + ".jpg";
        var blob = Utilities.newBlob(decoded, contentType, fileName);
        
        var folderName = "Boletas_Pagos Oneday";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        comprobanteUrl = file.getUrl();
        formulaImagen = '=IMAGE("' + file.getDownloadUrl() + '")';
      } catch (errDrive) {
        comprobanteUrl = "Error al guardar en Drive: " + errDrive.toString();
      }
    }
    
    sheet.appendRow([
      nowStr,
      data.id || "",
      data.cliente || "",
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
      message: "Registro guardado exitosamente en Google Sheets con comprobante",
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

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var pagos = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[1] && !row[2] && !row[3]) continue;
    
    var fechaServicioStr = "";
    if (row[6]) {
      if (row[6] instanceof Date) {
        fechaServicioStr = Utilities.formatDate(row[6], "America/Guatemala", "yyyy-MM-dd");
      } else {
        fechaServicioStr = String(row[6]).trim();
      }
    }
    
    var fechaPagoStr = "";
    if (row[7]) {
      if (row[7] instanceof Date) {
        fechaPagoStr = Utilities.formatDate(row[7], "America/Guatemala", "yyyy-MM-dd");
      } else {
        fechaPagoStr = String(row[7]).trim();
      }
    }

    pagos.push({
      fechaRegistro: row[0] ? String(row[0]) : "",
      id: row[1] ? String(row[1]) : "",
      cliente: row[2] ? String(row[2]) : "",
      oficina: row[3] ? String(row[3]) : "",
      horas: row[4] !== undefined && row[4] !== "" ? Number(row[4]) || 1 : 1,
      monto: row[5] !== undefined && row[5] !== "" ? Number(row[5]) || 0 : 0,
      fechaServicio: fechaServicioStr,
      fechaPago: fechaPagoStr,
      metodoPago: row[8] ? String(row[8]) : "Transferencia Bancaria",
      estado: row[9] ? String(row[9]) : "Pagado",
      notas: row[10] ? String(row[10]) : "",
      comprobanteUrl: row[11] ? String(row[11]) : ""
    });
  }
  return pagos;
}

function responderJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
