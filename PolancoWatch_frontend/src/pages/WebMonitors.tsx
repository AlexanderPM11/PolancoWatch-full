import { useState, useEffect } from 'react';
import { 
    Activity, 
    Plus, 
    Trash2, 
    ShieldCheck, 
    RefreshCw,
    Search,
    Filter,
    Pencil,
    Eye,
    Bell,
    BellOff,
    Power
} from 'lucide-react';
import { webMonitorService } from '../services/api';
import type { WebMonitor, WebMonitorDailyStats } from '../services/api';
import Modal from '../components/Modal';
import { Link } from 'react-router-dom';

const formatInterval = (seconds: number): string => {
    if (seconds >= 86400 && seconds % 86400 === 0) return `${seconds / 86400}d`;
    if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600}h`;
    if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60}m`;
    return `${seconds}s`;
};



const MonitorRow = ({ monitor, confirmDelete, onEdit, onToggleNotify, onToggleActive }: { 
    monitor: WebMonitor, 
    confirmDelete: (id: number) => void,
    onEdit: (monitor: WebMonitor) => void,
    onToggleNotify: (id: number) => void,
    onToggleActive: (id: number) => void
}) => {
    const [todayStat, setTodayStat] = useState<WebMonitorDailyStats | null>(null);

    useEffect(() => {
        const fetchTodayStat = async () => {
            try {
                const stats = await webMonitorService.getStats(monitor.id, 1);
                if (stats.length > 0) setTodayStat(stats[0]);
            } catch (err) {
                console.error("Failed to fetch today's stats", err);
            }
        };
        fetchTodayStat();
    }, [monitor.id, monitor.lastCheckTime]);

    const isUp = monitor.status === 0;
    const isChecking = monitor.status === 1;
    const isSlow = monitor.status === 3;

    return (
        <div className="flex items-center gap-4 py-3 px-6 border-b border-white/5 hover:bg-white/2 transition-all group">
            <div 
                className="w-8 flex justify-center cursor-help"
                title={!monitor.isActive ? 'Monitor Disabled' : monitor.lastCheckTime ? `Last Check: ${new Date(monitor.lastCheckTime).toLocaleString('es-DO', { 
                    timeZone: 'America/Santo_Domingo',
                    dateStyle: 'medium',
                    timeStyle: 'medium'
                })}` : 'Never Checked'}
            >
                {!monitor.isActive ? (
                   <div className="w-2.5 h-2.5 rounded-full bg-slate-600 shadow-[0_0_8px_rgba(71,85,105,0.2)]"></div>
                ) : isChecking ? (
                    <RefreshCw size={14} className="text-amber-400 animate-spin" />
                ) : isSlow ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse"></div>
                ) : (
                    <div className={`w-2.5 h-2.5 rounded-full ${isUp ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)] animate-pulse' : 'bg-rose-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]'}`}></div>
                )}
            </div>

            {/* Identity & URL */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white truncate group-hover:text-brand-primary transition-colors">
                        {monitor.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-[8px] font-black uppercase tracking-widest text-slate-500">
                        {formatInterval(monitor.checkIntervalSeconds)}
                    </span>
                </div>
                <p className="text-[10px] font-medium text-slate-500 truncate uppercase tracking-wider mt-0.5">
                    {monitor.url.replace(/^https?:\/\//, '')}
                </p>
                <div className="flex items-center gap-3 text-[8px] font-black uppercase tracking-widest text-slate-600 mt-1.5">
                    <div className="flex items-center gap-1">
                        <span className="text-slate-700">Last:</span>
                        <span>
                            {monitor.lastCheckTime 
                                ? new Date(monitor.lastCheckTime).toLocaleTimeString('es-DO', { hour12: true, hour: 'numeric', minute: '2-digit' }) 
                                : 'Never'}
                        </span>
                    </div>
                    {monitor.isActive && monitor.lastCheckTime && (
                        <div className="flex items-center gap-1">
                            <span className="text-slate-700">Next:</span>
                            <span>
                                {new Date(new Date(monitor.lastCheckTime).getTime() + (monitor.checkIntervalSeconds * 1000)).toLocaleTimeString('es-DO', { 
                                    hour12: true, 
                                    hour: 'numeric', 
                                    minute: '2-digit' 
                                })}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Today's Status Percentages - Compact */}
            <div className="hidden lg:flex items-center gap-2 px-4 min-w-[200px]">
                <div className="flex items-center justify-center px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 min-w-[55px]">
                    <span className="text-[11px] font-black text-emerald-400">
                        {todayStat ? todayStat.upPercentage.toFixed(0) : '100'}%
                    </span>
                </div>
                <div className="flex items-center justify-center px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/10 min-w-[55px]">
                    <span className="text-[11px] font-black text-amber-400">
                        {todayStat ? todayStat.slowPercentage.toFixed(0) : '0'}%
                    </span>
                </div>
                <div className="flex items-center justify-center px-3 py-2 rounded-xl bg-rose-500/5 border border-rose-500/10 min-w-[55px]">
                    <span className="text-[11px] font-black text-rose-400">
                        {todayStat ? todayStat.downPercentage.toFixed(0) : '0'}%
                    </span>
                </div>
            </div>

            {/* Actions - Smaller Buttons */}
            <div className="flex items-center gap-1.5">
                <Link
                    to={`/web-monitors/${monitor.id}`}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-brand-primary/10 hover:border-brand-primary/30 hover:text-brand-primary transition-all group"
                    title="Ver Detalles"
                >
                    <Eye className="w-3.5 h-3.5" />
                </Link>
                <button 
                    onClick={() => onToggleActive(monitor.id)}
                    className={`p-2 rounded-xl border transition-all ${
                        monitor.isActive 
                        ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10' 
                        : 'bg-slate-500/5 border-slate-500/10 text-slate-500 hover:bg-slate-500/10'
                    }`}
                    title={monitor.isActive ? "Desactivar Monitoreo" : "Activar Monitoreo"}
                >
                    <Power className="w-3.5 h-3.5" />
                </button>
                <button 
                    onClick={() => onToggleNotify(monitor.id)}
                    className={`p-2 rounded-xl border transition-all ${
                        monitor.notify 
                        ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10' 
                        : 'bg-rose-500/5 border-rose-500/10 text-rose-400 hover:bg-rose-500/10'
                    }`}
                    title={monitor.notify ? "Notificaciones Activas" : "Notificaciones Silenciadas"}
                >
                    {monitor.notify ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                </button>
                <button 
                    onClick={() => onEdit(monitor)}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition-all"
                >
                    <Pencil className="w-3.5 h-3.5" />
                </button>
                <button 
                    onClick={() => confirmDelete(monitor.id)}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-rose-500/50 hover:bg-rose-500/10 hover:text-rose-500 transition-all"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

export default function WebMonitors() {
    const [monitors, setMonitors] = useState<WebMonitor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingMonitor, setEditingMonitor] = useState<WebMonitor | null>(null);
    const [newMonitor, setNewMonitor] = useState({ 
        name: '', 
        url: '', 
        interval: 1,
        slowThresholdMs: 5000,
        notifyOnSlow: true,
        notify: true
    });
    const [intervalUnit, setIntervalUnit] = useState<'seconds' | 'minutes' | 'hours' | 'days'>('minutes');
    const [searchQuery, setSearchQuery] = useState('');

    const unitToSeconds = { seconds: 1, minutes: 60, hours: 3600, days: 86400 };

    const fetchMonitors = async () => {
        try {
            const data = await webMonitorService.getMonitors();
            setMonitors(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMonitors();
        const interval = setInterval(fetchMonitors, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleAddMonitor = async (e: React.FormEvent) => {
        e.preventDefault();
        const intervalSeconds = newMonitor.interval * unitToSeconds[intervalUnit];
        try {
            if (editingMonitor) {
                await webMonitorService.updateMonitor(editingMonitor.id, {
                    ...editingMonitor,
                    name: newMonitor.name,
                    url: newMonitor.url,
                    checkIntervalSeconds: intervalSeconds,
                    slowThresholdMs: newMonitor.slowThresholdMs,
                    notifyOnSlow: newMonitor.notifyOnSlow,
                    notify: newMonitor.notify
                });
            } else {
                await webMonitorService.createMonitor({
                    name: newMonitor.name,
                    url: newMonitor.url,
                    checkIntervalSeconds: intervalSeconds,
                    isActive: true,
                    slowThresholdMs: newMonitor.slowThresholdMs,
                    notifyOnSlow: newMonitor.notifyOnSlow,
                    notify: newMonitor.notify
                });
            }
            setShowAddModal(false);
            setEditingMonitor(null);
            setNewMonitor({ 
                name: '', 
                url: '', 
                interval: 60,
                slowThresholdMs: 5000,
                notifyOnSlow: true,
                notify: true
            });
            fetchMonitors();
        } catch (err) {
            console.error(err);
        }
    };

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [monitorToDelete, setMonitorToDelete] = useState<number | null>(null);

    const handleToggleNotify = async (id: number) => {
        try {
            await webMonitorService.toggleNotify(id);
            fetchMonitors(); 
        } catch (err) {
            console.error("Failed to toggle notifications", err);
        }
    };

    const handleToggleActive = async (id: number) => {
        try {
            await webMonitorService.toggleMonitor(id);
            fetchMonitors();
        } catch (err) {
            console.error("Failed to toggle active status", err);
        }
    };

    const handleEditMonitor = (monitor: WebMonitor) => {
        setEditingMonitor(monitor);
        // Convert stored seconds back to a friendly unit
        let unit: 'seconds' | 'minutes' | 'hours' | 'days' = 'seconds';
        let val = monitor.checkIntervalSeconds;
        if (val % 86400 === 0) { unit = 'days'; val = val / 86400; }
        else if (val % 3600 === 0) { unit = 'hours'; val = val / 3600; }
        else if (val % 60 === 0) { unit = 'minutes'; val = val / 60; }
        setIntervalUnit(unit);
        setNewMonitor({
            name: monitor.name,
            url: monitor.url,
            interval: val,
            slowThresholdMs: monitor.slowThresholdMs,
            notifyOnSlow: monitor.notifyOnSlow,
            notify: monitor.notify
        });
        setShowAddModal(true);
    };

    const handleCloseModal = () => {
        setShowAddModal(false);
        setEditingMonitor(null);
        setNewMonitor({ 
            name: '', 
            url: '', 
            interval: 1,
            slowThresholdMs: 5000,
            notifyOnSlow: true,
            notify: true
        });
        setIntervalUnit('minutes');
    };

    const confirmDelete = (id: number) => {
        setMonitorToDelete(id);
        setShowDeleteConfirm(true);
    };

    const handleDeleteMonitor = async () => {
        if (monitorToDelete === null) return;
        try {
            await webMonitorService.deleteMonitor(monitorToDelete);
            setShowDeleteConfirm(false);
            setMonitorToDelete(null);
            fetchMonitors();
        } catch (err) {
            console.error(err);
        }
    };

    const filteredMonitors = monitors.filter(m => 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        m.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full">
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                title="Confirm Removal"
                type="danger"
                footer={
                    <>
                        <button onClick={() => setShowDeleteConfirm(false)} className="px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-white transition-all">Cancel</button>
                        <button onClick={handleDeleteMonitor} className="bg-rose-500 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20">Remove Monitor</button>
                    </>
                }
            >
                Are you sure you want to decommission this monitoring node? This action is irreversible and all historical latency data will be purged.
            </Modal>
            <div className="max-w-7xl mx-auto space-y-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-white leading-tight">
                                Web <span className="text-brand-secondary">Monitors</span>
                            </h1>
                            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-brand-primary opacity-60">Version_Control: v1.2</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-primary transition-colors" size={16} />
                            <input 
                                type="text"
                                placeholder="Filter endpoints..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-brand-primary/50 transition-all w-48 md:w-64 font-medium"
                            />
                        </div>
                        <button 
                            onClick={() => setShowAddModal(true)}
                            className="bg-brand-primary hover:bg-brand-primary/90 text-obsidian-950 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                            <Plus size={14} />
                            New Monitor
                        </button>
                    </div>
                </div>

                {/* Compact Stats Bar */}
                <div className="flex flex-wrap items-center gap-3">
                    <div 
                        className="bg-emerald-500/5 border border-emerald-500/10 rounded-full px-4 py-1.5 flex items-center gap-2 cursor-help transition-all hover:bg-emerald-500/10"
                        title="Sites currently responding correctly to all health checks."
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                            Operational: {monitors.filter(m => m.status === 0 && m.isActive).length}
                        </span>
                    </div>
                    <div 
                        className="bg-amber-500/5 border border-amber-500/10 rounded-full px-4 py-1.5 flex items-center gap-2 cursor-help transition-all hover:bg-amber-500/10"
                        title="Initial failure detected. System is performing automatic retries in the background before marking as Offline."
                    >
                        <RefreshCw size={10} className="text-amber-400 animate-spin" />
                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                            Checking: {monitors.filter(m => m.status === 1 && m.isActive).length}
                        </span>
                    </div>
                    <div 
                        className="bg-rose-500/5 border border-rose-500/10 rounded-full px-4 py-1.5 flex items-center gap-2 cursor-help transition-all hover:bg-rose-500/10"
                        title="Connection failed after all retry attempts. These sites require immediate attention."
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                        <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                            Offline: {monitors.filter(m => m.status === 2 && m.isActive).length}
                        </span>
                    </div>
                    <div 
                        className="bg-amber-500/5 border border-amber-500/10 rounded-full px-4 py-1.5 flex items-center gap-2 cursor-help transition-all hover:bg-amber-500/10"
                        title="Site is Up but responding slower than the configured threshold."
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                            Slow: {monitors.filter(m => m.status === 3 && m.isActive).length}
                        </span>
                    </div>
                    <div className="ml-auto flex items-center gap-2 text-slate-500">
                        <Activity size={12} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Total Nodes: {monitors.length}</span>
                    </div>
                </div>

                {/* Monitors List Container */}
                <div className="bg-obsidian-900/40 backdrop-blur-3xl border border-white/5 rounded-[32px] overflow-hidden">
                    {/* List Header */}
                    <div className="hidden md:flex items-center gap-4 px-6 py-4 bg-white/3 border-b border-white/5">
                        <div className="w-8 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Status</div>
                        <div className="flex-1 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Monitor Instance</div>
                        <div className="hidden lg:block w-[240px] text-center text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] px-4">Today's Performance</div>
                        <div className="w-24 text-right text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Actions</div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-8 h-8 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Syncing...</span>
                        </div>
                    ) : filteredMonitors.length > 0 ? (
                        <div className="flex flex-col">
                            {filteredMonitors.map(monitor => (
                                <MonitorRow 
                                    key={monitor.id} 
                                    monitor={monitor} 
                                    confirmDelete={confirmDelete}
                                    onEdit={handleEditMonitor}
                                    onToggleNotify={handleToggleNotify}
                                    onToggleActive={handleToggleActive}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center">
                            <Filter size={24} className="text-slate-700 mx-auto mb-4" />
                            <h3 className="text-sm font-bold text-slate-400">No matching monitors</h3>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Monitor Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-0">
                    <div className="absolute inset-0 bg-obsidian-950/80 backdrop-blur-xl animate-fade-in" onClick={handleCloseModal}></div>
                    <div className="bg-obsidian-900 border border-white/10 rounded-[40px] p-8 md:p-12 w-full max-w-xl relative z-10 animate-slide-up shadow-2xl">
                        <div className="space-y-4 mb-10">
                            <h2 className="text-4xl font-black text-white tracking-tighter">{editingMonitor ? 'Edit' : 'Add'} <span className="text-brand-primary">Monitor</span></h2>
                            <p className="text-slate-400 font-medium">{editingMonitor ? 'Update configuration for this endpoint.' : 'Configure a new endpoint for continuous monitoring.'}</p>
                        </div>

                        <form onSubmit={handleAddMonitor} className="space-y-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Application Name</label>
                                <input 
                                    required
                                    type="text"
                                    placeholder="e.g. Production API"
                                    value={newMonitor.name}
                                    onChange={e => setNewMonitor({...newMonitor, name: e.target.value})}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-hidden focus:border-brand-primary/50 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Endpoint URL</label>
                                <input 
                                    required
                                    type="url"
                                    placeholder="https://api.myapp.com/health"
                                    value={newMonitor.url}
                                    onChange={e => setNewMonitor({...newMonitor, url: e.target.value})}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-hidden focus:border-brand-primary/50 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Check Interval</label>
                                <div className="flex gap-3">
                                    <input 
                                        required
                                        type="number"
                                        min="1"
                                        value={newMonitor.interval}
                                        onChange={e => setNewMonitor({...newMonitor, interval: parseInt(e.target.value) || 1})}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-hidden focus:border-brand-primary/50 transition-all font-medium"
                                    />
                                    <select
                                        value={intervalUnit}
                                        onChange={e => setIntervalUnit(e.target.value as typeof intervalUnit)}
                                        className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-brand-primary/50 transition-all font-medium text-sm cursor-pointer"
                                    >
                                        <option value="seconds" className="bg-obsidian-900">Seconds</option>
                                        <option value="minutes" className="bg-obsidian-900">Minutes</option>
                                        <option value="hours" className="bg-obsidian-900">Hours</option>
                                        <option value="days" className="bg-obsidian-900">Days</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Slow Threshold (ms)</label>
                                    <input 
                                        required
                                        type="number"
                                        min="100"
                                        step="100"
                                        value={newMonitor.slowThresholdMs}
                                        onChange={e => setNewMonitor({...newMonitor, slowThresholdMs: parseInt(e.target.value) || 5000})}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-hidden focus:border-brand-primary/50 transition-all font-medium"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 block">Notifications</label>
                                    <button
                                        type="button"
                                        onClick={() => setNewMonitor({...newMonitor, notifyOnSlow: !newMonitor.notifyOnSlow})}
                                        className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all w-full text-left"
                                    >
                                        {newMonitor.notifyOnSlow ? (
                                            <ShieldCheck size={18} className="text-brand-primary" />
                                        ) : (
                                            <Activity size={18} className="text-slate-500" />
                                        )}
                                        <span className={`text-xs font-bold ${newMonitor.notifyOnSlow ? 'text-white' : 'text-slate-500'}`}>
                                            {newMonitor.notifyOnSlow ? 'Notify on Slowness' : 'Ignore Slowness'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-8 py-5 rounded-3xl font-black text-xs uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 bg-brand-primary text-obsidian-950 px-8 py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all"
                                >
                                    {editingMonitor ? 'Update' : 'Create'} Monitor
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
        </div>
    );
}
