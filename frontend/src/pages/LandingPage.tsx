import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-6 py-12 bg-[#F8F5F0] overflow-hidden select-none">
      
      {/* Subtle organic background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#E8DFD3]/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#C7D2C1]/20 rounded-full blur-2xl pointer-events-none" />

      {/* Hero Container */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-2xl text-center space-y-8"
      >
        {/* Logo / Project Name */}
        <div className="inline-block">
          <span className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#3B342E]">
            TrendLens
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-serif text-4xl sm:text-6xl font-normal tracking-tight text-[#3B342E] leading-[1.15]">
          Discover visual trends through conversation.
        </h1>

        {/* Supporting Text */}
        <p className="text-base sm:text-lg text-[#7A736C] font-normal leading-relaxed max-w-xl mx-auto tracking-normal">
          Understand what’s catching people’s attention, explore emerging aesthetics, and uncover patterns behind visual content through simple conversations.
        </p>

        {/* Primary Button */}
        <div className="pt-2">
          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate('/chat')}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#8A6A4A] hover:bg-[#73553A] text-[#FFFCF8] text-sm font-medium tracking-wide shadow-sm transition-all duration-200 cursor-pointer"
          >
            Start Exploring
            <span className="text-base leading-none">→</span>
          </motion.button>
        </div>
      </motion.div>

    </div>
  );
};
