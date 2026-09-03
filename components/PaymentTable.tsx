import React, { useState, useMemo } from 'react';
import { Payment, EstadoPago } from '../types';

interface PaymentTableProps {
    payments: Payment[];
    onEdit: (payment: Payment) => void;
    onDelete: (id: string) => void;
    onToggleStatus: (id: string) => void;
    onToggleReviewed: (id: string) => void;
    onMerge: (draggedId: string, targetId: string) => void;
    onViewImage: (payment: Payment) => void;
    isSelectionMode: boolean;
    selectedIds: Set<string>;
    onSelectPayment: (id: string) => void;
    onSelectAll: () => void;
    onUpdatePayment?: (id: string, updates: Partial<Payment>) => void;
    onMatchUnmatched?: (unmatched: any, targetAppointmentId: string) => void;
}

const formatDateForDisplay = (isoDate: string): string => {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return isoDate;
    }
    const [year, month, day] = isoDate.split('-');
    return `${day}-${month}-${year}`;
};

const WhatsAppIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.956-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01s-.521.074-.792.372c-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
);

const PaymentTable: React.FC<PaymentTableProps> = ({ 
    payments, 
    onEdit, 
    onDelete, 
    onToggleStatus, 
    onToggleReviewed, 
    onMerge, 
    onViewImage,
    isSelectionMode,
    selectedIds,
    onSelectPayment,
    onSelectAll,
    onUpdatePayment,
    onMatchUnmatched
}) => {
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTargetInfo, setDropTargetInfo] = useState<{ id: string; isValid: boolean; isUnmatched?: boolean } | null>(null);

    const handleWhatsAppClick = (p: Payment) => {
        let rawPhone = p.telefono;
        if (!rawPhone || !rawPhone.trim()) {
            const input = window.prompt(`Ingrese el número de teléfono o WhatsApp de ${p.cliente} (ej. 55551234):`);
            if (!input || !input.trim()) return;
            rawPhone = input.trim();
            if (onUpdatePayment) {
                onUpdatePayment(p.id, { telefono: rawPhone });
            }
        }
        let digits = rawPhone.replace(/\D/g, '');
        if (digits.length === 8) {
            digits = `502${digits}`;
        }
        const message = encodeURIComponent(`Hola ${p.cliente}, le saludamos de ONEDAY Spaces respecto a su reservación en la oficina ${p.oficina}.`);
        window.open(`https://wa.me/${digits}?text=${message}`, '_blank');
    };

    const draggedPayment = useMemo(() => {
        if (!draggedId) return null;
        return payments.find(p => p.id === draggedId);
    }, [draggedId, payments]);
    
    const formatCurrency = (amount: number) => {
        return `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const statusBadge = (status: EstadoPago) => {
        const baseClasses = "px-3 py-1 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 shadow-xs";
        switch (status) {
            case EstadoPago.Pagado:
                return (
                    <span className={`${baseClasses} bg-emerald-50 text-emerald-800 border border-emerald-200`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        Pagado
                    </span>
                );
            case EstadoPago.Pendiente:
                return (
                    <span className={`${baseClasses} bg-red-50 text-red-800 border border-red-200`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                        Pendiente
                    </span>
                );
            case EstadoPago.PlanMensual:
                return (
                    <span className={`${baseClasses} bg-violet-50 text-violet-800 border border-violet-200`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-600"></span>
                        Plan Mensual
                    </span>
                );
            case EstadoPago.CreditoMensual:
                return (
                    <span className={`${baseClasses} bg-blue-50 text-blue-800 border border-blue-200`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        Crédito Mensual
                    </span>
                );
            default:
                return (
                    <span className={`${baseClasses} bg-gray-100 text-gray-800 border border-gray-200`}>
                        {status}
                    </span>
                );
        }
    };

    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, payment: Payment) => {
        if (isSelectionMode) return;
        e.dataTransfer.setData('paymentId', payment.id);
        e.dataTransfer.effectAllowed = 'move';
        setDraggedId(payment.id);
    };

    const handleDragEnter = (e: React.DragEvent<HTMLTableRowElement>, targetPayment: Payment) => {
        e.preventDefault();
        if (isSelectionMode) return;
        
        // Si se está arrastrando una tarjeta de pago de Excel huérfano
        const hasUnmatched = e.dataTransfer.types.includes('unmatchedpayment') || e.dataTransfer.types.includes('text/plain');
        if (hasUnmatched || !draggedId) {
            setDropTargetInfo({ id: targetPayment.id, isValid: true, isUnmatched: true });
            return;
        }

        if (!draggedPayment || draggedPayment.id === targetPayment.id) {
            setDropTargetInfo(null);
            return;
        }
        const isValid = draggedPayment.cliente === targetPayment.cliente && draggedPayment.oficina === targetPayment.oficina && draggedPayment.fecha === targetPayment.fecha;
        setDropTargetInfo({ id: targetPayment.id, isValid, isUnmatched: false });
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, targetPayment: Payment) => {
        e.preventDefault();
        if (isSelectionMode) return;

        // 1. ¿Se soltó un pago huérfano de Excel sobre esta cita?
        const rawUnmatched = e.dataTransfer.getData('unmatchedPayment');
        if (rawUnmatched && onMatchUnmatched) {
            try {
                const unmatchedObj = JSON.parse(rawUnmatched);
                onMatchUnmatched(unmatchedObj, targetPayment.id);
            } catch (err) {
                console.error('Error parseando pago huérfano arrastrado:', err);
            }
            setDraggedId(null);
            setDropTargetInfo(null);
            return;
        }

        // 2. O es una fusión de citas existentes
        if (dropTargetInfo?.isValid) {
            const droppedPaymentId = e.dataTransfer.getData('paymentId');
            if (droppedPaymentId && droppedPaymentId !== targetPayment.id) {
                onMerge(droppedPaymentId, targetPayment.id);
            }
        }
        setDraggedId(null);
        setDropTargetInfo(null);
    };

    const handleDragEnd = () => {
        setDraggedId(null);
        setDropTargetInfo(null);
    };

    const getStatusButtonProps = (estado: EstadoPago) => {
        switch (estado) {
            case EstadoPago.Pendiente:
                return {
                    title: 'Marcar como Pagado',
                    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                    className: 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50',
                };
            case EstadoPago.Pagado:
                return {
                    title: 'Marcar como Plan Mensual',
                    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
                    className: 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50',
                };
            case EstadoPago.PlanMensual:
                return {
                    title: 'Marcar como Crédito Mensual',
                    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
                    className: 'text-purple-600 hover:text-purple-700 hover:bg-purple-50',
                };
            case EstadoPago.CreditoMensual:
                return {
                    title: 'Marcar como Pendiente',
                    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
                    className: 'text-rose-600 hover:text-rose-700 hover:bg-rose-50',
                };
            default:
                return { title: '', icon: null, className: '' };
        }
    };
    
    return (
        <div className="bg-white shadow-google-sm rounded-2xl border border-[#e0e3e7] overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-sm text-left text-[#3c4043]">
                    <thead className="bg-[#f8fafd] text-[11px] font-bold text-[#5f6368] uppercase tracking-wider border-b border-[#e0e3e7]">
                        <tr>
                            {isSelectionMode && (
                                <th scope="col" className="px-5 py-3.5 w-10">
                                    <input 
                                        type="checkbox" 
                                        className="h-4 w-4 rounded border-[#dadce0] text-[#1a73e8] focus:ring-[#1a73e8]"
                                        checked={payments.length > 0 && selectedIds.size === payments.length}
                                        onChange={onSelectAll}
                                    />
                                </th>
                            )}
                            <th scope="col" className="px-5 py-3.5">Cliente</th>
                            <th scope="col" className="px-5 py-3.5">ID Registro</th>
                            <th scope="col" className="px-5 py-3.5">Teléfono</th>
                            <th scope="col" className="px-5 py-3.5">Oficina</th>
                            <th scope="col" className="px-5 py-3.5">Monto</th>
                            <th scope="col" className="px-5 py-3.5">Fecha</th>
                            <th scope="col" className="px-5 py-3.5">Boleta</th>
                            <th scope="col" className="px-5 py-3.5">Estado</th>
                            {!isSelectionMode && <th scope="col" className="px-5 py-3.5 text-center">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f3f4]">
                        {payments.length === 0 ? (
                            <tr>
                                <td colSpan={isSelectionMode ? 10 : 9} className="text-center py-12 text-[#5f6368]">
                                    <div className="flex flex-col items-center justify-center">
                                        <svg className="w-12 h-12 text-[#bdc1c6] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <p className="font-semibold text-sm text-[#3c4043]">No se encontraron registros de pago</p>
                                        <p className="text-xs text-[#5f6368] mt-1">Prueba cambiando los filtros o agregando un nuevo pago.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            payments.map(p => {
                                const isBeingDragged = draggedId === p.id;
                                const isDropTarget = dropTargetInfo?.id === p.id;

                                const dropIndicatorClass = isDropTarget
                                    ? dropTargetInfo.isValid
                                        ? dropTargetInfo.isUnmatched
                                            ? 'ring-2 ring-emerald-500 bg-emerald-100/70 shadow-sm'
                                            : 'ring-2 ring-[#1e8e3e] bg-emerald-50/50'
                                        : 'ring-2 ring-[#d93025] bg-red-50/50'
                                    : '';
                                const draggingClass = isBeingDragged ? 'opacity-40' : '';
                                const statusButtonProps = getStatusButtonProps(p.estado);
                                const isPaid = p.estado === EstadoPago.Pagado && p.fechaPago;
                                const isSelected = selectedIds.has(p.id);

                                return (
                                <tr 
                                    key={p.id} 
                                    draggable={!isSelectionMode}
                                    onDragStart={(e) => handleDragStart(e, p)}
                                    onDragEnter={(e) => handleDragEnter(e, p)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, p)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => isSelectionMode && onSelectPayment(p.id)}
                                    style={{ cursor: isSelectionMode ? 'pointer' : 'grab' }}
                                    className={`transition-colors duration-150 ${isSelected ? 'bg-blue-50/80' : (p.revisado ? 'bg-blue-50/30' : 'bg-white')} hover:bg-[#f8fafd] ${draggingClass} ${dropIndicatorClass}`}
                                >
                                    {isSelectionMode && (
                                        <td className="px-5 py-3.5">
                                            <input 
                                                type="checkbox" 
                                                className="h-4 w-4 rounded border-[#dadce0] text-[#1a73e8] focus:ring-[#1a73e8] pointer-events-none"
                                                checked={isSelected}
                                                readOnly
                                            />
                                        </td>
                                    )}
                                    <td className="px-5 py-3.5">
                                        <div className="font-semibold text-[#202124] text-sm">{p.cliente}</div>
                                        {p.notas && (
                                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={p.notas}>
                                                {p.notas}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5 text-[#5f6368] font-mono text-xs">{p.recordId || '—'}</td>
                                    <td className="px-5 py-3.5 text-xs">
                                        {p.telefono ? (
                                            <button
                                                type="button"
                                                onClick={() => handleWhatsAppClick(p)}
                                                title={`Enviar WhatsApp al ${p.telefono}`}
                                                className="font-mono text-emerald-700 hover:text-emerald-900 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]"></span>
                                                <span>{p.telefono}</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleWhatsAppClick(p)}
                                                className="text-[11px] text-slate-400 hover:text-emerald-600 italic flex items-center gap-1 cursor-pointer"
                                                title="Ingresar teléfono de WhatsApp"
                                            >
                                                <span>+ Agregar</span>
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0]">
                                            Oficina {p.oficina}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 font-mono font-bold text-[#202124]">{formatCurrency(p.monto)}</td>
                                    <td className="px-5 py-3.5 text-xs">
                                        <div>
                                            {isPaid ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[11px] text-emerald-700 font-semibold">Pagado:</span>
                                                    <span className="font-medium text-[#202124]">{formatDateForDisplay(p.fechaPago!)}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[11px] text-[#5f6368]">Servicio:</span>
                                                    <span className="font-medium text-[#202124]">{formatDateForDisplay(p.fecha)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        {p.boleta ? (
                                            <span className="font-mono text-xs font-semibold text-[#202124] bg-[#f8fafd] px-2 py-0.5 rounded border border-[#dadce0]">{p.boleta}</span>
                                        ) : (
                                            <span className="text-xs text-[#5f6368] italic">S/N</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5">{statusBadge(p.estado)}</td>
                                    {!isSelectionMode && (
                                         <td className="px-5 py-3.5 text-center">
                                             <div className="flex items-center justify-center space-x-1.5">
                                                 <button 
                                                     type="button"
                                                     onClick={(e) => {
                                                         e.stopPropagation();
                                                         handleWhatsAppClick(p);
                                                     }}
                                                     title={p.telefono ? `Enviar WhatsApp a ${p.cliente} (${p.telefono})` : `Enviar WhatsApp a ${p.cliente} (ingresar número)`}
                                                     className="p-1.5 bg-[#25D366] hover:bg-[#1ebd59] text-white rounded-full transition shadow-xs flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                                                 >
                                                     <WhatsAppIcon />
                                                 </button>
                                                 {p.comprobanteImg && (
                                                     <button 
                                                         onClick={() => onViewImage(p)} 
                                                         title="Ver Comprobante" 
                                                         className="p-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-full transition cursor-pointer flex items-center justify-center"
                                                     >
                                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                     </button>
                                                 )}
                                                 <button 
                                                     onClick={() => onToggleReviewed(p.id)} 
                                                     title={p.revisado ? 'Revisado (clic para desmarcar)' : 'No Revisado (clic para marcar)'} 
                                                     className={`p-1.5 rounded-full transition cursor-pointer flex items-center justify-center ${
                                                         p.revisado 
                                                             ? 'text-blue-600 hover:bg-blue-50' 
                                                             : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                                                     }`}
                                                 >
                                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                 </button>
                                                 <button 
                                                     onClick={() => onToggleStatus(p.id)} 
                                                     title={statusButtonProps.title} 
                                                     className={`p-1.5 rounded-full transition cursor-pointer flex items-center justify-center ${statusButtonProps.className}`}
                                                 >
                                                     {statusButtonProps.icon}
                                                 </button>
                                                 <button 
                                                     onClick={() => onEdit(p)} 
                                                     title="Editar Pago" 
                                                     className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full transition cursor-pointer flex items-center justify-center"
                                                 >
                                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                                 </button>
                                                 <button 
                                                     onClick={() => onDelete(p.id)} 
                                                     title="Eliminar Pago" 
                                                     className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition cursor-pointer flex items-center justify-center"
                                                 >
                                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                 </button>
                                             </div>
                                         </td>
                                     )}
                                </tr>
                            )})
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PaymentTable;
