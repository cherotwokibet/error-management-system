import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { errorsApi, authApi, resolveAssetUrl } from '../api/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function ErrorForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const isEditor = user?.role === 'editor';

  const [form, setForm] = useState({
    title: '',
    error_details: '',
    channel: 'Web',
    category: 'UI Bug',
    resolution: 'Open',
    ticket: '',
    assigned_to: user?.id || '',
    comments: '',
  });
  const [meta, setMeta]       = useState({ channels:[], categories:[], resolutions:[] });
  const [users, setUsers]     = useState([]);
  const [files, setFiles]     = useState([]);         // new files to upload
  const [existing, setExisting] = useState([]);       // existing screenshots
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [errors, setErrors]   = useState({});
  const [channelRows, setChannelRows] = useState([]);
  const [showChannelManager, setShowChannelManager] = useState(false);
  const [newChannel, setNewChannel] = useState('');
  const [savingChannel, setSavingChannel] = useState(false);
  const [categoryRows, setCategoryRows] = useState([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const loadMeta = async () => {
    const r = await errorsApi.meta();
    setMeta(r.data);
  };

  const loadChannels = async () => {
    if (!can('admin')) return;
    const r = await errorsApi.channels();
    setChannelRows(r.data.channels || []);
  };

  const loadCategories = async () => {
    if (!can('edit')) return;
    const r = await errorsApi.categories();
    setCategoryRows(r.data.categories || []);
  };

  useEffect(() => {
    loadMeta();
    authApi.users().then(r => setUsers(r.data.users)).catch(() => {});
    loadChannels().catch(() => {});
    loadCategories().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    errorsApi.get(id).then(r => {
      const e = r.data.error;
      setForm({
        title:         e.title || '',
        error_details: e.error_details,
        channel:       e.channel,
        category:      e.category,
        resolution:    e.resolution,
        ticket:        e.ticket || '',
        assigned_to:   isEditor ? (user?.id || '') : (e.assigned_to || ''),
        comments:      '',
      });
      setExisting(e.screenshots || []);
    }).catch(() => toast.error('Failed to load error')).finally(() => setFetching(false));
  }, [id, isEdit, isEditor, user?.id]);

  const onDrop = useCallback(accepted => {
    const mapped = accepted.map(f => Object.assign(f, { preview: URL.createObjectURL(f) }));
    setFiles(prev => [...prev, ...mapped]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxSize: 10 * 1024 * 1024,
  });

  // Paste from clipboard
  useEffect(() => {
    const handler = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const f = Object.assign(file, { preview: URL.createObjectURL(file) });
            setFiles(prev => [...prev, f]);
            toast.success('Image pasted from clipboard');
          }
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, []);

  const removeFile = (idx) => {
    setFiles(prev => { const n = [...prev]; URL.revokeObjectURL(n[idx].preview); n.splice(idx,1); return n; });
  };

  const removeExisting = async (sid) => {
    try {
      await errorsApi.deleteScreenshot(id, sid);
      setExisting(prev => prev.filter(s => s.id !== sid));
      toast.success('Screenshot removed');
    } catch {
      toast.error('Failed to remove screenshot');
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.error_details.trim()) errs.error_details = 'Error details are required';
    if (!form.channel)   errs.channel  = 'Channel is required';
    if (!form.category)  errs.category = 'Category is required';
    if (!form.assigned_to) errs.assigned_to = 'Assigned user is required';
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      let errorId = id;
      const payload = { ...form };

      if (isEdit) {
        await errorsApi.update(id, payload);
      } else {
        const r = await errorsApi.create(payload);
        errorId = r.data.error.id;
      }

      // Upload files
      if (files.length) {
        await errorsApi.uploadScreenshots(errorId, files);
      }

      toast.success(isEdit ? 'Error updated!' : 'Error created!');
      navigate(`/errors/${errorId}`);
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'Failed to save';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const addChannel = async () => {
    const name = newChannel.trim();
    if (!name) return;
    setSavingChannel(true);
    try {
      await errorsApi.createChannel({ name });
      setNewChannel('');
      await Promise.all([loadMeta(), loadChannels()]);
      toast.success('Channel added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add channel');
    } finally {
      setSavingChannel(false);
    }
  };

  const removeChannel = async (row) => {
    const ok = window.confirm(`Delete channel ${row.name}?`);
    if (!ok) return;

    try {
      await errorsApi.deleteChannel(row.id);
      await Promise.all([loadMeta(), loadChannels()]);
      if (form.channel === row.name) {
        setForm(f => ({ ...f, channel: 'Other' }));
      }
      toast.success('Channel deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete channel');
    }
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    setSavingCategory(true);
    try {
      await errorsApi.createCategory({ name });
      setNewCategory('');
      await Promise.all([loadMeta(), loadCategories()]);
      toast.success('Category added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add category');
    } finally {
      setSavingCategory(false);
    }
  };

  const removeCategory = async (row) => {
    const ok = window.confirm(`Delete category ${row.name}?`);
    if (!ok) return;

    try {
      await errorsApi.deleteCategory(row.id);
      await Promise.all([loadMeta(), loadCategories()]);
      if (form.category === row.name) {
        setForm(f => ({ ...f, category: 'Other' }));
      }
      toast.success('Category deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete category');
    }
  };

  useEffect(() => {
    if (!form.assigned_to && user?.id) {
      setForm(f => ({ ...f, assigned_to: user.id }));
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isEditor && !form.assigned_to && users.length) {
      setForm(f => ({ ...f, assigned_to: users[0].id }));
    }
  }, [isEditor, users, form.assigned_to]);

  if (fetching) return (
    <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );

  return (
    <div className="fade-in" style={{ maxWidth:800 }}>
      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom:16 }}>
          <h2 style={{ fontSize:15, fontWeight:600, marginBottom:20, color:'var(--text-primary)' }}>
            {isEdit ? 'Edit Error Report' : 'New Error Report'}
          </h2>

          {/* Error details */}
          <div className="form-group">
            <label>Title *</label>
            <input
              className={`input ${errors.title ? 'input-error' : ''}`}
              placeholder="Short title for this error"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            {errors.title && <div className="error-text">{errors.title}</div>}
          </div>

          {/* Error details */}
          <div className="form-group">
            <label>Error Details *</label>
            <textarea
              className={`textarea ${errors.error_details ? 'input-error' : ''}`}
              style={{ minHeight:140 }}
              placeholder="Describe the error in detail. Include steps to reproduce, expected vs actual behavior, stack traces, etc."
              value={form.error_details}
              onChange={e => setForm(f => ({ ...f, error_details: e.target.value }))}
            />
            {errors.error_details && <div className="error-text">{errors.error_details}</div>}
          </div>

          {/* Channel + Category */}
          <div className="form-row">
            <div className="form-group">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <label style={{ marginBottom:0 }}>Channel *</label>
                {can('admin') && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowChannelManager(v => !v)}
                    style={{ fontSize:11 }}
                  >
                    {showChannelManager ? 'Hide channels' : 'Manage channels'}
                  </button>
                )}
              </div>
              <select className={`select ${errors.channel ? 'input-error' : ''}`}
                value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                {meta.channels.map(c => <option key={c}>{c}</option>)}
              </select>

              {can('admin') && showChannelManager && (
                <div style={{ marginTop:10, padding:12, border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', background:'var(--bg-overlay)' }}>
                  <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                    <input
                      className="input"
                      placeholder="New channel name"
                      value={newChannel}
                      onChange={e => setNewChannel(e.target.value)}
                    />
                    <button type="button" className="btn btn-primary" onClick={addChannel} disabled={savingChannel || !newChannel.trim()}>
                      Add
                    </button>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {channelRows.map(ch => (
                      <div key={ch.id} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'4px 10px', border:'1px solid var(--border-light)', borderRadius:999, fontSize:12 }}>
                        <span>{ch.name}</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color:'var(--red)', padding:'0 4px' }}
                          onClick={() => removeChannel(ch)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="form-group">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <label style={{ marginBottom:0 }}>Category *</label>
                {can('edit') && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowCategoryManager(v => !v)}
                    style={{ fontSize:11 }}
                  >
                    {showCategoryManager ? 'Hide categories' : 'Manage categories'}
                  </button>
                )}
              </div>
              <select className={`select ${errors.category ? 'input-error' : ''}`}
                value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {meta.categories.map(c => <option key={c}>{c}</option>)}
              </select>

              {can('edit') && showCategoryManager && (
                <div style={{ marginTop:10, padding:12, border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', background:'var(--bg-overlay)' }}>
                  <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                    <input
                      className="input"
                      placeholder="New category name"
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                    />
                    <button type="button" className="btn btn-primary" onClick={addCategory} disabled={savingCategory || !newCategory.trim()}>
                      Add
                    </button>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {categoryRows.map(cat => (
                      <div key={cat.id} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'4px 10px', border:'1px solid var(--border-light)', borderRadius:999, fontSize:12 }}>
                        <span>{cat.name}</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color:'var(--red)', padding:'0 4px' }}
                          onClick={() => removeCategory(cat)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resolution + Ticket */}
          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select className="select" value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))}>
                {meta.resolutions.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Ticket / External ID</label>
              <input className="input" placeholder="JIRA-123 or URL" value={form.ticket}
                onChange={e => setForm(f => ({ ...f, ticket: e.target.value }))} />
            </div>
          </div>

          {/* Assigned to */}
          <div className="form-group">
            <label>Assign To</label>
            <select className="select" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
              {isEditor ? (
                user ? <option value={user.id}>{user.username} ({user.role})</option> : null
              ) : (
                users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)
              )}
            </select>
            {errors.assigned_to && <div className="error-text">{errors.assigned_to}</div>}
          </div>

          {/* Initial comment */}
          {!isEdit && (
            <div className="form-group">
              <label>Initial Comment (optional)</label>
              <textarea className="textarea" style={{ minHeight:70 }} placeholder="Add any additional notes…"
                value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value }))} />
            </div>
          )}
        </div>

        {/* Screenshots */}
        <div className="card" style={{ marginBottom:16 }}>
          <h3 style={{ fontSize:13, fontWeight:600, marginBottom:16, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
            Screenshots
          </h3>

          {/* Existing screenshots */}
          {existing.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>Existing attachments</div>
              <div className="thumb-grid">
                {existing.map(s => (
                  <div key={s.id} className="thumb-item" onClick={() => window.open(resolveAssetUrl(s.file_path), '_blank')}>
                    <img src={resolveAssetUrl(s.thumb_path)} alt={s.file_name}
                      onError={e => { e.target.style.display='none'; }} />
                    <button className="thumb-remove" onClick={e => { e.stopPropagation(); removeExisting(s.id); }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            <div style={{ marginBottom:8, fontSize:24 }}>📎</div>
            <div style={{ fontSize:13, marginBottom:4 }}>
              {isDragActive ? 'Drop images here…' : 'Drag & drop images, click to browse, or paste from clipboard'}
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>PNG, JPG, GIF, WEBP · Max 10MB each</div>
          </div>

          {/* New file previews */}
          {files.length > 0 && (
            <div className="thumb-grid" style={{ marginTop:12 }}>
              {files.map((f, i) => (
                <div key={i} className="thumb-item">
                  <img src={f.preview} alt={f.name} />
                  <button className="thumb-remove" onClick={() => removeFile(i)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><span className="spinner" style={{ width:14, height:14 }} /> Saving…</> : (isEdit ? 'Save Changes' : 'Create Error')}
          </button>
        </div>
      </form>
    </div>
  );
}
