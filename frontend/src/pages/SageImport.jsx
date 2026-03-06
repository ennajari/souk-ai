import { useState, useRef } from "react"
import { FiUploadCloud, FiFileText, FiCheckCircle, FiAlertCircle, FiPackage, FiDollarSign, FiUsers, FiRefreshCw } from "react-icons/fi"
import { sageAPI } from "../api/client"

const importTypes = [
  {
    id: "articles",
    label: "Articles / Produits",
    description: "Importer la liste des articles avec prix et stock",
    icon: FiPackage,
    color: "violet",
    accept: ".csv,.txt",
  },
  {
    id: "sales",
    label: "Ventes / Factures",
    description: "Importer l'historique des ventes et factures",
    icon: FiDollarSign,
    color: "emerald",
    accept: ".csv,.txt",
  },
  {
    id: "auto",
    label: "Détection auto",
    description: "Souk.AI détecte automatiquement le type de fichier",
    icon: FiRefreshCw,
    color: "blue",
    accept: ".csv,.txt",
  },
]

export default function SageImport() {
  const [selectedType, setSelectedType] = useState(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const handleImport = async () => {
    if (!file || !selectedType) return
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      let res
      if (selectedType === "articles") {
        res = await sageAPI.importArticles(file)
      } else if (selectedType === "sales") {
        res = await sageAPI.importSales(file)
      } else {
        res = await sageAPI.importAuto(file)
      }
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'import")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setResult(null)
    setError(null)
    setSelectedType(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Sage 100</h1>
        <p className="text-gray-500 mt-1">
          Importez vos données depuis Sage 100 v7 — articles, ventes, clients
        </p>
      </div>

      {/* How to export from Sage */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-800 text-sm">Comment exporter depuis Sage 100 ?</h3>
        <ol className="mt-2 text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Ouvrez Sage 100 → Menu <strong>Fichier</strong> → <strong>Exporter</strong></li>
          <li>Choisissez le type: <strong>Articles</strong>, <strong>Ventes</strong>, ou <strong>Clients</strong></li>
          <li>Format: <strong>CSV</strong> (séparateur point-virgule)</li>
          <li>Encodage: <strong>Windows (ANSI)</strong> ou <strong>UTF-8</strong></li>
          <li>Enregistrez et uploadez le fichier ici</li>
        </ol>
      </div>

      {/* Step 1: Choose type */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">1. Type d'import</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {importTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => { setSelectedType(type.id); setResult(null); setError(null) }}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selectedType === type.id
                  ? `border-${type.color}-500 bg-${type.color}-50 shadow-md`
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <type.icon className={`h-6 w-6 mb-2 ${
                selectedType === type.id ? `text-${type.color}-600` : "text-gray-400"
              }`} />
              <p className="font-semibold text-sm text-gray-900">{type.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Upload file */}
      {selectedType && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">2. Fichier CSV</h2>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => { setFile(e.target.files[0]); setResult(null); setError(null) }}
            />
            <FiUploadCloud className="h-10 w-10 mx-auto text-gray-400 mb-3" />
            {file ? (
              <div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-gray-700">Cliquez pour choisir un fichier</p>
                <p className="text-sm text-gray-400 mt-1">CSV ou TXT — Export Sage 100</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Import button */}
      {file && selectedType && (
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={loading}
            className="px-6 py-2.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <FiRefreshCw className="h-4 w-4 animate-spin" />
                Import en cours...
              </>
            ) : (
              <>
                <FiUploadCloud className="h-4 w-4" />
                Importer
              </>
            )}
          </button>
          <button
            onClick={resetForm}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Réinitialiser
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <FiAlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Erreur d'import</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Success result */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FiCheckCircle className="h-5 w-5 text-emerald-600" />
            <p className="font-bold text-emerald-800">Import réussi !</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{result.total_parsed}</p>
              <p className="text-xs text-gray-500">Lignes lues</p>
            </div>
            {result.added !== undefined && (
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">+{result.added}</p>
                <p className="text-xs text-gray-500">Ajoutés</p>
              </div>
            )}
            {result.updated !== undefined && (
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                <p className="text-xs text-gray-500">Mis à jour</p>
              </div>
            )}
            {result.imported !== undefined && (
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{result.imported}</p>
                <p className="text-xs text-gray-500">Importées</p>
              </div>
            )}
            {result.skipped !== undefined && result.skipped > 0 && (
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                <p className="text-xs text-gray-500">Ignorées</p>
              </div>
            )}
          </div>

          {result.file_type && (
            <p className="text-sm text-emerald-700">
              Type détecté: <strong>{result.file_type}</strong>
            </p>
          )}

          {result.added_products?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700">Produits ajoutés:</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {result.added_products.map((name, i) => (
                  <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.updated_products?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700">Produits mis à jour:</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {result.updated_products.map((name, i) => (
                  <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Supported Sage formats */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h3 className="font-semibold text-gray-700 text-sm mb-2">Formats Sage 100 supportés</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
          <div>
            <p className="font-semibold text-gray-800 mb-1">Articles</p>
            <p>Reference, Designation, PrixVente, PrixAchat, Unite, CodeBarre, Stock</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">Ventes</p>
            <p>Date, NumPiece, Designation, Quantite, PrixUnitaire, MontantTTC</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">Clients</p>
            <p>NumClient, RaisonSociale, Adresse, Ville, Telephone, Email</p>
          </div>
        </div>
      </div>
    </div>
  )
}
