import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { ChatbotPage } from './pages/ChatbotPage';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#F8F5F0] text-[#3B342E] selection:bg-[#C7D2C1] selection:text-[#3B342E]">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/chat" element={<ChatbotPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

