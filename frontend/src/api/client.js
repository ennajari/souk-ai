import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

const client = axios.create({ baseURL: API_URL, timeout: 20000 })

// Attach JWT token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally — only redirect if a session existed (not on login failure)
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('token')) {
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
  countries: () => client.get('/auth/countries'),
  login: (phone_number, password) => client.post('/auth/login', { phone_number, password }),
  adminLogin: (email, password) => client.post('/auth/admin-login', { email, password }),
  me: () => client.get('/auth/me'),
  deleteAccount: () => client.delete('/auth/account'),
}

// ---- Products ----
export const productsAPI = {
  list: () => client.get('/products/'),
  get: (id) => client.get(`/products/${id}`),
  create: (data) => client.post('/products/', data),
  update: (id, data) => client.patch(`/products/${id}`, data),
  delete: (id) => client.delete(`/products/${id}`),
  merge: (keepId, removeId) => client.post(`/products/${keepId}/merge/${removeId}`),
}

// ---- Inventory ----
export const inventoryAPI = {
  list: (lowStockOnly = false) => client.get('/inventory/', { params: { low_stock_only: lowStockOnly } }),
  alerts: () => client.get('/inventory/alerts'),
  adjust: (data) => client.post('/inventory/adjust', data),
  updateThreshold: (productId, threshold) =>
    client.patch(`/inventory/${productId}/threshold`, { reorder_threshold: threshold }),
  logs: (productId = null, limit = 50) =>
    client.get('/inventory/logs', { params: { product_id: productId, limit } }),
}

// ---- Transactions ----
export const transactionsAPI = {
  list: (type = null, limit = 50) => client.get('/transactions/', { params: { type, limit } }),
  create: (data) => client.post('/transactions/', data),
  createBulk: (items, customer_id = null) => client.post('/transactions/bulk', { items, customer_id }),
  // body: { items, customer_id, payment_method: CASH|CREDIT|NFC_SOUKCARD|NFC_BANK, card_number?, nfc_uid?, pin? }
  checkout: (body, idempotencyKey) =>
    client.post('/transactions/bulk', body, { headers: { 'Idempotency-Key': idempotencyKey } }),
  returnSale: (transactionId) => client.post(`/transactions/${transactionId}/return`),
}

// ---- Analytics ----
export const analyticsAPI = {
  dashboard: () => client.get('/analytics/dashboard'),
  salesChart: (days = 7) => client.get('/analytics/sales-chart', { params: { days } }),
  profit: (days = 30) => client.get('/analytics/profit', { params: { days } }),
  moneyReport: () => client.get('/analytics/money-report'),
  taxSummary: (monthOffset = 0) => client.get('/analytics/tax-summary', { params: { month_offset: monthOffset } }),
}

// ---- Export ----
export const exportAPI = {
  products: () => `${API_URL}/export/products`,
  transactions: (days = 30) => `${API_URL}/export/transactions?days=${days}`,
  profit: (days = 30) => `${API_URL}/export/profit?days=${days}`,
}

// ---- Merchants ----
export const merchantsAPI = {
  me: () => client.get('/merchants/me'),
  update: (data) => client.patch('/merchants/me', data),
  exportData: () => client.get('/merchants/me/export'),
  taxRates: () => client.get('/merchants/me/tax-rates'),
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
  placeOrder: (supplierId, items) =>
    client.post(`/suppliers/${supplierId}/order`, { items }),
  aggregate: (supplierId) => client.post(`/suppliers/${supplierId}/aggregate`),
  payOrder: (supplierId, orderId, method) =>
    client.post(`/suppliers/${supplierId}/orders/${orderId}/pay`, { method }),
  deleteOrder: (supplierId, orderId) =>
    client.delete(`/suppliers/${supplierId}/orders/${orderId}`),
}

// ---- Supplier Portal (fournisseur connecte) ----
export const supplierPortalAPI = {
  dashboard: () => client.get('/supplier-portal/dashboard'),
  orders: (status) => client.get('/supplier-portal/orders', { params: { status } }),
  updateOrderStatus: (orderId, status) => client.patch(`/supplier-portal/orders/${orderId}/status`, { status }),
  payments: () => client.get('/supplier-portal/payments'),
  catalog: () => client.get('/supplier-portal/catalog'),
  addCatalogItem: (data) => client.post('/supplier-portal/catalog', data),
  updateCatalogItem: (itemId, data) => client.patch(`/supplier-portal/catalog/${itemId}`, data),
  deleteCatalogItem: (itemId) => client.delete(`/supplier-portal/catalog/${itemId}`),
}

