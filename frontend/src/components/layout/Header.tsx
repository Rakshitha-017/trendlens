import React, { useState } from 'react';
import { Search, Bell, Sparkles, Radio, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  isCollapsed: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isCollapsed }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/query?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header
      className={`sticky top-0 z-30 h-16 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4 max-w-7xl mx-auto">
        
        {/* Quick Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search visual trends or prompt RAG (e.g. 'Y2K Cyberpunk', 'Raw Clay')..."
            className="w-full pl-10 pr-24 py-2 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-sm transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            AI Query
          </button>
        </form>

        {/* Live Status Indicators & Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 text-xs font-semibold">
            <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
            5,000 indexed images
          </div>

          <button
            onClick={() => navigate('/prediction')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all"
          >
            <Flame className="w-3.5 h-3.5 text-amber-300" />
            Observed Stats
          </button>

          <div className="w-8 h-8 rounded-xl bg-purple-950/80 border border-purple-800/80 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0">
            TL
          </div>
        </div>

      </div>
    </header>
  );
};
