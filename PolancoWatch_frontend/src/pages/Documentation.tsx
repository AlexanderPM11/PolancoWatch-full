import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Cpu, 
  Activity, 
  HardDrive, 
  Network, 
  Terminal, 
  Settings, 
  Info, 
  Cloud, 
  MessageCircle, 
  Shield, 
  Database,
  Copy,
  Check,
  FolderSync
} from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

function CodeBlock({ code, language = "BASH" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="bg-[#05070B] border border-white/10 rounded-2xl overflow-hidden font-mono text-[13px] my-5 shadow-2xl animate-in fade-in duration-300">
      <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10 select-none">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3">{language}</span>
        </div>
        <button 
          onClick={handleCopy}
          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
            copied 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
          }`}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-5 overflow-x-auto text-slate-300 leading-relaxed max-w-full custom-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}

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
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">REF_DOCS_v1.6</span>
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
                            { id: 'restores', label: 'Automated Restores', icon: FolderSync },
                            { id: 'supabase', label: 'Manual Supabase', icon: Database }
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
                                        <h2 className="text-3xl font-black text-white tracking-tight uppercase">System Architecture</h2>
                                        <p className="text-slate-400 text-base mt-1">Real-time Data Pipeline & Orchestration</p>
                                    </div>
                                </div>
                                
                                <div className="grid md:grid-cols-2 gap-12">
                                    <div>
                                        <h3 className="text-sm font-black text-brand-secondary uppercase tracking-widest mb-4">Backend Core</h3>
                                        <p className="text-base leading-relaxed mb-4 text-slate-300">
                                            Built on <span className="text-white font-bold">ASP.NET Core 8</span>, the backend operates as a distributed-ready API. It features a <span className="text-brand-primary font-bold">SystemMetricsHostedService</span> that heartbeats every 2 seconds, scraping OS-level telemetry.
                                        </p>
                                        <ul className="space-y-3 text-slate-300">
                                            <li className="flex gap-3 text-base">
                                                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-2.5 flex-shrink-0"></div>
                                                <span><strong className="text-white">SignalR Hub:</strong> Direct WebSocket streaming for sub-second UI latency.</span>
                                            </li>
                                            <li className="flex gap-3 text-base">
                                                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-2.5 flex-shrink-0"></div>
                                                <span><strong className="text-white">Background Workers:</strong> Decoupled threshold evaluation for instant alerting.</span>
                                            </li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-brand-secondary uppercase tracking-widest mb-4">Data Persistence</h3>
                                        <p className="text-base leading-relaxed mb-4 text-slate-300">
                                            Utilizes a lightweight <span className="text-brand-primary font-bold">SQLite</span> instance for configuration and event logging, ensuring zero-configuration deployment while maintaining ACID compliance.
                                        </p>
                                        <CodeBlock 
                                          language="CONFIG" 
                                          code={`// Infrastructure Layer
Entity Framework Core + SQLite
Automated Database Evolution`}
                                        />
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
                                        <h2 className="text-3xl font-black text-white tracking-tight uppercase">Security & Privacy</h2>
                                        <p className="text-slate-400 text-base mt-1">Credential Safety & Session Integrity</p>
                                    </div>
                                </div>
                                
                                <div className="grid md:grid-cols-2 gap-12">
                                    <div>
                                        <h3 className="text-sm font-black text-emerald-500 uppercase tracking-widest mb-4">Credential Protection</h3>
                                        <p className="text-base leading-relaxed mb-4 text-slate-300">
                                            Passwords are never stored in plain text. We utilize the <span className="text-white font-bold">BCrypt.Net</span> adaptive hashing algorithm, which incorporates a per-user salt and computational cost factor to nullify brute-force and rainbow table attacks.
                                        </p>
                                        <CodeBlock 
                                          language="C#" 
                                          code={`// One-Way Cryptographic Hash
string secureHash = BCrypt.Net.BCrypt.HashPassword(rawPassword);`}
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-emerald-500 uppercase tracking-widest mb-4">Session Authorization</h3>
                                        <p className="text-base leading-relaxed mb-4 text-slate-300">
                                            Stateless authentication is handled via <span className="text-white font-bold">JSON Web Tokens (JWT)</span>. Each request to sensitive endpoints must include a signed token, ensuring that your monitoring data remains inaccessible to unauthorized actors.
                                        </p>
                                        <CodeBlock 
                                          language="HTTP" 
                                          code={`// Algorithm: HMAC-SHA256
Authorization: Bearer [JWT_TOKEN]`}
                                        />
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
                                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">CPU Tracking</h2>
                                    </div>
                                    <p className="text-base text-slate-300 leading-relaxed mb-6">
                                        Derived from <code className="text-brand-primary font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded">/proc/stat</code> (Linux) and <code className="text-brand-primary font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded">PercCounter</code> (Win).
                                    </p>
                                    <CodeBlock 
                                      language="MATH" 
                                      code={`Usage% = (1.0 - (deltaIdle / deltaTotal)) * 100`}
                                    />
                                </section>

                                {/* Memory */}
                                <section className="glass-panel rounded-4xl p-10 border-white/5">
                                    <div className="flex items-center gap-4 mb-6">
                                        <Activity className="text-brand-secondary" size={24} />
                                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">RAM Analysis</h2>
                                    </div>
                                    <p className="text-base text-slate-300 leading-relaxed mb-6">
                                        Total memory minus available pages (including reclaimable cache).
                                    </p>
                                    <CodeBlock 
                                      language="MATH" 
                                      code={`Used = MemTotal - MemAvailable`}
                                    />
                                </section>

                                {/* Networking */}
                                <section className="glass-panel rounded-4xl p-10 border-white/5">
                                    <div className="flex items-center gap-4 mb-6">
                                        <Network className="text-brand-secondary" size={24} />
                                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Networking</h2>
                                    </div>
                                    <ul className="space-y-4">
                                        <li className="flex gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-secondary mt-2 flex-shrink-0"></div>
                                            <div className="text-base text-slate-300">
                                                <span className="text-white font-bold">Linux:</span> Byte-level delta of <code className="text-brand-secondary font-mono text-xs bg-white/5 px-1 rounded">/proc/net/dev</code>.
                                            </div>
                                        </li>
                                        <li className="flex gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-secondary mt-2 flex-shrink-0"></div>
                                            <div className="text-base text-slate-300">
                                                <span className="text-white font-bold">Windows:</span> Native <code className="text-brand-secondary font-mono text-xs bg-white/5 px-1 rounded">GetIPStatistics</code> polling.
                                            </div>
                                        </li>
                                    </ul>
                                </section>

                                {/* Storage */}
                                <section className="glass-panel rounded-4xl p-10 border-white/5">
                                    <div className="flex items-center gap-4 mb-6">
                                        <HardDrive className="text-brand-primary" size={24} />
                                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Storage</h2>
                                    </div>
                                    <ul className="space-y-4">
                                        <li className="flex gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-2 flex-shrink-0"></div>
                                            <div className="text-base text-slate-300">
                                                <span className="text-white font-bold">Driver:</span> Cross-platform <code className="text-brand-primary font-mono text-xs bg-white/5 px-1 rounded">DriveInfo</code> API.
                                            </div>
                                        </li>
                                        <li className="flex gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-2 flex-shrink-0"></div>
                                            <div className="text-base text-slate-300">
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
                                            <h2 className="text-3xl font-black text-white tracking-tight uppercase">Google Drive Integration</h2>
                                            <p className="text-slate-400 text-base mt-1">Automated Cloud Backups Setup</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary font-black text-sm border border-brand-secondary/30">1</div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Create Google Cloud Project</h3>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    Go to the <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-brand-secondary hover:underline font-bold">Google Cloud Console</a>. Create a new project, then navigate to <strong className="text-white">APIs & Services &gt; Library</strong> and enable the <strong className="text-white">Google Drive API</strong>.
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary font-black text-sm border border-brand-secondary/30">2</div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Configure OAuth Consent Screen</h3>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    Go to <strong className="text-white">OAuth consent screen</strong>. Set User Type to <strong className="text-white">External</strong> (or Internal if using Google Workspace). Fill in the required app details. Add your email as a Test User if your publishing status is "Testing".
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary font-black text-sm border border-brand-secondary/30">3</div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Generate Credentials</h3>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    Go to <strong className="text-white">Credentials &gt; Create Credentials &gt; OAuth client ID</strong>. Choose <strong className="text-white">Web application</strong>. Under "Authorized redirect URIs", add: <code className="text-brand-secondary font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded ml-1">http://your-domain.com/api/backups/drive/callback</code> (replace with your actual domain/port).
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary font-black text-sm border border-brand-secondary/30">4</div>
                                            <div className="w-full">
                                                <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Update Environment Variables</h3>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    Copy the Client ID and Client Secret generated by Google. Add them to your <code className="text-brand-secondary font-mono text-xs bg-white/5 px-1 py-0.5 rounded">.env</code> file for the backend container:
                                                </p>
                                                <CodeBlock 
                                                  language="ENV" 
                                                  code={`GOOGLE_DRIVE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
GOOGLE_DRIVE_REDIRECT_URI=https://api.yourdomain.com/api/backups/drive/callback`}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary font-black text-sm border border-brand-secondary/30">5</div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Link Account</h3>
                                                <p className="text-sm text-slate-400 leading-relaxed">
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
                                            <h2 className="text-3xl font-black text-white tracking-tight uppercase">Telegram Notifications</h2>
                                            <p className="text-slate-400 text-base mt-1">Real-time alerts directly to your phone</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#0088cc]/20 flex items-center justify-center text-[#0088cc] font-black text-sm border border-[#0088cc]/30">1</div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Create a Telegram Bot</h3>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    Open Telegram and search for <strong className="text-white font-bold">@BotFather</strong>. Send the command <code className="text-[#0088cc] font-mono text-xs bg-white/5 px-1 py-0.5 rounded">/newbot</code> and follow the instructions to choose a name and username. BotFather will give you an <strong className="text-white">HTTP API Token</strong>. Save this securely.
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#0088cc]/20 flex items-center justify-center text-[#0088cc] font-black text-sm border border-[#0088cc]/30">2</div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Get your Chat ID</h3>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    Start a chat with your new bot by sending it a <code className="text-[#0088cc] font-mono text-xs bg-white/5 px-1 py-0.5 rounded">/start</code> message. Then, search for <strong className="text-white font-bold">@userinfobot</strong> or <strong className="text-white font-bold">@RawDataBot</strong> in Telegram, or use the API: <code className="text-[#0088cc] font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded ml-1">https://api.telegram.org/bot&lt;YourBOTToken&gt;/getUpdates</code> to find your Chat ID.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#0088cc]/20 flex items-center justify-center text-[#0088cc] font-black text-sm border border-[#0088cc]/30">3</div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Configure PolancoWatch</h3>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    Go to the <strong className="text-white">Settings</strong> page in your PolancoWatch dashboard. Navigate to the Notifications section, enable Telegram, and paste your <strong className="text-white">Bot Token</strong> y <strong className="text-white">Chat ID</strong>. Click Save Settings. Test the connection by triggering an alert or backing up manually.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'restores' && (
                            <section className="glass-panel rounded-4xl p-10 border-white/5 bg-gradient-to-br from-brand-primary/5 to-transparent animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-start gap-6 mb-8">
                                    <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                                        <FolderSync size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-white tracking-tight uppercase">Automated Restorations</h2>
                                        <p className="text-slate-400 text-base mt-1">Zero-downtime, fully automated database and storage restoration</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-8">
                                    <p className="text-base leading-relaxed text-slate-300">
                                        PolancoWatch incluye un sistema avanzado de orquestación de restauraciones mediante <strong className="text-white">Hangfire</strong>, el cual evita bloqueos pesados y se ejecuta completamente en segundo plano. A través de la pestaña <strong>Restores</strong> en la pantalla principal de <strong>Backups</strong>, los usuarios pueden subir archivos enormes de bases de datos o almacenamiento sin límites de tamaño gracias a integraciones multipart.
                                    </p>

                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div className="bg-obsidian-900 border border-white/10 rounded-3xl p-6">
                                            <h3 className="text-sm font-black text-brand-secondary uppercase tracking-widest mb-4">Inteligencia de Contenedores</h3>
                                            <p className="text-base text-slate-300 leading-relaxed">
                                                La plataforma utiliza la <strong className="text-white">API local de Docker</strong> para inspeccionar los contenedores en tiempo real. Cuando solicitas una restauración de "Storage" para Supabase o WordPress, el sistema detecta <em>automáticamente</em> las rutas físicas mapeadas en el host (ej. <code className="text-xs font-mono bg-white/5 px-1 py-0.5 rounded">/var/lib/storage</code> o <code className="text-xs font-mono bg-white/5 px-1 py-0.5 rounded">/var/www/html</code>). Esto elimina la necesidad de configuración manual de rutas host.
                                            </p>
                                        </div>

                                        <div className="bg-obsidian-900 border border-white/10 rounded-3xl p-6">
                                            <h3 className="text-sm font-black text-brand-secondary uppercase tracking-widest mb-4">Storage Inmutable (xattrs)</h3>
                                            <p className="text-base text-slate-300 leading-relaxed">
                                                Al restaurar volúmenes complejos como los de Supabase, la orquestación lanza temporalmente un contenedor efímero (<code className="text-xs font-mono bg-white/5 px-1 py-0.5 rounded">alpine:latest</code>) que monta directamente la ruta detectada. Desde allí, ejecuta comandos <code className="text-xs font-mono bg-white/5 px-1 py-0.5 rounded">tar --xattrs</code> para garantizar que todos los metadatos internos de content-types permanezcan completamente inalterados.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-5 text-sm text-brand-secondary leading-relaxed">
                                        <strong>Seguimiento en Vivo:</strong> Todas las restauraciones envían actualizaciones de telemetría a través de <strong>SignalR</strong>, lo que permite visualizar barras de progreso en la UI mientras la base de datos se recrea en tiempo real.
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeTab === 'supabase' && (
                            <section className="glass-panel rounded-4xl p-10 border-white/5 bg-gradient-to-br from-brand-primary/5 to-transparent animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-start gap-6 mb-8">
                                    <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                                        <Database size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-white tracking-tight uppercase">Restauración de Supabase</h2>
                                        <p className="text-slate-400 text-base mt-1">Guía técnica de recuperación de Base de Datos y Storage</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-8">
                                    <p className="text-base leading-relaxed text-slate-300">
                                        Para restaurar una base de datos de Supabase limpia y sin colisiones de esquemas internos o errores de permisos de triggers (debido al rol de superusuario <code className="text-brand-primary font-mono text-xs bg-white/5 px-1 py-0.5 rounded">supabase_admin</code>), ejecuta los siguientes comandos en tu servidor:
                                    </p>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-sm border border-brand-primary/30">1</div>
                                        <div className="w-full">
                                            <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Paso 1: Elevar Privilegios y Limpiar Esquemas</h3>
                                            <p className="text-sm text-slate-400 leading-relaxed">
                                                Otorga permisos de superusuario a <strong className="text-white">postgres</strong> temporalmente para poder restaurar los triggers, y limpia las extensiones y esquemas del sistema:
                                            </p>
                                            <CodeBlock 
                                              language="BASH" 
                                              code={`docker exec -i [NOMBRE_CONTENEDOR_DB] psql -U supabase_admin -d postgres <<EOF
ALTER ROLE postgres SUPERUSER;
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP EXTENSION IF EXISTS pg_graphql CASCADE;
DROP EXTENSION IF EXISTS pg_net CASCADE;
DROP EXTENSION IF EXISTS pgjwt CASCADE;
DROP EXTENSION IF EXISTS supabase_vault CASCADE;
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
DROP EXTENSION IF EXISTS pg_stat_statements CASCADE;
DROP EXTENSION IF EXISTS vector CASCADE;
DROP PUBLICATION IF EXISTS supabase_realtime;
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS storage CASCADE;
DROP SCHEMA IF EXISTS extensions CASCADE;
DROP SCHEMA IF EXISTS graphql CASCADE;
DROP SCHEMA IF EXISTS graphql_public CASCADE;
DROP SCHEMA IF EXISTS realtime CASCADE;
DROP SCHEMA IF EXISTS _realtime CASCADE;
DROP SCHEMA IF EXISTS vault CASCADE;
DROP SCHEMA IF EXISTS pgbouncer CASCADE;
DROP SCHEMA IF EXISTS supabase_functions CASCADE;
DROP SCHEMA IF EXISTS cron CASCADE;
EOF`}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-sm border border-brand-primary/30">2</div>
                                        <div className="w-full">
                                            <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Paso 2: Recrear Esquema Público</h3>
                                            <p className="text-sm text-slate-400 leading-relaxed">
                                                Prepara la base de datos recreando el esquema principal de tu proyecto:
                                            </p>
                                            <CodeBlock 
                                              language="BASH" 
                                              code={`docker exec -i [NOMBRE_CONTENEDOR_DB] psql -U supabase_admin -d postgres -c "CREATE SCHEMA public;"`}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-sm border border-brand-primary/30">3</div>
                                        <div className="w-full">
                                            <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Paso 3: Cargar el Backup SQL</h3>
                                            <p className="text-sm text-slate-400 leading-relaxed">
                                                Inyecta el archivo SQL de tu copia de seguridad al contenedor de base de datos de Supabase:
                                            </p>
                                            <CodeBlock 
                                              language="BASH" 
                                              code={`cat /var/backups/Comodo-Supabase-Stagging.sql | docker exec -i [NOMBRE_CONTENEDOR_DB] psql -U supabase_admin -d postgres`}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-sm border border-brand-primary/30">4</div>
                                        <div className="w-full">
                                            <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Paso 4: Revocar Privilegios de Superusuario</h3>
                                            <p className="text-sm text-slate-400 leading-relaxed">
                                                Por buenas prácticas de seguridad, retira los permisos de superusuario a <strong className="text-white">postgres</strong>:
                                            </p>
                                            <CodeBlock 
                                              language="BASH" 
                                              code={`docker exec -i [NOMBRE_CONTENEDOR_DB] psql -U supabase_admin -d postgres -c "ALTER ROLE postgres NOSUPERUSER;"`}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="border-t border-white/5 pt-8 mt-8">
                                        <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-4">5. Restauración Completa (Storage y Secretos)</h3>
                                        <p className="text-base text-slate-300 leading-relaxed mb-4">
                                            La base de datos contiene los metadatos, pero para una restauración completa necesitas migrar los archivos físicos del Storage y mantener las claves de seguridad:
                                        </p>
                                        
                                        <ul className="space-y-6 text-base text-slate-300">
                                            <li className="flex flex-col gap-2">
                                                <span><strong className="text-white">A. Archivos del Storage (Binarios) y Atributos Extendidos (xattrs):</strong> Supabase guarda el content-type en los atributos extendidos del archivo (`xattrs`). Si los comprimes o copias sin preservarlos, dará error 500 al visualizar/descargar. Usa el método directo en el host con `tar` o `rsync`:</span>
                                                <CodeBlock 
                                                  language="BASH / HOST"
                                                  code={`# --- Método Recomendado (Directo en el Host VPS) ---
# 1. Respaldar en Host:
# [tar] Comprime el origen preservando atributos extendidos (xattrs) que guardan el contentType del archivo
tar --xattrs --xattrs-include='user.supabase.*' -czf /var/backups/supabase-storage-backup.tar.gz -C /etc/dokploy/compose/[PROJECT_ID_ORIGEN]/files/volumes/storage .

# 2. Restaurar en Host Destino:
# [rm] Borra de forma recursiva el directorio destino para evitar duplicados o archivos residuales
rm -rf /etc/dokploy/compose/[PROJECT_ID_DESTINO]/files/volumes/storage/*
# [tar] Descomprime el respaldo en el destino aplicando de nuevo todos los atributos extendidos (xattrs)
tar --xattrs --xattrs-include='user.supabase.*' -xzf /var/backups/supabase-storage-backup.tar.gz -C /etc/dokploy/compose/[PROJECT_ID_DESTINO]/files/volumes/storage/
# [chown] Cambia recursivamente el propietario a root para evitar problemas de permisos de lectura del contenedor
chown -R root:root /etc/dokploy/compose/[PROJECT_ID_DESTINO]/files/volumes/storage
# [docker restart] Reinicia el contenedor de almacenamiento para que Supabase reconozca y cargue los archivos
docker restart [NOMBRE_CONTENEDOR_STORAGE]

# [rm] Opcional: Elimina el archivo de respaldo temporal del host para liberar espacio en disco
rm -f /var/backups/supabase-storage-backup.tar.gz

# --- Alternativa rápida local (rsync sin comprimir) ---
# [rsync] Copia todos los archivos directamente entre directorios locales del host conservando permisos (-a), y atributos extendidos (-A -X)
# rsync -aAX /etc/dokploy/compose/[ID_ORIGEN]/files/volumes/storage/ /etc/dokploy/compose/[ID_DESTINO]/files/volumes/storage/`}
                                                />
                                            </li>
                                            <li className="flex flex-col gap-1">
                                                <span><strong className="text-white">B. Variables de Entorno y JWT (.env):</strong> Copia exactamente las mismas claves de firma de JWT (`anon`, `service_role`) y las contraseñas del archivo <code className="text-brand-primary font-mono text-xs bg-white/5 px-1 py-0.5 rounded font-bold">.env</code> de origen a destino. De lo contrario, las sesiones activas de tus usuarios se invalidarán y el backend de .NET no se podrá conectar a la base de datos de Supabase.</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-5 text-sm text-brand-secondary leading-relaxed">
                                        <strong>Tip de Automatización:</strong> Puedes ejecutar el script <code className="text-white font-mono bg-white/5 px-1.5 py-0.5 rounded font-bold">/root/restore_db.sh</code> guardado directamente en tu servidor para automatizar todos estos pasos con un solo comando.
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Infrastructure Footer */}
                    <footer className="pt-16 border-t border-white/5 text-center">
                        <div className="inline-flex items-center gap-3 text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">
                            <Settings size={14} className="animate-spin-slow" /> PolancoWatch Core v1.4.0 Build Final
                        </div>
                    </footer>
                </div>
            </main>
        </div>
    );
}
