import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/api';
import { Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            setError('Invalid or missing recovery token.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (password !== confirmPassword) {
            setError('PASSWORDS_DO_NOT_MATCH');
            return;
        }

        if (!token) {
            setError('MISSING_TOKEN');
            return;
        }

        setLoading(true);

        try {
            const res = await authService.resetPassword(token, password);
            setMessage(res.message || 'PASSWORD_SECURED_SUCCESSFULLY');
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'RECOVERY_LINK_EXPIRED_OR_INVALID');
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
                    <div className="w-16 h-16 rounded-2xl bg-obsidian-800 border border-white/10 flex items-center justify-center text-brand-secondary font-black text-3xl shadow-2xl relative group mb-6">
                        <div className="absolute inset-0 bg-linear-to-br from-brand-secondary/20 to-brand-primary/20 animate-pulse-slow rounded-2xl"></div>
                        <span className="relative z-10 tracking-tighter italic">P</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Secure<span className="text-brand-primary">Update</span></h1>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-3">Auth_Level_1: Key_Redefinition</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {message && (
                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase text-center animate-fade-in">
                            {message}. REDIRECTING...
                        </div>
                    )}
                    {error && (
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black uppercase text-center animate-fade-in">
                            {error}
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">New_Security_Key</label>
                        <div className="relative group/field">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-6 py-4 rounded-2xl border border-white/5 bg-obsidian-900/60 text-white text-sm focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/5 outline-none transition-all placeholder:text-slate-700 font-mono pr-14"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-brand-primary transition-colors p-2"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Confirm_Security_Key</label>
                        <div className="relative group/field">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-6 py-4 rounded-2xl border border-white/5 bg-obsidian-900/60 text-white text-sm focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/5 outline-none transition-all placeholder:text-slate-700 font-mono pr-14"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-brand-primary transition-colors p-2"
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !token}
                        className="w-full py-5 px-6 rounded-2xl bg-brand-secondary text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-secondary/20 hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {loading ? 'REDEFINING_KEY...' : 'SECURE_NEW_PASSWORD'}
                    </button>

                    <p className="text-[8px] text-slate-600 text-center uppercase font-black tracking-[0.4em] pt-4 mt-4 border-t border-white/5 italic">
                        PolancoWatch CORE_V1 // Critical System Override
                    </p>
                </form>
            </div>
        </div>
    );
}

