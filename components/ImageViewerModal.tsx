import React from 'react';

interface ImageViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string | null;
    fileName?: string;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ isOpen, onClose, imageUrl, fileName = 'comprobante.png' }) => {
    if (!isOpen || !imageUrl) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex justify-center items-center p-4 transition-opacity duration-300"
            onClick={onClose}
        >
            <div 
                className="bg-white p-3 rounded-3xl shadow-google-lg w-full max-w-4xl max-h-[90vh] relative transform transition-all duration-300 scale-95 animate-fade-in-scale flex flex-col border border-[#dadce0]"
                onClick={e => e.stopPropagation()}
            >
                <div className="absolute top-4 right-4 z-20 flex space-x-2">
                    <a 
                        href={imageUrl}
                        download={fileName}
                        className="bg-white/90 backdrop-blur-sm rounded-full p-2.5 text-[#5f6368] hover:text-[#202124] hover:bg-white shadow-google-md transition border border-[#dadce0]"
                        title="Descargar imagen"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </a>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="bg-white/90 backdrop-blur-sm rounded-full p-2.5 text-[#5f6368] hover:text-[#202124] hover:bg-white shadow-google-md transition border border-[#dadce0]"
                        aria-label="Cerrar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex-grow flex items-center justify-center overflow-auto p-2 bg-[#f8fafd] rounded-2xl">
                    <img 
                        src={imageUrl} 
                        alt="Comprobante de Pago" 
                        className="object-contain max-w-full max-h-[80vh] rounded-xl shadow-xs" 
                    />
                </div>
            </div>
             <style>{`
                @keyframes fade-in-scale {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-scale {
                    animation: fade-in-scale 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default ImageViewerModal;