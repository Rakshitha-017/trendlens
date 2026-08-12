import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Compass,
  LayoutDashboard,
  Layers,
  MessageSquare,
  Sparkles,
  BarChart3,
  BookOpen,
  Info,
  Zap,
  ChevronRight,
  ShieldCheck,
  Flame
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
  const navItems = [
    { label: 'Overview', path: '/', icon: Compass, badge: 'Home' },
    { label: 'AI Chatbot', path: '/chat', icon: MessageSquare, badge: 'Gemini' },
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, badge: 'Live' },
    { label: 'Cluster Explorer', path: '/clusters', icon: Layers, badge: '124' },
    { label: 'AI Trend Query', path: '/query', icon: MessageSquare, badge: 'RAG' },
    { label: 'Prediction Model', path: '/prediction', icon: Sparkles, badge: 'ML' },
    { label: 'Analytics & Signals', path: '/analytics', icon: BarChart3 }
  ];

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-40 bg-zinc-950/95 border-r border-zinc-800/80 backdrop-blur-xl transition-all duration-300 flex flex-col ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Logo & Collapse Toggle */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-zinc-800/80">
        <NavLink to="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-purple-600/30 shrink-0">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyan-400 fill-cyan-400/20" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold text-lg text-white tracking-tight flex items-center gap-1.5">
                TrendLens
                <span className="text-[10px] bg-purple-950 text-purple-400 border border-purple-800 px-1.5 py-0.2 rounded-full">
                  AI
                </span>
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">Visual Intelligence</span>
            </div>
          )}
        </NavLink>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors shrink-0"
        >
          <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        <div className={`px-3 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider ${isCollapsed ? 'hidden' : 'block'}`}>
          Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-950/80 to-zinc-900 text-purple-300 border border-purple-700/50 shadow-md shadow-purple-950/40'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-purple-400' : 'text-zinc-400 group-hover:text-zinc-200'}`} />
                  {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
                  {!isCollapsed && item.badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-purple-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Active bar highlight */}
                  {isActive && (
                    <motion.div
                      layoutId="activeSideBarNav"
                      className="absolute left-0 top-2 bottom-2 w-1 bg-purple-500 rounded-r-full"
                    />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Footer Model Specs Badge */}
      {!isCollapsed && (
        <div className="p-3 m-3 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl text-xs space-y-2">
          <div className="flex items-center justify-between text-zinc-300 font-bold">
            <span className="flex items-center gap-1 text-[11px]">
              <Flame className="w-3.5 h-3.5 text-amber-400" /> Model Pipeline
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">Ready</span>
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            CLIP ViT-L/14 + HDBSCAN + Gemini 3.6 RAG Pipeline
          </p>
        </div>
      )}
    </aside>
  );
};