// ---- Supplier Chat ----
export const supplierChatAPI = {
  send: (message) => client.post('/supplier-chat/message', { message }),
}

// ---- Supplier Catalog ----
export const supplierCatalogAPI = {
  list: (supplierId) => client.get(`/supplier-catalog/${supplierId}`),
  // POST/PATCH/DELETE removed — suppliers manage their catalog via /supplier-portal/catalog
}

// ---- Employees ----
export const employeesAPI = {
  list: () => client.get('/employees/'),
  create: (data) => client.post('/employees/', data),
  update: (id, data) => client.patch(`/employees/${id}`, data),
  delete: (id) => client.delete(`/employees/${id}`),
  verifyPin: (id, pin) => client.post(`/employees/${id}/verify-pin`, { pin_code: pin }),
  contracts: (id) => client.get(`/employees/${id}/contracts`),
  addContract: (id, data) => client.post(`/employees/${id}/contracts`, data),
  updateContract: (empId, contractId, data) => client.patch(`/employees/${empId}/contracts/${contractId}`, data),
  deleteContract: (empId, contractId) => client.delete(`/employees/${empId}/contracts/${contractId}`),
}

// ---- Barcode Intelligence ----
export const barcodeAPI = {
  lookup: (barcode) => client.get(`/products/barcode-lookup/${barcode}`),
  expiring: (days = 3) => client.get('/products/expiring/soon', { params: { days } }),
}

// ---- Monthly Revenue ----
export const revenueAPI = {
  monthly: (months = 1) => client.get('/analytics/monthly-revenue', { params: { months } }),
}

// ---- Credit ----
export const creditAPI = {
  score: () => client.get('/credit/score'),
  offers: () => client.get('/credit/offers'),
  request: (data) => client.post('/credit/request', data),
}

// ---- Admin ----
export const adminAPI = {
  health: () => client.get('/health'),
  stats: () => client.get('/admin/stats'),
  merchants: () => client.get('/admin/merchants'),
  cards: () => client.get('/admin/cards'),
  payments: () => client.get('/admin/payments'),
  creditRequests: (status) => client.get('/admin/credit-requests', { params: { status } }),
  reviewCreditRequest: (id, data) => client.patch(`/admin/credit-requests/${id}`, data),
}

// ---- Customers (Carnet de credit) ----
export const customersAPI = {
  list: () => client.get('/customers/'),
  get: (id) => client.get(`/customers/${id}`),
  create: (data) => client.post('/customers/', data),
  update: (id, data) => client.patch(`/customers/${id}`, data),
  delete: (id) => client.delete(`/customers/${id}`),
  addEntry: (id, data) => client.post(`/customers/${id}/entries`, data),
  remind: (id) => client.post(`/customers/${id}/remind`),
}

// ---- Marketplace ----
export const marketplaceAPI = {
  browse: (params) => client.get('/marketplace/listings', { params }),
  myListings: () => client.get('/marketplace/my-listings'),
  createListing: (data) => client.post('/marketplace/listings', data),
  updateListing: (id, data) => client.patch(`/marketplace/listings/${id}`, data),
  deleteListing: (id) => client.delete(`/marketplace/listings/${id}`),
  createOrder: (data) => client.post('/marketplace/orders', data),
  buyingOrders: () => client.get('/marketplace/orders/buying'),
  sellingOrders: () => client.get('/marketplace/orders/selling'),
  updateOrderStatus: (id, status) => client.patch(`/marketplace/orders/${id}/status`, { status }),
}

// ---- Payments ----
export const paymentsAPI = {
  list: (status) => client.get('/payments/', { params: { status } }),
  create: (data) => client.post('/payments/', data),
  get: (id) => client.get(`/payments/${id}`),
  config: () => client.get('/payments/config/me'),
  updateConfig: (data) => client.patch('/payments/config/me', data),
}

// ---- Market Intelligence ----
export const marketAPI = {
  overview: () => client.get('/market/overview'),
  benchmark: () => client.get('/market/benchmark'),
  trendingProducts: (limit = 20) => client.get('/market/trending-products', { params: { limit } }),
  priceBenchmark: () => client.get('/market/price-benchmark'),
  trends: (weeks = 8) => client.get('/market/trends', { params: { weeks } }),
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
