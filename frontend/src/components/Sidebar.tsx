import { NavLink } from 'react-router-dom';
import { BrainCircuit, BookOpen, LogOut, MessageSquareText, User } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import './Sidebar.css';

export const Sidebar = () => {
  const { logout, user } = useAuth();

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        <BrainCircuit className="logo-icon text-gradient" size={32} />
        <h2 className="text-gradient">Brain-Sync</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/study" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <BookOpen size={20} />
          <span>Study</span>
        </NavLink>
        <NavLink to="/chat" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <MessageSquareText size={20} />
          <span>AI Chat</span>
        </NavLink>
        <NavLink to="/profile" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <User size={20} />
          <span>Profile</span>
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <span>{user.display_name}</span>
            <small>{user.email}</small>
          </div>
        )}
        <button className="nav-item" onClick={logout}>
          <LogOut size={20} />
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
};
