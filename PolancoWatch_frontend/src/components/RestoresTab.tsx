import { useState, useEffect } from 'react';
import { 
  FolderSync, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Clock,
  Play
} from 'lucide-react';
import { restoreService, type Restore, backupService } from '../services/api';
import { backupSignalRService } from '../services/backupSignalR';
import Toast, { type ToastType } from './Toast';
import Modal from './Modal';
import { Combobox } from './Combobox';

export const RestoresTab = () => {
  const [restores, setRestores] = useState<Restore[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);

  const [availableContainers, setAvailableContainers] = useState<{ id: string, name: string, state: string, image: string }[]>([]);
  const [progress, setProgress] = useState<Record<string, { percentage: number, message: string }>>({});
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form State
  const [restoreName, setRestoreName] = useState('');
  const [restoreType, setRestoreType] = useState<number>(0);
  const [targetContainer, setTargetContainer] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  const fetchRestores = async () => {
    try {
      const data = await restoreService.getRestores();
      setRestores(data);
    } catch (error) {
      console.error('Failed to fetch restores', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const containers = await backupService.getAvailableContainers();
      setAvailableContainers(containers);
    } catch (error) {
      console.error('Failed to fetch config for restores', error);
    }
  };

  useEffect(() => {
    fetchRestores();
    fetchConfig();

    const handleProgress = (id: string, p: number, m: string) => {
      setProgress(prev => ({
        ...prev,
        [id]: { percentage: p, message: m }
      }));
      if (p === 100) {
        setTimeout(fetchRestores, 1000);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleExecuteRestore = async () => {
    if (!targetContainer) {
      showToast('Please select a target container', 'error');
      return;
    }
    if (!selectedFile) {
      showToast('Please select a file to restore', 'error');
      return;
    }

    try {
      showToast('Uploading file...', 'loading');
      setUploadProgress(10);
      
      const uploadRes = await restoreService.uploadFile(selectedFile);
      setUploadProgress(100);

      showToast('File uploaded. Initiating restore...', 'loading');
      
      await restoreService.executeRestore({
        name: restoreName,
        type: restoreType,
        targetContainer,
        filePath: uploadRes.filePath
      });

      showToast('Restore initiated successfully', 'success');
      setIsModalOpen(false);
      setRestoreName('');
      setSelectedFile(null);
      setUploadProgress(0);
      fetchRestores();
    } catch (error: any) {
      showToast(error.response?.data || 'Restore execution failed', 'error');
      setUploadProgress(0);
    }
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
    <div className="w-full flex flex-col h-full">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="px-8 py-4 border-b border-white/5 bg-white/2 flex justify-between items-center">
        <h3 className="text-sm font-black text-white uppercase tracking-widest">Restores History</h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-primary text-obsidian-950 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20 flex items-center gap-2"
        >
          <Play size={14} />
          New Restore
        </button>
      </div>

      <div className="overflow-x-auto custom-scrollbar flex-1 p-8">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>
        ) : restores.length === 0 ? (
          <div className="text-center py-20">
            <FolderSync className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No restores initiated yet.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/2">
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Name</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Target</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {restores.map((restore) => (
                <tr key={restore.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5">
                        {getStatusIcon(restore.status)}
                      </div>
                      {restore.status === 1 && progress[restore.id] && (
                        <div className="flex flex-col">
                          <span className="text-[9px] text-brand-primary font-bold uppercase">{progress[restore.id].message}</span>
                          <span className="text-[9px] text-white font-black">{progress[restore.id].percentage}%</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-xs font-black text-white uppercase tracking-wider">{restore.name}</td>
                  <td className="px-8 py-5 text-[10px] text-slate-400 uppercase tracking-widest">{restore.targetContainer}</td>
                  <td className="px-8 py-5 text-[10px] text-slate-500 font-bold">{new Date(restore.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Execute Restore"
        footer={
          <>
            <button 
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleExecuteRestore}
              disabled={uploadProgress > 0 && uploadProgress < 100}
              className="bg-brand-primary text-obsidian-950 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-secondary transition-all disabled:opacity-50"
            >
              Start Restore
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Restore Name</label>
            <input 
              type="text" 
              value={restoreName}
              onChange={(e) => setRestoreName(e.target.value)}
              placeholder="e.g. Rollback to v1.2"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Strategy Type</label>
            <Combobox
              options={[
                { name: 'Supabase Database', path: '0' },
                { name: 'Supabase Storage', path: '1' },
                { name: 'WordPress Database', path: '2' },
                { name: 'WordPress Storage', path: '3' },
              ]}
              value={restoreType.toString()}
              onChange={(val) => setRestoreType(Number(val))}
              placeholder="Select strategy type..."
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Target Container</label>
            <Combobox
              options={availableContainers.map(c => ({ name: c.name, path: c.name }))}
              value={targetContainer}
              onChange={(val) => setTargetContainer(val)}
              placeholder="Select target container..."
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Backup File (.tar.gz, .sql)</label>
            <label className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:border-brand-primary/50 border-dashed rounded-xl px-4 py-6 text-xs text-white cursor-pointer transition-all">
              <Upload size={18} className={selectedFile ? "text-emerald-400" : "text-brand-primary"} />
              <span className="font-bold uppercase tracking-widest">{selectedFile ? selectedFile.name : 'Choose File to Upload'}</span>
              <input type="file" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mt-4">
              <div className="bg-brand-primary h-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
