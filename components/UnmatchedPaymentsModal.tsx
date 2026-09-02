import React, { useState, useMemo } from 'react';
import { SheetPaymentRow } from '../services/googleSheetsService';
import { Payment, EstadoPago } from '../types';

interface UnmatchedPaymentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    unmatchedPayments: SheetPaymentRow[];
    appointments: Payment[];
    onMatchPayment: (unmatched: SheetPaymentRow, appointmentId: string) => void;
    onDismissPayment: (unmatchedKey: string) => void;
    onViewProof?: (url: string) => void;
}

const normalize = (text: string) => {
    return (text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

export const UnmatchedPaymentsModal: React.FC<UnmatchedPaymentsModalProps> = ({
    isOpen,
    onClose,
    unmatchedPayments,
    appointments,
    onMatchPayment,
    onDismissPayment,
    onViewProof,
}) => {
    const [selectedUnmatched, setSelectedUnmatched] = useState<SheetPaymentRow | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOnlyPending, setFilterOnlyPending] = useState(true);

    // If modal is closed, don't render
    if (!isOpen) return null;

    // Filter appointments for matching
    const candidateAppointments = useMemo(() => {
        const term = normalize(searchTerm);
        return appointments.filter(apt => {
            if (filterOnlyPending && apt.estado === EstadoPago.Pagado) {
                return false;
            }
            if (!term) return true;
            const clientNorm = normalize(apt.cliente);
            const officeNorm = normalize(apt.oficina);
            const boletaNorm = normalize(apt.boleta || '');
            const phoneNorm = (apt.telefono || '').replace(/\D/g, '');
            return clientNorm.includes(term) || officeNorm.includes(term) || boletaNorm.includes(term) || (phoneNorm && phoneNorm.includes(term));
        }).sort((a, b) => {
            // Prioritize similar name if an unmatched payment is selected
            if (selectedUnmatched) {
                const unmatchedName = normalize(selectedUnmatched.cliente || '');
                const aName = normalize(a.cliente);
                const bName = normalize(b.cliente);
                if (aName.includes(unmatchedName) || unmatchedName.includes(aName)) return -1;
                if (bName.includes(unmatchedName) || unmatchedName.includes(bName)) return 1;
            }
            return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });
    }, [appointments, searchTerm, filterOnlyPending, selectedUnmatched]);

    const handleConfirmMatch = (appointmentId: string) => {
        if (!selectedUnmatched) return;
        onMatchPayment(selectedUnmatched, appointmentId);
        setSelectedUnmatched(null);
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
            <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-bold text-lg text-white">
                            {unmatchedPayments.length}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight">
                                Pagos de Excel / Sheets Pendientes de Emparejar
                            </h2>
                            <p className="text-xs text-amber-100">
                                Registros leídos de Excel que no coincidieron automáticamente. Empareja cada pago con su cita existente.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-white/20 text-white transition"
                        title="Cerrar ventana"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 bg-[#f8fafd]">
                    {unmatchedPayments.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-base font-bold text-slate-800">¡No hay pagos pendientes!</h3>
                            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                                Todos los pagos registrados en Excel coinciden con citas existentes o han sido conciliados exitosamente.
                            </p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="mt-5 px-5 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-bold rounded-xl transition"
                            >
                                Volver al Control de Pagos
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Step Indicator when picking an appointment */}
                            {selectedUnmatched && (
                                <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                                            <span>🔗 Emparejando pago de:</span>
                                            <span className="underline">{selectedUnmatched.cliente}</span>
                                            <span className="text-xs bg-amber-200 px-2 py-0.5 rounded-full">
                                                Q {Number(selectedUnmatched.monto || 0).toFixed(2)} - Of. {selectedUnmatched.oficina || 'N/A'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedUnmatched(null)}
                                            className="text-xs text-amber-800 hover:text-amber-950 font-semibold underline"
                                        >
                                            Cancelar emparejamiento
                                        </button>
                                    </div>
                                    <p className="text-xs text-amber-800">
                                        Selecciona abajo la cita correspondiente a la que deseas aplicar este pago. La cita pasará inmediatamente a estado <strong>PAGADO</strong> sin alterar ni duplicar registros.
                                    </p>

                                    {/* Appointment Search & Filter */}
                                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                                        <div className="relative flex-1 min-w-[200px]">
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Buscar cita por cliente, oficina o boleta..."
                                                className="w-full pl-8 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            />
                                            <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={filterOnlyPending}
                                                onChange={(e) => setFilterOnlyPending(e.target.checked)}
                                                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                            />
                                            <span>Mostrar solo citas pendientes</span>
                                        </label>
                                    </div>

                                    {/* Candidate list */}
                                    <div className="mt-3 max-h-56 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
                                        {candidateAppointments.length === 0 ? (
                                            <p className="p-3 text-xs text-slate-500 text-center">
                                                No se encontraron citas con esos criterios.
                                            </p>
                                        ) : (
                                            candidateAppointments.map(apt => (
                                                <div
                                                    key={apt.id}
                                                    className="p-3 flex items-center justify-between hover:bg-slate-50 transition"
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-slate-900 text-xs">{apt.cliente}</span>
                                                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                                                                Of. {apt.oficina}
                                                            </span>
                                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                                                apt.estado === EstadoPago.Pagado ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                                            }`}>
                                                                {apt.estado}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 mt-0.5 flex gap-3">
                                                            <span>Fecha servicio: {apt.fecha}</span>
                                                            <span className="font-mono font-bold text-slate-700">Q {Number(apt.monto).toFixed(2)}</span>
                                                            {apt.telefono && <span>📞 {apt.telefono}</span>}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleConfirmMatch(apt.id)}
                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-xs"
                                                    >
                                                        <span>✓ Asignar a esta cita</span>
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Unmatched Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {unmatchedPayments.map((p, idx) => {
                                    const key = p.id || `unmatched-${idx}-${p.cliente}-${p.monto}`;
                                    const isSelected = selectedUnmatched === p;

                                    return (
                                        <div
                                            key={key}
                                            className={`p-4 bg-white rounded-xl border transition shadow-xs ${
                                                isSelected
                                                    ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-50/20'
                                                    : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-slate-900 text-sm">{p.cliente || 'Cliente no especificado'}</h4>
                                                        {p.oficina && (
                                                            <span className="text-xs bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded-md border border-slate-200">
                                                                Of. {p.oficina}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                                                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                            Q {Number(p.monto || 0).toFixed(2)}
                                                        </span>
                                                        {p.fechaPago && (
                                                            <span>Pago: <strong>{p.fechaPago}</strong></span>
                                                        )}
                                                        {p.fechaServicio && (
                                                            <span>Servicio: <strong>{p.fechaServicio}</strong></span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => onDismissPayment(key)}
                                                    title="Descartar este registro de la lista"
                                                    className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-slate-100 transition"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>

                                            {/* Details & Proof */}
                                            <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                                                {p.metodoPago && (
                                                    <div>Método: <span className="text-slate-700">{p.metodoPago}</span></div>
                                                )}
                                                {p.notas && (
                                                    <div className="italic text-slate-600">Nota: "{p.notas}"</div>
                                                )}
                                                {p.comprobanteUrl && (
                                                    <div className="pt-1">
                                                        <a
                                                            href={p.comprobanteUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-[#1a73e8] hover:underline font-semibold"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                            <span>Ver Comprobante</span>
                                                        </a>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Button */}
                                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedUnmatched(p);
                                                        setSearchTerm(p.cliente || '');
                                                    }}
                                                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center justify-center gap-1.5"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                    </svg>
                                                    <span>Emparejar con Cita Existente</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                        Total sin emparejar: <strong className="text-slate-800">{unmatchedPayments.length}</strong>
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
