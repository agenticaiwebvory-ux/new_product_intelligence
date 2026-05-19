import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

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

// Add a request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem('tdo_intel_user'));
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
  const user = JSON.parse(localStorage.getItem('tdo_intel_user'));
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
  async getProducts(vendor = "", page = 1, limit = 50, search = "") {
    const response = await api.get('/products/', {
      params: {
        vendor: vendor || undefined,
        page,
        limit,
        search: search || undefined
      }
    });
    return response.data;
  },

  async getDashboardStats(vendor = "", search = "") {
    const response = await api.get('/dashboard/stats', {
      params: {
        vendor: vendor || undefined,
        search: search || undefined
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

  async revertUpdate(sku, type = 'all') {
    const response = await api.post(`/products/revert/${sku}?type=${type}`);
    return response.data;
  },

  async adjustInventory(style, sizeDeltas, isAbsolute = true, localOnly = true) {
    const response = await api.post('/products/inventory/adjust', {
      style_name: style,
      size_deltas: sizeDeltas,
      is_absolute: isAbsolute,
      local_only: localOnly
    });
    return response.data;
  },

  // 4. Merchandising
  async getMerchProducts({ page = 1, limit = 50, sortBy = null, vendor = null, search = null, timeRange = '90' }) {
    const response = await mercApi.get('/merchandising/report', {
      params: {
        page,
        limit,
        sort_by: sortBy || undefined,
        vendor: vendor && vendor !== 'ALL' ? vendor : undefined,
        search: search || undefined,
        time_range: timeRange || '90'
      }
    });
    return response.data;
  },

  async getMerchStats({ vendor = null, search = null, timeRange = '90' } = {}) {
    const response = await mercApi.get('/merchandising/stats', {
      params: {
        vendor: vendor && vendor !== 'ALL' ? vendor : undefined,
        search: search || undefined,
        time_range: timeRange || '90'
      }
    });
    return response.data;
  },

  async exportMerchReport({ sortBy = null, vendor = null, search = null, timeRange = '90' }) {
    const params = new URLSearchParams();
    if (sortBy) params.append('sort_by', sortBy);
    if (vendor && vendor !== 'ALL') params.append('vendor', vendor);
    if (search) params.append('search', search);
    if (timeRange) params.append('time_range', timeRange);

    const url = `${mercApi.defaults.baseURL}/merchandising/export?${params.toString()}`;
    window.location.href = url;
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
    } catch (err) {
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
