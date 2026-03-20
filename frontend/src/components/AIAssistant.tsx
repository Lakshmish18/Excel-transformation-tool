import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Lightbulb,
  Send,
  Sparkles,
} from 'lucide-react'
import { excelApi, aiApi, getApiErrorDetail, type AIAssistantAnalysis, type Operation } from '@/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AIAssistantProps {
  fileId?: string
  sheetName?: string
  userProfile?: string
  onApplySuggestion?: (pipeline: Operation[]) => void
}

export function AIAssistant({
  fileId,
  sheetName,
  userProfile = 'general',
  onApplySuggestion,
}: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [analysis, setAnalysis] = useState<AIAssistantAnalysis | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [previewContext, setPreviewContext] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null)

  const lastAnalyzeKeyRef = useRef<string | null>(null)
  const scrollAnchorRef = useRef<HTMLDivElement>(null)

  const analyzeKey = useMemo(() => {
    if (!fileId || !sheetName) return null
    return `${fileId}|${sheetName}|${userProfile}`
  }, [fileId, sheetName, userProfile])

  useEffect(() => {
    if (!fileId || !sheetName || !analyzeKey) return

    let cancelled = false

    // Load a small preview context for chat/explanations.
    excelApi
      .previewSheet(fileId, sheetName, 10)
      .then((res) => {
        if (cancelled) return
        setPreviewContext({
          columns: res.columns,
          rows: res.rows,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        toast.error(getApiErrorDetail(err))
      })

    return () => {
      cancelled = true
    }
  }, [fileId, sheetName])

  useEffect(() => {
    if (!fileId || !sheetName || !analyzeKey) return
    if (lastAnalyzeKeyRef.current === analyzeKey) return

    lastAnalyzeKeyRef.current = analyzeKey
    setAnalysis(null)
    setMessages([])

    setIsLoading(true)
    aiApi
      .analyzeData({ fileId, sheetName, userProfile })
      .then((res) => {
        setAnalysis(res.analysis)
        setMessages([
          {
            role: 'assistant',
            content: res.analysis.summary || 'Here are your insights.',
            timestamp: new Date(),
          },
        ])
      })
      .catch((err: unknown) => {
        toast.error(getApiErrorDetail(err))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [fileId, sheetName, analyzeKey, userProfile])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  const sendMessage = async () => {
    if (!input.trim()) return
    if (!previewContext) return
    if (!fileId || !sheetName) return

    const userText = input.trim()
    const userMessage: Message = { role: 'user', content: userText, timestamp: new Date() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await aiApi.chat({
        message: userText,
        dataContext: {
          fileId,
          sheetName,
          ...previewContext,
          profile: userProfile,
          aiAnalysisSummary: analysis?.summary,
        },
      })
      const aiMessage: Message = { role: 'assistant', content: res.response, timestamp: new Date() }
      setMessages((prev) => [...prev, aiMessage])
    } catch (err: unknown) {
      toast.error(getApiErrorDetail(err))
    } finally {
      setIsLoading(false)
    }
  }

  const applySuggestion = () => {
    const pipeline = analysis?.suggested_pipeline ?? []
    if (!pipeline.length) return
    onApplySuggestion?.(pipeline)
    toast.success(`AI pipeline applied (${pipeline.length} operations)`)
  }

  const quickBadges = [
    { label: 'What should I do next?', value: 'What should I do next?' },
    { label: 'Explain the KPIs', value: 'Explain the KPIs for my dataset' },
    { label: "How's my data quality?", value: "How's my data quality? What should I fix first?" },
  ]

  if (!fileId || !sheetName) return null

  return (
    <div className="fixed bottom-4 right-4 w-[26rem] z-50">
      <Card className="shadow-2xl border-2 border-emerald-200">
        <CardHeader
          className="cursor-pointer bg-gradient-to-r from-emerald-50 to-sky-50 border-b"
          onClick={() => setIsOpen((v) => !v)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg">AI Assistant</CardTitle>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
            </div>
            {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </CardHeader>

        {isOpen && (
          <CardContent className="p-0">
            {/* Insights + apply */}
            {analysis && (
              <div className="p-4 bg-emerald-50 border-b space-y-3">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-emerald-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-900 mb-1">Quick Insights</p>
                    <ul className="text-xs space-y-1 text-emerald-800">
                      {analysis.insights?.slice(0, 3).map((insight, i) => (
                        <li key={i}>• {insight}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {analysis.suggested_pipeline?.length > 0 && (
                  <Button
                    onClick={applySuggestion}
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    Apply Suggested Pipeline ({analysis.suggested_pipeline.length} operations)
                  </Button>
                )}
              </div>
            )}

            {/* Chat */}
            <div className="h-72 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs opacity-70 mt-1">{msg.timestamp.toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}

              <div ref={scrollAnchorRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void sendMessage()
                  }}
                  placeholder={previewContext ? 'Ask about your data...' : 'Loading preview context...'}
                  disabled={isLoading || !previewContext}
                />
                <Button
                  onClick={() => void sendMessage()}
                  disabled={isLoading || !input.trim() || !previewContext}
                  size="icon"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Quick Questions */}
              <div className="flex gap-2 mt-2 flex-wrap">
                {quickBadges.map((b) => (
                  <Badge
                    key={b.label}
                    variant="outline"
                    className="cursor-pointer hover:bg-emerald-50"
                    onClick={() => setInput(b.value)}
                  >
                    {b.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

