import { useState, useEffect } from 'react';
import { authApi } from '../api/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ROLES = ['admin','editor','viewer'];
const ROOT_ADMIN_EMAIL = 'bcherotwo@stima-sacco.com';

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ username:'', email:'', password:'', role:'viewer' });
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ username:'', email:'', role:'viewer', is_active:true });
  const [savingEdit, setSavingEdit] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [savingReset, setSavingReset] = useState(false);
  const canDeleteUsers = me?.email === ROOT_ADMIN_EMAIL;

  const fetchUsers = async () => {
    try {
      const r = await authApi.users();
      setUsers(r.data.users);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.createUser(form);
      toast.success('User created successfully');
      setShowModal(false);
      setForm({ username:'', email:'', password:'', role:'viewer' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    if (u.id === me.id) {
      toast.error('You cannot deactivate your own account');
      return;
    }

    try {
      await authApi.updateUser(u.id, { is_active: !u.is_active });
      toast.success(`User ${u.is_active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch {
      toast.error('Failed to update user');
    }
  };

  const changeRole = async (id, role) => {
    try {
      await authApi.updateUser(id, { role });
      toast.success('Role updated');
      fetchUsers();
    } catch {
      toast.error('Failed to update role');
    }
  };

  const openEdit = (u) => {
    setEditTarget(u);
    setEditForm({
      username: u.username,
      email: u.email,
      role: u.role,
      is_active: u.is_active,
    });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await authApi.updateUser(editTarget.id, editForm);
      toast.success('User details updated');
      setEditTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user');
    } finally {
      setSavingEdit(false);
    }
  };

  const openReset = (u) => {
    setResetTarget(u);
    setResetPassword('');
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (!resetTarget) return;
    setSavingReset(true);
    try {
      await authApi.resetUserPassword(resetTarget.id, { newPassword: resetPassword });
      toast.success(`Password reset for ${resetTarget.username}`);
      setResetTarget(null);
      setResetPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setSavingReset(false);
    }
  };

  const deleteUser = async (u) => {
    if (u.id === me.id) {
      toast.error('You cannot delete your own account');
      return;
    }

    const ok = window.confirm(`Delete user ${u.username}? This action cannot be undone.`);
    if (!ok) return;

    try {
      await authApi.deleteUser(u.id);
      toast.success(`Deleted ${u.username}`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const roleColor = { admin:'var(--red)', editor:'var(--accent)', viewer:'var(--text-muted)' };

  return (
    <>
      <div className="fade-in">
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:20 }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add User</button>
        </div>

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={{ padding:40, textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }} /></td></tr>}
                {!loading && users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{
                          width:28, height:28, borderRadius:'50%',
                          background:'var(--bg-overlay)', border:'1px solid var(--border-light)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:'var(--font-display)', fontSize:11, color:'var(--accent)',
                        }}>{u.username[0].toUpperCase()}</div>
                        <span style={{ fontWeight:500, fontSize:13 }}>{u.username}</span>
                        {u.id === me.id && <span style={{ fontSize:10, color:'var(--accent)', background:'var(--accent-dim)', padding:'1px 6px', borderRadius:3 }}>you</span>}
                      </div>
                    </td>
                    <td><span style={{ fontSize:12, color:'var(--text-secondary)' }}>{u.email}</span></td>
                    <td><span style={{ fontSize:12, color: roleColor[u.role], fontWeight:600 }}>{u.role}</span></td>
                    <td>
                      <span style={{
                        display:'inline-block', padding:'2px 10px', borderRadius:100,
                        fontSize:11, fontWeight:600,
                        color: u.is_active ? 'var(--green)' : 'var(--text-muted)',
                        background: u.is_active ? '#10b98115' : '#6b728015',
                      }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td><span style={{ fontSize:12, color:'var(--text-muted)' }}>{format(new Date(u.created_at), 'MMM d, yyyy')}</span></td>
                    <td>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} style={{ fontSize:12 }}>
                          Edit
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openReset(u)} style={{ fontSize:12 }}>
                          Reset Password
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleActive(u)}
                          disabled={u.id === me.id}
                          style={{ color: u.is_active ? 'var(--red)' : 'var(--green)', fontSize:12 }}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        {canDeleteUsers && u.id !== me.id && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => deleteUser(u)}
                            style={{ color: 'var(--red)', fontSize:12 }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create user modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight:600 }}>Add New User</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={createUser}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Username</label>
                    <input className="input" placeholder="johndoe" required minLength={3}
                      value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" className="input" placeholder="john@example.com" required
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" className="input" placeholder="Min 8 chars, uppercase, number" required minLength={8}
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  <div className="error-text" style={{ color:'var(--text-muted)' }}>
                    Must be 8+ characters with uppercase and a number.
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="modal-backdrop" onClick={() => setEditTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight:600 }}>Edit User</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditTarget(null)}>✕</button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Username</label>
                  <input
                    className="input"
                    required
                    minLength={3}
                    value={editForm.username}
                    onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="input"
                    required
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select
                      className="select"
                      value={editForm.role}
                      onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      className="select"
                      value={editForm.is_active ? 'active' : 'inactive'}
                      onChange={e => setEditForm(f => ({ ...f, is_active: e.target.value === 'active' }))}
                      disabled={editTarget.id === me.id}
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="modal-backdrop" onClick={() => setResetTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight:600 }}>Reset Password</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setResetTarget(null)}>✕</button>
            </div>
            <form onSubmit={submitReset}>
              <div className="modal-body">
                <div style={{ marginBottom:12, color:'var(--text-secondary)', fontSize:13 }}>
                  Set a new password for <strong>{resetTarget.username}</strong>.
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Min 8 chars, uppercase, number"
                    required
                    minLength={8}
                    value={resetPassword}
                    onChange={e => setResetPassword(e.target.value)}
                  />
                  <div className="error-text" style={{ color:'var(--text-muted)' }}>
                    Must be 8+ characters with uppercase and a number.
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setResetTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingReset}>
                  {savingReset ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
