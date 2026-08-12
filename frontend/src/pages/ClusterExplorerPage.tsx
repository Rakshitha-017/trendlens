import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Layers, Search, Filter, Sparkles, Image, ArrowRight, MessageSquare, Flame } from 'lucide-react';
import { MOCK_CLUSTERS } from '../data/mockData';
import { ClusterData, TrendCategory } from '../types';
import { ClusterCard } from '../components/ui/ClusterCard';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export const ClusterExplorerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeClusterModal, setActiveClusterModal] = useState<ClusterData | null>(null);

  const categories = ['All', 'Architecture & Interior', 'Fashion & Apparel', 'Food & Beverage', 'Consumer Tech', 'Aesthetics & Lifestyle', 'Digital Art & CGI'];

  const filteredClusters = useMemo(() => {
    return MOCK_CLUSTERS.filter((cluster) => {
      const matchesCat = selectedCategory === 'All' || cluster.category === selectedCategory;
      const matchesQuery =
        !searchQuery.trim() ||
        cluster.clusterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cluster.blipCaption.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cluster.topVisualFeatures.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCat && matchesQuery;
    });
  }, [selectedCategory, searchQuery]);

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
            Discover automatically grouped visual micro-trends extracted from CLIP's 768-dimensional latent space.
          </p>
        </div>

        <Badge variant="secondary" size="lg" icon={<Sparkles className="w-4 h-4" />}>
          124 Visual Clusters Discovered
        </Badge>
      </div>

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
              placeholder="Filter clusters by name, caption, or visual features (e.g. 'raw clay', 'chrome')..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Category Dropdown on Mobile */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {cat}
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
          <p className="text-xs text-zinc-400">Try broadening your search query or switching categories.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClusters.map((cluster, idx) => (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              index={idx}
              onClick={() => setActiveClusterModal(cluster)}
            />
          ))}
        </div>
      )}

      {/* Cluster Details Modal */}
      <Modal
        isOpen={!!activeClusterModal}
        onClose={() => setActiveClusterModal(null)}
        maxWidth="4xl"
        title={
          <span className="flex items-center gap-2 text-white">
            <Layers className="w-5 h-5 text-purple-400" />
            {activeClusterModal?.clusterName}
          </span>
        }
      >
        {activeClusterModal && (
          <div className="space-y-6">
            
            {/* Top Overview & Main Representative Image */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Image Preview & Gallery */}
              <div className="space-y-3">
                <div className="h-64 rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800">
                  <img
                    src={activeClusterModal.representativeImage}
                    alt={activeClusterModal.clusterName}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {activeClusterModal.sampleImages.map((img, i) => (
                    <div key={i} className="h-20 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
                      <img src={img} alt="Sample" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Cluster Specs & BLIP Caption */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="primary">{activeClusterModal.category}</Badge>
                  <Badge variant="success">+{activeClusterModal.growth}% Growth</Badge>
                </div>

                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block">BLIP-2 Vision Caption</span>
                  <p className="text-xs text-zinc-300 italic leading-relaxed">
                    "{activeClusterModal.blipCaption}"
                  </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Total Indexed Posts</span>
                    <span className="text-lg font-black text-white">{activeClusterModal.postCount.toLocaleString()}</span>
                  </div>

                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Cluster Density</span>
                    <span className="text-lg font-black text-cyan-400">{activeClusterModal.clusterDensity}</span>
                  </div>
                </div>

                {/* Key Visual Features */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-300 block">Key Visual Feature Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeClusterModal.topVisualFeatures.map((feat, i) => (
                      <span
                        key={i}
                        className="text-xs font-medium px-2.5 py-1 rounded-xl bg-purple-950 text-purple-300 border border-purple-800"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Prompt AI RAG Action */}
                <Button
                  variant="gradient"
                  className="w-full"
                  icon={<MessageSquare className="w-4 h-4" />}
                  onClick={() => {
                    const name = activeClusterModal.clusterName;
                    setActiveClusterModal(null);
                    navigate(`/query?q=${encodeURIComponent(`Explain why ${name} is surging`)}`);
                  }}
                >
                  Ask AI Assistant About This Cluster
                </Button>
              </div>

            </div>

            {/* Post Volume Growth Chart */}
            <div className="bg-zinc-950/80 p-5 rounded-2xl border border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold text-white">Monthly Post Volume Growth</h4>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeClusterModal.timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="posts" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}
      </Modal>

    </div>
  );
};
