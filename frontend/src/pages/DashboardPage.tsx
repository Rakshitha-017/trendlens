import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import {
  Sparkles,
  TrendingUp,
  Layers,
  Search,
  Filter,
  ArrowUpRight,
  Flame,
  Zap,
  Clock,
  ChevronRight
} from 'lucide-react';
import { STAT_METRICS, MOCK_CLUSTERS, MOCK_TRENDS } from '../data/mockData';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Chart Series Data
  const trendGrowthData = [
    { month: 'Jan', posts: 240000, clusters: 42, velocity: 110 },
    { month: 'Feb', posts: 290000, clusters: 58, velocity: 145 },
    { month: 'Mar', posts: 340000, clusters: 76, velocity: 180 },
    { month: 'Apr', posts: 395000, clusters: 92, velocity: 220 },
    { month: 'May', posts: 440000, clusters: 108, velocity: 275 },
    { month: 'Jun', posts: 486240, clusters: 124, velocity: 312 }
  ];

  const categoryDistributionData = [
    { name: 'Fashion & Apparel', value: 32, color: '#a855f7' },
    { name: 'Architecture & Interior', value: 24, color: '#06b6d4' },
    { name: 'Food & Beverage', value: 18, color: '#38bdf8' },
    { name: 'Consumer Tech', value: 16, color: '#f59e0b' },
    { name: 'Aesthetics & Lifestyle', value: 10, color: '#22c55e' }
  ];

  const platformEngagementData = [
    { platform: 'TikTok', velocity: 320, engagement: 88 },
    { platform: 'Instagram', velocity: 240, engagement: 74 },
    { platform: 'Pinterest', velocity: 190, engagement: 62 },
    { platform: 'Reddit', velocity: 130, engagement: 55 }
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
            Real-time multimodal social analytics powered by CLIP embeddings & HDBSCAN density clustering.
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

      {/* 4 Core Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_METRICS.map((metric, idx) => (
          <StatCard key={idx} metric={metric} index={idx} />
        ))}
      </div>

      {/* Charts Grid Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Trend Growth Trajectory (8 cols) */}
        <div className="lg:col-span-8 glass-panel rounded-3xl p-6 space-y-4 border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" /> Visual Volume & Velocity Trajectory
              </h3>
              <p className="text-xs text-zinc-400">Indexed post volume vs active cluster growth velocity</p>
            </div>
            <Badge variant="primary" size="sm">6 Months Timeline</Badge>
          </div>

          <div className="h-64 sm:h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendGrowthData}>
                <defs>
                  <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorClusters" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="posts" stroke="#7c3aed" strokeWidth={2} fillOpacity={1} fill="url(#colorPosts)" name="Indexed Posts" />
                <Area type="monotone" dataKey="clusters" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorClusters)" name="Active Clusters" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution Pie Chart (4 cols) */}
        <div className="lg:col-span-4 glass-panel rounded-3xl p-6 space-y-4 border border-zinc-800 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" /> Category Breakdown
            </h3>
            <p className="text-xs text-zinc-400">Share of 124 discovered visual clusters</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            {categoryDistributionData.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-zinc-300 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Trending Micro-Clusters Highlights */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" /> High-Velocity Visual Micro-Clusters
            </h2>
            <p className="text-xs text-zinc-400">Discovered via HDBSCAN density grouping in CLIP latent space</p>
          </div>
          <button
            onClick={() => navigate('/clusters')}
            className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1"
          >
            View All 124 Clusters <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MOCK_CLUSTERS.slice(0, 3).map((cluster, idx) => (
            <motion.div
              key={cluster.id}
              whileHover={{ y: -4 }}
              onClick={() => navigate('/clusters')}
              className="glass-panel glass-panel-hover rounded-2xl p-4 border border-zinc-800 cursor-pointer space-y-3"
            >
              <div className="h-36 rounded-xl overflow-hidden relative bg-zinc-950">
                <img
                  src={cluster.representativeImage}
                  alt={cluster.clusterName}
                  className="w-full h-full object-cover"
                />
                <Badge variant="success" size="sm" className="absolute top-2.5 right-2.5">
                  +{cluster.growth}% Velocity
                </Badge>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">{cluster.clusterName}</h3>
                <p className="text-xs text-zinc-400 line-clamp-1 italic mt-0.5">"{cluster.blipCaption}"</p>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-800">
                <span>{cluster.postCount.toLocaleString()} posts</span>
                <span className="text-cyan-400 font-bold">Score: {cluster.popularityScore}/100</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent Trends Table */}
      <div className="glass-panel rounded-3xl p-6 space-y-4 border border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">Live Tracked Visual Trends</h2>
            <p className="text-xs text-zinc-400">Detailed metric breakdown across active visual trends</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-500"
            >
              <option value="All">All Categories</option>
              <option value="Architecture & Interior">Architecture & Interior</option>
              <option value="Fashion & Apparel">Fashion & Apparel</option>
              <option value="Consumer Tech">Consumer Tech</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px]">
                <th className="py-3 px-4">Visual Trend</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Growth Velocity</th>
                <th className="py-3 px-4">Post Volume</th>
                <th className="py-3 px-4">Lifecycle</th>
                <th className="py-3 px-4">Popularity Score</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {MOCK_TRENDS.filter(
                (t) => selectedCategory === 'All' || t.category === selectedCategory
              ).map((trend) => (
                <tr key={trend.id} className="hover:bg-zinc-900/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={trend.representativeImage}
                        alt={trend.title}
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <div>
                        <div className="font-bold text-white text-xs">{trend.title}</div>
                        <div className="text-[10px] text-zinc-400">{trend.keyDrivers[0]}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-300 font-medium">{trend.category}</td>
                  <td className="py-3.5 px-4">
                    <span className="text-emerald-400 font-extrabold">+{trend.growthVelocity}%</span>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-300">{trend.postCount.toLocaleString()}</td>
                  <td className="py-3.5 px-4">
                    <Badge variant="primary" size="sm">
                      {trend.lifecycle}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cyan-400">{trend.popularityScore}/100</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => navigate('/query')}
                      className="px-3 py-1 bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800/80 rounded-xl font-bold text-[11px] transition-colors inline-flex items-center gap-1"
                    >
                      Ask AI <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
