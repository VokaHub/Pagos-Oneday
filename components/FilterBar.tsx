import React, { useState, useRef, useEffect } from 'react';
import { FilterState, Oficina, EstadoPago, Payment } from '../types';

interface FilterBarProps {
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
    onAddPayment: () => void;
    onExportToExcel: () => void;
    onShowDailyReport: () => void;
    onShowEstimates: () => void;
    onShowClientVolume?: () => void;
    hasFilteredResults: boolean;
    hasPayments: boolean;
    onImportAndAdd: () => void;
    onRotateClient: () => void;
    setRotatingClientIndex: (index: number | null) => void;
    onDeleteAll: () => void;
    onClearFilters: () => void;
    onToggleSort: () => void;
    isSelectionMode: boolean;
    onToggleSelectionMode: () => void;
    isFocusMode?: boolean;
    onToggleFocusMode?: () => void;
    pendingCount?: number;
    paidCount?: number;
    totalCount?: number;
    allPayments?: Payment[];
    unmatchedCount?: number;
    onOpenUnmatched?: () => void;
    onTriggerSync?: () => void;
    isSyncing?: boolean;
    onToggleUnmatchedColumn?: () => void;
    isUnmatchedColumnOpen?: boolean;
}

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const generateYearOptions = (allPayments: Payment[] = []) => {
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set<number>([currentYear, 2025, 2026, 2027]);
    allPayments.forEach(p => {
        const y = parseInt((p.fecha || '').split('-')[0], 10);
        if (!isNaN(y) && y > 2000) yearsSet.add(y);
    });
    for (let i = currentYear + 1; i >= currentYear - 4; i--) {
        yearsSet.add(i);
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
};

const FilterBar: React.FC<FilterBarProps> = ({ 
    filters, 
    setFilters, 
    onAddPayment, 
    onExportToExcel, 
    onShowDailyReport, 
    onShowEstimates, 
    onShowClientVolume,
    hasFilteredResults,
    hasPayments,
    onImportAndAdd,
    onRotateClient,
    setRotatingClientIndex,
    onDeleteAll,
    onClearFilters,
    onToggleSort,
    isSelectionMode,
    onToggleSelectionMode,
    isFocusMode,
    onToggleFocusMode,
    pendingCount,
    paidCount,
    totalCount,
    allPayments = [],
    unmatchedCount = 0,
    onOpenUnmatched,
    onTriggerSync,
    isSyncing = false,
    onToggleUnmatchedColumn,
    isUnmatchedColumnOpen = false,
}) => {
    const [isOfficeDropdownOpen, setIsOfficeDropdownOpen] = useState(false);
    const officeFilterRef = useRef<HTMLDivElement>(null);
    const yearOptions = generateYearOptions(allPayments);

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
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'searchTerm') {
            setRotatingClientIndex(null);
        }
        
        const valueToSet = (name === 'mes' || name === 'año') ? parseInt(value, 10) : value;
        setFilters(prev => ({ ...prev, [name]: valueToSet }));
    };

    const handleOfficeChange = (oficina: Oficina) => {
        setFilters(prev => {
            const newOficinas = prev.oficina.includes(oficina)
                ? prev.oficina.filter(o => o !== oficina)
                : [...prev.oficina, oficina];
            return { ...prev, oficina: newOficinas };
        });
    };

    const handleSelectAllOffices = () => {
        setFilters(prev => ({ ...prev, oficina: Object.values(Oficina) }));
    };

    const handleClearAllOffices = () => {
        setFilters(prev => ({ ...prev, oficina: [] }));
    };

    const getOfficeButtonText = () => {
        const totalOffices = Object.values(Oficina).length;
        const selectedCount = filters.oficina.length;

        if (selectedCount === totalOffices) return 'Todas las oficinas';
        if (selectedCount === 0) return 'Ninguna oficina';
        if (selectedCount === 1) return `Oficina ${filters.oficina[0]}`;
        return `Oficinas (${selectedCount}/${totalOffices})`;
    };

    // Render Streamlined Google-Style Bar in Focus Mode
    if (isFocusMode) {
        return (
            <div className="bg-white p-5 rounded-2xl shadow-google-sm mb-6 border border-slate-200 transition-all">
                {/* Focus Mode Header Banner */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-[#f1f3f4]">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                <circle cx="12" cy="12" r="3" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h3m12 0h3M12 3v3m0 12v3" />
                            </svg>
                        </span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-[#202124] text-base">Modo Enfoque: Conciliación Diaria</h3>
                                <span className="text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                    Vista Limpia
                                </span>
                            </div>
                            <p className="text-xs text-[#5f6368] mt-0.5">
                                Interfaz optimizada con controles de alto confort para validar y cuadrar pagos rápidamente.
                            </p>
                        </div>
                    </div>

                    {/* Quick Counters */}
                    <div className="flex items-center gap-2 text-xs">
                        <span className="px-3 py-1.5 bg-[#f1f3f4] text-[#3c4043] font-semibold rounded-full border border-[#dadce0]">
                            Total: <strong className="text-[#202124]">{totalCount ?? 0}</strong>
                        </span>
                        <span className="px-3 py-1.5 bg-slate-100 text-slate-700 font-semibold rounded-full border border-slate-200">
                            Pendientes: <strong>{pendingCount ?? 0}</strong>
                        </span>
                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 font-semibold rounded-full border border-emerald-200">
                            Pagados: <strong>{paidCount ?? 0}</strong>
                        </span>
                        {onToggleFocusMode && (
                            <button
                                type="button"
                                onClick={onToggleFocusMode}
                                className="ml-1 text-xs font-bold text-[#1a73e8] hover:text-[#174ea6] hover:underline transition"
                                title="Volver a la vista completa"
                            >
                                Salir de enfoque
                            </button>
                        )}
                    </div>
                </div>

                {/* Streamlined controls: Search, Office, Status Quick-Pills & Big Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search by client */}
                    <div className="relative min-w-[240px] flex-1 max-w-sm">
                        <input
                            type="text"
                            name="searchTerm"
                            id="searchTerm"
                            value={filters.searchTerm}
                            onChange={handleInputChange}
                            placeholder="Buscar por cliente..."
                            className="w-full pl-10 pr-8 py-2.5 text-sm bg-[#f8fafd] border border-[#dadce0] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent transition"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-[#5f6368]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        {filters.searchTerm && (
                            <button
                                onClick={() => handleInputChange({ target: { name: 'searchTerm', value: '' } } as any)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#5f6368] hover:text-[#202124]"
                                title="Limpiar búsqueda"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Office Dropdown */}
                    <div className="relative min-w-[190px]" ref={officeFilterRef}>
                        <button
                            type="button"
                            onClick={() => setIsOfficeDropdownOpen(!isOfficeDropdownOpen)}
                            className="w-full px-4 py-2.5 text-sm bg-white text-left border border-[#dadce0] rounded-full shadow-xs focus:outline-none focus:ring-2 focus:ring-[#1a73e8] hover:bg-[#f8fafd] transition flex items-center justify-between"
                        >
                            <span className="truncate font-medium text-[#3c4043]">{getOfficeButtonText()}</span>
                            <svg className={`h-4 w-4 text-[#5f6368] ml-1 transform transition-transform ${isOfficeDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                        {isOfficeDropdownOpen && (
                            <div className="absolute z-20 mt-1.5 w-60 bg-white border border-[#dadce0] rounded-2xl shadow-google-md p-2">
                                <div className="p-1 space-y-1">
                                    {Object.values(Oficina).map(o => (
                                        <label key={o} className="flex items-center space-x-2.5 px-3 py-2 hover:bg-[#f1f3f4] rounded-xl cursor-pointer text-sm font-medium text-[#202124]">
                                            <input
                                                type="checkbox"
                                                checked={filters.oficina.includes(o)}
                                                onChange={() => handleOfficeChange(o)}
                                                className="h-4 w-4 rounded border-[#dadce0] text-[#1a73e8] focus:ring-[#1a73e8]"
                                            />
                                            <span>Oficina {o}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="flex justify-between p-2 border-t border-[#f1f3f4] text-xs font-semibold">
                                    <button onClick={handleSelectAllOffices} className="text-[#1a73e8] hover:underline">Todas</button>
                                    <button onClick={handleClearAllOffices} className="text-[#d93025] hover:underline">Ninguna</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick Status Filter Pills */}
                    <div className="flex items-center bg-[#f1f3f4] p-1 rounded-full border border-[#dadce0] text-xs">
                        <button
                            type="button"
                            onClick={() => setFilters(prev => ({ ...prev, estado: 'todos' }))}
                            className={`px-3.5 py-1.5 rounded-full font-semibold transition ${
                                filters.estado === 'todos'
                                    ? 'bg-white text-[#202124] shadow-xs'
                                    : 'text-[#5f6368] hover:text-[#202124]'
                            }`}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilters(prev => ({ ...prev, estado: EstadoPago.Pendiente }))}
                            className={`px-3.5 py-1.5 rounded-full font-semibold transition flex items-center gap-1.5 ${
                                filters.estado === EstadoPago.Pendiente
                                    ? 'bg-[#ea4335] text-white shadow-xs'
                                    : 'text-[#d93025] hover:bg-white/60'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-current"></span>
                            Pendientes
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilters(prev => ({ ...prev, estado: EstadoPago.Pagado }))}
                            className={`px-3.5 py-1.5 rounded-full font-semibold transition flex items-center gap-1.5 ${
                                filters.estado === EstadoPago.Pagado
                                    ? 'bg-[#1e8e3e] text-white shadow-xs'
                                    : 'text-[#137333] hover:bg-white/60'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-current"></span>
                            Pagados
                        </button>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1 hidden md:block"></div>

                    {/* Big Google-style Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <button 
                            onClick={onAddPayment} 
                            className="px-5 py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm font-semibold rounded-full shadow-google-sm hover:shadow-google-md transition flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span>Agregar Pago</span>
                        </button>

                        <button 
                            onClick={onImportAndAdd} 
                            className="px-4 py-2.5 bg-[#1e8e3e] hover:bg-[#137333] text-white text-sm font-semibold rounded-full shadow-google-sm hover:shadow-google-md transition flex items-center gap-2 cursor-pointer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <span>Importar Citas</span>
                        </button>

                        {/* Botón Trigger para sincronizar y cruzar con Excel bajo demanda */}
                        {onTriggerSync && (
                            <button
                                type="button"
                                onClick={onTriggerSync}
                                disabled={isSyncing}
                                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-full shadow-google-sm hover:shadow-google-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Cruzar citas cargadas contra el backend de Excel y portal"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>{isSyncing ? 'Cruzando con Excel...' : 'Cruzar con Excel'}</span>
                            </button>
                        )}

                        {unmatchedCount > 0 && (
                            <button
                                type="button"
                                onClick={onToggleUnmatchedColumn || onOpenUnmatched}
                                className={`px-4 py-2.5 text-white text-sm font-semibold rounded-full shadow-google-sm hover:shadow-google-md transition flex items-center gap-2 cursor-pointer ${
                                    isUnmatchedColumnOpen 
                                        ? 'bg-indigo-700 ring-2 ring-indigo-300' 
                                        : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                                title="Mostrar columna de pagos de Excel para emparejar"
                            >
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                                <span>Sin Emparejar ({unmatchedCount})</span>
                            </button>
                        )}

                        <button 
                            onClick={onToggleSelectionMode} 
                            className={`px-4 py-2.5 text-sm font-semibold rounded-full shadow-xs transition flex items-center gap-2 ${
                                isSelectionMode 
                                    ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-google-sm' 
                                    : 'bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] border border-[#dadce0]'
                            }`}
                        >
                            {isSelectionMode ? (
                                <>
                                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                   <span>Cancelar</span>
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                    <span>Seleccionar</span>
                                </>
                            )}
                        </button>

                        <button 
                            onClick={onToggleSort} 
                            className="px-4 py-2.5 bg-white text-[#3c4043] border border-[#dadce0] hover:bg-[#f8fafd] text-sm font-medium rounded-full shadow-xs transition flex items-center gap-2"
                            title="Cambiar ordenación"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#5f6368]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                            </svg>
                            <span>{filters.sortBy === 'date' ? 'Fecha' : filters.sortBy === 'client-asc' ? 'A-Z' : 'Z-A'}</span>
                        </button>

                        <button 
                            onClick={onExportToExcel} 
                            disabled={!hasFilteredResults} 
                            className="px-4 py-2.5 bg-[#0f9d58] hover:bg-[#0b8043] text-white text-sm font-semibold rounded-full shadow-google-sm disabled:opacity-40 disabled:hover:bg-[#0f9d58] disabled:cursor-not-allowed transition flex items-center gap-2"
                            title="Exportar registros filtrados a Excel"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Excel</span>
                        </button>

                        {(filters.searchTerm || filters.oficina.length < Object.values(Oficina).length || filters.estado !== 'todos') && (
                            <button 
                                onClick={onClearFilters} 
                                className="px-3.5 py-2.5 text-[#5f6368] hover:text-[#d93025] hover:bg-red-50 text-sm font-medium rounded-full transition flex items-center gap-1.5"
                                title="Limpiar filtros activos"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Limpiar</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Normal View: Clean Google Workspace Filter & Action Bar
    return (
        <div className="bg-white p-5 rounded-2xl shadow-google-sm mb-6 border border-[#e0e3e7]">
            {/* Input Filters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3.5 items-end">
                {/* Search Input with Rotator */}
                <div className="sm:col-span-2 lg:col-span-2">
                    <label htmlFor="searchTerm" className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1.5">
                        Buscar por Cliente
                    </label>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                name="searchTerm"
                                id="searchTerm"
                                value={filters.searchTerm}
                                onChange={handleInputChange}
                                placeholder="Nombre del cliente..."
                                className="w-full pl-10 pr-8 py-2.5 text-sm bg-[#f8fafd] border border-[#dadce0] rounded-xl shadow-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent transition"
                            />
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-[#5f6368]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            {filters.searchTerm && (
                                <button
                                    onClick={() => handleInputChange({ target: { name: 'searchTerm', value: '' } } as any)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#5f6368] hover:text-[#202124]"
                                    title="Limpiar búsqueda"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <button 
                            onClick={onRotateClient} 
                            title="Rotar automáticamente entre clientes con registros" 
                            className="p-2.5 bg-[#f1f3f4] text-[#3c4043] rounded-xl hover:bg-[#e8eaed] transition flex items-center justify-center border border-[#dadce0] shadow-xs"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 4l16 16" transform="rotate(90 12 12)" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Office Filter */}
                <div className="relative" ref={officeFilterRef}>
                    <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1.5">
                        Oficina
                    </label>
                    <button
                        type="button"
                        onClick={() => setIsOfficeDropdownOpen(!isOfficeDropdownOpen)}
                        className="w-full px-3.5 py-2.5 bg-white text-left text-sm font-medium text-[#3c4043] border border-[#dadce0] rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-[#1a73e8] hover:bg-[#f8fafd] transition flex items-center justify-between"
                    >
                        <span className="truncate">{getOfficeButtonText()}</span>
                        <svg className={`h-4 w-4 text-[#5f6368] transform transition-transform ${isOfficeDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                    {isOfficeDropdownOpen && (
                        <div className="absolute z-20 mt-1.5 w-60 bg-white border border-[#dadce0] rounded-2xl shadow-google-md p-2">
                            <div className="p-1 space-y-1">
                                {Object.values(Oficina).map(o => (
                                    <label key={o} className="flex items-center space-x-2.5 px-3 py-2 hover:bg-[#f1f3f4] rounded-xl cursor-pointer text-sm font-medium text-[#202124]">
                                        <input
                                            type="checkbox"
                                            checked={filters.oficina.includes(o)}
                                            onChange={() => handleOfficeChange(o)}
                                            className="h-4 w-4 rounded border-[#dadce0] text-[#1a73e8] focus:ring-[#1a73e8]"
                                        />
                                        <span>Oficina {o}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="flex justify-between p-2 border-t border-[#f1f3f4] text-xs font-semibold">
                                <button onClick={handleSelectAllOffices} className="text-[#1a73e8] hover:underline">Todas</button>
                                <button onClick={handleClearAllOffices} className="text-[#d93025] hover:underline">Ninguna</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Mes */}
                <div>
                    <label htmlFor="mes" className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1.5">
                        Mes
                    </label>
                    <select 
                        name="mes" 
                        id="mes" 
                        value={filters.mes} 
                        onChange={handleInputChange} 
                        className="w-full px-3 py-2.5 bg-white text-sm font-medium text-[#3c4043] border border-[#dadce0] rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition"
                    >
                        <option value={-1}>Todos los meses</option>
                        {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                </div>

                {/* Año */}
                <div>
                    <label htmlFor="año" className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1.5">
                        Año
                    </label>
                    <select 
                        name="año" 
                        id="año" 
                        value={filters.año} 
                        onChange={handleInputChange} 
                        className="w-full px-3 py-2.5 bg-white text-sm font-medium text-[#3c4043] border border-[#dadce0] rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition"
                    >
                        <option value={0}>Todos los años</option>
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                {/* Fecha Servicio */}
                <div>
                    <label htmlFor="fecha" className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1.5">
                        Fecha Servicio
                    </label>
                    <input
                        type="date"
                        name="fecha"
                        id="fecha"
                        value={filters.fecha}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white text-sm text-[#3c4043] border border-[#dadce0] rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition"
                    />
                </div>

                {/* Estado */}
                <div>
                    <label htmlFor="estado" className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1.5">
                        Estado
                    </label>
                    <select 
                        name="estado" 
                        id="estado" 
                        value={filters.estado} 
                        onChange={handleInputChange} 
                        className="w-full px-3 py-2.5 bg-white text-sm font-medium text-[#3c4043] border border-[#dadce0] rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition"
                    >
                        <option value="todos">Todos</option>
                        {Object.values(EstadoPago).map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                </div>
            </div>

            {/* Google-Style Generous Action Buttons Toolbar */}
            <div className="mt-5 pt-4 border-t border-[#f1f3f4] flex flex-wrap gap-2.5 items-center justify-start">
                {/* Primary Group */}
                <button 
                    onClick={onAddPayment} 
                    className="px-5 py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm font-semibold rounded-full shadow-google-sm hover:shadow-google-md transition flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Agregar Pago</span>
                </button>

                <button 
                    onClick={onImportAndAdd} 
                    className="px-4 py-2.5 bg-[#1e8e3e] hover:bg-[#137333] text-white text-sm font-semibold rounded-full shadow-google-sm hover:shadow-google-md transition flex items-center gap-2 cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Importar y Añadir</span>
                </button>

                {onTriggerSync && (
                    <button
                        type="button"
                        onClick={onTriggerSync}
                        disabled={isSyncing}
                        className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-full shadow-google-sm hover:shadow-google-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        title="Cruzar citas cargadas contra el backend de Excel"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>{isSyncing ? 'Cruzando...' : 'Cruzar con Excel'}</span>
                    </button>
                )}

                {unmatchedCount > 0 && (
                    <button
                        type="button"
                        onClick={onToggleUnmatchedColumn || onOpenUnmatched}
                        className={`px-4 py-2.5 text-white text-sm font-semibold rounded-full shadow-google-sm hover:shadow-google-md transition flex items-center gap-2 cursor-pointer ${
                            isUnmatchedColumnOpen 
                                ? 'bg-indigo-700 ring-2 ring-indigo-300' 
                                : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                        title="Ver pagos de Excel sin emparejar con citas"
                    >
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                        <span>Sin Emparejar ({unmatchedCount})</span>
                    </button>
                )}

                <button 
                    onClick={onToggleSelectionMode} 
                    className={`px-4 py-2.5 text-sm font-semibold rounded-full shadow-xs transition flex items-center gap-2 ${
                        isSelectionMode 
                            ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-google-sm' 
                            : 'bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] border border-[#dadce0]'
                    }`}
                >
                    {isSelectionMode ? (
                        <>
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                           <span>Cancelar Selección</span>
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                            <span>Seleccionar</span>
                        </>
                    )}
                </button>

                <button 
                    onClick={onToggleSort} 
                    className="px-4 py-2.5 bg-white text-[#3c4043] border border-[#dadce0] hover:bg-[#f8fafd] text-sm font-medium rounded-full shadow-xs transition flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#5f6368]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    <span>{filters.sortBy === 'date' ? 'Ordenar: Fecha' : filters.sortBy === 'client-asc' ? 'Ordenar: A-Z' : 'Ordenar: Z-A'}</span>
                </button>

                {/* Secondary Analytical Group */}
                {onShowClientVolume && (
                    <button 
                        onClick={onShowClientVolume} 
                        className="px-4 py-2.5 bg-white text-[#1a73e8] border border-blue-200 hover:bg-blue-50 text-sm font-semibold rounded-full shadow-xs transition flex items-center gap-2"
                        title="Ver comparativa de volumen de pagos por cliente"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>Gráfico Clientes</span>
                    </button>
                )}

                <button 
                    onClick={onShowDailyReport} 
                    className="px-4 py-2.5 bg-white text-[#5f6368] border border-[#dadce0] hover:bg-[#f8fafd] hover:text-[#202124] text-sm font-medium rounded-full shadow-xs transition flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#5f6368]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Resumen Diario</span>
                </button>

                <button 
                    onClick={onShowEstimates} 
                    className="px-4 py-2.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-sm font-semibold rounded-full shadow-xs transition flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>Estimación</span>
                </button>

                <button 
                    onClick={onExportToExcel} 
                    disabled={!hasFilteredResults} 
                    className="px-4 py-2.5 bg-[#0f9d58] hover:bg-[#0b8043] text-white text-sm font-semibold rounded-full shadow-google-sm disabled:opacity-40 disabled:hover:bg-[#0f9d58] disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Excel</span>
                </button>

                <div className="flex-grow"></div>

                {/* Clean & Danger Actions */}
                <button 
                    onClick={onClearFilters} 
                    className="px-3.5 py-2.5 text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] text-sm font-medium rounded-full transition flex items-center gap-1.5"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Limpiar</span>
                </button>

                <button 
                    onClick={onDeleteAll} 
                    disabled={!hasPayments}
                    className="px-4 py-2.5 text-[#d93025] hover:bg-red-50 text-sm font-semibold rounded-full border border-red-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Eliminar Todo</span>
                </button>
            </div>
        </div>
    );
};

export default FilterBar;
