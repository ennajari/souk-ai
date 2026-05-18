import { Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"
import Layout from "./components/Layout"
import AdminLayout from "./components/AdminLayout"
import Landing from "./pages/Landing"
import Login from "./pages/Login"
import AdminLogin from "./pages/AdminLogin"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import Products from "./pages/Products"
import Inventory from "./pages/Inventory"
import Sales from "./pages/Sales"
import Analytics from "./pages/Analytics"
import Settings from "./pages/Settings"
import Forecasts from "./pages/Forecasts"
import Suppliers from "./pages/Suppliers"
import Credit from "./pages/Credit"
import SageImport from "./pages/SageImport"
import AdminDashboard from "./pages/AdminDashboard"
import AdminMerchants from "./pages/AdminMerchants"
import AdminCards from "./pages/AdminCards"
import AdminPayments from "./pages/AdminPayments"
import AdminCreditRequests from "./pages/AdminCreditRequests"
import AdminSettings from "./pages/AdminSettings"
import POS from "./pages/POS"
import Customers from "./pages/Customers"
import Profit from "./pages/Profit"
import Notifications from "./pages/Notifications"
import CoachIA from "./pages/CoachIA"
import Employees from "./pages/Employees"
import Catalogue from "./pages/Catalogue"
import CataloguePublic from "./pages/CataloguePublic"
import Marketplace from "./pages/Marketplace"
import Payments from "./pages/Payments"
import MarketIntelligence from "./pages/MarketIntelligence"

import SupplierDashboard from "./pages/SupplierDashboard"
import SupplierOrders from "./pages/SupplierOrders"
import SupplierPayments from "./pages/SupplierPayments"
import SupplierChat from "./pages/SupplierChat"
import SupplierSettings from "./pages/SupplierSettings"
import { useAuth } from "./context/AuthContext"

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

export default function App() {
  return (
    <AuthProvider>
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
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="sales" element={<Sales />} />
          <Route path="pos" element={<POS />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="forecasts" element={<Forecasts />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="credit" element={<Credit />} />
          <Route path="customers" element={<Customers />} />
          <Route path="profit" element={<Profit />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="coach" element={<CoachIA />} />
          <Route path="employees" element={<Employees />} />
          <Route path="my-catalogue" element={<Catalogue />} />
          <Route path="settings" element={<Settings />} />
          <Route path="sage-import" element={<SageImport />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="payments" element={<Payments />} />
          <Route path="market-intelligence" element={<MarketIntelligence />} />

          {/* ── Supplier-only pages ── */}
          <Route path="supplier-dashboard" element={<SupplierRoute><SupplierDashboard /></SupplierRoute>} />
          <Route path="supplier-orders" element={<SupplierRoute><SupplierOrders /></SupplierRoute>} />
          <Route path="supplier-payments" element={<SupplierRoute><SupplierPayments /></SupplierRoute>} />
          <Route path="supplier-chat" element={<SupplierRoute><SupplierChat /></SupplierRoute>} />
          <Route path="supplier-settings" element={<SupplierRoute><SupplierSettings /></SupplierRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
