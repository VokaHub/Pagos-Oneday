import React from 'react';
import { Payment } from '../types';

interface DuplicateConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    duplicates: Payment[];
    onConfirmOmit: () => void;
    onConfirmKeepAll: () => void;
}

const formatCurrency = (amount: number) => {
    return `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const DuplicateConfirmationModal: React.FC<DuplicateConfirmationModalProps> = ({
    isOpen,
    onClose,
    duplicates,
    onConfirmOmit,
    onConfirmKeepAll,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-3xl shadow-google-lg w-full max-w-2xl border border-[#dadce0] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-2xl bg-amber-50 text-[#f9ab00] border border-amber-200 shadow-xs">
                            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-base font-bold text-[#202124]" id="modal-title">
                                Registros Duplicados Encontrados
                            </h3>
                            <div className="mt-1.5">
                                <p className="text-xs text-[#5f6368] leading-relaxed">
                                    Se encontraron <strong className="text-[#202124]">{duplicates.length} registros</strong> con un "ID de Registro" que ya existe en la base de datos. ¿Cómo deseas proceder?
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 max-h-60 overflow-y-auto p-3 bg-[#f8fafd] rounded-2xl border border-[#dadce0]">
                        <h4 className="font-bold text-[11px] uppercase tracking-wider mb-2 text-[#5f6368] px-1">Registros Duplicados:</h4>
                        <ul className="text-xs text-[#3c4043] space-y-1.5">
                            {duplicates.map((dup, index) => (
                                <li key={index} className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-[#dadce0]">
                                    <div>
                                        <span className="font-bold text-[#1a73e8]">ID: {dup.recordId}</span> • <span className="font-semibold text-[#202124]">{dup.cliente}</span>
                                    </div>
                                    <div className='text-right flex items-center gap-3'>
                                        <span className="text-[#5f6368] text-xs">{dup.fecha}</span>
                                        <span className="font-mono font-bold text-[#202124]">{formatCurrency(dup.monto)}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="bg-[#f8fafd] px-6 py-4 border-t border-[#f1f3f4] flex flex-wrap items-center justify-between gap-2">
                    <button
                        type="button"
                        className="px-5 py-2.5 bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368] rounded-full text-xs font-semibold transition"
                        onClick={onClose}
                    >
                        Cancelar Importación
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="px-5 py-2.5 bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] rounded-full text-xs font-semibold transition"
                            onClick={onConfirmKeepAll}
                        >
                            Añadir Todos
                        </button>
                        <button
                            type="button"
                            className="px-5 py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-full text-xs font-semibold shadow-google-sm hover:shadow-google-md transition"
                            onClick={onConfirmOmit}
                        >
                            Omitir Duplicados
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DuplicateConfirmationModal;
