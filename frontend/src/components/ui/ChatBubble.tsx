import React from 'react';
import Markdown from 'react-markdown';
import { Bot, User, Sparkles, BookOpen, Layers, ExternalLink } from 'lucide-react';
import { ChatMessage } from '../../types';
import { Badge } from './Badge';

interface ChatBubbleProps {
  message: ChatMessage;
  onClusterClick?: (clusterId: string) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onClusterClick }) => {
  const isAssistant = message.sender === 'assistant';

  return (
    <div
      className={`flex gap-3 sm:gap-4 ${
        isAssistant ? 'items-start' : 'items-start flex-row-reverse'
      }`}
    >
      {/* Avatar Icon */}
      <div
        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
          isAssistant
            ? 'bg-gradient-to-tr from-purple-600 to-cyan-500 text-white shadow-purple-600/30'
            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
        }`}
      >
        {isAssistant ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
      </div>

      {/* Message Content Body */}
      <div
        className={`max-w-3xl space-y-4 rounded-3xl p-5 text-sm leading-relaxed border shadow-xl ${
          isAssistant
            ? 'bg-zinc-900/90 border-zinc-800 text-zinc-100'
            : 'bg-purple-600/90 text-white border-purple-500/50'
        }`}
      >
        {/* Top Header metadata */}
        <div className="flex items-center justify-between text-xs opacity-70 border-b border-white/10 pb-2">
          <span className="font-bold flex items-center gap-1">
            {isAssistant ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                TrendLens Gemini 3.6 RAG
              </>
            ) : (
              'You'
            )}
          </span>
          <span>{message.timestamp}</span>
        </div>

        {/* Text Content */}
        <div className="prose prose-invert prose-xs max-w-none space-y-2">
          <Markdown>{message.content}</Markdown>
        </div>

        {/* Supporting Images Grid if present */}
        {message.supportingImages && message.supportingImages.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-zinc-800/80">
            <span className="text-xs font-bold text-zinc-400 block">Retrieved Visual Matches</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {message.supportingImages.map((img, i) => (
                <div key={i} className="h-28 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                  <img src={img} alt="Visual match" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Retrieved Cluster Card if present */}
        {message.retrievedClusters && message.retrievedClusters.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-zinc-800/80">
            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Context Vector Cluster Retrieved
            </span>
            <div className="grid grid-cols-1 gap-2">
              {message.retrievedClusters.map((cluster) => (
                <div
                  key={cluster.id}
                  onClick={() => onClusterClick && onClusterClick(cluster.id)}
                  className="bg-zinc-950 border border-zinc-800 hover:border-purple-500/60 p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={cluster.representativeImage}
                      alt={cluster.clusterName}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-white">{cluster.clusterName}</h4>
                      <p className="text-[11px] text-zinc-400">{cluster.category} • {cluster.postCount.toLocaleString()} posts</p>
                    </div>
                  </div>
                  <Badge variant="secondary" size="sm">
                    +{cluster.growth}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Citation & RAG Confidence Footer */}
        {message.citationSource && (
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1 font-mono">
              <BookOpen className="w-3 h-3 text-purple-400" /> {message.citationSource}
            </span>
            {message.ragConfidence && (
              <span className="text-emerald-400 font-bold">
                {message.ragConfidence}% Precision
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
