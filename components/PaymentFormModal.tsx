import React, { useState, useEffect } from 'react';
import { Payment, Oficina, EstadoPago, DEFAULT_CLIENTS_LIST } from '../types';
import ImageViewerModal from './ImageViewerModal';

interface PaymentFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (payment: Payment) => void;
    payment: Payment | null;
}

type FormDataType = Omit<Payment, 'id' | 'monto' | 'horas'> & {
    monto: string | number;
    horas: string | number;
};

const toLocalDateString = (date: Date): string => {
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
    return adjustedDate.toISOString().split('T')[0];
};

const formatSuggestedDateForDisplay = (isoDate: string): string => {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return isoDate;
    }
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
};

const initialFormState: FormDataType = {
    cliente: '',
    telefono: '',
    oficina: Oficina.O1201,
    horas: '1',
    monto: '65',
    boleta: '',
    fecha: toLocalDateString(new Date()),
    fechaPago: undefined,
    estado: EstadoPago.Pendiente,
    metodoPago: 'Transferencia',
    notas: '',
    comprobanteImg: undefined,
};

const PaymentFormModal: React.FC<PaymentFormModalProps> = ({ isOpen, onClose, onSave, payment }) => {
    const [formData, setFormData] = useState<FormDataType>({ ...initialFormState });
    const [isDragging, setIsDragging] = useState(false);
    const [isViewerOpen, setIsViewerOpen] = useState(false);

    useEffect(() => {
        if (payment) {
            setFormData({
                ...payment,
                monto: String(payment.monto),
                horas: String(payment.horas),
                telefono: payment.telefono || '',
                notas: payment.notas || '',
            });
        } else {
            setFormData({ ...initialFormState, fecha: toLocalDateString(new Date()) });
        }
    }, [payment, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        let newFormData = { ...formData, [name]: value };

        if (!payment && name === 'oficina') {
            const newMonto = '65';
            newFormData.monto = newMonto;
        }

        if (name === 'estado') {
            if (value === EstadoPago.Pagado && !newFormData.fechaPago) {
                newFormData.fechaPago = toLocalDateString(new Date());
            } else if (value !== EstadoPago.Pagado) {
                 newFormData.fechaPago = undefined;
            }
        }
        
        setFormData(newFormData);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (uploadEvent) => {
                const base64 = uploadEvent.target?.result as string;
                setFormData(prev => ({ ...prev, comprobanteImg: base64 }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (uploadEvent) => {
                const base64 = uploadEvent.target?.result as string;
                setFormData(prev => ({ ...prev, comprobanteImg: base64 }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ 
            ...formData, 
            id: payment?.id || '',
            monto: parseFloat(String(formData.monto)) || 0,
            horas: parseFloat(String(formData.horas)) || 1
        });
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex justify-center items-center p-4">
                <div className="bg-white rounded-3xl shadow-google-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-[#dadce0] animate-in fade-in zoom-in-95 duration-150">
                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[#f1f3f4] flex justify-between items-center bg-[#f8fafd]">
                            <div className="flex items-center gap-3">
                                <span className="w-9 h-9 rounded-xl bg-blue-100 text-[#1a73e8] flex items-center justify-center font-bold">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </span>
                                <div>
                                    <h2 className="text-lg font-bold text-[#202124]">{payment ? 'Editar Pago' : 'Nuevo Registro de Pago'}</h2>
                                    <p className="text-xs text-[#5f6368]">Ingresa o actualiza los datos del cobro para ONEDAY</p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="p-2 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#e8eaed] transition"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body Form */}
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Cliente *</label>
                                    <input 
                                        type="text" 
                                        name="cliente" 
                                        list="admin-clients-list"
                                        value={formData.cliente} 
                                        onChange={handleChange} 
                                        required 
                                        placeholder="Nombre del cliente..."
                                        className="w-full px-3.5 py-2.5 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-sm text-[#202124] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition" 
                                    />
                                    <datalist id="admin-clients-list">
                                        {DEFAULT_CLIENTS_LIST.map(name => (
                                            <option key={name} value={name} />
                                        ))}
                                    </datalist>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Teléfono</label>
                                    <input 
                                        type="tel" 
                                        name="telefono" 
                                        value={formData.telefono || ''} 
                                        onChange={handleChange} 
                                        placeholder="Ej: 5555-1234" 
                                        className="w-full px-3.5 py-2.5 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-sm text-[#202124] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition" 
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Oficina</label>
                                    <select 
                                        name="oficina" 
                                        value={formData.oficina} 
                                        onChange={handleChange} 
                                        className="w-full px-3.5 py-2.5 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-sm font-medium text-[#202124] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition"
                                    >
                                        {Object.values(Oficina).map(o => <option key={o} value={o}>Oficina {o}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Número de Horas</label>
                                    <input 
                                        type="number" 
                                        name="horas" 
                                        value={formData.horas} 
                                        onChange={handleChange} 
                                        placeholder="1" 
                                        min="0" 
                                        step="1" 
                                        className="w-full px-3.5 py-2.5 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-sm text-[#202124] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition" 
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Monto (Q) *</label>
                                    <input 
                                        type="number" 
                                        name="monto" 
                                        value={formData.monto} 
                                        onChange={handleChange} 
                                        placeholder="0.00" 
                                        required 
                                        min="0" 
                                        step="0.01" 
                                        className="w-full px-3.5 py-2.5 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-sm font-mono font-bold text-[#202124] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition" 
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Número de Boleta</label>
                                    <input 
                                        type="text" 
                                        name="boleta" 
                                        value={formData.boleta} 
                                        onChange={handleChange} 
                                        placeholder="Ej: 123456 (Opcional)"
                                        className="w-full px-3.5 py-2.5 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-sm font-mono text-[#202124] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition" 
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Fecha del Servicio *</label>
                                    <input 
                                        type="date" 
                                        name="fecha" 
                                        value={formData.fecha} 
                                        onChange={handleChange} 
                                        required 
                                        className="w-full px-3.5 py-2.5 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-sm text-[#202124] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition" 
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Estado del Pago</label>
                                    <select 
                                        name="estado" 
                                        value={formData.estado} 
                                        onChange={handleChange} 
                                        className="w-full px-3.5 py-2.5 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-sm font-medium text-[#202124] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition"
                                    >
                                        {Object.values(EstadoPago).map(e => <option key={e} value={e}>{e}</option>)}
                                    </select>
                                </div>
                                
                                {formData.estado === EstadoPago.Pagado && (
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Fecha de Pago</label>
                                        <input 
                                            type="date" 
                                            name="fechaPago" 
                                            value={formData.fechaPago || ''} 
                                            onChange={handleChange} 
                                            required 
                                            className="w-full px-3.5 py-2.5 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-sm text-[#202124] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition" 
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Método de Pago</label>
                                    <input 
                                        type="text" 
                                        name="metodoPago" 
                                        value={formData.metodoPago} 
                                        onChange={handleChange} 
                                        placeholder="Transferencia, efectivo..." 
                                        className="w-full px-3.5 py-2.5 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-sm text-[#202124] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition" 
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Notas Adicionales</label>
                                    <textarea 
                                        name="notas" 
                                        value={formData.notas || ''} 
                                        onChange={handleChange} 
                                        rows={2} 
                                        placeholder="Detalles sobre el servicio, horarios especiales, etc."
                                        className="w-full px-3.5 py-2.5 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-sm text-[#202124] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition"
                                    ></textarea>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Comprobante de Pago (Imagen)</label>
                                    {formData.comprobanteImg ? (
                                        <div className="mt-2">
                                            <div className="relative group inline-block">
                                                <img src={formData.comprobanteImg} alt="Vista previa del comprobante" className="max-h-44 rounded-2xl border border-[#dadce0] shadow-sm"/>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setIsViewerOpen(true)} 
                                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-all rounded-2xl cursor-pointer"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                    </svg>
                                                    <span className="ml-2 font-medium text-sm">Ver completo</span>
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setFormData(prev => ({ ...prev, comprobanteImg: undefined }))} 
                                                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 leading-none w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-700 shadow-md z-10" 
                                                    title="Eliminar imagen"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div 
                                            onDragEnter={handleDragEnter} 
                                            onDragLeave={handleDragLeave} 
                                            onDragOver={handleDragOver} 
                                            onDrop={handleDrop} 
                                            className={`mt-1 flex justify-center px-6 py-6 border-2 border-dashed rounded-2xl transition-all ${
                                                isDragging ? 'border-[#1a73e8] bg-blue-50/50' : 'border-[#dadce0] bg-[#f8fafd] hover:bg-[#f1f3f4]'
                                            }`}
                                        >
                                            <div className="space-y-1 text-center">
                                                <svg className="mx-auto h-10 w-10 text-[#5f6368]" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                <div className="flex text-sm text-[#3c4043]">
                                                    <label htmlFor="file-upload" className="relative cursor-pointer font-bold text-[#1a73e8] hover:text-[#1557b0] focus-within:outline-none">
                                                        <span>Subir comprobante</span>
                                                        <input id="file-upload" name="file-upload" type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
                                                    </label>
                                                    <p className="pl-1">o arrastra la imagen aquí</p>
                                                </div>
                                                <p className="text-xs text-[#5f6368]">PNG, JPG, JPEG para adjuntar comprobante</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="bg-[#f8fafd] px-6 py-4 border-t border-[#f1f3f4] flex justify-end gap-3">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="px-5 py-2.5 bg-white border border-[#dadce0] rounded-full text-sm font-semibold text-[#3c4043] hover:bg-[#f1f3f4] transition"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                className="px-6 py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-full text-sm font-semibold shadow-google-sm hover:shadow-google-md transition flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Guardar Registro</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {isViewerOpen && (
                <ImageViewerModal
                    isOpen={isViewerOpen}
                    onClose={() => setIsViewerOpen(false)}
                    imageUrl={formData.comprobanteImg || null}
                    fileName="comprobante_preview.png"
                />
            )}
        </>
    );
};

export default PaymentFormModal;
