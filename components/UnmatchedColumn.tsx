import React from 'react';
import { SheetPaymentRow } from '../services/googleSheetsService';
import { Payment } from '../types';

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
    onDismiss,
}) => {
    if (!isOpen || unmatchedPayments.length === 0) {
        return null;
    }

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, pay: SheetPaymentRow) => {
        const payload = JSON.stringify(pay);
        e.dataTransfer.setData('unmatchedPayment', payload);
        e.dataTransfer.setData('text/plain', payload);
        e.dataTransfer.effectAllowed = 'copyMove';
    };

    return (
        <aside 
            className="w-full bg-white rounded-2xl border border-slate-200 shadow-google-sm p-4 flex flex-col max-h-[calc(100vh-160px)] sticky top-6"
            aria-label="Columna de pagos sin emparejar"
        >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs">
                        {unmatchedPayments.length}
                    </span>
                    <div>
                        <h3 className="font-bold text-sm text-slate-900 leading-tight">
                            Sin Emparejar
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium">
                            Pagos de Excel pendientes de cita
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                    title="Ocultar columna"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Banner instructivo Drag & Drop */}
            <div className="mt-3 mb-3 p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2">
                <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <p className="leading-snug">
                    <strong>Arrastra</strong> una tarjeta y <strong>suéltala</strong> sobre la fila de la cita en la tabla para marcarla como Pagada.
                </p>
            </div>

            {/* Lista de tarjetas arrastrables */}
            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 custom-scrollbar">
                {unmatchedPayments.map((pay, idx) => {
                    const uniqueKey = pay.id || `unmatched-${idx}-${pay.cliente}-${pay.monto}`;

                    return (
                        <div
                            key={uniqueKey}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, pay)}
                            className="p-3 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative select-none"
                            title="Arrastra esta tarjeta sobre la fila de la cita correspondiente en la tabla"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {/* Icono de agarrar */}
                                    <div className="text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M7 4a2 2 0 110-4 2 2 0 010 4zm6 0a2 2 0 110-4 2 2 0 010 4zM7 12a2 2 0 110-4 2 2 0 010 4zm6 0a2 2 0 110-4 2 2 0 010 4zM7 20a2 2 0 110-4 2 2 0 010 4zm6 0a2 2 0 110-4 2 2 0 010 4z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-xs text-slate-900 truncate">
                                            {pay.cliente || 'Cliente sin nombre'}
                                        </h4>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                                            <span className="px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                Q{Number(pay.monto || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                            </span>
                                            {pay.oficina && (
                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                                    Of. {pay.oficina}
                                                </span>
                                            )}
                                            {pay.horas !== undefined && Number(pay.horas) > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                                                    {pay.horas}h
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDismiss(uniqueKey);
                                    }}
                                    title="Descartar este pago de la lista"
                                    className="text-slate-300 hover:text-red-500 p-1 rounded transition cursor-pointer shrink-0"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                                <span className="font-mono">
                                    {(pay.fechaServicio || pay.fechaPago || '').split('T')[0]}
                                </span>
                                {pay.comprobanteUrl && (
                                    <a 
                                        href={pay.comprobanteUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                        <span>Boleta</span>
                                    </a>
                                )}
                            </div>

                            {pay.notas && (
                                <p className="mt-1 text-[11px] text-slate-500 italic truncate" title={pay.notas}>
                                    {pay.notas}
                                </p>
                            )}

                            {/* Indicador sutil de arrastre */}
                            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-center text-[10px] font-semibold text-indigo-600 group-hover:text-indigo-700">
                                <span>Arrastrar a la tabla</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
};
