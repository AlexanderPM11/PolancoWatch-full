import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Cpu, Activity, HardDrive, Network, Terminal, Settings, Info, Cloud, MessageCircle, Shield, Database } from 'lucide-react';

export default function Documentation() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('architecture');

    return (
        <div className="w-full">
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


                <div className="space-y-8">
                    {/* Tabs Navigation */}
                    <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
                        {[
                            { id: 'architecture', label: 'Architecture', icon: Settings },
                            { id: 'security', label: 'Security', icon: Shield },
                            { id: 'metrics', label: 'Metrics', icon: Activity },
                            { id: 'integrations', label: 'Integrations', icon: Cloud },
                            { id: 'supabase', label: 'Supabase DB', icon: Database }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
                                    activeTab === tab.id 
                                        ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' 
                                        : 'bg-transparent text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="mt-8">
                        {activeTab === 'architecture' && (
                            <section className="glass-panel rounded-4xl p-10 border-white/5 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                        )}

                        {activeTab === 'security' && (
                            <section className="glass-panel rounded-4xl p-10 border-white/5 bg-gradient-to-br from-brand-primary/5 to-transparent animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-start gap-6 mb-8">
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                                        <Shield size={28} />
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
                        )}

                        {activeTab === 'metrics' && (
                            <div className="grid md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

                                {/* Networking */}
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

                                {/* Storage */}
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
                        )}

                        {activeTab === 'integrations' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Google Drive Integration Section */}
                                <section className="glass-panel rounded-4xl p-10 border-white/5 bg-gradient-to-br from-brand-secondary/5 to-transparent">
                                    <div className="flex items-start gap-6 mb-8">
                                        <div className="w-14 h-14 rounded-2xl bg-brand-secondary/10 border border-brand-secondary/20 flex items-center justify-center text-brand-secondary">
                                            <Cloud size={28} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-white tracking-tight uppercase">Google Drive Integration</h2>
                                            <p className="text-slate-400 text-sm mt-1">Automated Cloud Backups Setup</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary font-black text-xs border border-brand-secondary/30">1</div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Create Google Cloud Project</h3>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    Go to the <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-brand-secondary hover:underline">Google Cloud Console</a>. Create a new project, then navigate to <strong className="text-white">APIs & Services &gt; Library</strong> and enable the <strong className="text-white">Google Drive API</strong>.
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary font-black text-xs border border-brand-secondary/30">2</div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Configure OAuth Consent Screen</h3>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    Go to <strong className="text-white">OAuth consent screen</strong>. Set User Type to <strong className="text-white">External</strong> (or Internal if using Google Workspace). Fill in the required app details. Add your email as a Test User if your publishing status is "Testing".
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary font-black text-xs border border-brand-secondary/30">3</div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Generate Credentials</h3>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    Go to <strong className="text-white">Credentials &gt; Create Credentials &gt; OAuth client ID</strong>. Choose <strong className="text-white">Web application</strong>. Under "Authorized redirect URIs", add: <code className="text-brand-secondary font-mono text-[10px] bg-white/5 px-1 py-0.5 rounded ml-1">http://your-domain.com/api/backups/drive/callback</code> (replace with your actual domain/port).
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary font-black text-xs border border-brand-secondary/30">4</div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Update Environment Variables</h3>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    Copy the Client ID and Client Secret generated by Google. Add them to your <code className="text-brand-secondary font-mono text-[10px] bg-white/5 px-1 py-0.5 rounded">.env</code> file for the backend container:
                                                </p>
                                                <div className="bg-obsidian-950 rounded-xl p-4 mt-2 border border-white/5 font-mono text-[10px] text-slate-300">
                                                    <span className="text-brand-primary">GOOGLE_DRIVE_CLIENT_ID</span>=your-client-id.apps.googleusercontent.com<br/>
                                                    <span className="text-brand-primary">GOOGLE_DRIVE_CLIENT_SECRET</span>=your-client-secret<br/>
                                                    <span className="text-brand-primary">GOOGLE_DRIVE_REDIRECT_URI</span>=https://api.yourdomain.com/api/backups/drive/callback
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary font-black text-xs border border-brand-secondary/30">5</div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Link Account</h3>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    Restart your Docker containers to load the new env vars. Go to the <strong className="text-white">Backups</strong> tab in PolancoWatch, click <strong className="text-white">Connect Google Drive</strong>, and authorize the application.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Telegram Integration Section */}
                                <section className="glass-panel rounded-4xl p-10 border-white/5 bg-gradient-to-br from-[#0088cc]/5 to-transparent">
                                    <div className="flex items-start gap-6 mb-8">
                                        <div className="w-14 h-14 rounded-2xl bg-[#0088cc]/10 border border-[#0088cc]/20 flex items-center justify-center text-[#0088cc]">
                                            <MessageCircle size={28} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-white tracking-tight uppercase">Telegram Notifications</h2>
                                            <p className="text-slate-400 text-sm mt-1">Real-time alerts directly to your phone</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0088cc]/20 flex items-center justify-center text-[#0088cc] font-black text-xs border border-[#0088cc]/30">1</div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Create a Telegram Bot</h3>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    Open Telegram and search for <strong className="text-white">@BotFather</strong>. Send the command <code className="text-[#0088cc] font-mono text-[10px] bg-white/5 px-1 py-0.5 rounded">/newbot</code> and follow the instructions to choose a name and username. BotFather will give you an <strong className="text-white">HTTP API Token</strong>. Save this securely.
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0088cc]/20 flex items-center justify-center text-[#0088cc] font-black text-xs border border-[#0088cc]/30">2</div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Get your Chat ID</h3>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    Start a chat with your new bot by sending it a <code className="text-[#0088cc] font-mono text-[10px] bg-white/5 px-1 py-0.5 rounded">/start</code> message. Then, search for <strong className="text-white">@userinfobot</strong> or <strong className="text-white">@RawDataBot</strong> in Telegram, or use the API: <code className="text-[#0088cc] font-mono text-[10px] bg-white/5 px-1 py-0.5 rounded ml-1">https://api.telegram.org/bot&lt;YourBOTToken&gt;/getUpdates</code> to find your numeric Chat ID.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0088cc]/20 flex items-center justify-center text-[#0088cc] font-black text-xs border border-[#0088cc]/30">3</div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Configure PolancoWatch</h3>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    Go to the <strong className="text-white">Settings</strong> page in your PolancoWatch dashboard. Navigate to the Notifications section, enable Telegram, and paste your <strong className="text-white">Bot Token</strong> y <strong className="text-white">Chat ID</strong>. Click Save Settings. Test the connection by triggering an alert or backing up manually.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'supabase' && (
                            <section className="glass-panel rounded-4xl p-10 border-white/5 bg-gradient-to-br from-brand-primary/5 to-transparent animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-start gap-6 mb-8">
                                    <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                                        <Database size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Restauración de Supabase</h2>
                                        <p className="text-slate-400 text-sm mt-1">Guía técnica de recuperación de Base de Datos</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-6">
                                    <p className="text-sm leading-relaxed text-slate-300">
                                        Para restaurar una base de datos de Supabase limpia y sin colisiones de esquemas internos o errores de permisos de triggers (debido al rol de superusuario <code className="text-brand-primary font-mono text-xs">supabase_admin</code>), ejecuta los siguientes comandos en tu servidor:
                                    </p>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-xs border border-brand-primary/30">1</div>
                                        <div className="w-full">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Paso 1: Elevar Privilegios y Limpiar Esquemas</h3>
                                            <p className="text-xs text-slate-400 leading-relaxed mb-2">
                                                Otorga permisos de superusuario a <strong className="text-white">postgres</strong> temporalmente para poder restaurar los triggers, y limpia las extensiones y esquemas del sistema:
                                            </p>
                                            <div className="bg-obsidian-950 rounded-xl p-4 border border-white/5 font-mono text-[10px] text-slate-300 overflow-x-auto">
                                                docker exec -i devops-supabase-dcf6e8-db psql -U supabase_admin -d postgres &lt;&lt;EOF<br/>
                                                ALTER ROLE postgres SUPERUSER;<br/>
                                                DROP EXTENSION IF EXISTS pg_cron CASCADE;<br/>
                                                DROP EXTENSION IF EXISTS pg_graphql CASCADE;<br/>
                                                DROP EXTENSION IF EXISTS pg_net CASCADE;<br/>
                                                DROP EXTENSION IF EXISTS pgjwt CASCADE;<br/>
                                                DROP EXTENSION IF EXISTS supabase_vault CASCADE;<br/>
                                                DROP EXTENSION IF EXISTS pgcrypto CASCADE;<br/>
                                                DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;<br/>
                                                DROP EXTENSION IF EXISTS pg_stat_statements CASCADE;<br/>
                                                DROP EXTENSION IF EXISTS vector CASCADE;<br/>
                                                DROP PUBLICATION IF EXISTS supabase_realtime;<br/>
                                                DROP SCHEMA IF EXISTS public CASCADE;<br/>
                                                DROP SCHEMA IF EXISTS auth CASCADE;<br/>
                                                DROP SCHEMA IF EXISTS storage CASCADE;<br/>
                                                DROP SCHEMA IF EXISTS extensions CASCADE;<br/>
                                                DROP SCHEMA IF EXISTS graphql CASCADE;<br/>
                                                DROP SCHEMA IF EXISTS graphql_public CASCADE;<br/>
                                                DROP SCHEMA IF EXISTS realtime CASCADE;<br/>
                                                DROP SCHEMA IF EXISTS _realtime CASCADE;<br/>
                                                DROP SCHEMA IF EXISTS vault CASCADE;<br/>
                                                DROP SCHEMA IF EXISTS pgbouncer CASCADE;<br/>
                                                DROP SCHEMA IF EXISTS supabase_functions CASCADE;<br/>
                                                DROP SCHEMA IF EXISTS cron CASCADE;<br/>
                                                EOF
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-xs border border-brand-primary/30">2</div>
                                        <div className="w-full">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Paso 2: Recrear Esquema Público</h3>
                                            <p className="text-xs text-slate-400 leading-relaxed mb-2">
                                                Prepara la base de datos recreando el esquema principal de tu proyecto:
                                            </p>
                                            <div className="bg-obsidian-950 rounded-xl p-4 border border-white/5 font-mono text-[10px] text-slate-300">
                                                docker exec -i devops-supabase-dcf6e8-db psql -U supabase_admin -d postgres -c "CREATE SCHEMA public;"
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-xs border border-brand-primary/30">3</div>
                                        <div className="w-full">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Paso 3: Cargar el Backup SQL</h3>
                                            <p className="text-xs text-slate-400 leading-relaxed mb-2">
                                                Inyecta el archivo SQL de tu copia de seguridad al contenedor de base de datos de Supabase:
                                            </p>
                                            <div className="bg-obsidian-950 rounded-xl p-4 border border-white/5 font-mono text-[10px] text-slate-300">
                                                cat /var/backups/Comodo-Supabase-Stagging.sql | docker exec -i devops-supabase-dcf6e8-db psql -U supabase_admin -d postgres
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-xs border border-brand-primary/30">4</div>
                                        <div className="w-full">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Paso 4: Revocar Privilegios de Superusuario</h3>
                                            <p className="text-xs text-slate-400 leading-relaxed mb-2">
                                                Por buenas prácticas de seguridad, retira los permisos de superusuario a <strong className="text-white">postgres</strong>:
                                            </p>
                                            <div className="bg-obsidian-950 rounded-xl p-4 border border-white/5 font-mono text-[10px] text-slate-300">
                                                docker exec -i devops-supabase-dcf6e8-db psql -U supabase_admin -d postgres -c "ALTER ROLE postgres NOSUPERUSER;"
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-4 text-xs text-brand-secondary leading-relaxed">
                                        <strong>Tip de Automatización:</strong> Puedes ejecutar el script <code className="text-white font-mono bg-white/5 px-1 rounded">/root/restore_db.sh</code> guardado directamente en tu servidor para automatizar todos estos pasos con un solo comando.
                                    </div>
                                </div>
                            </section>
                        )}
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
