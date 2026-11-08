import { FiSettings, FiServer, FiDatabase, FiGlobe } from 'react-icons/fi'

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Parametres systeme</h1>
        <p className="text-sm text-gray-500 mt-1">Configuration de la plateforme Souk.AI</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <FiServer className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Backend API</h3>
              <p className="text-xs text-green-600 font-medium">Operationnel</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="font-mono text-gray-900">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>Environnement</span>
              <span className="font-mono text-gray-900">Production</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FiDatabase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Base de donnees</h3>
              <p className="text-xs text-green-600 font-medium">Connectee</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Type</span>
              <span className="font-mono text-gray-900">PostgreSQL</span>
            </div>
            <div className="flex justify-between">
              <span>Cache</span>
              <span className="font-mono text-gray-900">Redis</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <FiGlobe className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Services externes</h3>
              <p className="text-xs text-green-600 font-medium">Actifs</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>WhatsApp Cloud API</span>
              <span className="text-green-600 font-semibold">Connecte</span>
            </div>
            <div className="flex justify-between">
              <span>OpenAI</span>
              <span className="text-green-600 font-semibold">Connecte</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <FiSettings className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Configuration</h3>
              <p className="text-xs text-gray-500">Parametres generaux</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Deploiement</span>
              <span className="font-mono text-gray-900">Docker Compose</span>
            </div>
            <div className="flex justify-between">
              <span>VPS</span>
              <span className="font-mono text-gray-900">{import.meta.env.VITE_SERVER_LABEL || "—"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
