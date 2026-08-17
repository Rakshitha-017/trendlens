import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Bot, User, Lightbulb, TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import ReactMarkdown from 'react-markdown';

interface ClusterCard {
  id: string;
  cluster_id: number;
  name: string;
  blip_caption: string;
  characteristics: string[];
  similarityScore: number;
  n_posts: number | null;
  lifecycle: string | null;
  average_engagement: number | null;
  trend_score: number | null;
  representative_image_url: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  inScope?: boolean;
  clusters?: ClusterCard[];
  supportingImages?: string[];
  totalAnalyzed?: number;
  timestamp: string;
}

const LIFECYCLE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  Rising:    { icon: <TrendingUp className="w-3 h-3" />,   color: 'text-emerald-400', bg: 'bg-emerald-950/60 border-emerald-800/50' },
  Stable:    { icon: <Minus className="w-3 h-3" />,        color: 'text-blue-400',    bg: 'bg-blue-950/60 border-blue-800/50' },
  Declining: { icon: <TrendingDown className="w-3 h-3" />, color: 'text-rose-400',    bg: 'bg-rose-950/60 border-rose-800/50' },
};

const SUGGESTED_PROMPTS = [
  'I am a food influencer posting a pasta bowl. What are the current trending styles in food photography to get max engagement?',
  'What rising visual aesthetics in nature photography are getting high engagement right now?',
  'What background, lighting and colour palette is trending for fashion content creators?',
  'What are the most viral visual styles in nightlife and street photography?',
];

export const TrendQueryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isGenerating]);
  useEffect(() => { if (initialQuery.trim()) handleSend(initialQuery.trim()); }, []);

  const handleSend = async (queryText: string) => {
    if (!queryText.trim() || isGenerating) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsGenerating(true);

    try {
      const res = await fetch('/api/rag-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });
      const data = await res.json();

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'No response from TrendLens.',
        inScope: data.inScope,
        clusters: data.retrievedClusters || [],
        supportingImages: data.supportingImages || [],
        totalAnalyzed: data.totalClustersAnalyzed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: '⚠️ Could not reach the TrendLens API. Make sure the server is running.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> FAISS Cluster Intelligence · No LLM · Social Trends Only
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">TrendLens Visual Intelligence</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Answers grounded in real CLIP cluster analysis of 5,000 sampled images (69,226 available). Ask about visual styles, photography strategy, and engagement trends — <span className="text-amber-400 font-semibold">social media topics only.</span>
        </p>
      </div>

      {/* Suggested Prompts */}
      <div className="flex flex-wrap gap-2 justify-center">
        {SUGGESTED_PROMPTS.map((p, i) => (
          <button key={i} onClick={() => handleSend(p)} disabled={isGenerating}
            className="text-xs px-3 py-1.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors flex items-center gap-1.5 max-w-xs text-left">
            <Lightbulb className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="line-clamp-1">{p}</span>
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/60 backdrop-blur p-4 sm:p-6 space-y-6 min-h-[500px] max-h-[680px] overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-600 gap-3">
            <Bot className="w-12 h-12 opacity-30" />
            <p className="text-sm">Ask TrendLens anything about visual content strategy</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-purple-900/80 border border-purple-700/50 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-purple-300" />
                </div>
              )}

              <div className={`max-w-[85%] space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                {/* Bubble */}
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-purple-900/70 border border-purple-700/50 text-white'
                    : 'bg-zinc-900/80 border border-zinc-800 text-zinc-100'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>

                {/* Supporting images from the retrieved clusters */}
                {msg.supportingImages && msg.supportingImages.length > 0 && (
                  <div className="w-full">
                    <p className="text-xs text-zinc-500 font-medium mb-1.5">
                      🖼️ Representative images
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {msg.supportingImages.slice(0, 6).map((img, i) => (
                        <div key={i} className="h-20 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
                          <img src={img} alt="Visual match" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Real cluster cards */}
                {msg.clusters && msg.clusters.length > 0 && (
                  <div className="w-full space-y-2">
                    <p className="text-xs text-zinc-500 font-medium">
                      📡 Retrieved {msg.clusters.length} clusters from FAISS database
                      {msg.totalAnalyzed ? ` (of ${msg.totalAnalyzed} analyzed)` : ''}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.clusters.map(c => {
                        const lc = LIFECYCLE_CONFIG[c.lifecycle ?? ''] || LIFECYCLE_CONFIG.Stable;
                        return (
                          <div key={c.id} className={`rounded-xl border p-3 space-y-1.5 text-xs ${lc.bg}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-zinc-200 line-clamp-1 flex-1">{c.name}</span>
                              <span className={`flex items-center gap-1 font-bold shrink-0 ${lc.color}`}>
                                {lc.icon} {c.lifecycle ?? 'n/a'}
                              </span>
                            </div>
                            {c.representative_image_url && (
                              <img
                                src={c.representative_image_url}
                                alt={c.name}
                                className="h-24 w-full rounded-lg object-cover"
                              />
                            )}
                            {c.blip_caption && (
                              <p className="text-zinc-400 italic line-clamp-2">"{c.blip_caption}"</p>
                            )}
                            {c.characteristics && c.characteristics.length > 0 && (
                              <p className="text-zinc-500">Features: {c.characteristics.slice(0, 4).join(', ')}</p>
                            )}
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-zinc-500">
                              <span className="flex items-center gap-1">
                                <BarChart2 className="w-3 h-3" />
                                {c.average_engagement?.toFixed(2) ?? '—'} avg eng
                              </span>
                              <span>Trend {c.trend_score?.toFixed(3) ?? '—'}</span>
                              <span>{(c.n_posts ?? 0).toLocaleString()} posts</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <span className="text-[10px] text-zinc-600">{msg.timestamp}</span>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-zinc-400" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isGenerating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-3 p-3 bg-zinc-900/80 rounded-2xl border border-zinc-800 w-fit">
            <Bot className="w-5 h-5 text-purple-400 animate-pulse" />
            <span className="text-xs text-zinc-300 font-medium animate-pulse">
              Searching FAISS index · Scoring clusters · Formatting trend brief...
            </span>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); handleSend(inputQuery); }} className="relative flex items-center">
        <input
          type="text"
          value={inputQuery}
          onChange={e => setInputQuery(e.target.value)}
          placeholder="e.g. 'I’m a food creator posting a pasta bowl — what trending styles get max engagement?'"
          disabled={isGenerating}
          className="w-full pl-5 pr-28 py-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 shadow-xl"
        />
        <Button type="submit" variant="gradient" size="sm"
          disabled={!inputQuery.trim() || isGenerating} className="absolute right-2"
          icon={<Send className="w-3.5 h-3.5" />}>
          Send
        </Button>
      </form>
    </div>
  );
};
