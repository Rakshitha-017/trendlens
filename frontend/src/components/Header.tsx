import React from 'react';
import { Compass, Search, Bookmark, Sparkles, TrendingUp, Radio, Layers, Calculator, MessageSquare, BookOpen, Award } from 'lucide-react';
import { TrendCategory } from '../types';

export type ActiveTabType =
  | 'explore'
  | 'cluster-explorer'
  | 'prediction'
  | 'rag-query'
  | 'research'
  | 'evaluation'
  | 'watchlist'
  | 'analyzer'
  | 'analytics';

interface HeaderProps {
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: TrendCategory;
  setSelectedCategory: (cat: TrendCategory) => void;
  watchlistCount: number;
  onQuickAnalyze: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  watchlistCount,
  onQuickAnalyze
}) => {
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onQuickAnalyze(searchQuery.trim());
    }
  };

  return (
    <header id="main-header" className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col gap-3">
          
          {/* Top Row: Brand & Quick Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div 
              className="flex items-center gap-2.5 cursor-pointer group shrink-0"
              onClick={() => setActiveTab('explore')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Compass className="w-5 h-5 text-cyan-400 group-hover:rotate-45 transition-transform duration-300" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                    TrendLens
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/50 flex items-center gap-1">
                    <Radio className="w-2.5 h-2.5 animate-pulse text-cyan-400" /> CLIP + Gemini RAG
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">Multimodal Social Visual Trend Intelligence</p>
              </div>
            </div>

            {/* Quick Search Bar */}
            <form 
              onSubmit={handleSearchSubmit} 
              className="flex-1 max-w-md relative"
              id="form-quick-search"
            >
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="input-trend-search"
                  type="text"
                  placeholder="Search visual trends or scan topic (e.g. 'Ceramic Espresso', 'Y2K Film')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-all"
                />
                <button
                  type="submit"
                  id="btn-quick-ai-scan"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-[11px] font-medium rounded-lg flex items-center gap-1 shadow-sm transition-all"
                >
                  <Sparkles className="w-3 h-3" />
                  Scan AI
                </button>
              </div>
            </form>
          </div>

          {/* Bottom Row: Full Module Nav Tabs Bar */}
          <nav id="header-nav-tabs" className="flex items-center gap-1 overflow-x-auto pb-1 pt-1 scrollbar-none text-xs border-t border-slate-800/80">
            
            <button
              id="tab-explore-trends"
              onClick={() => setActiveTab('explore')}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'explore'
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/80 shadow-md shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              1. Trend Radar
            </button>

            <button
              id="tab-cluster-explorer"
              onClick={() => setActiveTab('cluster-explorer')}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'cluster-explorer'
                  ? 'bg-purple-950 text-purple-400 border border-purple-800/80 shadow-md shadow-purple-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              2. Cluster Explorer
            </button>

            <button
              id="tab-popularity-prediction"
              onClick={() => setActiveTab('prediction')}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'prediction'
                  ? 'bg-indigo-950 text-indigo-400 border border-indigo-800/80 shadow-md shadow-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              3. Prediction Model
            </button>

            <button
              id="tab-rag-query"
              onClick={() => setActiveTab('rag-query')}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'rag-query'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              4. RAG Query Chat
            </button>

            <button
              id="tab-research-gaps"
              onClick={() => setActiveTab('research')}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'research'
                  ? 'bg-amber-950 text-amber-400 border border-amber-800/80 shadow-md shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              5. Research Gaps & SDGs
            </button>

            <button
              id="tab-system-evaluation"
              onClick={() => setActiveTab('evaluation')}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'evaluation'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80 shadow-md shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              6. System Evaluation
            </button>

            <button
              id="tab-analytics"
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'analytics'
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Analytics
            </button>

            <button
              id="tab-watchlist"
              onClick={() => setActiveTab('watchlist')}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 relative ${
                activeTab === 'watchlist'
                  ? 'bg-slate-800 text-indigo-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Watchlist
              {watchlistCount > 0 && (
                <span className="ml-1 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {watchlistCount}
                </span>
              )}
            </button>

          </nav>

        </div>
      </div>
    </header>
  );
};
