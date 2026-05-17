import { useState, useRef, useEffect } from 'react'
import { FiSend, FiMessageSquare, FiZap, FiPackage, FiTruck, FiDollarSign } from 'react-icons/fi'
import { supplierChatAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const SUGGESTIONS = [
  { icon: FiPackage, text: 'Resumé de mes commandes', color: 'violet' },
  { icon: FiTruck, text: 'Quelles commandes sont en attente ?', color: 'orange' },
  { icon: FiDollarSign, text: 'Combien j\'ai recu en paiements ?', color: 'green' },
  { icon: FiZap, text: 'Donne-moi des conseils business', color: 'blue' },
]

export default function SupplierChat() {
  const { merchant } = useAuth()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Salam ${merchant?.business_name || 'Fournisseur'} ! 👋\n\nAna l'assistant dyalek f Souk.AI. Goul liya chnou bghiti:\n\n• Resume dial les commandes\n• Commandes en attente\n• Suivi des paiements\n• Conseils business\n\nKteb liya message w ana njawbek! 🚀`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const res = await supplierChatAPI.send(msg)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        actions: res.data.actions || [],
      }])
    } catch (err) {
      const detail = err.response?.data?.detail || 'Erreur de connexion'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ ${detail}`,
      }])
      toast.error(detail)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <FiMessageSquare className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Assistant Fournisseur</h1>
          <p className="text-xs text-gray-500">Gerez vos commandes par chat intelligent</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-600 font-medium">En ligne</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-violet-600 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.actions?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200/30 space-y-1">
                  {msg.actions.map((a, j) => (
                    <div key={j} className={`text-xs flex items-center gap-1.5 ${
                      a.success ? 'text-green-600' : 'text-red-400'
                    }`}>
                      {a.success ? '✅' : '❌'} #{a.order_id} → {a.status || a.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions (only show when few messages) */}
      {messages.length <= 1 && (
        <div className="grid grid-cols-2 gap-2 pb-3">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s.text)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-violet-300 hover:bg-violet-50 transition text-left disabled:opacity-50"
            >
              <s.icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="line-clamp-1">{s.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-100 pt-3 pb-1">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ecrivez votre message..."
            rows={1}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-gray-50 max-h-32"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-40 disabled:hover:bg-violet-600 transition flex-shrink-0"
          >
            <FiSend className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-2">
          Assistant IA — Les reponses peuvent contenir des erreurs
        </p>
      </div>
    </div>
  )
}
