import { lazy, Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"
import Layout from "./components/Layout"
import AdminLayout from "./components/AdminLayout"
const Landing = lazy(() => import("./pages/Landing"))
const Login = lazy(() => import("./pages/Login"))
const AdminLogin = lazy(() => import("./pages/AdminLogin"))
const Register = lazy(() => import("./pages/Register"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const Products = lazy(() => import("./pages/Products"))
const Sales = lazy(() => import("./pages/Sales"))
const Reports = lazy(() => import("./pages/Reports"))
const Settings = lazy(() => import("./pages/Settings"))
const Suppliers = lazy(() => import("./pages/Suppliers"))
const SageImport = lazy(() => import("./pages/SageImport"))
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"))
const AdminMerchants = lazy(() => import("./pages/AdminMerchants"))
const AdminCards = lazy(() => import("./pages/AdminCards"))
const AdminPayments = lazy(() => import("./pages/AdminPayments"))
const AdminCreditRequests = lazy(() => import("./pages/AdminCreditRequests"))
const AdminSettings = lazy(() => import("./pages/AdminSettings"))
const POS = lazy(() => import("./pages/POS"))
const Customers = lazy(() => import("./pages/Customers"))
const Notifications = lazy(() => import("./pages/Notifications"))
const CoachIA = lazy(() => import("./pages/CoachIA"))
const Employees = lazy(() => import("./pages/Employees"))
const Catalogue = lazy(() => import("./pages/Catalogue"))
const CataloguePublic = lazy(() => import("./pages/CataloguePublic"))
const Marketplace = lazy(() => import("./pages/Marketplace"))
const Payments = lazy(() => import("./pages/Payments"))
const MarketIntelligence = lazy(() => import("./pages/MarketIntelligence"))

const SupplierDashboard = lazy(() => import("./pages/SupplierDashboard"))
const SupplierOrders = lazy(() => import("./pages/SupplierOrders"))
const SupplierPayments = lazy(() => import("./pages/SupplierPayments"))
const SupplierChat = lazy(() => import("./pages/SupplierChat"))
const SupplierSettings = lazy(() => import("./pages/SupplierSettings"))
const SupplierCatalog = lazy(() => import("./pages/SupplierCatalog"))
import { useAuth } from "./context/AuthContext"

// Pages are split per route: the till only downloads what it shows (was one 1.2 MB bundle — AUDIT U1)
function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      <span className="sr-only">Chargement…</span>
    </div>
  )
}

function AdminRoute({ children }) {
  const { merchant } = useAuth()
  if (!merchant?.is_admin) return <Navigate to="/dashboard" replace />
  return children
}

function SupplierRoute({ children }) {
  const { merchant } = useAuth()
  if (merchant?.account_type !== 'SUPPLIER') return <Navigate to="/dashboard" replace />
  return children
}

function MerchantRoute({ children }) {
  const { merchant } = useAuth()
  if (merchant?.account_type === 'SUPPLIER') return <Navigate to="/supplier-dashboard" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── Public pages ── */}
        <Route path="/" element={<Landing />} />
        <Route path="/catalogue/:merchantId" element={<CataloguePublic />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/register" element={<Register />} />

        {/* ── Admin pages — separate layout ── */}
        <Route
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            </ProtectedRoute>
          }
        >
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/merchants" element={<AdminMerchants />} />
          <Route path="admin/cards" element={<AdminCards />} />
          <Route path="admin/payments" element={<AdminPayments />} />
          <Route path="admin/credit-requests" element={<AdminCreditRequests />} />
          <Route path="admin/settings" element={<AdminSettings />} />
        </Route>

        {/* ── Merchant & Supplier pages — shared layout with conditional sidebar ── */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* ── Merchant-only pages ── */}
          <Route path="dashboard" element={<MerchantRoute><Dashboard /></MerchantRoute>} />
          <Route path="products" element={<MerchantRoute><Products /></MerchantRoute>} />
          <Route path="inventory" element={<Navigate to="/products" replace />} />
          <Route path="sales" element={<MerchantRoute><Sales /></MerchantRoute>} />
          <Route path="pos" element={<MerchantRoute><POS /></MerchantRoute>} />
          <Route path="reports" element={<MerchantRoute><Reports /></MerchantRoute>} />
          <Route path="analytics" element={<Navigate to="/reports?tab=sales" replace />} />
          <Route path="forecasts" element={<Navigate to="/reports?tab=restock" replace />} />
          <Route path="suppliers" element={<MerchantRoute><Suppliers /></MerchantRoute>} />
          {/* Removed: loan offers were mock data (no licensed lending partner yet) — docs/audit/DECISIONS.md D13 */}
          <Route path="credit" element={<Navigate to="/dashboard" replace />} />
          <Route path="customers" element={<MerchantRoute><Customers /></MerchantRoute>} />
          <Route path="profit" element={<Navigate to="/reports?tab=margins" replace />} />
          <Route path="coach" element={<MerchantRoute><CoachIA /></MerchantRoute>} />
          <Route path="employees" element={<MerchantRoute><Employees /></MerchantRoute>} />
          <Route path="my-catalogue" element={<MerchantRoute><Catalogue /></MerchantRoute>} />
          <Route path="sage-import" element={<MerchantRoute><SageImport /></MerchantRoute>} />
          <Route path="marketplace" element={<MerchantRoute><Marketplace /></MerchantRoute>} />
          {/* Admin only until benchmarks are anonymised (k >= 5 merchants) — D14 */}
          <Route path="market-intelligence" element={<AdminRoute><MarketIntelligence /></AdminRoute>} />

          {/* ── Shared pages (both merchant & supplier) ── */}
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
          <Route path="payments" element={<Payments />} />

          {/* ── Supplier-only pages ── */}
          <Route path="supplier-dashboard" element={<SupplierRoute><SupplierDashboard /></SupplierRoute>} />
          <Route path="supplier-orders" element={<SupplierRoute><SupplierOrders /></SupplierRoute>} />
          <Route path="supplier-catalog" element={<SupplierRoute><SupplierCatalog /></SupplierRoute>} />
          <Route path="supplier-payments" element={<SupplierRoute><SupplierPayments /></SupplierRoute>} />
          <Route path="supplier-chat" element={<SupplierRoute><SupplierChat /></SupplierRoute>} />
          <Route path="supplier-settings" element={<SupplierRoute><SupplierSettings /></SupplierRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AuthProvider>
  )
}
