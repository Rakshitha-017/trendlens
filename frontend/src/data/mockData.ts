import { ClusterData, TrendItem, ChatMessage, StatMetric } from '../types';

export const STAT_METRICS: StatMetric[] = [
  {
    title: 'Total Visual Posts Indexed',
    value: '486,240',
    change: '+14.2% this week',
    isPositive: true,
    description: 'Scraped & processed across SMPD dataset',
    iconName: 'Image'
  },
  {
    title: 'Active Visual Clusters',
    value: '124',
    change: '+8 new clusters',
    isPositive: true,
    description: 'Grouped via CLIP + HDBSCAN',
    iconName: 'Layers'
  },
  {
    title: 'Emerging Micro-Trends',
    value: '18',
    change: '+22.5% velocity',
    isPositive: true,
    description: 'Growth rate > 150% 30-day delta',
    iconName: 'Zap'
  },
  {
    title: 'Prediction Accuracy (nMSE)',
    value: '0.084',
    change: '65.1% error drop vs baseline',
    isPositive: true,
    description: 'Normalized Mean Squared Error',
    iconName: 'Target'
  }
];

export const MOCK_CLUSTERS: ClusterData[] = [
  {
    id: 'cluster-01',
    clusterName: 'Ceramic Brutalism & Raw Clay',
    category: 'Architecture & Interior',
    representativeImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80',
    growth: 312,
    popularityScore: 94,
    postCount: 54200,
    clusterDensity: 0.89,
    topVisualFeatures: ['Raw Clay Textures', 'Unfinished Terracotta', 'Matte Earth Tones', 'Asymmetric Vases'],
    sampleImages: [
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1565182999561-18d7dc61c393?auto=format&fit=crop&w=600&q=80'
    ],
    blipCaption: 'a close up of hand-sculpted matte ceramic pottery with earthy textured surfaces on a neutral concrete table',
    timelineData: [
      { month: 'Jan', posts: 12000 },
      { month: 'Feb', posts: 18500 },
      { month: 'Mar', posts: 29000 },
      { month: 'Apr', posts: 38000 },
      { month: 'May', posts: 46000 },
      { month: 'Jun', posts: 54200 }
    ],
    relatedClusters: ['Nordic Japandi Minimalism', 'Biophilic Terrarium Living'],
    platforms: { tiktok: 45, instagram: 35, pinterest: 15, reddit: 5 }
  },
  {
    id: 'cluster-02',
    clusterName: 'Y2K Cyber-Futurism Chrome',
    category: 'Fashion & Apparel',
    representativeImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    growth: 245,
    popularityScore: 91,
    postCount: 89400,
    clusterDensity: 0.92,
    topVisualFeatures: ['Liquid Metallic Silver', 'Rimless Frameless Glasses', 'Holographic Vinyl', 'Neon Accents'],
    sampleImages: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=600&q=80'
    ],
    blipCaption: 'a futuristic portrait of a model wearing metallic silver metallic puffer jacket and rimless futuristic shades in a neon lit studio',
    timelineData: [
      { month: 'Jan', posts: 28000 },
      { month: 'Feb', posts: 41000 },
      { month: 'Mar', posts: 59000 },
      { month: 'Apr', posts: 72000 },
      { month: 'May', posts: 81000 },
      { month: 'Jun', posts: 89400 }
    ],
    relatedClusters: ['Subculture Techwear', 'Glitch Art CGI'],
    platforms: { tiktok: 55, instagram: 25, pinterest: 10, reddit: 10 }
  },
  {
    id: 'cluster-03',
    clusterName: 'Artisanal Espresso & Pour-over rituals',
    category: 'Food & Beverage',
    representativeImage: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
    growth: 185,
    popularityScore: 88,
    postCount: 62100,
    clusterDensity: 0.84,
    topVisualFeatures: ['Warm Latte Crema', 'Precision Gooseneck Kettles', 'Amber Glass Tumblers', 'Morning Sun Flare'],
    sampleImages: [
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80'
    ],
    blipCaption: 'aesthetic slow motion pour of steamed milk into espresso coffee cup with dramatic morning window lighting',
    timelineData: [
      { month: 'Jan', posts: 32000 },
      { month: 'Feb', posts: 39000 },
      { month: 'Mar', posts: 45000 },
      { month: 'Apr', posts: 51000 },
      { month: 'May', posts: 57000 },
      { month: 'Jun', posts: 62100 }
    ],
    relatedClusters: ['Slow Living Aesthetics', 'Matcha Ceremonial Rituals'],
    platforms: { tiktok: 35, instagram: 40, pinterest: 20, reddit: 5 }
  },
  {
    id: 'cluster-04',
    clusterName: 'Minimalist Transparent Tech Desk',
    category: 'Consumer Tech',
    representativeImage: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80',
    growth: 298,
    popularityScore: 93,
    postCount: 41800,
    clusterDensity: 0.91,
    topVisualFeatures: ['Clear Acrylic Mounts', 'Soft Ambient Light Strips', 'Custom Mechanical Keyboards', 'Monochrome Desks'],
    sampleImages: [
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=600&q=80'
    ],
    blipCaption: 'a clean minimalist desk setup with ultra-wide curved monitor, RGB backlight, custom coiled cable, and wooden accents',
    timelineData: [
      { month: 'Jan', posts: 14000 },
      { month: 'Feb', posts: 20000 },
      { month: 'Mar', posts: 27000 },
      { month: 'Apr', posts: 33000 },
      { month: 'May', posts: 38000 },
      { month: 'Jun', posts: 41800 }
    ],
    relatedClusters: ['Cyberpunk Workstations', 'Ergonomic Wooden Workspaces'],
    platforms: { tiktok: 30, instagram: 30, pinterest: 20, reddit: 20 }
  },
  {
    id: 'cluster-05',
    clusterName: 'Biophilic Botanical Living Spaces',
    category: 'Aesthetics & Lifestyle',
    representativeImage: 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?auto=format&fit=crop&w=800&q=80',
    growth: 160,
    popularityScore: 86,
    postCount: 78900,
    clusterDensity: 0.82,
    topVisualFeatures: ['Trailing Monstera Vines', 'Natural Linen Fabrics', 'Sun-drenched Oak Wood', 'Terracotta Pots'],
    sampleImages: [
      'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=600&q=80'
    ],
    blipCaption: 'bright sunlit living room filled with indoor green monstera plants, rattan furniture, and cozy beige cushions',
    timelineData: [
      { month: 'Jan', posts: 45000 },
      { month: 'Feb', posts: 52000 },
      { month: 'Mar', posts: 61000 },
      { month: 'Apr', posts: 68000 },
      { month: 'May', posts: 73000 },
      { month: 'Jun', posts: 78900 }
    ],
    relatedClusters: ['Ceramic Brutalism & Raw Clay', 'Eco Zero-Waste Design'],
    platforms: { tiktok: 25, instagram: 45, pinterest: 25, reddit: 5 }
  },
  {
    id: 'cluster-06',
    clusterName: 'Neomorphic 3D CGI Glass & Metal',
    category: 'Digital Art & CGI',
    representativeImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    growth: 380,
    popularityScore: 96,
    postCount: 38500,
    clusterDensity: 0.95,
    topVisualFeatures: ['Frosted Iridescent Glass', 'Smooth Fluid Curves', 'Volumetric Dispersion', 'Subsurface Scattering'],
    sampleImages: [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'
    ],
    blipCaption: 'abstract 3d digital artwork showing translucent iridescent glass shapes floating in dark violet space',
    timelineData: [
      { month: 'Jan', posts: 8000 },
      { month: 'Feb', posts: 14000 },
      { month: 'Mar', posts: 21000 },
      { month: 'Apr', posts: 28000 },
      { month: 'May', posts: 33000 },
      { month: 'Jun', posts: 38500 }
    ],
    relatedClusters: ['Y2K Cyber-Futurism Chrome', 'Generative Motion Design'],
    platforms: { tiktok: 40, instagram: 40, pinterest: 10, reddit: 10 }
  }
];

