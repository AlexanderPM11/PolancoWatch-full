import { useNavigate, useLocation } from 'react-router-dom';
import { 
    Activity,
    LayoutDashboard, 
    Cpu, 
    BookOpen, 
    LogOut, 
    ChevronLeft, 
    ChevronRight,
    ShieldCheck,
    Database,
    User,
    Menu,
    X
} from 'lucide-react';
import { useState } from 'react';
import { authService } from '../services/api';

interface SidebarItemProps {
    icon: React.ReactNode;
    label: string;
    path: string;
    isActive: boolean;
    collapsed: boolean;
    onClick: () => void;
}

const SidebarItem = ({ icon, label, isActive, collapsed, onClick }: SidebarItemProps) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative ${
            isActive 
            ? 'bg-brand-primary/10 text-white border border-brand-primary/20 shadow-[0_0_20px_rgba(167,139,250,0.1)]' 
            : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
        }`}
    >
        <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
            {icon}
        </div>
        {!collapsed && (
            <span className={`text-xs font-black uppercase tracking-[0.2em] transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                {label}
            </span>
        )}
        {isActive && !collapsed && (
            <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_10px_#a78bfa]"></div>
        )}
    </button>
);

interface SidebarProps {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleNavigate = (path: string) => {
        navigate(path);
        setMobileOpen(false);
    };

    const menuItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Console', path: '/' },
        { icon: <Activity size={20} />, label: 'Alerts', path: '/alerts' },
        { icon: <Database size={20} />, label: 'Backups', path: '/backups' },
        { icon: <ShieldCheck size={20} />, label: 'Web Monitors', path: '/web-monitors' },
        { icon: <Cpu size={20} />, label: 'Processes', path: '/processes' },
        { icon: <User size={20} />, label: 'Profile', path: '/profile' },
        { icon: <BookOpen size={20} />, label: 'Documentation', path: '/documentation' },
    ];

    return (
        <>
            {/* Mobile Toggle Button */}
            <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden fixed top-6 left-6 z-100 p-3 rounded-xl bg-obsidian-900 border border-white/10 text-brand-primary shadow-2xl transition-all active:scale-95"
            >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Mobile Backdrop */}
            {mobileOpen && (
                <div 
                    className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-md z-60 lg:hidden animate-fade-in"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside 
                className={`fixed left-0 top-0 h-screen bg-obsidian-900/60 backdrop-blur-3xl border-r border-white/5 transition-all duration-500 z-70 flex flex-col ${
                    collapsed ? 'w-20' : 'w-72'
                } ${
                    mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`}
            >
            {/* Logo Section */}
            <div className="h-24 flex items-center px-6 mb-8 mt-2">
                <div className="flex items-center gap-4 overflow-hidden">
                    <div className="min-w-[40px] h-10 rounded-xl bg-obsidian-800 border border-white/5 flex items-center justify-center text-brand-primary font-bold shadow-2xl relative group">
                        <div className="absolute inset-0 bg-linear-to-br from-brand-primary/20 to-brand-secondary/20 animate-pulse-slow"></div>
                        <span className="relative z-10 text-xl tracking-tighter">P</span>
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col animate-fade-in whitespace-nowrap">
                            <span className="font-black text-lg tracking-tight text-white leading-none">POLANCO<span className="text-brand-secondary">WATCH</span></span>
                            <span className="text-[90px] uppercase tracking-[0.3em] text-brand-primary/50 font-bold overflow-hidden h-0 group-hover:h-auto transition-all">CORE_V1</span>
                            <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold mt-1">Status: Operational</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation Section */}
            <div className="flex-1 px-4 space-y-2">
                {menuItems.map((item) => (
                    <SidebarItem
                        key={item.path}
                        {...item}
                        isActive={location.pathname === item.path}
                        collapsed={collapsed}
                        onClick={() => handleNavigate(item.path)}
                    />
                ))}
            </div>

            {/* Bottom Actions */}
            <div className="p-4 space-y-2 border-t border-white/5">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full flex items-center gap-4 px-4 py-3 text-slate-500 hover:text-white transition-colors duration-300"
                >
                    {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    {!collapsed && <span className="text-[10px] font-black uppercase tracking-widest">Collapse View</span>}
                </button>

                <button
                    onClick={() => { authService.logout(); navigate('/login'); }}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 transition-all group"
                >
                    <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                    {!collapsed && <span className="text-xs font-black uppercase tracking-[0.2em]">Terminate Session</span>}
                </button>
            </div>

            {/* Security Indicator & Branding */}
            {!collapsed && (
                <div className="px-8 py-6 space-y-4">
                    <div className="flex items-center gap-3 opacity-40">
                        <ShieldCheck size={14} className="text-brand-secondary" />
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em]">Auth Level 4: Admin</span>
                    </div>
                    
                    <a 
                        href="https://apolanco.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block text-[9px] font-bold text-slate-500 hover:text-brand-primary transition-colors duration-300 uppercase tracking-[0.2em] opacity-60 hover:opacity-100"
                    >
                        Developed by <span className="text-brand-secondary">apolanco.com</span>
                    </a>
                </div>
            )}
        </aside>
        </>
    );
}
