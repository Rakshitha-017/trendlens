import React, { useState } from 'react';
import { TrendItem } from '../types';
import { Bookmark, TrendingUp, Trash2, ArrowUpRight, Download, Bell, Check, Zap } from 'lucide-react';

interface WatchlistDrawerProps {
  watchlist: TrendItem[];
  onRemoveBookmark: (trend: TrendItem) => void;
  onSelectTrend: (trend: TrendItem) => void;
  onQuickAnalyze: (query: string) => void;
}

export const WatchlistDrawer: React.FC<WatchlistDrawerProps> = ({
  watchlist,
  onRemoveBookmark,
  onSelectTrend,
  onQuickAnalyze
}) => {
  const [velocityAlertThreshold, setVelocityAlertThreshold] = useState<number>(250);
  const [alertSaved, setAlertSaved] = useState(false);

  const handleExportCSV = () => {
    if (watchlist.length === 0) return;
    const headers = ['Title', 'Category', 'Growth Velocity', 'Lifecycle', 'Target Demographics'];
    const rows = watchlist.map((t) => [
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.category}"`,
      `"+${t.growthVelocity}%"`,
      `"${t.lifecycle}"`,
      `"${t.targetDemographics.replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trendlens-watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleSaveAlerts = () => {
    setAlertSaved(true);
    setTimeout(() => setAlertSaved(false), 2000);
  };

  return (
    <div id="section-watchlist" className="max-w-5xl mx-auto space-y-6">
      
      {/* Watchlist Header & Alert Rules */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/60 text-xs font-semibold mb-2">
              <Bookmark className="w-3.5 h-3.5" /> Bookmarked Radar Topics
            </div>
            <h2 className="text-2xl font-bold text-slate-100">Saved Trend Watchlist ({watchlist.length})</h2>
            <p className="text-xs text-slate-400 mt-1">Track high-growth micro-trends and set custom velocity threshold alerts</p>
          </div>

          <button
            id="btn-export-watchlist-csv"
            onClick={handleExportCSV}
            disabled={watchlist.length === 0}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-colors self-start sm:self-auto"
          >
            <Download className="w-4 h-4" /> Export CSV Brief
          </button>
        </div>

        {/* Velocity Threshold Setting */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-800/80 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Velocity Alert Trigger Rule</h4>
              <p className="text-[11px] text-slate-400">Highlight trends when growth velocity surges above this target threshold</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-cyan-400">{velocityAlertThreshold}%+</span>
            <input
              id="range-velocity-alert"
              type="range"
              min="100"
              max="500"
              step="25"
              value={velocityAlertThreshold}
              onChange={(e) => setVelocityAlertThreshold(Number(e.target.value))}
              className="w-36 accent-cyan-500 cursor-pointer"
            />
            <button
              onClick={handleSaveAlerts}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              {alertSaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : 'Set Rule'}
            </button>
          </div>
        </div>
      </div>

      {/* Watchlist Item List */}
      {watchlist.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            <Bookmark className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-200">Your Watchlist is Empty</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Browse trends in the Radar Explorer or run an AI scan to bookmark high-potential signals for tracking.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {watchlist.map((trend) => {
            const isAlertTriggered = trend.growthVelocity >= velocityAlertThreshold;

            return (
              <div
                key={trend.id}
                id={`watchlist-item-${trend.id}`}
                className={`bg-slate-900 border rounded-2xl p-5 space-y-4 transition-all ${
                  isAlertTriggered ? 'border-cyan-500/60 shadow-lg shadow-cyan-500/10' : 'border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                        {trend.category}
                      </span>
                      {isAlertTriggered && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800/80 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" /> High Velocity Signal
                        </span>
                      )}
                    </div>
                    <h3
                      onClick={() => onSelectTrend(trend)}
                      className="text-base font-bold text-slate-100 hover:text-cyan-400 cursor-pointer transition-colors"
                    >
                      {trend.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => onRemoveBookmark(trend)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    title="Remove from watchlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2">{trend.description}</p>

                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Velocity</span>
                    <div className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                      <TrendingUp className="w-3.5 h-3.5" /> +{trend.growthVelocity}%
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Lifecycle Stage</span>
                    <div className="text-slate-200 font-medium mt-0.5">{trend.lifecycle}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <button
                    onClick={() => onSelectTrend(trend)}
                    className="text-slate-300 hover:text-cyan-400 font-medium flex items-center gap-1"
                  >
                    View Signals
                  </button>

                  <button
                    onClick={() => onQuickAnalyze(trend.title)}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                  >
                    Rescan with AI <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