export const MOCK_TRENDS: TrendItem[] = [
  {
    id: 'trend-1',
    title: 'Ceramic Raw Clay Aesthetics',
    category: 'Architecture & Interior',
    description: 'A surge in raw, unglazed terracotta and brutalist handmade clay homeware driven by anti-mass-production sentiments.',
    representativeImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1565182999561-18d7dc61c393?auto=format&fit=crop&w=600&q=80'
    ],
    growthVelocity: 312,
    volumeIndex: 94,
    postCount: 54200,
    lifecycle: 'Surging',
    popularityScore: 94,
    sentiment: { positive: 88, neutral: 9, negative: 3 },
    platforms: { tiktok: 45, instagram: 35, pinterest: 15, reddit: 5 },
    trajectory: [
      { date: 'Jan', score: 22 },
      { date: 'Feb', score: 38 },
      { date: 'Mar', score: 55 },
      { date: 'Apr', score: 71 },
      { date: 'May', score: 86 },
      { date: 'Jun', score: 94 },
      { date: 'Jul (F)', score: 98, forecast: true },
      { date: 'Aug (F)', score: 100, forecast: true }
    ],
    keyDrivers: ['Search volume spike for handmade pottery', 'Architectural Digest feature', 'TikTok pottery vlog trends'],
    blipCaption: 'handmade ceramic vases in earth tones on raw oak shelf',
    clipEmbeddingVectorPreview: '0.042, -0.128, 0.891, 0.334, -0.512, 0.201...',
    targetDemographics: 'Gen-Z & Millennials (Ages 22-38) seeking organic wabi-sabi home decor',
    opportunityInsight: 'Boutique homeware brands can release limited-edition unglazed tableware collections to achieve 3.4x higher organic conversion.',
    tags: ['Clay', 'WabiSabi', 'HomeDecor', 'Artisanal']
  },
  {
    id: 'trend-2',
    title: 'Chrome Y2K Metallic Fashion',
    category: 'Fashion & Apparel',
    description: 'High-contrast liquid metal finishes, rimless futuristic sunglasses, and holographic outer shells dominating streetwear posts.',
    representativeImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=600&q=80'
    ],
    growthVelocity: 245,
    volumeIndex: 91,
    postCount: 89400,
    lifecycle: 'Surging',
    popularityScore: 91,
    sentiment: { positive: 82, neutral: 12, negative: 6 },
    platforms: { tiktok: 55, instagram: 25, pinterest: 10, reddit: 10 },
    trajectory: [
      { date: 'Jan', score: 30 },
      { date: 'Feb', score: 45 },
      { date: 'Mar', score: 62 },
      { date: 'Apr', score: 78 },
      { date: 'May', score: 88 },
      { date: 'Jun', score: 91 },
      { date: 'Jul (F)', score: 93, forecast: true },
      { date: 'Aug (F)', score: 95, forecast: true }
    ],
    keyDrivers: ['Festival season wardrobe styling', 'K-Pop idol stage outfits', '3D silver accessory renders'],
    blipCaption: 'model wearing reflective silver metallic coat with futuristic cyberpunk styling',
    clipEmbeddingVectorPreview: '0.118, 0.442, -0.091, 0.772, -0.104, 0.655...',
    targetDemographics: 'Gen-Z streetwear enthusiasts (Ages 16-28)',
    opportunityInsight: 'Footwear and handbag labels should incorporate metallic hardware and high-shine silver foils for Autumn collections.',
    tags: ['Y2K', 'Cyberpunk', 'Metallic', 'Streetwear']
  },
  {
    id: 'trend-3',
    title: 'Tactile Transparent Desk Setups',
    category: 'Consumer Tech',
    description: 'Transparent acrylic monitor stands, custom mechanical keyboards with clear keycaps, and warm ambient neon accents.',
    representativeImage: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=600&q=80'
    ],
    growthVelocity: 298,
    volumeIndex: 93,
    postCount: 41800,
    lifecycle: 'Emerging',
    popularityScore: 93,
    sentiment: { positive: 91, neutral: 7, negative: 2 },
    platforms: { tiktok: 30, instagram: 30, pinterest: 20, reddit: 20 },
    trajectory: [
      { date: 'Jan', score: 18 },
      { date: 'Feb', score: 32 },
      { date: 'Mar', score: 49 },
      { date: 'Apr', score: 68 },
      { date: 'May', score: 84 },
      { date: 'Jun', score: 93 },
      { date: 'Jul (F)', score: 97, forecast: true },
      { date: 'Aug (F)', score: 100, forecast: true }
    ],
    keyDrivers: ['Work-from-home aesthetic upgrades', 'Keyboard modding community viral videos', 'Tech YouTuber desk tours'],
    blipCaption: 'clean desktop setup with mechanical keyboard transparent keycaps and ambient light bar',
    clipEmbeddingVectorPreview: '-0.301, 0.812, 0.104, -0.228, 0.490, 0.088...',
    targetDemographics: 'Remote developers, designers, and gamers (Ages 20-35)',
    opportunityInsight: 'Accessory makers can bundle transparent desk mats with RGB ambient edge lighting for high-margin tech desk setups.',
    tags: ['DeskSetup', 'MechanicalKeyboards', 'TechAesthetics', 'Workspace']
  }
];

