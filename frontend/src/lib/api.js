import axios from 'axios';

const getBase = () => {
  if (window.electron) {
    return 'http://localhost:8000';
  }
  return import.meta.env.VITE_API_URL
    || localStorage.getItem('backendUrl')
    || 'https://permanentai-backend.onrender.com';
};

export const api = axios.create({
  baseURL: getBase(),
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[API]', err.message);
    return Promise.reject(err);
  }
);

export const knowledgeApi = {
  listDocuments: (params = {}) => api.get('/knowledge/documents', { params }),
  uploadDocuments: (formData) =>
    api.post('/knowledge/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteDocument: (id) => api.delete(`/knowledge/documents/${id}`),
  reindexDocument: (id) => api.post(`/knowledge/documents/${id}/reindex`),
  sync: () => api.post('/knowledge/sync'),
};

export const searchApi = {
  hybrid: (q, params = {}) => api.get('/search', { params: { q, ...params } }),
  parts: (q, params = {}) => api.get('/search/parts', { params: { q, ...params } }),
  assets: (q, params = {}) => api.get('/search/assets', { params: { q, ...params } }),
};

export const chatApi = {
  getMessages: (sessionId) => api.get(`/chat/sessions/${sessionId}/messages`),
  deleteSession: (sessionId) => api.delete(`/chat/sessions/${sessionId}`),
};

export default api;
