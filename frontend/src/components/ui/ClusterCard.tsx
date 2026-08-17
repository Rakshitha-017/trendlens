import React from 'react';
import { motion } from 'framer-motion';
import { Layers, TrendingUp, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { ClusterData } from '../../types';
import { Badge } from './Badge';

interface ClusterCardProps {
  cluster: ClusterData;
  onClick: () => void;
  index?: number;
}

export const ClusterCard: React.FC<ClusterCardProps> = ({ cluster, onClick, index = 0 }) => {
  const lifecycleVariant =
    cluster.lifecycle === 'Rising'
      ? 'success'
      : cluster.lifecycle === 'Declining'
      ? 'error'
      : 'secondary';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={onClick}
      className="glass-panel glass-panel-hover rounded-2xl overflow-hidden cursor-pointer group flex flex-col h-full border border-zinc-800"
    >
      {/* Representative Image Container */}
      <div className="relative h-48 w-full overflow-hidden bg-zinc-950">
        {cluster.representative_image_url ? (
          <img
            src={cluster.representative_image_url}
            alt={cluster.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">
            no representative image
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <Badge variant="primary" size="sm" icon={<Layers className="w-3 h-3" />}>
            Cluster {cluster.cluster_id}
          </Badge>
          <Badge variant={lifecycleVariant} size="sm" icon={<TrendingUp className="w-3 h-3" />}>
            {cluster.lifecycle ?? 'n/a'}
          </Badge>
        </div>

        {/* Bottom Post Count */}
        <div className="absolute bottom-3 left-3 text-xs font-bold text-zinc-300 flex items-center gap-1">
          <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
          {(cluster.n_posts ?? 0).toLocaleString()} indexed posts
        </div>
      </div>

      {/* Body Details */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
            {cluster.name}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 italic line-clamp-2">
            "{cluster.blip_caption}"
          </p>
        </div>

        {/* Visual Features Pills */}
        <div className="flex flex-wrap gap-1.5">
          {cluster.characteristics.slice(0, 3).map((feat, i) => (
            <span
              key={i}
              className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800"
            >
              {feat}
            </span>
          ))}
        </div>

        {/* Trend Score & Action */}
        <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold text-zinc-400">
              <span>Trend Score</span>
              <span className="text-cyan-400 font-extrabold">{cluster.trend_score?.toFixed(2) ?? '—'}</span>
            </div>
            <div className="w-28 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full"
                style={{ width: `${Math.min(100, (cluster.trend_score ?? 0) * 100)}%` }}
              />
            </div>
          </div>

          <span className="text-xs font-bold text-purple-400 group-hover:text-purple-300 flex items-center gap-1 transition-colors">
            Inspect <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </motion.div>
  );
};
