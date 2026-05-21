import { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 4000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (type !== 'loading') {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for fade out
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [type, duration, onClose]);

  const icons = {
    success: <CheckCircle2 className="text-emerald-400" size={18} />,
    error: <AlertCircle className="text-rose-400" size={18} />,
    info: <Info className="text-brand-primary" size={18} />,
    loading: <Loader2 className="text-brand-secondary animate-spin" size={18} />
  };

  const backgrounds = {
    success: 'bg-emerald-500/10 border-emerald-500/20',
    error: 'bg-rose-500/10 border-rose-500/20',
    info: 'bg-brand-primary/10 border-brand-primary/20',
    loading: 'bg-white/5 border-white/10'
  };

  return (
    <div className={`fixed bottom-8 right-8 z-200 transition-all duration-300 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-xl ${backgrounds[type]} shadow-2xl`}>
        {icons[type]}
        <span className="text-xs font-medium text-white tracking-tight">{message}</span>
        {type !== 'loading' && (
          <button onClick={() => setIsVisible(false)} className="ml-2 text-white/30 hover:text-white transition-colors">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
