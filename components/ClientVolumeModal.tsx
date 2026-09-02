import React, { useState, useMemo, useRef } from 'react';
import { Payment, EstadoPago, Oficina } from '../types';

interface ClientVolumeModalProps {
    isOpen: boolean;
    onClose: () => void;
    payments: Payment[];
    initialMonth: number;
    initialYear: number;
}

const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const formatCurrency = (amount: number) => {
    return `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export type MetricType = 'amount' | 'count' | 'paid' | 'pending';
export type SortOption = 'desc' | 'asc' | 'alpha';

export interface ClientStats {
    cliente: string;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    paymentCount: number;
    paidCount: number;
    pendingCount: number;
    offices: Set<Oficina>;
    latestDate: string;
    averagePerPayment: number;
    percentOfTotal: number;
}

const ClientVolumeModal: React.FC<ClientVolumeModalProps> = ({
    isOpen,
    onClose,
    payments,
    initialMonth,
    initialYear,
}) => {
    const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
    const [selectedYear, setSelectedYear] = useState<number>(initialYear);
    const [metric, setMetric] = useState<MetricType>('amount');
    const [sortBy, setSortBy] = useState<SortOption>('desc');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOffice, setSelectedOffice] = useState<string>('all');
    const [selectedClientForDetail, setSelectedClientForDetail] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
    const [topLimit, setTopLimit] = useState<number | 'all'>('all');

    // Keep initial synced when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setSelectedMonth(initialMonth);
            setSelectedYear(initialYear);
            setSelectedClientForDetail(null);
        }
    }, [isOpen, initialMonth, initialYear]);

    // Filter payments strictly for the selected month & year & office
    const monthPayments = useMemo(() => {
        return payments.filter(p => {
            if (!p.fecha) return false;
            const [y, m] = p.fecha.split('-').map(Number);
            const matchesDate = y === selectedYear && (m - 1) === selectedMonth;
            const matchesOffice = selectedOffice === 'all' || p.oficina === selectedOffice;
            return matchesDate && matchesOffice;
        });
    }, [payments, selectedMonth, selectedYear, selectedOffice]);

    // Aggregate statistics by client
    const { clientStatsList, totalMonthAmount, totalMonthCount, maxMetricValue } = useMemo(() => {
        const map = new Map<string, {
            totalAmount: number;
            paidAmount: number;
            pendingAmount: number;
            paymentCount: number;
            paidCount: number;
            pendingCount: number;
            offices: Set<Oficina>;
            dates: string[];
        }>();

        let monthTotal = 0;
        let monthCount = 0;

        monthPayments.forEach(p => {
            monthTotal += p.monto;
            monthCount += 1;

            const existing = map.get(p.cliente) || {
                totalAmount: 0,
                paidAmount: 0,
                pendingAmount: 0,
                paymentCount: 0,
                paidCount: 0,
                pendingCount: 0,
                offices: new Set<Oficina>(),
                dates: [],
            };

            existing.totalAmount += p.monto;
            existing.paymentCount += 1;
            existing.offices.add(p.oficina);
            existing.dates.push(p.fecha);

            if (p.estado === EstadoPago.Pagado) {
                existing.paidAmount += p.monto;
                existing.paidCount += 1;
            } else {
                existing.pendingAmount += p.monto;
                existing.pendingCount += 1;
            }

            map.set(p.cliente, existing);
        });

        const list: ClientStats[] = Array.from(map.entries()).map(([cliente, data]) => {
            const latestDate = data.dates.sort().reverse()[0] || '';
            const percentOfTotal = monthTotal > 0 ? (data.totalAmount / monthTotal) * 100 : 0;
            const averagePerPayment = data.paymentCount > 0 ? data.totalAmount / data.paymentCount : 0;

            return {
                cliente,
                totalAmount: data.totalAmount,
                paidAmount: data.paidAmount,
                pendingAmount: data.pendingAmount,
                paymentCount: data.paymentCount,
                paidCount: data.paidCount,
                pendingCount: data.pendingCount,
                offices: data.offices,
                latestDate,
                averagePerPayment,
                percentOfTotal,
            };
        });

        // Calculate max metric value for scaling bars
        let maxVal = 1;
        list.forEach(c => {
            const val = metric === 'amount' ? c.totalAmount :
                        metric === 'count' ? c.paymentCount :
                        metric === 'paid' ? c.paidAmount : c.pendingAmount;
            if (val > maxVal) maxVal = val;
        });

        return {
            clientStatsList: list,
            totalMonthAmount: monthTotal,
            totalMonthCount: monthCount,
            maxMetricValue: maxVal,
        };
    }, [monthPayments, metric]);

    // Filter & Sort clients
    const filteredClients = useMemo(() => {
        let result = clientStatsList.filter(c => 
            c.cliente.toLowerCase().includes(searchTerm.toLowerCase().trim())
        );

        result.sort((a, b) => {
            if (sortBy === 'alpha') {
                return a.cliente.localeCompare(b.cliente);
            }
            const valA = metric === 'amount' ? a.totalAmount :
                         metric === 'count' ? a.paymentCount :
                         metric === 'paid' ? a.paidAmount : a.pendingAmount;
            const valB = metric === 'amount' ? b.totalAmount :
                         metric === 'count' ? b.paymentCount :
                         metric === 'paid' ? b.paidAmount : b.pendingAmount;

            return sortBy === 'desc' ? valB - valA : valA - valB;
        });

        if (topLimit !== 'all') {
            result = result.slice(0, topLimit);
        }

        return result;
    }, [clientStatsList, searchTerm, sortBy, metric, topLimit]);

    // Details for single selected client
    const selectedClientPayments = useMemo(() => {
        if (!selectedClientForDetail) return [];
        return monthPayments.filter(p => p.cliente === selectedClientForDetail);
    }, [monthPayments, selectedClientForDetail]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-google-lg w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-[#dadce0] animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="bg-[#f8fafd] border-b border-[#dadce0] px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-blue-50 text-[#1a73e8] flex items-center justify-center font-bold shadow-xs border border-blue-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-[#202124]">Comparativa de Volumen por Cliente</h2>
                            <p className="text-xs text-[#5f6368]">
                                Visualización de pagos realizados en {monthNames[selectedMonth]} {selectedYear}
                            </p>
                        </div>
                    </div>
                    
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#e8eaed] transition"
                        title="Cerrar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Controls Bar */}
                <div className="bg-white border-b border-[#dadce0] px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-sm flex-shrink-0">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Month / Year Selectors */}
                        <div className="flex items-center gap-2 bg-[#f8fafd] px-3.5 py-1.5 rounded-full border border-[#dadce0]">
                            <span className="text-[11px] font-bold text-[#5f6368] uppercase">Periodo:</span>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="font-semibold text-xs text-[#202124] bg-transparent focus:outline-none cursor-pointer"
                            >
                                {monthNames.map((m, i) => (
                                    <option key={i} value={i}>{m}</option>
                                ))}
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="font-semibold text-xs text-[#202124] bg-transparent focus:outline-none cursor-pointer"
                            >
                                {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        {/* Metric Selector Tabs */}
                        <div className="inline-flex bg-[#f1f3f4] p-1 rounded-full border border-[#dadce0]">
                            <button
                                onClick={() => setMetric('amount')}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                                    metric === 'amount' ? 'bg-white text-[#1a73e8] shadow-xs' : 'text-[#5f6368] hover:text-[#202124]'
                                }`}
                            >
                                Monto Total (Q)
                            </button>
                            <button
                                onClick={() => setMetric('count')}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                                    metric === 'count' ? 'bg-white text-[#1a73e8] shadow-xs' : 'text-[#5f6368] hover:text-[#202124]'
                                }`}
                            >
                                Cantidad
                            </button>
                            <button
                                onClick={() => setMetric('paid')}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                                    metric === 'paid' ? 'bg-white text-[#1e8e3e] shadow-xs' : 'text-[#5f6368] hover:text-[#202124]'
                                }`}
                            >
                                Pagado
                            </button>
                            <button
                                onClick={() => setMetric('pending')}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                                    metric === 'pending' ? 'bg-white text-[#d93025] shadow-xs' : 'text-[#5f6368] hover:text-[#202124]'
                                }`}
                            >
                                Pendiente
                            </button>
                        </div>
                    </div>

                    {/* View Switcher & Limit */}
                    <div className="flex items-center gap-2">
                        <div className="flex bg-[#f1f3f4] p-1 rounded-full border border-[#dadce0]">
                            <button
                                onClick={() => setViewMode('chart')}
                                className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-all ${
                                    viewMode === 'chart' ? 'bg-white text-[#1a73e8] shadow-xs' : 'text-[#5f6368] hover:text-[#202124]'
                                }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Gráfico
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-all ${
                                    viewMode === 'table' ? 'bg-white text-[#1a73e8] shadow-xs' : 'text-[#5f6368] hover:text-[#202124]'
                                }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Tabla
                            </button>
                        </div>
                    </div>
                </div>

                {/* Secondary Filters (Search, Office, Sort, Limit) */}
                <div className="bg-[#f8fafd] border-b border-[#dadce0] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search Input */}
                        <div className="relative w-48 sm:w-64">
                            <input
                                type="text"
                                placeholder="Buscar cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#dadce0] rounded-full focus:outline-none focus:ring-1 focus:ring-[#1a73e8] text-xs"
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#5f6368] absolute left-2.5 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Office Selector */}
                        <select
                            value={selectedOffice}
                            onChange={(e) => setSelectedOffice(e.target.value)}
                            className="px-3 py-1.5 border border-[#dadce0] rounded-full bg-white text-[#3c4043] focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                        >
                            <option value="all">Todas las oficinas</option>
                            {Object.values(Oficina).map(o => (
                                <option key={o} value={o}>Oficina {o}</option>
                            ))}
                        </select>

                        {/* Sorting */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="px-3 py-1.5 border border-[#dadce0] rounded-full bg-white text-[#3c4043] focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                        >
                            <option value="desc">Mayor a menor volumen</option>
                            <option value="asc">Menor a mayor volumen</option>
                            <option value="alpha">Alfabético (A - Z)</option>
                        </select>

                        {/* Limit top */}
                        <div className="flex items-center gap-1 text-[#5f6368]">
                            <span>Mostrar:</span>
                            {[5, 10, 'all'].map(lim => (
                                <button
                                    key={lim}
                                    onClick={() => setTopLimit(lim as number | 'all')}
                                    className={`px-2.5 py-0.5 rounded-full font-medium ${
                                        topLimit === lim ? 'bg-[#1a73e8] text-white' : 'hover:bg-[#e8eaed] text-[#3c4043]'
                                    }`}
                                >
                                    {lim === 'all' ? 'Todos' : `Top ${lim}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="text-[#5f6368] font-medium">
                        {filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'}
                    </div>
                </div>

                {/* KPI Overview Cards for the Month */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 bg-[#f8fafd] border-b border-[#dadce0] flex-shrink-0">
                    <div className="bg-white p-3.5 rounded-2xl border border-[#dadce0] shadow-xs">
                        <p className="text-[11px] text-[#5f6368] uppercase font-bold tracking-wider">Total del Mes</p>
                        <p className="text-base font-bold text-[#202124] mt-0.5 font-mono">{formatCurrency(totalMonthAmount)}</p>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-[#dadce0] shadow-xs">
                        <p className="text-[11px] text-[#5f6368] uppercase font-bold tracking-wider">Pagos Realizados</p>
                        <p className="text-base font-bold text-[#1e8e3e] mt-0.5">{totalMonthCount} registros</p>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-[#dadce0] shadow-xs">
                        <p className="text-[11px] text-[#5f6368] uppercase font-bold tracking-wider">Clientes Activos</p>
                        <p className="text-base font-bold text-[#1a73e8] mt-0.5">{clientStatsList.length} clientes</p>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-[#dadce0] shadow-xs">
                        <p className="text-[11px] text-[#5f6368] uppercase font-bold tracking-wider">Promedio por Cliente</p>
                        <p className="text-base font-bold text-[#f9ab00] mt-0.5 font-mono">
                            {formatCurrency(clientStatsList.length > 0 ? totalMonthAmount / clientStatsList.length : 0)}
                        </p>
                    </div>
                </div>

                {/* Main Content Area: Chart or Table */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {filteredClients.length === 0 ? (
                        <div className="py-16 text-center text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-base font-medium text-gray-600">No se encontraron pagos en este periodo con los filtros seleccionados.</p>
                            <p className="text-xs text-gray-400 mt-1">Prueba seleccionando otro mes o modificando los términos de búsqueda.</p>
                        </div>
                    ) : viewMode === 'chart' ? (
                        /* Horizontal Bar Chart Visualizer */
                        <div className="space-y-4">
                            {filteredClients.map((client, index) => {
                                const currentValue = metric === 'amount' ? client.totalAmount :
                                                     metric === 'count' ? client.paymentCount :
                                                     metric === 'paid' ? client.paidAmount : client.pendingAmount;

                                const percentOfMax = maxMetricValue > 0 ? (currentValue / maxMetricValue) * 100 : 0;
                                const isSelected = selectedClientForDetail === client.cliente;

                                // Colors based on metric
                                const barColor = metric === 'paid' ? 'bg-green-500' :
                                                 metric === 'pending' ? 'bg-red-500' :
                                                 metric === 'count' ? 'bg-teal-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600';

                                return (
                                    <div 
                                        key={client.cliente}
                                        onClick={() => setSelectedClientForDetail(isSelected ? null : client.cliente)}
                                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'bg-blue-50/80 border-blue-400 shadow-md ring-2 ring-blue-200' 
                                                : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center space-x-2.5">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                                                    {index + 1}
                                                </span>
                                                <span className="font-semibold text-gray-900 text-sm">
                                                    {client.cliente}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    {Array.from(client.offices).map(o => (
                                                        <span key={o} className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-600 rounded">
                                                            {o}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Values on the right */}
                                            <div className="flex items-center space-x-3 text-right">
                                                <div className="text-right">
                                                    <span className="font-mono font-bold text-sm text-gray-900 block">
                                                        {metric === 'count' 
                                                            ? `${client.paymentCount} ${client.paymentCount === 1 ? 'pago' : 'pagos'}` 
                                                            : formatCurrency(currentValue)}
                                                    </span>
                                                    <span className="text-[11px] text-gray-500 block">
                                                        {client.percentOfTotal.toFixed(1)}% del mes • {client.paymentCount} {client.paymentCount === 1 ? 'servicio' : 'servicios'}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={`p-1 rounded-full ${isSelected ? 'text-blue-600 rotate-180' : 'text-gray-400'} transition-transform`}
                                                    title={isSelected ? 'Ocultar desglose' : 'Ver desglose'}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progressive Progress Bar */}
                                        <div className="w-full bg-gray-100 h-3.5 rounded-full overflow-hidden flex relative">
                                            {metric === 'amount' ? (
                                                /* Multi-color segment: Paid vs Pending */
                                                <>
                                                    <div 
                                                        style={{ width: `${(client.paidAmount / maxMetricValue) * 100}%` }}
                                                        className="bg-green-500 h-full transition-all duration-500"
                                                        title={`Pagado: ${formatCurrency(client.paidAmount)}`}
                                                    />
                                                    <div 
                                                        style={{ width: `${(client.pendingAmount / maxMetricValue) * 100}%` }}
                                                        className="bg-red-400 h-full transition-all duration-500"
                                                        title={`Pendiente: ${formatCurrency(client.pendingAmount)}`}
                                                    />
                                                </>
                                            ) : (
                                                <div
                                                    style={{ width: `${percentOfMax}%` }}
                                                    className={`${barColor} h-full transition-all duration-500 rounded-full`}
                                                />
                                            )}
                                        </div>

                                        {/* Sub-bar Labels */}
                                        <div className="flex justify-between items-center text-[11px] text-gray-500 mt-1 px-0.5">
                                            <span className="flex items-center gap-2">
                                                <span className="inline-flex items-center text-green-700">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-1"></span>
                                                    Pagado: {formatCurrency(client.paidAmount)} ({client.paidCount})
                                                </span>
                                                {client.pendingAmount > 0 && (
                                                    <span className="inline-flex items-center text-red-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block mr-1"></span>
                                                        Pendiente: {formatCurrency(client.pendingAmount)} ({client.pendingCount})
                                                    </span>
                                                )}
                                            </span>
                                            <span>Promedio: {formatCurrency(client.averagePerPayment)}</span>
                                        </div>

                                        {/* Expanded details if selected */}
                                        {isSelected && (
                                            <div className="mt-3 pt-3 border-t border-blue-200 bg-white/70 p-3 rounded-lg text-xs space-y-2">
                                                <p className="font-semibold text-gray-800 flex items-center justify-between">
                                                    <span>Historial detallado de {client.cliente} ({selectedClientPayments.length} registros en {monthNames[selectedMonth]} {selectedYear})</span>
                                                </p>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="text-gray-500 border-b border-gray-200">
                                                                <th className="py-1">Fecha</th>
                                                                <th className="py-1">Oficina</th>
                                                                <th className="py-1">Monto</th>
                                                                <th className="py-1">Estado</th>
                                                                <th className="py-1">Boleta/Pago</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {selectedClientPayments.map(p => (
                                                                <tr key={p.id} className="hover:bg-slate-50">
                                                                    <td className="py-1.5 font-mono">{p.fecha}</td>
                                                                    <td className="py-1.5 font-medium">{p.oficina}</td>
                                                                    <td className="py-1.5 font-mono font-semibold">{formatCurrency(p.monto)}</td>
                                                                    <td className="py-1.5">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                                            p.estado === EstadoPago.Pagado 
                                                                                ? 'bg-green-100 text-green-800' 
                                                                                : 'bg-red-100 text-red-800'
                                                                        }`}>
                                                                            {p.estado}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-1.5 text-gray-600">{p.boleta || p.metodoPago || '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Table Mode */
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-gray-600 font-semibold border-b border-gray-200">
                                    <tr>
                                        <th className="py-3 px-4">#</th>
                                        <th className="py-3 px-4">Cliente</th>
                                        <th className="py-3 px-4 text-center">Oficinas</th>
                                        <th className="py-3 px-4 text-center">N° Pagos</th>
                                        <th className="py-3 px-4 text-right">Pagado</th>
                                        <th className="py-3 px-4 text-right">Pendiente</th>
                                        <th className="py-3 px-4 text-right">Total (Q)</th>
                                        <th className="py-3 px-4 text-right">% Mes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredClients.map((client, idx) => (
                                        <tr key={client.cliente} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4 text-gray-400 font-medium">{idx + 1}</td>
                                            <td className="py-3 px-4 font-semibold text-gray-900">{client.cliente}</td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex justify-center gap-1">
                                                    {Array.from(client.offices).map(o => (
                                                        <span key={o} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-700 font-medium">
                                                            {o}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center font-bold text-gray-700">{client.paymentCount}</td>
                                            <td className="py-3 px-4 text-right font-mono text-green-700">{formatCurrency(client.paidAmount)}</td>
                                            <td className="py-3 px-4 text-right font-mono text-red-600">{formatCurrency(client.pendingAmount)}</td>
                                            <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">{formatCurrency(client.totalAmount)}</td>
                                            <td className="py-3 px-4 text-right font-semibold text-blue-600">{client.percentOfTotal.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-100 font-bold text-gray-900 border-t border-gray-200">
                                    <tr>
                                        <td className="py-3 px-4" colSpan={3}>TOTAL ({filteredClients.length} clientes)</td>
                                        <td className="py-3 px-4 text-center">
                                            {filteredClients.reduce((sum, c) => sum + c.paymentCount, 0)}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-green-700">
                                            {formatCurrency(filteredClients.reduce((sum, c) => sum + c.paidAmount, 0))}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-red-600">
                                            {formatCurrency(filteredClients.reduce((sum, c) => sum + c.pendingAmount, 0))}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono">
                                            {formatCurrency(filteredClients.reduce((sum, c) => sum + c.totalAmount, 0))}
                                        </td>
                                        <td className="py-3 px-4 text-right text-blue-600">100%</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-[#f8fafd] border-t border-[#dadce0] px-6 py-3.5 flex items-center justify-between flex-shrink-0 text-xs">
                    <span className="text-[#5f6368]">
                        {monthNames[selectedMonth]} {selectedYear} • <strong className="text-[#202124]">{totalMonthCount} transacciones procesadas</strong>
                    </span>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-[#dadce0] text-[#3c4043] font-semibold rounded-full hover:bg-[#f1f3f4] transition"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClientVolumeModal;
