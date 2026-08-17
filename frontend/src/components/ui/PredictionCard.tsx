import React from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, BarChart2, ShieldAlert, Lightbulb } from 'lucide-react';
import { PredictionResult } from '../../types';
import { Badge } from './Badge';

interface PredictionCardProps {
  prediction: PredictionResult;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ prediction }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6 border border-amber-500/30 shadow-2xl relative overflow-hidden"
    >
      <div className="absolute -top-10 -right-10 w-60 h-60 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> {prediction.status}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Observed Stats — Cluster{' '}
            <span className="text-purple-300">#{prediction.clusterId}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-2xl border border-zinc-800 shrink-0">
          <Badge variant={prediction.lifecycle === 'Rising' ? 'success' : prediction.lifecycle === 'Declining' ? 'error' : 'secondary'}>
            {prediction.lifecycle ?? 'lifecycle n/a'}
          </Badge>
        </div>
      </div>

      {/* 3 Metric Cards Grid — observed only, no fabricated predictions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
            <Heart className="w-4 h-4 fill-rose-500/20" /> Observed Avg Engagement
          </div>
          <div className="text-2xl font-black text-white">
            {prediction.observedMeanEngagement !== null && prediction.observedMeanEngagement !== undefined
              ? prediction.observedMeanEngagement.toFixed(2)
              : '—'}
          </div>
          <p className="text-[10px] text-zinc-500">Mean likes/comments across cluster posts</p>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold">
            <MessageCircle className="w-4 h-4 fill-cyan-500/20" /> Indexed Posts
          </div>
          <div className="text-2xl font-black text-white">
            {prediction.observedPostCount !== null && prediction.observedPostCount !== undefined
              ? prediction.observedPostCount.toLocaleString()
              : '—'}
          </div>
          <p className="text-[10px] text-zinc-500">Posts belonging to this cluster</p>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-purple-400 text-xs font-bold">
            <BarChart2 className="w-4 h-4 fill-purple-500/20" /> Predicted Engagement
          </div>
          <div className="text-2xl font-black text-white">—</div>
          <p className="text-[10px] text-zinc-500">No model implemented — not predicted</p>
        </div>
      </div>

      {/* Honesty note */}
      <div className="bg-zinc-950/50 p-4 rounded-2xl border border-amber-900/50 space-y-1">
        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4" /> {prediction.note}
        </span>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Fields like <code className="text-zinc-400">predictedLikes</code>, <code className="text-zinc-400">predictedComments</code>,{' '}
          <code className="text-zinc-400">predictedTotalEngagement</code> and <code className="text-zinc-400">nMseScore</code> are{' '}
          <span className="text-rose-400 font-semibold">null by design</span> until an actual model is trained. Numbers shown here
          are measured from the index, not generated.
        </p>
      </div>
    </motion.div>
  );
};
