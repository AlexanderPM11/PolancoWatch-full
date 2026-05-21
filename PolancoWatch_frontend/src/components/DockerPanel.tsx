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

    const localStats = {
        all: containers?.length || 0,
        running: containers?.filter(c => c.state === 'running').length || 0,
        stopped: containers?.filter(c => (c.state === 'exited' || c.state === 'created') && !c.status.toLowerCase().includes('exit (1)')).length || 0,
        failed: containers?.filter(c => c.status.toLowerCase().includes('exit') && !c.status.includes('exit (0)')).length || 0
    };

    const Tab = ({ id, label, count, icon: Icon }: { id: FilterStatus, label: string, count: number, icon: any }) => (
        <button
            onClick={() => setFilter(id)}
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
                                onChange={(e) => setSearchTerm(e.target.value)}
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredContainers.map((container) => (
                        <div 
                            key={container.containerId} 
                            className="p-6 rounded-3xl bg-white/2 border border-white/5 hover:bg-white/4 transition-all group relative overflow-hidden flex flex-col justify-between"
                        >
                            {/* Status Indicator Bar */}
                            <div className={`absolute top-0 left-0 w-full h-1 ${
                                container.state === 'running' ? 'bg-brand-secondary' : 
                                container.status.toLowerCase().includes('exit') && !container.status.includes('exit (0)') ? 'bg-brand-accent' : 'bg-slate-700'
                            }`}></div>

                            <div className="flex justify-between items-start mb-6">
                                <div className="flex flex-col min-w-0 pr-4">
                                    <span className="text-sm font-black text-white truncate group-hover:text-brand-primary transition-colors">
                                        {container.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono mt-1 truncate opacity-70">
                                        {container.image}
                                    </span>
                                </div>
                                <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${
                                    container.state === 'running' 
                                        ? 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]' 
                                        : container.status.toLowerCase().includes('exit') && !container.status.includes('exit (0)')
                                        ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/20'
                                        : 'bg-slate-800 text-slate-400 border-white/5'
                                }`}>
                                    {container.state}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        <span>Resources</span>
                                        <span className="text-white font-mono">{container.cpuPercentage.toFixed(1)}% / {(container.memoryUsageBytes / 1024 / 1024).toFixed(0)}MB</span>
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

                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <div className="bg-white/3 p-2 rounded-xl border border-white/5 flex flex-col">
                                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Net I/O</span>
                                        <span className="text-[10px] font-black text-slate-300 font-mono truncate">{container.networkIO || '0B / 0B'}</span>
                                    </div>
                                    <div className="bg-white/3 p-2 rounded-xl border border-white/5 flex flex-col">
                                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Disk I/O</span>
                                        <span className="text-[10px] font-black text-slate-300 font-mono truncate">{container.blockIO || '0B / 0B'}</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between py-2 border-t border-white/5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Status</span>
                                    <span className="text-[10px] text-slate-300 font-bold font-mono truncate max-w-[120px]">
                                        {container.status}
                                    </span>
                                </div>

                                {/* Management Actions */}
                                <div className="flex gap-2 pt-2 border-t border-white/5">
                                    {container.state !== 'running' ? (
                                        <button 
                                            onClick={() => handleAction(container.containerId, 'start')}
                                            disabled={loadingIds.has(container.containerId)}
                                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-brand-secondary/10 border border-brand-secondary/20 text-brand-secondary hover:bg-brand-secondary/20 transition-all text-[9px] font-black uppercase tracking-widest disabled:opacity-50 shadow-inner"
                                        >
                                            <Play size={10} fill="currentColor" />
                                            Start
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleAction(container.containerId, 'stop')}
                                            disabled={loadingIds.has(container.containerId)}
                                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-brand-accent/10 border border-brand-accent/20 text-brand-accent hover:bg-brand-accent/20 transition-all text-[9px] font-black uppercase tracking-widest disabled:opacity-50 shadow-inner"
                                        >
                                            <Square size={10} fill="currentColor" />
                                            Stop
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => handleAction(container.containerId, 'restart')}
                                        disabled={loadingIds.has(container.containerId)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all text-[9px] font-black uppercase tracking-widest disabled:opacity-50 shadow-inner"
                                    >
                                        <RotateCcw size={10} />
                                        Restart
                                    </button>
                                    <button 
                                        onClick={() => setSelectedLogContainer({ id: container.containerId, name: container.name })}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/20 transition-all text-[9px] font-black uppercase tracking-widest shadow-inner"
                                    >
                                        <Terminal size={10} />
                                        Logs
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredContainers.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white/1 rounded-3xl border border-dashed border-white/10">
                            <Box size={48} className="mb-4 text-slate-700 opacity-50" />
                            <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-500">No {filter !== 'all' ? filter : ''} containers found</p>
                        </div>
                    )}
                </div>
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
