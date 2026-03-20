import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { HelpTooltip } from '@/components/HelpTooltip'
import { excelApi, getApiErrorDetail, type UploadResponse, type MultipleUploadResponse } from '@/lib/api'
import { useProfile } from '@/context/ProfileContext'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface UploadSectionProps {
  onUploadSuccess: (data: UploadResponse) => void
  onMultipleUploadSuccess?: (data: MultipleUploadResponse) => void
  onError?: (error: string) => void
  allowMultiple?: boolean
}

export function UploadSection({
  onUploadSuccess,
  onMultipleUploadSuccess,
  onError,
  allowMultiple = false,
}: UploadSectionProps) {
  const { config } = useProfile()
  const MAX_FILE_SIZE_MB = config.features.maxFileSize
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(
    (files: FileList | File[]) => {
      setValidationError(null)
      const fileArray = Array.from(files)
      const validFiles = fileArray.filter((f) => {
        const lower = f.name.toLowerCase()
        return lower.endsWith('.xlsx') || lower.endsWith('.csv')
      })
      const invalidCount = fileArray.length - validFiles.length
      if (invalidCount > 0) {
        setValidationError(`Only .xlsx and .csv files are supported. ${invalidCount} file(s) skipped.`)
      }
      const oversized = validFiles.filter((f) => f.size > MAX_FILE_SIZE_BYTES)
      if (oversized.length > 0) {
        setValidationError(
          `Some files exceed your ${MAX_FILE_SIZE_MB}MB profile limit: ${oversized.map((f) => f.name).join(', ')}`
        )
      }
      const toAdd = validFiles
      if (toAdd.length === 0 && fileArray.length > 0) {
        setValidationError('Please select Excel or CSV files (.xlsx, .csv)')
        return
      }
      if (allowMultiple) {
        setSelectedFiles((prev) => [...prev, ...toAdd])
      } else {
        setSelectedFiles(toAdd.slice(0, 1))
      }
    },
    [allowMultiple]
  )

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      handleFileSelect(files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileSelect(files)
    }
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return
    setValidationError(null)
    setIsUploading(true)
    setUploadProgress(10)
    try {
      if (selectedFiles.length === 1 && !allowMultiple) {
        const response = await excelApi.uploadFile(selectedFiles[0])
        setUploadProgress(100)
        onUploadSuccess(response)
      } else {
        const response = await excelApi.uploadMultipleFiles(selectedFiles)
        setUploadProgress(100)
        if (onMultipleUploadSuccess) {
          onMultipleUploadSuccess(response)
        } else if (response.files.length === 1) {
          onUploadSuccess(response.files[0])
        }
      }
    } catch (error: unknown) {
      const errorMessage = getApiErrorDetail(error) || 'Upload failed'
      onError?.(errorMessage)
      setValidationError(errorMessage)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleRemoveFile = (index?: number) => {
    if (index !== undefined) {
      setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    } else {
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
    setValidationError(null)
  }

  return (
    <Card className="w-full max-w-3xl border shadow-sm">
      <CardHeader className="border-b bg-muted/30 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Upload Excel File{allowMultiple ? 's' : ''}
          <HelpTooltip
            title="Header detection"
            content="We automatically detect which row contains column names. You can adjust this on the next step if needed."
            side="bottom"
          />
        </CardTitle>
        <CardDescription>
          {allowMultiple
            ? `Select or drag and drop one or more files (.xlsx, .csv). Max ${MAX_FILE_SIZE_MB}MB per file.`
            : `Select or drag and drop one file (.xlsx, .csv). Max ${MAX_FILE_SIZE_MB}MB.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {validationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Validation</AlertTitle>
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        <div
          data-tour="upload-area"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : selectedFiles.length > 0 ? 'border-primary/50 bg-muted/20' : 'border-muted-foreground/25 bg-muted/10'
          }`}
        >
          {selectedFiles.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-primary">
                <CheckCircle2 className="h-10 w-10" />
                <span className="font-medium">{selectedFiles.length} file(s) selected</span>
              </div>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.name}</p>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {formatFileSize(file.size)}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFile(index)}
                      disabled={isUploading}
                      className="shrink-0"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleRemoveFile()} disabled={isUploading} className="gap-2">
                <X className="h-4 w-4" />
                Clear all
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag and drop your Excel file here, or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                multiple={allowMultiple}
                onChange={handleFileInputChange}
                className="hidden"
                id="file-upload"
                disabled={isUploading}
              />
              <label htmlFor="file-upload">
                <Button type="button" variant="outline" asChild disabled={isUploading} className="gap-2">
                  <span>
                    <Upload className="h-4 w-4" />
                    Choose file
                  </span>
                </Button>
              </label>
            </div>
          )}
        </div>

        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              >
                <Upload className="h-4 w-4" />
              </motion.div>
              Uploading…
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {selectedFiles.length > 0 && (
          <Button onClick={handleUpload} disabled={isUploading} className="w-full gap-2" size="lg">
            {isUploading ? (
              <>
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="inline-flex"
                >
                  <Upload className="h-4 w-4" />
                </motion.div>
                Uploading…
              </>
            ) : (
              `Upload ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
