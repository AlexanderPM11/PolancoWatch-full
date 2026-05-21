import { useRegisterSW } from 'virtual:pwa-register/react'
import { Download, X } from 'lucide-react'

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in animate-float-up">
      <div className="bg-obsidian-900 border border-brand-primary/30 p-5 rounded-2xl shadow-[0_0_40px_rgba(167,139,250,0.15)] flex flex-col gap-3 max-w-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="p-2 bg-brand-primary/10 rounded-xl text-brand-primary h-fit">
              <Download size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest">
                {offlineReady ? 'App Ready' : 'System Update Available'}
              </h3>
              <p className="text-xs font-medium text-slate-400 mt-1">
                {offlineReady 
                  ? 'PolancoWatch is ready to work offline.' 
                  : 'A new protocol has been deployed. Update to apply changes.'}
              </p>
            </div>
          </div>
          <button onClick={() => close()} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        
        {needRefresh && (
          <button 
            onClick={() => updateServiceWorker(true)}
            className="w-full bg-brand-primary text-obsidian-950 font-black text-[10px] uppercase tracking-widest py-3 rounded-xl hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20"
          >
            Apply Protocol Update
          </button>
        )}
      </div>
    </div>
  )
}

export default ReloadPrompt
