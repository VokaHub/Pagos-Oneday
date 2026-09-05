import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Payment, FilterState, Oficina, EstadoPago, OFFICE_OWNERS, SortType } from './types';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import PaymentTable from './components/PaymentTable';
import PaymentFormModal from './components/PaymentFormModal';
import ConfirmationModal from './components/ConfirmationModal';
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
import { UnmatchedColumn } from './components/UnmatchedColumn';
import { 
    fetchPaymentsFromSheet, 
    SheetPaymentRow,
    sendPaymentToGoogleSheets
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
    const now = new Date();
    return {
        searchTerm: '',
        oficina: Object.values(Oficina),
        estado: 'todos',
        fecha: '',
        fechaPago: '',
        mes: now.getMonth(), // Default al mes actual
        año: now.getFullYear(),  // Default al año actual
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

    const historyRef = useRef(history);
    historyRef.current = history;
    const currentIndexRef = useRef(currentHistoryIndex);
    currentIndexRef.current = currentHistoryIndex;

    const setAppState = useCallback((update: (prevState: AppState) => AppState) => {
        const prevHistory = historyRef.current;
        const prevIndex = currentIndexRef.current;
        const currentState = prevHistory[prevIndex] || { payments: [], accumulatedData: { total: 0, breakdown: {} } };
        const newState = update(currentState);
        const newHistory = [...prevHistory.slice(0, prevIndex + 1), newState];
        historyRef.current = newHistory;
        currentIndexRef.current = newHistory.length - 1;
        setHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);
    }, []);

    // Helpers para emparejamiento inteligente de citas y pagos de Excel
    const TITLE_WORDS = useMemo(() => new Set([
        'dr', 'dra', 'doctor', 'doctora', 
        'lic', 'licda', 'licenciado', 'licenciada', 
        'ing', 'ingeniero', 'ingeniera', 
        'arq', 'arquitecto', 'arquitecta', 
        'sr', 'sra', 'senor', 'senora', 
        'don', 'dona', 'de', 'del', 'la', 'las', 'los', 'y'
    ]), []);

    const extractNameTokens = useCallback((name?: string): string[] => {
        if (!name) return [];
        return name
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 2 && !TITLE_WORDS.has(w));
    }, [TITLE_WORDS]);

    const normalizeDateStr = useCallback((d?: string): string => {
        if (!d) return '';
        const clean = String(d).trim().split('T')[0].split(' ')[0];
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(clean)) {
            const [y, m, day] = clean.split('-');
            return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        const parts = clean.split(/[\/\-]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
            if (parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }
        return clean;
    }, []);

    const normalizeOfficeKey = useCallback((text?: string): string => {
        if (!text) return '';
        const t = String(text).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (t.includes('1201')) return '1201';
        if (t.includes('203B') || t.includes('203')) return '203B';
        if (t.includes('211B') || t.includes('211')) return '211B';
        if (t.includes('232B') || t.includes('232')) return '232B';
        if (t.includes('323') || t.includes('VITALE') || t.includes('DM')) return '323';
        return '';
    }, []);

    const normalizePhone = useCallback((phone?: string): string => {
        if (!phone) return '';
        const digits = String(phone).replace(/\D/g, '');
        if (digits.length === 11 && digits.startsWith('502')) {
            return digits.slice(3);
        }
        if (digits.length >= 8) {
            return digits.slice(-8);
        }
        return digits;
    }, []);

    const arePhonesMatching = useCallback((phoneA?: string, phoneB?: string): boolean => {
        const pA = normalizePhone(phoneA);
        const pB = normalizePhone(phoneB);
        if (!pA || !pB || pA.length < 7 || pB.length < 7) return false;
        return pA === pB;
    }, [normalizePhone]);

    const arePhonesConflicting = useCallback((phoneA?: string, phoneB?: string): boolean => {
        const pA = normalizePhone(phoneA);
        const pB = normalizePhone(phoneB);
        // Si ambos tienen teléfono pero no coinciden, hay conflicto estricto (son clientes distintos)
        return Boolean(pA && pB && pA.length >= 7 && pB.length >= 7 && pA !== pB);
    }, [normalizePhone]);

    const calculateNameSimilarity = useCallback((nameA?: string, nameB?: string): number => {
        if (!nameA || !nameB) return 0;
        const cleanA = nameA.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '').trim();
        const cleanB = nameB.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '').trim();
        
        if (cleanA && cleanA === cleanB) return 100;
        if (cleanA.length >= 4 && cleanB.length >= 4 && (cleanA.includes(cleanB) || cleanB.includes(cleanA))) {
            return 90;
        }

        const tokensA = extractNameTokens(nameA);
        const tokensB = extractNameTokens(nameB);
        if (tokensA.length === 0 || tokensB.length === 0) return 0;

        let matchCount = 0;
        for (const tA of tokensA) {
            if (tokensB.some(tB => tA === tB || (tA.length >= 4 && tB.length >= 4 && (tA.startsWith(tB) || tB.startsWith(tA))))) {
                matchCount++;
            }
        }

        if (matchCount >= 2) return 85;
        if (matchCount === 1) {
            if (tokensA.length <= 2 || tokensB.length <= 2) return 70;
            return 45;
        }
        return 0;
    }, [extractNameTokens]);

    const computeConfidence = useCallback((apt: Payment, sp: SheetPaymentRow): number => {
        // 1. Si ambos tienen teléfono y no coinciden, rechazo total (clientes distintos)
        if (arePhonesConflicting(apt.telefono, sp.telefono)) {
            return 0;
        }

        const phoneMatches = arePhonesMatching(apt.telefono, sp.telefono);

        const nameScore = calculateNameSimilarity(apt.cliente, sp.cliente);
        if (!phoneMatches && nameScore === 0) return 0;

        const aptDate = normalizeDateStr(apt.fecha);
        const spDate = normalizeDateStr(sp.fechaServicio || sp.fechaPago);
        const dateMatches = aptDate && spDate && aptDate === spDate;
        const dateEmpty = !spDate;

        const aptOffice = normalizeOfficeKey(apt.oficina);
        const spOffice = normalizeOfficeKey(sp.oficina);
        const officeMatches = aptOffice && spOffice && aptOffice === spOffice;
        const officeEmpty = !spOffice;

        // Si fecha u oficina se especifican en ambos y se contradicen directamente, rechazar
        if (spDate && aptDate && spDate !== aptDate) return 0;
        if (spOffice && aptOffice && spOffice !== aptOffice) return 0;

        const aptHours = Number(apt.horas || 0);
        const spHours = Number(sp.horas || 0);
        const hoursMatch = aptHours > 0 && spHours > 0 && Math.abs(aptHours - spHours) < 0.1;

        const aptMonto = Number(apt.monto || 0);
        const spMonto = Number(sp.monto || 0);
        const montoMatch = aptMonto > 0 && spMonto > 0 && Math.abs(aptMonto - spMonto) < 1;

        let score = phoneMatches ? 100 : nameScore;

        if (phoneMatches) score += 60; // Bono estelar por match telefónico exacto
        if (dateMatches) score += 50;
        else if (dateEmpty) score += 15;

        if (officeMatches) score += 40;
        else if (officeEmpty) score += 15;

        if (hoursMatch || montoMatch) score += 30;

        return score;
    }, [arePhonesConflicting, arePhonesMatching, calculateNameSimilarity, normalizeDateStr, normalizeOfficeKey]);

    // Motor de cuadre inteligente: concilia citas con pagos en Excel (Google Sheets)
    // Soporta pagos agrupados (ej. 1 boleta por 2 o más horas que cubre múltiples citas sueltas de 1 hora)
    // y realiza descarte ordenado por cliente, fecha y oficina.
    const reconcileAppointmentsWithExcel = useCallback(async (baseAppointments: Payment[]) => {
        if (!baseAppointments || baseAppointments.length === 0) return null;
        setIsSyncing(true);
        try {
            // 1. Obtener pagos en vivo del backend Excel / Google Sheets
            const sheetRes = await fetchPaymentsFromSheet().catch(e => ({ success: false, pagos: [], message: e?.message }));
            let sheetPagos: SheetPaymentRow[] = (sheetRes.success && Array.isArray(sheetRes.pagos)) ? sheetRes.pagos : [];

            // Si Google Sheets no tiene datos o falló, buscar pagos pendientes locales
            if (!sheetRes.success || sheetPagos.length === 0) {
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
                                    comprobanteUrl: lp.comprobanteImg || '',
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
            }

            // 2. Preparar bolsa de pagos de Excel rastreando horas totales y restantes
            interface TrackedSheetPayment {
                sp: SheetPaymentRow;
                index: number;
                totalHours: number;
                totalMonto: number;
                remainingHours: number;
                matchedAptIndices: Set<number>;
            }

            const trackedSheetPayments: TrackedSheetPayment[] = sheetPagos.map((sp, index) => {
                const rawH = Number(sp.horas);
                const rawM = Number(sp.monto);
                let totalH = 1;
                if (!isNaN(rawH) && rawH > 0) {
                    totalH = rawH;
                } else if (!isNaN(rawM) && rawM > 0) {
                    totalH = Math.max(1, Math.round(rawM / 65));
                }
                const totalM = (!isNaN(rawM) && rawM > 0) ? rawM : totalH * 65;
                return {
                    sp,
                    index,
                    totalHours: totalH,
                    totalMonto: totalM,
                    remainingHours: totalH,
                    matchedAptIndices: new Set<number>(),
                };
            });

            // 3. Preparar citas a conciliar con horas pendientes
            interface TrackedAppointment {
                apt: Payment;
                index: number;
                hoursNeeded: number;
                hoursRemaining: number;
                isCovered: boolean;
                matchedPayments: { sp: SheetPaymentRow; hoursAllocated: number }[];
            }

            const trackedApts: TrackedAppointment[] = baseAppointments.map((apt, index) => {
                const rawH = Number(apt.horas);
                const hNeeded = (!isNaN(rawH) && rawH > 0) ? rawH : 1;
                // Si la cita ya estaba marcada como pagada con boleta real previamente, no la sobreescribimos
                const alreadyPaid = apt.estado === EstadoPago.Pagado && !!apt.boleta && !apt.boleta.toLowerCase().includes('pendiente');
                return {
                    apt,
                    index,
                    hoursNeeded: hNeeded,
                    hoursRemaining: alreadyPaid ? 0 : hNeeded,
                    isCovered: alreadyPaid,
                    matchedPayments: [],
                };
            });

            // Si alguna cita ya tenía asignado el ID del pago de Excel previamente, descontar esas horas del pago
            trackedApts.forEach(tApt => {
                if (tApt.isCovered && tApt.apt.boleta) {
                    trackedSheetPayments.forEach(tSp => {
                        if (tSp.sp.id && tApt.apt.boleta?.includes(tSp.sp.id)) {
                            tSp.remainingHours = Math.max(0, Number((tSp.remainingHours - tApt.hoursNeeded).toFixed(2)));
                            tSp.matchedAptIndices.add(tApt.index);
                        }
                    });
                }
            });

            // Función atómica para asignar horas de un pago de Excel a una cita
            const allocateHours = (spIdx: number, aptIdx: number) => {
                const tSp = trackedSheetPayments[spIdx];
                const tApt = trackedApts[aptIdx];
                if (tSp.remainingHours <= 0 || tApt.hoursRemaining <= 0) return;

                const alloc = Math.min(tSp.remainingHours, tApt.hoursRemaining);
                tSp.remainingHours = Math.max(0, Number((tSp.remainingHours - alloc).toFixed(2)));
                tApt.hoursRemaining = Math.max(0, Number((tApt.hoursRemaining - alloc).toFixed(2)));

                tSp.matchedAptIndices.add(aptIdx);
                tApt.matchedPayments.push({ sp: tSp.sp, hoursAllocated: alloc });

                if (tApt.hoursRemaining <= 0.05) {
                    tApt.isCovered = true;
                }
            };

            // Conciliación estricta priorizando Teléfono, Fecha y Oficina:
            // Cada pago de Excel es un saldo de horas para un Cliente específico (identificado con precisión por su Teléfono o Nombre),
            // en una Oficina específica y una Fecha específica.

            // PASO 1 (MÁXIMA PRIORIDAD): Coincidencia por TELÉFONO exacto + Misma Oficina + Misma Fecha
            for (let s = 0; s < trackedSheetPayments.length; s++) {
                const tSp = trackedSheetPayments[s];
                if (tSp.remainingHours <= 0) continue;
                const spDateService = normalizeDateStr(tSp.sp.fechaServicio);
                const spDatePago = normalizeDateStr(tSp.sp.fechaPago);
                const spOffice = normalizeOfficeKey(tSp.sp.oficina);

                for (let a = 0; a < trackedApts.length; a++) {
                    if (tSp.remainingHours <= 0) break;
                    const tApt = trackedApts[a];
                    if (tApt.isCovered) continue;

                    // Si ambos tienen teléfono y coinciden exactamente
                    if (!arePhonesMatching(tApt.apt.telefono, tSp.sp.telefono)) continue;

                    // Validar Oficina estrictamente
                    const aptOffice = normalizeOfficeKey(tApt.apt.oficina);
                    if (spOffice !== aptOffice) continue;

                    // Validar Fecha
                    const aptDate = normalizeDateStr(tApt.apt.fecha);
                    const matchDate = (spDateService && aptDate === spDateService) || (spDatePago && aptDate === spDatePago);
                    if (!matchDate) continue;

                    allocateHours(s, a);
                }
            }

            // PASO 2: Coincidencia por TELÉFONO exacto + Misma Oficina (fechas adyacentes / cronológico)
            for (let s = 0; s < trackedSheetPayments.length; s++) {
                const tSp = trackedSheetPayments[s];
                if (tSp.remainingHours <= 0) continue;
                const spOffice = normalizeOfficeKey(tSp.sp.oficina);

                const candidateIndices: number[] = [];
                for (let a = 0; a < trackedApts.length; a++) {
                    const tApt = trackedApts[a];
                    if (tApt.isCovered) continue;
                    if (!arePhonesMatching(tApt.apt.telefono, tSp.sp.telefono)) continue;
                    
                    if (normalizeOfficeKey(tApt.apt.oficina) === spOffice) {
                        candidateIndices.push(a);
                    }
                }

                candidateIndices.sort((i1, i2) => {
                    const d1 = new Date(trackedApts[i1].apt.fecha).getTime() || 0;
                    const d2 = new Date(trackedApts[i2].apt.fecha).getTime() || 0;
                    return d1 - d2;
                });

                for (const a of candidateIndices) {
                    if (tSp.remainingHours <= 0) break;
                    allocateHours(s, a);
                }
            }

            // PASO 3: Coincidencia por Nombre + Misma Oficina + Misma Fecha
            // (CRUCIAL: Solo si NO hay conflicto de teléfonos entre la cita y el pago de Excel)
            for (let s = 0; s < trackedSheetPayments.length; s++) {
                const tSp = trackedSheetPayments[s];
                if (tSp.remainingHours <= 0) continue;
                const spDateService = normalizeDateStr(tSp.sp.fechaServicio);
                const spDatePago = normalizeDateStr(tSp.sp.fechaPago);
                const spOffice = normalizeOfficeKey(tSp.sp.oficina);

                for (let a = 0; a < trackedApts.length; a++) {
                    if (tSp.remainingHours <= 0) break;
                    const tApt = trackedApts[a];
                    if (tApt.isCovered) continue;

                    // Si los teléfonos se contradicen, NUNCA emparejar (evita confusión de homónimos)
                    if (arePhonesConflicting(tApt.apt.telefono, tSp.sp.telefono)) continue;

                    // Validar Cliente por nombre
                    const nameScore = calculateNameSimilarity(tApt.apt.cliente, tSp.sp.cliente);
                    if (nameScore < 75) continue;

                    // Validar Oficina estrictamente
                    const aptOffice = normalizeOfficeKey(tApt.apt.oficina);
                    if (spOffice !== aptOffice) continue;

                    // Validar Fecha (debe coincidir con la fecha de servicio o la fecha de pago registrada en Excel)
                    const aptDate = normalizeDateStr(tApt.apt.fecha);
                    const matchDate = (spDateService && aptDate === spDateService) || (spDatePago && aptDate === spDatePago);
                    if (!matchDate) continue;

                    allocateHours(s, a);
                }
            }

            // PASO 4: Si aún quedan horas en ese pago para ese Cliente y esa misma Oficina,
            // y la clienta agendó en esa misma oficina citas adyacentes o de esa misma semana,
            // se consumen las citas pendientes en orden cronológico (sin conflicto de teléfono).
            for (let s = 0; s < trackedSheetPayments.length; s++) {
                const tSp = trackedSheetPayments[s];
                if (tSp.remainingHours <= 0) continue;
                const spOffice = normalizeOfficeKey(tSp.sp.oficina);

                const candidateIndices: number[] = [];
                for (let a = 0; a < trackedApts.length; a++) {
                    const tApt = trackedApts[a];
                    if (tApt.isCovered) continue;
                    if (arePhonesConflicting(tApt.apt.telefono, tSp.sp.telefono)) continue;
                    if (calculateNameSimilarity(tApt.apt.cliente, tSp.sp.cliente) < 75) continue;
                    
                    // La oficina DEBE coincidir siempre
                    if (normalizeOfficeKey(tApt.apt.oficina) === spOffice) {
                        candidateIndices.push(a);
                    }
                }

                candidateIndices.sort((i1, i2) => {
                    const d1 = new Date(trackedApts[i1].apt.fecha).getTime() || 0;
                    const d2 = new Date(trackedApts[i2].apt.fecha).getTime() || 0;
                    return d1 - d2;
                });

                for (const a of candidateIndices) {
                    if (tSp.remainingHours <= 0) break;
                    allocateHours(s, a);
                }
            }

            // 4. Consolidar citas actualizadas
            let matchedCount = 0;
            const reconciledAppointments: Payment[] = trackedApts.map(tApt => {
                if (tApt.matchedPayments.length > 0) {
                    matchedCount++;
                    const primarySp = tApt.matchedPayments[0].sp;
                    const boletas = Array.from(new Set(
                        tApt.matchedPayments.map(m => m.sp.id ? `Ref: ${m.sp.id}` : 'Comprobante Excel')
                    )).join(', ');

                    const comprobanteUrl = tApt.matchedPayments.find(m => m.sp.comprobanteUrl)?.sp.comprobanteUrl || tApt.apt.comprobanteImg;
                    const statusStr = (primarySp.estado || '').toLowerCase();
                    const estado = statusStr.includes('credito') ? EstadoPago.CreditoMensual : EstadoPago.Pagado;

                    let updatedNotas = tApt.apt.notas || '';
                    const clientNotes = tApt.matchedPayments.map(m => m.sp.notas).filter(Boolean).join(' | ');
                    if (clientNotes && !updatedNotas.includes(clientNotes)) {
                        updatedNotas = `${updatedNotas} | ${clientNotes}`.trim();
                    }

                    // Notificación en notas si fue cubierto por una boleta agrupada de múltiples horas
                    const spTotalH = Number(primarySp.horas) || 1;
                    if (spTotalH > 1 && !updatedNotas.includes('Cubierto por boleta de')) {
                        updatedNotas = `${updatedNotas} | Cubierto por boleta de ${spTotalH} hrs`.trim();
                    }

                    // Si el pago de Excel incluye teléfono, actualizarlo en el directorio local de clientes
                    if (primarySp.cliente && primarySp.telefono) {
                        try {
                            const rawDir = localStorage.getItem('oneday_client_phone_directory') || '{}';
                            const dir = JSON.parse(rawDir);
                            dir[primarySp.cliente.trim()] = primarySp.telefono.trim();
                            localStorage.setItem('oneday_client_phone_directory', JSON.stringify(dir));
                        } catch {}
                    }

                    return {
                        ...tApt.apt,
                        telefono: tApt.apt.telefono || primarySp.telefono,
                        estado,
                        boleta: tApt.apt.boleta || boletas,
                        comprobanteImg: comprobanteUrl || undefined,
                        fechaPago: normalizeDateStr(primarySp.fechaPago) || normalizeDateStr(primarySp.fechaServicio) || tApt.apt.fecha,
                        metodoPago: primarySp.metodoPago || tApt.apt.metodoPago || 'Transferencia Bancaria',
                        revisado: estado === EstadoPago.Pagado,
                        notas: updatedNotas,
                    };
                }
                return tApt.apt;
            });

            // 5. Pagos de Excel que quedaron con horas pendientes de asignar
            const leftOverPayments: SheetPaymentRow[] = [];
            trackedSheetPayments.forEach(tSp => {
                if (tSp.matchedAptIndices.size === 0) {
                    leftOverPayments.push(tSp.sp);
                } else if (tSp.remainingHours > 0.05) {
                    leftOverPayments.push({
                        ...tSp.sp,
                        horas: tSp.remainingHours,
                        monto: tSp.remainingHours * 65,
                        notas: `${tSp.sp.notas || ''} [${tSp.remainingHours} de ${tSp.totalHours} hrs por asignar]`.trim(),
                    });
                }
            });

            setUnmatchedPayments(leftOverPayments);
            try {
                localStorage.setItem('oneday_unmatched_payments', JSON.stringify(leftOverPayments));
            } catch (e) {
                console.warn('Error al guardar pagos no emparejados:', e);
            }

            setAppState(prevState => ({
                ...prevState,
                payments: reconciledAppointments,
            }));

            const totalPagadas = reconciledAppointments.filter(p => p.estado === EstadoPago.Pagado).length;
            const totalPendientes = reconciledAppointments.filter(p => p.estado === EstadoPago.Pendiente).length;

            if (leftOverPayments.length > 0) {
                setSyncFeedback(`Conciliacion: ${matchedCount} citas cubiertas | ${leftOverPayments.length} pagos de Excel con horas pendientes`);
                setIsUnmatchedColumnOpen(true);
            } else {
                setSyncFeedback(`Conciliacion exitosa: ${matchedCount} citas cuadradas (${totalPagadas} pagadas en total)`);
                setIsUnmatchedColumnOpen(false);
            }
            setTimeout(() => setSyncFeedback(null), 5000);

            return {
                total: reconciledAppointments.length,
                matchedCount,
                unmatchedCount: totalPendientes,
                unmatchedExcelCount: leftOverPayments.length,
            };
        } catch (err: any) {
            console.error('Error en cuadre con Excel:', err);
            setSyncFeedback('Error al conciliar con Excel');
            setTimeout(() => setSyncFeedback(null), 4000);
            return null;
        } finally {
            setIsSyncing(false);
        }
    }, [calculateNameSimilarity, normalizeDateStr, normalizeOfficeKey, setAppState]);

    // Emparejar manualmente un pago de Excel con una cita existente
    const handleMatchUnmatchedPayment = useCallback((unmatched: SheetPaymentRow, appointmentId: string) => {
        setAppState(prev => {
            const updated = prev.payments.map(p => {
                if (p.id === appointmentId) {
                    const statusStr = (unmatched.estado || '').toLowerCase();
                    const estado = statusStr.includes('credito') ? EstadoPago.CreditoMensual : EstadoPago.Pagado;
                    return {
                        ...p,
                        estado,
                        boleta: p.boleta || (unmatched.id ? `Ref: ${unmatched.id}` : 'Comprobante Excel'),
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

        setSyncFeedback(`Cita de ${unmatched.cliente} marcada como pagada`);
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

    // Conciliar / cruzar citas con Excel bajo demanda
    const syncWithGoogleSheets = useCallback(async () => {
        if (payments.length === 0) {
            alert("No hay citas en la tabla para cruzar. Primero use el boton 'Importar / Añadir' para cargar el archivo.");
            return;
        }
        const result = await reconcileAppointmentsWithExcel(payments);
        if (result) {
            const extraMsg = result.unmatchedExcelCount > 0 
                ? `\n- Pagos de Excel sin emparejar: ${result.unmatchedExcelCount} (disponibles en el panel para asignar manualmente)`
                : '\n- Todos los pagos de Excel cuadraron con las citas registradas.';
            alert(`Conciliacion con Excel finalizada:\n- Total citas: ${result.total}\n- Citas conciliadas como Pagadas: ${result.matchedCount}\n- Citas pendientes: ${result.unmatchedCount}${extraMsg}`);
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
                 // Basic filters: Search matches client name, full phone or phone digits
                const rawSearch = (filters.searchTerm || '').trim();
                const searchLower = rawSearch.toLowerCase();
                const searchDigits = rawSearch.replace(/\D/g, '');
                const paymentPhoneDigits = (p.telefono || '').replace(/\D/g, '');

                let searchTermMatch = true;
                if (rawSearch) {
                    const matchesName = p.cliente.toLowerCase().includes(searchLower);
                    const matchesPhone = Boolean(p.telefono && p.telefono.toLowerCase().includes(searchLower));
                    const matchesPhoneDigits = Boolean(
                        searchDigits.length >= 4 && paymentPhoneDigits && 
                        (paymentPhoneDigits.includes(searchDigits) || searchDigits.includes(paymentPhoneDigits))
                    );
                    searchTermMatch = matchesName || matchesPhone || matchesPhoneDigits;
                }

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
        let savedPayment: Payment;
        if (editingPayment) {
            savedPayment = { ...editingPayment, ...paymentData, id: editingPayment.id };
        } else {
            const newId = String(Date.now()) + Math.random().toString(36).substring(2);
            savedPayment = { ...paymentData, id: newId, revisado: false };
        }

        if (savedPayment.cliente && savedPayment.telefono) {
            try {
                const rawDir = localStorage.getItem('oneday_client_phone_directory') || '{}';
                const dir = JSON.parse(rawDir);
                dir[savedPayment.cliente.trim()] = savedPayment.telefono.trim();
                localStorage.setItem('oneday_client_phone_directory', JSON.stringify(dir));
            } catch {}
        }

        setAppState(prevState => {
            const newPayments = editingPayment
                ? prevState.payments.map(p => p.id === editingPayment.id ? savedPayment : p)
                : [...prevState.payments, savedPayment];
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
        let mergedSummary: { cliente: string; totalMonto: number; totalHoras: number } | null = null;
        let errorMessage: string | null = null;

        setAppState(prevState => {
            const dragged = prevState.payments.find(p => p.id === draggedId);
            const target = prevState.payments.find(p => p.id === targetId);
        
            if (!dragged || !target || dragged.id === target.id) {
                return prevState;
            }

            // Normalizadores robustos
            const cleanStr = (s?: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '').trim();
            
            const normDate = (d?: string) => {
                if (!d) return '';
                const raw = String(d).trim().split('T')[0].split(' ')[0];
                const parts = raw.split(/[\/\-]/);
                if (parts.length === 3) {
                    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                    if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
                return raw;
            };

            const normOffice = (o?: string) => {
                if (!o) return '';
                const t = String(o).toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (t.includes('1201')) return '1201';
                if (t.includes('203B') || t.includes('203')) return '203B';
                if (t.includes('211B') || t.includes('211')) return '211B';
                if (t.includes('232B') || t.includes('232')) return '232B';
                if (t.includes('323') || t.includes('VITALE') || t.includes('DM')) return '323';
                return t;
            };

            const clientA = cleanStr(dragged.cliente);
            const clientB = cleanStr(target.cliente);
            const sameClient = clientA === clientB || 
                (clientA.length >= 4 && clientB.length >= 4 && (clientA.includes(clientB) || clientB.includes(clientA))) ||
                clientA.split(/\s+/).filter(w => w.length >= 3 && !['dr', 'dra', 'lic', 'licda'].includes(w)).some(w => clientB.includes(w));

            const sameOffice = normOffice(dragged.oficina) === normOffice(target.oficina);
            const sameDate = normDate(dragged.fecha) === normDate(target.fecha);

            const sameRecordId = Boolean(
                dragged.recordId && target.recordId && 
                String(dragged.recordId).trim().length > 0 && 
                String(dragged.recordId).trim() === String(target.recordId).trim()
            );

            // Permitir fusión si es misma persona + mismo día, O misma persona + misma oficina, O mismo ID de reserva
            const canMerge = (sameClient && sameDate) || (sameClient && sameOffice) || sameRecordId;

            if (!canMerge) {
                errorMessage = `No se pueden fusionar: los registros pertenecen a personas diferentes ("${dragged.cliente}" y "${target.cliente}"). Solo se pueden fusionar citas del mismo cliente.`;
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
        
            const mergeLog = `\n--- Registro Fusionado ---\nFecha: ${dragged.fecha}\nOficina: ${dragged.oficina}\nID Original: ${dragged.recordId || 'N/A'}\nBoleta: ${dragged.boleta || 'N/A'}\nHoras: ${dragged.horas || 1}h\nMonto: ${formatCurrency(dragged.monto)}\n--------------------------`;
            
            const newNotes = [target.notas, dragged.notas, mergeLog].filter(Boolean).join('\n\n').trim();
            const totalMonto = Number(target.monto || 0) + Number(dragged.monto || 0);
            const totalHoras = (Number(target.horas) || 1) + (Number(dragged.horas) || 1);
            const isAnyPaid = target.estado === EstadoPago.Pagado || dragged.estado === EstadoPago.Pagado;

            mergedSummary = { cliente: target.cliente, totalMonto, totalHoras };

            const mergedPayment: Payment = {
                ...target,
                recordId: combinedRecordIds || undefined,
                telefono: target.telefono || dragged.telefono,
                monto: totalMonto,
                horas: totalHoras,
                boleta: combinedBoletas || target.boleta || dragged.boleta,
                comprobanteImg: target.comprobanteImg || dragged.comprobanteImg,
                fechaPago: target.fechaPago || dragged.fechaPago,
                metodoPago: target.metodoPago || dragged.metodoPago,
                notas: newNotes,
                revisado: isAnyPaid || target.revisado || dragged.revisado,
                estado: isAnyPaid ? EstadoPago.Pagado : target.estado,
            };
        
            const newPayments = prevState.payments.map(p => p.id === target.id ? mergedPayment : p).filter(p => p.id !== dragged.id);
            return { ...prevState, payments: newPayments };
        });

        if (errorMessage) {
            alert(errorMessage);
        } else if (mergedSummary) {
            setSyncFeedback(`Fusionado con éxito: ${(mergedSummary as any).cliente} (${(mergedSummary as any).totalHoras} hrs • Q${(mergedSummary as any).totalMonto})`);
            setTimeout(() => setSyncFeedback(null), 4000);
        }
    };

    const handleMergeSelected = useCallback(() => {
        if (selectedIds.size < 2) return;
        const selectedList = payments.filter(p => selectedIds.has(p.id));
        if (selectedList.length < 2) return;

        const first = selectedList[0];
        const cleanStr = (s?: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '').trim();
        const clientA = cleanStr(first.cliente);

        const allSameClient = selectedList.every(p => {
            const clientB = cleanStr(p.cliente);
            return clientA === clientB || clientA.includes(clientB) || clientB.includes(clientA);
        });

        if (!allSameClient) {
            alert("Para fusionar los registros seleccionados, todos deben pertenecer al mismo cliente.");
            return;
        }

        if (!window.confirm(`¿Deseas fusionar estos ${selectedList.length} registros de ${first.cliente} en uno solo? Se sumarán todas sus horas y montos automáticamente.`)) {
            return;
        }

        const targetId = first.id;
        for (let i = 1; i < selectedList.length; i++) {
            handleMerge(selectedList[i].id, targetId);
        }
        setSelectedIds(new Set());
    }, [selectedIds, payments]);

    const exportPaymentsToXLSX = useCallback((paymentsToExport: Payment[], fileName: string) => {
        if (!(window as any).XLSX) {
            alert('La librería para exportar a Excel no está disponible.');
            return;
        }
        const dataToExport = paymentsToExport.map(p => ({
            'Fecha Servicio': p.fecha || '',
            'ID Registro': p.recordId || '',
            'Cliente': p.cliente || '',
            'Oficina': p.oficina ? `Oficina ${p.oficina}` : '',
            'Horas': p.horas !== undefined ? p.horas : 1,
            'Monto (Q)': p.monto || 0,
            'Estado': p.estado || '',
            'Fecha de Pago': p.fechaPago || '',
            'Método de Pago': p.metodoPago || '',
            'No. Boleta / Ref': p.boleta || '',
            'Teléfono': p.telefono || '',
            'Notas': p.notas || ''
        }));
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
                                        let cleanPhone = rawPhone ? String(rawPhone).replace(/[^\d+]/g, '') : undefined;
                                        if (!cleanPhone && name) {
                                            try {
                                                const rawDir = localStorage.getItem('oneday_client_phone_directory') || '{}';
                                                const dir = JSON.parse(rawDir);
                                                if (dir[name]) cleanPhone = String(dir[name]).replace(/\D/g, '');
                                            } catch {}
                                        } else if (cleanPhone && name) {
                                            try {
                                                const rawDir = localStorage.getItem('oneday_client_phone_directory') || '{}';
                                                const dir = JSON.parse(rawDir);
                                                dir[name] = cleanPhone;
                                                localStorage.setItem('oneday_client_phone_directory', JSON.stringify(dir));
                                            } catch {}
                                        }

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
                                            notas: `Cita Agendada ${it.scheduled_at ? `| ${it.scheduled_at}` : ''}`,
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
                            'telefono', 'clientphonenumber', 'phone', 'phonenumber', 'telephone', 'celular', 'movil', 'mobile', 'whatsapp', 'clientphone'
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
                            
                            const telefonoRaw = findValue(['telefono', 'clientphonenumber', 'phone', 'phonenumber', 'telephone', 'celular', 'movil', 'mobile', 'whatsapp', 'clientphone']);
                            let telefono = telefonoRaw ? String(telefonoRaw).replace(/\D/g, '') : undefined;

                            // Si no vino en el archivo, intentar autocompletar desde el directorio local guardado
                            const clientNameClean = String(cliente).trim();
                            if (!telefono && clientNameClean) {
                                try {
                                    const rawDir = localStorage.getItem('oneday_client_phone_directory') || '{}';
                                    const dir = JSON.parse(rawDir);
                                    if (dir[clientNameClean]) {
                                        telefono = String(dir[clientNameClean]).replace(/\D/g, '');
                                    }
                                } catch {}
                            } else if (telefono && clientNameClean) {
                                try {
                                    const rawDir = localStorage.getItem('oneday_client_phone_directory') || '{}';
                                    const dir = JSON.parse(rawDir);
                                    dir[clientNameClean] = telefono;
                                    localStorage.setItem('oneday_client_phone_directory', JSON.stringify(dir));
                                } catch {}
                            }
                            
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
            // Si ya hay citas previas, se agregan las nuevas evitando duplicados exactos
            setAppState(prevState => {
                if (prevState.payments.length === 0) {
                    return { ...prevState, payments: allNewPayments };
                }
                const existingKeys = new Set(prevState.payments.map(p => p.recordId || `${p.cliente}-${p.oficina}-${p.fecha}`));
                const toAdd = allNewPayments.filter(p => !existingKeys.has(p.recordId || `${p.cliente}-${p.oficina}-${p.fecha}`));
                return { ...prevState, payments: [...prevState.payments, ...toAdd] };
            });
            alert(`Se importaron ${allNewPayments.length} citas.\n\nPresione el boton "Cruzar con Excel" para conciliar la informacion con los pagos registrados.`);

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
                const [paymentYear, paymentMonth] = (p.fecha || '').split('-').map(Number);
                const monthYearMatch = (filters.mes === -1 || (paymentMonth - 1) === filters.mes) && 
                                       (filters.año === 0 || paymentYear === filters.año);
                const serviceDateMatch = !filters.fecha || p.fecha === filters.fecha;
                const paymentDateMatch = !filters.fechaPago || (p.fechaPago && p.fechaPago === filters.fechaPago);
                return officeMatch && statusMatch && monthYearMatch && serviceDateMatch && paymentDateMatch;
            });
    }, [payments, filters.oficina, filters.estado, filters.mes, filters.año, filters.fecha, filters.fechaPago]);

    const handleRotateClient = useCallback(() => {
        // Pool de citas para rotación (primero la vista filtrada actual o todos los registros si está vacía)
        const pool = paymentsForClientRotation.length > 0 ? paymentsForClientRotation : payments;

        // Agrupamos clientes por número de teléfono único
        const phoneGroups = new Map<string, { phone: string; clientName: string; count: number }>();
        const clientsWithoutPhone = new Map<string, number>();

        pool.forEach(p => {
            const rawPhone = (p.telefono || '').trim();
            const digits = rawPhone.replace(/\D/g, '');
            if (digits && digits.length >= 7) {
                const normP = digits.length >= 8 ? digits.slice(-8) : digits;
                if (!phoneGroups.has(normP)) {
                    phoneGroups.set(normP, {
                        phone: rawPhone,
                        clientName: (p.cliente || '').trim(),
                        count: 1
                    });
                } else {
                    phoneGroups.get(normP)!.count++;
                }
            } else if (p.cliente && p.cliente.trim()) {
                const c = p.cliente.trim();
                clientsWithoutPhone.set(c, (clientsWithoutPhone.get(c) || 0) + 1);
            }
        });

        interface RouletteOption {
            filterTerm: string;
            displayName: string;
            phone?: string;
            client: string;
        }

        const options: RouletteOption[] = [];

        // 1. Prioridad: Números de teléfono (ordenados)
        Array.from(phoneGroups.values())
            .sort((a, b) => a.phone.localeCompare(b.phone))
            .forEach(item => {
                options.push({
                    filterTerm: item.phone,
                    displayName: `📞 ${item.phone} • ${item.clientName}`,
                    phone: item.phone,
                    client: item.clientName
                });
            });

        // 2. Clientes históricos sin teléfono registrado aún
        Array.from(clientsWithoutPhone.keys())
            .sort((a, b) => a.localeCompare(b))
            .forEach(clientName => {
                options.push({
                    filterTerm: clientName,
                    displayName: `👤 ${clientName}`,
                    client: clientName
                });
            });

        if (options.length === 0) {
            setFilters(prev => ({ ...prev, searchTerm: '' }));
            setRotatingClientIndex(null);
            return;
        }

        // Detectar si el término actual coincide con alguna opción
        const currentSearch = (filters.searchTerm || '').trim().toLowerCase();
        const currentDigits = currentSearch.replace(/\D/g, '');

        const currentIdx = currentSearch
            ? options.findIndex(opt => {
                if (opt.phone) {
                    const optDigits = opt.phone.replace(/\D/g, '');
                    if (currentDigits && currentDigits.length >= 4 && (optDigits.includes(currentDigits) || currentDigits.includes(optDigits))) {
                        return true;
                    }
                }
                return opt.filterTerm.toLowerCase() === currentSearch || opt.client.toLowerCase() === currentSearch;
            })
            : -1;

        const nextIndex = (currentIdx === -1 || currentIdx >= options.length - 1)
            ? 0
            : currentIdx + 1;

        const selected = options[nextIndex];

        setRotatingClientIndex(nextIndex);
        setFilters(prev => ({ ...prev, searchTerm: selected.filterTerm }));

        setSyncFeedback(`Ruleta: ${selected.displayName} (${nextIndex + 1}/${options.length})`);
        setTimeout(() => setSyncFeedback(null), 3000);
    }, [paymentsForClientRotation, payments, filters.searchTerm]);
    
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
                    <div className="bg-slate-50 border border-slate-300 text-slate-900 px-5 py-3.5 rounded-2xl mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xs">
                                {unmatchedPayments.length}
                            </span>
                            <div>
                                <h4 className="font-bold text-sm text-slate-900">
                                    {unmatchedPayments.length === 1 
                                        ? 'Hay 1 pago de Excel sin emparejar' 
                                        : `Hay ${unmatchedPayments.length} pagos de Excel sin emparejar`}
                                </h4>
                                <p className="text-xs text-slate-600">
                                    Estos pagos registrados no coincidieron automaticamente. Abra el panel para asignarlos a una cita.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsUnmatchedColumnOpen(true)}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                        >
                            <span>Ver Pagos sin Emparejar</span>
                            <span className="bg-slate-700 px-1.5 py-0.5 rounded-md text-[10px]">{unmatchedPayments.length}</span>
                        </button>
                    </div>
                )}

                {/* Banner when filter hides all payments */}
                {payments.length > 0 && filteredPayments.length === 0 && (
                    <div className="bg-slate-50 border border-slate-300 text-slate-800 px-5 py-4 rounded-2xl mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200 text-slate-700 font-bold">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </span>
                            <div>
                                <p className="text-sm font-semibold">
                                    No hay citas con el filtro actual ({filters.mes !== -1 ? monthNames[filters.mes] : 'Todos los meses'} {filters.año !== 0 ? filters.año : 'Todos los años'}).
                                </p>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    Tiene <strong>{payments.length} citas registradas</strong> ({totalPendingCount} pendientes, {totalPaidCount} pagadas).
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFilters(prev => ({ ...prev, mes: -1, año: 0, searchTerm: '', estado: 'todos' }))}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                        >
                            Ver Todas las Citas ({payments.length})
                        </button>
                    </div>
                )}

                {/* Contenedor principal: Tabla de Citas + Columna de Pagos Sin Emparejar (Drag & Drop) */}
                <div className="flex flex-col xl:flex-row items-start gap-6 w-full">
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
                        <div className="w-full xl:w-80 2xl:w-96 shrink-0 xl:sticky xl:top-6">
                            <UnmatchedColumn
                                isOpen={isUnmatchedColumnOpen}
                                onClose={() => setIsUnmatchedColumnOpen(false)}
                                unmatchedPayments={unmatchedPayments}
                                appointments={payments}
                                onMatch={handleMatchUnmatchedPayment}
                                onDismiss={handleDismissUnmatchedPayment}
                            />
                        </div>
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
                    onMergeSelected={handleMergeSelected}
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
                payments={payments}
            />

        </div>
    );
};

export default App;