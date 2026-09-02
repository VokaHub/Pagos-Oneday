
import React, { useState, useEffect, useRef } from 'react';

interface HeaderProps {
    onSave: () => void;
    onOpen: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    isFocusMode?: boolean;
    onToggleFocusMode?: () => void;
    onNavigateToClientPortal?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    onSave, 
    onOpen, 
    onUndo, 
    onRedo, 
    canUndo, 
    canRedo,
    isFocusMode,
    onToggleFocusMode,
    onNavigateToClientPortal,
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <header className="bg-white border-b border-[#e0e3e7] shadow-xs sticky top-0 z-40">
            <div className="container mx-auto px-4 md:px-6 lg:px-8 py-3.5 flex items-center justify-between">
                {/* Brand & App Title */}
                <div className="flex items-center space-x-3.5">
                    <div className="flex-shrink-0 h-11 w-11 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-google-sm text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-2m0-4h.01M12 18.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13z" />
                        </svg>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-[#202124] tracking-tight">
                                Control de Pagos
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                ONEDAY
                            </span>
                        </div>
                        <p className="text-xs text-[#5f6368] font-medium hidden sm:block">
                            {isFocusMode ? '⚡ Modo Enfoque Activo: Cuadre Rápido' : 'Sistema Integral de Cobros y Conciliación'}
                        </p>
                    </div>
                </div>

                {/* Right controls: Portal Clientes, Focus Toggle, Undo/Redo, Menu Dropdown */}
                <div className="flex items-center space-x-2 sm:space-x-2.5">
                    {/* Clean Public Client Portal Button */}
                    {onNavigateToClientPortal && (
                        <button
                            type="button"
                            onClick={onNavigateToClientPortal}
                            className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#0f172a] hover:bg-[#1e293b] text-white transition-colors flex items-center gap-2 shadow-xs shrink-0"
                            title="Abrir Portal de Clientes para cobros y comprobantes"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>Portal Clientes</span>
                        </button>
                    )}

                    {/* Focus Mode Pill Button */}
                    {onToggleFocusMode && (
                        <button
                            type="button"
                            onClick={onToggleFocusMode}
                            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shadow-xs shrink-0 ${
                                isFocusMode
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-google-sm ring-2 ring-amber-200'
                                    : 'bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043]'
                            }`}
                            title="Alternar Modo Enfoque para cuadre rápido"
                        >
                            <span className={`w-2 h-2 rounded-full ${isFocusMode ? 'bg-white' : 'bg-gray-400'}`}></span>
                            <span className="hidden md:inline">{isFocusMode ? 'Enfoque ON' : 'Enfoque'}</span>
                        </button>
                    )}

                    {/* Undo / Redo Round Icon Buttons */}
                    <div className="flex items-center bg-[#f8fafd] p-1 rounded-xl border border-[#e0e3e7] shrink-0">
                        <button 
                            onClick={onUndo} 
                            disabled={!canUndo} 
                            title="Deshacer (Ctrl+Z)" 
                            className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition text-[#3c4043]"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11 15l-3-3m0 0l3-3m-3 3h8a5 5 0 010 10H6" />
                            </svg>
                        </button>
                        <button 
                            onClick={onRedo} 
                            disabled={!canRedo} 
                            title="Rehacer (Ctrl+Y)" 
                            className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition text-[#3c4043]"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 15l3-3m0 0l-3-3m3 3H8a5 5 0 000 10h1" />
                            </svg>
                        </button>
                    </div>

                    {/* Options & Sync Dropdown (Stable width, never shifts header) */}
                    <div className="relative inline-block text-left shrink-0" ref={dropdownRef}>
                        <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-xl border border-[#dadce0] px-3.5 py-2 bg-white text-xs sm:text-sm font-semibold text-[#3c4043] hover:bg-[#f8fafd] hover:border-[#bdc1c6] shadow-xs focus:outline-none transition"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-[#5f6368]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            <span>Opciones</span>
                            <svg className="-mr-0.5 ml-1 h-3.5 w-3.5 text-[#5f6368]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {isDropdownOpen && (
                            <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-2xl shadow-google-md bg-white border border-[#e0e3e7] p-1.5 focus:outline-none z-50 animate-in fade-in zoom-in-95 duration-100">
                                <div className="py-1" role="menu">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); onSave(); setIsDropdownOpen(false); }}
                                        className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#202124] hover:bg-[#f1f3f4] rounded-xl transition cursor-pointer"
                                        role="menuitem"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                        <span>Guardar Sesión (.json)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); onOpen(); setIsDropdownOpen(false); }}
                                        className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#202124] hover:bg-[#f1f3f4] rounded-xl transition cursor-pointer"
                                        role="menuitem"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        <span>Cargar Sesión (.json)</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
