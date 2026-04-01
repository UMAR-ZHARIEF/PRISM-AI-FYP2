import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileBarChart, Settings, Bell, Menu, X, LogOut,
  Camera, UserCog, Search, ChevronDown, User, Video
} from 'lucide-react';
import { notifications } from '../data/mockData';
import './DashboardLayout.css';

const sidebarSections = [
  {
    label: 'Main',
    links: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/dashboard/camera', label: 'Live Camera', icon: Video },
    ]
  },
  {
    label: 'Management',
    links: [
      { path: '/dashboard/students', label: 'Students', icon: Users },
      { path: '/dashboard/reports', label: 'Reports', icon: FileBarChart },
    ]
  },
  {
    label: 'System',
    adminOnly: true,
    links: [
      { path: '/dashboard/admin', label: 'Admin Panel', icon: UserCog },
    ]
  },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [role] = useState('admin');
  const location = useLocation();
  const notifRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path.includes('students')) return 'Students';
    if (path.includes('reports')) return 'Reports';
    if (path.includes('admin')) return 'Admin Panel';
    if (path.includes('camera')) return 'Live Camera';
    return 'Dashboard';
  };

  return (
    <div className="dashboard-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo">
            <Camera size={24} />
            {sidebarOpen && <span>PRISM-AI</span>}
          </Link>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {sidebarSections.map(section => {
            if (section.adminOnly && role !== 'admin') return null;
            return (
              <div key={section.label} className="sidebar-section">
                {sidebarOpen && <span className="sidebar-section-label">{section.label}</span>}
                {section.links.map(link => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`sidebar-link ${location.pathname === link.path ? 'active' : ''}`}
                  >
                    <link.icon size={20} />
                    {sidebarOpen && <span>{link.label}</span>}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <Link to="/login" className="sidebar-link">
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </Link>
        </div>
      </aside>

      <div className={`dashboard-main ${sidebarOpen ? '' : 'expanded'}`}>
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              <Link to="/dashboard">Home</Link>
              <span>/</span>
              <span className="breadcrumb-current">{getPageTitle()}</span>
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-search">
              <Search size={16} />
              <input type="text" placeholder="Search..." />
            </div>

            <div className="topbar-dropdown" ref={notifRef}>
              <button className="topbar-btn" onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}>
                <Bell size={20} />
                <span className="notif-badge">{notifications.length}</span>
              </button>
              {notifOpen && (
                <div className="dropdown-panel notif-panel">
                  <div className="dropdown-header">
                    <h4>Notifications</h4>
                    <button className="text-btn">Mark all read</button>
                  </div>
                  <div className="dropdown-list">
                    {notifications.slice(0, 5).map(n => (
                      <div key={n.id} className={`dropdown-item notif-${n.type}`}>
                        <div className={`notif-dot dot-${n.type}`} />
                        <div>
                          <p>{n.message}</p>
                          <small>{n.time}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="dropdown-footer">
                    <Link to="/dashboard">View all notifications</Link>
                  </div>
                </div>
              )}
            </div>

            <div className="topbar-dropdown" ref={userRef}>
              <button className="topbar-user" onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}>
                <div className="avatar">AH</div>
                <div className="user-info">
                  <span className="user-name">Admin Hafiz</span>
                  <small>Administrator</small>
                </div>
                <ChevronDown size={14} />
              </button>
              {userMenuOpen && (
                <div className="dropdown-panel user-panel">
                  <Link to="/dashboard" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                    <User size={16} /> Profile
                  </Link>
                  <Link to="/dashboard/admin" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                    <Settings size={16} /> Settings
                  </Link>
                  <div className="dropdown-divider" />
                  <Link to="/login" className="dropdown-item text-danger" onClick={() => setUserMenuOpen(false)}>
                    <LogOut size={16} /> Logout
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          <Outlet />
        </main>

        <footer className="dashboard-footer">
          <p>PRISM-AI &copy; 2026 &mdash; Final Year Project, UniKL</p>
        </footer>
      </div>
    </div>
  );
}
