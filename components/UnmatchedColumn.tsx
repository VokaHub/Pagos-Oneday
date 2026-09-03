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
        <div className="fixed inset-0 z-50 overflow-hidden">
            <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
                onClick={onClose} 
            />
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-8">
                <aside 
                    className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 p-5 flex flex-col h-full animate-in slide-in-from-right duration-200"
                    aria-label="Panel de pagos de Excel sin emparejar"
                >
                    {/* Header del panel */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs">
                                {unmatchedPayments.length}
                            </span>
                            <div>
                                <h3 className="font-bold text-sm text-slate-900 leading-tight">
                                    Pagos de Excel sin Emparejar
                                </h3>
                                <p className="text-[11px] text-slate-500 font-medium">
                                    Asigne cada pago a su cita correspondiente
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            title="Cerrar panel"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Banner instructivo */}
                    <div className="mt-3 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                        <p>
                            Seleccione la cita correspondiente en el menú desplegable de cada registro para marcarla como Pagada.
                        </p>
                    </div>

                    {/* Lista de tarjetas */}
                    <div className="overflow-y-auto space-y-3 flex-1 pr-1">
                        {unmatchedPayments.map((pay, idx) => {
                            const uniqueKey = pay.id || `unmatched-${idx}-${pay.cliente}-${pay.monto}`;
                            const targetAptId = selectedAptForPayment[uniqueKey] || '';

                            return (
                                <div
                                    key={uniqueKey}
                                    className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all group relative"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-sm text-slate-900 truncate" title={pay.cliente}>
                                                {pay.cliente}
                                            </h4>
                                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                                                <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
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
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Comprobante link */}
                                    {pay.comprobanteUrl && (
                                        <div className="mt-2 flex items-center justify-between">
                                            <a 
                                                href={pay.comprobanteUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                </svg>
                                                <span>Ver Comprobante</span>
                                            </a>
                                        </div>
                                    )}

                                    {/* Selector directo de asignación */}
                                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2">
                                        <select
                                            value={targetAptId}
                                            onChange={(e) => setSelectedAptForPayment(prev => ({ ...prev, [uniqueKey]: e.target.value }))}
                                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 flex-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
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
            </div>
        </div>
    );
};
