import { ClusterData, PredictionResult, TrendItem } from '../types';

export interface HealthResponse {
  status: string;
  service: string;
  clustersAnalyzed: number;
  totalClustersAnalyzed: number;
  dataset: string;
  timestamps: string;
  mode: string;
  llmEnabled: boolean;
  timestamp: string;
}

export interface RAGQueryResponse {
  query: string;
  answer: string;
  inScope: boolean;
  scopeReason: string | null;
  scopeMethod: 'keywords' | 'anchors' | 'fallback';
  retrievedClusters: ClusterData[];
  supportingImages: string[];
  totalClustersAnalyzed: number;
  disclaimer: string;
  sources: string[];
  mode: string;
  timestamp: string;
}

export interface TrendsResponse {
  trends: TrendItem[];
  disclaimer: string;
}

export interface ClustersResponse {
  clusters: ClusterData[];
  disclaimer: string;
}

export interface LiveTrend {
  name: string;
  keywords: string[];
  keywords_emoji: string;
  blip_caption: string;
  subreddits: string[];
  channel_label: string;
  source: string;
  has_engagement: boolean;
  n_posts: number;
  recent_posts: number;
  prior_posts: number;
  growth_rate: number | null;
  avg_engagement: number;
  total_comments: number;
  representative_image_url: string;
  representative_post: string;
  replicate: string;
}

export interface LiveTrendsResponse {
  disclaimer: string;
  generated_at: string;
  source: string;
  subreddits: string[];
  recent_window_days: number;
  n_posts: number;
  n_themes: number;
  themes: LiveTrend[];
  error?: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`TrendLens API ${res.status} on ${url}`);
  }
  return res.json() as Promise<T>;
}

/**
 * TrendLens API client — FAISS cluster retrieval backend, optional LLM
 * writing layer (env opt-in), real live-trend endpoint.
 * All endpoints are proxied to the Python backend (:8000) by the
 * frontend's Express server (:3000).
 */
export const api = {
  health: () => request<HealthResponse>('/api/health'),

  trends: () => request<TrendsResponse>('/api/trends'),

  clusters: () => request<ClustersResponse>('/api/clusters'),

  liveTrends: () => request<LiveTrendsResponse>('/api/live-trends'),

  ragQuery: (query: string, k = 5) =>
    request<RAGQueryResponse>('/api/rag-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, k }),
    }),

  predict: (clusterId: number) =>
    request<PredictionResult>('/api/predict-popularity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clusterId }),
    }),
};
