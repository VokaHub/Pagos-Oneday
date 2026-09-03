
import React, { useMemo, useRef, useState } from 'react';
import { Payment, Oficina } from '../types';

interface EstimatesModalProps {
    isOpen: boolean;
    onClose: () => void;
    payments: Payment[];
}

const formatCurrency = (amount: number) => {
    return `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const EstimatesModal: React.FC<EstimatesModalProps> = ({ isOpen, onClose, payments }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const reportContentRef = useRef<HTMLDivElement>(null);
    
    const summaryData = useMemo(() => {
        // Estimate considers ALL currently filtered payments, regardless of status.
        const totalEstimated = payments.reduce((sum, p) => sum + p.monto, 0);
        
        const breakdown = payments.reduce((acc, p) => {
            if (!acc[p.oficina]) {
                acc[p.oficina] = 0;
            }
            acc[p.oficina]! += p.monto;
            return acc;
        }, {} as { [key in Oficina]?: number });
        
        return { totalEstimated, breakdown };
    }, [payments]);

    const handleDownloadPDF = async () => {
        if (!reportContentRef.current || !(window as any).jspdf || !(window as any).html2canvas) {
            console.error("PDF generation libraries not loaded.");
            alert("No se pudieron cargar las librerías para generar el PDF. Refresque la página e intente de nuevo.");
            return;
        }

        setIsDownloading(true);
        try {
            const html2canvas = (window as any).html2canvas;
            const canvas = await html2canvas(reportContentRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#f9fafb'
            });
            const imgData = canvas.toDataURL('image/png');
            
            const { jsPDF } = (window as any).jspdf;
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const ratio = canvas.width / canvas.height;
            
            let imgWidth = pdfWidth - 20; // 10mm margin
            let imgHeight = imgWidth / ratio;
            
            if (imgHeight > pdfHeight - 20) {
                imgHeight = pdfHeight - 20;
                imgWidth = imgHeight * ratio;
            }

            const x = (pdfWidth - imgWidth) / 2;
            const y = 10; 

            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
            
            const today = new Date().toISOString().slice(0, 10);
            const fileName = `Estimacion de Ingresos - ${today}.pdf`;

            pdf.save(fileName);

        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Hubo un error al generar el PDF. Por favor, inténtelo de nuevo.");
        } finally {
            setIsDownloading(false);
        }
    };


    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-3xl shadow-google-lg w-full max-w-2xl max-h-[90vh] flex flex-col border border-[#dadce0] animate-fade-in-scale overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[#f1f3f4] flex justify-between items-center bg-[#f8fafd]">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-blue-50 text-[#1a73e8] flex items-center justify-center font-bold shadow-xs border border-blue-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-[#202124]">Estimación de Ingresos</h2>
                            <p className="text-xs text-[#5f6368]">Proyección de ingresos potenciales en la vista actual</p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        disabled={isDownloading} 
                        className="p-2 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#e8eaed] transition disabled:opacity-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div ref={reportContentRef} className="p-6 bg-white flex-grow overflow-y-auto space-y-6">
                    {/* Big Total Card */}
                    <div className="bg-[#f8fafd] border border-[#dadce0] text-[#202124] p-6 rounded-2xl shadow-google-sm text-center">
                        <p className="text-xs font-bold text-[#1a73e8] uppercase tracking-wider">Total Estimado Potencial</p>
                        <p className="text-4xl font-extrabold tracking-tight mt-1 font-mono text-[#202124]">{formatCurrency(summaryData.totalEstimated)}</p>
                        <p className="text-xs text-[#5f6368] mt-2">Calculado con base en todos los registros filtrados</p>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-[#202124] mb-3">Desglose por Oficina</h3>
                        <div className="space-y-2.5">
                            {Object.values(Oficina).map(oficina => {
                                const amount = summaryData.breakdown[oficina] || 0;
                                if (payments.some(p => p.oficina === oficina)) {
                                    return (
                                        <div key={oficina} className="flex justify-between items-center bg-[#f8fafd] p-3.5 rounded-xl border border-[#dadce0] hover:border-[#1a73e8] transition">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 rounded-lg text-[#1a73e8]">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                    </svg>
                                                </div>
                                                <span className="font-semibold text-sm text-[#202124]">Oficina {oficina}</span>
                                            </div>
                                            <span className="font-bold text-[#202124] font-mono text-base">{formatCurrency(amount)}</span>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                             {payments.length === 0 && (
                                <div className="text-center py-6 bg-[#f8fafd] rounded-xl border border-[#dadce0]">
                                    <p className="text-xs text-[#5f6368]">No hay registros para generar una estimación.</p>
                                </div>
                             )}
                        </div>
                    </div>
                </div>

                <div className="bg-[#f8fafd] px-6 py-4 mt-auto border-t border-[#f1f3f4] flex justify-end items-center gap-3">
                    <button
                        onClick={onClose}
                        disabled={isDownloading}
                        className="px-5 py-2.5 bg-white border border-[#dadce0] rounded-full text-sm font-semibold text-[#3c4043] hover:bg-[#f1f3f4] transition"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading || payments.length === 0}
                        className="px-6 py-2.5 bg-[#f9ab00] hover:bg-[#e37400] text-white rounded-full text-sm font-semibold shadow-google-sm hover:shadow-google-md disabled:opacity-40 disabled:cursor-wait transition flex items-center gap-2"
                    >
                        {isDownloading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Generando PDF...</span>
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Descargar Estimación</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes fade-in-scale {
                    from { opacity: 0; transform: scale(0.96); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-scale {
                    animation: fade-in-scale 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
};

export default EstimatesModal;
