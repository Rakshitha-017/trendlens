import React from 'react';
import { motion } from 'framer-motion';
import { Image, Layers, Zap, Target, TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import { StatMetric } from '../../types';

interface StatCardProps {
  metric: StatMetric;
  index?: number;
}

export const StatCard: React.FC<StatCardProps> = ({ metric, index = 0 }) => {
  const getIcon = (name: string) => {
    switch (name) {
      case 'Image':
        return <Image className="w-5 h-5 text-purple-400" />;
      case 'Layers':
        return <Layers className="w-5 h-5 text-cyan-400" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-amber-400" />;
      case 'Target':
        return <Target className="w-5 h-5 text-emerald-400" />;
      default:
        return <HelpCircle className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="glass-panel glass-panel-hover rounded-2xl p-5 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-cyan-500/0 rounded-full blur-2xl pointer-events-none group-hover:from-purple-500/20 transition-all duration-300" />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">
          {metric.title}
        </span>
        <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-inner">
          {getIcon(metric.iconName)}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {metric.value}
        </h3>
        <span
          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
            metric.isPositive
              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
              : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
          }`}
        >
          {metric.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {metric.change}
        </span>
      </div>

      <p className="text-xs text-zinc-400 line-clamp-1">{metric.description}</p>
    </motion.div>
  );
};
