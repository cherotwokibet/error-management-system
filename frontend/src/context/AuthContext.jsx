import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { authApi } from '../api/api';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const socketUrlFromApi = rawApiUrl ? rawApiUrl.replace(/\/+$/, '').replace(/\/api$/, '') : '';
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || socketUrlFromApi || '/').trim();

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ems_user')); } catch { return null; }
  });
  const [socket, setSocket] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Connect socket when user logs in
  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('ems_token');
      const s = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
      s.on('notification', () => setNotifCount(c => c + 1));
      setSocket(s);
      return () => s.disconnect();
    }
  }, [user?.id]);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('ems_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(r => setUser(r.data.user))
      .catch(() => { localStorage.removeItem('ems_token'); localStorage.removeItem('ems_user'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await authApi.login({ email, password });
    const { token, user: u } = r.data;
    localStorage.setItem('ems_token', token);
    localStorage.setItem('ems_user', JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ems_token');
    localStorage.removeItem('ems_user');
    setUser(null);
    socket?.disconnect();
  }, [socket]);

  const can = useCallback((action) => {
    if (!user) return false;
    const perms = {
      admin:  ['create','edit','delete','admin','view'],
      editor: ['create','edit','view'],
      viewer: ['view'],
    };
    return perms[user.role]?.includes(action);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, socket, login, logout, can, notifCount, setNotifCount, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
