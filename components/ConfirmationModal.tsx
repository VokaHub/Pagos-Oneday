
import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-3xl shadow-google-lg w-full max-w-md border border-[#dadce0] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-2xl bg-red-50 text-[#d93025] border border-red-200 shadow-xs">
                            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-base font-bold text-[#202124]" id="modal-title">
                                {title}
                            </h3>
                            <div className="mt-1.5">
                                <p className="text-xs text-[#5f6368] leading-relaxed">
                                    {message}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-[#f8fafd] px-6 py-4 border-t border-[#f1f3f4] flex flex-row-reverse gap-2">
                    <button
                        type="button"
                        className="px-5 py-2.5 bg-[#d93025] hover:bg-[#b3261e] text-white rounded-full text-xs font-semibold shadow-google-sm hover:shadow-google-md transition"
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        Confirmar
                    </button>
                    <button
                        type="button"
                        className="px-5 py-2.5 bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] rounded-full text-xs font-semibold transition"
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
