import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

const client = axios.create({ baseURL: API_URL })

// Attach JWT token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('merchant')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ---- Auth ----
export const authAPI = {
  register: (data) => client.post('/auth/register', data),
  login: (phone_number, password) => client.post('/auth/login', { phone_number, password }),
  me: () => client.get('/auth/me'),
}

// ---- Products ----
export const productsAPI = {
  list: () => client.get('/products/'),
  get: (id) => client.get(`/products/${id}`),
  create: (data) => client.post('/products/', data),
  update: (id, data) => client.patch(`/products/${id}`, data),
  delete: (id) => client.delete(`/products/${id}`),
}

// ---- Inventory ----
export const inventoryAPI = {
  list: (lowStockOnly = false) => client.get('/inventory/', { params: { low_stock_only: lowStockOnly } }),
  alerts: () => client.get('/inventory/alerts'),
  adjust: (data) => client.post('/inventory/adjust', data),
  updateThreshold: (productId, threshold) =>
    client.patch(`/inventory/${productId}/threshold`, { reorder_threshold: threshold }),
}

// ---- Transactions ----
export const transactionsAPI = {
  list: (type = null, limit = 50) => client.get('/transactions/', { params: { type, limit } }),
  create: (data) => client.post('/transactions/', data),
}

// ---- Analytics ----
export const analyticsAPI = {
  dashboard: () => client.get('/analytics/dashboard'),
  salesChart: (days = 7) => client.get('/analytics/sales-chart', { params: { days } }),
}

// ---- Merchants ----
export const merchantsAPI = {
  me: () => client.get('/merchants/me'),
  update: (data) => client.patch('/merchants/me', data),
}

export default client

// ---- Forecasts ----
export const forecastsAPI = {
  list: () => client.get('/forecasts/'),
  get: (productId, days = 7) => client.get(`/forecasts/${productId}`, { params: { days } }),
}

// ---- Suppliers ----
export const suppliersAPI = {
  list: () => client.get('/suppliers/'),
  create: (data) => client.post('/suppliers/', data),
  update: (id, data) => client.patch(`/suppliers/${id}`, data),
  orders: (supplierId) => client.get(`/suppliers/${supplierId}/orders`),
  placeOrder: (supplierId, productId, quantity) =>
    client.post(`/suppliers/${supplierId}/order`, null, { params: { product_id: productId, quantity } }),
  aggregate: (supplierId) => client.post(`/suppliers/${supplierId}/aggregate`),
}

// ---- Credit ----
export const creditAPI = {
  score: () => client.get('/credit/score'),
  offers: () => client.get('/credit/offers'),
}

// ---- Sage Import ----
export const sageAPI = {
  importArticles: (file) => {
    const form = new FormData()
    form.append('file', file)
    return client.post('/sage/import/articles', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  importSales: (file) => {
    const form = new FormData()
    form.append('file', file)
    return client.post('/sage/import/sales', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  importAuto: (file) => {
    const form = new FormData()
    form.append('file', file)
    return client.post('/sage/import/auto', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
