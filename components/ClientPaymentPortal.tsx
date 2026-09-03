import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Oficina, EstadoPago, Payment, OFFICE_BANK_DETAILS, BankAccountInfo, DEFAULT_CLIENTS_LIST } from '../types';
import { sendPaymentToGoogleSheets, ClientPaymentSubmission } from '../services/googleSheetsService';
import { uploadReceiptToCloudinary } from '../services/cloudinaryService';

interface ClientPaymentPortalProps {
  onPaymentSubmitted: (payment: Payment | Payment[]) => void;
  onNavigateToAdmin: () => void;
  allPayments?: Payment[];
}

interface ServiceRow {
  id: string;
  oficina: Oficina;
  horas: number;
  fechaServicio: string;
}

const formatCurrency = (amount: number) => {
  return `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const toLocalDateString = (date: Date): string => {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
};

const normalizeText = (text: string) => {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const HOURLY_RATE = 65;
const SUGGESTION_START_DATE = '2026-08-31';

const OFFICES: { id: Oficina; label: string }[] = [
  { id: Oficina.O1201, label: 'Oficina 1201' },
  { id: Oficina.O203B, label: 'Oficina 203B' },
  { id: Oficina.O211B, label: 'Oficina 211B' },
  { id: Oficina.O232B, label: 'Oficina 232B' },
  { id: Oficina.O323, label: 'Oficina 323 (Vitalé)' },
];

const ADMIN_PINS = ['1823'];

const ClientPaymentPortal: React.FC<ClientPaymentPortalProps> = ({ 
  onPaymentSubmitted, 
  onNavigateToAdmin,
  allPayments = []
}) => {
  // Form State
  const [cliente, setCliente] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const clientInputContainerRef = useRef<HTMLDivElement>(null);

  // Security / Admin Pin Modal
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState(false);

  // Form Fields in exact order:
  // 1. Nombre Completo o Empresa (con sugerencias de citas pendientes)
  // 2. Foto o Captura del Comprobante
  // 3. Oficinas Utilizadas
  // 4. Cuentas Bancarias
  // 5. Total a Transferir
  // 6. Botón Enviar
  const [rows, setRows] = useState<ServiceRow[]>([
    {
      id: `row-${Date.now()}-1`,
      oficina: Oficina.O1201,
      horas: 1,
      fechaServicio: toLocalDateString(new Date()),
    },
  ]);
  const [comprobanteImg, setComprobanteImg] = useState<string | undefined>(undefined);

  // Client suggestions from default list & real payments
  const allKnownClients = useMemo(() => {
    const list = new Set<string>(DEFAULT_CLIENTS_LIST.filter(n => n && n.trim().length > 2));
    allPayments.forEach(p => {
      if (p.cliente && p.cliente.trim().length > 2) {
        list.add(p.cliente.trim());
      }
    });
    return Array.from(list);
  }, [allPayments]);

  // Filtered client suggestions
  const clientSuggestions = useMemo(() => {
    const trimmed = cliente.trim();
    if (!trimmed) return allKnownClients.slice(0, 8);
    const norm = normalizeText(trimmed);
    return allKnownClients
      .filter((n) => normalizeText(n).includes(norm))
      .slice(0, 8);
  }, [cliente, allKnownClients]);

  // Look for the last unpaid appointment for the entered client from August 31, 2026 onward
  const suggestedUnpaidAppointment = useMemo(() => {
    const trimmed = cliente.trim();
    if (!trimmed || trimmed.length < 3 || allPayments.length === 0) return null;
    const clientNorm = normalizeText(trimmed);

    // Find all matching unpaid appointments from SUGGESTION_START_DATE
    const matching = allPayments.filter(p => {
      if (p.estado === EstadoPago.Pagado) return false;
      const pNorm = normalizeText(p.cliente || '');
      const matchesName = pNorm.includes(clientNorm) || clientNorm.includes(pNorm);
      if (!matchesName) return false;
      
      // Must be on or after 2026-08-31
      return (p.fecha || '') >= SUGGESTION_START_DATE;
    });

    if (matching.length === 0) return null;

    // Sort to pick the most recent
    matching.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    return matching[0];
  }, [cliente, allPayments]);

  // Apply suggested unpaid appointment to form
  const handleApplySuggestedAppointment = (apt: Payment) => {
    const validOffice = Object.values(Oficina).includes(apt.oficina as Oficina) 
      ? (apt.oficina as Oficina) 
      : Oficina.O1201;

    setRows([
      {
        id: `row-suggested-${Date.now()}`,
        oficina: validOffice,
        horas: apt.horas || 1,
        fechaServicio: apt.fecha || toLocalDateString(new Date()),
      }
    ]);
  };

  // Click outside listener to dismiss suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        clientInputContainerRef.current &&
        !clientInputContainerRef.current.contains(event.target as Node)
      ) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedBankKey, setCopiedBankKey] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<{
    cliente: string;
    total: number;
    rows: ServiceRow[];
    googleSheetsSuccess?: boolean;
    googleSheetsMessage?: string;
    payments?: Payment[];
  } | null>(null);

  // Total Hours and Amount calculations
  const totalHoras = useMemo(() => {
    return rows.reduce((acc, r) => acc + (Number(r.horas) || 0), 0);
  }, [rows]);

  const totalAmount = useMemo(() => {
    return totalHoras * HOURLY_RATE;
  }, [totalHoras]);

  // Bank Accounts Required for the selected offices
  const requiredBankAccounts = useMemo(() => {
    const map = new Map<string, { account: BankAccountInfo; offices: string[] }>();
    rows.forEach((r) => {
      const bank = OFFICE_BANK_DETAILS[r.oficina];
      if (bank) {
        const key = `${bank.banco}-${bank.cuenta}`;
        if (!map.has(key)) {
          map.set(key, { account: bank, offices: [r.oficina] });
        } else {
          const entry = map.get(key)!;
          if (!entry.offices.includes(r.oficina)) {
            entry.offices.push(r.oficina);
          }
        }
      }
    });
    return Array.from(map.entries()).map(([key, data]) => ({
      key,
      account: data.account,
      offices: data.offices,
    }));
  }, [rows]);

  // Row Manipulation Handlers
  const handleAddRow = () => {
    const newRow: ServiceRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      oficina: Oficina.O1201,
      horas: 1,
      fechaServicio: toLocalDateString(new Date()),
    };
    setRows((prev) => [...prev, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRowOficina = (id: string, oficina: Oficina) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, oficina } : r))
    );
  };

  const handleUpdateRowFecha = (id: string, fechaServicio: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, fechaServicio } : r))
    );
  };

  const handleDecrementRowHours = (id: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === id && r.horas > 1) {
          return { ...r, horas: r.horas - 1 };
        }
        return r;
      })
    );
  };

  const handleIncrementRowHours = (id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, horas: r.horas + 1 } : r))
    );
  };

  // Copy Bank Account
  const handleCopyBankAccount = (key: string, accountNumber: string) => {
    navigator.clipboard.writeText(accountNumber);
    setCopiedBankKey(key);
    setTimeout(() => setCopiedBankKey(null), 2500);
  };

  // Compression helper to optimize receipts for lightning-fast uploads
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const MAX_DIM = 1000;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Highly readable at ~80-160KB JPEG for immediate, seamless transmission
          const compressed = canvas.toDataURL('image/jpeg', 0.75);
          resolve(compressed);
        };
        img.onerror = () => {
          resolve(event.target?.result as string);
        };
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // File Upload Handler
  const handleFileChange = async (file?: File) => {
    if (file && (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(file.name))) {
      try {
        const compressed = await compressImageFile(file);
        setComprobanteImg(compressed);
      } catch (err) {
        console.error('Error al optimizar imagen:', err);
        const reader = new FileReader();
        reader.onload = (e) => {
          setComprobanteImg(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Admin PIN verification
  const handleVerifyAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = adminPinInput.trim().toLowerCase();
    if (ADMIN_PINS.includes(pin)) {
      setShowAdminPinModal(false);
      setAdminPinInput('');
      setAdminPinError(false);
      onNavigateToAdmin();
    } else {
      setAdminPinError(true);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cliente.trim()) {
      alert('Por favor ingrese su nombre o razón social.');
      return;
    }

    if (rows.length === 0) {
      alert('Por favor agregue al menos una fila de servicio.');
      return;
    }

    if (!comprobanteImg) {
      const confirmWithout = window.confirm(
        '¿Desea enviar el reporte sin adjuntar la foto del comprobante? Se recomienda adjuntarla para validar su pago rápidamente.'
      );
      if (!confirmWithout) return;
    }

    setIsSubmitting(true);

    // 1. Subir comprobante a Cloudinary para obtener una URL pública HTTPS inmediata
    let hostedComprobanteUrl = '';
    if (comprobanteImg) {
      try {
        const uploadRes = await uploadReceiptToCloudinary(
          comprobanteImg,
          cliente.trim(),
          rows[0]?.oficina
        );
        if (uploadRes.success && uploadRes.url) {
          hostedComprobanteUrl = uploadRes.url;
        }
      } catch (errUpload) {
        console.warn('Advertencia al subir a Cloudinary:', errUpload);
      }
    }

    const submissionDate = toLocalDateString(new Date());
    const newPayments: Payment[] = [];
    let allSucceeded = true;
    let syncMessage = '';

    // Create a payment record for each row and send to Google Sheets
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const subId = `PAG-${Date.now().toString().slice(-6)}-${i + 1}`;
      const rowMonto = r.horas * HOURLY_RATE;

      const newPaymentData: Payment = {
        id: subId,
        cliente: cliente.trim(),
        oficina: r.oficina,
        horas: r.horas,
        monto: rowMonto,
        boleta: 'Comprobante adjunto',
        fecha: r.fechaServicio,
        fechaPago: submissionDate,
        estado: EstadoPago.Pagado,
        metodoPago: 'Transferencia Bancaria',
        notas: rows.length > 1 ? `Boleta combinada (${rows.length} oficinas)` : 'Reporte portal clientes',
        comprobanteImg: hostedComprobanteUrl || comprobanteImg,
        revisado: false,
      };

      newPayments.push(newPaymentData);

      const clientSubmission: ClientPaymentSubmission = {
        id: subId,
        cliente: cliente.trim(),
        telefono: '',
        email: '',
        oficina: r.oficina,
        horas: r.horas,
        monto: rowMonto,
        boleta: 'Comprobante adjunto',
        fechaServicio: r.fechaServicio,
        fechaPago: submissionDate,
        metodoPago: 'Transferencia Bancaria',
        requiereFactura: false,
        nit: '',
        nombreFactura: '',
        notas: rows.length > 1 ? `Boleta combinada (${rows.length} oficinas)` : 'Reporte portal clientes',
        comprobanteImg: hostedComprobanteUrl || comprobanteImg,
        comprobanteUrl: hostedComprobanteUrl || '',
      };

      try {
        const sheetRes = await sendPaymentToGoogleSheets(clientSubmission);
        if (sheetRes.success) {
          syncMessage = sheetRes.message;
          if (sheetRes.comprobanteUrl && !sheetRes.comprobanteUrl.startsWith('Error')) {
            newPaymentData.comprobanteImg = sheetRes.comprobanteUrl;
          }
        } else {
          allSucceeded = false;
          syncMessage = sheetRes.message || 'Error de conexión con Google Sheets';
        }
      } catch (err: any) {
        allSucceeded = false;
        syncMessage = err?.message || 'Error de red al conectar con Google Sheets';
        console.error('Error enviando fila a Google Sheets:', err);
      }
    }

    // Save locally to pending client submissions for future matching
    try {
      const existingRaw = localStorage.getItem('oneday_pending_client_submissions') || '[]';
      const existing = JSON.parse(existingRaw);
      localStorage.setItem('oneday_pending_client_submissions', JSON.stringify([...existing, ...newPayments]));
    } catch (e) {
      console.warn('Could not save to local pending store:', e);
    }

    // Inform parent (without automatically altering admin table of records)
    onPaymentSubmitted(newPayments);

    setSubmittedData({
      cliente: cliente.trim(),
      total: totalAmount,
      rows: [...rows],
      googleSheetsSuccess: allSucceeded,
      googleSheetsMessage: syncMessage,
      payments: newPayments,
    });

    setIsSubmitting(false);
  };

  const handleReset = () => {
    setCliente('');
    setRows([
      {
        id: `row-${Date.now()}-1`,
        oficina: Oficina.O1201,
        horas: 1,
        fechaServicio: toLocalDateString(new Date()),
      },
    ]);
    setComprobanteImg(undefined);
    setSubmittedData(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
              OD
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">ONEDAY Spaces</h1>
              <p className="text-[11px] text-slate-500">Portal de Pago y Reporte de Oficinas</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowAdminPinModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition flex items-center gap-1.5"
              title="Acceso restringido para administración"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Administración</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl w-full mx-auto px-4 py-8 flex-1">
        {submittedData ? (
          /* Confirmation Screen */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-1">
              Comprobante Recibido
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Gracias, <strong>{submittedData.cliente}</strong>. Tu reporte ha sido registrado exitosamente en el sistema.
            </p>

            {/* Google Sheets Sync Indicator */}
            {submittedData.googleSheetsSuccess ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium mb-6">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Sincronizado con Google Sheets</span>
              </div>
            ) : (
              <div className="mb-6 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex flex-col items-center gap-2 max-w-md mx-auto">
                <div className="flex items-center gap-1.5 font-medium">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{submittedData.googleSheetsMessage || 'Guardado localmente. La sincronización a Sheets está en proceso.'}</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (submittedData.payments && submittedData.payments.length > 0) {
                      for (const p of submittedData.payments) {
                        await sendPaymentToGoogleSheets(p);
                      }
                      setSubmittedData({
                        ...submittedData,
                        googleSheetsSuccess: true,
                        googleSheetsMessage: 'Sincronizado con Google Sheets'
                      });
                    }
                  }}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg text-[11px] transition shadow-xs cursor-pointer"
                >
                  Reintentar sincronización con Google Sheets
                </button>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left text-xs text-slate-700 space-y-3 mb-6 max-w-md mx-auto">
              <div className="font-semibold text-slate-800 border-b border-slate-200 pb-2">
                Resumen de Oficinas Reportadas:
              </div>
              {submittedData.rows.map((r, i) => (
                <div key={r.id} className="flex justify-between items-center text-slate-600">
                  <span>
                    #{i + 1} Oficina {r.oficina} ({r.fechaServicio})
                  </span>
                  <span className="font-semibold text-slate-900">
                    {r.horas} hr{r.horas > 1 ? 's' : ''} = {formatCurrency(r.horas * HOURLY_RATE)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                <span className="font-bold text-slate-900">Total Reportado:</span>
                <span className="font-bold text-blue-700">{formatCurrency(submittedData.total)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `*Comprobante de Pago Reportado - ONEDAY Spaces*\n\n` +
                  `*Cliente:* ${submittedData.cliente}\n` +
                  `*Total:* ${formatCurrency(submittedData.total)}\n\n` +
                  `*Detalle de Oficinas:*\n` +
                  submittedData.rows
                    .map(
                      (r, i) =>
                        `• Oficina ${r.oficina} | Fecha: ${r.fechaServicio} | ${r.horas} hr${r.horas > 1 ? 's' : ''} = ${formatCurrency(r.horas * HOURLY_RATE)}`
                    )
                    .join('\n') +
                  `\n\n_Comprobante adjunto y reportado exitosamente._`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-[#25d366] hover:bg-[#20ba5a] text-white font-semibold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2z" />
                </svg>
                <span>Notificar por WhatsApp con detalle</span>
              </a>

              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Registrar otro pago
              </button>
            </div>
          </div>
        ) : (
          /* Main Clean Form with Exact Order Requested */
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            <div className="p-6 sm:p-8 space-y-6">
              
              {/* 1. Nombre Completo o Empresa with Autocomplete & Pending Appointment Suggestion */}
              <div className="relative" ref={clientInputContainerRef}>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="cliente-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    1. Nombre Completo o Empresa <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Búsqueda automática
                  </span>
                </div>

                <div className="relative">
                  <input
                    id="cliente-input"
                    type="text"
                    value={cliente}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCliente(val);
                      setShowClientSuggestions(true);
                      setHighlightedIndex(-1);
                    }}
                    onFocus={() => {
                      if (cliente.trim().length > 0) {
                        setShowClientSuggestions(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!showClientSuggestions || clientSuggestions.length === 0) return;

                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlightedIndex((prev) =>
                          prev < clientSuggestions.length - 1 ? prev + 1 : 0
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightedIndex((prev) =>
                          prev > 0 ? prev - 1 : clientSuggestions.length - 1
                        );
                      } else if (e.key === 'Enter') {
                        if (highlightedIndex >= 0 && highlightedIndex < clientSuggestions.length) {
                          e.preventDefault();
                          const selected = clientSuggestions[highlightedIndex];
                          setCliente(selected);
                          setShowClientSuggestions(false);
                        }
                      } else if (e.key === 'Escape') {
                        setShowClientSuggestions(false);
                      }
                    }}
                    placeholder="Escribe tu nombre o nombre de empresa..."
                    required
                    autoComplete="off"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm font-medium transition pr-10"
                  />

                  {cliente && (
                    <button
                      type="button"
                      onClick={() => {
                        setCliente('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 flex items-center justify-center text-sm transition"
                      title="Limpiar campo"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {showClientSuggestions && clientSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in-50 duration-100">
                    <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-100 flex justify-between items-center">
                      <span>Coincidencias encontradas ({clientSuggestions.length})</span>
                      <span className="text-[10px] lowercase font-normal text-slate-400">Clic para seleccionar</span>
                    </div>

                    {clientSuggestions.map((name, idx) => {
                      const isHighlighted = idx === highlightedIndex;
                      const initials = name
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase();

                      return (
                        <button
                          key={name}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setCliente(name);
                            setShowClientSuggestions(false);
                            setHighlightedIndex(-1);
                          }}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs transition ${
                            isHighlighted ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isHighlighted ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {initials}
                            </span>
                            <span className="font-medium">{name}</span>
                          </div>

                          <span className={`text-[10px] ${isHighlighted ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
                            Seleccionar ↵
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Sugerencia de última cita pendiente (a partir del 31 de agosto de 2026) */}
                {suggestedUnpaidAppointment && (
                  <div className="mt-3 p-3 bg-blue-50/90 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="space-y-0.5 text-xs text-blue-900">
                      <div className="font-bold flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Cita pendiente registrada en el sistema:</span>
                      </div>
                      <p className="text-blue-800 text-[11px]">
                        <strong>Oficina {suggestedUnpaidAppointment.oficina}</strong> &bull; Fecha: <strong>{suggestedUnpaidAppointment.fecha}</strong> ({suggestedUnpaidAppointment.horas} hrs &bull; {formatCurrency(suggestedUnpaidAppointment.monto)})
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplySuggestedAppointment(suggestedUnpaidAppointment)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <span>Usar datos de mi cita</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Foto o Captura del Comprobante de Pago */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  2. Foto o Captura del Comprobante de Pago
                </label>

                {comprobanteImg ? (
                  <div className="relative rounded-2xl border-2 border-emerald-400 bg-emerald-50/50 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={comprobanteImg}
                        alt="Comprobante cargado"
                        className="w-14 h-14 object-cover rounded-xl border border-slate-200 shadow-xs"
                      />
                      <div>
                        <span className="text-xs font-bold text-emerald-900 block flex items-center gap-1">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Comprobante cargado correctamente</span>
                        </span>
                        <span className="text-[11px] text-emerald-700">
                          Listo para enviar y conciliar
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setComprobanteImg(undefined)}
                      className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-semibold rounded-lg transition"
                    >
                      Cambiar foto
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30 rounded-2xl cursor-pointer transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-bold text-slate-700 mb-0.5">
                      Haz clic para subir o arrastra la captura aquí
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Formatos soportados: JPG, PNG, WEBP (hasta 10MB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e.target.files?.[0])}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* 3. Oficinas Utilizadas */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    3. Oficinas Utilizadas <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs font-semibold text-slate-500">
                    Tarifa: <strong className="text-slate-800">Q65.00 / hora</strong>
                  </span>
                </div>

                {/* Filas delgadas y compactas para teléfono */}
                <div className="space-y-2">
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl transition hover:border-slate-300"
                    >
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        {/* Selector de Oficina */}
                        <div className="flex-1 min-w-[130px]">
                          <select
                            value={row.oficina}
                            onChange={(e) => handleUpdateRowOficina(row.id, e.target.value as Oficina)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          >
                            {OFFICES.map((ofc) => (
                              <option key={ofc.id} value={ofc.id}>
                                {ofc.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Fecha de Uso */}
                        <div className="w-full sm:w-36">
                          <input
                            type="date"
                            value={row.fechaServicio}
                            onChange={(e) => handleUpdateRowFecha(row.id, e.target.value)}
                            required
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>

                        {/* Horas Utilizadas + Subtotal + Eliminar */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                          <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden h-[32px]">
                            <button
                              type="button"
                              onClick={() => handleDecrementRowHours(row.id)}
                              disabled={row.horas <= 1}
                              className="px-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xs"
                            >
                              -
                            </button>
                            <span className="px-2 text-center text-xs font-bold text-slate-900 whitespace-nowrap min-w-[40px]">
                              {row.horas} hr{row.horas > 1 ? 's' : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleIncrementRowHours(row.id)}
                              className="px-2 text-slate-600 hover:bg-slate-100 font-bold text-xs"
                            >
                              +
                            </button>
                          </div>

                          <span className="text-xs font-bold text-slate-700 min-w-[70px] text-right">
                            {formatCurrency(row.horas * HOURLY_RATE)}
                          </span>

                          {rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.id)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                              title="Eliminar fila"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="w-full py-2 border border-dashed border-slate-300 hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Agregar otra fecha u oficina</span>
                  </button>
                </div>
              </div>

              {/* 4. Cuentas para Transferencia Bancaria */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  4. Cuentas para Transferencia Bancaria
                </label>

                <div className="space-y-2.5">
                  {requiredBankAccounts.map(({ key, account, offices }) => (
                    <div
                      key={key}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{account.banco}</span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold">
                            {account.tipo}
                          </span>
                        </div>
                        <div className="text-slate-600">
                          Beneficiario: <strong>{account.nombre}</strong>
                        </div>
                        <div className="text-slate-900 font-mono font-bold tracking-wider text-sm flex items-center gap-2">
                          <span>{account.cuenta}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Aplica para: Oficina{offices.length > 1 ? 's' : ''} {offices.join(', ')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyBankAccount(key, account.cuenta)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shrink-0 ${
                          copiedBankKey === key
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {copiedBankKey === key ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            ¡Número Copiado!
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copiar Cuenta
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Total a Transferir (Justo arriba del botón de enviar) */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-xs text-slate-400 font-medium block uppercase tracking-wider">5. Total a Transferir</span>
                  <span className="text-xs text-slate-300 font-semibold">{totalHoras} hora{totalHoras > 1 ? 's' : ''} en total</span>
                </div>
                <div className="text-2xl font-black text-emerald-400 tracking-tight">
                  {formatCurrency(totalAmount)}
                </div>
              </div>
            </div>

            {/* 6. Submit Button & Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 text-center sm:text-left">
                Al enviar, su comprobante queda registrado de forma segura.
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-google-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Guardando reporte...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Enviar y Reportar Pago</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Admin PIN Security Modal */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Acceso Administrativo</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdminPinModal(false);
                  setAdminPinInput('');
                  setAdminPinError(false);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleVerifyAdminPin} className="space-y-4">
              <p className="text-xs text-slate-500">
                Ingrese su código PIN o contraseña de administrador para ingresar al panel de control.
              </p>

              <div>
                <input
                  type="password"
                  value={adminPinInput}
                  onChange={(e) => {
                    setAdminPinInput(e.target.value);
                    setAdminPinError(false);
                  }}
                  placeholder="Código PIN"
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center text-sm font-bold tracking-widest text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {adminPinError && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1.5 text-center">
                    Código incorrecto. Intente nuevamente.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminPinModal(false);
                    setAdminPinInput('');
                    setAdminPinError(false);
                  }}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  Ingresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-200 bg-white">
        ONEDAY Spaces &bull; Control y Cobro de Oficinas
      </footer>
    </div>
  );
};

export default ClientPaymentPortal;
