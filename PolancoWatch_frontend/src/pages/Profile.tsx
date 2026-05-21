import React, { useState } from 'react';
import { User, ShieldCheck, AlertCircle, Save, KeyRound, Fingerprint, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/api';

export default function Profile() {
    const currentUsername = localStorage.getItem('username') || 'Admin';
    const [newUsername, setNewUsername] = useState(currentUsername);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showVerifyPassword, setShowVerifyPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        if (newPassword && newPassword !== confirmPassword) {
            setErrorMsg("New passwords do not match.");
            return;
        }

        if (newPassword && newPassword.length < 6) {
            setErrorMsg("New password must be at least 6 characters.");
            return;
        }

        setIsSubmitting(true);
        try {
            await authService.updateProfile(currentPassword, newUsername !== currentUsername ? newUsername : undefined, newPassword || undefined);
            setSuccessMsg("Identity parameters updated successfully.");
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            const msg = err.response?.data?.message || "Failed to update profile. Verification failed.";
            setErrorMsg(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full">
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
                <header className="mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-secondary/10 border border-brand-secondary/20 text-brand-secondary text-[10px] font-black uppercase tracking-widest mb-6">
                        <Fingerprint size={12} /> Identity Management
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-4 italic">User <span className="text-brand-primary">Profile</span></h1>
                    <p className="text-slate-400 max-w-xl text-sm leading-relaxed uppercase tracking-tight">
                        Modify your authentication credentials and system identity. Changes to your username will regenerate your security token.
                    </p>
                </header>

                <div className="grid grid-cols-1 gap-8">
                    <form onSubmit={handleUpdate} className="glass-panel rounded-4xl border-white/5 p-8 lg:p-12 space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {/* Identity Section */}
                            <div className="space-y-6">
                                <h3 className="text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
                                    <User size={16} className="text-brand-primary" /> Core Identity
                                </h3>
                                
                                <div className="space-y-4">
                                    <div className="relative group">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">System Username</label>
                                        <input 
                                            type="text" 
                                            value={newUsername}
                                            onChange={(e) => setNewUsername(e.target.value)}
                                            className="w-full bg-obsidian-900/60 border border-white/5 rounded-2xl px-6 py-4 text-sm font-black text-white focus:outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/5 transition-all uppercase tracking-widest"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 italic uppercase">Your current handle is <span className="text-white font-bold">{currentUsername}</span></p>
                                </div>
                            </div>

                            {/* Security Section */}
                            <div className="space-y-6">
                                <h3 className="text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
                                    <KeyRound size={16} className="text-brand-secondary" /> Security Overhaul
                                </h3>
                                
                                <div className="space-y-4">
                                    <div className="relative group">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">New Passphrase (Optional)</label>
                                        <div className="relative group/field">
                                            <input 
                                                type={showNewPassword ? "text" : "password"} 
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="LEAVE BLANK TO KEEP"
                                                className="w-full bg-obsidian-900/60 border border-white/5 rounded-2xl px-6 py-4 text-sm font-black text-white placeholder:text-slate-700 focus:outline-none focus:border-brand-secondary/50 focus:ring-4 focus:ring-brand-secondary/5 transition-all font-mono pr-14"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-brand-secondary transition-colors p-2"
                                            >
                                                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative group">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Confirm Transformation</label>
                                        <div className="relative group/field">
                                            <input 
                                                type={showConfirmPassword ? "text" : "password"} 
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="REPEAT NEW PASSPHRASE"
                                                className="w-full bg-obsidian-900/60 border border-white/5 rounded-2xl px-6 py-4 text-sm font-black text-white placeholder:text-slate-700 focus:outline-none focus:border-brand-secondary/50 focus:ring-4 focus:ring-brand-secondary/5 transition-all font-mono pr-14"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-brand-secondary transition-colors p-2"
                                            >
                                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Verification Barrier */}
                        <div className="pt-8 border-t border-white/5">
                            <div className="max-w-md">
                                <label className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em] mb-4 block">Verification Required</label>
                                <div className="relative group">
                                    <div className="relative group/field">
                                        <input 
                                            type={showVerifyPassword ? "text" : "password"} 
                                            required
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="ENTER CURRENT PASSPHRASE TO AUTHORIZE"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-black text-white placeholder:text-white/20 focus:outline-none focus:border-brand-primary/50 transition-all font-mono pr-14"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowVerifyPassword(!showVerifyPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-brand-primary transition-colors p-2"
                                        >
                                            {showVerifyPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4">
                            <div className="flex-1 w-full">
                                {errorMsg && (
                                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400 text-xs font-black uppercase animate-fade-in">
                                        <AlertCircle size={18} />
                                        {errorMsg}
                                    </div>
                                )}
                                {successMsg && (
                                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-400 text-xs font-black uppercase animate-fade-in">
                                        <ShieldCheck size={18} />
                                        {successMsg}
                                    </div>
                                )}
                            </div>

                            <button 
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full md:w-auto px-10 py-5 bg-brand-primary text-white text-xs font-black rounded-2xl hover:bg-violet-500 transition-all uppercase tracking-[0.2em] shadow-2xl shadow-brand-primary/20 flex items-center justify-center gap-3 group disabled:opacity-50"
                            >
                                <Save size={18} className="group-hover:scale-110 transition-transform" />
                                {isSubmitting ? 'PROCESSING_REQUEST...' : 'COMMIT_CHANGES'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
