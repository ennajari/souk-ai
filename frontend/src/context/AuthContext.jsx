import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [merchant, setMerchant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      authAPI.me()
        .then((res) => {
          const saved = JSON.parse(localStorage.getItem('merchant') || '{}')
          setMerchant({ ...res.data, is_admin: res.data.is_admin ?? saved.is_admin })
        })
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('merchant')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = (token, merchantData) => {
    localStorage.setItem('token', token)
    localStorage.setItem('merchant', JSON.stringify(merchantData))
    setMerchant(merchantData)
    // The login response is minimal: fetch the profile (currency, country…) right away
    authAPI.me().then((res) => setMerchant((m) => ({ ...m, ...res.data, is_admin: m?.is_admin }))).catch(() => {})
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('merchant')
    setMerchant(null)
  }

  return (
    <AuthContext.Provider value={{ merchant, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
