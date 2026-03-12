import axios from 'axios';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const API_BASE_URL = rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : '/api';
const API_ORIGIN = rawApiUrl ? rawApiUrl.replace(/\/+$/, '').replace(/\/api$/, '') : '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ems_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ems_token');
      localStorage.removeItem('ems_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export const resolveAssetUrl = (assetPath) => {
  if (!assetPath) return '';

  const normalized = String(assetPath).trim().replace(/\\/g, '/');
  if (/^https?:\/\//i.test(normalized)) return normalized;

  let publicPath;
  const lower = normalized.toLowerCase();
  const uploadsSegment = '/uploads/';
  const idx = lower.indexOf(uploadsSegment);

  if (lower.startsWith('uploads/')) {
    publicPath = `/${normalized}`;
  } else if (idx >= 0) {
    publicPath = normalized.slice(idx);
  } else if (normalized.startsWith('/')) {
    publicPath = normalized;
  } else {
    publicPath = `/${normalized.replace(/^\.?\//, '')}`;
  }

  return API_ORIGIN ? `${API_ORIGIN}${publicPath}` : publicPath;
};

const getFilenameFromDisposition = (disposition, fallback) => {
  if (!disposition) return fallback;
  const utf = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) return decodeURIComponent(utf[1]);
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain?.[1] || fallback;
};

const downloadBlobResponse = (res, fallbackName) => {
  const filename = getFilenameFromDisposition(res.headers['content-disposition'], fallbackName);
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login:   (data)       => api.post('/auth/login', data),
  me:      ()           => api.get('/auth/me'),
  users:   ()           => api.get('/auth/users'),
  createUser: (data)    => api.post('/auth/register', data),
  updateUser: (id, data)=> api.put(`/auth/users/${id}`, data),
  resetUserPassword: (id, data) => api.put(`/auth/users/${id}/password-reset`, data),
  deleteUser: (id)       => api.delete(`/auth/users/${id}`),
  changePassword: (data)=> api.put('/auth/me/password', data),
};

// ── Errors ──────────────────────────────────────────────────────────────────
export const errorsApi = {
  list:       (params)        => api.get('/errors', { params }),
  get:        (id)            => api.get(`/errors/${id}`),
  create:     (data)          => api.post('/errors', data),
  update:     (id, data)      => api.put(`/errors/${id}`, data),
  delete:     (id)            => api.delete(`/errors/${id}`),
  meta:       ()              => api.get('/errors/meta'),
  channels:   ()              => api.get('/errors/channels'),
  createChannel: (data)       => api.post('/errors/channels', data),
  deleteChannel: (id)         => api.delete(`/errors/channels/${id}`),
  categories: ()              => api.get('/errors/categories'),
  createCategory: (data)      => api.post('/errors/categories', data),
  deleteCategory: (id)        => api.delete(`/errors/categories/${id}`),
  suggestions:(q)             => api.get('/errors/search-suggestions', { params: { q } }),
  uploadScreenshots: (id, files) => {
    const fd = new FormData();
    files.forEach(f => fd.append('screenshots', f));
    return api.post(`/errors/${id}/screenshots`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteScreenshot: (id, sid) => api.delete(`/errors/${id}/screenshots/${sid}`),
  addComment:       (id, comment) => api.post(`/errors/${id}/comments`, { comment }),
  deleteComment:    (id, cid)     => api.delete(`/errors/${id}/comments/${cid}`),
};

// ── Notifications ────────────────────────────────────────────────────────────
export const notifApi = {
  list:    (params) => api.get('/notifications', { params }),
  read:    (id)     => api.put(`/notifications/${id}/read`),
  readAll: ()       => api.put('/notifications/read-all'),
};

// ── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview:    ()       => api.get('/analytics/overview'),
  overTime:    (params) => api.get('/analytics/over-time', { params }),
  byCategory:  ()       => api.get('/analytics/by-category'),
  byChannel:   ()       => api.get('/analytics/by-channel'),
  byResolution:()       => api.get('/analytics/by-resolution'),
};

// ── Export ───────────────────────────────────────────────────────────────────
export const exportApi = {
  csv: async (params) => {
    const res = await api.get('/export/errors.csv', { params, responseType: 'blob' });
    downloadBlobResponse(res, `errors_${Date.now()}.csv`);
  },
  xlsx: async (params) => {
    const res = await api.get('/export/errors.xlsx', { params, responseType: 'blob' });
    downloadBlobResponse(res, `errors_${Date.now()}.xlsx`);
  },
};
