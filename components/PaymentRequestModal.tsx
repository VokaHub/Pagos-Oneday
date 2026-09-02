
import React, { useMemo, useRef, useState } from 'react';
import { Payment, OFFICE_BANK_DETAILS, BankAccountInfo } from '../types';

interface PaymentRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    payments: Payment[]; // Should be pre-filtered for pending/credit
}

const formatDateForDisplay = (isoDate: string): string => {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return isoDate;
    }
    const date = new Date(isoDate);
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

const PaymentRequestModal: React.FC<PaymentRequestModalProps> = ({ isOpen, onClose, payments }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const requestContentRef = useRef<HTMLDivElement>(null);
    
    const clientData = useMemo(() => {
        if (payments.length === 0) {
            return { clientName: '', totalDue: 0 };
        }
        const clientName = payments[0].cliente;
        const totalDue = payments.reduce((sum, p) => sum + p.monto, 0);
        return { clientName, totalDue };
    }, [payments]);

    const bankAccountsData = useMemo(() => {
        if (payments.length === 0) {
            return [];
        }
        const map = new Map<string, { account: BankAccountInfo; offices: string[] }>();
        payments.forEach(p => {
            const details = OFFICE_BANK_DETAILS[p.oficina];
            if (!details) return;
            const key = `${details.accountNumber}-${details.accountType}`;
            if (!map.has(key)) {
                map.set(key, { account: details, offices: [`Oficina ${p.oficina}`] });
            } else {
                const existing = map.get(key)!;
                const ofcName = `Oficina ${p.oficina}`;
                if (!existing.offices.includes(ofcName)) {
                    existing.offices.push(ofcName);
                }
            }
        });
        return Array.from(map.values());
    }, [payments]);


    const handleDownloadPDF = async () => {
        if (!requestContentRef.current || !(window as any).jspdf || !(window as any).html2canvas) {
            console.error("PDF generation libraries not loaded.");
            alert("No se pudieron cargar las librerías para generar el PDF. Refresque la página e intente de nuevo.");
            return;
        }

        setIsDownloading(true);
        try {
            const html2canvas = (window as any).html2canvas;
            const canvas = await html2canvas(requestContentRef.current, {
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
            const clientNameForFile = clientData.clientName.replace(/\s+/g, ' ');
            const fileName = `Solicitud de Pago - ${clientNameForFile} - ${today}.pdf`;
            pdf.save(fileName);

        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Hubo un error al generar el PDF. Por favor, inténtelo de nuevo.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSendViaWhatsApp = () => {
        if (payments.length === 0) return;
        let phone = payments[0]?.telefono || '';
        if (!phone || !phone.trim()) {
            const input = window.prompt(`Ingrese el número de teléfono o WhatsApp de ${clientData.clientName} (ej. 55551234):`);
            if (!input || !input.trim()) return;
            phone = input.trim();
        }
        let digits = phone.replace(/\D/g, '');
        if (digits.length === 8) {
            digits = `502${digits}`;
        }
        const bankInfo = bankAccountsData.map(b => `${b.account.bank} - Cta ${b.account.accountType}: ${b.account.accountNumber} (${b.account.accountName})`).join('\n');
        const servicesList = payments.map(p => `• Oficina ${p.oficina} (${formatDateForDisplay(p.fecha)}): ${formatCurrency(p.monto)}`).join('\n');
        const text = `Hola ${clientData.clientName}, le saludamos de ONEDAY Spaces.\n\nLe compartimos el estado de cuenta por sus reservaciones pendientes:\n\n${servicesList}\n\n*Total a Pagar:* ${formatCurrency(clientData.totalDue)}\n\n*Cuentas para transferencia:*\n${bankInfo}\n\nPor favor nos envía el comprobante al realizar su pago. ¡Muchas gracias!`;
        window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, '_blank');
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-3xl shadow-google-lg w-full max-w-4xl max-h-[90vh] flex flex-col border border-[#dadce0] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#f1f3f4] flex justify-between items-center bg-[#f8fafd]">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-blue-50 text-[#1a73e8] flex items-center justify-center font-bold shadow-xs border border-blue-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-[#202124]">Solicitud de Pago</h2>
                            <p className="text-xs text-[#5f6368]">
                                Resumen de cobros para {payments.length > 0 ? `el cliente ${clientData.clientName}` : 'los clientes seleccionados'}
                            </p>
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
                    {payments.length > 0 ? (
                        <div ref={requestContentRef} className="bg-white px-6 pt-6 pb-10">
                            <header className="flex justify-between items-start mb-8 pb-4 border-b border-[#dadce0]">
                                <div>
                                    <h1 className="text-2xl font-bold text-[#202124]">Solicitud de Pago – ONEDAY</h1>
                                    <p className="text-xs text-[#5f6368] mt-0.5">Fecha de Emisión: {new Date().toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-xs font-bold text-[#5f6368] uppercase tracking-wider">Cliente</h2>
                                    <p className="text-base font-bold text-[#202124]">{clientData.clientName}</p>
                                </div>
                            </header>

                            <main>
                                <p className="mb-6 text-sm text-[#3c4043]">
                                    Estimado/a <strong className="text-[#202124]">{clientData.clientName}</strong>, a continuación se detalla el resumen de los servicios prestados pendientes de pago:
                                </p>
                                <table className="w-full text-sm text-left text-[#3c4043] mb-6">
                                    <thead className="bg-[#f8fafd] text-[11px] font-bold text-[#5f6368] uppercase tracking-wider border-b border-[#dadce0]">
                                        <tr>
                                            <th scope="col" className="px-4 py-3">Fecha del Servicio</th>
                                            <th scope="col" className="px-4 py-3">Oficina</th>
                                            <th scope="col" className="px-4 py-3">Descripción / Boleta</th>
                                            <th scope="col" className="px-4 py-3 text-right">Monto (GTQ)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#f1f3f4]">
                                        {payments.map(p => (
                                            <tr key={p.id} className="hover:bg-[#f8fafd]">
                                                <td className="px-4 py-3 text-xs">{formatDateForDisplay(p.fecha)}</td>
                                                <td className="px-4 py-3 text-xs font-semibold">Oficina {p.oficina}</td>
                                                <td className="px-4 py-3 text-xs">
                                                    Servicio de oficina{p.boleta ? ` / Boleta No. ${p.boleta}` : ''}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-[#202124]">{formatCurrency(p.monto)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="flex justify-end">
                                    <div className="w-full md:w-1/3">
                                        <div className="flex justify-between items-center py-3 border-t-2 border-[#202124]">
                                            <span className="text-sm font-bold text-[#202124]">Total a Pagar:</span>
                                            <span className="text-lg font-bold text-[#1a73e8] font-mono">{formatCurrency(clientData.totalDue)}</span>
                                        </div>
                                    </div>
                                </div>
                            </main>

                            <footer className="mt-8 pt-6 border-t border-[#dadce0] text-xs text-[#5f6368]">
                                <p>Por favor, realizar el pago a la brevedad posible. Si ya realizó el pago, por favor ignore este recordatorio.</p>
                                
                                {bankAccountsData.map((item, index) => (
                                    <div key={`${item.account.accountNumber}-${index}`} className={`mt-4 pt-3 ${index > 0 ? 'border-t border-dashed border-[#dadce0]' : ''}`}>
                                        <p className="font-semibold text-[#202124]">
                                            Aquí tienes la cuenta para realizar la transferencia
                                            {bankAccountsData.length > 1 && ` (para oficinas: ${item.offices.join(', ')})`}:
                                        </p>
                                        <div className="mt-2 text-[#3c4043] bg-[#f8fafd] p-4 rounded-xl border border-[#dadce0]">
                                            <p><strong>Banco:</strong> {item.account.bank}</p>
                                            <p><strong>Cuenta {item.account.accountType}:</strong> {item.account.accountNumber}</p>
                                            <p><strong>A nombre de:</strong> {item.account.accountName}</p>
                                        </div>
                                    </div>
                                ))}

                                <p className="font-semibold text-[#202124] mt-6">ONEDAY</p>
                                <p>Guatemala</p>
                            </footer>
                        </div>
                    ) : (
                         <div className="text-center py-10 text-[#5f6368]">
                            <p>No hay pagos pendientes o de crédito en la vista actual para generar una solicitud.</p>
                            <p className="mt-2 text-xs">Por favor, filtre por un cliente con pagos pendientes.</p>
                        </div>
                    )}
                </div>

                <div className="bg-[#f8fafd] px-6 py-4 mt-auto border-t border-[#f1f3f4] flex flex-wrap justify-end items-center gap-3">
                    <button
                        onClick={onClose}
                        disabled={isDownloading}
                        className="px-5 py-2.5 bg-white border border-[#dadce0] rounded-full text-sm font-semibold text-[#3c4043] hover:bg-[#f1f3f4] transition"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={handleSendViaWhatsApp}
                        disabled={payments.length === 0}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-sm font-semibold shadow-google-sm hover:shadow-google-md disabled:opacity-40 transition flex items-center gap-2 cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.956-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01s-.521.074-.792.372c-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                        </svg>
                        <span>Enviar por WhatsApp</span>
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading || payments.length === 0}
                        className="px-6 py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-full text-sm font-semibold shadow-google-sm hover:shadow-google-md disabled:opacity-40 disabled:cursor-wait transition flex items-center gap-2"
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
        </div>
    );
};

export default PaymentRequestModal;
