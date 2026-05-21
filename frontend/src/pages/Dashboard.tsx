import React from 'react';
import { PlayCircle, Activity, Award, BrainCircuit } from 'lucide-react';
import './Dashboard.css';

export const Dashboard = () => {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Welcome back, <span className="text-gradient">Seeker</span></h1>
          <p className="subtitle">Ready to synchronize your brain today?</p>
        </div>
        <button className="glow-btn">
          <PlayCircle size={20} />
          Start Session
        </button>
      </header>

      <section className="stats-grid">
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ color: 'var(--primary)' }}>
            <Activity size={24} />
          </div>
          <div className="stat-info">
            <h3>Synapse Count</h3>
            <p className="glow-text">14,230</p>
          </div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ color: 'var(--secondary)' }}>
            <Award size={24} />
          </div>
          <div className="stat-info">
            <h3>Active Streak</h3>
            <p className="glow-text">12 Days</p>
          </div>
        </div>
      </section>

      <section className="content-area glass-panel">
        <h2>Recent Neural Pathways</h2>
        <div className="empty-state">
          <BrainCircuit size={48} className="text-gradient mb-3" style={{ opacity: 0.5 }} />
          <p>No active sessions found. Start a session to build pathways.</p>
        </div>
      </section>
    </div>
  );
};
