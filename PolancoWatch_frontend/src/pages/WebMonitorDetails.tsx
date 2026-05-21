import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, 
    Activity, 
    Clock, 
    ShieldCheck, 
    AlertTriangle, 
    Globe,
    RefreshCw,
    Pencil
} from 'lucide-react';
import { webMonitorService } from '../services/api';
import type { WebMonitor, WebMonitorDailyStats, WebCheck } from '../services/api';
import { MetricChart } from '../components/MetricChart';

export default function WebMonitorDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [monitor, setMonitor] = useState<WebMonitor | null>(null);
    const [history, setHistory] = useState<WebCheck[]>([]);
    const [stats, setStats] = useState<WebMonitorDailyStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        if (!id) return;
        setRefreshing(true);
        try {
            const monitorId = parseInt(id);
            const [m, h, s] = await Promise.all([
                webMonitorService.getMonitors().then((list: WebMonitor[]) => list.find(x => x.id === monitorId)),
                webMonitorService.getHistory(monitorId, 50),
                webMonitorService.getStats(monitorId, 15)
            ]);
            
            if (m) setMonitor(m);
            setHistory(h.reverse());
            setStats(s.reverse());
        } catch (err) {
            console.error("Failed to fetch monitor details", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [id]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 text-brand-primary animate-spin" />
                    <span className="text-sm font-black uppercase tracking-widest text-slate-500">Loading Dashboard...</span>
                </div>
            </div>
        );
    }

    if (!monitor) return <div className="p-8 text-center text-rose-500">Monitor not found</div>;

    const isUp = monitor.status === 0;
    const isSlow = monitor.status === 3;
    const uptime15d = stats.length > 0 
        ? stats.reduce((acc, s) => acc + s.upPercentage, 0) / stats.length 
        : (isUp ? 100 : 0);

    const chartData = history.map(h => ({
        timestamp: new Date(h.timestamp),
        value: h.latencyMs
    }));

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/web-monitors')}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            {monitor.name}
                            <div className={`w-2.5 h-2.5 rounded-full ${isUp ? 'bg-emerald-500 border-4 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : isSlow ? 'bg-amber-500' : 'bg-rose-500'} animate-pulse`} />
                        </h1>
                        <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                            <Globe className="w-3.5 h-3.5" />
                            {monitor.url}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={fetchData}
                        disabled={refreshing}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-brand-primary/10 hover:border-brand-primary/30 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button className="px-4 py-2 rounded-xl bg-brand-primary text-obsidian-950 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-brand-primary/20">
                        <Pencil className="w-3.5 h-3.5" />
                        Edit Monitor
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    label="Current Latency" 
                    value={`${monitor.lastLatencyMs.toFixed(0)}ms`} 
                    icon={<Activity className="w-4 h-4" />}
                    color={isUp ? 'text-emerald-400' : isSlow ? 'text-amber-400' : 'text-rose-400'}
                />
                <StatCard 
                    label="15d Uptime" 
                    value={`${uptime15d.toFixed(1)}%`} 
                    icon={<ShieldCheck className="w-4 h-4" />}
                    color="text-brand-primary"
                />
                <StatCard 
                    label="Check Frequency" 
                    value={`${monitor.checkIntervalSeconds}s`} 
                    icon={<Clock className="w-4 h-4" />}
                />
                <StatCard 
                    label="Total Incidents" 
                    value={stats.filter(s => s.downPercentage > 0).length.toString()} 
                    icon={<AlertTriangle className="w-4 h-4" />}
                    color="text-rose-400"
                />
            </div>

            {/* Main Latency Chart */}
            <div className="bg-white/2 border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute inset-0 bg-linear-to-br from-brand-primary/5 via-transparent to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-white/50 mb-1">Latency History</h3>
                            <p className="text-[10px] font-medium text-slate-600 uppercase tracking-widest">Real-time performance trend (last 50 checks)</p>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <MetricChart 
                            data={chartData} 
                            color={isUp ? '#10b981' : isSlow ? '#f59e0b' : '#f43f5e'} 
                            domain={['auto', 'auto']}
                            formatter={(v) => `${v.toFixed(0)} ms`}
                        />
                    </div>
                </div>
            </div>

            {/* 15-Day History Blocks Section */}
            <div className="bg-white/2 border border-white/5 rounded-3xl p-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/50 mb-6">15-Day Uptime Calendar</h3>
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-15 gap-2">
                    {Array.from({ length: 15 }).map((_, i) => {
                        const today = new Date();
                        const targetDate = new Date();
                        targetDate.setDate(today.getDate() - (14 - i));
                        const dateStr = targetDate.toISOString().split('T')[0];
                        const isToday = i === 14;
                        
                        const dayStat = stats.find(s => s.date.split('T')[0] === dateStr);
                        
                        let bgColor = 'bg-white/5';
                        let label = `${targetDate.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}: No Data`;
                        
                        if (dayStat) {
                            if (dayStat.downPercentage > 50) bgColor = 'bg-rose-500';
                            else if (dayStat.downPercentage > 0) bgColor = 'bg-rose-500/60';
                            else if (dayStat.slowPercentage > 30) bgColor = 'bg-amber-500';
                            else if (dayStat.slowPercentage > 0) bgColor = 'bg-amber-500/60';
                            else bgColor = 'bg-emerald-500';
                            
                            label = `${new Date(dayStat.date).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}: 
                                UP: ${dayStat.upPercentage.toFixed(1)}% | SLOW: ${dayStat.slowPercentage.toFixed(1)}% | DOWN: ${dayStat.downPercentage.toFixed(1)}%`;
                        }

                        return (
                            <div key={i} className="flex flex-col items-center gap-2 group/day cursor-help" title={label}>
                                <div className={`w-full aspect-square rounded-xl ${bgColor} transition-all hover:scale-110 hover:brightness-125 relative ring-offset-4 ring-offset-obsidian-950 ${isToday ? 'ring-2 ring-white/20' : ''}`}>
                                    {isToday && (
                                        <div className="absolute inset-0 border-2 border-white/30 rounded-xl animate-pulse"></div>
                                    )}
                                </div>
                                <span className={`text-[8px] font-black uppercase tracking-tighter ${isToday ? 'text-white' : 'text-slate-700'}`}>
                                    {targetDate.getDate()} {targetDate.toLocaleDateString('es-DO', { month: 'short' }).slice(0, 3)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, color = 'text-white' }: { label: string, value: string, icon: React.ReactNode, color?: string }) {
    return (
        <div className="bg-white/2 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:bg-white/4 transition-all">
            <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
                <div className="p-1.5 rounded-lg bg-white/5 text-slate-400">
                    {icon}
                </div>
            </div>
            <span className={`text-xl font-black ${color}`}>{value}</span>
        </div>
    );
}
