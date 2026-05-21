import { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  FolderSync, 
  Download, 
  Trash2, 
  Cloud, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Calendar,
  Plus,
  FileArchive,
  Search,
  ChevronDown,
  Settings,
  AlertCircle,
  MessageCircle,
  X,
  History as LucideHistory,
  Play
} from 'lucide-react';
import { backupService, type BackupSchedule } from '../services/api';
import { backupSignalRService } from '../services/backupSignalR';
import { format } from 'date-fns';
import Toast, { type ToastType } from '../components/Toast';
import Modal from '../components/Modal';

interface Backup {
  id: string;
  name: string;
  type: number; // 0: Volume, 1: Database
  format: number; // 0: Zip, 1: TarGz
  filePath: string;
  size: number;
  createdAt: string;
  status: number; // 0: Pending, 1: InProgress, 2: Completed, 3: Failed
  errorMessage?: string;
  cloudSyncStatus: number; // 0: NotSynced, 1: Synced, 2: Failed
  cloudLink?: string;
}


interface BackupProgress {
  backupId: string;
  percentage: number;
  message: string;
}

const Combobox = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select an option...",
  allowCustom = false
}: { 
  options: { name: string, path: string }[], 
  value: string, 
  onChange: (val: string) => void,
  placeholder?: string,
  allowCustom?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(search.toLowerCase()) || 
    opt.path.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(o => o.path === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 cursor-pointer hover:border-brand-primary/50 transition-all"
      >
        <div className="flex flex-col truncate">
          <span className={value ? "text-white text-xs font-black truncate" : "text-slate-500 text-sm"}>
            {selectedOption ? selectedOption.name : (allowCustom && value ? value : placeholder)}
          </span>
          {selectedOption && selectedOption.path !== "" && selectedOption.path !== value && <span className="text-[8px] text-slate-500 font-bold truncate max-w-[200px]">{selectedOption.path}</span>}
        </div>
        <ChevronDown size={16} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-obsidian-900 border border-white/10 rounded-2xl shadow-2xl z-200 overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                autoFocus
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find volume..."
                className="w-full bg-white/5 border-none rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:ring-1 focus:ring-brand-primary/50 outline-none"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {filteredOptions.map((opt) => (
              <div 
                key={opt.path}
                onClick={() => {
                  onChange(opt.path);
                  setIsOpen(false);
                  setSearch("");
                }}
                className="px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-none group"
              >
                <p className="text-xs font-black text-slate-300 group-hover:text-brand-primary transition-colors">{opt.name}</p>
                {opt.path !== "" && opt.path !== opt.name && <p className="text-[9px] text-slate-500 font-bold mt-1 truncate">{opt.path}</p>}
              </div>
            ))}
            {filteredOptions.length === 0 && !allowCustom && (
              <div className="px-4 py-8 text-center text-[10px] text-slate-500 uppercase font-black tracking-widest">
                No matching options
              </div>
            )}
            {allowCustom && search.length > 0 && !options.some(o => o.path.toLowerCase() === search.toLowerCase()) && (
              <div 
                onClick={() => {
                  onChange(search);
                  setIsOpen(false);
                  setSearch("");
                }}
                className="px-4 py-3 hover:bg-brand-primary/10 cursor-pointer transition-colors border-t border-brand-primary/20 group"
              >
                <p className="text-xs font-black text-brand-primary group-hover:text-brand-secondary transition-colors">Use "{search}"</p>
                <p className="text-[9px] text-brand-primary/60 font-bold mt-1 truncate">Custom Database Name</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const VaultOverlay = ({ isOpen, onClose, title, children, footer }: { 
  isOpen: boolean, 
  onClose: () => void, 
  title: string, 
  children: React.ReactNode, 
  footer?: React.ReactNode 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-150 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-obsidian-950/80 backdrop-blur-xl animate-fade-in" onClick={onClose}></div>
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col glass-panel rounded-[2.5rem] border border-white/10 p-8 shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-float-up">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-primary/10 rounded-2xl border border-brand-primary/20 text-brand-primary">
              <Settings size={20} />
            </div>
            <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 pb-2">
          {children}
        </div>
        
        {footer && (
          <div className="mt-6 pt-6 border-t border-white/5 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange }: { 
  currentPage: number, 
  totalItems: number, 
  itemsPerPage: number, 
  onPageChange: (page: number) => void 
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-8 py-4 border-t border-white/5 bg-white/2">
      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
        Showing <span className="text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-white">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="text-white">{totalItems}</span> results
      </p>
      <div className="flex gap-2">
        <button 
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-all border border-white/5"
        >
          Previous
        </button>
        <button 
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest bg-brand-primary text-obsidian-950 hover:bg-brand-secondary disabled:opacity-30 transition-all shadow-lg shadow-brand-primary/20"
        >
          Next
        </button>
      </div>
    </div>
  );
};

const Backups = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [availableVolumes, setAvailableVolumes] = useState<{ name: string, path: string }[]>([]);
  const [availableContainers, setAvailableContainers] = useState<{ id: string, name: string, state: string, image: string }[]>([]);
  const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, BackupProgress>>({});
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);
  const [connectingDrive, setConnectingDrive] = useState(false);
  
  // Modals state
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<string | null>(null);
  const [runningProtocols, setRunningProtocols] = useState<Record<string, boolean>>({});

  // Toast System
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);
  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };
  
  const [newBackupType, setNewBackupType] = useState<number>(1); // 1: DB, 0: Volume
  const [newBackupTarget, setNewBackupTarget] = useState("");
  const [newBackupDbName, setNewBackupDbName] = useState("");
  const [newBackupDbUser, setNewBackupDbUser] = useState("root");
  const [newBackupDbPass, setNewBackupDbPass] = useState("");
  const [newBackupName, setNewBackupName] = useState("");
  //storage: 'local' | 'both' | 'drive'
  const [newBackupStorage, setNewBackupStorage] = useState<'local' | 'both' | 'drive'>('local');
  const [newBackupCloudFolderId, setNewBackupCloudFolderId] = useState("");
  const [newBackupRetention, setNewBackupRetention] = useState(0);
  const [newBackupSendTelegram, setNewBackupSendTelegram] = useState(false);

  const [showScheduleDeleteConfirm, setShowScheduleDeleteConfirm] = useState(false);
  const [schedToDelete, setSchedToDelete] = useState<string | null>(null);
  const [showDriveDisconnectConfirm, setShowDriveDisconnectConfirm] = useState(false);

  // New Schedule Form
  const [newSchedName, setNewSchedName] = useState("");
  const [newSchedType, setNewSchedType] = useState<number>(1);
  const [newSchedTarget, setNewSchedTarget] = useState("");
  const [newSchedDbName, setNewSchedDbName] = useState("");
  const [newSchedDbUser, setNewSchedDbUser] = useState("root");
  const [newSchedDbPass, setNewSchedDbPass] = useState("");
  const [newSchedInterval, setNewSchedInterval] = useState(1440); // 24h
  const [newSchedStorage, setNewSchedStorage] = useState<'local' | 'both' | 'drive'>('local');
  const [newSchedCloudFolderId, setNewSchedCloudFolderId] = useState("");
  const [newSchedRetention, setNewSchedRetention] = useState(0); // 0: keep all
  const [newSchedSendTelegram, setNewSchedSendTelegram] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  
  // Advanced Scheduling State
  const [schedStrategy, setSchedStrategy] = useState<'interval' | 'calendar'>('interval');
  const [calendarFreq, setCalendarFreq] = useState<'daily'|'weekly'>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // 1-7 (Mon-Sun)
  const [scheduledTime, setScheduledTime] = useState("03:00");

  // Tabs & Pagination State
  const [activeTab, setActiveTab] = useState<'history' | 'schedules'>('history');
  const [historyPage, setHistoryPage] = useState(1);
  const [schedulesPage, setSchedulesPage] = useState(1);
  const itemsPerPage = 8;

  const parseFolderId = (value: string) => {
    // Check for Google Drive URL pattern
    const match = value.match(/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : value.trim();
  };

  useEffect(() => {
    fetchData();
    
    const handleProgress = (id: string, p: number, m: string) => {
      setProgress(prev => ({
        ...prev,
        [id]: { backupId: id, percentage: p, message: m }
      }));
      if (p === 100) {
        setTimeout(fetchData, 1000);
        // Clear progress after 5 seconds
        setTimeout(() => {
          setProgress(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 5000);
      }
    };

    backupSignalRService.connect(handleProgress);
    return () => backupSignalRService.disconnect(handleProgress);
  }, []);

  const handleLoadDatabases = async (targetId: string, user: string, pass: string) => {
    if (!targetId || targetId === "") return;
    setLoadingDatabases(true);
    try {
      const dbs = await backupService.getContainerDatabases(targetId, user, pass);
      setAvailableDatabases(dbs);
    } catch {
      setAvailableDatabases([]);
    } finally {
      setLoadingDatabases(false);
    }
  };

  const fetchData = async () => {
    try {
      const [backupsData, schedulesData, volumesData, containersData, driveStatus] = await Promise.all([
        backupService.getBackups(),
        backupService.getSchedules(),
        backupService.getAvailableVolumes(),
        backupService.getAvailableContainers(),
        backupService.getDriveStatus().catch(() => ({ isAuthenticated: false }))
      ]);
      setBackups(backupsData);
      setSchedules(schedulesData);
      setAvailableVolumes(volumesData);
      setAvailableContainers(containersData);
      setDriveConnected(driveStatus.isAuthenticated);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectDrive = async () => {
    try {
      setConnectingDrive(true);
      const { url } = await backupService.getDriveAuthUrl();
      window.open(url, '_blank', 'width=600,height=700');
      // Poll for connection after user authorizes
      const poll = setInterval(async () => {
        const status = await backupService.getDriveStatus().catch(() => ({ isAuthenticated: false }));
        if (status.isAuthenticated) {
          setDriveConnected(true);
          setConnectingDrive(false);
          clearInterval(poll);
          showToast('Google Drive connected successfully!', 'success');
        }
      }, 3000);
      // Stop polling after 3 minutes
      setTimeout(() => { clearInterval(poll); setConnectingDrive(false); }, 180000);
    } catch (error: any) {
      showToast(error.response?.data || 'Failed to get authorization URL', 'error');
      setConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    try {
      await backupService.revokeDriveAuth();
      setShowDriveDisconnectConfirm(false);
      setDriveConnected(false);
      showToast("Cloud connection severed", "success");
    } catch (error) {
      console.error('Failed to disconnect Drive:', error);
      showToast('Failed to disconnect Drive.', 'error');
    }
  };

  const confirmDisconnectDrive = () => {
    setShowDriveDisconnectConfirm(true);
  };

  const handleRunBackup = async () => {
    try {
      showToast("Initializing PolancoVault...", "loading");
      const syncToCloud = newBackupStorage !== 'local';
      const keepLocal = newBackupStorage !== 'drive';
      const cloudFolderId = syncToCloud ? newBackupCloudFolderId : undefined;

      if (newBackupType !== 1 && !newBackupTarget) {
        showToast("Please select a target volume", "error");
        return;
      }

      setIsBackupModalOpen(false);

      const runAsync = async () => {
        try {
          if (newBackupType === 1) {
            const finalTarget = newBackupTarget ? `${newBackupTarget}::${newBackupDbName || ""}::${newBackupDbUser}::${newBackupDbPass}` : undefined;
            await backupService.triggerDatabaseBackup('Zip', finalTarget, syncToCloud, cloudFolderId || undefined, newBackupName || undefined, keepLocal, newBackupRetention, newBackupSendTelegram);
          } else {
            await backupService.triggerVolumeBackup(newBackupTarget, 'Zip', syncToCloud, cloudFolderId || undefined, newBackupName || undefined, keepLocal, newBackupRetention, newBackupSendTelegram);
          }
          setNewBackupName("");
          showToast("Backup initiated successfully", "success");
          fetchData();
        } catch (error: any) {
          showToast(error.response?.data || 'Backup failed to start', "error");
        }
      };
      
      runAsync();
    } catch (error: any) {
      showToast(error.response?.data || 'Backup failed to start', "error");
    }
  };

  const handleCreateSchedule = async () => {
    try {
      if (!newSchedName) {
        showToast("Enter a policy identifier", "error");
        return;
      }
      
      const syncToCloud = newSchedStorage !== 'local';
      const keepLocal = newSchedStorage !== 'drive';
      
      let cronExpression: string | undefined = undefined;
      if (schedStrategy === 'calendar') {
        const [hours, minutes] = scheduledTime.split(':');
        const days = calendarFreq === 'daily' ? '*' : selectedDays.join(',');
        cronExpression = `${minutes} ${hours} * * ${days || '*'}`;
      }

      const scheduleData: Partial<BackupSchedule> = {
        name: newSchedName,
        type: newSchedType,
        target: newSchedType === 1 && newSchedTarget ? `${newSchedTarget}::${newSchedDbName || ""}::${newSchedDbUser}::${newSchedDbPass}` : (newSchedTarget || undefined),
        intervalMinutes: schedStrategy === 'interval' ? newSchedInterval : 0,
        format: 0,
        isActive: true,
        useCron: schedStrategy === 'calendar',
        cronExpression,
        syncToCloud,
        keepLocal,
        cloudFolderId: syncToCloud ? newSchedCloudFolderId : undefined,
        retentionCount: syncToCloud ? newSchedRetention : 0,
        sendTelegram: newSchedSendTelegram
      };

      if (isEditingSchedule && editingScheduleId) {
        await backupService.updateSchedule(editingScheduleId, { ...scheduleData, id: editingScheduleId });
        showToast("Automation protocol updated", "success");
      } else {
        await backupService.createSchedule(scheduleData);
        showToast("Automation protocol established", "success");
      }

      setIsScheduleModalOpen(false);
      fetchData();
    } catch (error) {
      showToast("Protocol failure", "error");
    }
  };

  const handleEditSchedule = (s: BackupSchedule) => {
    setNewSchedName(s.name);
    setNewSchedType(s.type);
    const targetParts = (s.target || "").split("::");
    setNewSchedTarget(targetParts[0]);
    setNewSchedDbName(targetParts.length > 1 ? targetParts[1] : "");
    setNewSchedDbUser(targetParts.length > 2 ? targetParts[2] : "root");
    setNewSchedDbPass(targetParts.length > 3 ? targetParts[3] : "");
    setNewSchedInterval(s.intervalMinutes);
    setNewSchedStorage(!s.syncToCloud ? 'local' : s.keepLocal ? 'both' : 'drive');
    setNewSchedCloudFolderId(s.cloudFolderId || "");
    setNewSchedRetention(s.retentionCount || 0);
    setNewSchedSendTelegram(s.sendTelegram || false);
    
    // Recovery of scheduling state
    if (s.useCron && s.cronExpression) {
       setSchedStrategy('calendar');
       const parts = s.cronExpression.split(' ');
       // Format: "m h * * d"
       setScheduledTime(`${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`);
       if (parts[4] === '*') {
          setCalendarFreq('daily');
          setSelectedDays([]);
       } else {
          setCalendarFreq('weekly');
          setSelectedDays(parts[4].split(',').map(Number));
       }
    } else {
       setSchedStrategy('interval');
    }

    setIsEditingSchedule(true);
    setEditingScheduleId(s.id);
    setIsScheduleModalOpen(true);
  };

  const handleToggleScheduleAsync = async (s: BackupSchedule) => {
    try {
      const updated = { ...s, isActive: !s.isActive };
      await backupService.updateSchedule(s.id, updated);
      showToast(updated.isActive ? "Protocol activated" : "Protocol deactivated", "success");
      fetchData();
    } catch (err) {
      showToast("Toggle failed", "error");
    }
  };

  const handleToggleTelegramAsync = async (s: BackupSchedule) => {
    try {
      showToast(s.sendTelegram ? "Desactivando alertas..." : "Activando alertas...", "loading");
      const updated = { ...s, sendTelegram: !s.sendTelegram };
      await backupService.updateSchedule(s.id, updated);
      showToast(`Alertas de Telegram ${updated.sendTelegram ? 'activadas' : 'desactivadas'} para ${s.name}`, "success");
      fetchData();
    } catch (err) {
      showToast("Error toggling telegram", "error");
    }
  };

  const handleDeleteSchedule = async () => {
    if (!schedToDelete) return;
    try {
      await backupService.deleteSchedule(schedToDelete);
      setShowScheduleDeleteConfirm(false);
      setSchedToDelete(null);
      showToast("Automation protocol terminated", "success");
      fetchData();
    } catch (err) {
      showToast("Deletion failed", "error");
    }
  };

  const confirmDeleteSchedule = (id: string) => {
    setSchedToDelete(id);
    setShowScheduleDeleteConfirm(true);
  };

  const handleRunSchedule = async (id: string, name: string) => {
    try {
      setRunningProtocols(prev => ({ ...prev, [id]: true }));
      showToast("Initiating protocol execution...", "loading");
      
      // Inject fake progress to immediately show the background task in "Active Pipelines"
      setProgress(prev => ({
        ...prev,
        [`schedule_trigger_${id}`]: { backupId: `schedule_trigger_${id}`, percentage: 0, message: `Starting protocol: ${name}...` }
      }));

      await backupService.executeSchedule(id);
      showToast(`Protocol ${name} manually initiated`, "success");
      
      // Update the fake progress to done, it will be cleared after 5s by existing logic (or we can just remove it)
      setProgress(prev => ({
        ...prev,
        [`schedule_trigger_${id}`]: { backupId: `schedule_trigger_${id}`, percentage: 100, message: `Protocol ${name} relay sent` }
      }));
      setTimeout(() => {
        setProgress(prev => {
          const next = { ...prev };
          delete next[`schedule_trigger_${id}`];
          return next;
        });
        fetchData();
      }, 3000);
    } catch (err) {
      showToast("Manual execution failed", "error");
      setProgress(prev => {
        const next = { ...prev };
        delete next[`schedule_trigger_${id}`];
        return next;
      });
    } finally {
      setRunningProtocols(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = (id: string) => {
    setBackupToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!backupToDelete) return;
    try {
      showToast("Deleting backup...", "loading");
      await backupService.deleteBackup(backupToDelete);
      showToast("Backup deleted", "success");
      setIsDeleteModalOpen(false);
      setBackupToDelete(null);
      fetchData();
    } catch (error) {
      showToast("Failed to delete backup", "error");
    }
  };

  const handleDownload = async (id: string, name: string, path: string) => {
    try {
      showToast("Preparing download...", "loading");
      const fileName = path.split('\\').pop()?.split('/').pop() || `${name}.zip`;
      await backupService.downloadBackup(id, fileName);
      showToast("Download started", "success");
    } catch (error) {
      showToast("Download failed", "error");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: number) => {
    switch (status) {
      case 1: return <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />;
      case 2: return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 3: return <XCircle className="w-4 h-4 text-rose-400" />;
      default: return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto space-y-12 h-screen mb-20">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-brand-primary">
          <div className="p-3 bg-brand-primary/10 rounded-2xl border border-brand-primary/20">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white uppercase italic leading-none">Polanco<span className="text-brand-primary">Vault</span></h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px] mt-2">Enterprise Backup & Recovery System</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsScheduleModalOpen(true)}
            className="bg-white/5 border border-white/10 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Calendar size={14} />
            Schedules
          </button>
          <button 
            onClick={() => setIsBackupModalOpen(true)}
            className="bg-brand-primary text-obsidian-950 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-2xl shadow-brand-primary/20 flex items-center gap-2"
          >
            <Plus size={14} />
            Immediate Backup
          </button>
        </div>
      </section>

      {/* Stats / Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Backups', val: backups.length, icon: <FileArchive className="text-brand-primary" /> },
          { label: 'Cloud Synced', val: backups.filter(b => b.cloudSyncStatus === 1).length, icon: <Cloud className="text-brand-secondary" /> },
          { label: 'Active Schedules', val: schedules.filter(s => s.isActive).length, icon: <Clock className="text-emerald-400" /> },
          { label: 'Failed Ops', val: backups.filter(b => b.status === 3).length, icon: <AlertCircle className="text-rose-400" /> },
        ].map(stat => (
          <div key={stat.label} className="bg-white/5 border border-white/5 rounded-3xl p-5 flex items-center gap-4">
            <div className="p-3 bg-white/5 rounded-xl">{stat.icon}</div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{stat.label}</p>
              <p className="text-xl font-black text-white">{stat.val}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Google Drive Connection Panel */}
      <section className="animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Cloud Relay Status</h2>
        </div>
        <div className={`p-6 rounded-3xl border flex items-center justify-between gap-4 ${
          driveConnected 
            ? 'bg-emerald-500/5 border-emerald-500/20' 
            : 'bg-white/5 border-white/5'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${
              driveConnected ? 'bg-emerald-500/10' : 'bg-white/5'
            }`}>
              <Cloud size={22} className={driveConnected ? 'text-emerald-400' : 'text-slate-500'} />
            </div>
            <div>
              <p className="text-xs font-black text-white uppercase tracking-widest">Google Drive</p>
              <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${
                driveConnected === null ? 'text-slate-600' : driveConnected ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {driveConnected === null ? 'Checking...' : driveConnected ? '● Connected — Backups will sync to Drive' : '○ Not Connected — Click to authorize'}
              </p>
            </div>
          </div>
          {!driveConnected && (
            <button
              onClick={handleConnectDrive}
              disabled={connectingDrive}
              className="bg-brand-primary text-obsidian-950 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20 flex items-center gap-2 disabled:opacity-50"
            >
              {connectingDrive ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
              {connectingDrive ? 'Waiting...' : 'Connect Drive'}
            </button>
          )}
          {driveConnected && (
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black uppercase text-emerald-400/60 tracking-widest hidden sm:inline">✓ Authorized</span>
              <button
                onClick={confirmDisconnectDrive}
                className="bg-rose-500/10 text-rose-400 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest border border-rose-500/20 hover:bg-rose-500/20 transition-all"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </section>


      {/* Active Progress */}
      {Object.keys(progress).length > 0 && (
        <section className="animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse shadow-[0_0_10px_#a78bfa]"></div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Active Pipelines</h2>
          </div>
          <div className="grid gap-3">
            {Object.entries(progress).map(([id, p]) => (
              <div key={id} className="bg-brand-primary/5 border border-brand-primary/10 p-5 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
                  <div 
                    className={`h-full transition-all duration-1000 shadow-[0_0_15px_#a78bfa] ${p.message.toLowerCase().includes('failed') || p.message.toLowerCase().includes('error') ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-brand-primary'}`} 
                    style={{ width: `${p.percentage}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-3 text-brand-primary">
                    {p.percentage === 100 ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <Loader2 size={16} className="animate-spin" />
                    )}
                    <span className={`text-[10px] font-black uppercase tracking-widest ${p.percentage === 100 ? 'text-emerald-400' : p.message.toLowerCase().includes('failed') || p.message.toLowerCase().includes('error') ? 'text-rose-400' : ''}`}>
                      {p.message}
                    </span>
                  </div>
                  <span className="text-xs font-black text-white">{p.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History & Protocols Tabs */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex p-1.5 bg-obsidian-900 border border-white/10 rounded-3xl w-fit shadow-2xl">
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-3 px-6 py-3 rounded-[1.1rem] transition-all ${
                activeTab === 'history' 
                  ? 'bg-brand-primary text-obsidian-950 font-black shadow-xl shadow-brand-primary/20' 
                  : 'text-slate-500 font-bold hover:text-white'
              }`}
            >
              <LucideHistory size={16} />
              <span className="text-[10px] uppercase tracking-[0.2em]">Recent History</span>
            </button>
            <button 
              onClick={() => setActiveTab('schedules')}
              className={`flex items-center gap-3 px-6 py-3 rounded-[1.1rem] transition-all ${
                activeTab === 'schedules' 
                  ? 'bg-brand-primary text-obsidian-950 font-black shadow-xl shadow-brand-primary/20' 
                  : 'text-slate-500 font-bold hover:text-white'
              }`}
            >
              <Clock size={16} />
              <span className="text-[10px] uppercase tracking-[0.2em]">Automation Protocols</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
             <div className="h-px w-20 bg-linear-to-r from-transparent to-white/10 hidden md:block"></div>
             <Settings className="w-4 h-4 text-slate-700 cursor-pointer hover:text-slate-400 transition-colors" />
          </div>
        </div>

        <div className="bg-obsidian-900/50 border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl shadow-2xl min-h-[500px] flex flex-col">
          {activeTab === 'history' ? (
            <>
              <div className="overflow-x-auto custom-scrollbar flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/2">
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Resource</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Type</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Cloud</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Metric</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Timestamp</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Ops</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {backups
                      .slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage)
                      .map((backup) => (
                        <tr key={backup.id} className="hover:bg-white/2 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5">
                              {getStatusIcon(backup.status)}
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex flex-col text-left">
                              <span className="text-xs font-black text-white tracking-tight uppercase line-clamp-1">{backup.name}</span>
                              {backup.status === 1 && (
                                <span className="text-[9px] text-brand-primary/80 font-bold uppercase mt-1 flex items-center gap-1">
                                  <Loader2 size={10} className="animate-spin" /> {progress[backup.id]?.message || 'PROCESSING...'}
                                </span>
                              )}
                              {backup.status === 3 && backup.errorMessage && (
                                <span className="text-[9px] text-rose-400/80 font-bold uppercase mt-1 flex items-center gap-1">
                                  <AlertCircle size={10} /> {backup.errorMessage}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                              backup.type === 1 
                              ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20' 
                              : 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20'
                            }`}>
                              {backup.type === 1 ? 'DATABASE' : 'VOLUME'}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-center">
                            {backup.cloudSyncStatus === 1 ? (
                              <a href={backup.cloudLink} target="_blank" rel="noopener noreferrer" className="inline-flex p-2 bg-emerald-500/10 text-emerald-400 rounded-xl hover:scale-110 transition-transform">
                                <Cloud size={16} />
                              </a>
                            ) : backup.cloudSyncStatus === 2 ? (
                              <div className="flex flex-col items-center gap-1 group/error">
                                <div className="inline-flex p-2 bg-rose-500/10 text-rose-400 rounded-xl cursor-help">
                                  <XCircle size={16} />
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-800 font-black">⎯</span>
                            )}
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-black text-slate-300">{formatSize(backup.size)}</span>
                              <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{backup.format === 0 ? 'ZIP' : 'TAR.GZ'}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-[10px] text-slate-500 font-black uppercase">
                            {format(new Date(backup.createdAt), 'MMM dd | HH:mm:ss')}
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => handleDownload(backup.id, backup.name, backup.filePath)}
                                className="p-2.5 bg-white/5 text-slate-400 hover:text-white rounded-xl transition-colors"
                              >
                                <Download size={14} />
                              </button>
                              <button onClick={() => handleDelete(backup.id)} className="p-2.5 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {backups.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="px-8 py-32 text-center">
                          <div className="flex flex-col items-center gap-6 opacity-20">
                            <Database size={64} className="animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-[0.8em]">Vault is empty</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination 
                currentPage={historyPage} 
                totalItems={backups.length} 
                itemsPerPage={itemsPerPage} 
                onPageChange={setHistoryPage} 
              />
            </>
          ) : (
            <>
              <div className="overflow-x-auto custom-scrollbar flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/2">
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Protocol Alias</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Resource</th>
                       <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Storage</th>
                       <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Retention</th>
                       <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Frequency</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Next Run</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Ops</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {schedules
                      .slice((schedulesPage - 1) * itemsPerPage, schedulesPage * itemsPerPage)
                      .map((s) => (
                        <tr key={s.id} className="hover:bg-white/2 transition-colors group">
                          <td className="px-8 py-5">
                            <button 
                              onClick={() => handleToggleScheduleAsync(s)}
                              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${s.isActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'bg-white/10'}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${s.isActive ? 'translate-x-5' : 'translate-x-0 bg-slate-400'}`}
                              />
                            </button>
                          </td>
                          <td className="px-8 py-5">
                            <span className="text-xs font-black text-white uppercase tracking-tight">{s.name}</span>
                          </td>
                          <td className="px-8 py-5">
                            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                              s.type === 1 
                              ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20' 
                              : 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20'
                            }`}>
                              {s.type === 1 ? 'DATABASE' : 'VOLUME'}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center justify-center gap-2">
                               <div className={`p-1.5 rounded-lg ${!s.syncToCloud ? 'text-slate-500' : s.keepLocal ? 'text-emerald-400 bg-emerald-500/5' : 'text-brand-primary bg-brand-primary/5'}`}>
                                 {!s.syncToCloud ? <FolderSync size={14} /> : s.keepLocal ? <Cloud size={14} /> : <Download size={14} />}
                               </div>
                               <span className="text-[9px] font-black text-slate-500 uppercase">
                                 {!s.syncToCloud ? 'LCL' : s.keepLocal ? 'S+C' : 'CLD'}
                               </span>
                            </div>
                           </td>
                           <td className="px-8 py-5 text-center">
                              {s.syncToCloud && (s.retentionCount ?? 0) > 0 ? (
                                <span className="text-[10px] font-black bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-lg border border-brand-primary/20 uppercase tracking-tighter">
                                  LIM: {s.retentionCount}
                                </span>
                              ) : (
                                <span className="text-[10px] font-black text-slate-700 uppercase">∞</span>
                              )}
                           </td>
                          <td className="px-8 py-5">
                             <span className="text-[10px] font-black text-slate-300 uppercase">
                               {s.useCron ? (
                                 s.cronExpression?.split(' ')[4] === '*' ? 'Daily Routine' : 'Weekly Cycle'
                               ) : `Every ${s.intervalMinutes}m`}
                             </span>
                          </td>
                          <td className="px-8 py-5">
                             <span className="text-[10px] font-black text-slate-500 uppercase">
                               {s.nextRun ? format(new Date(s.nextRun), 'hh:mm aa | MMM dd') : '—'}
                             </span>
                          </td>
                          <td className="px-8 py-5 text-right">
                             <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                               <button 
                                 onClick={() => handleToggleTelegramAsync(s)}
                                 className={`p-2.5 rounded-xl transition-colors ${s.sendTelegram ? 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20' : 'bg-white/5 text-slate-500 hover:text-sky-400'}`}
                                 title={s.sendTelegram ? "Desactivar Telegram" : "Activar Telegram"}
                               >
                                 <MessageCircle size={14} />
                               </button>
                               <button 
                                 onClick={() => handleRunSchedule(s.id, s.name)}
                                 disabled={runningProtocols[s.id]}
                                 className="p-2.5 bg-white/5 text-slate-400 hover:text-emerald-400 rounded-xl transition-colors disabled:opacity-50"
                                 title="Execute Now"
                               >
                                 {runningProtocols[s.id] ? <Loader2 size={14} className="animate-spin text-brand-primary" /> : <Play size={14} />}
                               </button>
                               <button 
                                 onClick={() => handleEditSchedule(s)}
                                 className="p-2.5 bg-white/5 text-slate-400 hover:text-brand-primary rounded-xl transition-colors"
                                 title="Edit Protocol"
                               >
                                 <Settings size={14} />
                               </button>
                               <button 
                                 onClick={() => confirmDeleteSchedule(s.id)}
                                 className="p-2.5 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                                 title="Delete Protocol"
                                >
                                 <Trash2 size={14} />
                               </button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    {schedules.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-8 py-32 text-center">
                          <div className="flex flex-col items-center gap-6 opacity-20">
                            <Clock size={64} className="animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-[0.8em]">No Protocols defined</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination 
                currentPage={schedulesPage} 
                totalItems={schedules.length} 
                itemsPerPage={itemsPerPage} 
                onPageChange={setSchedulesPage} 
              />
            </>
          )}
        </div>
      </section>

      {/* Modals */}
      <VaultOverlay 
        isOpen={isBackupModalOpen} 
        onClose={() => setIsBackupModalOpen(false)} 
        title="PolancoVault Injection"
        footer={
          <>
             <button onClick={() => setIsBackupModalOpen(false)} className="px-6 py-2.5 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Discard</button>
             <button onClick={handleRunBackup} className="bg-brand-primary text-obsidian-950 px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-[0_0_20px_#a78bfa33]">Initiate Operation</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => setNewBackupType(1)}
            className={`p-4 rounded-3xl border transition-all text-center space-y-2 ${newBackupType === 1 ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-[0_0_20px_#a78bfa22]' : 'bg-white/5 border-white/5 text-slate-500'}`}
          >
            <Database className="w-5 h-5 mx-auto" />
            <p className="text-[10px] font-black uppercase tracking-widest">Database Snapshot</p>
          </button>
          <button 
            onClick={() => setNewBackupType(0)}
            className={`p-4 rounded-3xl border transition-all text-center space-y-2 ${newBackupType === 0 ? 'bg-brand-secondary/10 border-brand-secondary text-brand-secondary shadow-[0_0_20px_#22d3ee22]' : 'bg-white/5 border-white/5 text-slate-500'}`}
          >
            <FolderSync className="w-5 h-5 mx-auto" />
            <p className="text-[10px] font-black uppercase tracking-widest">Docker Volumes</p>
          </button>
        </div>

        {newBackupType === 0 ? (
          <div className="space-y-3 px-1">
            <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Volume Resource</label>
            <Combobox 
              options={availableVolumes} 
              value={newBackupTarget} 
              onChange={setNewBackupTarget} 
              placeholder="Select volume asset..."
            />
          </div>
        ) : (
          <div className="space-y-3 px-1">
            <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Database Resource</label>
            <Combobox 
              options={[
                { name: 'Internal SQLite Database', path: '' },
                ...availableContainers.map(c => ({ name: c.name, path: c.id }))
              ]} 
              value={newBackupTarget} 
              onChange={setNewBackupTarget} 
              placeholder="Select database source..."
            />
            {newBackupTarget !== "" && (
              <div className="mt-4 space-y-4 animate-fade-in">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">DB User</label>
                    <input type="text" placeholder="root" className="w-full bg-black/40 border border-brand-primary/10 rounded-xl px-4 py-2.5 text-[10px] text-white outline-none focus:border-brand-primary/50" value={newBackupDbUser} onChange={(e) => setNewBackupDbUser(e.target.value)} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Password</label>
                    <input type="password" placeholder="Leave blank to use Docker env..." className="w-full bg-black/40 border border-brand-primary/10 rounded-xl px-4 py-2.5 text-[10px] text-white outline-none focus:border-brand-primary/50" value={newBackupDbPass} onChange={(e) => setNewBackupDbPass(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Database Name (Optional)</label>
                    <button onClick={() => handleLoadDatabases(newBackupTarget, newBackupDbUser, newBackupDbPass)} className="text-[8px] text-brand-primary hover:text-brand-secondary font-bold uppercase transition-colors" disabled={loadingDatabases}>
                      {loadingDatabases ? 'Loading...' : 'Load Databases'}
                    </button>
                  </div>
                  <Combobox 
                    options={[
                      { name: '-- All Databases --', path: '' },
                      ...availableDatabases.map(db => ({ name: db, path: db }))
                    ]}
                    value={newBackupDbName}
                    onChange={setNewBackupDbName}
                    placeholder={loadingDatabases ? "Loading databases..." : "Select a database..."}
                    allowCustom={true}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 px-1">
          <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Destination Identity (Optional)</label>
          <input 
            type="text" 
            placeholder="System will generate alias..." 
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs text-white outline-none focus:border-brand-primary/50"
            value={newBackupName}
            onChange={(e) => setNewBackupName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
          />
        </div>

        <div className="p-5 bg-white/5 rounded-4xl border border-white/5 space-y-4">
          <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Storage Destination</p>
          <div className="grid grid-cols-3 gap-2">
            {(['local', 'both', 'drive'] as const).map((opt) => {
              const labels: Record<string, { icon: string, title: string, sub: string }> = {
                local:  { icon: '🖥', title: 'Local Only',  sub: 'Server storage' },
                both:   { icon: '⇅',  title: 'Server + Drive', sub: 'Keep both copies' },
                drive:  { icon: '☁',  title: 'Drive Only',  sub: 'Delete after upload' },
              };
              const l = labels[opt];
              const active = newBackupStorage === opt;
              return (
                <button
                  key={opt}
                  onClick={() => setNewBackupStorage(opt)}
                  className={`p-4 rounded-2xl border text-center transition-all space-y-1 ${
                    active
                      ? opt === 'local' ? 'bg-slate-700/40 border-slate-500 text-white'
                        : opt === 'both' ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                        : 'bg-brand-secondary/10 border-brand-secondary text-brand-secondary'
                      : 'bg-white/3 border-white/5 text-slate-600 hover:border-white/10'
                  }`}
                >
                  <p className="text-base">{l.icon}</p>
                  <p className="text-[9px] font-black uppercase tracking-wider leading-tight">{l.title}</p>
                  <p className="text-[8px] text-slate-600 uppercase font-bold">{l.sub}</p>
                </button>
              );
            })}
          </div>
          {newBackupStorage !== 'local' && (
            <div className="space-y-2 animate-fade-in">
              <input
                type="text"
                placeholder="Target Folder ID (uses default if empty)"
                className="w-full bg-black/40 border border-brand-secondary/20 rounded-2xl px-5 py-3 text-xs text-brand-secondary placeholder:text-slate-700 outline-none focus:border-brand-secondary/50"
                value={newBackupCloudFolderId}
                onChange={(e) => setNewBackupCloudFolderId(parseFolderId(e.target.value))}
              />
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 space-y-2">
                  <label className="text-[8px] font-black uppercase text-brand-secondary/60 tracking-widest ml-1">Retention Limit</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full bg-black/40 border border-brand-secondary/10 rounded-lg px-3 py-2 text-[10px] text-brand-secondary outline-none focus:border-brand-secondary/50"
                    value={newBackupRetention}
                    onChange={(e) => setNewBackupRetention(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="flex-[2] pt-4">
                  <p className="text-[8px] text-slate-500 font-bold uppercase leading-tight italic">
                    {newBackupRetention === 0 ? "Infinite" : `Latest ${newBackupRetention}`} in cloud
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/5 mt-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl transition-colors ${newBackupSendTelegram ? 'bg-sky-500/20 text-sky-400' : 'bg-white/5 text-slate-500'}`}>
               <MessageCircle size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black text-white tracking-widest uppercase">Telegram Alert</p>
              <p className="text-[8px] text-slate-500 font-bold uppercase mt-1">Notify completion status</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setNewBackupSendTelegram(!newBackupSendTelegram)}
            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${newBackupSendTelegram ? 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.3)]' : 'bg-white/10'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${newBackupSendTelegram ? 'translate-x-5' : 'translate-x-0 bg-slate-400'}`} />
          </button>
        </div>
      </VaultOverlay>

      <VaultOverlay
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setIsEditingSchedule(false);
          setEditingScheduleId(null);
          setNewSchedName("");
          setNewSchedTarget("");
          setNewSchedInterval(1440);
          setNewSchedStorage('local');
          setNewSchedCloudFolderId("");
          setNewSchedRetention(0);
          setNewSchedSendTelegram(false);
          setSchedStrategy('interval');
          setCalendarFreq('daily');
          setSelectedDays([]);
          setScheduledTime("03:00");
        }}
        title={isEditingSchedule ? "Modify Automation Protocol" : "New Automation Protocol"}
        footer={
          <button 
            onClick={handleCreateSchedule}
            className="w-full bg-brand-primary text-obsidian-950 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-brand-primary/20 hover:scale-[1.02] transition-all"
          >
            {isEditingSchedule ? "Apply Changes" : "Confirm Protocol"}
          </button>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Protocol Alias</label>
                <input 
                  type="text" 
                  placeholder="Name" 
                  className={`w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white outline-none focus:border-brand-primary/50 ${isEditingSchedule ? 'opacity-50 cursor-not-allowed' : ''}`}
                  value={newSchedName}
                  onChange={(e) => !isEditingSchedule && setNewSchedName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  disabled={isEditingSchedule}
                />
            </div>
            <div className="space-y-2">
              <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Asset Class</label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-black/20 rounded-2xl border border-white/5">
                {[
                  { id: 1, label: 'DB' },
                  { id: 0, label: 'VOL' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNewSchedType(t.id)}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                      newSchedType === t.id ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Scheduling Strategy</label>
            <div className="flex gap-2 p-1 bg-black/20 rounded-2xl border border-white/5">
              {(['interval', 'calendar'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSchedStrategy(s)}
                  className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    schedStrategy === s ? 'bg-brand-primary text-obsidian-950 shadow-lg' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {s === 'interval' ? 'Simple Interval' : 'Scheduled Calendar'}
                </button>
              ))}
            </div>

            {schedStrategy === 'interval' ? (
              <div className="space-y-3 animate-fade-in">
                <label className="text-[8px] font-black uppercase text-slate-600 tracking-widest ml-1">Repeat Every (Minutes)</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="number" 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-xs text-white outline-none focus:border-brand-primary/50"
                    value={newSchedInterval}
                    onChange={(e) => setNewSchedInterval(Number(e.target.value))}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-600 tracking-widest ml-1">Frequency</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white outline-none appearance-none"
                      value={calendarFreq}
                      onChange={(e) => setCalendarFreq(e.target.value as any)}
                    >
                      <option value="daily" className="bg-obsidian-900">Daily Execution</option>
                      <option value="weekly" className="bg-obsidian-900">Weekly Cycle</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-600 tracking-widest ml-1">Execution Time (24h)</label>
                    <input 
                      type="time" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-brand-primary/50"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>

                {calendarFreq === 'weekly' && (
                  <div className="space-y-3">
                    <label className="text-[8px] font-black uppercase text-slate-600 tracking-widest ml-1">Selection Days</label>
                    <div className="flex flex-wrap gap-2">
                      {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, idx) => {
                        const active = selectedDays.includes(idx);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (active) setSelectedDays(selectedDays.filter(d => d !== idx));
                              else setSelectedDays([...selectedDays, idx]);
                            }}
                            className={`px-3 py-2 rounded-xl text-[9px] font-black border transition-all ${
                              active ? 'bg-brand-primary/20 border-brand-primary text-brand-primary' : 'bg-white/5 border-white/5 text-slate-600'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {newSchedType === 0 ? (
            <div className="space-y-3 px-1">
              <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Target Volume</label>
              <Combobox 
                options={availableVolumes} 
                value={newSchedTarget} 
                onChange={setNewSchedTarget} 
              />
            </div>
          ) : (
            <div className="space-y-3 px-1">
              <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Database Resource</label>
              <Combobox 
                options={[
                  { name: 'Internal SQLite Database', path: '' },
                  ...availableContainers.map(c => ({ name: c.name, path: c.id }))
                ]} 
                value={newSchedTarget} 
                onChange={setNewSchedTarget} 
                placeholder="Select database source..."
              />
              {newSchedTarget !== "" && (
                <div className="mt-4 space-y-4 animate-fade-in">
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-2">
                      <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">DB User</label>
                      <input type="text" placeholder="root" className="w-full bg-black/40 border border-brand-primary/10 rounded-xl px-4 py-2.5 text-[10px] text-white outline-none focus:border-brand-primary/50" value={newSchedDbUser} onChange={(e) => setNewSchedDbUser(e.target.value)} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Password</label>
                      <input type="password" placeholder="Leave blank to use Docker env..." className="w-full bg-black/40 border border-brand-primary/10 rounded-xl px-4 py-2.5 text-[10px] text-white outline-none focus:border-brand-primary/50" value={newSchedDbPass} onChange={(e) => setNewSchedDbPass(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Database Name (Optional)</label>
                      <button onClick={() => handleLoadDatabases(newSchedTarget, newSchedDbUser, newSchedDbPass)} className="text-[8px] text-brand-primary hover:text-brand-secondary font-bold uppercase transition-colors" disabled={loadingDatabases}>
                        {loadingDatabases ? 'Loading...' : 'Load Databases'}
                      </button>
                    </div>
                    <Combobox 
                      options={[
                        { name: '-- All Databases --', path: '' },
                        ...availableDatabases.map(db => ({ name: db, path: db }))
                      ]}
                      value={newSchedDbName}
                      onChange={setNewSchedDbName}
                      placeholder={loadingDatabases ? "Loading databases..." : "Select a database..."}
                      allowCustom={true}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Vault Destination</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'local', label: 'Local', desc: 'Secure', icon: FolderSync },
                { id: 'both', label: 'Both', desc: 'Dual', icon: Cloud },
                { id: 'drive', label: 'Drive', desc: 'Cloud', icon: Download }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setNewSchedStorage(opt.id as any)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    newSchedStorage === opt.id 
                      ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-lg' 
                      : 'bg-white/5 border-white/5 hover:border-white/10 text-slate-500'
                  }`}
                >
                  <opt.icon size={14} className="mx-auto" />
                  <p className="text-[9px] font-black uppercase mt-2 tracking-widest">{opt.label}</p>
                </button>
              ))}
            </div>
          </div>

          {newSchedStorage !== 'local' && (
            <div className="p-5 bg-brand-primary/5 rounded-2xl border border-brand-primary/10 space-y-3 animate-fade-in -mt-4">
               <div className="flex items-center gap-2">
                 <Cloud size={14} className="text-brand-primary" />
                 <span className="text-[9px] font-black uppercase text-brand-primary tracking-widest">Cloud Relay Identity</span>
               </div>
               <input 
                type="text" 
                placeholder="Google Drive Parent ID" 
                className="w-full bg-black/40 border border-brand-primary/10 rounded-xl px-4 py-2.5 text-[10px] text-brand-primary placeholder:text-slate-700 outline-none focus:border-brand-primary/50"
                value={newSchedCloudFolderId}
                onChange={(e) => setNewSchedCloudFolderId(parseFolderId(e.target.value))}
              />
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 space-y-2">
                  <label className="text-[8px] font-black uppercase text-brand-primary/60 tracking-widest ml-1">Retention Limit</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full bg-black/40 border border-brand-primary/10 rounded-lg px-3 py-2 text-[10px] text-brand-primary outline-none focus:border-brand-primary/50"
                    value={newSchedRetention}
                    onChange={(e) => setNewSchedRetention(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="flex-[2] pt-4">
                  <p className="text-[8px] text-slate-500 font-bold uppercase leading-tight italic">
                    {newSchedRetention === 0 ? "Infinite backups" : `Keep latest ${newSchedRetention} files`} in cloud
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/5 mt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl transition-colors ${newSchedSendTelegram ? 'bg-sky-500/20 text-sky-400' : 'bg-white/5 text-slate-500'}`}>
                 <MessageCircle size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black text-white tracking-widest uppercase">Telegram Alert</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase mt-1">Notify completion status</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setNewSchedSendTelegram(!newSchedSendTelegram)}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${newSchedSendTelegram ? 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.3)]' : 'bg-white/10'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${newSchedSendTelegram ? 'translate-x-5' : 'translate-x-0 bg-slate-400'}`} />
            </button>
          </div>
        </div>
      </VaultOverlay>

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showScheduleDeleteConfirm}
        onClose={() => setShowScheduleDeleteConfirm(false)}
        title="Terminal Purge"
        type="danger"
        footer={
          <>
            <button onClick={() => setShowScheduleDeleteConfirm(false)} className="px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-white transition-all">Abort</button>
            <button onClick={handleDeleteSchedule} className="bg-rose-500 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20">Purge Protocol</button>
          </>
        }
      >
        Are you sure you want to permanently decommission this automated backup protocol? Active timers will be halted and recurring task entries will be purged from the system registry.
      </Modal>

      {/* Drive Disconnect Modal */}
      <Modal
        isOpen={showDriveDisconnectConfirm}
        onClose={() => setShowDriveDisconnectConfirm(false)}
        title="Cloud Severance"
        type="warning"
        footer={
          <>
            <button onClick={() => setShowDriveDisconnectConfirm(false)} className="px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-white transition-all">Cancel</button>
            <button onClick={handleDisconnectDrive} className="bg-rose-500 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20">Disconnect Cloud</button>
          </>
        }
      >
        Disconnecting Google Drive will immediately halt all automated cloud synchronization pipelines. You will need to re-verify authentication credentials to restore cloud relay capabilities.
      </Modal>

      <VaultOverlay
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Sanitize Protocol"
        footer={
          <>
             <button onClick={() => setIsDeleteModalOpen(false)} className="px-6 py-2.5 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Abort</button>
             <button onClick={confirmDelete} className="bg-rose-500 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-400 transition-all shadow-[0_0_20px_rgba(244,63,94,0.3)] border border-rose-400/50">Confirm Deletion</button>
          </>
        }
      >
        <div className="py-8 space-y-6 text-center">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/20 animate-pulse">
            <Trash2 className="w-8 h-8 text-rose-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Permanent Purge</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-relaxed">
              Are you sure you want to sanitize this resource?<br/>
              <span className="text-rose-400/80 italic">This action cannot be rolled back.</span>
            </p>
          </div>
        </div>
      </VaultOverlay>
    </div>
  );
};

export default Backups;
