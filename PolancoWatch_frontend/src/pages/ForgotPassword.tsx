import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/api';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setLoading(true);

        try {
            const res = await authService.forgotPassword(email);
            if (!res.success) {
                if (res.message.includes('NOTIFICATIONS_NOT_CONFIGURED')) {
                    setError('CRITICAL_SYSTEM_ERROR: NO NOTIFICATION CHANNELS (TELEGRAM/EMAIL) ARE ACTIVE. Contact your administrator.');
                } else if (res.message.includes('ERROR_COOLDOWN_ACTIVE')) {
                    setError('SECURITY_PROTOCOL_COOLDOWN: PLEASE WAIT A FEW MINUTES BEFORE RETRYING.');
                } else {
                    setError(res.message || 'System failed to dispatch link.');
                }
            } else {
                setMessage(res.message || 'The recovery link has been dispatched.');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'CRITICAL: DISPATCH_FAILURE. Check system logs.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-obsidian-950 p-4 text-slate-300 selection:bg-brand-primary/30">
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0" 
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
            </div>

            <div className="glass-panel w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl relative z-10 animate-fade-in">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-linear-to-r from-brand-primary to-brand-secondary opacity-50"></div>
                
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-obsidian-800 border border-white/10 flex items-center justify-center text-brand-primary font-black text-3xl shadow-2xl relative group mb-6">
                        <div className="absolute inset-0 bg-linear-to-br from-brand-primary/20 to-brand-secondary/20 animate-pulse-slow rounded-2xl"></div>
                        <span className="relative z-10 tracking-tighter italic">P</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Reset<span className="text-brand-secondary">Key</span></h1>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-3">Auth_Level_0: Recovery_Protocol</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {message && (
                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase text-center animate-fade-in">
                            {message}
                        </div>
                    )}
                    {error && (
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black uppercase text-center animate-fade-in">
                            {error}
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Registered_Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl border border-white/5 bg-obsidian-900/60 text-white text-sm font-black focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/5 outline-none transition-all placeholder:text-slate-700 uppercase tracking-widest"
                            placeholder="ADMIN@EXAMPLE.COM"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-5 px-6 rounded-2xl bg-brand-primary text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-primary/20 hover:bg-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {loading ? 'REQUESTING_KEY...' : 'DISPATCH_RECOVERY_LINK'}
                    </button>

                    <div className="text-center mt-6">
                        <Link to="/login" className="text-[10px] text-brand-secondary hover:text-white font-black uppercase tracking-widest transition-colors">
                            Return_to_Login
                        </Link>
                    </div>

                    <p className="text-[8px] text-slate-600 text-center uppercase font-black tracking-[0.4em] pt-4 mt-4 border-t border-white/5 italic">
                        PolancoWatch CORE_V1 // Recovery System
                    </p>
                </form>
            </div>
        </div>
    );
}
