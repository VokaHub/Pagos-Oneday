import React, { useState } from 'react';
import { SheetPaymentRow } from '../services/googleSheetsService';
import { Payment, EstadoPago } from '../types';

interface UnmatchedColumnProps {
    isOpen: boolean;
    onClose: () => void;
    unmatchedPayments: SheetPaymentRow[];
    appointments: Payment[];
    onMatch: (unmatched: SheetPaymentRow, appointmentId: string) => void;
    onDismiss: (unmatchedKey: string) => void;
}

export const UnmatchedColumn: React.FC<UnmatchedColumnProps> = ({
    isOpen,
    onClose,
    unmatchedPayments,
    appointments,
    onMatch,
    onDismiss,
}) => {
    const [selectedAptForPayment, setSelectedAptForPayment] = useState<{ [key: string]: string }>({});

    if (!isOpen || unmatchedPayments.length === 0) {
        return null;
    }

    const pendingAppointments = appointments.filter(a => a.estado === EstadoPago.Pendiente);

    return (
        <aside 
            className="w-full lg:w-80 xl:w-96 shrink-0 bg-white rounded-2xl border border-amber-300 shadow-google-md p-4 flex flex-col max-h-[85vh] sticky top-20 z-20 animate-in slide-in-from-right duration-200"
            aria-label="Columna de pagos de Excel sin emparejar"
        >
            {/* Header de la columna */}
            <div className="flex items-center justify-between pb-3 border-b border-amber-200">
                <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500 text-white font-bold text-xs shadow-xs">
                        {unmatchedPayments.length}
                    </span>
                    <div>
                        <h3 className="font-bold text-sm text-slate-800 leading-tight">
                            Pagos de Excel por Emparejar
                        </h3>
                        <p className="text-[11px] text-amber-800 font-medium">
                            Arrastra a una fila o usa el botón
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                    title="Cerrar columna"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Banner instructivo */}
            <div className="mt-2.5 mb-3 p-2 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                <span className="text-sm">👆</span>
                <p>
                    <strong>Drag & Drop:</strong> Arrastra cualquier tarjeta hacia una fila de la tabla de citas para marcarla como Pagada.
                </p>
            </div>

            {/* Lista de tarjetas arrastrables */}
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
                {unmatchedPayments.map((pay, idx) => {
                    const uniqueKey = pay.id || `unmatched-${idx}-${pay.cliente}-${pay.monto}`;
                    const targetAptId = selectedAptForPayment[uniqueKey] || '';

                    return (
                        <div
                            key={uniqueKey}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('unmatchedPayment', JSON.stringify(pay));
                                e.dataTransfer.setData('text/plain', pay.cliente);
                                e.dataTransfer.effectAllowed = 'copyMove';
                            }}
                            className="p-3 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-500 hover:shadow-google-sm transition-all cursor-grab active:cursor-grabbing group relative"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="cursor-grab text-slate-400 group-hover:text-amber-600 text-xs select-none">
                                            ⋮⋮
                                        </span>
                                        <h4 className="font-bold text-sm text-slate-900 truncate" title={pay.cliente}>
                                            {pay.cliente}
                                        </h4>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                        <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-emerald-100 text-emerald-800">
                                            Q{Number(pay.monto || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                        </span>
                                        {pay.oficina && (
                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                                                Of. {pay.oficina}
                                            </span>
                                        )}
                                        {pay.fechaServicio && (
                                            <span className="text-[11px] text-slate-500 font-mono">
                                                {pay.fechaServicio.split('T')[0]}
                                            </span>
                                        )}
                                    </div>
                                    {pay.notas && (
                                        <p className="mt-1 text-[11px] text-slate-500 italic truncate" title={pay.notas}>
                                            {pay.notas}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => onDismiss(uniqueKey)}
                                    title="Descartar este pago de la lista"
                                    className="text-slate-300 hover:text-red-500 p-1 rounded transition cursor-pointer"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>

                            {/* Comprobante link / preview */}
                            {pay.comprobanteUrl && (
                                <div className="mt-2 flex items-center justify-between">
                                    <a 
                                        href={pay.comprobanteUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-purple-700 hover:text-purple-900 font-semibold underline flex items-center gap-1"
                                    >
                                        <span>📎 Ver Comprobante</span>
                                    </a>
                                </div>
                            )}

                            {/* Selector directo de asignación */}
                            <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center gap-1.5">
                                <select
                                    value={targetAptId}
                                    onChange={(e) => setSelectedAptForPayment(prev => ({ ...prev, [uniqueKey]: e.target.value }))}
                                    className="text-[11px] px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 flex-1 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                >
                                    <option value="">Seleccionar cita...</option>
                                    {pendingAppointments.map(apt => (
                                        <option key={apt.id} value={apt.id}>
                                            {apt.cliente} ({apt.fecha}) - Q{apt.monto}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    disabled={!targetAptId}
                                    onClick={() => {
                                        if (targetAptId) {
                                            onMatch(pay, targetAptId);
                                        }
                                    }}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg shadow-xs transition cursor-pointer"
                                    title="Asignar este pago a la cita seleccionada"
                                >
                                    Emparejar
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
};
