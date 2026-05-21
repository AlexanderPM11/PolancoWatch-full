import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Cpu, Activity, HardDrive, Network, Terminal, Settings, Info } from 'lucide-react';

export default function Documentation() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-obsidian-950 text-slate-300 font-sans selection:bg-brand-primary/30 flex-1 pl-0 lg:pl-20 xl:pl-72 transition-all duration-500">
            {/* Background Texture Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0" 
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
            </div>

            <main className="max-w-5xl mx-auto px-6 lg:px-8 py-16 relative z-10">
                <header className="mb-16">
                    <div className="flex items-center justify-between mb-8">
                        <button 
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
                        >
                            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="text-xs font-black uppercase tracking-widest">Console</span>
                        </button>
                        <div className="flex items-center gap-3 opacity-50">
                            <Terminal size={14} className="text-brand-primary" />
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">REF_DOCS_v1.5</span>
                        </div>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-[10px] font-black uppercase tracking-widest mb-6">
                        <Info size={12} /> System Internals & Security
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-4">Platform Architecture <br/><span className="text-brand-secondary">& Security Models</span></h1>
                    <p className="text-lg text-slate-400 max-w-3xl leading-relaxed">
                        PolancoWatch is a high-performance monitoring stack designed for real-time visibility. This documentation covers the underlying architecture, security protocols, and metric collection methodology.
                    </p>
                </header>


                <div className="space-y-12">
                    {/* Architecture Overview */}
                    <section className="glass-panel rounded-4xl p-10 border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Settings size={120} className="animate-spin-slow" />
                        </div>
                        <div className="flex items-start gap-6 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                                <Activity size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight uppercase">System Architecture</h2>
                                <p className="text-slate-400 text-sm mt-1">Real-time Data Pipeline & Orchestration</p>
                            </div>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-12">
                            <div>
                                <h3 className="text-xs font-black text-brand-secondary uppercase tracking-widest mb-4">Backend Core</h3>
                                <p className="text-sm leading-relaxed mb-4 text-slate-300">
                                    Built on <span className="text-white font-bold">ASP.NET Core 8</span>, the backend operates as a distributed-ready API. It features a <span className="text-brand-primary">SystemMetricsHostedService</span> that heartbeats every 2 seconds, scraping OS-level telemetry.
                                </p>
                                <ul className="space-y-3">
                                    <li className="flex gap-3 text-sm">
                                        <div className="w-1 h-1 rounded-full bg-brand-primary mt-2"></div>
                                        <span><strong className="text-white">SignalR Hub:</strong> Direct WebSocket streaming for sub-second UI latency.</span>
                                    </li>
                                    <li className="flex gap-3 text-sm">
                                        <div className="w-1 h-1 rounded-full bg-brand-primary mt-2"></div>
                                        <span><strong className="text-white">Background Workers:</strong> Decoupled threshold evaluation for instant alerting.</span>
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-brand-secondary uppercase tracking-widest mb-4">Data Persistence</h3>
                                <p className="text-sm leading-relaxed mb-4 text-slate-300">
                                    Utilizes a lightweight <span className="text-brand-primary">SQLite</span> instance for configuration and event logging, ensuring zero-configuration deployment while maintaining ACID compliance.
                                </p>
                                <div className="bg-obsidian-950 rounded-xl p-4 border border-white/5 font-mono text-[11px]">
                                    <div className="text-slate-500">// Infrastructure Layer</div>
                                    <div className="text-white">Entity Framework Core + SQLite</div>
                                    <div className="text-brand-secondary">Automated Database Evolution</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Security Section */}
                    <section className="glass-panel rounded-4xl p-10 border-white/5 bg-gradient-to-br from-brand-primary/5 to-transparent">
                        <div className="flex items-start gap-6 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                                <Settings size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Security & Privacy</h2>
                                <p className="text-slate-400 text-sm mt-1">Credential Safety & Session Integrity</p>
                            </div>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-12">
                            <div>
                                <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4">Credential Protection</h3>
                                <p className="text-sm leading-relaxed mb-4 text-slate-300">
                                    Passwords are never stored in plain text. We utilize the <span className="text-white font-bold">BCrypt.Net</span> adaptive hashing algorithm, which incorporates a per-user salt and computational cost factor to nullify brute-force and rainbow table attacks.
                                </p>
                                <div className="bg-obsidian-950 rounded-xl p-4 border border-white/5 font-mono text-[11px]">
                                    <div className="text-slate-500">// One-Way Cryptographic Hash</div>
                                    <div className="text-emerald-500">BCrypt.HashPassword(raw_password)</div>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4">Session Authorization</h3>
                                <p className="text-sm leading-relaxed mb-4 text-slate-300">
                                    Stateless authentication is handled via <span className="text-white font-bold">JSON Web Tokens (JWT)</span>. Each request to sensitive endpoints must include a signed token, ensuring that your monitoring data remains inaccessible to unauthorized actors.
                                </p>
                                <div className="bg-obsidian-950 rounded-xl p-4 border border-white/5 font-mono text-[11px]">
                                    <div className="text-slate-500">// Algorithm: HMAC-SHA256</div>
                                    <div className="text-white">Authorization: Bearer [JWT_TOKEN]</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Metric Methodology Split */}
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* CPU */}
                        <section className="glass-panel rounded-4xl p-10 border-white/5">
                            <div className="flex items-center gap-4 mb-6">
                                <Cpu className="text-brand-primary" size={24} />
                                <h2 className="text-xl font-black text-white tracking-tight uppercase">CPU Tracking</h2>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed mb-6">
                                Derived from <code className="text-brand-primary font-mono text-[10px] bg-white/5 px-1 rounded">/proc/stat</code> (Linux) and <code className="text-brand-primary font-mono text-[10px] bg-white/5 px-1 rounded">PercCounter</code> (Win).
                            </p>
                            <div className="bg-obsidian-950 rounded-xl p-4 border border-white/5 font-mono text-[10px] text-brand-secondary">
                                Usage% = (1.0 - (deltaIdle / deltaTotal)) * 100
                            </div>
                        </section>

                        {/* Memory */}
                        <section className="glass-panel rounded-4xl p-10 border-white/5">
                            <div className="flex items-center gap-4 mb-6">
                                <Activity className="text-brand-secondary" size={24} />
                                <h2 className="text-xl font-black text-white tracking-tight uppercase">RAM Analysis</h2>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed mb-6">
                                Total memory minus available pages (including reclaimable cache).
                            </p>
                            <div className="bg-obsidian-950 rounded-xl p-4 border border-white/5 font-mono text-[10px] text-brand-primary">
                                Used = MemTotal - MemAvailable
                            </div>
                        </section>
                    </div>

                    {/* Networking & Disk Section */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <section className="glass-panel rounded-4xl p-10 border-white/5">
                            <div className="flex items-center gap-4 mb-6">
                                <Network className="text-brand-secondary" size={24} />
                                <h2 className="text-xl font-black text-white tracking-tight uppercase">Networking</h2>
                            </div>
                            <ul className="space-y-4">
                                <li className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-secondary mt-1.5"></div>
                                    <div className="text-sm">
                                        <span className="text-white font-bold">Linux:</span> Byte-level delta of <code className="text-brand-secondary font-mono text-[10px]">/proc/net/dev</code>.
                                    </div>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-secondary mt-1.5"></div>
                                    <div className="text-sm">
                                        <span className="text-white font-bold">Windows:</span> Native <code className="text-brand-secondary font-mono text-[10px]">GetIPStatistics</code> polling.
                                    </div>
                                </li>
                            </ul>
                        </section>

                        <section className="glass-panel rounded-4xl p-10 border-white/5">
                            <div className="flex items-center gap-4 mb-6">
                                <HardDrive className="text-brand-primary" size={24} />
                                <h2 className="text-xl font-black text-white tracking-tight uppercase">Storage</h2>
                            </div>
                            <ul className="space-y-4">
                                <li className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5"></div>
                                    <div className="text-sm">
                                        <span className="text-white font-bold">Driver:</span> Cross-platform <code className="text-brand-primary font-mono text-[10px]">DriveInfo</code> API.
                                    </div>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5"></div>
                                    <div className="text-sm">
                                        <span className="text-white font-bold">Filter:</span> Intelligent exclusion of system virtual mounts.
                                    </div>
                                </li>
                            </ul>
                        </section>
                    </div>

                    {/* Infrastructure Footer */}
                    <footer className="pt-16 border-t border-white/5 text-center">
                        <div className="inline-flex items-center gap-3 text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">
                            <Settings size={14} className="animate-spin-slow" /> PolancoWatch Core v1.3.4 Build Final
                        </div>
                    </footer>
                </div>
            </main>
        </div>
    );
}
