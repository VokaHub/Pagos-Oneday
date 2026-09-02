import React from 'react';

interface ActionFooterProps {
    onRequestPayment: () => void;
    onGenerateProof: () => void;
    hasPendingPayments: boolean;
    hasPaidPayments: boolean;
    isSelectionMode: boolean;
    selectedCount: number;
    onDeleteSelected: () => void;
}

const ActionFooter: React.FC<ActionFooterProps> = ({
    onRequestPayment,
    onGenerateProof,
    hasPendingPayments,
    hasPaidPayments,
    isSelectionMode,
    selectedCount,
    onDeleteSelected
}) => {
    return (
        <div className="bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-google-md mt-6 sticky bottom-4 z-30 border border-[#dadce0] transition-all">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#202124] tracking-tight">
                        {isSelectionMode ? `Acciones de Selección (${selectedCount} registros)` : 'Generación de Documentos'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5f6368] mt-0.5">
                        {isSelectionMode 
                            ? "Aplica acciones masivas a los pagos seleccionados en la tabla."
                            : "Crea y comparte solicitudes de cobro formales o comprobantes de pago detallados."
                        }
                    </p>
                </div>

                {/* Big Google-style Action Buttons */}
                <div className="flex flex-wrap gap-3 items-center">
                    <button 
                        onClick={onRequestPayment} 
                        disabled={!hasPendingPayments || (isSelectionMode && selectedCount === 0)} 
                        className="px-6 py-3 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm font-semibold rounded-full shadow-google-sm hover:shadow-google-md disabled:opacity-40 disabled:hover:bg-[#1a73e8] disabled:cursor-not-allowed transition-all flex items-center gap-2.5"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>{isSelectionMode ? `Generar Solicitud (${selectedCount})` : "Generar Solicitud"}</span>
                    </button>

                    <button 
                        onClick={onGenerateProof} 
                        disabled={!hasPaidPayments || (isSelectionMode && selectedCount === 0)} 
                        className="px-6 py-3 bg-[#1e8e3e] hover:bg-[#137333] text-white text-sm font-semibold rounded-full shadow-google-sm hover:shadow-google-md disabled:opacity-40 disabled:hover:bg-[#1e8e3e] disabled:cursor-not-allowed transition-all flex items-center gap-2.5"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{isSelectionMode ? `Generar Comprobante (${selectedCount})` : "Generar Comprobante"}</span>
                    </button>

                    {isSelectionMode && (
                        <button 
                            onClick={onDeleteSelected} 
                            disabled={selectedCount === 0}
                            className="px-5 py-3 bg-[#d93025] hover:bg-[#b31412] text-white text-sm font-semibold rounded-full shadow-google-sm hover:shadow-google-md disabled:opacity-40 disabled:hover:bg-[#d93025] disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Eliminar ({selectedCount})</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActionFooter;
