import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileSpreadsheet, X } from 'lucide-react'
import { excelApi, type UploadResponse } from '@/lib/api'
import { toast } from 'sonner'
import { getApiErrorDetail } from '@/lib/api'
import { useProfile } from '@/context/ProfileContext'

interface FileUploadProps {
  onUploadSuccess: (data: UploadResponse) => void
  onError?: (error: string) => void
}

export function FileUpload({ onUploadSuccess, onError }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { config } = useProfile()

  const MAX_FILE_SIZE = config.features.maxFileSize * 1024 * 1024

  const validateFile = (file: File): string | null => {
    const validExtensions = ['.xlsx', '.csv']
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!validExtensions.includes(ext)) {
      return 'Only .xlsx and .csv files are supported'
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Your profile allows up to ${config.features.maxFileSize}MB`
    }
    return null
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const err = validateFile(file)
      if (err) {
        toast.error(err)
        onError?.(err)
        return
      }
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    const err = validateFile(selectedFile)
    if (err) {
      toast.error(err)
      onError?.(err)
      return
    }

    setIsUploading(true)
    try {
      const response = await excelApi.uploadFile(selectedFile)
      onUploadSuccess(response)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: unknown) {
      onError?.(getApiErrorDetail(error))
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Upload Excel File
        </CardTitle>
        <CardDescription>
          Select an Excel (.xlsx) or CSV file (max 50MB) to get started
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
            disabled={isUploading}
          />
          <label htmlFor="file-upload">
            <Button
              type="button"
              variant="outline"
              asChild
              disabled={isUploading}
            >
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Choose File
              </span>
            </Button>
          </label>
          
          {selectedFile && (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-muted-foreground truncate">
                {selectedFile.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleRemoveFile}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {selectedFile && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full gap-2"
          >
            {isUploading ? (
              <>
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="inline-flex"
                >
                  <Upload className="h-4 w-4" />
                </motion.div>
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload File
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

