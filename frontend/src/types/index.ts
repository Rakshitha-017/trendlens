export type TrendCategory =
  | 'Fashion & Apparel'
  | 'Aesthetics & Lifestyle'
  | 'Consumer Tech'
  | 'Architecture & Interior'
  | 'Food & Beverage'
  | 'Digital Art & CGI';

export type TrendLifecycle =
  | 'Emerging'
  | 'Surging'
  | 'Peak'
  | 'Maturing'
  | 'Early Growth'
  | 'Maturity / Evergreen'
  | 'Fading';

export interface PlatformDistribution {
  tiktok: number;
  instagram: number;
  pinterest: number;
  reddit: number;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface TrajectoryPoint {
  date: string;
  score: number;
  forecast?: boolean;
}

export interface TrendItem {
  id: string;
  title: string;
  category: TrendCategory;
  description: string;
  representativeImage: string;
  galleryImages?: string[];
  growthVelocity: number;
  volumeIndex?: number;
  postCount: number;
  lifecycle: TrendLifecycle;
  popularityScore: number;
  sentiment?: SentimentBreakdown;
  platforms?: PlatformDistribution;
  trajectory?: TrajectoryPoint[];
  keyDrivers: string[];
  blipCaption?: string;
  clipEmbeddingVectorPreview?: string;
  targetDemographics?: string;
  opportunityInsight?: string;
  tags?: string[];
}

export interface ClusterData {
  id: string;
  clusterName: string;
  category: TrendCategory;
  representativeImage: string;
  growth: number;
  popularityScore: number;
  postCount: number;
  clusterDensity: number;
  topVisualFeatures: string[];
  sampleImages: string[];
  blipCaption: string;
  timelineData: { month: string; posts: number }[];
  relatedClusters: string[];
  platforms: PlatformDistribution;
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

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: AttachedFile[];
  audioUrl?: string;
  retrievedClusters?: ClusterData[];
  supportingImages?: string[];
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
  imageUrl?: string;
  predictedLikes: number;
  predictedComments: number;
  popularityScore: number;
  confidenceScore: number;
  aestheticCategory: string;
  dominantColorPalette: string[];
  detectedVisualFeatures: string[];
  clipSimilarityScore: number;
  matchedClusterName: string;
  aiReasoning: string[];
  optimizations: string[];
}

export interface StatMetric {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  description: string;
  iconName: string;
}
