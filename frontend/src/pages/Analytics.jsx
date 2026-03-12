import { useState, useEffect } from 'react';
import { analyticsApi } from '../api/api';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

const COLORS = {
  Open:        '#ef4444',
  'In Progress':'#f59e0b',
  Resolved:    '#10b981',
  Closed:      '#6b7280',
};

const CHANNEL_COLORS = ['#3b82f6','#8b5cf6','#06b6d4','#f59e0b','#ec4899','#6b7280'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:'var(--bg-elevated)', border:'1px solid var(--border-light)',
      borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:12,
    }}>
      <p style={{ color:'var(--text-secondary)', marginBottom:6 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color: p.color || 'var(--text-primary)' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

function StatKpi({ label, value, sub, color }) {
  return (
    <div className="card">
      <div style={{ fontSize:28, fontWeight:700, fontFamily:'var(--font-display)', color: color||'var(--text-primary)', marginBottom:4 }}>{value ?? '—'}</div>
      <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', marginBottom:2 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

export default function Analytics() {
  const [overview,     setOverview]     = useState(null);
  const [overTime,     setOverTime]     = useState([]);
  const [byCategory,   setByCategory]   = useState([]);
  const [byChannel,    setByChannel]    = useState([]);
  const [byResolution, setByResolution] = useState([]);
  const [period, setPeriod] = useState('daily');
  const [days,   setDays]   = useState(30);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ov, ot, bc, bch, br] = await Promise.all([
        analyticsApi.overview(),
        analyticsApi.overTime({ period, days }),
        analyticsApi.byCategory(),
        analyticsApi.byChannel(),
        analyticsApi.byResolution(),
      ]);
      setOverview(ov.data);
      setOverTime(ot.data.data.map(r => ({
        ...r,
        period: (() => {
          try { return format(new Date(r.period), period === 'monthly' ? 'MMM yy' : period === 'weekly' ? 'MMM d' : 'MMM d'); }
          catch { return r.period; }
        })(),
        count: parseInt(r.count),
      })));
      setByCategory(bc.data.data.map(r => ({ ...r, count: parseInt(r.count) })));
      setByChannel(bch.data.data.map(r => ({ ...r, count: parseInt(r.count) })));
      setByResolution(br.data.data.map(r => ({ ...r, count: parseInt(r.count) })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [period, days]);

  const stats = overview?.stats;

  return (
    <div className="fade-in">
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12, marginBottom:24 }}>
        <StatKpi label="Total Errors"   value={stats?.total}       />
        <StatKpi label="Open"           value={stats?.open}        color="var(--red)"    />
        <StatKpi label="In Progress"    value={stats?.in_progress} color="var(--amber)"  />
        <StatKpi label="Resolved"       value={stats?.resolved}    color="var(--green)"  />
        <StatKpi label="Last 30 Days"   value={stats?.last_30_days} color="var(--accent)" />
        <StatKpi label="Avg Resolution" value={overview?.mttr ? `${overview.mttr}h` : '—'} sub="mean time to resolve" />
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'center' }}>
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>Period:</span>
        {['daily','weekly','monthly'].map(p => (
          <button key={p} className={`btn btn-sm ${period===p ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPeriod(p)} style={{ textTransform:'capitalize' }}>{p}</button>
        ))}
        <select className="select" style={{ width:120, marginLeft:'auto' }} value={days} onChange={e => setDays(e.target.value)}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
          <div className="spinner" style={{ width:32, height:32 }} />
        </div>
      ) : (
        <div style={{ display:'grid', gap:16 }}>
          {/* Errors over time */}
          <div className="card">
            <h3 style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:20 }}>
              Errors Over Time
            </h3>
            {overTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={overTime} margin={{ top:5, right:20, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="period" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="count" name="Errors" stroke="var(--accent)" strokeWidth={2} dot={{ r:3, fill:'var(--accent)' }} activeDot={{ r:5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>No data for this period</div>
            )}
          </div>

          {/* Category + Channel side by side */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* By Category */}
            <div className="card">
              <h3 style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:20 }}>
                By Category
              </h3>
              {byCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byCategory} layout="vertical" margin={{ left:10, right:20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="category" tick={{ fill:'var(--text-secondary)', fontSize:11 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Errors" fill="var(--accent)" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:12 }}>No data yet</div>}
            </div>

            {/* By Channel */}
            <div className="card">
              <h3 style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:20 }}>
                By Channel
              </h3>
              {byChannel.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byChannel} dataKey="count" nameKey="channel" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                      {byChannel.map((_, i) => <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize:11, color:'var(--text-secondary)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:12 }}>No data yet</div>}
            </div>
          </div>

          {/* By Resolution */}
          <div className="card">
            <h3 style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:20 }}>
              Resolution Breakdown
            </h3>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              {byResolution.map(r => (
                <div key={r.resolution} style={{
                  flex:'1 1 140px',
                  padding:'16px 20px',
                  background:'var(--bg-overlay)',
                  borderRadius:'var(--radius)',
                  border:`1px solid ${COLORS[r.resolution] || 'var(--border)'}25`,
                }}>
                  <div style={{ fontSize:24, fontWeight:700, fontFamily:'var(--font-display)', color: COLORS[r.resolution] || 'var(--text-primary)', marginBottom:4 }}>
                    {r.count}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{r.resolution}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                    {stats?.total ? Math.round((r.count / stats.total) * 100) : 0}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
