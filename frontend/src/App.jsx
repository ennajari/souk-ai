import { Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"
import Layout from "./components/Layout"
import Login from "./pages/Login"
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
import POS from "./pages/POS"

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="sales" element={<Sales />} />
          <Route path="pos" element={<POS />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="forecasts" element={<Forecasts />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="credit" element={<Credit />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="settings" element={<Settings />} />
          <Route path="sage-import" element={<SageImport />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}
