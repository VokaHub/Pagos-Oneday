import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Payment, FilterState, Oficina, EstadoPago, OFFICE_OWNERS } from './types';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import PaymentTable from './components/PaymentTable';
import PaymentFormModal from './components/PaymentFormModal';
import ConfirmationModal from './components/ConfirmationModal';
import DailyReportModal from './components/DailyReportModal';
import PaymentRequestModal from './components/PaymentRequestModal';
import ProofOfPaymentModal from './components/ProofOfPaymentModal';
import EstimatesModal from './components/EstimatesModal';
import AccumulatedReport from './components/AccumulatedReport';
import ActionFooter from './components/ActionFooter';
import ImageViewerModal from './components/ImageViewerModal';
import DuplicateConfirmationModal from './components/DuplicateConfirmationModal';
import ClientVolumeModal from './components/ClientVolumeModal';
import ClientPaymentPortal from './components/ClientPaymentPortal';
import GoogleSheetsModal from './components/GoogleSheetsModal';
import { UnmatchedPaymentsModal } from './components/UnmatchedPaymentsModal';
import { UnmatchedColumn } from './components/UnmatchedColumn';
import { 
    fetchPaymentsFromSheet, 
    SheetPaymentRow 
} from './services/googleSheetsService';

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const LOCAL_STORAGE_KEY = 'onedayAccumulatedReport';
const LOCAL_STORAGE_PAYMENTS_KEY = 'onedayPaymentsList';

type AppView = 'admin' | 'cliente';

const getInitialView = (): AppView => {
    if (typeof window === 'undefined') return 'admin';
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    if (
        path.includes('/cliente') || 
        path.includes('/pago') || 
        path.includes('/portal') ||
        search.includes('view=cliente') || 
        search.includes('portal=cliente') || 
        search.includes('portal=pago') || 
        search.includes('pago') ||
        hash.includes('cliente') || 
        hash.includes('pago') ||
        hash.includes('portal')
    ) {
        return 'cliente';
    }
    return 'admin';
};

