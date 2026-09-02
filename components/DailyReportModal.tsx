

import React, { useRef, useState } from 'react';
import { Payment, EstadoPago } from '../types';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    payments: Payment[];
}

const formatCurrency = (amount: number) => {
    return `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateForDisplay = (isoDate: string): string => {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return isoDate;
    }
    const [year, month, day] = isoDate.split('-');
    return `${day}-${month}-${year}`;
};

const statusBadge = (status: EstadoPago) => {
    const baseClasses = "px-3 py-1 text-xs font-semibold rounded-full inline-block";
    switch (status) {
        case EstadoPago.Pagado:
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>Pagado</span>;
        case EstadoPago.Pendiente:
            return <span className={`${baseClasses} bg-red-100 text-red-800`}>Pendiente</span>;
        case EstadoPago.PlanMensual:
            return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Plan Mensual</span>;
        case EstadoPago.CreditoMensual:
            return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>Crédito Mensual</span>;
        default:
             return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>;
    }
};


const DailyReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, payments }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const reportContentRef = useRef<HTMLDivElement>(null);

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
                backgroundColor: '#ffffff'
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
            const fileName = `Reporte de Pagos - ${today}.pdf`;

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
            <div className="bg-white rounded-3xl shadow-google-lg w-full max-w-4xl max-h-[90vh] flex flex-col border border-[#dadce0] animate-fade-in-scale overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[#f1f3f4] flex justify-between items-center bg-[#f8fafd]">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-teal-50 text-[#0f9d58] flex items-center justify-center font-bold shadow-xs border border-emerald-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-[#202124]">Reporte Diario de Pagos</h2>
                            <p className="text-xs text-[#5f6368]">Listado de cobros visibles para exportación en PDF</p>
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
                
                <div className="flex-grow overflow-y-auto">
                     <div ref={reportContentRef} className="p-8 bg-white">
                        <div className="flex justify-between items-center pb-4 mb-6 border-b border-[#dadce0]">
                            <div>
                                <h1 className="text-2xl font-bold text-[#202124]">Reporte de Pagos – ONEDAY</h1>
                                <p className="text-xs text-[#5f6368] mt-0.5">Control de Cobros y Registros</p>
                            </div>
                            <div className="text-right text-xs text-[#5f6368]">
                                <p>Fecha: <strong className="text-[#202124]">{formatDateForDisplay(toLocalDateString(new Date()))}</strong></p>
                                <p>Total: <strong className="text-[#202124]">{payments.length} registros</strong></p>
                            </div>
                        </div>

                        {payments.length > 0 ? (
                            <table className="w-full min-w-full text-sm text-left text-[#3c4043]">
                                <thead className="bg-[#f8fafd] text-[11px] font-bold text-[#5f6368] uppercase tracking-wider border-b border-[#dadce0]">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">Cliente</th>
                                        <th scope="col" className="px-4 py-3">Teléfono</th>
                                        <th scope="col" className="px-4 py-3">Oficina</th>
                                        <th scope="col" className="px-4 py-3 text-right">Monto</th>
                                        <th scope="col" className="px-4 py-3">Fecha</th>
                                        <th scope="col" className="px-4 py-3">Boleta</th>
                                        <th scope="col" className="px-4 py-3">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f1f3f4]">
                                    {payments.map(p => (
                                        <tr key={p.id} className="hover:bg-[#f8fafd]">
                                            <td className="px-4 py-3 font-semibold text-[#202124] whitespace-nowrap">{p.cliente}</td>
                                            <td className="px-4 py-3 text-xs">{p.telefono || '-'}</td>
                                            <td className="px-4 py-3 text-xs">Oficina {p.oficina}</td>
                                            <td className="px-4 py-3 font-mono font-bold text-right text-[#202124]">{formatCurrency(p.monto)}</td>
                                            <td className="px-4 py-3 text-xs">{formatDateForDisplay(p.fecha)}</td>
                                            <td className="px-4 py-3 text-xs font-mono">{p.boleta || 'S/N'}</td>
                                            <td className="px-4 py-3">{statusBadge(p.estado)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-10 text-[#5f6368]">
                                <p>No hay registros en la vista actual para generar un reporte.</p>
                            </div>
                        )}
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
                        className="px-6 py-2.5 bg-[#0f9d58] hover:bg-[#0b8043] text-white rounded-full text-sm font-semibold shadow-google-sm hover:shadow-google-md disabled:opacity-40 disabled:cursor-wait transition flex items-center gap-2"
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
                                <span>Descargar PDF</span>
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

export default DailyReportModal;