"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { generatePDF, generateBulkPDFs } from "@/lib/pdf-generator"

/* ------------------------------------------------------------------ */
/*  Bulk Offer Generation Dashboard – single–file client component    */
/* ------------------------------------------------------------------ */

function BulkOfferDashboard() {
  /* ------------- state ------------- */
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [templateContent, setTemplateContent] = useState<string>("")
  const [activeStep, setActiveStep] = useState(1)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [availableFields, setAvailableFields] = useState<string[]>([])
  const [mappedFields, setMappedFields] = useState<Record<string, string>>({})
  const [templateFields, setTemplateFields] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStats, setGenerationStats] = useState({ total: 0, processing: 0, completed: 0, failed: 0 })

  const [showFullPreview, setShowFullPreview] = useState(false)

  const excelInputRef = useRef<HTMLInputElement>(null)
  const templateInputRef = useRef<HTMLInputElement>(null)

  // Fix Next.js hydration issue
  useEffect(() => {
    setMounted(true)
  }, [])

  /* ------------- helpers ------------- */
  const parseCsv = (text: string) => {
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean)
    const headers = headerLine.split(",").map((h) => h.trim().replace(/"/g, ""))
    const rows = lines.map((l) => {
      const cols = l.split(",").map((c) => c.trim().replace(/"/g, ""))
      return headers.reduce((acc, h, idx) => ({ ...acc, [h]: cols[idx] || "" }), {})
    })
    setPreviewData(rows)
    setAvailableFields(headers)
  }

  // Extract placeholders from template content
  const extractPlaceholders = (content: string): string[] => {
    const placeholderRegex = /\{\{([^}]+)\}\}/g
    const matches = []
    let match
    while ((match = placeholderRegex.exec(content)) !== null) {
      matches.push(match[0]) // Include the full {{placeholder}} format
    }
    return [...new Set(matches)] // Remove duplicates
  }

  /* ------------- file handlers ------------- */
  const handleExcel = (file: File) => {
    setExcelFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      const txt = e.target?.result as string
      if (file.name.toLowerCase().endsWith(".csv")) parseCsv(txt)
      else alert("Only CSV parsing is implemented in this demo.")
      if (activeStep === 1) setActiveStep(2)
    }
    reader.readAsText(file)
  }

  const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleExcel(e.target.files[0])
  }

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0]
      setTemplateFile(file)

      // Read the file content
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string

        // For Word documents, we'll simulate reading the content
        // In a real implementation, you'd use a library like mammoth.js
        if (file.name.toLowerCase().includes(".doc")) {
          // Simulate Word document content extraction
          alert(
            `Word document detected: ${file.name}\n\nFor this demo, please:\n1. Open your Word document\n2. Copy all content (Ctrl+A, Ctrl+C)\n3. Paste it in the text area that will appear`,
          )

          // Show a text area for manual content input
          const userContent = prompt(
            `Please paste your Word document content here:\n\n(Include placeholders like {{name}}, {{Ref_number}}, etc.)`,
          )

          if (userContent) {
            setTemplateContent(userContent)
            const placeholders = extractPlaceholders(userContent || content)
            setTemplateFields(placeholders)

            if (activeStep === 2) setActiveStep(3)
          }
        } else {
          // Handle text files
          setTemplateContent(content)
          const placeholders = extractPlaceholders(content)
          setTemplateFields(placeholders)

          if (activeStep === 2) setActiveStep(3)
        }
      }

      reader.readAsText(file)
    }
  }

  /* ------------- mapping helpers ------------- */
  const autoMap = () => {
    const next: Record<string, string> = {}
    templateFields.forEach((t) => {
      const clean = t.replace(/[{}]/g, "").toLowerCase()
      const match = availableFields.find((f) => f.toLowerCase() === clean)
      if (match) next[t] = match
    })
    setMappedFields(next)
  }

  /* ------------- generation (mock) ------------- */
  const startGeneration = () => {
    setActiveStep(4)
    setGenerationStats({ total: previewData.length, processing: 1, completed: 0, failed: 0 })
    let pct = 0
    const timer = setInterval(() => {
      pct += 10
      setGenerationProgress(pct)
      setGenerationStats((s) => ({
        ...s,
        processing: pct < 100 ? 1 : 0,
        completed: Math.floor((pct / 100) * previewData.length),
      }))
      if (pct >= 100) clearInterval(timer)
    }, 250)
  }

  /* ------------- ui pieces ------------- */

  const Step = ({ n, label }: { n: number; label: string }) => (
    <div className="flex items-center">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white ${n <= activeStep ? "bg-blue-600" : "bg-gray-300"}`}
      >
        {n}
      </div>
      <span className={`ml-2 text-sm ${n <= activeStep ? "text-blue-600" : "text-gray-400"}`}>{label}</span>
      {n < 4 && <div className={`mx-2 h-1 w-10 ${n < activeStep ? "bg-blue-600" : "bg-gray-300"}`} />}
    </div>
  )

  /* ------------- download functions ------------- */
  const downloadSinglePDF = (rowData: any, index: number) => {
    try {
      // Use student name and reference number format: NAME_REF_NUMBER.pdf
      const studentName = rowData.name || rowData.Name || `Student_${index + 1}`
      const refNumber = rowData.Ref_number || rowData.ref_number || `REF${String(index + 1).padStart(3, "0")}`

      // Clean the student name for filename
      const cleanName = studentName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")
      const fileName = `${cleanName}_${refNumber}.pdf`

      if (!templateContent) {
        alert("No template content found! Please upload a template first.")
        return
      }

      // Generate the PDF using jsPDF
      generatePDF(templateContent, rowData, mappedFields, fileName)

      // Show success message
      alert(`✅ Downloaded: ${fileName}\n\nPDF file generated successfully with your template format and ${studentName}'s data!`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert(`❌ Error generating PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const downloadAllAsZip = () => {
    try {
      if (!templateContent) {
        alert("No template content found! Please upload a template first.")
        return
      }

      // Generate all PDFs
      generateBulkPDFs(templateContent, previewData, mappedFields)
      
      alert(
        `📦 Generated ${previewData.length} personalized offer letters!\n\n✅ Each file uses your exact template format with individual student data!`,
      )
    } catch (error) {
      console.error('Error generating bulk PDFs:', error)
      alert(`❌ Error generating PDFs: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const downloadAllAsPDF = () => {
    alert("📄 This feature will create a combined PDF with all offer letters. Use 'Download All as ZIP' for individual files.")
  }

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return null
  }

  /* ------------- component ------------- */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto p-4 flex justify-between">
          <h1 className="text-2xl font-bold">Bulk Offer Generator</h1>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Beta</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {/* progress */}
        <div className="flex justify-center gap-2">
          <Step n={1} label="Upload Excel" />
          <Step n={2} label="Select Template" />
          <Step n={3} label="Map Fields" />
          <Step n={4} label="Generate PDFs" />
        </div>

        {/* step 1 – excel */}
        <section className={`${activeStep !== 1 && "opacity-60 pointer-events-none"}`}>
          <h2 className="font-semibold text-lg mb-2">1. Upload Student Data (CSV)</h2>
          <div
            onClick={() => excelInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded p-8 text-center cursor-pointer hover:border-blue-500"
          >
            <input ref={excelInputRef} type="file" accept=".csv" className="hidden" onChange={handleExcelChange} />
            <p className="text-5xl">📊</p>
            <p className="mt-4">Click or drag CSV here</p>
          </div>
          {excelFile && (
            <p className="mt-2 text-sm text-gray-600">
              Loaded&nbsp;
              <span className="font-medium">{excelFile.name}</span>
            </p>
          )}
        </section>

        {/* preview */}
        {previewData.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Data preview</h3>
              <button onClick={() => setShowFullPreview((s) => !s)} className="text-sm text-blue-600">
                {showFullPreview ? "Collapse" : "Expand"}
              </button>
            </div>
            <div className="overflow-x-auto border rounded bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {Object.keys(previewData[0]).map((h) => (
                      <th key={h} className="p-2 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, showFullPreview ? previewData.length : 5).map((row, i) => (
                    <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                      {Object.values(row).map((c, j) => (
                        <td key={j} className="p-2 whitespace-nowrap truncate max-w-xs">
                          {String(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* step 2 – template */}
        <section className={`${activeStep < 2 && "opacity-60 pointer-events-none"}`}>
          <h2 className="font-semibold text-lg mb-2">2. Upload Offer Template</h2>
          <div
            onClick={() => templateInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded p-8 text-center cursor-pointer hover:border-blue-500"
          >
            <input
              ref={templateInputRef}
              type="file"
              accept=".docx,.doc,.txt"
              className="hidden"
              onChange={handleTemplateChange}
            />
            <p className="text-5xl">📄</p>
            <p className="mt-4">Click or drag your offer template here</p>
            <p className="text-sm text-gray-500 mt-2">Supports: .docx, .doc, .txt</p>
          </div>
          {templateFile && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <p className="text-sm text-gray-600 mb-2">
                ✅ Loaded template: <span className="font-medium">{templateFile.name}</span>
              </p>

              {/* Template Preview */}
              {templateContent && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">📋 Your Template Content:</h4>
                  <div className="bg-white border p-4 rounded text-sm max-h-64 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-xs">{templateContent}</pre>
                  </div>

                  {templateFields.length > 0 && (
                    <div className="mt-3">
                      <h5 className="font-medium text-sm mb-2">🔍 Found Placeholders:</h5>
                      <div className="flex flex-wrap gap-2">
                        {templateFields.map((field) => (
                          <span key={field} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* step 3 – mapping */}
        {templateFields.length > 0 && (
          <section className={`${activeStep < 3 && "opacity-60 pointer-events-none"}`}>
            <h2 className="font-semibold text-lg mb-4 flex justify-between items-center">
              3. Map Fields
              <button onClick={autoMap} className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200">
                Auto-map
              </button>
            </h2>

            {templateFields.length > 0 && Object.keys(mappedFields).length < templateFields.length && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <h4 className="font-medium text-sm text-yellow-800 mb-2">⚠️ Unmapped Fields:</h4>
                <div className="flex flex-wrap gap-2">
                  {templateFields
                    .filter((field) => !mappedFields[field])
                    .map((field) => (
                      <span key={field} className="bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded">
                        {field}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {templateFields.map((t) => (
              <div key={t} className="flex items-center gap-4 mb-2">
                <span className="w-40 text-sm font-mono bg-gray-100 px-2 py-1 rounded">{t}</span>
                <select
                  value={mappedFields[t] || ""}
                  onChange={(e) => setMappedFields({ ...mappedFields, [t]: e.target.value })}
                  className="border p-1 rounded flex-1"
                >
                  <option value="">— select column —</option>
                  {availableFields.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
            ))}

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h4 className="font-medium text-sm">Mapping Progress</h4>
                  <p className="text-xs text-gray-600">
                    {Object.keys(mappedFields).length} of {templateFields.length} fields mapped
                  </p>
                </div>
                <div className="text-right">
                  <div
                    className={`inline-block w-3 h-3 rounded-full ${
                      Object.keys(mappedFields).length === templateFields.length ? "bg-green-500" : "bg-yellow-500"
                    } mr-2`}
                  ></div>
                  <span className="text-sm">
                    {Object.keys(mappedFields).length === templateFields.length ? "Ready!" : "Mapping Required"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setActiveStep(4)}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                  Object.keys(mappedFields).length === templateFields.length
                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
                disabled={Object.keys(mappedFields).length !== templateFields.length}
              >
                {Object.keys(mappedFields).length === templateFields.length
                  ? "🚀 Continue to Generation"
                  : `Map ${templateFields.length - Object.keys(mappedFields).length} more fields to continue`}
              </button>

              {Object.keys(mappedFields).length !== templateFields.length && (
                <p className="text-xs text-red-600 mt-2 text-center">⚠️ Please map all template fields to proceed</p>
              )}
            </div>
          </section>
        )}

        {/* step 4 – generation */}
        {activeStep === 4 && (
          <section>
            <h2 className="font-semibold text-lg mb-2">4. Generate Personalized Offers</h2>
            <button onClick={startGeneration} className="bg-blue-600 text-white px-4 py-2 rounded">
              🚀 Start generation ({previewData.length} files)
            </button>

            {generationProgress > 0 && (
              <div className="mt-4">
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div className="h-full bg-blue-600 rounded" style={{ width: `${generationProgress}%` }} />
                </div>
                <p className="mt-1 text-sm">{generationProgress}%</p>
              </div>
            )}

            {generationProgress === 100 && (
              <div className="mt-6 space-y-4">
                <h3 className="font-medium">📥 Download Your Personalized Offers</h3>

                {/* Bulk Download Options */}
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={downloadAllAsZip}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2"
                  >
                    📦 Download All Individual PDFs
                  </button>
                  <button
                    onClick={downloadAllAsPDF}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center gap-2"
                  >
                    📄 Download Combined PDF
                  </button>
                </div>

                {/* Individual Files List */}
                <div className="border rounded bg-white">
                  <div className="p-3 border-b bg-gray-50">
                    <h4 className="font-medium text-sm">✅ Individual Files Ready ({previewData.length})</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Each file uses your exact template format with personalized data
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {previewData.map((row, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border-b hover:bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="text-red-500">📄</span>
                          <span className="text-sm">
                            {(row.name || row.Name || `Student ${index + 1}`).replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")}_
                            {row.Ref_number || row.ref_number || `REF${String(index + 1).padStart(3, "0")}`}.pdf
                          </span>
                        </div>
                        <button
                          onClick={() => downloadSinglePDF(row, index)}
                          className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded hover:bg-blue-50"
                        >
                          📥 Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

// Export as dynamic component to prevent SSR issues
export default dynamic(() => Promise.resolve(BulkOfferDashboard), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading Bulk Offer Generator...</p>
      </div>
    </div>
  )
})