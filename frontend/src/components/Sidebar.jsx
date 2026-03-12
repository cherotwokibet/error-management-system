import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const IconBug       = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2l1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2m1 4h3M17.47 9C19.4 8.8 21 7.1 21 5m-4 8h4m-1 4h-3"/></svg>;
const IconGrid      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
const IconChart     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
const IconUsers     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconLogout    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IconPlus      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;

export default function Sidebar() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/',          label: 'Dashboard', icon: <IconGrid /> },
    { to: '/analytics', label: 'Analytics', icon: <IconChart /> },
    ...(user?.role === 'admin' ? [{ to: '/users', label: 'Users', icon: <IconUsers /> }] : []),
  ];

  return (
    <aside style={{
      width: 220, minWidth: 220, height: '100vh',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'var(--accent)', display:'flex',
            alignItems:'center', justifyContent:'center',
            color: '#0b0e17',
          }}>
            <IconBug />
          </div>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:13, fontWeight:700, color:'var(--text-primary)', lineHeight:1.1 }}>
              ErrorWatch
            </div>
            <div style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'0.05em' }}>
              v1.0
            </div>
          </div>
        </div>
      </div>

      {/* New Error button */}
      {can('create') && (
        <div style={{ padding:'12px 14px 6px' }}>
          <button
            className="btn btn-primary"
            style={{ width:'100%', justifyContent:'center' }}
            onClick={() => navigate('/errors/new')}
          >
            <IconPlus /> New Error
          </button>
        </div>
      )}

      {/* Nav links */}
      <nav style={{ padding:'8px 10px', flex: 1 }}>
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 'var(--radius-sm)',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 2,
              transition: 'all 0.15s',
            })}
          >
            {icon} {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{
        padding:'14px 14px',
        borderTop:'1px solid var(--border)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <div style={{
            width:32, height:32,
            borderRadius:'50%',
            background:'var(--bg-overlay)',
            border:'1px solid var(--border-light)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'var(--font-display)', fontSize:12,
            color:'var(--accent)',
          }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.username}
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'capitalize' }}>
              {user?.role}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="btn btn-ghost"
          style={{ width:'100%', justifyContent:'flex-start', gap:8, fontSize:12 }}
        >
          <IconLogout /> Sign out
        </button>
      </div>
    </aside>
  );
}
