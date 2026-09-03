import React, { useState, useEffect } from 'react';
import { Payment } from '../types';
import { 
  getGoogleSheetsConfig, 
  saveGoogleSheetsConfig, 
  sendPaymentToGoogleSheets, 
  syncAllPaymentsToGoogleSheets,
  GOOGLE_APPS_SCRIPT_TEMPLATE 
} from '../services/googleSheetsService';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments?: Payment[];
}

const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({ isOpen, onClose, payments = [] }) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const config = getGoogleSheetsConfig();
      setWebhookUrl(config.webhookUrl || '');
      setTestResult(null);
      setSyncAllResult(null);
      setSavedSuccess(false);
      setCopiedScript(false);
    }
  }, [isOpen]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const handleSave = () => {
    saveGoogleSheetsConfig({
      webhookUrl: webhookUrl.trim(),
      autoSync: true,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSyncAllPayments = async () => {
    if (!payments || payments.length === 0) {
      setSyncAllResult({
        success: false,
        message: 'No hay pagos o citas en la tabla para sincronizar.',
      });
      return;
    }

    setSyncingAll(true);
    setSyncAllResult(null);

    const res = await syncAllPaymentsToGoogleSheets(payments, webhookUrl.trim() || undefined);
    setSyncingAll(false);
    setSyncAllResult(res);
  };

  const handleTestConnection = async () => {
    if (!webhookUrl.trim()) {
      setTestResult({
        success: false,
        message: 'Por favor ingresa primero la URL de tu Webhook de Google Apps Script.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const testPayment = {
      id: `TEST-${Date.now().toString().slice(-4)}`,
      cliente: 'Cliente Prueba ONEDAY',
      telefono: '',
      email: '',
      oficina: '1201',
      horas: 1,
      monto: 65,
      boleta: 'Comprobante de prueba',
      fechaServicio: new Date().toISOString().split('T')[0],
      fechaPago: new Date().toISOString().split('T')[0],
      metodoPago: 'Transferencia Bancaria',
      requiereFactura: false,
      nit: '',
      nombreFactura: '',
      notas: 'Prueba de conexión con Google Sheets.',
      creadoEn: new Date().toISOString(),
    };

    const res = await sendPaymentToGoogleSheets(testPayment, webhookUrl.trim());
    setTesting(false);
    setTestResult(res);

    if (res.success) {
      saveGoogleSheetsConfig({
        webhookUrl: webhookUrl.trim(),
        autoSync: true,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex justify-center items-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white text-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Conexión con Google Sheets</h2>
              <p className="text-xs text-slate-500">
                Guarda los pagos registrados directamente en tu hoja de cálculo
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-600">
          
          {/* Instructions */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Pasos para conectar tu Google Sheet:
            </h3>

            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <li>Abre tu hoja en <strong>Google Sheets</strong> y ve a <strong>Extensiones &gt; Apps Script</strong>.</li>
              <li>Borra cualquier código anterior y pega el código limpio de abajo.</li>
              <li>Haz clic en <strong>Implementar &gt; Gestionar implementaciones</strong> &gt; ícono de Lápiz &gt; <strong>Nueva versión</strong> &gt; Implementar (con acceso "Cualquiera").</li>
              <li>Copia la URL generada y pégala en la casilla inferior.</li>
            </ol>

            <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-emerald-900">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Almacenamiento de Comprobantes: <strong>Cloudinary Activo</strong> (carpeta <em>Comprobantes</em>)</span>
              </span>
              <span className="text-[11px] bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-mono text-emerald-800">
                uelrhbi7
              </span>
            </div>

            {/* Script Box */}
            <div className="mt-3">
              <div className="flex justify-between items-center px-4 py-2 bg-slate-800 text-white rounded-t-xl text-xs font-medium">
                <span>Código para Google Apps Script</span>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold text-xs transition flex items-center gap-1.5"
                >
                  {copiedScript ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-300" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Copiado</span>
                    </>
                  ) : (
                    <span>Copiar Código</span>
                  )}
                </button>
              </div>
              <pre className="p-3.5 bg-slate-900 text-slate-300 rounded-b-xl text-[11px] font-mono max-h-32 overflow-y-auto select-all">
                {GOOGLE_APPS_SCRIPT_TEMPLATE}
              </pre>
            </div>
          </div>

          {/* Webhook Input */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              URL de la Aplicación Web (Webhook)
            </label>
            <input 
              type="url" 
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
            />

            {testResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 mt-2 ${
                testResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {testResult.success ? (
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Sync All Payments Section */}
          <div className="pt-3 border-t border-slate-200 bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Sincronizar Citas de la Tabla</h4>
                <p className="text-[11px] text-slate-500">
                  Envía todas las citas y pagos registrados en el sistema ({payments.length} registros) a tu Google Sheet.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncAllPayments}
                disabled={syncingAll || payments.length === 0}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 shrink-0"
              >
                {syncingAll ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <span>Sincronizar a Sheet ({payments.length})</span>
                )}
              </button>
            </div>

            {syncAllResult && (
              <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                syncAllResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}>
                {syncAllResult.success ? (
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span>{syncAllResult.message}</span>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !webhookUrl.trim()}
            className="px-4 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 transition flex items-center gap-2"
          >
            {testing ? 'Probando...' : 'Probar Conexión'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200/60 rounded-xl text-xs font-semibold transition"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!webhookUrl.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-40 transition"
            >
              {savedSuccess ? 'Guardado' : 'Guardar'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default GoogleSheetsModal;
