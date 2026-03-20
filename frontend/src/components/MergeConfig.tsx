import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { GitMerge, Play } from 'lucide-react'
import { excelApi, getApiErrorDetail, type MergeFilesRequest, type MergeFilesResponse, type UploadResponse } from '@/lib/api'

interface MergeConfigProps {
  files: UploadResponse[]
  onMergeSuccess: (mergedFile: MergeFilesResponse) => void
  onError?: (error: string) => void
}

export function MergeConfig({ files, onMergeSuccess, onError }: MergeConfigProps) {
  const [strategy, setStrategy] = useState<'append' | 'join' | 'union'>('append')
  const [joinColumn, setJoinColumn] = useState<string>('')
  const [joinType, setJoinType] = useState<'inner' | 'left' | 'right' | 'outer'>('inner')
  const [isMerging, setIsMerging] = useState(false)

  // Get all columns from first file's first sheet (simplified - could be enhanced)
  // const availableColumns: string[] = [] // Reserved for future use

  const handleMerge = async () => {
    if (strategy === 'join' && !joinColumn) {
      onError?.('Please specify a join column for join strategy')
      return
    }

    setIsMerging(true)
    try {
      const request: MergeFilesRequest = {
        fileIds: files.map(f => f.fileId),
        strategy,
        joinType: strategy === 'join' ? joinType : undefined,
        joinColumn: strategy === 'join' ? joinColumn : undefined,
      }

      const result = await excelApi.mergeFiles(request)
      onMergeSuccess(result)
    } catch (error: unknown) {
      onError?.(getApiErrorDetail(error))
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitMerge className="h-5 w-5" />
          Merge Configuration
        </CardTitle>
        <CardDescription>
          Configure how to combine {files.length} files
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="strategy">Merge Strategy</Label>
          <Select value={strategy} onValueChange={(value) => setStrategy(value as 'append' | 'join' | 'union')}>
            <SelectTrigger id="strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="append">Append Rows (Stack vertically)</SelectItem>
              <SelectItem value="join">Join by Column (SQL-like join)</SelectItem>
              <SelectItem value="union">Union (Combine all columns)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {strategy === 'append' && 'Stacks files vertically. Files must have same columns.'}
            {strategy === 'join' && 'Joins files horizontally on a common column.'}
            {strategy === 'union' && 'Combines all columns from all files.'}
          </p>
        </div>

        {strategy === 'join' && (
          <>
            <div>
              <Label htmlFor="join-column">Join Column</Label>
              <Input
                id="join-column"
                value={joinColumn}
                onChange={(e) => setJoinColumn(e.target.value)}
                placeholder="Enter column name to join on"
              />
            </div>
            <div>
              <Label htmlFor="join-type">Join Type</Label>
              <Select value={joinType} onValueChange={(value) => setJoinType(value as 'inner' | 'left' | 'right' | 'outer')}>
                <SelectTrigger id="join-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inner">Inner Join (Only matching rows)</SelectItem>
                  <SelectItem value="left">Left Join (All from first file)</SelectItem>
                  <SelectItem value="right">Right Join (All from second file)</SelectItem>
                  <SelectItem value="outer">Outer Join (All rows from both)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <Button
          onClick={handleMerge}
          disabled={isMerging || (strategy === 'join' && !joinColumn)}
          className="w-full"
        >
          {isMerging ? (
            <>Merging...</>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Merge Files
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

