import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { notifApi } from '../api/api';
import { formatDistanceToNow } from 'date-fns';

const pageTitles = {
  '/':           'Dashboard',
  '/analytics':  'Analytics',
  '/users':      'User Management',
  '/errors/new': 'New Error Report',
};

const IconBell     = ({ count }) => (
  <div style={{ position:'relative', display:'flex' }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
    {count > 0 && (
      <span style={{
        position:'absolute', top:-6, right:-6,
        background:'var(--red)', color:'white',
        fontSize:9, fontWeight:700, fontFamily:'var(--font-display)',
        borderRadius:100, minWidth:16, height:16,
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:'0 3px',
      }}>{count > 99 ? '99+' : count}</span>
    )}
  </div>
);

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3a8.9 8.9 0 0 0 0 18 9 9 0 0 0 8.6-6.2A7 7 0 0 1 12 3z" />
  </svg>
);

function typeIcon(type) {
  const icons = {
    assignment:       '👤',
    resolution_change:'🔄',
    comment:          '💬',
    mention:          '@',
  };
  return icons[type] || '📌';
}

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { notifCount, setNotifCount } = useAuth();
  const [open, setOpen]       = useState(false);
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(false);
  const dropRef               = useRef(null);
  const location              = useLocation();
  const navigate              = useNavigate();

  const title = pageTitles[location.pathname] ||
    (location.pathname.endsWith('/edit') ? 'Edit Error' : 'Error Detail');

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const r = await notifApi.list({ limit: 20 });
      setNotifs(r.data.notifications);
      setNotifCount(r.data.unreadCount);
    } finally {
      setLoading(false);
    }
  };

  const toggleDrop = () => {
    if (!open) fetchNotifs();
    setOpen(o => !o);
  };

  const markRead = async (id) => {
    await notifApi.read(id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, read_at: new Date().toISOString() } : x));
    setNotifCount(c => Math.max(0, c - 1));
  };

  const markAll = async () => {
    await notifApi.readAll();
    setNotifs(n => n.map(x => ({ ...x, read_at: new Date().toISOString() })));
    setNotifCount(0);
  };

  return (
    <header style={{
      height: 56, borderBottom:'1px solid var(--border)',
      display:'flex', alignItems:'center',
      padding:'0 24px',
      background:'var(--bg-surface)',
      position:'sticky', top:0, zIndex:100,
      gap: 12,
    }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:14, fontWeight:700, color:'var(--text-primary)', letterSpacing:'0.03em' }}>
        {title}
      </h1>

      <div style={{ flex:1 }} />

      <button
        onClick={toggleTheme}
        className="btn btn-ghost"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{ minWidth: 120, justifyContent: 'center', gap: 8 }}
      >
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </button>

      {/* Notification bell */}
      <div ref={dropRef} style={{ position:'relative' }}>
        <button
          onClick={toggleDrop}
          className="btn btn-ghost btn-icon"
          style={{ color: notifCount > 0 ? 'var(--accent)' : 'var(--text-secondary)' }}
        >
          <IconBell count={notifCount} />
        </button>

        {open && (
          <div style={{
            position:'absolute', right:0, top:'calc(100% + 8px)',
            width:340, background:'var(--bg-elevated)',
            border:'1px solid var(--border-light)',
            borderRadius:'var(--radius-lg)',
            boxShadow:'var(--shadow-lg)',
            zIndex:200,
            animation:'fadeIn 0.15s ease both',
            overflow:'hidden',
          }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, fontWeight:600 }}>Notifications</span>
              {notifCount > 0 && (
                <button onClick={markAll} className="btn btn-ghost btn-sm" style={{ fontSize:11, color:'var(--accent)' }}>
                  Mark all read
                </button>
              )}
            </div>
            <div style={{ maxHeight:360, overflowY:'auto' }}>
              {loading && <div style={{ padding:24, textAlign:'center' }}><div className="spinner" /></div>}
              {!loading && !notifs.length && (
                <div style={{ padding:32, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
                  No notifications
                </div>
              )}
              {!loading && notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.read_at) markRead(n.id);
                    navigate(`/errors/${n.reference_id}`);
                    setOpen(false);
                  }}
                  style={{
                    padding:'12px 16px',
                    borderBottom:'1px solid var(--border)',
                    cursor:'pointer',
                    background: n.read_at ? 'transparent' : 'var(--accent-dim)',
                    display:'flex', gap:10,
                    transition:'background 0.1s',
                  }}
                >
                  <span style={{ fontSize:16, marginTop:1 }}>{typeIcon(n.type)}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color:'var(--text-primary)', marginBottom:3 }}>{n.message}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  {!n.read_at && (
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent)', marginTop:4, flexShrink:0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
