import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setLoading(true);

        try {
            await authService.login(username, password);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-obsidian-950 p-4 text-slate-300 selection:bg-brand-primary/30">
            {/* Background Texture Overlay */}
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
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Polanco<span className="text-brand-secondary">Watch</span></h1>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-3">Auth_Level_0: Identity_Check</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {successMessage && (
                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase text-center animate-fade-in">
                            {successMessage}
                        </div>
                    )}
                    {error && (
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black uppercase text-center animate-fade-in">
                            {error}
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Identity_Handle</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl border border-white/5 bg-obsidian-900/60 text-white text-sm font-black focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/5 outline-none transition-all placeholder:text-slate-700 uppercase tracking-widest"
                            placeholder="ADMIN_USER"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Security_Key</label>
                        <div className="relative group/field">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-6 py-4 rounded-2xl border border-white/5 bg-obsidian-900/60 text-white text-sm focus:border-brand-secondary/50 focus:ring-4 focus:ring-brand-secondary/5 outline-none transition-all placeholder:text-slate-700 font-mono pr-14"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-brand-secondary transition-colors p-2"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <div className="flex justify-end mt-2">
                            <button 
                                type="button"
                                onClick={async () => {
                                    if (!username) {
                                        setError('IDENTITY_HANDLE_REQUIRED: PLEASE ENTER USERNAME FIRST.');
                                        return;
                                    }
                                    setLoading(true);
                                    setError('');
                                    setSuccessMessage('');
                                    try {
                                        const res = await authService.forgotPassword(undefined, username);
                                        if (res.success) {
                                            setSuccessMessage(`${res.message}`);
                                        } else {
                                            if (res.message.includes('NOTIFICATIONS_NOT_CONFIGURED')) {
                                                setError('SECURITY_ERROR: NO NOTIFICATION CHANNELS (TELEGRAM/EMAIL) ARE ACTIVE.');
                                            } else if (res.message.includes('ERROR_COOLDOWN_ACTIVE')) {
                                                setError('SECURITY_PROTOCOL_COOLDOWN: PLEASE WAIT A FEW MINUTES BEFORE RETRYING.');
                                            } else {
                                                setError(`ERROR: ${res.message}`);
                                            }
                                        }
                                    } catch (err: any) {
                                        setError('CRITICAL_FAILURE: UNABLE TO CONTACT SECURITY BROKER.');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="text-[9px] text-slate-500 hover:text-brand-primary font-black uppercase tracking-widest transition-colors cursor-pointer bg-transparent border-none p-0"
                            >
                                Forgotten_Security_Key?
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-5 px-6 rounded-2xl bg-brand-primary text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-primary/20 hover:bg-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {loading ? 'ESTABLISHING_LINK...' : 'INITIALIZE_SESSION'}
                    </button>

                    <p className="text-[8px] text-slate-600 text-center uppercase font-black tracking-[0.4em] pt-4 mt-4 border-t border-white/5 italic">
                        PolancoWatch CORE_V1 // Restricted Access
                    </p>
                </form>
            </div>
        </div>
    );
}
