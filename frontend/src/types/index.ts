export type TrendLifecycle = 'Rising' | 'Stable' | 'Declining';

export interface ClusterData {
  id: string;
  cluster_id: number;
  name: string;
  description: string;
  characteristics: string[];
  confidence: number | null;
  blip_caption: string;
  n_posts: number | null;
  lifecycle: TrendLifecycle | null;
  average_engagement: number | null;
  recent_growth: number | null;
  trend_score: number | null;
  representative_image: string | null;
  representative_image_url: string | null;
}

export interface TrendItem {
  cluster_id: number;
  name: string;
  description: string;
  blip_caption: string;
  lifecycle: TrendLifecycle | null;
  n_posts: number;
  recent_growth: number;
  average_engagement: number;
  trend_score: number;
  representative_image_url: string | null;
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  fileObject?: File;
  previewUrl?: string;
  progress?: number;
  category: 'image' | 'document' | 'audio' | 'data';
}

export type ScopeMethod = 'keywords' | 'anchors' | 'fallback';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: AttachedFile[];
  audioUrl?: string;
  retrievedClusters?: ClusterData[];
  supportingImages?: string[];
  inScope?: boolean;
  scopeReason?: string | null;
  scopeMethod?: ScopeMethod | null;
  citationSource?: string;
  ragConfidence?: number;
  isStreaming?: boolean;
  status?: 'sending' | 'sent' | 'error';
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  pinned?: boolean;
  tags?: string[];
}

export type ThemeMode = 'light' | 'dark';

export interface PredictionResult {
  clusterId: number | null;
  observedMeanEngagement: number | null;
  observedPostCount: number | null;
  lifecycle: string | null;
  predictedLikes: number | null;
  predictedComments: number | null;
  predictedTotalEngagement: number | null;
  nMseScore: number | null;
  status: string;
  note: string;
  imageUrl?: string;
}

export interface StatMetric {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  description: string;
  iconName: string;
}
