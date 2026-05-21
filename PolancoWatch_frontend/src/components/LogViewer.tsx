import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Terminal, Search, ChevronDown, Download, WifiOff } from 'lucide-react';
import { logsService } from '../services/logsService';

interface LogViewerProps {
  containerId: string;
  containerName: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({ containerId, containerName }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter(log =>
    log.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleLog = (message: string) => {
      setLogs(prev => [...prev, message].slice(-5000)); // Limit logs buffer
      setStatus('connected');
    };

    const startStreaming = async () => {
      setLogs([]);
      setStatus('connecting');
      try {
        await logsService.startLogs(containerId, handleLog);
      } catch (err) {
        setStatus('error');
      }
    };

    startStreaming();

    return () => {
      logsService.stopLogs();
      setStatus('disconnected');
    };
  }, [containerId]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, filteredLogs]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
    setAutoScroll(isAtBottom);
  };

  const clearLogs = () => setLogs([]);

  const downloadLogs = () => {
    const blob = new Blob([logs.join('')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${containerName}_logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const highlightSearch = (text: string) => {
    if (!searchTerm) return text;
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === searchTerm.toLowerCase() 
        ? <span key={i} className="bg-brand-primary/40 text-white font-bold px-0.5 rounded-sm shadow-[0_0_8px_rgba(139,92,246,0.3)]">{part}</span>
        : <span key={i}>{part}</span>
    );
  };

  return (
    <div className="flex flex-col h-[600px] w-full bg-obsidian-950/40 rounded-3xl border border-white/5 overflow-hidden relative">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-b border-white/5 bg-white/2 gap-4">
        <div className="flex items-center gap-3">
          <Terminal size={16} className="text-brand-primary" />
          <div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest leading-none">{containerName}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${
                status === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                status === 'error' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-slate-600'
              }`}></div>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{status}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative group flex-1 md:flex-none">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-primary transition-colors" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-obsidian-950/50 border border-white/5 rounded-xl pl-8 pr-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white placeholder:text-slate-700 focus:outline-none focus:border-brand-primary/30 transition-all md:w-64"
            />
          </div>

          <div className="h-6 w-px bg-white/10 hidden md:block"></div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-2 rounded-lg border transition-all ${
                autoScroll ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary shadow-inner' : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300'
              }`}
              title={autoScroll ? "Disable Auto-scroll" : "Enable Auto-scroll"}
            >
              <ChevronDown size={14} className={autoScroll ? 'animate-bounce' : ''} />
            </button>
            <button
              onClick={clearLogs}
              className="p-2 bg-white/5 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 rounded-lg text-slate-500 hover:text-rose-400 transition-all shadow-inner"
              title="Clear Logs"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={downloadLogs}
              className="p-2 bg-white/5 hover:bg-brand-secondary/10 border border-white/5 hover:border-brand-secondary/20 rounded-lg text-slate-500 hover:text-brand-secondary transition-all shadow-inner"
              title="Download Logs"
            >
              <Download size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Log Content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed custom-scrollbar bg-obsidian-950/30"
      >
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-rose-400 p-8 text-center bg-rose-500/5 rounded-2xl border border-rose-500/10">
            <WifiOff size={32} className="opacity-50" />
            <p className="font-bold uppercase tracking-widest text-[10px]">Kernel Stream Disconnected</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-rose-500/20 border border-rose-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500/30 transition-all"
            >
              Restart Engine
            </button>
          </div>
        )}

        <div className="space-y-0.5">
          {filteredLogs.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all py-0.5 border-l-2 border-transparent hover:border-brand-primary/20 hover:bg-white/2 px-2 transition-all flex group">
              <span className="text-slate-600 mr-4 select-none opacity-30 w-10 text-right shrink-0 group-hover:opacity-60 transition-opacity">{(i + 1).toString().padStart(4, '0')}</span>
              <span className="text-slate-300 flex-1">{highlightSearch(line)}</span>
            </div>
          ))}
        </div>

        {status === 'connected' && logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 gap-4 py-20 italic">
            <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-bounce"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-bounce [animation-delay:0.4s]"></div>
            </div>
            <p className="uppercase tracking-[0.4em] text-[9px] font-black">Awaiting Stream Input</p>
          </div>
        )}

        {searchTerm && filteredLogs.length === 0 && logs.length > 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 gap-4 py-20 italic">
            <Search size={32} />
            <p className="uppercase tracking-[0.2em] text-[9px] font-black text-center">No segments matching "{searchTerm}"<br/>in current buffer</p>
          </div>
        )}
      </div>

      {/* Floating Resume Scroll */}
      {!autoScroll && logs.length > 0 && (
        <button 
          onClick={() => setAutoScroll(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-brand-primary backdrop-blur-md border border-brand-primary/40 rounded-full text-[9px] font-black text-white shadow-2xl shadow-brand-primary/50 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 z-20 group"
        >
          <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
          Resume Kernel Tracking
        </button>
      )}
    </div>
  );
};
