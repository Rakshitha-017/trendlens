import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { ChatbotPage } from './pages/ChatbotPage';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ClusterExplorerPage } from './pages/ClusterExplorerPage';
import { TrendQueryPage } from './pages/TrendQueryPage';
import { PredictionPage } from './pages/PredictionPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#F8F5F0] text-[#3B342E] selection:bg-[#C7D2C1] selection:text-[#3B342E]">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/chat" element={<ChatbotPage />} />
          <Route
            element={<Layout />}
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/clusters" element={<ClusterExplorerPage />} />
            <Route path="/query" element={<TrendQueryPage />} />
            <Route path="/prediction" element={<PredictionPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
