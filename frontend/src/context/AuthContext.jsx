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
        .then((res) => setMerchant(res.data))
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
