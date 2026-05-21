import { useState, useEffect } from 'react';
import { alertsService, settingsService } from '../services/api';
import Modal from '../components/Modal';
import { 
    Activity, 
    Bell, 
    Save, 
    Trash2,
    Clock, 
    Send, 
    Settings, 
    History, 
    AlertTriangle, 
    Mail,
    Cpu,
    MemoryStick,
    HardDrive,
    CheckCircle2
} from 'lucide-react';

interface AlertRule {
    id: number;
    metricType: number; // 0: Cpu, 1: Memory, 2: Disk
    threshold: number;
    cooldownSeconds: number;
    isActive: boolean;
}

interface AlertHistory {
    id: number;
    alertRuleId: number;
    alertRule: AlertRule;
    message: string;
    triggeredAt: string;
}

interface NotificationSettings {
    id: number;
    telegramEnabled: boolean;
    telegramBotToken: string;
    telegramChatId: string;
    emailEnabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpEnableSsl: boolean;
    smtpUser: string;
    smtpPass: string;
    fromEmail: string;
    toEmail: string;
    telegramMessageTemplate: string;
    emailMessageTemplate: string;
}

const MetricIcons = [
    <Cpu size={16} className="text-brand-primary" />,
    <MemoryStick size={16} className="text-brand-secondary" />,
    <HardDrive size={16} className="text-emerald-400" />
];

const MetricNames = ["CPU_LOAD", "MEMORY_USAGE", "DISK_SPACE"];

const PRESET_TEMPLATES = {
    telegram: [
        { 
            name: "Industrial", 
            text: "🚨 *PolancoWatch Alert*\n\n{Message}\n\n*Metric:* {Metric}\n*Value:* {Value}%\n*Threshold:* {Threshold}%\n*Date:* {Time} UTC" 
        },
        { 
            name: "Compact", 
            text: "⚠️ *{Metric}* Alert: *{Value}%* ({Threshold}% Limit)" 
        },
        { 
            name: "Technical", 
            text: "[SYSTEM_ALERT]\nstatus=critical\nmetric={Metric}\nvalue={Value}\nlimit={Threshold}\ntimestamp=\"{Time}\"" 
        }
    ],
    email: [
        {
            name: "Industrial Red",
            text: `<div style='font-family: sans-serif; padding: 20px; border: 1px solid #ff4444; border-radius: 8px;'>
    <h2 style='color: #ff4444;'>🚨 PolancoWatch Alert</h2>
    <p><strong>Message:</strong> {Message}</p>
    <hr/>
    <p><strong>Metric:</strong> {Metric}</p>
    <p><strong>Current Value:</strong> {Value}%</p>
    <p><strong>Threshold:</strong> {Threshold}%</p>
    <p><strong>Time:</strong> {Time} UTC</p>
</div>`
        },
        {
            name: "Modern Blue",
            text: `<div style='font-family: sans-serif; padding: 20px; border-top: 4px solid #3b82f6; background-color: #f8fafc; border-radius: 0 0 8px 8px;'>
    <h2 style='color: #1e3a8a;'>System Notification</h2>
    <p>{Message}</p>
    <div style='background: white; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;'>
        <p><strong>Metric:</strong> {Metric}</p>
        <p><strong>Value:</strong> <span style='color: #2563eb;'>{Value}%</span></p>
    </div>
    <p style='font-size: 11px; color: #94a3b8;'>{Time} UTC · PolancoWatch</p>
</div>`
        },
        {
            name: "Dark Premium",
            text: `<div style='font-family: sans-serif; padding: 30px; background-color: #0f172a; color: #f1f5f9; border-radius: 12px;'>
    <div style='border-left: 4px solid #f43f5e; padding-left: 20px;'>
        <h2 style='color: #f43f5e; margin: 0; text-transform: uppercase;'>{Metric} EXCEEDED</h2>
        <p style='color: #94a3b8;'>{Message}</p>
    </div>
    <p style='font-size: 24px; font-weight: bold; color: #fff;'>{Value}% detected</p>
    <p style='font-size: 11px; color: #475569;'>UTC TIMESTAMP: {Time}</p>
</div>`
        }
    ]
};

const normalizeTemplate = (str: string) => str?.replace(/\r\n/g, '\n').trim() || '';

