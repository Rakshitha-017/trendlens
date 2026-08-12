import React from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Award, CheckCircle2, Lightbulb, Sparkles, Sliders } from 'lucide-react';
import { PredictionResult } from '../../types';

interface PredictionCardProps {
  prediction: PredictionResult;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ prediction }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6 border border-purple-500/30 shadow-2xl relative overflow-hidden"
    >
      <div className="absolute -top-10 -right-10 w-60 h-60 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> CLIP Multimodal Feature Extractor
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Matched Cluster: <span className="text-purple-300">{prediction.matchedClusterName}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-2xl border border-zinc-800 shrink-0">
          <Award className="w-5 h-5 text-amber-400" />
          <div>
            <div className="text-[10px] text-zinc-400 uppercase font-bold">Confidence Score</div>
            <div className="text-sm font-black text-emerald-400">{prediction.confidenceScore}% High</div>
          </div>
        </div>
      </div>

      {/* 3 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Predicted Likes */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
            <Heart className="w-4 h-4 fill-rose-500/20" /> Predicted Likes
          </div>
          <div className="text-2xl font-black text-white">
            {prediction.predictedLikes.toLocaleString()}{' '}
            <span className="text-xs text-zinc-400 font-normal">±8%</span>
          </div>
          <p className="text-[10px] text-zinc-500">Target audience viral velocity</p>
        </div>

        {/* Predicted Comments */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold">
            <MessageCircle className="w-4 h-4 fill-cyan-500/20" /> Predicted Comments
          </div>
          <div className="text-2xl font-black text-white">
            {prediction.predictedComments.toLocaleString()}{' '}
            <span className="text-xs text-zinc-400 font-normal">±12%</span>
          </div>
          <p className="text-[10px] text-zinc-500">High engagement prompt index</p>
        </div>

        {/* Popularity Score Gauge */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-purple-400 text-xs font-bold">
            <Award className="w-4 h-4 fill-purple-500/20" /> Overall Popularity
          </div>
          <div className="text-2xl font-black text-white">
            {prediction.popularityScore} <span className="text-xs font-normal text-zinc-400">/ 100</span>
          </div>
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mt-1">
            <div
              className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full rounded-full"
              style={{ width: `${prediction.popularityScore}%` }}
            />
          </div>
        </div>

      </div>

      {/* Visual Feature Breakdown & Color Palette */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950/50 p-5 rounded-2xl border border-zinc-800/80">
        
        {/* Dominant Color Palette */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-zinc-300 block">Extracted Color Hex Palette</span>
          <div className="flex items-center gap-2">
            {prediction.dominantColorPalette.map((hex, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className="w-10 h-10 rounded-xl border border-white/20 shadow-md"
                  style={{ backgroundColor: hex }}
                />
                <span className="text-[10px] font-mono text-zinc-400">{hex}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detected Visual Features */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-zinc-300 block">CLIP Extracted Visual Features</span>
          <div className="flex flex-wrap gap-1.5">
            {prediction.detectedVisualFeatures.map((feat, i) => (
              <span
                key={i}
                className="text-xs font-medium px-2.5 py-1 rounded-xl bg-purple-950/80 text-purple-300 border border-purple-800/60"
              >
                {feat}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* AI Explanation & Recommendations */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" /> AI Diagnostic & Viral Optimization Playbook
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Key Drivers */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-2">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Positive Engagement Drivers
            </span>
            <ul className="space-y-1.5 text-zinc-300">
              {prediction.aiReasoning.map((reason, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Optimizations */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-2">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5">
              <Sliders className="w-4 h-4" /> Recommended Fine-tuning
            </span>
            <ul className="space-y-1.5 text-zinc-300">
              {prediction.optimizations.map((opt, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>{opt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

    </motion.div>
  );
};
