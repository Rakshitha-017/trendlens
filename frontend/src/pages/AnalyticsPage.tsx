import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { BarChart3, Layers } from 'lucide-react';
import { api } from '../services/apiClient';
import { ClusterData } from '../types';
import { Badge } from '../components/ui/Badge';

const LIFECYCLE_COLORS: Record<string, string> = {
  Rising: '#22c55e',
  Stable: '#06b6d4',
  Declining: '#f43f5e',
};

export const AnalyticsPage: React.FC = () => {
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .clusters()
      .then((res) => {
        if (!cancelled) setClusters(res.clusters);
      })
      .catch(() => {
        if (!cancelled)
          setError('Could not reach the TrendLens backend — start it with `python -m src.api` and reload.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => [...clusters].sort((a, b) => (b.average_engagement ?? 0) - (a.average_engagement ?? 0)), [clusters]);
  const topEngagement = sorted.slice(0, 12).map((c) => ({
    name: `#${c.cluster_id}`,
    engagement: Number((c.average_engagement ?? 0).toFixed(2)),
    lifecycle: c.lifecycle ?? 'n/a',
  }));

  const postVolume = useMemo(
    () =>
      [...clusters]
        .sort((a, b) => (b.n_posts ?? 0) - (a.n_posts ?? 0))
        .slice(0, 12)
        .map((c) => ({
          name: `#${c.cluster_id}`,
          posts: c.n_posts ?? 0,
          lifecycle: c.lifecycle ?? 'n/a',
        })),
    [clusters]
  );

  const lifecycleCounts = useMemo(() => {
    const counts: Record<string, number> = { Rising: 0, Stable: 0, Declining: 0 };
    clusters.forEach((c) => {
      if (c.lifecycle && c.lifecycle in counts) counts[c.lifecycle] += 1;
    });
    return counts;
  }, [clusters]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 text-xs font-semibold mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" /> Observed Index Signals
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Analytics &amp; Signals
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Real statistics measured from the CLIP + HDBSCAN index of 5,000 sampled images.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" size="lg" icon={<Layers className="w-4 h-4" />}>
            {clusters.length > 0 ? `${clusters.length} clusters` : 'Loading…'}
          </Badge>
        </div>
      </div>

      {error && (
        <div className="glass-panel rounded-2xl p-4 border border-amber-800/60 text-xs text-amber-300">{error}</div>
      )}

      {/* Lifecycle distribution */}
      <div className="glass-panel rounded-3xl p-6 border border-zinc-800">
        <h3 className="text-base font-bold text-white mb-1">Cluster Lifecycle Distribution</h3>
        <p className="text-xs text-zinc-400 mb-4">
          Demo-only labels from neutral synthetic timestamps — noise, not signal.
        </p>
        <div className="flex items-end gap-6 h-40">
          {(['Rising', 'Stable', 'Declining'] as const).map((lc) => (
            <div key={lc} className="flex flex-col items-center gap-2 flex-1">
              <span className="text-sm font-black text-white">{lifecycleCounts[lc]}</span>
              <div
                className="w-full max-w-40 rounded-t-lg transition-all"
                style={{
                  height: `${clusters.length ? (lifecycleCounts[lc] / clusters.length) * 100 : 0}%`,
                  minHeight: lifecycleCounts[lc] ? 12 : 2,
                  backgroundColor: LIFECYCLE_COLORS[lc],
                }}
              />
              <span className="text-xs font-bold" style={{ color: LIFECYCLE_COLORS[lc] }}>
                {lc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement bar chart */}
      <div className="glass-panel rounded-3xl p-6 space-y-4 border border-zinc-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" /> Average Engagement by Cluster (Top 12)
          </h3>
          <p className="text-xs text-zinc-400">
            Real mean likes/comments across the posts assigned to each cluster. Per-platform and hourly data do not exist.
          </p>
        </div>
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topEngagement}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
              />
              <Legend />
              <Bar dataKey="engagement" name="Avg engagement" radius={[8, 8, 0, 0]}>
                {topEngagement.map((entry, idx) => (
                  <Cell key={idx} fill={LIFECYCLE_COLORS[entry.lifecycle] ?? '#a855f7'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Post volume bar chart */}
      <div className="glass-panel rounded-3xl p-6 space-y-4 border border-zinc-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" /> Indexed Post Volume by Cluster (Top 12)
          </h3>
          <p className="text-xs text-zinc-400">Number of sampled images assigned to each cluster.</p>
        </div>
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={postVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
              />
              <Legend />
              <Bar dataKey="posts" name="Indexed posts" fill="#06b6d4" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
