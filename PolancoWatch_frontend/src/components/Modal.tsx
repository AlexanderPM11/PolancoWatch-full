import React, { useEffect } from 'react';
import { X, AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    type?: 'danger' | 'info' | 'success' | 'warning';
    footer?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, type = 'info', footer }: ModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleEscape);
        }
        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const typeIcons = {
        danger: <ShieldAlert className="text-rose-500" size={24} />,
        warning: <AlertTriangle className="text-amber-500" size={24} />,
        success: <CheckCircle2 className="text-emerald-500" size={24} />,
        info: <Info className="text-brand-primary" size={24} />
    };

    const typeStyles = {
        danger: 'border-rose-500/20 shadow-[0_0_40px_rgba(244,63,94,0.1)]',
        warning: 'border-amber-500/20 shadow-[0_0_40px_rgba(245,158,11,0.1)]',
        success: 'border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.1)]',
        info: 'border-brand-primary/20 shadow-[0_0_40px_rgba(167,139,250,0.1)]'
    };

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-obsidian-950/80 backdrop-blur-md animate-fade-in"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className={`relative w-full max-w-lg glass-panel rounded-4xl border ${typeStyles[type]} p-8 animate-float-up`}>
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl bg-white/5 border border-white/5`}>
                            {typeIcons[type]}
                        </div>
                        <h2 className="text-xl font-black text-white tracking-tight uppercase">{title}</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="mb-10 text-slate-400 text-sm leading-relaxed uppercase tracking-tight font-medium">
                    {children}
                </div>

                {footer && (
                    <div className="flex items-center justify-end gap-4 pt-6 border-t border-white/5">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
