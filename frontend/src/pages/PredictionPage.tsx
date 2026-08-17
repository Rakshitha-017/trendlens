import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, Layers } from 'lucide-react';
import { api } from '../services/apiClient';
import { ClusterData, PredictionResult } from '../types';
import { PredictionCard } from '../components/ui/PredictionCard';
import { Button } from '../components/ui/Button';

export const PredictionPage: React.FC = () => {
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .clusters()
      .then((res) => {
        if (!cancelled) {
          setClusters(res.clusters);
          setSelectedClusterId(res.clusters[0]?.cluster_id ?? null);
        }
      })
      .catch(() => {
        if (!cancelled)
          setError('Could not reach the TrendLens backend — start it with `python -m src.api` and reload.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = clusters.find((c) => c.cluster_id === selectedClusterId) ?? null;

  const handleRunPrediction = () => {
    if (!selected) return;
    setPrediction({
      clusterId: selected.cluster_id,
      observedMeanEngagement: selected.average_engagement,
      observedPostCount: selected.n_posts,
      lifecycle: selected.lifecycle,
      predictedLikes: null,
      predictedComments: null,
      predictedTotalEngagement: null,
      nMseScore: null,
      status: 'NOT EVALUATED',
      note: 'No forward popularity model is implemented. The panel below shows only OBSERVED statistics from the real index.',
      imageUrl: selected.representative_image_url ?? undefined,
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-fadeIn">
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Popularity Prediction — NOT EVALUATED (observed cluster stats only)
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Visual Popularity Predictor</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          No forward-looking engagement model exists in this build. Pick a visual cluster to inspect its{' '}
          <span className="text-cyan-400 font-semibold">observed</span> engagement statistics from the real index.
        </p>
      </div>

      {error && (
        <div className="glass-panel rounded-2xl p-4 border border-amber-800/60 text-xs text-amber-300">{error}</div>
      )}

      {/* Cluster Selector + Preview */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Cluster picker (7 cols) */}
        <div className="md:col-span-7 glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-zinc-400 block mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" /> Choose a visual cluster ({clusters.length} available)
            </span>
            {clusters.length === 0 && !error ? (
              <p className="text-xs text-zinc-500 py-8 text-center">Loading clusters…</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                {clusters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClusterId(c.cluster_id)}
                    className={`p-1.5 rounded-xl border text-left flex flex-col items-center gap-1 transition-all ${
                      selectedClusterId === c.cluster_id
                        ? 'bg-purple-950/90 border-purple-500 shadow-md shadow-purple-950'
                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {c.representative_image_url ? (
                      <img
                        src={c.representative_image_url}
                        alt={c.name}
                        className="w-full h-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-full h-14 rounded-lg bg-zinc-950 flex items-center justify-center text-[10px] text-zinc-700">
                        no image
                      </div>
                    )}
                    <span className="text-[10px] font-bold text-zinc-300 truncate w-full text-center">
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected cluster + run (5 cols) */}
        <div className="md:col-span-5 glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-zinc-400 block mb-2">Selected Cluster</span>
            {selected ? (
              <div className="space-y-2">
                <div className="h-40 rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800">
                  {selected.representative_image_url ? (
                    <img src={selected.representative_image_url} alt={selected.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">
                      no representative image
                    </div>
                  )}
                </div>
                <p className="text-sm font-bold text-white line-clamp-1">{selected.name}</p>
                <p className="text-xs text-zinc-400 italic line-clamp-2">"{selected.blip_caption}"</p>
                <p className="text-[11px] text-zinc-500">
                  Cluster #{selected.cluster_id} · {selected.lifecycle ?? 'lifecycle n/a'}
                </p>
              </div>
            ) : (
              <div className="h-40 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 text-xs">
                {error ? 'Backend unavailable' : 'Loading…'}
              </div>
            )}
          </div>

          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={!selected}
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={handleRunPrediction}
          >
            Inspect Observed Stats
          </Button>
        </div>
      </div>

      {/* Prediction Output Results */}
      {prediction && <PredictionCard prediction={prediction} />}
    </div>
  );
};
