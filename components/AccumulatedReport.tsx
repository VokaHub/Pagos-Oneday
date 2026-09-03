import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Payment, Oficina, EstadoPago } from '../types';
import ConfirmationModal from './ConfirmationModal';

interface AccumulatedData {
    total: number;
    breakdown: { [key in Oficina]?: number };
}

interface AccumulatedReportProps {
    payments: Payment[];
    accumulatedData: AccumulatedData;
    setAccumulatedData: (update: React.SetStateAction<AccumulatedData>) => void;
    selectedMonth?: number;
    selectedYear?: number;
    onOpenClientVolume?: () => void;
}

const formatCurrency = (amount: number) => {
    return `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const COMMISSION_Q15_Q65 = 15 / 65; // ~23.0769%

// Standard default commission rates for ONEDAY
const getDefaultCommissions = (): Record<Oficina, number> => {
    return {
        [Oficina.O1201]: 0.0,
        [Oficina.O203B]: 0.0,
        [Oficina.O211B]: 0.20,
        [Oficina.O232B]: COMMISSION_Q15_Q65,
        [Oficina.O323]: COMMISSION_Q15_Q65,
    };
};

const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const AccumulatedReport: React.FC<AccumulatedReportProps> = ({ 
    payments, 
    accumulatedData, 
    setAccumulatedData,
    selectedMonth,
    selectedYear,
    onOpenClientVolume
}) => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [selectedOffices, setSelectedOffices] = useState<Oficina[]>(Object.values(Oficina));
    const [isOfficeDropdownOpen, setIsOfficeDropdownOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'cards' | 'table'>('cards');
    
    // Per-office commission rate state
    const [officeCommissions, setOfficeCommissions] = useState<Record<Oficina, number>>(getDefaultCommissions());

    const officeFilterRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const LOCAL_STORAGE_KEY = 'onedayAccumulatedReport';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (officeFilterRef.current && !officeFilterRef.current.contains(event.target as Node)) {
                setIsOfficeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Set commission rate for a specific office
    const handleSetOfficeRate = (oficina: Oficina, rate: number) => {
        setOfficeCommissions(prev => ({
            ...prev,
            [oficina]: rate,
        }));
    };

    // Apply global presets to all offices
    const handleApplyGlobalRate = (preset: '0' | '20' | 'q15q65' | 'oneday_standard') => {
        if (preset === '0') {
            setOfficeCommissions({
                [Oficina.O1201]: 0.0,
                [Oficina.O203B]: 0.0,
                [Oficina.O211B]: 0.0,
                [Oficina.O232B]: 0.0,
                [Oficina.O323]: 0.0,
            });
        } else if (preset === '20') {
            setOfficeCommissions({
                [Oficina.O1201]: 0.20,
                [Oficina.O203B]: 0.20,
                [Oficina.O211B]: 0.20,
                [Oficina.O232B]: 0.20,
                [Oficina.O323]: 0.20,
            });
        } else if (preset === 'q15q65') {
            setOfficeCommissions({
                [Oficina.O1201]: COMMISSION_Q15_Q65,
                [Oficina.O203B]: COMMISSION_Q15_Q65,
                [Oficina.O211B]: COMMISSION_Q15_Q65,
                [Oficina.O232B]: COMMISSION_Q15_Q65,
                [Oficina.O323]: COMMISSION_Q15_Q65,
            });
        } else {
            setOfficeCommissions(getDefaultCommissions());
        }
    };

    // Full per-office detailed calculation
    const officeStats = useMemo(() => {
        const allOffices = Object.values(Oficina);

        const paidPayments = payments.filter(p => p.estado === EstadoPago.Pagado);
        const pendingPayments = payments.filter(p => p.estado === EstadoPago.Pendiente || p.estado === EstadoPago.CreditoMensual);

        let totalRevenueAll = 0;

        const list = allOffices.map(oficina => {
            const officePaidList = paidPayments.filter(p => p.oficina === oficina);
            const officePendingList = pendingPayments.filter(p => p.oficina === oficina);
            const allOfficePayments = payments.filter(p => p.oficina === oficina);

            const currentPaidAmount = officePaidList.reduce((sum, p) => sum + p.monto, 0);
            const accumulatedAmount = Number(accumulatedData.breakdown?.[oficina]) || 0;
            const totalRevenue = currentPaidAmount + accumulatedAmount;
            const pendingAmount = officePendingList.reduce((sum, p) => sum + p.monto, 0);
            const totalHours = allOfficePayments.reduce((sum, p) => sum + (Number(p.horas) || 1), 0);
            const uniqueClients = new Set(allOfficePayments.map(p => p.cliente)).size;

            const commissionRate = officeCommissions[oficina] ?? 0.20;
            const commissionAmount = totalRevenue * commissionRate;
            const netAmount = totalRevenue - commissionAmount;

            totalRevenueAll += totalRevenue;

            return {
                oficina,
                currentPaidAmount,
                paidCount: officePaidList.length,
                pendingCount: officePendingList.length,
                accumulatedAmount,
                totalRevenue,
                pendingAmount,
                totalHours,
                paymentCount: allOfficePayments.length,
                uniqueClients,
                commissionRate,
                commissionAmount,
                netAmount,
                isSelected: selectedOffices.includes(oficina),
            };
        });

        // Add percentage of grand total
        const listWithPercentages = list.map(item => ({
            ...item,
            percentOfTotal: totalRevenueAll > 0 ? (item.totalRevenue / totalRevenueAll) * 100 : 0,
        }));

        // Totals of selected offices
        const filteredList = listWithPercentages.filter(item => item.isSelected);
        const totalSelectedRevenue = filteredList.reduce((sum, item) => sum + item.totalRevenue, 0);
        const totalSelectedCommission = filteredList.reduce((sum, item) => sum + item.commissionAmount, 0);
        const totalSelectedNet = filteredList.reduce((sum, item) => sum + item.netAmount, 0);
        const totalSelectedPending = filteredList.reduce((sum, item) => sum + item.pendingAmount, 0);
        const totalSelectedCurrentPaid = filteredList.reduce((sum, item) => sum + item.currentPaidAmount, 0);
        const totalSelectedAccumulated = filteredList.reduce((sum, item) => sum + item.accumulatedAmount, 0);
        const totalPaidCount = filteredList.reduce((sum, item) => sum + item.paidCount, 0);
        const totalPendingCount = filteredList.reduce((sum, item) => sum + item.pendingCount, 0);

        const hasAnyAccumulated = Object.values(accumulatedData.breakdown || {}).some(val => Number(val) > 0);

        return {
            allOffices: listWithPercentages,
            filteredOffices: filteredList,
            totalSelectedRevenue,
            totalSelectedCommission,
            totalSelectedNet,
            totalSelectedPending,
            totalSelectedCurrentPaid,
            totalSelectedAccumulated,
            totalPaidCount,
            totalPendingCount,
            hasAnyAccumulated,
        };
    }, [payments, accumulatedData, selectedOffices, officeCommissions]);

    // Export to Excel with full commissions & per-office breakdown
    const handleSave = () => {
        if (!(window as any).XLSX) {
            alert('La librería para exportar a Excel no está disponible.');
            return;
        }

        const dataToExport = [
            { 
                'Oficina': 'TOTAL GENERAL ONEDAY', 
                'Ingreso Pagado Actual': officeStats.totalSelectedCurrentPaid,
                'Acumulado Anterior': officeStats.totalSelectedAccumulated,
                'Total Ingresos (Q)': officeStats.totalSelectedRevenue,
                '% Comisión Promedio': officeStats.totalSelectedRevenue > 0 
                    ? `${((officeStats.totalSelectedCommission / officeStats.totalSelectedRevenue) * 100).toFixed(2)}%` 
                    : '0%',
                'Comisión ONEDAY (Q)': officeStats.totalSelectedCommission,
                'Monto Neto (Q)': officeStats.totalSelectedNet,
                'Saldo Pendiente (Q)': officeStats.totalSelectedPending,
            },
            ...officeStats.filteredOffices.map(item => {
                const rateLabel = Math.abs(item.commissionRate - COMMISSION_Q15_Q65) < 0.0001
                    ? 'Q15/Q65 (23.08%)'
                    : `${(item.commissionRate * 100).toFixed(1)}%`;

                return {
                    'Oficina': `Oficina ${item.oficina}`,
                    'Ingreso Pagado Actual': item.currentPaidAmount,
                    'Acumulado Anterior': item.accumulatedAmount,
                    'Total Ingresos (Q)': item.totalRevenue,
                    '% Comisión': rateLabel,
                    'Comisión ONEDAY (Q)': item.commissionAmount,
                    'Monto Neto (Q)': item.netAmount,
                    'Saldo Pendiente (Q)': item.pendingAmount,
                };
            })
        ];

        const worksheet = (window as any).XLSX.utils.json_to_sheet(dataToExport);
        const workbook = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumen ONEDAY');
        
        const today = new Date().toISOString().slice(0, 10);
        (window as any).XLSX.writeFile(workbook, `Resumen_ONEDAY_${today}.xlsx`);
    };

    const handleAccumulateClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !(window as any).XLSX) return;

        event.target.value = '';

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = (window as any).XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = (window as any).XLSX.utils.sheet_to_json(worksheet);

                let importedTotal = 0;
                const importedBreakdown: { [key in Oficina]?: number } = {};

                json.forEach(row => {
                    const concepto = String(row['Concepto'] || row['Oficina'] || '').trim();
                    const monto = parseFloat(String(row['Monto'] || row['Total Ingresos (Q)'] || row['Total Ingresos'] || row['Ingreso Pagado Actual'] || 0));

                    if (isNaN(monto)) return;

                    if (concepto === 'Total Pagado' || concepto === 'Total de Ganancias' || concepto.includes('TOTAL GENERAL')) {
                         if (monto > importedTotal) importedTotal = monto;
                    } else if (concepto.includes('1201') || concepto.includes('203B') || concepto.includes('211B') || concepto.includes('232B') || concepto.includes('323')) {
                        const oficinaKey = Object.values(Oficina).find(o => concepto.includes(o));
                        if (oficinaKey) {
                            importedBreakdown[oficinaKey] = (importedBreakdown[oficinaKey] || 0) + monto;
                        }
                    }
                });
                
                const totalFromBreakdown = Object.values(importedBreakdown).reduce((sum, val) => sum + (Number(val) || 0), 0);
                if (importedTotal < totalFromBreakdown) {
                    importedTotal = totalFromBreakdown;
                }

                if (importedTotal === 0 && Object.keys(importedBreakdown).length === 0) {
                    alert('El archivo no parece tener el formato correcto.');
                    return;
                }

                setAccumulatedData(prev => {
                    const newBreakdown: { [key in Oficina]?: number } = { ...prev.breakdown };
                    Object.values(Oficina).forEach(oficina => {
                        const oficinaKey = oficina as Oficina;
                        const prevAmount = Number(prev.breakdown[oficinaKey]) || 0;
                        const importedAmount = importedBreakdown[oficinaKey] || 0;
                        newBreakdown[oficinaKey] = prevAmount + importedAmount;
                    });
                    
                    const newTotal = Object.values(newBreakdown).reduce((sum, val) => sum + (Number(val) || 0), 0);
                    return { total: newTotal, breakdown: newBreakdown };
                });

                alert('Datos acumulados correctamente.');
            } catch (error) {
                console.error('Error al procesar el archivo acumulado:', error);
                alert('Ocurrió un error al procesar el archivo.');
            }
        };
        reader.readAsBinaryString(file);
    };
    
    const handleConfirmDelete = () => {
        setAccumulatedData({ total: 0, breakdown: {} });
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem('vokaAccumulatedReport');
        setIsConfirmOpen(false);
    };
    
    const handleOfficeChange = (oficina: Oficina) => {
        setSelectedOffices(prev => {
            const newOficinas = prev.includes(oficina)
                ? prev.filter(o => o !== oficina)
                : [...prev, oficina];
            return newOficinas;
        });
    };

    const handleSelectAllOffices = () => {
        setSelectedOffices(Object.values(Oficina));
    };

    const handleClearAllOffices = () => {
        setSelectedOffices([]);
    };

    const getOfficeButtonText = () => {
        const totalOffices = Object.values(Oficina).length;
        const selectedCount = selectedOffices.length;

        if (selectedCount === totalOffices) return 'Todas (5)';
        if (selectedCount === 0) return 'Ninguna';
        if (selectedCount === 1) return `Of. ${selectedOffices[0]}`;
        return `Oficinas (${selectedCount}/${totalOffices})`;
    };

    const getRateLabel = (rate: number) => {
        if (Math.abs(rate - COMMISSION_Q15_Q65) < 0.0001) return 'Q15/Q65';
        return `${(rate * 100).toFixed(0)}%`;
    };

    return (
        <div className="space-y-4 mb-6">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                className="hidden"
                accept=".xlsx, .xls"
            />

            {/* UNIFIED EXECUTIVE KPI STRIP (Google-like Clean Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* 1. Total Pagado */}
                <div className="bg-white p-4 rounded-2xl shadow-google-sm border border-[#dadce0] flex flex-col justify-between hover:shadow-google-md transition">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#5f6368] uppercase tracking-wider">Total Pagado</span>
                        <div className="w-8 h-8 rounded-full bg-green-50 text-[#1e8e3e] flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-2">
                        <p className="text-xl font-bold font-mono text-[#202124] tracking-tight">
                            {formatCurrency(officeStats.totalSelectedCurrentPaid)}
                        </p>
                        <p className="text-xs text-[#1e8e3e] font-semibold mt-0.5">
                            {officeStats.totalPaidCount} pagos recibidos
                        </p>
                    </div>
                </div>

                {/* 2. Saldo Pendiente */}
                <div className="bg-white p-4 rounded-2xl shadow-google-sm border border-[#dadce0] flex flex-col justify-between hover:shadow-google-md transition">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#5f6368] uppercase tracking-wider">Saldo Pendiente</span>
                        <div className="w-8 h-8 rounded-full bg-red-50 text-[#d93025] flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-2">
                        <p className="text-xl font-bold font-mono text-[#d93025] tracking-tight">
                            {formatCurrency(officeStats.totalSelectedPending)}
                        </p>
                        <p className="text-xs text-[#d93025] font-semibold mt-0.5">
                            {officeStats.totalPendingCount > 0 ? `${officeStats.totalPendingCount} por cobrar` : 'Al día'}
                        </p>
                    </div>
                </div>

                {/* 3. Total Ingresos Consolidado */}
                <div className="bg-white p-4 rounded-2xl shadow-google-sm border border-[#dadce0] flex flex-col justify-between hover:shadow-google-md transition">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#5f6368] uppercase tracking-wider">Total Ingresos</span>
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-[#1a73e8] flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-2m0-4h.01M12 18.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13z" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-2">
                        <p className="text-xl font-bold font-mono text-[#1a73e8] tracking-tight">
                            {formatCurrency(officeStats.totalSelectedRevenue)}
                        </p>
                        <p className="text-xs text-[#5f6368] font-medium mt-0.5 truncate">
                            {officeStats.totalSelectedAccumulated > 0 
                                ? `+${formatCurrency(officeStats.totalSelectedAccumulated)} acum.` 
                                : 'Mes seleccionado'}
                        </p>
                    </div>
                </div>

                {/* 4. Comisión ONEDAY */}
                <div className="bg-white p-4 rounded-2xl shadow-google-sm border border-[#dadce0] flex flex-col justify-between hover:shadow-google-md transition">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#5f6368] uppercase tracking-wider">Comisión ONEDAY</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#1e8e3e] text-[11px] font-bold border border-emerald-200">
                            {officeStats.totalSelectedRevenue > 0 
                                ? `${((officeStats.totalSelectedCommission / officeStats.totalSelectedRevenue) * 100).toFixed(1)}%` 
                                : '0%'}
                        </span>
                    </div>
                    <div className="mt-2">
                        <p className="text-xl font-bold font-mono text-[#1e8e3e] tracking-tight">
                            {formatCurrency(officeStats.totalSelectedCommission)}
                        </p>
                        <p className="text-xs text-[#5f6368] font-medium mt-0.5">
                            Retención por servicios
                        </p>
                    </div>
                </div>

                {/* 5. Monto Neto */}
                <div className="bg-[#202124] text-white p-4 rounded-2xl shadow-google-md flex flex-col justify-between hover:shadow-google-lg transition">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#bdc1c6] uppercase tracking-wider">Monto Neto</span>
                        <span className="text-[10px] text-[#9aa0a6] font-medium">Ingreso - Com.</span>
                    </div>
                    <div className="mt-2">
                        <p className="text-xl font-bold font-mono text-[#81c995] tracking-tight">
                            {formatCurrency(officeStats.totalSelectedNet)}
                        </p>
                        <p className="text-xs text-[#bdc1c6] font-medium mt-0.5">
                            {officeStats.totalSelectedRevenue > 0 
                                ? `${((officeStats.totalSelectedNet / officeStats.totalSelectedRevenue) * 100).toFixed(1)}% margen` 
                                : '100%'}
                        </p>
                    </div>
                </div>
            </div>

            {/* UNIFIED OFFICE CONTROL & COMMISSION PANEL */}
            <div className="bg-white rounded-3xl shadow-google-sm border border-[#dadce0] p-5 sm:p-6">
                {/* Header Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#f1f3f4]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#1a73e8] flex items-center justify-center font-bold text-sm border border-blue-200 shadow-xs">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-[#202124] text-sm sm:text-base">
                                    Resumen por Oficina y Comisiones
                                </h3>
                                {selectedMonth !== undefined && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e8f0fe] text-[#1a73e8] border border-blue-200">
                                        {monthNames[selectedMonth]} {selectedYear}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-[#5f6368] mt-0.5">
                                Configura la tasa de comisión para cada oficina y visualiza el desglose de ingresos y netos
                            </p>
                        </div>
                    </div>

                    {/* Quick Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Global Presets */}
                        <div className="hidden md:flex items-center bg-[#f1f3f4] p-1 rounded-full border border-[#dadce0] text-xs">
                            <button
                                type="button"
                                onClick={() => handleApplyGlobalRate('oneday_standard')}
                                className="px-3 py-1 font-bold text-[#1a73e8] hover:bg-white rounded-full transition"
                                title="Configuración estándar ONEDAY: 0% (1201, 203B), 20% (211B) y Q15/Q65 (232B, 323)"
                            >
                                Estándar ONEDAY
                            </button>
                            <button
                                type="button"
                                onClick={() => handleApplyGlobalRate('0')}
                                className="px-2.5 py-1 font-semibold text-[#3c4043] hover:bg-white rounded-full transition"
                                title="0% en todas"
                            >
                                0%
                            </button>
                            <button
                                type="button"
                                onClick={() => handleApplyGlobalRate('20')}
                                className="px-2.5 py-1 font-semibold text-[#3c4043] hover:bg-white rounded-full transition"
                                title="20% en todas"
                            >
                                20%
                            </button>
                            <button
                                type="button"
                                onClick={() => handleApplyGlobalRate('q15q65')}
                                className="px-2.5 py-1 font-semibold text-[#3c4043] hover:bg-white rounded-full transition"
                                title="Q15 por cada Q65 en todas"
                            >
                                Q15/Q65
                            </button>
                        </div>

                        {/* Office Filter Dropdown */}
                        <div className="relative" ref={officeFilterRef}>
                            <button
                                type="button"
                                onClick={() => setIsOfficeDropdownOpen(!isOfficeDropdownOpen)}
                                className="px-3.5 py-1.5 bg-white text-xs font-semibold text-[#3c4043] border border-[#dadce0] rounded-full shadow-xs hover:bg-[#f8fafd] transition flex items-center gap-1.5"
                            >
                                <span>{getOfficeButtonText()}</span>
                                <svg className={`h-3.5 w-3.5 text-[#5f6368] transform transition-transform ${isOfficeDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                            {isOfficeDropdownOpen && (
                                <div className="absolute right-0 z-20 mt-1.5 w-48 bg-white border border-[#dadce0] rounded-2xl shadow-google-lg p-2.5">
                                    <p className="text-[10px] font-bold text-[#5f6368] px-2 py-1 uppercase tracking-wider">Filtrar</p>
                                    <div className="space-y-1 my-1">
                                        {Object.values(Oficina).map(o => (
                                            <label key={o} className="flex items-center space-x-2 px-2.5 py-1.5 hover:bg-[#f8fafd] rounded-xl cursor-pointer text-xs transition">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOffices.includes(o)}
                                                    onChange={() => handleOfficeChange(o)}
                                                    className="h-3.5 w-3.5 rounded border-[#dadce0] text-[#1a73e8] focus:ring-[#1a73e8]"
                                                />
                                                <span className="font-semibold text-[#202124]">Oficina {o}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="flex justify-between p-1.5 border-t border-[#f1f3f4] text-xs">
                                        <button onClick={handleSelectAllOffices} className="text-[#1a73e8] font-semibold hover:underline">Todas</button>
                                        <button onClick={handleClearAllOffices} className="text-[#d93025] font-semibold hover:underline">Ninguna</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Export Excel */}
                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-4 py-1.5 bg-[#1e8e3e] hover:bg-[#188038] text-white text-xs font-semibold rounded-full shadow-google-sm transition flex items-center gap-1.5"
                            title="Exportar reporte de ganancias a Excel"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Excel</span>
                        </button>

                        {/* Accumulate Months */}
                        <button
                            type="button"
                            onClick={handleAccumulateClick}
                            className="px-4 py-1.5 bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] text-xs font-semibold rounded-full shadow-xs transition flex items-center gap-1.5"
                            title="Importar y acumular datos de meses anteriores"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-[#5f6368]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <span>Acumular</span>
                        </button>

                        {/* Reset Accumulated */}
                        {officeStats.hasAnyAccumulated && (
                            <button
                                type="button"
                                onClick={() => setIsConfirmOpen(true)}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#d93025] border border-red-200 text-xs font-semibold rounded-full transition flex items-center gap-1"
                                title="Limpiar datos acumulados importados"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Limpiar</span>
                            </button>
                        )}

                        {/* View Switcher */}
                        <div className="inline-flex bg-[#f1f3f4] p-1 rounded-full border border-[#dadce0] text-xs">
                            <button
                                type="button"
                                onClick={() => setActiveTab('cards')}
                                className={`px-3 py-1 rounded-full font-semibold transition ${
                                    activeTab === 'cards' ? 'bg-white text-[#1a73e8] shadow-xs' : 'text-[#5f6368] hover:text-[#202124]'
                                }`}
                            >
                                Tarjetas
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('table')}
                                className={`px-3 py-1 rounded-full font-semibold transition ${
                                    activeTab === 'table' ? 'bg-white text-[#1a73e8] shadow-xs' : 'text-[#5f6368] hover:text-[#202124]'
                                }`}
                            >
                                Tabla
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content View */}
                <div className="mt-4">
                    {activeTab === 'cards' ? (
                        /* 5 Clean Office Cards */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                            {officeStats.allOffices.map((item) => {
                                const isSelected = item.isSelected;
                                const is0 = Math.abs(item.commissionRate - 0.0) < 0.0001;
                                const isQ15Q65 = Math.abs(item.commissionRate - COMMISSION_Q15_Q65) < 0.0001;
                                const is20 = Math.abs(item.commissionRate - 0.20) < 0.0001;
                                const isCustom = !is0 && !isQ15Q65 && !is20;

                                return (
                                    <div 
                                        key={item.oficina}
                                        className={`rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                                            isSelected 
                                                ? 'bg-[#f8fafd] hover:bg-white border-[#dadce0] shadow-google-sm hover:shadow-google-md' 
                                                : 'bg-gray-50/50 border-[#dadce0] opacity-50'
                                        }`}
                                    >
                                        <div>
                                            {/* Office Header */}
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="px-2.5 py-0.5 bg-[#202124] text-white text-xs font-bold rounded-full">
                                                    Oficina {item.oficina}
                                                </span>
                                                <span className="text-[11px] font-semibold text-[#5f6368]">
                                                    {item.percentOfTotal.toFixed(1)}% total
                                                </span>
                                            </div>

                                            {/* Total Revenue */}
                                            <p className="text-[10px] font-bold text-[#5f6368] uppercase tracking-wider mt-1">Total Ingreso</p>
                                            <p className="text-lg font-bold text-[#202124] font-mono tracking-tight">
                                                {formatCurrency(item.totalRevenue)}
                                            </p>

                                            {/* Commission & Net Row */}
                                            <div className="mt-2.5 p-2.5 bg-white border border-[#dadce0] rounded-xl space-y-1 shadow-xs">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-[#5f6368] font-medium">Comisión:</span>
                                                    <span className="font-mono font-bold text-[#1e8e3e]">
                                                        {formatCurrency(item.commissionAmount)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-[#5f6368]">Neto:</span>
                                                    <span className="font-mono font-bold text-[#1a73e8]">
                                                        {formatCurrency(item.netAmount)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Commission Rate Controls */}
                                        <div className="mt-3 pt-2.5 border-t border-[#dadce0]">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-[#5f6368] uppercase tracking-wider mb-1.5">
                                                <span>Tasa:</span>
                                                <span className="text-[#1a73e8] font-mono font-bold">{getRateLabel(item.commissionRate)}</span>
                                            </div>
                                            
                                            <div className="grid grid-cols-4 gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetOfficeRate(item.oficina, 0.0)}
                                                    className={`py-1 text-[11px] font-bold rounded-lg transition ${
                                                        is0 
                                                            ? 'bg-[#202124] text-white shadow-xs' 
                                                            : 'bg-white text-[#3c4043] border border-[#dadce0] hover:bg-[#f1f3f4]'
                                                    }`}
                                                >
                                                    0%
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetOfficeRate(item.oficina, 0.20)}
                                                    className={`py-1 text-[11px] font-bold rounded-lg transition ${
                                                        is20 
                                                            ? 'bg-[#202124] text-white shadow-xs' 
                                                            : 'bg-white text-[#3c4043] border border-[#dadce0] hover:bg-[#f1f3f4]'
                                                    }`}
                                                >
                                                    20%
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetOfficeRate(item.oficina, COMMISSION_Q15_Q65)}
                                                    title="Q15 de comisión por cada Q65 (23.08%)"
                                                    className={`py-1 text-[10px] font-bold rounded-lg transition ${
                                                        isQ15Q65 
                                                            ? 'bg-[#202124] text-white shadow-xs' 
                                                            : 'bg-white text-[#3c4043] border border-[#dadce0] hover:bg-[#f1f3f4]'
                                                    }`}
                                                >
                                                    Q15/65
                                                </button>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        placeholder="%"
                                                        value={isCustom ? (item.commissionRate * 100).toFixed(0) : ''}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            if (!isNaN(val) && val >= 0) {
                                                                handleSetOfficeRate(item.oficina, val / 100);
                                                            }
                                                        }}
                                                        className="w-full text-center text-[10px] py-1 bg-white border border-[#dadce0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] font-bold text-[#202124]"
                                                    />
                                                </div>
                                            </div>

                                            {/* Mini indicators */}
                                            <div className="mt-2.5 pt-2 border-t border-[#f1f3f4] space-y-1 text-xs text-[#5f6368]">
                                                <div className="flex justify-between">
                                                    <span>Pagado:</span>
                                                    <span className="font-mono font-semibold text-[#1e8e3e]">{formatCurrency(item.currentPaidAmount)}</span>
                                                </div>
                                                {item.accumulatedAmount > 0 && (
                                                    <div className="flex justify-between">
                                                        <span>Acumulado:</span>
                                                        <span className="font-mono font-semibold text-[#f9ab00]">{formatCurrency(item.accumulatedAmount)}</span>
                                                    </div>
                                                )}
                                                {item.pendingAmount > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-[#d93025] font-medium">Pendiente:</span>
                                                        <span className="font-mono font-semibold text-[#d93025]">{formatCurrency(item.pendingAmount)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Compact Comparison Table */
                        <div className="overflow-x-auto rounded-2xl border border-[#dadce0]">
                            <table className="min-w-full divide-y divide-[#dadce0] text-xs">
                                <thead className="bg-[#f8fafd] font-bold text-[#5f6368]">
                                    <tr>
                                        <th className="py-3 px-4 text-left">Oficina</th>
                                        <th className="py-3 px-4 text-right">Pagado</th>
                                        <th className="py-3 px-4 text-right">Acumulado</th>
                                        <th className="py-3 px-4 text-right font-bold text-[#202124]">Total Ingreso</th>
                                        <th className="py-3 px-4 text-center">Tasa Comisión</th>
                                        <th className="py-3 px-4 text-right text-[#1e8e3e] font-bold">Comisión (Q)</th>
                                        <th className="py-3 px-4 text-right text-[#1a73e8] font-bold">Neto (Q)</th>
                                        <th className="py-3 px-4 text-right text-[#d93025]">Pendiente</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-[#f1f3f4]">
                                    {officeStats.filteredOffices.map(item => (
                                        <tr key={item.oficina} className="hover:bg-[#f8fafd]">
                                            <td className="py-2.5 px-4 font-bold text-[#202124] flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-[#202124] text-white rounded-full text-[10px]">
                                                    {item.oficina}
                                                </span>
                                                <span>Oficina {item.oficina}</span>
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-mono text-[#202124]">{formatCurrency(item.currentPaidAmount)}</td>
                                            <td className="py-2.5 px-4 text-right font-mono text-[#f9ab00]">
                                                {item.accumulatedAmount > 0 ? formatCurrency(item.accumulatedAmount) : '-'}
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-mono font-bold text-[#202124] bg-[#f8fafd]">
                                                {formatCurrency(item.totalRevenue)}
                                            </td>
                                            <td className="py-2.5 px-4 text-center">
                                                <span className="px-2.5 py-0.5 rounded-full font-bold bg-green-50 text-[#1e8e3e] border border-green-200 text-xs">
                                                    {getRateLabel(item.commissionRate)}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-mono font-bold text-[#1e8e3e]">
                                                {formatCurrency(item.commissionAmount)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-mono font-bold text-[#1a73e8]">
                                                {formatCurrency(item.netAmount)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-mono text-[#d93025]">
                                                {item.pendingAmount > 0 ? formatCurrency(item.pendingAmount) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-[#f8fafd] font-bold text-[#202124] border-t border-[#dadce0]">
                                    <tr>
                                        <td className="py-3 px-4">TOTALES</td>
                                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(officeStats.totalSelectedCurrentPaid)}</td>
                                        <td className="py-3 px-4 text-right font-mono text-[#f9ab00]">
                                            {officeStats.totalSelectedAccumulated > 0 ? formatCurrency(officeStats.totalSelectedAccumulated) : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-sm">{formatCurrency(officeStats.totalSelectedRevenue)}</td>
                                        <td className="py-3 px-4 text-center text-[#5f6368] text-xs">
                                            {officeStats.totalSelectedRevenue > 0 
                                                ? `${((officeStats.totalSelectedCommission / officeStats.totalSelectedRevenue) * 100).toFixed(1)}%` 
                                                : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-[#1e8e3e]">{formatCurrency(officeStats.totalSelectedCommission)}</td>
                                        <td className="py-3 px-4 text-right font-mono text-[#1a73e8]">{formatCurrency(officeStats.totalSelectedNet)}</td>
                                        <td className="py-3 px-4 text-right font-mono text-[#d93025]">{formatCurrency(officeStats.totalSelectedPending)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            {isConfirmOpen && (
                <ConfirmationModal
                    isOpen={isConfirmOpen}
                    onClose={() => setIsConfirmOpen(false)}
                    onConfirm={handleConfirmDelete}
                    title="Confirmar Eliminación de Acumulado"
                    message="¿Estás seguro de que deseas eliminar todos los datos acumulados? Esta acción restablecerá el reporte acumulado a cero y no se puede deshacer."
                />
            )}
        </div>
    );
};

export default AccumulatedReport;
