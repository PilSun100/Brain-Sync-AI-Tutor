import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard } from './pages/Dashboard';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="study" element={<div style={{padding: 32}}><h2>Study Room</h2><p className="subtitle">Coming soon...</p></div>} />
          <Route path="profile" element={<div style={{padding: 32}}><h2>Profile</h2><p className="subtitle">Coming soon...</p></div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
