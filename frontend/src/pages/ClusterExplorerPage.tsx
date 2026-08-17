import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Search, Sparkles, MessageSquare } from 'lucide-react';
import { api } from '../services/apiClient';
import { ClusterData } from '../types';
import { ClusterCard } from '../components/ui/ClusterCard';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export const ClusterExplorerPage: React.FC = () => {
  const navigate = useNavigate();
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLifecycle, setSelectedLifecycle] = useState<string>('All');
  const [activeCluster, setActiveCluster] = useState<ClusterData | null>(null);
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

  const lifecycles = useMemo(() => {
    const set = new Set(clusters.map((c) => c.lifecycle).filter(Boolean));
    return ['All', ...Array.from(set) as string[]];
  }, [clusters]);

  const filteredClusters = useMemo(() => {
    return clusters.filter((cluster) => {
      const matchesLc = selectedLifecycle === 'All' || cluster.lifecycle === selectedLifecycle;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        (cluster.name || '').toLowerCase().includes(q) ||
        (cluster.blip_caption || '').toLowerCase().includes(q) ||
        cluster.characteristics.some((f) => f.toLowerCase().includes(q));
      return matchesLc && matchesQuery;
    });
  }, [clusters, selectedLifecycle, searchQuery]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 text-xs font-semibold mb-2">
            <Layers className="w-3.5 h-3.5 text-cyan-400" /> HDBSCAN Unsupervised Clustering Space
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Visual Trend Cluster Explorer
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Automatically grouped visual micro-trends from CLIP ViT-B/32 embeddings of 5,000 sampled images.
          </p>
        </div>

        <Badge variant="secondary" size="lg" icon={<Sparkles className="w-4 h-4" />}>
          {clusters.length > 0 ? `${clusters.length} Visual Clusters` : 'Loading…'}
        </Badge>
      </div>

      {error && (
        <div className="glass-panel rounded-2xl p-4 border border-amber-800/60 text-xs text-amber-300">
          {error}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-panel rounded-2xl p-4 space-y-4 border border-zinc-800">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter clusters by name, caption, or visual features (e.g. 'dog', 'moon', 'coffee')..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Lifecycle filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {lifecycles.map((lc) => (
              <button
                key={lc}
                onClick={() => setSelectedLifecycle(lc)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedLifecycle === lc
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {lc}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cluster Grid */}
      {filteredClusters.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center space-y-3">
          <Layers className="w-12 h-12 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No matching visual clusters</h3>
          <p className="text-xs text-zinc-400">Try broadening your search query or switching lifecycles.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClusters.map((cluster, idx) => (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              index={idx}
              onClick={() => setActiveCluster(cluster)}
            />
          ))}
        </div>
      )}

      {/* Cluster Details Modal */}
      <Modal
        isOpen={!!activeCluster}
        onClose={() => setActiveCluster(null)}
        maxWidth="4xl"
        title={
          <span className="flex items-center gap-2 text-white">
            <Layers className="w-5 h-5 text-purple-400" />
            {activeCluster?.name}
          </span>
        }
      >
        {activeCluster && (
          <div className="space-y-6">
            {/* Top Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Representative Image */}
              <div className="h-64 rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800">
                {activeCluster.representative_image_url ? (
                  <img
                    src={activeCluster.representative_image_url}
                    alt={activeCluster.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">
                    no representative image
                  </div>
                )}
              </div>

              {/* Cluster Specs */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="primary">Cluster #{activeCluster.cluster_id}</Badge>
                  <Badge variant="success">{activeCluster.lifecycle ?? 'n/a'}</Badge>
                </div>

                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block">BLIP Vision Caption</span>
                  <p className="text-xs text-zinc-300 italic leading-relaxed">
                    "{activeCluster.blip_caption}"
                  </p>
                </div>

                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block">Interpretation Confidence</span>
                  <p className="text-xs text-zinc-300">
                    {activeCluster.confidence !== null && activeCluster.confidence !== undefined
                      ? activeCluster.confidence.toFixed(4)
                      : '—'}
                    {' '}(BLIP mean score — not ground truth)
                  </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Total Indexed Posts</span>
                    <span className="text-lg font-black text-white">{(activeCluster.n_posts ?? 0).toLocaleString()}</span>
                  </div>

                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Avg Engagement</span>
                    <span className="text-lg font-black text-cyan-400">
                      {activeCluster.average_engagement?.toFixed(2) ?? '—'}
                    </span>
                  </div>

                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Trend Score</span>
                    <span className="text-lg font-black text-white">{activeCluster.trend_score?.toFixed(3) ?? '—'}</span>
                  </div>

                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Recent Growth</span>
                    <span className="text-lg font-black text-emerald-400">
                      ×{activeCluster.recent_growth?.toFixed(2) ?? '—'}
                    </span>
                  </div>
                </div>

                {/* Key Visual Features */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-300 block">Key Visual Feature Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeCluster.characteristics.map((feat, i) => (
                      <span
                        key={i}
                        className="text-xs font-medium px-2.5 py-1 rounded-xl bg-purple-950 text-purple-300 border border-purple-800"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Prompt RAG Action */}
                <Button
                  variant="gradient"
                  className="w-full"
                  icon={<MessageSquare className="w-4 h-4" />}
                  onClick={() => {
                    const name = activeCluster.name;
                    setActiveCluster(null);
                    navigate(`/query?q=${encodeURIComponent(`What visual style is ${name}?`)}`);
                  }}
                >
                  Ask RAG About This Cluster
                </Button>
              </div>
            </div>

            {/* Description */}
            <div className="bg-zinc-950/80 p-5 rounded-2xl border border-zinc-800 space-y-2">
              <h4 className="text-xs font-bold text-white">Cluster Description</h4>
              <p className="text-xs text-zinc-300 leading-relaxed">{activeCluster.description}</p>
              <p className="text-[10px] text-zinc-500">
                Lifecycle labels are demo-only (neutral synthetic timestamps — noise, not signal).
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