export const MOCK_CHAT_SEED: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'assistant',
    content: "Welcome to **TrendLens AI Assistant**! Powered by CLIP multimodal embeddings and Gemini RAG, I can search over **486,000 indexed social media posts** to answer questions about emerging visual aesthetics, color palettes, engagement predictions, and cultural trends.\n\nTry asking me about:\n- *What visual themes are surging in Gen-Z fashion?*\n- *Explain why raw clay ceramics are going viral on TikTok.*\n- *Compare engagement rates between Y2K Chrome and Biophilic interior design.*",
    timestamp: '10:00 AM'
  }
];

export const MOCK_RAG_RESPONSES: Record<string, ChatMessage> = {
  fashion: {
    id: 'resp-fashion',
    sender: 'assistant',
    content: "### 🚀 Visual Trend Analysis: Gen-Z Metallic Streetwear & Y2K Chrome\n\nBased on vector similarity search over **89,400 indexed posts** across TikTok and Instagram:\n\n1. **Core Aesthetic Drivers**:\n   - High-shine silver foils and liquid chrome outerwear account for **62% of high-engagement streetwear posts**.\n   - Rimless futuristic sunglasses and metallic hardware accents exhibit a **245% growth velocity** over the past 90 days.\n\n2. **RAG Context Retrieval**:\n   - Cluster ID `#cluster-02` (*Y2K Cyber-Futurism Chrome*) shows peak engagement between 6 PM - 10 PM on TikTok.\n   - BLIP-2 captions highlight key descriptors: `liquid metal finish`, `frameless tinted shades`, and `neon ambient studio lighting`.\n\n3. **Actionable Brand Insight**:\n   - Brands adopting chrome foil accents in early autumn collections see a **+38% higher click-through rate** in visual ad campaigns.",
    timestamp: '10:02 AM',
    retrievedClusters: [MOCK_CLUSTERS[1]],
    supportingImages: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80'
    ],
    citationSource: 'FAISS Index (SMPD Dataset, N=89,400)',
    ragConfidence: 96.4
  },
  ceramic: {
    id: 'resp-ceramic',
    sender: 'assistant',
    content: "### 🏺 Research Insight: The Rise of Brutalist Ceramic Raw Clay\n\nRetrieval augmented generation retrieved **54,200 posts** matching raw clay and unglazed pottery aesthetics (`cluster-01`).\n\n1. **Why It Is Surging**:\n   - Consumers are favoring **anti-mass-production wabi-sabi aesthetics**.\n   - Posts showcasing the hand-sculpting process garner **3.2x higher comment volume** than polished factory products.\n\n2. **Color Palette Analysis**:\n   - Hex Palette: `#8C6247` (Raw Terracotta), `#D9CBBF` (Matte Sand), `#3E3B38` (Smoked Charcoal).\n   - **Silhouette Score**: 0.742 (High cluster cohesion).\n\n3. **Predicted Horizon**:\n   - Forecast models predict peak saturation in August 2026, making this an ideal window for boutique homeware product launches.",
    timestamp: '10:05 AM',
    retrievedClusters: [MOCK_CLUSTERS[0]],
    supportingImages: [
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80'
    ],
    citationSource: 'HDBSCAN Cluster #1 & Gemini 3.6 RAG',
    ragConfidence: 94.8
  }
};
