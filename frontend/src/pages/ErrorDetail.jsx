import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { errorsApi, resolveAssetUrl } from '../api/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge, { ChannelBadge } from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function ErrorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, can } = useAuth();

  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const fetchError = async () => {
    try {
      const r = await errorsApi.get(id);
      setError(r.data.error);
    } catch {
      toast.error('Failed to load error');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchError(); }, [id]);

  const addComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setCommenting(true);
    try {
      await errorsApi.addComment(id, comment);
      setComment('');
      fetchError();
      toast.success('Comment added');
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setCommenting(false);
    }
  };

  const deleteComment = async (cid) => {
    try {
      await errorsApi.deleteComment(id, cid);
      fetchError();
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  const changeStatus = async (resolution) => {
    setChangingStatus(true);
    try {
      await errorsApi.update(id, { resolution });
      fetchError();
      toast.success(`Status changed to ${resolution}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setChangingStatus(false);
    }
  };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );
  if (!error) return null;

  const RESOLUTIONS = ['Open','In Progress','Resolved','Closed'];

  return (
    <div className="fade-in" style={{ maxWidth:900 }}>
      {/* Breadcrumb */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, fontSize:12, color:'var(--text-muted)' }}>
        <Link to="/" style={{ color:'var(--text-muted)', textDecoration:'none' }}>Dashboard</Link>
        <span>›</span>
        <span style={{ color:'var(--text-secondary)' }}>Error #{error.id.substring(0,8)}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:20, alignItems:'start' }}>
        {/* Main */}
        <div>
          {/* Header */}
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16, gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                  <StatusBadge status={error.resolution} />
                  <ChannelBadge channel={error.channel} />
                  <span style={{ fontSize:11, color:'var(--text-muted)', background:'var(--bg-overlay)', padding:'2px 8px', borderRadius:4 }}>
                    {error.category}
                  </span>
                </div>
                <p style={{ fontSize:14, lineHeight:1.7, color:'var(--text-primary)', whiteSpace:'pre-wrap' }}>
                  {error.error_details}
                </p>
              </div>
              {can('edit') && (
                <Link to={`/errors/${id}/edit`} className="btn btn-secondary btn-sm" style={{ flexShrink:0 }}>
                  Edit
                </Link>
              )}
            </div>

            {/* Meta */}
            <div style={{ display:'flex', gap:24, flexWrap:'wrap', fontSize:12, color:'var(--text-muted)', paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <div>
                <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>Created by: </span>
                {error.created_by_name}
              </div>
              <div>
                <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>Assigned to: </span>
                {error.assigned_to_name || 'Unassigned'}
              </div>
              {error.ticket && (
                <div>
                  <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>Ticket: </span>
                  <span className="mono" style={{ color:'var(--blue)' }}>{error.ticket}</span>
                </div>
              )}
              <div>
                <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>Created: </span>
                {format(new Date(error.created_at), 'MMM d, yyyy HH:mm')}
              </div>
              <div>
                <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>Updated: </span>
                {format(new Date(error.updated_at), 'MMM d, yyyy HH:mm')}
              </div>
            </div>
          </div>

          {/* Screenshots */}
          {error.screenshots?.length > 0 && (
            <div className="card" style={{ marginBottom:16 }}>
              <h3 style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:12 }}>
                Screenshots ({error.screenshots.length})
              </h3>
              <div className="thumb-grid">
                {error.screenshots.map(s => (
                  <div key={s.id} className="thumb-item" style={{ width:120, height:85 }}
                    onClick={() => setLightbox(s)}>
                    <img src={resolveAssetUrl(s.thumb_path)} alt={s.file_name}
                      onError={e => { e.target.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="85"><rect fill="%23252d42" width="120" height="85"/><text fill="%234a5470" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="11">IMG</text></svg>'; }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="card">
            <h3 style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:16 }}>
              Comments ({error.comments?.length || 0})
            </h3>

            {error.comments?.map(c => (
              <div key={c.id} style={{
                display:'flex', gap:12, marginBottom:16,
                paddingBottom:16, borderBottom:'1px solid var(--border)',
              }}>
                <div style={{
                  width:32, height:32, borderRadius:'50%',
                  background:'var(--bg-overlay)', border:'1px solid var(--border-light)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'var(--font-display)', fontSize:12, color:'var(--accent)',
                  flexShrink:0,
                }}>
                  {c.username?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{c.username}</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {format(new Date(c.created_at), 'MMM d, HH:mm')}
                    </span>
                    {(c.user_id === user.id || can('admin')) && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:11 }}
                      >Delete</button>
                    )}
                  </div>
                  <p style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{c.comment}</p>
                </div>
              </div>
            ))}

            {/* Add comment */}
            {can('edit') && (
              <form onSubmit={addComment}>
                <textarea
                  className="textarea"
                  style={{ minHeight:80, marginBottom:10 }}
                  placeholder="Add a comment…"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={commenting || !comment.trim()}>
                  {commenting ? <><span className="spinner" style={{ width:12, height:12 }} /> Posting…</> : 'Post Comment'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Sidebar panel */}
        <div>
          {can('edit') && (
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:12 }}>
                Change Status
              </div>
              {changingStatus && <div className="spinner" style={{ width:16, height:16, margin:'0 auto' }} />}
              {!changingStatus && RESOLUTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => changeStatus(r)}
                  style={{
                    display:'block', width:'100%', textAlign:'left',
                    padding:'8px 12px', marginBottom:4,
                    background: error.resolution === r ? 'var(--accent-dim)' : 'var(--bg-overlay)',
                    border: `1px solid ${error.resolution === r ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius:'var(--radius-sm)',
                    color: error.resolution === r ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor:'pointer', fontSize:13,
                    transition:'all 0.15s',
                  }}
                >{r}</button>
              ))}
            </div>
          )}

          <div className="card">
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:12 }}>
              Details
            </div>
            {[
              ['ID', <span className="mono">{error.id.substring(0,12)}…</span>],
              ['Status', <StatusBadge status={error.resolution} />],
              ['Channel', <ChannelBadge channel={error.channel} />],
              ['Category', error.category],
              ['Created', format(new Date(error.created_at), 'MMM d, yyyy')],
              ['Updated', format(new Date(error.updated_at), 'MMM d, yyyy')],
            ].map(([label, val]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, fontSize:12 }}>
                <span style={{ color:'var(--text-muted)' }}>{label}</span>
                <span style={{ color:'var(--text-secondary)' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="modal-backdrop" onClick={() => setLightbox(null)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth:'90vw', maxHeight:'90vh', position:'relative' }}>
            <img
              src={resolveAssetUrl(lightbox.file_path)}
              alt={lightbox.file_name}
              style={{ maxWidth:'90vw', maxHeight:'85vh', objectFit:'contain', borderRadius:'var(--radius)', boxShadow:'var(--shadow-lg)' }}
            />
            <button
              onClick={() => setLightbox(null)}
              style={{
                position:'absolute', top:-12, right:-12,
                background:'var(--bg-elevated)', border:'1px solid var(--border-light)',
                borderRadius:'50%', width:32, height:32,
                color:'var(--text-primary)', cursor:'pointer', fontSize:16,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}
            >✕</button>
            <div style={{ textAlign:'center', marginTop:8, fontSize:12, color:'rgba(255,255,255,0.6)' }}>
              {lightbox.file_name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
