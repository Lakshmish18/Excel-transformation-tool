/**
 * Pipeline Builder: add/edit operations, validate, preview. Save/load in builder toolbar.
 */
import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PipelineBuilder } from '@/components/PipelineBuilder'
import { useApp } from '@/context/AppContext'
import { excelApi } from '@/lib/api'
import { addRecentTransformation, loadPipeline } from '@/lib/storage'
import { loadPipelineById } from '@/lib/supabase-pipelines'
import type { Operation } from '@/lib/api'
import { toast } from 'sonner'

export function PipelinePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const loadId = searchParams.get('load')
  const { uploadData, selectedSheet, operations, setOperations, setTransformResult } = useApp()
  const [columns, setColumns] = useState<string[]>([])
  const [loadedOperations, setLoadedOperations] = useState<Operation[] | undefined>(undefined)

  // Sync initial load from URL: try localStorage first, then Supabase
  useEffect(() => {
    if (!loadId) {
      setLoadedOperations(undefined)
      return
    }
    const fromStorage = loadPipeline(loadId)
    if (fromStorage?.operations?.length) {
      setLoadedOperations(fromStorage.operations as Operation[])
      return
    }
    loadPipelineById(loadId).then((p) => {
      if (p?.operations?.length) {
        setLoadedOperations(p.operations as Operation[])
        toast.success(`Pipeline "${p.name}" loaded`)
      }
    })
  }, [loadId])

  const initialOperations = useMemo(() => {
    if (loadedOperations?.length) return loadedOperations
    return operations?.length ? operations : undefined
  }, [loadedOperations, operations])

  useEffect(() => {
    if (!uploadData || !selectedSheet) {
      navigate('/preview', { replace: true })
      return
    }
    excelApi.previewSheet(uploadData.fileId, selectedSheet, 5)
      .then((res) => setColumns(res.columns || []))
      .catch(() => setColumns([]))
  }, [uploadData, selectedSheet, navigate])

  const handleTransformSuccess = (data: import('@/lib/api').TransformResponse) => {
    setTransformResult(data)
    if (uploadData) {
      addRecentTransformation({
        fileName: uploadData.fileName,
        operationsCount: operations.length,
        sheetName: selectedSheet,
      })
    }
    toast.success('Transformation preview ready')
    navigate('/results')
  }

  const handleError = (_message: string | unknown) => {
    // API interceptor already shows toast; use for inline display if needed
  }

  if (!uploadData || !selectedSheet) return null

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PipelineBuilder
        fileId={uploadData.fileId}
        sheetName={selectedSheet}
        columns={columns.length ? columns : uploadData.sheets.length ? [] : []}
        onTransformSuccess={handleTransformSuccess}
        onError={handleError}
        onOperationsChange={setOperations}
        initialOperations={initialOperations}
      />
    </div>
  )
}
