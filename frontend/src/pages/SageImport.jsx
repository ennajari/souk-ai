import { useState, useRef } from "react"
import { useTranslation } from 'react-i18next'
import { FiUploadCloud, FiFileText, FiCheckCircle, FiAlertCircle, FiPackage, FiDollarSign, FiRefreshCw } from "react-icons/fi"
import { sageAPI } from "../api/client"

const importTypes = [
  {
    id: "articles",
    label: "sage.typeArticles",
    description: "sage.typeArticlesDesc",
    icon: FiPackage,
    activeBorder: "border-brand-500 bg-brand-50 shadow-md",
    activeText: "text-brand-600",
    accept: ".csv,.txt",
  },
  {
    id: "sales",
    label: "sage.typeSales",
    description: "sage.typeSalesDesc",
    icon: FiDollarSign,
    activeBorder: "border-emerald-500 bg-emerald-50 shadow-md",
    activeText: "text-emerald-600",
    accept: ".csv,.txt",
  },
  {
    id: "auto",
    label: "sage.typeAuto",
    description: "sage.typeAutoDesc",
    icon: FiRefreshCw,
    activeBorder: "border-blue-500 bg-blue-50 shadow-md",
    activeText: "text-blue-600",
    accept: ".csv,.txt",
  },
]

export default function SageImport() {
  const { t } = useTranslation()
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
      setError(err.response?.data?.detail || t('common.error'))
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
        <h1 className="text-2xl font-bold text-gray-900">{t('nav.sageImport')}</h1>
        <p className="text-gray-500 mt-1">
          {t('sage.subtitle')}
        </p>
      </div>

      {/* How to export from Sage */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-800 text-sm">{t('sage.howTo')}</h3>
        <ol className="mt-2 text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>{t('sage.step1')}</li>
          <li>{t('sage.step2')}</li>
          <li>{t('sage.step3')}</li>
          <li>{t('sage.step4')}</li>
          <li>{t('sage.step5')}</li>
        </ol>
      </div>

      {/* Step 1: Choose type */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">1. {t('sage.importType')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {importTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => { setSelectedType(type.id); setResult(null); setError(null) }}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selectedType === type.id
                  ? type.activeBorder
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <type.icon className={`h-6 w-6 mb-2 ${
                selectedType === type.id ? type.activeText : "text-gray-500"
              }`} />
              <p className="font-semibold text-sm text-gray-900">{t(type.label)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t(type.description)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Upload file */}
      {selectedType && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">2. {t('sage.csvFile')}</h2>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => { setFile(e.target.files[0]); setResult(null); setError(null) }}
            />
            <FiUploadCloud className="h-10 w-10 mx-auto text-gray-500 mb-3" />
            {file ? (
              <div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-gray-700">{t('sage.chooseFile')}</p>
                <p className="text-sm text-gray-500 mt-1">{t('sage.fileHint')}</p>
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
            className="px-6 py-2.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <FiRefreshCw className="h-4 w-4 animate-spin" />
                {t('sage.importing')}
              </>
            ) : (
              <>
                <FiUploadCloud className="h-4 w-4" />
                {t('sage.import')}
              </>
            )}
          </button>
          <button
            onClick={resetForm}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            {t('sage.reset')}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <FiAlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">{t('sage.importError')}</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Success result */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FiCheckCircle className="h-5 w-5 text-emerald-600" />
            <p className="font-bold text-emerald-800">{t('sage.importOk')}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{result.total_parsed}</p>
              <p className="text-xs text-gray-500">{t('sage.rowsRead')}</p>
            </div>
            {result.added !== undefined && (
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">+{result.added}</p>
                <p className="text-xs text-gray-500">{t('sage.added')}</p>
              </div>
            )}
            {result.updated !== undefined && (
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                <p className="text-xs text-gray-500">{t('sage.updated')}</p>
              </div>
            )}
            {result.imported !== undefined && (
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{result.imported}</p>
                <p className="text-xs text-gray-500">{t('sage.imported')}</p>
              </div>
            )}
            {result.skipped !== undefined && result.skipped > 0 && (
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                <p className="text-xs text-gray-500">{t('sage.skipped')}</p>
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
              <p className="text-sm font-semibold text-gray-700">{t('sage.productsAdded')}</p>
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
              <p className="text-sm font-semibold text-gray-700">{t('sage.productsUpdated')}</p>
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
        <h3 className="font-semibold text-gray-700 text-sm mb-2">{t('sage.formats')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
          <div>
            <p className="font-semibold text-gray-800 mb-1">{t('sage.typeArticles')}</p>
            <p>Reference, Designation, PrixVente, PrixAchat, Unite, CodeBarre, Stock</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">{t('sage.typeSales')}</p>
            <p>Date, NumPiece, Designation, Quantite, PrixUnitaire, MontantTTC</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">{t('sage.customers')}</p>
            <p>NumClient, RaisonSociale, Adresse, Ville, Telephone, Email</p>
          </div>
        </div>
      </div>
    </div>
  )
}
