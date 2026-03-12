import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { errorsApi, exportApi } from '../api/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge, { ChannelBadge } from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const IconSearch   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconEdit     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconTrash    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const IconEye      = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconDownload = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IconSort     = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>;
const IconImg      = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IconMsg      = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;

const RESOLUTIONS = ['Open','In Progress','Resolved','Closed'];

// Stat card
function StatCard({ label, value, color }) {
  return (
    <div className="card" style={{ flex:1, minWidth:140 }}>
      <div style={{ fontSize:22, fontWeight:700, fontFamily:'var(--font-display)', color: color || 'var(--text-primary)', marginBottom:4 }}>
        {value ?? <div className="spinner" style={{ width:20, height:20 }} />}
      </div>
      <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { can } = useAuth();
  const navigate = useNavigate();

  const [errors, setErrors]         = useState([]);
  const [pagination, setPagination] = useState({});
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exporting, setExporting] = useState('');
  const suggRef = useRef(null);

  const [filters, setFilters] = useState({
    channel: '', category: '', resolution: '',
    sortBy: 'created_at', sortDir: 'DESC',
    page: 1,
  });

  const [meta, setMeta] = useState({ channels:[], categories:[], resolutions:[] });

  useEffect(() => {
    errorsApi.meta().then(r => setMeta(r.data));
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const r = await errorsApi.list({ limit:1 });
    // We'll use the overview endpoint
    import('../api/api').then(({ analyticsApi }) => {
      analyticsApi.overview().then(r => setStats(r.data.stats)).catch(() => {});
    });
  };

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters, search };
      const r = await errorsApi.list(params);
      setErrors(r.data.errors);
      setPagination(r.data.pagination);
    } catch {
      toast.error('Failed to load errors');
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => { fetchErrors(); }, [fetchErrors]);

  // Search suggestions
  useEffect(() => {
    if (search.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      const r = await errorsApi.suggestions(search);
      setSuggestions(r.data.suggestions);
      setShowSuggestions(true);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Close suggestions on outside click
  useEffect(() => {
    const h = e => { if (suggRef.current && !suggRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }));

  const sortBy = (col) => {
    if (filters.sortBy === col) {
      setFilters(f => ({ ...f, sortDir: f.sortDir === 'ASC' ? 'DESC' : 'ASC', page:1 }));
    } else {
      setFilters(f => ({ ...f, sortBy: col, sortDir: 'DESC', page:1 }));
    }
  };

  const handleDelete = async () => {
    try {
      await errorsApi.delete(deleteTarget.id);
      toast.success('Error deleted');
      setDeleteTarget(null);
      fetchErrors();
      fetchStats();
    } catch {
      toast.error('Failed to delete error');
    }
  };

  const exportParams = () => {
    const p = {};
    if (search) p.search = search;
    if (filters.channel)    p.channel    = filters.channel;
    if (filters.category)   p.category   = filters.category;
    if (filters.resolution) p.resolution = filters.resolution;
    return p;
  };

  const handleExport = async (type) => {
    setExporting(type);
    try {
      if (type === 'csv') {
        await exportApi.csv(exportParams());
      } else {
        await exportApi.xlsx(exportParams());
      }
    } catch {
      toast.error(`Failed to download ${type.toUpperCase()}`);
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="fade-in">
      {/* Stats row */}
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <StatCard label="Total" value={stats?.total} />
        <StatCard label="Open"  value={stats?.open}  color="var(--red)" />
        <StatCard label="In Progress" value={stats?.in_progress} color="var(--amber)" />
        <StatCard label="Resolved" value={stats?.resolved} color="var(--green)" />
        <StatCard label="Last 7 days" value={stats?.last_7_days} color="var(--accent)" />
      </div>

      {/* Filters bar */}
      <div style={{
        display:'flex', gap:10, marginBottom:16,
        flexWrap:'wrap', alignItems:'center',
      }}>
        {/* Search */}
        <div ref={suggRef} style={{ position:'relative', flex:'1 1 240px', minWidth:200, maxWidth:380 }}>
          <div style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}>
            <IconSearch />
          </div>
          <input
            className="input"
            style={{ paddingLeft:32 }}
            placeholder="Search errors…"
            value={search}
            onChange={e => { setSearch(e.target.value); setFilters(f => ({ ...f, page:1 })); }}
            onFocus={() => suggestions.length && setShowSuggestions(true)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
              background:'var(--bg-elevated)', border:'1px solid var(--border-light)',
              borderRadius:'var(--radius)', boxShadow:'var(--shadow)',
              zIndex:50, overflow:'hidden',
            }}>
              {suggestions.map(s => (
                <div
                  key={s.id}
                  style={{ padding:'9px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', fontSize:12 }}
                  onMouseDown={() => { navigate(`/errors/${s.id}`); setShowSuggestions(false); }}
                >
                  <div style={{ color:'var(--text-primary)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {s.suggestion}
                  </div>
                  <StatusBadge status={s.resolution} />
                </div>
              ))}
            </div>
          )}
        </div>

        <select className="select" style={{ flex:'0 0 auto', width:130 }} value={filters.channel} onChange={e => setFilter('channel', e.target.value)}>
          <option value="">All Channels</option>
          {meta.channels.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="select" style={{ flex:'0 0 auto', width:140 }} value={filters.category} onChange={e => setFilter('category', e.target.value)}>
          <option value="">All Categories</option>
          {meta.categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="select" style={{ flex:'0 0 auto', width:140 }} value={filters.resolution} onChange={e => setFilter('resolution', e.target.value)}>
          <option value="">All Statuses</option>
          {RESOLUTIONS.map(r => <option key={r}>{r}</option>)}
        </select>

        {(filters.channel || filters.category || filters.resolution || search) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilters(f => ({ ...f, channel:'', category:'', resolution:'', page:1 })); }}>
            Clear
          </button>
        )}

        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')} disabled={exporting !== ''}>
            <IconDownload /> CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('xlsx')} disabled={exporting !== ''}>
            <IconDownload /> Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width:320 }}>Title</th>
                <th onClick={() => sortBy('created_at')} style={{ minWidth:220 }}>
                  Error Details <IconSort />
                </th>
                <th onClick={() => sortBy('channel')} style={{ width:110 }}>Channel <IconSort /></th>
                <th onClick={() => sortBy('resolution')} style={{ width:130 }}>Status <IconSort /></th>
                <th style={{ width:110 }}>Age</th>
                <th style={{ width:100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ padding:48, textAlign:'center' }}>
                  <div className="spinner" style={{ margin:'0 auto' }} />
                </td></tr>
              )}
              {!loading && !errors.length && (
                <tr><td colSpan={6} style={{ padding:48, textAlign:'center', color:'var(--text-muted)' }}>
                  No errors found. {can('create') && <Link to="/errors/new" style={{ color:'var(--accent)' }}>Create one →</Link>}
                </td></tr>
              )}
              {!loading && errors.map(err => (
                <tr key={err.id}>
                  <td>
                    <Link to={`/errors/${err.id}`} style={{ color:'var(--text-primary)', textDecoration:'none' }}>
                      <div style={{ maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:13, fontWeight:600 }}>
                        {err.title || 'Untitled'}
                      </div>
                    </Link>
                  </td>
                  <td>
                    <Link to={`/errors/${err.id}`} style={{ color:'var(--text-primary)', textDecoration:'none' }}>
                      <div style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:13 }}>
                        {err.error_details}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                        by {err.created_by_name}
                      </div>
                    </Link>
                  </td>
                  <td><ChannelBadge channel={err.channel} /></td>
                  <td><StatusBadge status={err.resolution} /></td>
                  <td>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {formatDistanceToNow(new Date(err.created_at), { addSuffix:true })}
                    </span>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:4 }}>
                      <button className="btn btn-ghost btn-icon" title="View" onClick={() => navigate(`/errors/${err.id}`)}>
                        <IconEye />
                      </button>
                      {can('edit') && (
                        <button className="btn btn-ghost btn-icon" title="Edit" onClick={() => navigate(`/errors/${err.id}/edit`)}>
                          <IconEdit />
                        </button>
                      )}
                      {can('delete') && (
                        <button className="btn btn-ghost btn-icon" title="Delete" style={{ color:'var(--red)' }} onClick={() => setDeleteTarget(err)}>
                          <IconTrash />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'12px 16px', borderTop:'1px solid var(--border)',
          }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>
              {pagination.total} errors · page {pagination.page} of {pagination.pages}
            </span>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-secondary btn-sm" disabled={pagination.page <= 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>←</button>
              {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={`btn btn-sm ${p === pagination.page ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilters(f => ({ ...f, page: p }))}
                >{p}</button>
              ))}
              <button className="btn btn-secondary btn-sm" disabled={pagination.page >= pagination.pages}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>→</button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ width:'100%', maxWidth:420, height:'auto', maxHeight:'90vh', borderRadius:'var(--radius-lg)', margin:'auto' }}
          >
            <div className="modal-header">
              <span style={{ fontWeight:600 }}>Confirm Delete</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ flex:'unset', overflow:'visible' }}>
              <p style={{ color:'var(--text-secondary)', fontSize:14 }}>
                Are you sure you want to delete this error? This action cannot be undone.
              </p>
              <div style={{ marginTop:12, padding:12, background:'var(--bg-overlay)', borderRadius:'var(--radius-sm)', fontSize:13, color:'var(--text-muted)' }}>
                {deleteTarget.error_details?.substring(0, 100)}…
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
