import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Sparkles, Image as ImageIcon, Flame, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { PredictionResult } from '../types';
import { PredictionCard } from '../components/ui/PredictionCard';
import { Button } from '../components/ui/Button';

export const PredictionPage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(
    'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80'
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>({
    imageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80',
    predictedLikes: 48200,
    predictedComments: 3140,
    popularityScore: 94,
    confidenceScore: 96.2,
    aestheticCategory: 'Architecture & Interior',
    dominantColorPalette: ['#8C6247', '#D9CBBF', '#3E3B38', '#E6DFD5'],
    detectedVisualFeatures: ['Raw Clay', 'Matte Terracotta', 'Handcrafted Vases', 'Soft Natural Light'],
    clipSimilarityScore: 0.942,
    matchedClusterName: 'Ceramic Brutalism & Raw Clay',
    aiReasoning: [
      'High aesthetic alignment with Cluster #01 (0.942 CLIP cosine similarity)',
      'Natural warm sunlight and organic earth tones drive +240% engagement on Pinterest & TikTok',
      'Textured matte finish matches anti-mass-production consumer preferences'
    ],
    optimizations: [
      'Pair with warm ambient acoustic background audio to boost completion rate by 18%',
      'Include hashtags #WabiSabiPottery and #RawClayVase to target high-intent search traffic'
    ]
  });

  const samplePresets = [
    {
      title: 'Raw Clay Vases',
      url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=600&q=80'
    },
    {
      title: 'Y2K Cyber Jacket',
      url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80'
    },
    {
      title: 'Artisanal Coffee',
      url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80'
    },
    {
      title: 'Tactile Tech Desk',
      url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80'
    }
  ];

  const handleRunPrediction = (imgUrl: string) => {
    setSelectedImage(imgUrl);
    setIsAnalyzing(true);
    setPrediction(null);

    // Simulate CLIP feature extraction & Regression model inference
    setTimeout(() => {
      const isY2K = imgUrl.includes('1515886657613');
      const isCoffee = imgUrl.includes('1514432324607');
      const isDesk = imgUrl.includes('1527443224154');

      setPrediction({
        imageUrl: imgUrl,
        predictedLikes: isY2K ? 82400 : isCoffee ? 38900 : isDesk ? 52100 : 48200,
        predictedComments: isY2K ? 6120 : isCoffee ? 2100 : isDesk ? 3800 : 3140,
        popularityScore: isY2K ? 91 : isCoffee ? 88 : isDesk ? 93 : 94,
        confidenceScore: 95.8,
        aestheticCategory: isY2K ? 'Fashion & Apparel' : isCoffee ? 'Food & Beverage' : isDesk ? 'Consumer Tech' : 'Architecture & Interior',
        dominantColorPalette: isY2K
          ? ['#C0C0C0', '#1A1A1A', '#00F0FF', '#E0E0E0']
          : isCoffee
          ? ['#4A2E1B', '#D4A373', '#FAEDCD', '#28180E']
          : ['#121212', '#2A2A2A', '#06B6D4', '#7C3AED'],
        detectedVisualFeatures: isY2K
          ? ['Liquid Silver', 'Frameless Shades', 'Puffer Jacket', 'Studio Lighting']
          : isCoffee
          ? ['Latte Art Crema', 'Gooseneck Kettle', 'Morning Sunlight', 'Amber Glass']
          : ['Custom Mechanical Keyboard', 'Transparent Acrylic', 'RGB Lightbar', 'Curved Monitor'],
        clipSimilarityScore: 0.938,
        matchedClusterName: isY2K
          ? 'Y2K Cyber-Futurism Chrome'
          : isCoffee
          ? 'Artisanal Espresso & Pour-over'
          : 'Minimalist Transparent Tech Desk',
        aiReasoning: [
          'Strong visual correlation with viral social media posts in the past 30 days',
          'Color saturation and lighting contrast meet high-engagement thresholds for TikTok algorithm',
          'High visual feature cohesion score (0.912)'
        ],
        optimizations: [
          'Post between 6:00 PM and 9:00 PM for maximum initial velocity',
          'Include relevant trending soundtrack in video format'
        ]
      });

      setIsAnalyzing(false);
    }, 1500);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-fadeIn">
      
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Popularity Regression Model (nMSE 0.084)
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Visual Popularity Predictor</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Upload any visual media to extract CLIP feature vectors and predict viral post engagement before publishing.
        </p>
      </div>

      {/* Upload Zone & Sample Preset Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left: Drag & Drop Zone (7 cols) */}
        <div className="md:col-span-7 glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4 flex flex-col justify-between">
          <div className="border-2 border-dashed border-zinc-700/80 hover:border-purple-500/80 rounded-2xl p-8 text-center space-y-3 cursor-pointer transition-colors bg-zinc-950/50">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-800 text-purple-400 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Drag & drop image file or click to browse</h3>
              <p className="text-xs text-zinc-400 mt-1">Supports PNG, JPG, WebP up to 10MB</p>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-400 block">Or test with preset sample images:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {samplePresets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRunPrediction(preset.url)}
                  className={`p-1.5 rounded-xl border text-left flex flex-col items-center gap-1 transition-all ${
                    selectedImage === preset.url
                      ? 'bg-purple-950/90 border-purple-500 shadow-md shadow-purple-950'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <img src={preset.url} alt={preset.title} className="w-full h-14 rounded-lg object-cover" />
                  <span className="text-[10px] font-bold text-zinc-300 truncate w-full text-center">
                    {preset.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Selected Image Preview Card (5 cols) */}
        <div className="md:col-span-5 glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-zinc-400 block mb-2">Image Preview</span>
            {selectedImage ? (
              <div className="h-52 rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 relative">
                <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-52 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 text-xs">
                No image selected
              </div>
            )}
          </div>

          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            isLoading={isAnalyzing}
            disabled={!selectedImage || isAnalyzing}
            icon={<Sparkles className="w-4 h-4" />}
            onClick={() => selectedImage && handleRunPrediction(selectedImage)}
          >
            {isAnalyzing ? 'Extracting CLIP Vectors...' : 'Predict Popularity Score'}
          </Button>
        </div>

      </div>

      {/* Prediction Output Results */}
      {isAnalyzing && (
        <div className="glass-panel rounded-3xl p-8 text-center space-y-3 border border-purple-500/40">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <h3 className="text-base font-bold text-white">Running CLIP Latent Feature Extraction...</h3>
          <p className="text-xs text-zinc-400">Computing 768-dim similarity against 124 cluster centroids & regression model</p>
        </div>
      )}

      {prediction && !isAnalyzing && (
        <PredictionCard prediction={prediction} />
      )}

    </div>
  );
};