const normalizeText = (text: string) => {
    return (text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

const parseOfficeFromText = (text: string): Oficina => {
    const t = (text || '').toLowerCase();
    if (t.includes('1201')) return Oficina.O1201;
    if (t.includes('203') || t.includes('203b')) return Oficina.O203B;
    if (t.includes('211') || t.includes('211b')) return Oficina.O211B;
    if (t.includes('232') || t.includes('232b')) return Oficina.O232B;
    if (t.includes('323') || t.includes('vitale') || t.includes('dm')) return Oficina.O323;
    return Oficina.O1201;
};

interface AccumulatedData {
    total: number;
    breakdown: { [key in Oficina]?: number };
}

interface AppState {
    payments: Payment[];
    accumulatedData: AccumulatedData;
}

const toLocalDateString = (date: Date): string => {
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
    return adjustedDate.toISOString().split('T')[0];
};

const getInitialFilters = (): FilterState => {
    return {
        searchTerm: '',
        oficina: Object.values(Oficina),
        estado: 'todos',
        fecha: '',
        fechaPago: '',
        mes: -1, // Default to "Todos los meses" so SimplyMeet appointments appear instantly
        año: 0,  // Default to "Todos los años"
        sortBy: 'date',
    };
};

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState<AppView>(getInitialView);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

    const [history, setHistory] = useState<AppState[]>(() => {
        try {
            const storedData = localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem('vokaAccumulatedReport');
            const initialAccumulated = storedData ? JSON.parse(storedData) : { total: 0, breakdown: {} };
            const storedPayments = localStorage.getItem(LOCAL_STORAGE_PAYMENTS_KEY);
            const initialPayments: Payment[] = storedPayments ? JSON.parse(storedPayments) : [];
            return [{ payments: initialPayments, accumulatedData: initialAccumulated }];
        } catch (error) {
            console.error("Error al cargar datos iniciales:", error);
            return [{ payments: [], accumulatedData: { total: 0, breakdown: {} } }];
        }
    });
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

    const { payments, accumulatedData } = history[currentHistoryIndex];

    const [filters, setFilters] = useState<FilterState>(getInitialFilters());
    
    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Pagos huérfanos o sin emparejar leídos de Excel / Sheets
    const [unmatchedPayments, setUnmatchedPayments] = useState<SheetPaymentRow[]>(() => {
        try {
            const stored = localStorage.getItem('oneday_unmatched_payments');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });
    const [isUnmatchedModalOpen, setIsUnmatchedModalOpen] = useState(false);
    const [isUnmatchedColumnOpen, setIsUnmatchedColumnOpen] = useState(true);

    // Navigation & URL routing
    const navigateToView = useCallback((view: AppView) => {
        setCurrentView(view);
        try {
            const targetUrl = view === 'cliente' ? '/cliente' : '/';
            window.history.pushState({ view }, '', targetUrl);
        } catch (e) {
            window.location.hash = view === 'cliente' ? '#cliente' : '#admin';
        }
    }, []);

    useEffect(() => {
        const handleRouteSync = () => {
            setCurrentView(getInitialView());
        };
        window.addEventListener('popstate', handleRouteSync);
        window.addEventListener('hashchange', handleRouteSync);
        return () => {
            window.removeEventListener('popstate', handleRouteSync);
            window.removeEventListener('hashchange', handleRouteSync);
        };
    }, []);

    // Persist payments & accumulated data to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(accumulatedData));
        } catch (error) {
            console.error("Error al guardar datos acumulados:", error);
        }
    }, [accumulatedData]);

    useEffect(() => {
        try {
            localStorage.setItem(LOCAL_STORAGE_PAYMENTS_KEY, JSON.stringify(payments));
        } catch (error) {
            console.error("Error al guardar lista de pagos:", error);
        }
    }, [payments]);

    const setAppState = useCallback((update: (prevState: AppState) => AppState) => {
        const newState = update(history[currentHistoryIndex]);
        const newHistory = history.slice(0, currentHistoryIndex + 1);
        newHistory.push(newState);
        setHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);
    }, [history, currentHistoryIndex]);

    // Normalizador de texto para emparejamiento inteligente de clientes
    const norm = (s?: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '').trim();

    // Motor de cuadre manual: concilia las citas del archivo (tira SimplyMeet en JSON, XLSX o CSV)
    // contra los pagos registrados en el backend de Excel (Google Sheets) y portal de clientes.
    // Regla estricta del usuario: Los pagos de Excel que no se puedan emparejar se dejan afuera.
    const reconcileAppointmentsWithExcel = useCallback(async (baseAppointments: Payment[]) => {
        if (!baseAppointments || baseAppointments.length === 0) return null;
        setIsSyncing(true);
        try {
            // 1. Obtener pagos del backend Excel / Google Sheets
            const sheetRes = await fetchPaymentsFromSheet().catch(e => ({ success: false, pagos: [], message: e?.message }));
            let sheetPagos: SheetPaymentRow[] = (sheetRes.success && Array.isArray(sheetRes.pagos)) ? sheetRes.pagos : [];

            // 2. Incorporar pagos enviados desde el portal de clientes (almacén local pendiente)
            try {
                const localSubmissionsRaw = localStorage.getItem('oneday_pending_client_submissions');
                if (localSubmissionsRaw) {
                    const localSubmissions: Payment[] = JSON.parse(localSubmissionsRaw);
                    if (Array.isArray(localSubmissions)) {
                        localSubmissions.forEach(lp => {
                            sheetPagos.push({
                                id: lp.id,
                                cliente: lp.cliente,
                                oficina: lp.oficina,
                                horas: lp.horas,
                                monto: lp.monto,
                                comprobanteUrl: lp.comprobanteImg || lp.boleta,
                                fechaServicio: lp.fecha,
                                fechaPago: lp.fechaPago || lp.fecha,
                                estado: lp.estado,
                                metodoPago: lp.metodoPago || 'Transferencia Bancaria',
                                notas: lp.notas,
                            });
                        });
                    }
                }
            } catch (e) {
                console.warn('No se pudieron leer los pagos pendientes locales:', e);
            }

            let matchedCount = 0;
            const matchedSheetIds = new Set<string>();

            // 3. Emparejar cada cita del reporte/tira con los pagos de Excel
            const reconciledAppointments: Payment[] = baseAppointments.map(appointment => {
                const appClientNorm = norm(appointment.cliente);
                const appDate = (appointment.fecha || '').split('T')[0];
                const appOffice = appointment.oficina;

                // Buscar coincidencia en Excel
                const matchingSheetPay = sheetPagos.find((sp, idx) => {
                    const spKey = sp.id || `${sp.cliente}-${sp.monto}-${idx}`;
                    if (matchedSheetIds.has(spKey)) return false;

                    const spClientNorm = norm(sp.cliente);
                    const spDate = (sp.fechaServicio || '').split('T')[0];
                    const spOffice = parseOfficeFromText(sp.oficina || '');

                    const nameMatches = (spClientNorm.length >= 3 && appClientNorm.length >= 3) &&
                        (appClientNorm.includes(spClientNorm) || spClientNorm.includes(appClientNorm));
                    const officeMatches = spOffice === appOffice;
                    const dateMatches = !spDate || spDate === appDate;

                    return nameMatches && officeMatches && dateMatches;
                });

                if (matchingSheetPay) {
                    const spKey = matchingSheetPay.id || `${matchingSheetPay.cliente}-${matchingSheetPay.monto}`;
                    matchedSheetIds.add(spKey);
                    matchedCount++;
                    const statusStr = (matchingSheetPay.estado || '').toLowerCase();
                    const estado = statusStr.includes('pagado') 
                        ? EstadoPago.Pagado 
                        : (statusStr.includes('credito') ? EstadoPago.CreditoMensual : EstadoPago.Pendiente);

                    return {
                        ...appointment,
                        estado,
                        boleta: matchingSheetPay.comprobanteUrl || appointment.boleta || 'Comprobante Sheets',
                        comprobanteImg: matchingSheetPay.comprobanteUrl || appointment.comprobanteImg || undefined,
                        fechaPago: (matchingSheetPay.fechaPago || '').split('T')[0] || appDate,
                        metodoPago: matchingSheetPay.metodoPago || 'Transferencia Bancaria',
                        revisado: estado === EstadoPago.Pagado,
                        notas: `${appointment.notas || ''} ${matchingSheetPay.notas ? `| ${matchingSheetPay.notas}` : ''}`.trim(),
                    };
                }

                // Si no se encuentra pago en Excel, la cita permanece Pendiente
                return appointment;
            });

            // "tienen que quedar afuera en el sentido de que tienen que estar en una columna o algo donde yo las pueda ver para poder emparejarlas yo"
            // Guardamos todos los pagos de Excel que no coincidieron con ninguna cita para emparejarlos manualmente
            const leftOverPayments = sheetPagos.filter((sp, idx) => {
                const spKey = sp.id || `${sp.cliente}-${sp.monto}-${idx}`;
                return !matchedSheetIds.has(spKey) && !matchedSheetIds.has(sp.id || '');
            });

            setUnmatchedPayments(leftOverPayments);
            if (leftOverPayments.length > 0) {
                setIsUnmatchedColumnOpen(true);
            }
            try {
                localStorage.setItem('oneday_unmatched_payments', JSON.stringify(leftOverPayments));
            } catch (e) {
                console.warn('Error al guardar pagos huérfanos:', e);
            }

            setAppState(prevState => ({
                ...prevState,
                payments: reconciledAppointments,
            }));

            const unmatchedAptCount = reconciledAppointments.length - matchedCount;
            if (leftOverPayments.length > 0) {
                setSyncFeedback(`✓ Cuadre: ${matchedCount} pagadas | ${leftOverPayments.length} pagos de Excel sin emparejar`);
            } else {
                setSyncFeedback(`✓ Cuadre: ${matchedCount} pagadas | ${unmatchedAptCount} pendientes`);
            }
            setTimeout(() => setSyncFeedback(null), 5000);

            return {
                total: reconciledAppointments.length,
                matchedCount,
                unmatchedCount: unmatchedAptCount,
                unmatchedExcelCount: leftOverPayments.length,
            };
        } catch (err: any) {
            console.error('Error en cuadre con Excel:', err);
            setSyncFeedback('Error al cuadrar con Excel');
            setTimeout(() => setSyncFeedback(null), 4000);
            return null;
        } finally {
            setIsSyncing(false);
        }
    }, [setAppState]);

    // Emparejar manualmente un pago huérfano de Excel con una cita existente
    // "Obviamente a la hora de emparejarlas simplemente las citas que ya existen se marcan como pagadas, no se crea una nueva cita ni se borran los registros originales"
    const handleMatchUnmatchedPayment = useCallback((unmatched: SheetPaymentRow, appointmentId: string) => {
        setAppState(prev => {
            const updated = prev.payments.map(p => {
                if (p.id === appointmentId) {
                    const statusStr = (unmatched.estado || '').toLowerCase();
                    const estado = statusStr.includes('credito') ? EstadoPago.CreditoMensual : EstadoPago.Pagado;
                    return {
                        ...p,
                        estado,
                        boleta: unmatched.comprobanteUrl || unmatched.boleta || p.boleta || 'Comprobante Excel',
                        comprobanteImg: unmatched.comprobanteUrl || p.comprobanteImg,
                        fechaPago: (unmatched.fechaPago || '').split('T')[0] || p.fecha,
                        metodoPago: unmatched.metodoPago || p.metodoPago || 'Transferencia Bancaria',
                        revisado: true,
                        notas: `${p.notas || ''} ${unmatched.notas ? `| ${unmatched.notas}` : '| Conciliado con pago de Excel'}`.trim(),
                    };
                }
                return p;
            });
            return { ...prev, payments: updated };
        });

        setUnmatchedPayments(prev => {
            const next = prev.filter(item => item !== unmatched && item.id !== unmatched.id);
            try {
                localStorage.setItem('oneday_unmatched_payments', JSON.stringify(next));
            } catch (e) {}
            return next;
        });

        setSyncFeedback(`✓ Cita marcada como PAGADA con el comprobante de ${unmatched.cliente}`);
        setTimeout(() => setSyncFeedback(null), 5000);
    }, [setAppState]);

    const handleDismissUnmatchedPayment = useCallback((unmatchedKey: string) => {
        setUnmatchedPayments(prev => {
            const next = prev.filter((item, idx) => (item.id || `unmatched-${idx}-${item.cliente}-${item.monto}`) !== unmatchedKey);
            try {
                localStorage.setItem('oneday_unmatched_payments', JSON.stringify(next));
            } catch (e) {}
            return next;
        });
    }, []);

    // Botón manual de conciliar / cruzar citas con Excel bajo demanda
    const syncWithGoogleSheets = useCallback(async () => {
        if (payments.length === 0) {
            alert("No hay citas en la tabla para cruzar. Primero use el botón 'Importar Citas' para cargar el archivo.");
            return;
        }
        const result = await reconcileAppointmentsWithExcel(payments);
        if (result) {
            const extraMsg = result.unmatchedExcelCount > 0 
                ? `\n• Pagos de Excel sin emparejar: ${result.unmatchedExcelCount} (abiertos en la columna lateral para arrastrar y soltar)`
                : '\n• Todos los pagos de Excel cuadraron con las citas.';
            alert(`✓ Cuadre con Excel finalizado:\n• Total citas: ${result.total}\n• Citas emparejadas como Pagadas: ${result.matchedCount}\n• Citas que continúan Pendientes: ${result.unmatchedCount}${extraMsg}`);
        }
    }, [payments, reconcileAppointmentsWithExcel]);

    // Cuando un cliente ingresa un pago en el portal:
    // "cuando se meta un nuevo registro en el portal de clientes, no lo agregues a la parte de registros. Solo lo tiene que leer hasta que entre el formato JSON y emparejarlos"
    const handleClientPaymentSubmitted = useCallback((_newPaymentOrList: Payment | Payment[]) => {
        setSyncFeedback('Pago recibido en portal. Se cuadrará cuando suba la tira/JSON de citas.');
        setTimeout(() => setSyncFeedback(null), 4000);
    }, []);

    const handleUpdatePayment = useCallback((id: string, updates: Partial<Payment>) => {
        setAppState(prevState => ({
            ...prevState,
            payments: prevState.payments.map(p => p.id === id ? { ...p, ...updates } : p)
        }));
    }, [setAppState]);
    
    const handleUndo = useCallback(() => {
        if (currentHistoryIndex > 0) {
            setCurrentHistoryIndex(prevIndex => prevIndex - 1);
        }
    }, [currentHistoryIndex]);

    const handleRedo = useCallback(() => {
        if (currentHistoryIndex < history.length - 1) {
            setCurrentHistoryIndex(prevIndex => prevIndex + 1);
        }
    }, [currentHistoryIndex, history.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    handleUndo();
                } else if (e.key === 'y') {
                    e.preventDefault();
                    handleRedo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);


    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
    const [isConfirmDeleteAllOpen, setIsConfirmDeleteAllOpen] = useState(false);
    const [isConfirmDeleteSelectedOpen, setIsConfirmDeleteSelectedOpen] = useState(false);
    
    const [isDailyReportModalOpen, setIsDailyReportModalOpen] = useState(false);
    const [isEstimatesModalOpen, setIsEstimatesModalOpen] = useState(false);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);
    const [isMixedOwnerConfirmOpen, setIsMixedOwnerConfirmOpen] = useState(false);
    const [isImageViewerOpen, setImageViewerOpen] = useState(false);
    const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);
    
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [duplicateRecords, setDuplicateRecords] = useState<Payment[]>([]);
    const [newNonDuplicateRecords, setNewNonDuplicateRecords] = useState<Payment[]>([]);
    const [isClientVolumeModalOpen, setIsClientVolumeModalOpen] = useState(false);
    const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);

    const [rotatingClientIndex, setRotatingClientIndex] = useState<number | null>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const openSessionInputRef = useRef<HTMLInputElement>(null);
    
    const filteredPayments = useMemo(() => {
        return payments
            .filter(p => {
                 // Basic filters
                const searchTermMatch = p.cliente.toLowerCase().includes(filters.searchTerm.toLowerCase());
                const officeMatch = filters.oficina.length === 0 || filters.oficina.includes(p.oficina);
                const statusMatch = filters.estado === 'todos' || p.estado === filters.estado;

                // Date filters
                const [paymentYear, paymentMonth] = p.fecha.split('-').map(Number);
                
                // Month/Year filter applies to SERVICE date
                const monthYearMatch = (filters.mes === -1 || (paymentMonth - 1) === filters.mes) && (filters.año === 0 || paymentYear === filters.año);
                
                // Specific date filters
                const serviceDateMatch = !filters.fecha || p.fecha === filters.fecha;
                const paymentDateMatch = !filters.fechaPago || (p.fechaPago && p.fechaPago === filters.fechaPago);

                return searchTermMatch && officeMatch && statusMatch && monthYearMatch && serviceDateMatch && paymentDateMatch;
            })
            .sort((a, b) => {
                if (filters.sortBy === 'date') {
                    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime() || a.cliente.localeCompare(b.cliente);
                } else if (filters.sortBy === 'client-asc') {
                    return a.cliente.localeCompare(b.cliente) || new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
                } else {
                    return b.cliente.localeCompare(a.cliente) || new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
                }
            });
    }, [payments, filters]);

    // --- Selection Logic ---
    const handleToggleSelectionMode = useCallback(() => {
        setIsSelectionMode(prev => {
            const nextMode = !prev;
            if (!nextMode) {
                setSelectedIds(new Set()); // Clear selection when exiting
            }
            return nextMode;
        });
    }, []);

    const handleSelectPayment = useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (selectedIds.size === filteredPayments.length && filteredPayments.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredPayments.map(p => p.id)));
        }
    }, [filteredPayments, selectedIds.size]);

    const handleBulkDelete = useCallback(() => {
        if (selectedIds.size === 0) return;
        setIsConfirmDeleteSelectedOpen(true);
    }, [selectedIds.size]);

    const confirmDeleteSelected = useCallback(() => {
        setAppState(prevState => ({
            ...prevState,
            payments: prevState.payments.filter(p => !selectedIds.has(p.id))
        }));
        setSelectedIds(new Set());
        setIsConfirmDeleteSelectedOpen(false);
        // We can choose to stay in selection mode or exit. Let's exit to be clean.
        setIsSelectionMode(false);
    }, [selectedIds, setAppState]);

    const getTargetPayments = useCallback(() => {
        if (isSelectionMode && selectedIds.size > 0) {
            return payments.filter(p => selectedIds.has(p.id));
        }
        return filteredPayments;
    }, [isSelectionMode, selectedIds, payments, filteredPayments]);


    // --- Session Save/Load Handlers ---
    const handleSaveSession = () => {
        const sessionData = {
            payments,
            accumulatedData,
            fileMetadata: {
                mes: filters.mes,
                año: filters.año,
            }
        };
        const jsonString = JSON.stringify(sessionData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const monthName = monthNames[filters.mes];
        a.href = url;
        a.download = `Control de Pagos - ${monthName} ${filters.año} - ONEDAY.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    const handleOpenSessionClick = () => {
        openSessionInputRef.current?.click();
    };

    const handleSessionFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') {
                    throw new Error("El archivo no es válido.");
                }
                const data = JSON.parse(text);

                if (Array.isArray(data.payments) && data.accumulatedData) {
                    const newInitialState: AppState = { payments: data.payments, accumulatedData: data.accumulatedData };
                    setHistory([newInitialState]);
                    setCurrentHistoryIndex(0);
                    if (data.fileMetadata) {
                        setFilters(prev => ({
                            ...prev,
                            mes: data.fileMetadata.mes ?? prev.mes,
                            año: data.fileMetadata.año ?? prev.año,
                        }));
                    }
                    alert("Sesión cargada exitosamente.");
                } else {
                     alert("El archivo no tiene el formato correcto de sesión.");
                }
            } catch (error) {
                console.error("Error al cargar la sesión:", error);
                alert("Hubo un error al procesar el archivo. Asegúrese de que es un archivo de sesión válido.");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleAddPayment = useCallback(() => {
        setEditingPayment(null);
        setIsFormModalOpen(true);
    }, []);

    const handleEditPayment = (payment: Payment) => {
        setEditingPayment(payment);
        setIsFormModalOpen(true);
    };

    const handleSavePayment = (paymentData: Payment) => {
        setAppState(prevState => {
            let newPayments;
            if (editingPayment) {
                newPayments = prevState.payments.map(p => p.id === editingPayment.id ? { ...p, ...paymentData, id: p.id } : p);
            } else {
                const newId = String(Date.now()) + Math.random().toString(36).substring(2);
                newPayments = [...prevState.payments, { ...paymentData, id: newId, revisado: false }];
            }
            return { ...prevState, payments: newPayments };
        });
        setIsFormModalOpen(false);
        setEditingPayment(null);
    };

    const handleDeletePayment = (id: string) => {
        setPaymentToDelete(id);
        setIsConfirmDeleteOpen(true);
    };

    const confirmDelete = () => {
        if (paymentToDelete) {
            setAppState(prevState => ({
                ...prevState,
                payments: prevState.payments.filter(p => p.id !== paymentToDelete)
            }));
        }
        setIsConfirmDeleteOpen(false);
        setPaymentToDelete(null);
    };
    
    const handleDeleteAll = useCallback(() => {
        setIsConfirmDeleteAllOpen(true);
    }, []);
    
    const confirmDeleteAll = () => {
        setAppState(prevState => ({ ...prevState, payments: [] }));
    };

    const handleToggleStatus = (id: string) => {
        setAppState(prevState => {
            const newPayments = prevState.payments.map(p => {
                if (p.id === id) {
                    let newStatus: EstadoPago;
                    let newMonto = p.monto;
                    let newOriginalMonto = p.originalMonto;
                    let newFechaPago = p.fechaPago;

                    switch (p.estado) {
                        case EstadoPago.Pendiente:
                            newStatus = EstadoPago.Pagado;
                            newFechaPago = toLocalDateString(new Date());
                            newOriginalMonto = undefined;
                            break;
                        case EstadoPago.Pagado:
                            newStatus = EstadoPago.PlanMensual;
                            newOriginalMonto = p.monto;
                            newMonto = 0;
                            newFechaPago = undefined;
                            break;
                        case EstadoPago.PlanMensual:
                            newStatus = EstadoPago.CreditoMensual;
                            newMonto = p.originalMonto ?? p.monto;
                            newFechaPago = undefined;
                            break;
                        case EstadoPago.CreditoMensual:
                            newStatus = EstadoPago.Pendiente;
                            newFechaPago = undefined;
                            break;
                        default:
                            newStatus = p.estado;
                    }
                    return { ...p, estado: newStatus, monto: newMonto, originalMonto: newOriginalMonto, fechaPago: newFechaPago };
                }
                return p;
            });
            return { ...prevState, payments: newPayments };
        });
    };

    const handleToggleReviewed = (id: string) => {
        setAppState(prevState => ({
            ...prevState,
            payments: prevState.payments.map(p => p.id === id ? { ...p, revisado: !p.revisado } : p)
        }));
    };

    const handleMerge = (draggedId: string, targetId: string) => {
        setAppState(prevState => {
            const dragged = prevState.payments.find(p => p.id === draggedId);
            const target = prevState.payments.find(p => p.id === targetId);
        
            if (!dragged || !target || dragged.id === target.id || dragged.cliente !== target.cliente || dragged.oficina !== target.oficina || dragged.fecha !== target.fecha) {
                return prevState;
            }
        
            const formatCurrency = (amount: number) => `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            
            const allRecordIds = new Set(
                [target.recordId, dragged.recordId].flatMap(id => String(id || '').split(',')).map(s => s.trim()).filter(Boolean)
            );
            const combinedRecordIds = Array.from(allRecordIds).join(', ');
        
            const allBoletas = new Set(
                [target.boleta, dragged.boleta].flatMap(b => String(b || '').split(',')).map(s => s.trim()).filter(Boolean)
            );
            const combinedBoletas = Array.from(allBoletas).join(', ');
        
            const mergeLog = `\n--- Registro Fusionado ---\nID Original: ${dragged.recordId || 'N/A'}\nBoleta: ${dragged.boleta}\nMonto: ${formatCurrency(dragged.monto)}\n--------------------------`;
            
            const newNotes = [target.notas, dragged.notas, mergeLog].filter(Boolean).join('\n\n').trim();
        
            const mergedPayment: Payment = {
                ...target,
                recordId: combinedRecordIds || undefined,
                telefono: target.telefono || dragged.telefono,
                monto: target.monto + dragged.monto,
                horas: (target.horas || 0) + (dragged.horas || 0),
                boleta: combinedBoletas,
                notas: newNotes,
                revisado: false,
            };
        
            const newPayments = prevState.payments.map(p => p.id === target.id ? mergedPayment : p).filter(p => p.id !== dragged.id);
            return { ...prevState, payments: newPayments };
        });
    };

    const exportPaymentsToXLSX = useCallback((paymentsToExport: Payment[], fileName: string) => {
        if (!(window as any).XLSX) {
            alert('La librería para exportar a Excel no está disponible.');
            return;
        }
        const dataToExport = paymentsToExport.map(({ id, revisado, originalMonto, comprobanteImg, ...rest }) => rest);
        const worksheet = (window as any).XLSX.utils.json_to_sheet(dataToExport);
        const workbook = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(workbook, worksheet, 'Pagos');
        (window as any).XLSX.writeFile(workbook, `${fileName}.xlsx`);
    }, []);

    const handleExport = useCallback(() => {
        const today = new Date().toISOString().slice(0, 10);
        const paymentsToExport = getTargetPayments();
        if (paymentsToExport.length === 0) {
            alert("No hay pagos para exportar.");
            return;
        }
        exportPaymentsToXLSX(paymentsToExport, `Reporte de Pagos - ${today}`);
    }, [getTargetPayments, exportPaymentsToXLSX]);
    
    const handleStartImportClick = useCallback(() => {
        importInputRef.current?.click();
    }, []);

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0 || !(window as any).XLSX) return;

        let filesWithErrors: string[] = [];

        const processFile = (file: File): Promise<Payment[]> => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                const isCsv = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');
                const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';

                reader.onload = (e) => {
                    try {
                        let fileData = e.target?.result;

                        // Support direct JSON import from SimplyMeet.me
                        if (isJson && typeof fileData === 'string') {
                            const parsed = JSON.parse(fileData);
                            const items = Array.isArray(parsed) ? parsed : (parsed?._embedded?.items || parsed?.items || parsed?.events || []);
                            
                            if (Array.isArray(items) && items.length > 0) {
                                const parsedFromSM: Payment[] = items
                                    .filter((it: any) => it.state !== 'canceled' && !it.canceled_at)
                                    .map((it: any, idx: number) => {
                                        const rawName = it.invitee?.full_name || it.client || it.cliente || 'Cliente';
                                        let name = String(rawName).trim();
                                        if (name.includes('/')) {
                                            const p = name.split('/')[0].trim();
                                            if (p.length >= 3) name = p;
                                        }

                                        const typeName = it.event_type?.name || it.meetingtype || it.oficina || '';
                                        const office = parseOfficeFromText(typeName);
                                        const durationMinutes = Number(it.duration) || 60;
                                        const durationHours = Math.max(0.5, Number((durationMinutes / 60).toFixed(1)));
                                        const dateStr = (it.scheduled_at || it.fecha || '').split('T')[0] || toLocalDateString(new Date());

                                        const rawPhone = it.invitee?.phone || it.invitee?.phone_number || it.invitee?.cellphone || 
                                                         it.phone || it.telefono || it.clientphonenumber || it.phone_number || 
                                                         it.telephone || it.mobile || it.celular ||
                                                         (Array.isArray(it.answers) ? it.answers.find((a: any) => /tel|phone|cel|whats/i.test(a.question || a.name || ''))?.value : undefined) ||
                                                         (Array.isArray(it.custom_fields) ? it.custom_fields.find((f: any) => /tel|phone|cel|whats/i.test(f.name || ''))?.value : undefined);
                                        const cleanPhone = rawPhone ? String(rawPhone).replace(/[^\d+]/g, '') : undefined;

                                        return {
                                            id: `sm-json-${it.id || it.uuid || idx}-${Date.now()}`,
                                            cliente: name,
                                            oficina: office,
                                            horas: durationHours,
                                            monto: durationHours * 65,
                                            boleta: '',
                                            fecha: dateStr,
                                            fechaPago: dateStr,
                                            estado: EstadoPago.Pendiente,
                                            metodoPago: 'N/A',
                                            notas: `SimplyMeet Export ${it.scheduled_at ? `| ${it.scheduled_at}` : ''}`,
                                            revisado: false,
                                            telefono: cleanPhone,
                                        };
                                    });
                                resolve(parsedFromSM);
                                return;
                            }
                        }

                        if (isCsv && typeof fileData === 'string') {
                            fileData = fileData.replace(/^\uFEFF/, '');
                        }

                        const workbook = isCsv
                            ? (window as any).XLSX.read(fileData, { type: 'string' })
                            : (window as any).XLSX.read(fileData, { type: 'binary', cellDates: true });
                        
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        const json: any[] = (window as any).XLSX.utils.sheet_to_json(worksheet);

                        if (json.length === 0) {
                           resolve([]);
                           return;
                        }

                        const normalizeKey = (key: string) => {
                            return key.toLowerCase().trim()
                                .replace(/\s+/g, '')
                                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                                .replace(/s$/, '');
                        };
                        
                        const knownNormalizedKeys = new Set([
                            'id', 'recordid', 'idregistro',
                            'cliente', 'client', 'oficina', 'meetingtype', 'hora', 
                            'duration', 'monto', 'boleta', 'factura', 'fecha', 
                            'dateandtime', 'estado', 'metodopago', 'nota', 
                            'telefono', 'clientphonenumber'
                        ]);

                        const newPayments: Payment[] = json.map((row): Payment | null => {
                            const normalizedRow = Object.keys(row).reduce((acc, key) => {
                                acc[normalizeKey(key)] = row[key];
                                return acc;
                            }, {} as any);

                            const findValue = (aliases: string[]) => {
                                for (const alias of aliases) {
                                    if (normalizedRow[alias] !== undefined) return normalizedRow[alias];
                                }
                                return undefined;
                            };

                            const cliente = findValue(['cliente', 'client']);
                            const oficinaRaw = findValue(['oficina', 'meetingtype']);

                            if (!cliente || !oficinaRaw) return null;

                            const officeMatch = String(oficinaRaw).toUpperCase().replace(/\s+/g, '').match(/(1201|203B|211B|232B|323)/);
                            if (!officeMatch) return null;
                            const oficina = officeMatch[0] as Oficina;
                            
                            const fechaRaw = findValue(['fecha', 'dateandtime']);
                            let fechaStr = new Date().toISOString().split('T')[0];

                            if (fechaRaw) {
                                if (fechaRaw instanceof Date && !isNaN(fechaRaw.getTime())) {
                                    const offset = fechaRaw.getTimezoneOffset();
                                    const adjustedDate = new Date(fechaRaw.getTime() - (offset * 60 * 1000));
                                    fechaStr = adjustedDate.toISOString().split('T')[0];
                                } else if (typeof fechaRaw === 'string') {
                                    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) {
                                        fechaStr = fechaRaw;
                                    } else if (/^\d{2}-\d{2}-\d{4}$/.test(fechaRaw)) {
                                        const [day, month, year] = fechaRaw.split('-');
                                        fechaStr = `${year}-${month}-${day}`;
                                    } else if (fechaRaw.includes('-') && (fechaRaw.toLowerCase().includes('am') || fechaRaw.toLowerCase().includes('pm'))) {
                                        const datePart = fechaRaw.split(' ')[0];
                                        const parts = datePart.split('-');
                                        if (parts.length === 3) {
                                            const isoDateString = `${parts[2]}-${parts[1]}-${parts[0]}`;
                                            if (!isNaN(new Date(isoDateString).getTime())) {
                                                fechaStr = isoDateString;
                                            }
                                        }
                                    } else {
                                        const parsedDate = new Date(fechaRaw);
                                        if (!isNaN(parsedDate.getTime())) {
                                            const offset = parsedDate.getTimezoneOffset();
                                            const adjustedDate = new Date(parsedDate.getTime() - (offset * 60 * 1000));
                                            fechaStr = adjustedDate.toISOString().split('T')[0];
                                        }
                                    }
                                }
                            }

                            const estadoValue = findValue(['estado']);
                            const estado = Object.values(EstadoPago).includes(estadoValue as EstadoPago)
                                ? estadoValue as EstadoPago
                                : EstadoPago.Pendiente;
                            
                            const telefonoRaw = findValue(['telefono', 'clientphonenumber']);
                            const telefono = telefonoRaw ? String(telefonoRaw).replace(/\D/g, '') : undefined;
                            
                            const initialNotas = findValue(['nota']);

                            const extraData: string[] = [];
                            for (const originalKey in row) {
                                if (Object.prototype.hasOwnProperty.call(row, originalKey)) {
                                    const normalizedKey = normalizeKey(originalKey);
                                    if (!knownNormalizedKeys.has(normalizedKey)) {
                                        const value = row[originalKey];
                                        if (value !== null && value !== undefined && String(value).trim() !== '') {
                                            extraData.push(`${originalKey}: ${value}`);
                                        }
                                    }
                                }
                            }
                            
                            let finalNotas = String(initialNotas || '').trim();
                            if (extraData.length > 0) {
                                const extraNotesString = extraData.join('\n');
                                if (finalNotas) {
                                    finalNotas += `\n\n--- Datos Adicionales Importados ---\n${extraNotesString}`;
                                } else {
                                    finalNotas = `--- Datos Adicionales Importados ---\n${extraNotesString}`;
                                }
                            }
                            
                            const recordId = findValue(['id', 'recordid', 'idregistro']);
                            
                            const defaultMonto = 65;

                            return {
                                id: String(Date.now()) + Math.random().toString(36).substring(2),
                                recordId: recordId ? String(recordId) : undefined,
                                cliente: String(cliente).trim(),
                                telefono,
                                oficina,
                                horas: (parseFloat(String(findValue(['hora', 'duration']) || '60')) || 60) / 60,
                                monto: parseFloat(String(findValue(['monto']) || defaultMonto)) || defaultMonto,
                                boleta: String(findValue(['boleta', 'factura']) || ''),
                                fecha: fechaStr,
                                estado,
                                metodoPago: String(findValue(['metodopago']) || 'N/A'),
                                notas: finalNotas.trim() || undefined,
                                revisado: false,
                            };
                        }).filter((p): p is Payment => p !== null);
                        
                        resolve(newPayments);
                    } catch (error) {
                        console.error(`Error importing file ${file.name}:`, error);
                        filesWithErrors.push(file.name);
                        resolve([]);
                    }
                };
                
                reader.onerror = () => {
                    filesWithErrors.push(file.name);
                    resolve([]);
                };

                if (isCsv) {
                    reader.readAsText(file);
                } else {
                    reader.readAsBinaryString(file);
                }
            });
        };

        const filePromises = Array.from(files).map(processFile);

        Promise.all(filePromises).then(async results => {
            const allNewPayments = results.flat();
            if (allNewPayments.length === 0) {
                 if (files.length > 0 && filesWithErrors.length === 0) {
                    alert("No se encontraron registros válidos de citas para importar en los archivos seleccionados. Verifique el formato.");
                 }
                 if (filesWithErrors.length > 0) {
                    alert(`Hubo un error al procesar ${filesWithErrors.length} archivo(s): ${filesWithErrors.join(', ')}.`);
                 }
                 return;
            }

            // Importar las citas directamente a la tabla sin forzar el cruce automático
            // El usuario decide cuándo cruzar presionando el botón "Cruzar con Excel"
            setAppState(prevState => ({ ...prevState, payments: allNewPayments }));
            alert(`✓ Se importaron ${allNewPayments.length} citas exitosamente.\n\nPresiona el botón "Cruzar con Excel" cuando desees cruzar y conciliar la información con los pagos registrados.`);

        }).finally(() => {
            if (event.target) event.target.value = '';
        });
    };
    
    // --- Duplicate Handlers ---
    const handleOmitDuplicates = () => {
        setAppState(prevState => ({ ...prevState, payments: [...prevState.payments, ...newNonDuplicateRecords] }));
        alert(`${newNonDuplicateRecords.length} registros no duplicados han sido añadidos.`);
        closeDuplicateModal();
    };

    const handleKeepAllDuplicates = () => {
        const allToAdd = [...newNonDuplicateRecords, ...duplicateRecords];
        setAppState(prevState => ({ ...prevState, payments: [...prevState.payments, ...allToAdd] }));
        alert(`${allToAdd.length} registros han sido añadidos (incluyendo duplicados).`);
        closeDuplicateModal();
    };
    
    const closeDuplicateModal = () => {
        setIsDuplicateModalOpen(false);
        setDuplicateRecords([]);
        setNewNonDuplicateRecords([]);
    };

    const paymentsForClientRotation = useMemo(() => {
        return payments
            .filter(p => {
                const officeMatch = filters.oficina.length === 0 || filters.oficina.includes(p.oficina);
                const statusMatch = filters.estado === 'todos' || p.estado === filters.estado;
                const [paymentYear, paymentMonth] = p.fecha.split('-').map(Number);
                const monthYearMatch = (paymentMonth - 1) === filters.mes && paymentYear === filters.año;
                const serviceDateMatch = !filters.fecha || p.fecha === filters.fecha;
                const paymentDateMatch = !filters.fechaPago || (p.fechaPago && p.fechaPago === filters.fechaPago);
                return officeMatch && statusMatch && monthYearMatch && serviceDateMatch && paymentDateMatch;
            })
    }, [payments, filters.oficina, filters.estado, filters.mes, filters.año, filters.fecha, filters.fechaPago]);

    const handleRotateClient = useCallback(() => {
        const allClients = [...new Set(
            paymentsForClientRotation
                .map(p => p.cliente)
                .sort((a, b) => a.localeCompare(b))
        )];

        if (allClients.length === 0) {
            setFilters(prev => ({ ...prev, searchTerm: '' }));
            setRotatingClientIndex(null);
            return;
        }
        
        const nextIndex = (rotatingClientIndex === null || rotatingClientIndex >= allClients.length - 1)
            ? 0
            : rotatingClientIndex + 1;

        setRotatingClientIndex(nextIndex);
        setFilters(prev => ({ ...prev, searchTerm: allClients[nextIndex] }));
    }, [paymentsForClientRotation, rotatingClientIndex]);
    
    const handleClearFilters = useCallback(() => {
        setFilters(getInitialFilters());
        setRotatingClientIndex(null);
    }, []);

    const handleToggleSort = useCallback(() => {
        setFilters(prev => {
            let nextSort: SortType;
            if (prev.sortBy === 'date') nextSort = 'client-asc';
            else if (prev.sortBy === 'client-asc') nextSort = 'client-desc';
            else nextSort = 'date';
            return { ...prev, sortBy: nextSort };
        });
    }, []);
    
    const targetPayments = getTargetPayments();
    const hasPendingPayments = useMemo(() => targetPayments.some(p => p.estado === EstadoPago.Pendiente || p.estado === EstadoPago.CreditoMensual), [targetPayments]);
    const hasPaidPayments = useMemo(() => targetPayments.some(p => p.estado === EstadoPago.Pagado), [targetPayments]);

    const totalPendingCount = useMemo(() => payments.filter(p => p.estado === EstadoPago.Pendiente || p.estado === EstadoPago.CreditoMensual).length, [payments]);
    const totalPaidCount = useMemo(() => payments.filter(p => p.estado === EstadoPago.Pagado).length, [payments]);

    const showDailyReport = useCallback(() => setIsDailyReportModalOpen(true), []);
    const showEstimates = useCallback(() => setIsEstimatesModalOpen(true), []);
    
    const onRequestPayment = useCallback(() => {
        const target = getTargetPayments();
        const pendingPayments = target.filter(p => p.estado === EstadoPago.Pendiente || p.estado === EstadoPago.CreditoMensual);
        if (pendingPayments.length === 0) {
            setIsRequestModalOpen(true);
            return;
        }
        const owners = new Set(pendingPayments.map(p => OFFICE_OWNERS[p.oficina]));

        if (owners.size > 1) {
            setIsMixedOwnerConfirmOpen(true);
        } else {
            setIsRequestModalOpen(true);
        }
    }, [getTargetPayments]);

    const onGenerateProof = useCallback(() => setIsProofModalOpen(true), []);

    const handleViewImage = (payment: Payment) => {
        setViewingPayment(payment);
        setImageViewerOpen(true);
    };

    const handleSetAccumulatedData = useCallback((update: React.SetStateAction<AccumulatedData>) => {
        setAppState(prevState => {
            const newAccumulatedData = typeof update === 'function'
                ? (update as (prev: AccumulatedData) => AccumulatedData)(prevState.accumulatedData)
                : update;
            return { ...prevState, accumulatedData: newAccumulatedData };
        });
    }, [setAppState]);

    if (currentView === 'cliente') {
        return (
            <ClientPaymentPortal 
                onPaymentSubmitted={handleClientPaymentSubmitted}
                onNavigateToAdmin={() => navigateToView('admin')}
                allPayments={payments}
            />
        );
    }

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <Header
                onSave={handleSaveSession}
                onOpen={handleOpenSessionClick}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={currentHistoryIndex > 0}
                canRedo={currentHistoryIndex < history.length - 1}
                onNavigateToClientPortal={() => navigateToView('cliente')}
            />
            <main className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
                <input
                    type="file"
                    ref={importInputRef}
                    onChange={handleFileSelected}
                    className="hidden"
                    accept=".xlsx,.xls,.csv,.json,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    multiple
                />
                 <input
                    type="file"
                    ref={openSessionInputRef}
                    onChange={handleSessionFileSelected}
                    className="hidden"
                    accept=".json,application/json"
                />
                <AccumulatedReport 
                    payments={payments} 
                    accumulatedData={accumulatedData}
                    setAccumulatedData={handleSetAccumulatedData}
                    selectedMonth={filters.mes}
                    selectedYear={filters.año}
                    onOpenClientVolume={() => setIsClientVolumeModalOpen(true)}
                />
                <FilterBar
                    filters={filters}
                    setFilters={setFilters}
                    onAddPayment={handleAddPayment}
                    onExportToExcel={handleExport}
                    onShowDailyReport={showDailyReport}
                    onShowEstimates={showEstimates}
                    onShowClientVolume={() => setIsClientVolumeModalOpen(true)}
                    hasFilteredResults={filteredPayments.length > 0}
                    hasPayments={payments.length > 0}
                    onImportAndAdd={handleStartImportClick}
                    onRotateClient={handleRotateClient}
                    setRotatingClientIndex={setRotatingClientIndex}
                    onDeleteAll={handleDeleteAll}
                    onClearFilters={handleClearFilters}
                    onToggleSort={handleToggleSort}
                    isSelectionMode={isSelectionMode}
                    onToggleSelectionMode={handleToggleSelectionMode}
                    pendingCount={totalPendingCount}
                    paidCount={totalPaidCount}
                    totalCount={payments.length}
                    allPayments={payments}
                    unmatchedCount={unmatchedPayments.length}
                    onOpenUnmatched={() => setIsUnmatchedColumnOpen(true)}
                    onTriggerSync={syncWithGoogleSheets}
                    isSyncing={isSyncing}
                    onToggleUnmatchedColumn={() => setIsUnmatchedColumnOpen(prev => !prev)}
                    isUnmatchedColumnOpen={isUnmatchedColumnOpen}
                />

                {/* Banner de Pagos de Excel sin emparejar con citas */}
                {unmatchedPayments.length > 0 && !isUnmatchedColumnOpen && (
                    <div className="bg-amber-50 border border-amber-300 text-amber-950 px-5 py-3.5 rounded-2xl mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white font-bold text-base shadow-xs">
                                {unmatchedPayments.length}
                            </span>
                            <div>
                                <h4 className="font-bold text-sm text-amber-950">
                                    {unmatchedPayments.length === 1 
                                        ? 'Hay 1 pago de Excel sin emparejar' 
                                        : `Hay ${unmatchedPayments.length} pagos de Excel sin emparejar`}
                                </h4>
                                <p className="text-xs text-amber-800">
                                    Estos pagos registrados no coincidieron con ninguna cita. Abre la columna lateral para arrastrarlos y emparejarlos.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsUnmatchedColumnOpen(true)}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                        >
                            <span>Mostrar Columna para Arrastrar</span>
                            <span className="bg-amber-800/60 px-1.5 py-0.5 rounded-md text-[10px]">{unmatchedPayments.length}</span>
                        </button>
                    </div>
                )}

                {/* Banner when filter hides all payments */}
                {payments.length > 0 && filteredPayments.length === 0 && (
                    <div className="bg-amber-50 border border-amber-300 text-amber-900 px-5 py-4 rounded-2xl mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-200 text-amber-900 font-bold">
                                ℹ️
                            </span>
                            <div>
                                <p className="text-sm font-semibold">
                                    No hay citas con el filtro actual ({filters.mes !== -1 ? monthNames[filters.mes] : 'Todos los meses'} {filters.año !== 0 ? filters.año : 'Todos los años'}).
                                </p>
                                <p className="text-xs text-amber-800 mt-0.5">
                                    Tienes <strong>{payments.length} citas registradas</strong> de SimplyMeet ({totalPendingCount} pendientes, {totalPaidCount} pagadas).
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFilters(prev => ({ ...prev, mes: -1, año: 0, searchTerm: '', estado: 'todos' }))}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                        >
                            Ver Todas las Citas ({payments.length})
                        </button>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    <div className="flex-1 min-w-0 w-full">
                        <PaymentTable 
                            payments={filteredPayments} 
                            onEdit={handleEditPayment} 
                            onDelete={handleDeletePayment}
                            onToggleStatus={handleToggleStatus}
                            onToggleReviewed={handleToggleReviewed}
                            onMerge={handleMerge}
                            onViewImage={handleViewImage}
                            isSelectionMode={isSelectionMode}
                            selectedIds={selectedIds}
                            onSelectPayment={handleSelectPayment}
                            onSelectAll={handleSelectAll}
                            onUpdatePayment={handleUpdatePayment}
                            onMatchUnmatched={handleMatchUnmatchedPayment}
                        />
                    </div>

                    {unmatchedPayments.length > 0 && isUnmatchedColumnOpen && (
                        <UnmatchedColumn
                            isOpen={isUnmatchedColumnOpen}
                            onClose={() => setIsUnmatchedColumnOpen(false)}
                            unmatchedPayments={unmatchedPayments}
                            appointments={payments}
                            onMatch={handleMatchUnmatchedPayment}
                            onDismiss={handleDismissUnmatchedPayment}
                        />
                    )}
                </div>
                <ActionFooter 
                    onRequestPayment={onRequestPayment}
                    onGenerateProof={onGenerateProof}
                    hasPendingPayments={hasPendingPayments}
                    hasPaidPayments={hasPaidPayments}
                    isSelectionMode={isSelectionMode}
                    selectedCount={selectedIds.size}
                    onDeleteSelected={handleBulkDelete}
                />
            </main>
            
            <PaymentFormModal 
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                onSave={handleSavePayment}
                payment={editingPayment}
            />
            
            <ConfirmationModal 
                isOpen={isConfirmDeleteOpen}
                onClose={() => setIsConfirmDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Confirmar Eliminación"
                message="¿Estás seguro de que quieres eliminar este registro de pago? Esta acción no se puede deshacer."
            />
             <ConfirmationModal 
                isOpen={isConfirmDeleteAllOpen}
                onClose={() => setIsConfirmDeleteAllOpen(false)}
                onConfirm={confirmDeleteAll}
                title="Confirmar Eliminación Total"
                message="¿Estás seguro de que deseas eliminar TODOS los registros de la vista actual? Esta acción es irreversible."
            />
             <ConfirmationModal 
                isOpen={isConfirmDeleteSelectedOpen}
                onClose={() => setIsConfirmDeleteSelectedOpen(false)}
                onConfirm={confirmDeleteSelected}
                title="Eliminar Selección"
                message={`¿Estás seguro de que deseas eliminar los ${selectedIds.size} registros seleccionados? Esta acción es irreversible.`}
            />
            <ConfirmationModal
                isOpen={isMixedOwnerConfirmOpen}
                onClose={() => setIsMixedOwnerConfirmOpen(false)}
                onConfirm={() => {
                    setIsMixedOwnerConfirmOpen(false);
                    setIsRequestModalOpen(true);
                }}
                title="Unificar Solicitudes de Pago"
                message="La selección actual incluye oficinas de diferentes dueños. Si continúas, se generará una única solicitud de pago con los datos bancarios de ambos. ¿Deseas continuar?"
            />
            
            <DuplicateConfirmationModal
                isOpen={isDuplicateModalOpen}
                onClose={closeDuplicateModal}
                duplicates={duplicateRecords}
                onConfirmOmit={handleOmitDuplicates}
                onConfirmKeepAll={handleKeepAllDuplicates}
            />

            <DailyReportModal
                isOpen={isDailyReportModalOpen}
                onClose={() => setIsDailyReportModalOpen(false)}
                payments={getTargetPayments()}
            />
            
            <EstimatesModal
                isOpen={isEstimatesModalOpen}
                onClose={() => setIsEstimatesModalOpen(false)}
                payments={getTargetPayments()}
            />

            <PaymentRequestModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                payments={getTargetPayments().filter(p => p.estado === EstadoPago.Pendiente || p.estado === EstadoPago.CreditoMensual)}
            />

            <ProofOfPaymentModal
                isOpen={isProofModalOpen}
                onClose={() => setIsProofModalOpen(false)}
                payments={getTargetPayments().filter(p => p.estado === EstadoPago.Pagado)}
            />

            <ImageViewerModal
                isOpen={isImageViewerOpen}
                onClose={() => setImageViewerOpen(false)}
                imageUrl={viewingPayment?.comprobanteImg ?? null}
                fileName={viewingPayment ? `comprobante_${viewingPayment.cliente.replace(/\s+/g, '_')}_${viewingPayment.fecha}_${viewingPayment.oficina}.png` : 'comprobante.png'}
            />

            <ClientVolumeModal
                isOpen={isClientVolumeModalOpen}
                onClose={() => setIsClientVolumeModalOpen(false)}
                payments={payments}
                initialMonth={filters.mes}
                initialYear={filters.año}
            />

            <GoogleSheetsModal
                isOpen={isGoogleSheetsModalOpen}
                onClose={() => setIsGoogleSheetsModalOpen(false)}
            />

            <UnmatchedPaymentsModal
                isOpen={isUnmatchedModalOpen}
                onClose={() => setIsUnmatchedModalOpen(false)}
                unmatchedPayments={unmatchedPayments}
                appointments={payments}
                onMatch={handleMatchUnmatchedPayment}
                onDismiss={handleDismissUnmatchedPayment}
            />

        </div>
    );
};

export default App;