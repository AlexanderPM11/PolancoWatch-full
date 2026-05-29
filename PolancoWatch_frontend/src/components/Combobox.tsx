import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export const Combobox = ({ 
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
    <div className={`relative ${isOpen ? 'z-[100]' : 'z-10'}`} ref={containerRef}>
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
        <div 
          className="absolute top-full left-0 right-0 mt-2 bg-obsidian-950 border border-white/10 rounded-2xl shadow-2xl z-[200] overflow-hidden"
          style={{ backgroundColor: '#0B0F19' }}
        >
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                autoFocus
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={allowCustom ? "Search or enter custom..." : "Search options..."}
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
                <p className="text-[9px] text-brand-primary/60 font-bold mt-1 truncate">Custom Value / Path</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