export default function Alerts() {
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [history, setHistory] = useState<AlertHistory[]>([]);
    const [settings, setSettings] = useState<NotificationSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState<number | null>(null);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'rules' | 'notifications'>('rules');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [rulesData, historyData, settingsData] = await Promise.all([
                alertsService.getRules(),
                alertsService.getHistory(),
                settingsService.getNotificationSettings()
            ]);
            setRules(rulesData);
            setHistory(historyData);
            setSettings(settingsData);
        } catch (err) {
            console.error("Failed to fetch alerts data:", err);
            setErrorMsg("Failed to synchronize with Alert Engine.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearHistory = async () => {
        setIsClearModalOpen(false);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/alerts/history`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                setHistory([]);
                setErrorMsg(null);
            } else {
                const errorData = await response.json();
                setErrorMsg(errorData.message || "Failed to clear incident log.");
            }
        } catch (error) {
            console.error('Failed to clear history:', error);
            setErrorMsg("Failed to connect to the server to clear incident log.");
        }
    };

    const handleUpdateSettings = async () => {
        if (!settings) return;
        setIsSavingSettings(true);
        try {
            await settingsService.updateNotificationSettings(settings);
            setErrorMsg(null);
        } catch (err) {
            setErrorMsg("Failed to update notification protocols.");
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleUpdateRule = async (rule: AlertRule) => {
        setIsSaving(rule.id);
        try {
            await alertsService.updateRule(rule);
            setRules(prev => prev.map(r => r.id === rule.id ? rule : r));
        } catch (err) {
            setErrorMsg("Failed to commit rule transformation.");
        } finally {
            setIsSaving(null);
        }
    };

    const toggleRuleActive = (rule: AlertRule) => {
        handleUpdateRule({ ...rule, isActive: !rule.isActive });
    };

    const updateThreshold = (rule: AlertRule, value: string) => {
        const threshold = parseFloat(value);
        if (!isNaN(threshold)) {
            setRules(prev => prev.map(r => r.id === rule.id ? { ...r, threshold } : r));
        }
    };

    const updateCooldown = (rule: AlertRule, value: string) => {
        const cooldownSeconds = parseInt(value);
        if (!isNaN(cooldownSeconds)) {
            setRules(prev => prev.map(r => r.id === rule.id ? { ...r, cooldownSeconds } : r));
        }
    };

    return (
        <div className="w-full">
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
                <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-[10px] font-black uppercase tracking-widest mb-6">
                            <Bell size={12} /> Sentinel Configuration
                        </div>
                        <h1 className="text-5xl font-black text-white tracking-tighter mb-4 italic">Alert <span className="text-brand-accent">Engine</span></h1>
                        <p className="text-slate-400 max-w-xl text-sm leading-relaxed uppercase tracking-tight">
                            Define security thresholds and monitor system anomalies. The sentinel broadcasts triggers in real-time to all connected nodes.
                        </p>
                    </div>

                    <button
                        onClick={fetchData}
                        className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center gap-3"
                    >
                        <Activity size={14} className={isLoading ? 'animate-spin' : ''} />
                        Sync Engine
                    </button>
                </header>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-2 mb-10 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
                    <button
                        onClick={() => setActiveTab('rules')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'rules' ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        Sentinel Rules
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'notifications' ? 'bg-brand-secondary text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        Notifications
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-8">
                        {activeTab === 'rules' ? (
                            <>
                                <div className="flex items-center gap-3 mb-2">
                                    <Settings size={18} className="text-brand-primary" />
                                    <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Threshold Protocols</h3>
                                </div>

                                <div className="grid grid-cols-1 gap-6">
                                    {rules.map((rule) => (
                                        <div key={rule.id} className="glass-panel rounded-3xl p-6 border-white/5 hover:border-brand-primary/20 transition-all group">
                                            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                                                <div className="flex items-center gap-5 w-full md:w-auto">
                                                    <div className="w-12 h-12 rounded-2xl bg-obsidian-900 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        {MetricIcons[rule.metricType]}
                                                    </div>
                                                    <div>
                                                        <div className="text-white font-black text-sm uppercase tracking-tight">{MetricNames[rule.metricType]}</div>
                                                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Status: {rule.isActive ? 'OPERATIONAL' : 'DORMANT'}</div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Threshold</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                value={rule.threshold}
                                                                onChange={(e) => updateThreshold(rule, e.target.value)}
                                                                className="w-16 bg-obsidian-950 border border-white/5 rounded-xl px-2 py-2 text-xs font-mono font-black text-brand-primary focus:outline-none focus:border-brand-primary/50"
                                                            />
                                                            <span className="text-[10px] font-black text-slate-500">%</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cooldown</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                value={rule.cooldownSeconds}
                                                                onChange={(e) => updateCooldown(rule, e.target.value)}
                                                                className="w-16 bg-obsidian-950 border border-white/5 rounded-xl px-2 py-2 text-xs font-mono font-black text-brand-secondary focus:outline-none focus:border-brand-secondary/50"
                                                            />
                                                            <span className="text-[10px] font-black text-slate-500">s</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => toggleRuleActive(rule)}
                                                            className={`w-12 h-6 rounded-full p-1 transition-all flex items-center ${rule.isActive ? 'bg-brand-primary shadow-[0_0_12px_rgba(167,139,250,0.4)]' : 'bg-slate-800'}`}
                                                        >
                                                            <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${rule.isActive ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                                        </button>

                                                        <button
                                                            onClick={() => handleUpdateRule(rule)}
                                                            disabled={isSaving === rule.id}
                                                            className="p-3 bg-white/5 hover:bg-brand-primary hover:text-white rounded-xl text-slate-400 transition-all group/btn"
                                                        >
                                                            <Save size={16} className={isSaving === rule.id ? 'animate-pulse' : ''} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {!rules.length && !isLoading && (
                                        <div className="py-20 glass-panel rounded-3xl border-dashed border-white/5 flex flex-col items-center justify-center opacity-40">
                                            <Settings size={40} className="mb-4 text-slate-500" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">No protocols initialized</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="space-y-16 animate-fade-in">
                                <div className="flex items-center justify-between gap-3 mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-brand-secondary/10 flex items-center justify-center text-brand-secondary">
                                            <Send size={20} />
                                        </div>
                                        <h3 className="text-base font-black text-white uppercase tracking-[0.2em]">Transmission Protocols</h3>
                                    </div>
                                    <button 
                                        onClick={handleUpdateSettings}
                                        disabled={isSavingSettings}
                                        className="px-8 py-3 bg-indigo-600 hover:bg-white hover:text-indigo-600 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:shadow-white/20 active:scale-95 disabled:opacity-50"
                                    >
                                        {isSavingSettings ? <Activity size={16} className="animate-spin" /> : <Save size={16} />}
                                        Sync Protocols
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                    {/* Telegram Settings */}
                                    <div className="glass-panel rounded-[40px] p-10 border-white/10 hover:border-sky-500/30 transition-all flex flex-col gap-10 bg-linear-to-br from-sky-500/5 to-transparent relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-sky-500/20 transition-all"></div>
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                                                    <Send size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-black text-sm uppercase tracking-tight">Telegram Bot</h4>
                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Instant Messaging Hub</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setSettings(s => s ? { ...s, telegramEnabled: !s.telegramEnabled } : null)}
                                                className={`w-12 h-6 rounded-full p-1 transition-all flex items-center ${settings?.telegramEnabled ? 'bg-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.4)]' : 'bg-slate-800'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${settings?.telegramEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Bot Token</label>
                                                <input 
                                                    type="password"
                                                    value={settings?.telegramBotToken || ''}
                                                    onChange={(e) => setSettings(s => s ? { ...s, telegramBotToken: e.target.value } : null)}
                                                    placeholder="0000000000:AA..."
                                                    className="w-full bg-obsidian-950 border border-white/5 rounded-2xl px-4 py-3 text-xs font-mono font-black text-white focus:outline-none focus:border-sky-500/50"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Chat ID</label>
                                                <input 
                                                    type="text"
                                                    value={settings?.telegramChatId || ''}
                                                    onChange={(e) => setSettings(s => s ? { ...s, telegramChatId: e.target.value } : null)}
                                                    placeholder="eg. -100123456789"
                                                    className="w-full bg-obsidian-950 border border-white/5 rounded-2xl px-4 py-3 text-xs font-mono font-black text-white focus:outline-none focus:border-sky-500/50"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-end justify-between">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Message Template (Markdown)</label>
                                                    <div className="flex gap-2 mb-1">
                                                        {PRESET_TEMPLATES.telegram.map(p => (
                                                            <button 
                                                                key={p.name}
                                                                onClick={() => setSettings(s => s ? { ...s, telegramMessageTemplate: p.text } : null)}
                                                                className={`px-2 py-0.5 rounded border transition-all uppercase tracking-tighter text-[8px] font-black ${
                                                                    normalizeTemplate(settings?.telegramMessageTemplate || '') === normalizeTemplate(p.text) 
                                                                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-400' 
                                                                    : 'bg-white/5 border-white/5 text-slate-500 hover:text-sky-400 hover:border-sky-500/30'
                                                                }`}
                                                            >
                                                                {p.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <textarea 
                                                    rows={4}
                                                    value={settings?.telegramMessageTemplate || ''}
                                                    onChange={(e) => setSettings(s => s ? { ...s, telegramMessageTemplate: e.target.value } : null)}
                                                    placeholder="🚨 *Alert* \n {Message}"
                                                    className="w-full bg-obsidian-950 border border-white/5 rounded-2xl px-4 py-3 text-[11px] font-mono leading-relaxed text-sky-400 focus:outline-none focus:border-sky-500/50 resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Email Settings */}
                                    <div className="glass-panel rounded-[40px] p-10 border-white/10 hover:border-rose-500/30 transition-all flex flex-col gap-10 bg-linear-to-br from-rose-500/5 to-transparent relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-rose-500/20 transition-all"></div>
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                                                    <Mail size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-black text-sm uppercase tracking-tight">SMTP Email</h4>
                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Reliable Reporting</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setSettings(s => s ? { ...s, emailEnabled: !s.emailEnabled } : null)}
                                                className={`w-12 h-6 rounded-full p-1 transition-all flex items-center ${settings?.emailEnabled ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]' : 'bg-slate-800'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${settings?.emailEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="col-span-2 flex flex-col gap-2">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">SMTP Host</label>
                                                    <input 
                                                        type="text"
                                                        value={settings?.smtpHost || ''}
                                                        onChange={(e) => setSettings(s => s ? { ...s, smtpHost: e.target.value } : null)}
                                                        className="w-full bg-obsidian-950 border border-white/5 rounded-2xl px-4 py-3 text-xs font-mono font-black text-white focus:outline-none focus:border-rose-500/50"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Port</label>
                                                    <input 
                                                        type="number"
                                                        value={settings?.smtpPort || 587}
                                                        onChange={(e) => setSettings(s => s ? { ...s, smtpPort: parseInt(e.target.value) } : null)}
                                                        className="w-full bg-obsidian-950 border border-white/5 rounded-2xl px-4 py-3 text-xs font-mono font-black text-white focus:outline-none focus:border-rose-500/50"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                    <input 
                                                        type="checkbox"
                                                        checked={settings?.smtpEnableSsl || false}
                                                        onChange={(e) => setSettings(s => s ? { ...s, smtpEnableSsl: e.target.checked } : null)}
                                                        className="accent-rose-500"
                                                    />
                                                    Enable SSL/TLS
                                                </label>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Recipient (To Email)</label>
                                                <input 
                                                    type="email"
                                                    value={settings?.toEmail || ''}
                                                    onChange={(e) => setSettings(s => s ? { ...s, toEmail: e.target.value } : null)}
                                                    className="w-full bg-obsidian-950 border border-white/5 rounded-2xl px-4 py-3 text-xs font-mono font-black text-white focus:outline-none focus:border-rose-500/50"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-end justify-between">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">HTML Body Template</label>
                                                    <div className="flex gap-2 mb-1">
                                                        {PRESET_TEMPLATES.email.map(p => (
                                                            <button 
                                                                key={p.name}
                                                                onClick={() => setSettings(s => s ? { ...s, emailMessageTemplate: p.text } : null)}
                                                                className={`px-2 py-0.5 rounded border transition-all uppercase tracking-tighter text-[8px] font-black ${
                                                                    normalizeTemplate(settings?.emailMessageTemplate || '') === normalizeTemplate(p.text) 
                                                                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' 
                                                                    : 'bg-white/5 border-white/5 text-slate-500 hover:text-rose-400 hover:border-rose-500/30'
                                                                }`}
                                                            >
                                                                {p.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <textarea 
                                                    rows={4}
                                                    value={settings?.emailMessageTemplate || ''}
                                                    onChange={(e) => setSettings(s => s ? { ...s, emailMessageTemplate: e.target.value } : null)}
                                                    placeholder="<h2 style='color: #ff4444;'>🚨 Alert: {Metric}</h2>"
                                                    className="w-full bg-obsidian-950 border border-white/5 rounded-2xl px-4 py-3 text-[11px] font-mono leading-relaxed text-rose-400 focus:outline-none focus:border-rose-500/50 resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Placeholder Guide */}
                                <div className="p-10 bg-white/2 rounded-[40px] border border-white/5 relative overflow-hidden">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-secondary/5 blur-[100px] rounded-full pointer-events-none"></div>
                                    <div className="flex flex-col items-center text-center gap-2 mb-10 relative z-10">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-2">
                                            <Clock size={20} />
                                        </div>
                                        <h4 className="text-xs font-black text-white uppercase tracking-[0.3em]">Protocol Variable Registry</h4>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest max-w-sm leading-relaxed">
                                            Inject dynamic runtime data into your transmission streams using the following identifiers
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10">
                                        {[
                                            { key: '{Metric}', desc: 'Monitor Identity' },
                                            { key: '{Value}', desc: 'Observed Magnitude' },
                                            { key: '{Threshold}', desc: 'Activation Limit' },
                                            { key: '{Time}', desc: 'Temporal Epoch' },
                                            { key: '{Message}', desc: 'Summary Packet' }
                                        ].map(v => (
                                            <div key={v.key} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/3 border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all">
                                                <code className="text-brand-accent text-[11px] font-black tracking-wider">{v.key}</code>
                                                <span className="text-[8px] text-slate-500 uppercase font-black text-center tracking-tighter">{v.desc}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>

                    {/* Alert History */}
                    <div className="space-y-12">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-brand-accent/10 flex items-center justify-center text-brand-accent">
                                    <History size={20} />
                                </div>
                                <h3 className="text-base font-black text-white uppercase tracking-[0.2em]">Incident Log</h3>
                            </div>
                            <button 
                                onClick={() => setIsClearModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-xl transition-all border border-white/5 hover:border-rose-500/20 group"
                                title="Clear all logs"
                            >
                                <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Clear Logs</span>
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            {history.map((item) => (
                                <div key={item.id} className="p-5 rounded-2xl bg-brand-accent/5 border border-brand-accent/10 hover:border-brand-accent/30 transition-all group animate-fade-in">
                                    <div className="flex items-start gap-4">
                                        <div className="mt-1">
                                            <AlertTriangle size={16} className="text-brand-accent" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-black text-white uppercase tracking-tighter leading-relaxed mb-3 wrap-break-word">
                                                {item.message}
                                            </p>
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <Clock size={10} />
                                                    <span className="text-[9px] font-mono font-bold">
                                                        {new Date(item.triggeredAt).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                                    Critical
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {!history.length && !isLoading && (
                                <div className="py-32 glass-panel rounded-3xl border-dashed border-white/5 flex flex-col items-center justify-center opacity-20">
                                    <CheckCircle2 size={40} className="mb-4 text-emerald-400" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">System State: Nominal</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {errorMsg && (
                    <div className="fixed bottom-10 right-10 z-50 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-[10px] font-black uppercase tracking-widest animate-slide-up flex items-center gap-3">
                        <AlertTriangle size={16} />
                        {errorMsg}
                        <button onClick={() => setErrorMsg(null)} className="ml-4 hover:text-white">DISMISS</button>
                    </div>
                )}
            </main>

            <Modal
                isOpen={isClearModalOpen}
                onClose={() => setIsClearModalOpen(false)}
                title="Wipe Incident Log"
                type="danger"
                footer={
                    <>
                        <button 
                            onClick={() => setIsClearModalOpen(false)}
                            className="px-6 py-2 bg-white/5 hover:bg-white/10 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                        >
                            Abort Mission
                        </button>
                        <button 
                            onClick={handleClearHistory}
                            className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_10px_20px_rgba(244,63,94,0.3)]"
                        >
                            Purge Records
                        </button>
                    </>
                }
            >
                Are you absolutely sure you want to clear the entire alerting history? This action is irreversible and will remove all protocol logs from the database.
            </Modal>
        </div>
    );
}
