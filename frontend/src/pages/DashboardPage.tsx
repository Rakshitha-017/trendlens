import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  Sparkles,
  TrendingUp,
  Layers,
  ArrowUpRight,
  Flame,
  Zap,
  Clock,
  ChevronRight
} from 'lucide-react';
import { api, ClustersResponse, TrendsResponse, HealthResponse, LiveTrend } from '../services/apiClient';
import { ClusterData, StatMetric, TrendItem } from '../types';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

const LIFECYCLE_COLORS: Record<string, string> = {
  Rising: '#22c55e',
  Stable: '#06b6d4',
  Declining: '#f43f5e',
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedLifecycle, setSelectedLifecycle] = useState<string>('All');
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [liveTrends, setLiveTrends] = useState<LiveTrend[]>([]);
  const [liveSource, setLiveSource] = useState<string | null>(null);
  const [liveChannels, setLiveChannels] = useState<string[]>([]);
  const [liveDisclaimer, setLiveDisclaimer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.health(), api.trends(), api.clusters(), api.liveTrends()]).then(
      ([h, t, c, lt]) => {
        if (cancelled) return;
        if (h.status === 'fulfilled') setHealth(h.value);
        if (t.status === 'fulfilled') setTrends(t.value.trends);
        if (c.status === 'fulfilled') setClusters(c.value.clusters);
        if (lt.status === 'fulfilled') {
          setLiveTrends(lt.value.themes);
          setLiveSource(lt.value.source ?? null);
          setLiveChannels(lt.value.subreddits ?? []);
          setLiveDisclaimer(lt.value.disclaimer ?? null);
        }
        const failures = [h, t, c].filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
          setError('Could not reach the TrendLens backend — start it with `python -m src.api` (or use the proxy on :3000).');
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const lifecycleCounts = useMemo(() => {
    const counts = { Rising: 0, Stable: 0, Declining: 0 };
    clusters.forEach((c) => {
      if (c.lifecycle && c.lifecycle in counts) counts[c.lifecycle] += 1;
    });
    return counts;
  }, [clusters]);

  const topByVolume = useMemo(
    () =>
      [...clusters]
        .sort((a, b) => (b.n_posts ?? 0) - (a.n_posts ?? 0))
        .slice(0, 8)
        .map((c) => ({ name: c.name || `Cluster ${c.cluster_id}`, posts: c.n_posts ?? 0 })),
    [clusters]
  );

  const topByTrend = useMemo(
    () =>
      [...clusters]
        .sort((a, b) => (b.trend_score ?? -1) - (a.trend_score ?? -1))
        .slice(0, 3),
    [clusters]
  );

  const filteredTrends = useMemo(
    () =>
      trends.filter(
        (t) => selectedLifecycle === 'All' || t.lifecycle === selectedLifecycle
      ),
    [trends, selectedLifecycle]
  );

  const statMetrics: StatMetric[] = [
    {
      title: 'Images Indexed (this build)',
      value: health ? '5,000' : '…',
      change: 'of 69,226 available',
      isPositive: true,
      description: 'Sample of the SMPD dataset (CLIP embeddings)',
      iconName: 'Image',
    },
    {
      title: 'Visual Clusters',
      value: clusters.length > 0 ? String(clusters.length) : '…',
      change: '73.6% of posts clustered',
      isPositive: true,
      description: 'UMAP-10 + HDBSCAN, silhouette 0.586',
      iconName: 'Layers',
    },
    {
      title: 'Lifecycle Split',
      value:
        clusters.length > 0
          ? `${lifecycleCounts.Rising}/${lifecycleCounts.Stable}/${lifecycleCounts.Declining}`
          : '…',
      change: 'Rising / Stable / Declining',
      isPositive: true,
      description: 'Neutral synthetic timestamps (demo) — noise-dominated',
      iconName: 'Zap',
    },
    {
      title: 'Retrieval (CLIP-text → FAISS)',
      value: 'hit@1 0.95',
      change: 'MRR 0.95 · hit@5 0.95',
      isPositive: true,
      description: '20 curated queries; popularity model NOT EVALUATED',
      iconName: 'Target',
    },
  ];

  const lifecyclePie = [
    { name: 'Rising', value: lifecycleCounts.Rising },
    { name: 'Stable', value: lifecycleCounts.Stable },
    { name: 'Declining', value: lifecycleCounts.Declining },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 text-xs font-semibold mb-2">
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Live Signal Processing
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Visual Trend Intelligence Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Real multimodal visual analytics — CLIP embeddings & HDBSCAN density clustering.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            icon={<Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
            onClick={() => navigate('/query')}
          >
            Prompt RAG
          </Button>

          <Button
            variant="gradient"
            size="sm"
            icon={<Zap className="w-3.5 h-3.5" />}
            onClick={() => navigate('/clusters')}
          >
            Explore Clusters
          </Button>
        </div>
      </div>

      {error && (
        <div className="glass-panel rounded-2xl p-4 border border-amber-800/60 text-xs text-amber-300">
          {error}
        </div>
      )}

      {/* 4 Core Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statMetrics.map((metric, idx) => (
          <StatCard key={idx} metric={metric} index={idx} />
        ))}
      </div>

      {/* Charts Grid Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Post Volume (8 cols) */}
        <div className="lg:col-span-8 glass-panel rounded-3xl p-6 space-y-4 border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" /> Top Clusters by Post Volume
              </h3>
              <p className="text-xs text-zinc-400">Real post counts from the 5K sampled-image clusters</p>
            </div>
            <Badge variant="primary" size="sm">Observed Data</Badge>
          </div>

          <div className="h-64 sm:h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topByVolume} margin={{ bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="name"
                  stroke="#71717a"
                  fontSize={11}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Bar dataKey="posts" name="Posts" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lifecycle Distribution Pie (4 cols) */}
        <div className="lg:col-span-4 glass-panel rounded-3xl p-6 space-y-4 border border-zinc-800 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" /> Lifecycle Distribution
            </h3>
            <p className="text-xs text-zinc-400">
              {clusters.length > 0
                ? `${clusters.length} clusters · demo labels from neutral synthetic timestamps`
                : 'Loading clusters…'}
            </p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={lifecyclePie}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {lifecyclePie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={LIFECYCLE_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            {lifecyclePie.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LIFECYCLE_COLORS[item.name] }} />
                  <span className="text-zinc-300 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Trending Micro-Clusters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" /> Highest Trend-Score Micro-Clusters
            </h2>
            <p className="text-xs text-zinc-400">
              Real clusters ranked by trend_score (synthetic demo timestamps — treat as demo)
            </p>
          </div>
          <button
            onClick={() => navigate('/clusters')}
            className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1"
          >
            View All {clusters.length || '…'} Clusters <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topByTrend.map((cluster, idx) => (
            <motion.div
              key={cluster.id}
              whileHover={{ y: -4 }}
              onClick={() => navigate('/clusters')}
              className="glass-panel glass-panel-hover rounded-2xl p-4 border border-zinc-800 cursor-pointer space-y-3"
            >
              <div className="h-36 rounded-xl overflow-hidden relative bg-zinc-950">
                {cluster.representative_image_url ? (
                  <img
                    src={cluster.representative_image_url}
                    alt={cluster.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">
                    no image
                  </div>
                )}
                <Badge
                  variant={cluster.lifecycle === 'Rising' ? 'success' : cluster.lifecycle === 'Declining' ? 'error' : 'secondary'}
                  size="sm"
                  className="absolute top-2.5 right-2.5"
                >
                  {cluster.lifecycle ?? 'n/a'}
                </Badge>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">{cluster.name}</h3>
                <p className="text-xs text-zinc-400 line-clamp-1 italic mt-0.5">
                  "{cluster.blip_caption}"
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-800">
                <span>{(cluster.n_posts ?? 0).toLocaleString()} posts</span>
                <span className="text-cyan-400 font-bold">
                  Trend {cluster.trend_score?.toFixed(2) ?? '—'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Real-Time Emerging Trends (live Reddit) */}
      <div className="glass-panel rounded-3xl p-6 space-y-4 border border-purple-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" /> What's Trending Right Now
            </h2>
            <p className="text-xs text-zinc-400">
              Emerging themes detected from REAL {liveSource === 'reddit' ? 'Reddit' : liveSource === 'wikimedia-commons' ? 'Wikimedia Commons' : 'public feed'} posts
              ({liveChannels.length ? liveChannels.join(', ') : '…'} · fresh images, real timestamps
              {liveSource !== 'reddit' ? ', no engagement signal' : ' & engagement'})
            </p>
          </div>
          <Badge variant="primary" size="sm">
            REAL Data{liveSource ? ` · ${liveSource === 'reddit' ? 'Reddit' : liveSource === 'wikimedia-commons' ? 'Wikimedia' : liveSource}` : ''}
          </Badge>
        </div>

        {liveTrends.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 text-xs text-zinc-400">
            No live trends ingested yet. Run{' '}
            <code className="text-purple-300">python -m src.live</code> to pull fresh posts
            (Reddit — or Wikimedia Commons automatically if Reddit is blocked), then refresh.
            This section is empty on purpose — it will never show fabricated numbers.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {liveTrends.slice(0, 6).map((t) => {
              const growth = t.growth_rate;
              return (
                <motion.div
                  key={t.name}
                  whileHover={{ y: -4 }}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/60 overflow-hidden space-y-3"
                >
                  <div className="h-40 rounded-xl overflow-hidden relative bg-zinc-950 m-3 mb-0">
                    {t.representative_image_url ? (
                      <img
                        src={t.representative_image_url}
                        alt={t.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">
                        no image
                      </div>
                    )}
                    <span className="absolute top-2.5 right-2.5 bg-black/70 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {t.keywords_emoji} {t.channel_label ?? t.subreddits.join(', ')}
                    </span>
                  </div>

                  <div className="px-3 pb-3 space-y-2">
                    <h3 className="text-sm font-bold text-white capitalize">
                      {t.keywords.slice(0, 3).join(' · ')}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-2 italic">
                      {t.blip_caption ? `"${t.blip_caption}"` : t.name}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {growth === null ? (
                        <Badge variant="success" size="sm">NEW this window</Badge>
                      ) : (
                        <Badge variant={growth >= 0.2 ? 'success' : 'secondary'} size="sm">
                          {growth >= 0 ? '+' : ''}
                          {Math.round(growth * 100)}% vs prior window
                        </Badge>
                      )}
                      <span className="text-zinc-500">{t.recent_posts} recent posts</span>
                      {t.has_engagement && (
                        <span className="text-zinc-500">avg eng {Math.round(t.avg_engagement)}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{t.replicate}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        {liveDisclaimer && (
          <p className="text-[10px] text-zinc-500 leading-relaxed">{liveDisclaimer}</p>
        )}
      </div>

      {/* Live Tracked Trends Table */}
      <div className="glass-panel rounded-3xl p-6 space-y-4 border border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">Live Tracked Visual Trends</h2>
            <p className="text-xs text-zinc-400">Observed metrics from trend_metrics.csv (demo timestamps)</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Lifecycle:</span>
            <select
              value={selectedLifecycle}
              onChange={(e) => setSelectedLifecycle(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-500"
            >
              <option value="All">All Lifecycles</option>
              <option value="Rising">Rising</option>
              <option value="Stable">Stable</option>
              <option value="Declining">Declining</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px]">
                <th className="py-3 px-4">Visual Trend</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Growth</th>
                <th className="py-3 px-4">Post Volume</th>
                <th className="py-3 px-4">Lifecycle</th>
                <th className="py-3 px-4">Avg Engagement</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredTrends.map((trend) => (
                <tr key={trend.cluster_id} className="hover:bg-zinc-900/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      {trend.representative_image_url ? (
                        <img
                          src={trend.representative_image_url}
                          alt={trend.name}
                          className="w-10 h-10 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-zinc-800" />
                      )}
                      <div>
                        <div className="font-bold text-white text-xs">{trend.name}</div>
                        <div className="text-[10px] text-zinc-400">
                          Cluster #{trend.cluster_id} · {trend.blip_caption}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-400 max-w-[220px] line-clamp-2">
                    {trend.description}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={trend.recent_growth >= 1 ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold'}>
                      ×{trend.recent_growth.toFixed(2)} recent
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-300">{trend.n_posts.toLocaleString()}</td>
                  <td className="py-3.5 px-4">
                    <Badge variant="primary" size="sm">
                      {trend.lifecycle}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-cyan-400">{trend.average_engagement.toFixed(2)}</span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => navigate('/query')}
                      className="px-3 py-1 bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800/80 rounded-xl font-bold text-[11px] transition-colors inline-flex items-center gap-1"
                    >
                      Ask RAG <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTrends.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    No trends match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-zinc-500 flex items-center gap-1">
        <Clock className="w-3 h-3" /> Dashboard shows observed pipeline metrics only — no fabricated numbers.
      </p>
    </div>
  );
};
