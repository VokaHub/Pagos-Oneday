import React, { useMemo, useRef, useState } from 'react';
import { Payment } from '../types';

interface ProofOfPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    payments: Payment[];
}

const formatDateForDisplay = (isoDate: string): string => {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return isoDate;
    }
    const date = new Date(isoDate);
    // Adjust for timezone offset before formatting
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + userTimezoneOffset);

    return localDate.toLocaleDateString('es-GT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
};

const formatCurrency = (amount: number) => {
    return `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const ProofOfPaymentModal: React.FC<ProofOfPaymentModalProps> = ({ isOpen, onClose, payments }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const proofContentRef = useRef<HTMLDivElement>(null);

    const totalPagado = useMemo(() => {
        return payments.reduce((sum, p) => sum + p.monto, 0);
    }, [payments]);

    const handleDownloadPDF = async () => {
        if (!proofContentRef.current || !(window as any).jspdf || !(window as any).html2canvas) {
            console.error("PDF generation libraries not loaded.");
            alert("No se pudieron cargar las librerías para generar el PDF. Refresque la página e intente de nuevo.");
            return;
        }

        setIsDownloading(true);
        try {
            const html2canvas = (window as any).html2canvas;
            const canvas = await html2canvas(proofContentRef.current, {
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
            const fileName = `Comprobante de Pago - ${today}.pdf`;
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
            <div className="bg-white rounded-3xl shadow-google-lg w-full max-w-4xl max-h-[90vh] flex flex-col border border-[#dadce0] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#f1f3f4] flex justify-between items-center bg-[#f8fafd]">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#1e8e3e] flex items-center justify-center font-bold shadow-xs border border-emerald-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-[#202124]">Comprobante de Pagos Realizados</h2>
                            <p className="text-xs text-[#5f6368]">Resumen certificado de pagos completados</p>
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
                
                <div className="p-6 overflow-y-auto flex-grow">
                    <div ref={proofContentRef} className="bg-white px-6 pt-6 pb-10">
                        <div className="flex justify-between items-center mb-8 pb-4 border-b border-[#dadce0]">
                            <div>
                                <h1 className="text-2xl font-bold text-[#202124]">Control de Pagos – ONEDAY</h1>
                                <p className="text-xs text-[#5f6368] mt-0.5">Comprobante Oficial de Transacciones</p>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-bold text-emerald-800 bg-emerald-100/80 px-4 py-1.5 rounded-full border border-emerald-300 inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                    PAGADO
                                </span>
                            </div>
                        </div>

                        <table className="w-full text-sm text-left text-[#3c4043]">
                            <thead className="bg-[#f8fafd] text-[11px] font-bold text-[#5f6368] uppercase tracking-wider border-b border-[#dadce0]">
                                <tr>
                                    <th scope="col" className="px-4 py-3">Cliente</th>
                                    <th scope="col" className="px-4 py-3">Oficina</th>
                                    <th scope="col" className="px-4 py-3 text-center">Horas</th>
                                    <th scope="col" className="px-4 py-3">Fecha de Uso</th>
                                    <th scope="col" className="px-4 py-3">Fecha de Pago</th>
                                    <th scope="col" className="px-4 py-3">Boleta/Ref.</th>
                                    <th scope="col" className="px-4 py-3 text-right">Monto (GTQ)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f1f3f4]">
                                {payments.map(p => (
                                    <tr key={p.id} className="hover:bg-[#f8fafd]">
                                        <td className="px-4 py-3 font-semibold text-[#202124]">{p.cliente}</td>
                                        <td className="px-4 py-3 text-xs">Oficina {p.oficina}</td>
                                        <td className="px-4 py-3 text-center text-xs font-semibold">{p.horas}</td>
                                        <td className="px-4 py-3 text-xs">{formatDateForDisplay(p.fecha)}</td>
                                        <td className="px-4 py-3 text-xs">{formatDateForDisplay(p.fechaPago || p.fecha)}</td>
                                        <td className="px-4 py-3 text-xs font-mono">{p.boleta || 'S/N'}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-[#202124]">{formatCurrency(p.monto)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="mt-6 pt-6 border-t border-[#dadce0]">
                            <div className="flex justify-end items-center">
                                <div className="bg-[#f8fafd] px-6 py-3 rounded-2xl border border-[#dadce0]">
                                    <p className="text-xs font-bold text-[#5f6368] uppercase tracking-wider">Total Pagado</p>
                                    <p className="text-xl font-bold text-[#1e8e3e] font-mono mt-0.5">{formatCurrency(totalPagado)}</p>
                                </div>
                            </div>
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
                        className="px-6 py-2.5 bg-[#1e8e3e] hover:bg-[#137333] text-white rounded-full text-sm font-semibold shadow-google-sm hover:shadow-google-md disabled:opacity-40 disabled:cursor-wait transition flex items-center gap-2"
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
                                <span>Descargar Comprobante</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProofOfPaymentModal;
