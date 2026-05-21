import { useState } from 'react';
import { useMetrics } from '../hooks/useMetrics';
import { Terminal, Search, Trash2, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import Modal from '../components/Modal';

export default function Processes() {
    const { metrics } = useMetrics();
    const [searchTerm, setSearchTerm] = useState('');
    const [isKilling, setIsKilling] = useState<number | null>(null);
    const [confirmPid, setConfirmPid] = useState<number | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'cpu' | 'ram'>('cpu');


    const sortedProcesses = [...(metrics?.topProcesses || [])].sort((a, b) => {
        if (sortBy === 'cpu') return b.cpuUsagePercentage - a.cpuUsagePercentage;
        return b.memoryUsageBytes - a.memoryUsageBytes;
    });

    const filteredProcesses = sortedProcesses.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.processId.toString().includes(searchTerm)
    );


    const handleKill = async (pid: number) => {
        setIsKilling(pid);
        try {
            await api.post(`/api/metrics/processes/${pid}/kill`);
            setConfirmPid(null);
        } catch (err: any) {
            console.error("Failed to kill process:", err);
            const msg = err.response?.data?.message || "Internal system failure while attempting termination.";
            setErrorMsg(msg);
        } finally {
            setIsKilling(null);
        }
    };

    const selectedProc = metrics?.topProcesses?.find(p => p.processId === confirmPid);

    return (
        <div className="w-full">
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
                {/* Modals */}
                <Modal 
                    isOpen={!!confirmPid} 
                    onClose={() => setConfirmPid(null)}
                    title="Terminal Sequence Authorization"
                    type="warning"
                    footer={
                        <>
                            <button 
                                onClick={() => setConfirmPid(null)}
                                className="px-5 py-2 text-xs font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                            >
                                Abort
                            </button>
                            <button 
                                onClick={() => selectedProc && handleKill(selectedProc.processId)}
                                disabled={isKilling !== null}
                                className="px-6 py-2.5 bg-brand-accent text-white text-xs font-black rounded-xl hover:bg-rose-500 transition-all uppercase tracking-widest shadow-lg shadow-rose-500/20"
                            >
                                {isKilling ? 'PROCESSING...' : 'CONFIRM TERMINATION'}
                            </button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <p>You are about to issue a <span className="text-white font-bold">SIGKILL</span> command to the following process tree:</p>
                        <div className="p-4 bg-obsidian-950 rounded-2xl border border-white/5 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-secondary">
                                <Terminal size={18} />
                            </div>
                            <div>
                                <div className="text-white font-black text-sm uppercase tracking-tight">{selectedProc?.name}</div>
                                <div className="text-slate-500 font-mono text-xs">PID: #{confirmPid}</div>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-500 italic">This action is irreversible and may lead to data corruption in persistent services.</p>
                    </div>
                </Modal>

                <Modal
                    isOpen={!!errorMsg}
                    onClose={() => setErrorMsg(null)}
                    title="Access Denied / System Failure"
                    type="danger"
                    footer={
                        <button 
                            onClick={() => setErrorMsg(null)}
                            className="px-6 py-2.5 bg-white/5 text-white text-xs font-black rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest"
                        >
                            Dismiss
                        </button>
                    }
                >
                    <div className="space-y-4">
                        <div className="p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10 text-rose-400 text-xs font-medium leading-relaxed italic">
                            {errorMsg}
                        </div>
                        {errorMsg?.includes('Access Denied') && (
                            <div className="p-4 bg-obsidian-950 rounded-2xl border border-white/5">
                                <h4 className="text-white text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <ShieldAlert size={12} className="text-brand-secondary" /> Mitigation Hint
                                </h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed uppercase">
                                    PolancoWatch requires elevated privileges to manage external processes. Ensure the backend service is running with <span className="text-brand-secondary font-bold">Admin/Root</span> permissions on the host.
                                </p>
                            </div>
                        )}
                    </div>
                </Modal>

                <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-[10px] font-black uppercase tracking-widest mb-6">
                            <Terminal size={12} /> Resource Manager
                        </div>
                        <h1 className="text-5xl font-black text-white tracking-tighter mb-4 italic">Process <span className="text-brand-secondary">Lifecycle</span></h1>
                        <p className="text-slate-400 max-w-xl text-sm leading-relaxed uppercase tracking-tight">
                            Monitor and manage active system tasks. Use caution when terminating persistent services or kernel-level dependencies.
                        </p>
                    </div>

                    <div className="flex flex-col gap-4">
                         <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-primary transition-colors" size={18} />
                            <input 
                                type="text" 
                                placeholder="SEARCH PID_OR_NAME..."
                                value={searchTerm}
                                 onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-obsidian-900/60 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-sm font-black text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/5 w-full md:w-80 transition-all uppercase tracking-widest"
                            />
                        </div>

                        <div className="flex bg-obsidian-900/60 p-1 rounded-2xl border border-white/5">
                            <button 
                                onClick={() => setSortBy('cpu')}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${sortBy === 'cpu' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Sort by CPU
                            </button>
                            <button 
                                onClick={() => setSortBy('ram')}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${sortBy === 'ram' ? 'bg-brand-secondary text-white shadow-lg shadow-brand-secondary/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Sort by RAM
                            </button>
                        </div>
                    </div>
                </header>

                {/* Processes Table */}
                <div className="glass-panel rounded-4xl border-white/5 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/2">
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">PID</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">PROCESS_IDENTITY</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">CPU_LOAD</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">RESIDENT_MEM</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">OPERATIONS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredProcesses.map((proc) => (
                                    <tr key={proc.processId} className="hover:bg-white/2 transition-colors group">
                                        <td className="px-8 py-6 font-mono text-xs font-black text-slate-500">#{proc.processId}</td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-obsidian-900 border border-white/5 flex items-center justify-center text-brand-secondary group-hover:scale-110 transition-transform">
                                                    <Terminal size={14} />
                                                </div>
                                                <span className="text-sm font-black text-white tracking-tight uppercase">{proc.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-16 bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-brand-primary h-full rounded-full" style={{ width: `${Math.min(proc.cpuUsagePercentage, 100)}%` }}></div>
                                                </div>
                                                <span className="font-mono text-xs font-black text-white">{proc.cpuUsagePercentage.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="font-mono text-xs font-black text-slate-300">{(proc.memoryUsageBytes / 1024 / 1024).toFixed(1)} <span className="text-slate-500">MB</span></span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button 
                                                onClick={() => setConfirmPid(proc.processId)}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/5 hover:bg-rose-500/20 border border-rose-500/10 hover:border-rose-500/30 text-rose-500/70 hover:text-rose-500 rounded-xl transition-all group/btn"
                                                title="Kill Process"
                                            >
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover/btn:opacity-100 transition-opacity">Terminate</span>
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {!filteredProcesses.length && (
                    <div className="flex flex-col items-center justify-center py-24 glass-panel rounded-4xl border-white/5 border-dashed">
                         <div className="w-16 h-16 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-slate-600 mb-6 font-mono text-2xl font-black">?</div>
                         <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">No active tasks found</h3>
                         <p className="text-xs text-slate-500 uppercase font-bold text-center leading-relaxed">Adjust your search parameters or check <br/>system connection status.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
