import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { BarChart3, Calendar, Filter, Sparkles, Layers, Flame, Radio } from 'lucide-react';
import { Badge } from '../components/ui/Badge';

export const AnalyticsPage: React.FC = () => {
  const [platformFilter, setPlatformFilter] = useState('All');
  const [timeframe, setTimeframe] = useState('30D');

  const platformComparisonData = [
    { name: 'Jan', TikTok: 120, Instagram: 90, Pinterest: 60, Reddit: 35 },
    { name: 'Feb', TikTok: 180, Instagram: 110, Pinterest: 75, Reddit: 45 },
    { name: 'Mar', TikTok: 240, Instagram: 140, Pinterest: 95, Reddit: 60 },
    { name: 'Apr', TikTok: 310, Instagram: 175, Pinterest: 120, Reddit: 78 },
    { name: 'May', TikTok: 390, Instagram: 210, Pinterest: 145, Reddit: 95 },
    { name: 'Jun', TikTok: 480, Instagram: 250, Pinterest: 170, Reddit: 110 }
  ];

  const heatmapMatrix = [
    { day: 'Mon', hours: [12, 18, 35, 62, 88, 94, 76, 42] },
    { day: 'Tue', hours: [14, 22, 40, 71, 91, 98, 82, 48] },
    { day: 'Wed', hours: [15, 25, 48, 80, 95, 100, 89, 52] },
    { day: 'Thu', hours: [18, 28, 52, 85, 96, 99, 91, 58] },
    { day: 'Fri', hours: [22, 35, 68, 92, 100, 98, 94, 65] },
    { day: 'Sat', hours: [30, 48, 82, 98, 92, 88, 80, 50] },
    { day: 'Sun', hours: [25, 42, 75, 90, 86, 82, 72, 44] }
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 text-xs font-semibold mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" /> Platform Cross-Section Signals
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Advanced Signal Analytics
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Cross-platform engagement velocity, posting heatmaps, and trend penetration metrics.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 shrink-0">
          {['7D', '30D', '90D', 'YTD'].map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                timeframe === t ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart 1: Cross-Platform Velocity */}
      <div className="glass-panel rounded-3xl p-6 space-y-4 border border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-purple-400" /> Cross-Platform Engagement Growth Velocity
            </h3>
            <p className="text-xs text-zinc-400">Monthly post engagement index across TikTok, Instagram, Pinterest, Reddit</p>
          </div>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={platformComparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }} />
              <Legend />
              <Line type="monotone" dataKey="TikTok" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Instagram" stroke="#a855f7" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Pinterest" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Reddit" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Engagement Heatmap Matrix Placeholder */}
      <div className="glass-panel rounded-3xl p-6 space-y-4 border border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" /> Hourly Engagement Heatmap Matrix
            </h3>
            <p className="text-xs text-zinc-400">Optimal posting hours mapped against 486,000 indexed post interactions</p>
          </div>
          <Badge variant="secondary" size="sm">Peak: Wed/Thu 6PM–9PM</Badge>
        </div>

        <div className="overflow-x-auto pt-2">
          <div className="min-w-[600px] space-y-2">
            <div className="grid grid-cols-9 text-[10px] text-zinc-500 font-bold uppercase text-center">
              <div>Day</div>
              <div>3 AM</div>
              <div>6 AM</div>
              <div>9 AM</div>
              <div>12 PM</div>
              <div>3 PM</div>
              <div>6 PM</div>
              <div>9 PM</div>
              <div>12 AM</div>
            </div>

            {heatmapMatrix.map((row, i) => (
              <div key={i} className="grid grid-cols-9 items-center gap-1.5 text-xs">
                <span className="font-bold text-zinc-400 text-center">{row.day}</span>
                {row.hours.map((val, hIdx) => {
                  const opacity = val / 100;
                  return (
                    <div
                      key={hIdx}
                      className="h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white/90 border border-purple-500/20 transition-all hover:scale-105 cursor-pointer"
                      style={{
                        backgroundColor: `rgba(124, 58, 237, ${Math.max(opacity, 0.15)})`
                      }}
                      title={`${row.day} Engagement Index: ${val}/100`}
                    >
                      {val}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};
