import axios from 'axios';
import { readJsonStorage } from '../utils/storage';

const API_BASE = import.meta.env.VITE_API_URL;
const USER_STORAGE_KEY = 'tdo_intel_user';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

const mercApi = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getSavedUser = () => readJsonStorage(USER_STORAGE_KEY);

// Add a request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const user = getSavedUser();
    if (user && user.access_token) {
      config.headers.Authorization = `Bearer ${user.access_token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('tdo_intel_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Add auth interceptor to mercApi
const authInterceptor = (config) => {
  const user = getSavedUser();
  if (user && user.access_token) {
    config.headers.Authorization = `Bearer ${user.access_token}`;
  }
  return config;
};
mercApi.interceptors.request.use(authInterceptor, (error) => Promise.reject(error));

export const authService = {
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await axios.post(`${API_BASE}/auth/login`, formData);
    return response.data;
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('tdo_intel_user');
    }
  },
  getUsers: async () => {
    const response = await api.get('/auth/users');
    return response.data;
  },
  updateUser: async (id, role, permissions, password) => {
    const response = await api.post('/auth/update_user', { id, role, permissions, password });
    return response.data;
  },
  register: async (username, password, role, permissions) => {
    const response = await api.post('/auth/register', { username, password, role, permissions });
    return response.data;
  }
};

// export const auditService = {
//   proposeFix: async (rule, item) => {
//     const response = await api.post('/tools/propose_fix', { rule, item });
//     return response.data;
//   }
// };

export const apiService = {
  // 1. Catalog & Stats
  async getProducts(vendor = "", page = 1, limit = 50, search = "", dateFrom = null, dateTo = null, extraParams = {}) {
    const response = await api.get('/products/', {
      params: {
        vendor: vendor || undefined,
        page,
        limit,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        tags: extraParams.tagSearch || undefined,
        status: extraParams.status && extraParams.status !== 'all' ? extraParams.status : undefined
      }
    });
    return response.data;
  },

  async getDashboardStats(vendor = "", search = "", dateFrom = null, dateTo = null, extraParams = {}) {
    const response = await api.get('/dashboard/stats', {
      params: {
        vendor: vendor || undefined,
        store: extraParams.store !== 'ALL' ? extraParams.store : undefined,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        tags: extraParams.tagSearch || undefined,
        status: extraParams.status && extraParams.status !== 'all' ? extraParams.status : undefined
      }
    });
    return response.data;
  },

  async getDashboardAnalytics(vendor = "", search = "", dateFrom = null, dateTo = null, extraParams = {}) {
    const response = await api.get('/dashboard/analytics', {
      params: {
        vendor: vendor || undefined,
        store: extraParams.store !== 'ALL' ? extraParams.store : undefined,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        tags: extraParams.tagSearch || undefined,
      }
    });
    return response.data;
  },

  async checkConnections() {
    const response = await api.get('/stores/connections');
    return response.data;
  },

  async getStores() {
    const response = await api.get('/stores/');
    return response.data;
  },

  // 2. Synchronization & AI
  async pushProductUpdate(sku, payload, localOnly = false) {
    const response = await api.post('/products/push-update', {
      sku: sku,
      local_only: localOnly,
      ...payload
    });
    return response.data;
  },

  //   async generateAIContent(dashboardId, target, store = "TDO") {
  //     const response = await api.post('/tools/generate_ai', {
  //       dashboard_id: dashboardId,
  //       target: target,
  //       store: store
  //     });
  //     return response.data;
  //   },


  async syncToStore(productId, storeKey) {
    const response = await api.post(`/products/${productId}/sync/${storeKey}`);
    return response.data;
  },
  async getProductChanges(page = 1, limit = 50, search = "", sortBy = "newest") {
    const response = await api.get('/products/changes', {
      params: { page, limit, search: search || undefined, sort_by: sortBy }
    });
    return response.data;
  },

  async revertUpdate(sku, type = 'all', store = null) {
    const params = new URLSearchParams({ type });
    if (store) params.set('store', store);
    const url = `/products/revert/${encodeURIComponent(sku)}?${params.toString()}`;
    const response = await api.post(url);
    return response.data;
  },

  async clearBackup(sku) {
    const response = await api.delete(`/products/changes/${sku}`);
    return response.data;
  },

  async clearAllBackups() {
    const response = await api.delete('/products/changes');
    return response.data;
  },

  // 4. Merchandising
  async getMerchProducts({ page = 1, limit = 50, sortBy = null, vendor = null, search = null, timeRange = '90', dateFrom = null, dateTo = null }) {
    const response = await mercApi.get('/merchandising/report', {
      params: {
        page,
        limit,
        sort_by: sortBy || undefined,
        vendor: vendor && vendor !== 'ALL' ? vendor : undefined,
        search: search || undefined,
        time_range: timeRange || '90',
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      }
    });
    return response.data;
  },

  async getMerchStats({ vendor = null, search = null, timeRange = '90', dateFrom = null, dateTo = null } = {}) {
    const response = await mercApi.get('/merchandising/stats', {
      params: {
        vendor: vendor && vendor !== 'ALL' ? vendor : undefined,
        search: search || undefined,
        time_range: timeRange || '90',
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      }
    });
    return response.data;
  },

  async exportMerchReport({ sortBy = null, vendor = null, search = null, timeRange = '90', dateFrom = null, dateTo = null }) {
    const response = await mercApi.get('/merchandising/export', {
      params: {
        sort_by: sortBy || undefined,
        vendor: vendor && vendor !== 'ALL' ? vendor : undefined,
        search: search || undefined,
        time_range: timeRange || '90',
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      },
      responseType: 'blob'
    });
    const contentDisposition = response.headers['content-disposition'] || '';
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    const filename = filenameMatch?.[1] || 'merchandising_report.csv';
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  async getProductAnalytics(sku, timeframe = '7') {
    const response = await api.get(`/products/${sku}/analytics`, {
      params: { timeframe }
    });
    return response.data;
  },

  async getMerchStyleDetails(style_no) {
    try {
      const response = await api.get(`/products/${style_no}/analytics`);
      return response.data;
    } catch {
      return null;
    }
  },

  async updateMerchTags(style, tags_categorized) {
    const response = await mercApi.post('/merchandising/update-tags', {
      style,
      tags_categorized
    });
    return response.data;
  }
};
