import React, { useState } from 'react';
import { Box, CheckCircle2, XCircle, AlertCircle, Play, Square, RotateCcw, Image, Database, Terminal, Search } from 'lucide-react';
import Modal from './Modal';
import { LogViewer } from './LogViewer';
import type { DockerContainerMetrics, DockerStats } from '../hooks/useMetrics';
import { dockerService } from '../services/api';

interface DockerPanelProps {
    containers: DockerContainerMetrics[];
    stats?: DockerStats;
}

type FilterStatus = 'all' | 'running' | 'stopped' | 'failed';

export const DockerPanel: React.FC<DockerPanelProps> = ({ containers, stats: globalStats }) => {
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const [selectedLogContainer, setSelectedLogContainer] = useState<{ id: string, name: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const handleAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
        setLoadingIds(prev => new Set(prev).add(id));
        try {
            if (action === 'start') await dockerService.startContainer(id);
            else if (action === 'stop') await dockerService.stopContainer(id);
            else if (action === 'restart') await dockerService.restartContainer(id);
        } catch (error) {
            console.error(`Failed to ${action} container:`, error);
        } finally {
            setLoadingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const filteredContainers = (containers || []).filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              c.containerId.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesTabFilter = true;
        if (filter === 'running') matchesTabFilter = c.state === 'running';
        else if (filter === 'stopped') matchesTabFilter = (c.state === 'exited' || c.state === 'created') && !c.status.toLowerCase().includes('exit (1)');
        else if (filter === 'failed') matchesTabFilter = c.status.toLowerCase().includes('exit') && !c.status.includes('exit (0)');
        
        return matchesSearch && matchesTabFilter;
    });

    const totalPages = Math.max(1, Math.ceil(filteredContainers.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedContainers = filteredContainers.slice(startIndex, startIndex + itemsPerPage);

    const localStats = {
        all: containers?.length || 0,
        running: containers?.filter(c => c.state === 'running').length || 0,
        stopped: containers?.filter(c => (c.state === 'exited' || c.state === 'created') && !c.status.toLowerCase().includes('exit (1)')).length || 0,
        failed: containers?.filter(c => c.status.toLowerCase().includes('exit') && !c.status.includes('exit (0)')).length || 0
    };

    const Tab = ({ id, label, count, icon: Icon }: { id: FilterStatus, label: string, count: number, icon: any }) => (
        <button
            onClick={() => { setFilter(id); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 border font-bold text-[10px] uppercase tracking-widest ${
                filter === id 
                    ? 'bg-brand-primary/20 border-brand-primary/40 text-white shadow-[0_0_15px_rgba(139,92,246,0.2)]' 
                    : 'bg-white/2 border-white/5 text-slate-500 hover:bg-white/5 hover:text-slate-300'
            }`}
        >
            <Icon size={14} className={filter === id ? 'text-brand-primary' : 'opacity-50'} />
            {label}
            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] ${
                filter === id ? 'bg-brand-primary/30 text-white' : 'bg-white/10 text-slate-400'
            }`}>
                {count}
            </span>
        </button>
    );

    return (
        <div className="flex flex-col gap-8">
            {/* Global Analytics Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-6 rounded-3xl border-white/5 flex items-center gap-4 bg-linear-to-br from-brand-primary/5 to-transparent">
                    <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                        <Database size={20} className="text-brand-primary" />
                    </div>
                    <div>
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-tight">Total Containers</span>
                        <h4 className="text-2xl font-black text-white leading-none mt-1">{globalStats?.totalContainers || localStats.all}</h4>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-3xl border-white/5 flex items-center gap-4 bg-linear-to-br from-brand-secondary/5 to-transparent">
                    <div className="w-12 h-12 rounded-2xl bg-brand-secondary/10 flex items-center justify-center border border-brand-secondary/20">
                        <CheckCircle2 size={20} className="text-brand-secondary" />
                    </div>
                    <div>
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-tight">Running</span>
                        <h4 className="text-2xl font-black text-white leading-none mt-1">{globalStats?.runningContainers || localStats.running}</h4>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-3xl border-white/5 flex items-center gap-4 bg-linear-to-br from-brand-accent/5 to-transparent">
                    <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 flex items-center justify-center border border-brand-accent/20">
                        <AlertCircle size={20} className="text-brand-accent" />
                    </div>
                    <div>
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-tight">Stopped / Failed</span>
                        <h4 className="text-2xl font-black text-white leading-none mt-1">{(globalStats?.stoppedContainers || localStats.stopped + localStats.failed)}</h4>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-3xl border-white/5 flex items-center gap-4 bg-linear-to-br from-white/5 to-transparent">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                        <Image size={20} className="text-slate-300" />
                    </div>
                    <div>
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-tight">Total Images</span>
                        <h4 className="text-2xl font-black text-white leading-none mt-1">{globalStats?.totalImages || 0}</h4>
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-4xl p-8 border-white/5">
                <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-[10px] font-black uppercase tracking-widest mb-6">
                            <Box size={12} /> Container Orchestration
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-4 italic">Docker <span className="text-brand-primary">Engine</span></h1>
                        <p className="text-slate-400 max-w-xl text-sm leading-relaxed uppercase tracking-tight">
                            Direct interface for container lifecycle management. Monitor resources and execute kernel-level operations in real-time.
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                        <div className="relative w-full md:w-64 group">
                            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-primary transition-colors" />
                            <input 
                                type="text" 
                                placeholder="Search containers..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="w-full bg-obsidian-900/50 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-[11px] font-black uppercase tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-primary/30 transition-all"
                            />
                        </div>
                    </div>
                </header>

                <div className="flex flex-wrap gap-2 mb-8">
                    <Tab id="all" label="All" count={localStats.all} icon={Box} />
                    <Tab id="running" label="Active" count={localStats.running} icon={CheckCircle2} />
                    <Tab id="stopped" label="Stopped" count={localStats.stopped} icon={XCircle} />
                    <Tab id="failed" label="Failed" count={localStats.failed} icon={AlertCircle} />
                </div>

                <div className="glass-panel rounded-3xl border-white/5 bg-obsidian-950/40 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/2">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Container</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Resources</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">I/O</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {paginatedContainers.map((container) => (
                                    <tr key={container.containerId} className="hover:bg-white/5 transition-colors group relative">
                                        <td className="px-6 py-4 relative">
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                                container.state === 'running' ? 'bg-brand-secondary' : 
                                                container.status.toLowerCase().includes('exit') && !container.status.includes('exit (0)') ? 'bg-brand-accent' : 'bg-slate-700'
                                            }`}></div>
                                            <div className="flex flex-col ml-2">
                                                <span className="text-xs font-black text-white truncate max-w-[200px] group-hover:text-brand-primary transition-colors" title={container.name}>
                                                    {container.name}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[200px]" title={container.image}>
                                                    {container.image}
                                                </span>
                                            </div>
                                        </td>
                                        
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 w-32">
                                                <div className="flex justify-between text-[9px] font-mono font-bold text-white">
                                                    <span>{container.cpuPercentage.toFixed(1)}%</span>
                                                    <span>{(container.memoryUsageBytes / 1024 / 1024).toFixed(0)} MB</span>
                                                </div>
                                                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${
                                                            container.cpuPercentage > 80 ? 'bg-brand-accent' : 'bg-brand-primary'
                                                        }`}
                                                        style={{ width: `${Math.min(container.cpuPercentage * 2, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-mono text-slate-400"><span className="text-brand-secondary opacity-50">N:</span> {container.networkIO || '0B / 0B'}</span>
                                                <span className="text-[9px] font-mono text-slate-400"><span className="text-brand-primary opacity-50">D:</span> {container.blockIO || '0B / 0B'}</span>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter border ${
                                                    container.state === 'running' 
                                                        ? 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]' 
                                                        : container.status.toLowerCase().includes('exit') && !container.status.includes('exit (0)')
                                                        ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/20'
                                                        : 'bg-slate-800 text-slate-400 border-white/5'
                                                }`}>
                                                    {container.state}
                                                </span>
                                                <span className="text-[9px] text-slate-500 font-mono truncate max-w-[150px]" title={container.status}>
                                                    {container.status}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            <div className="flex gap-1.5 justify-end">
                                                {container.state !== 'running' ? (
                                                    <button 
                                                        onClick={() => handleAction(container.containerId, 'start')}
                                                        disabled={loadingIds.has(container.containerId)}
                                                        className="p-1.5 rounded-lg bg-brand-secondary/10 border border-brand-secondary/20 text-brand-secondary hover:bg-brand-secondary/20 transition-all disabled:opacity-50"
                                                        title="Start"
                                                    >
                                                        <Play size={14} fill="currentColor" />
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleAction(container.containerId, 'stop')}
                                                        disabled={loadingIds.has(container.containerId)}
                                                        className="p-1.5 rounded-lg bg-brand-accent/10 border border-brand-accent/20 text-brand-accent hover:bg-brand-accent/20 transition-all disabled:opacity-50"
                                                        title="Stop"
                                                    >
                                                        <Square size={14} fill="currentColor" />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleAction(container.containerId, 'restart')}
                                                    disabled={loadingIds.has(container.containerId)}
                                                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50"
                                                    title="Restart"
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => setSelectedLogContainer({ id: container.containerId, name: container.name })}
                                                    className="p-1.5 rounded-lg bg-brand-primary/10 border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/20 transition-all"
                                                    title="Logs"
                                                >
                                                    <Terminal size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredContainers.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 bg-white/1 border-t border-dashed border-white/5">
                            <Box size={32} className="mb-4 text-slate-700 opacity-50" />
                            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">No {filter !== 'all' ? filter : ''} containers found</p>
                        </div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-6">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            Previous
                        </button>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            <Modal
                isOpen={!!selectedLogContainer}
                onClose={() => setSelectedLogContainer(null)}
                title={selectedLogContainer ? `Kernel Output: ${selectedLogContainer.name}` : ''}
            >
                {selectedLogContainer && (
                    <LogViewer 
                        containerId={selectedLogContainer.id}
                        containerName={selectedLogContainer.name}
                    />
                )}
            </Modal>
        </div>
    );
};
