import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background grid */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
        backgroundSize:'40px 40px',
        opacity:0.4,
      }} />
      {/* Glow */}
      <div style={{
        position:'absolute', top:'-20%', left:'50%',
        transform:'translateX(-50%)',
        width:600, height:400,
        background:'radial-gradient(ellipse, #f0a50010 0%, transparent 70%)',
        pointerEvents:'none',
      }} />

      <div style={{ position:'relative', width:'100%', maxWidth:400 }} className="fade-in">
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{
            width:52, height:52, borderRadius:12,
            background:'var(--accent)', margin:'0 auto 16px',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0b0e17" strokeWidth="2">
              <path d="M8 2l1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/>
              <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/>
              <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2m1 4h3M17.47 9C19.4 8.8 21 7.1 21 5m-4 8h4m-1 4h-3"/>
            </svg>
          </div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>
            ErrorWatch
          </h1>
          <p style={{ color:'var(--text-muted)', fontSize:13 }}>Error Management System</p>
        </div>

        <div style={{
          background:'var(--bg-surface)',
          border:'1px solid var(--border)',
          borderRadius:'var(--radius-lg)',
          padding:'32px',
          boxShadow:'var(--shadow-lg)',
        }}>
          <h2 style={{ fontSize:16, fontWeight:600, marginBottom:24, color:'var(--text-primary)' }}>Sign in to your account</h2>

          {error && (
            <div style={{
              padding:'10px 14px',
              background:'#ef444415',
              border:'1px solid #ef444440',
              borderRadius:'var(--radius-sm)',
              color:'var(--red)',
              fontSize:13,
              marginBottom:20,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width:'100%', justifyContent:'center', padding:'10px 0', fontSize:14 }}
              disabled={loading}
            >
              {loading ? <><span className="spinner" style={{ width:16, height:16 }} /> Signing in…</> : 'Sign in'}
            </button>
          </form>

        </div>

        <p style={{ textAlign:'center', marginTop:20, fontSize:12, color:'var(--text-muted)' }}>
          Contact your administrator to create an account
        </p>
      </div>
    </div>
  );
}
