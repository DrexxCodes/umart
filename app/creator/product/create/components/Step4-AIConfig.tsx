'use client'

import { useState } from 'react'
import { Plus, Trash2, Bot, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface FAQ {
  question: string
  answer: string
}

interface AIConfig {
  enabled: boolean
  tone: 'friendly' | 'professional' | 'playful' | 'firm'
  priceFloor: string
  faqs: FAQ[]
  customContext: string
}

interface Step4Props {
  data: {
    price: string
    aiConfig: AIConfig
  }
  onChange: (data: any) => void
  onNext: () => void
  onPrevious: () => void
}

const TONE_OPTIONS = [
  {
    value: 'friendly',
    label: 'Friendly',
    desc: 'Warm, approachable, conversational',
  },
  {
    value: 'professional',
    label: 'Professional',
    desc: 'Formal, clear, business-appropriate',
  },
  {
    value: 'playful',
    label: 'Playful',
    desc: 'Fun, energetic, uses light humour',
  },
  {
    value: 'firm',
    label: 'Firm',
    desc: 'Direct, minimal small talk, deal-focused',
  },
]

export function Step4AIConfig({ data, onChange, onNext, onPrevious }: Step4Props) {
  const [newFAQ, setNewFAQ] = useState<FAQ>({ question: '', answer: '' })
  const aiConfig = data.aiConfig

  const listedPrice = parseFloat(data.price) || 0

  const update = (partial: Partial<AIConfig>) => {
    onChange({ aiConfig: { ...aiConfig, ...partial } })
  }

  const addFAQ = () => {
    if (!newFAQ.question.trim() || !newFAQ.answer.trim()) return
    update({ faqs: [...aiConfig.faqs, { ...newFAQ }] })
    setNewFAQ({ question: '', answer: '' })
  }

  const removeFAQ = (index: number) => {
    update({ faqs: aiConfig.faqs.filter((_, i) => i !== index) })
  }

  const floorNum = parseFloat(aiConfig.priceFloor) || 0
  const floorPct = listedPrice > 0 ? Math.round((floorNum / listedPrice) * 100) : 0
  const floorValid = floorNum > 0 && floorNum <= listedPrice

  const canProceed = !aiConfig.enabled || (floorValid)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          Step 4: AI Negotiation Setup (Clara)
        </CardTitle>
        <CardDescription>
          Let our Clara handle price negotiations with buyers on your behalf
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/30">
          <div>
            <p className="font-medium text-sm">Enable Clara</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clara will respond to buyers and negotiate price in your chat
            </p>
          </div>
          <button
            type="button"
            onClick={() => update({ enabled: !aiConfig.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              aiConfig.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                aiConfig.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {aiConfig.enabled && (
          <>
            {/* Price Floor */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Minimum Acceptable Price (₦)
                <span className="text-destructive ml-1">*</span>
              </label>
              <Input
                type="number"
                value={aiConfig.priceFloor}
                onChange={(e) => update({ priceFloor: e.target.value })}
                placeholder={`e.g. ${Math.round(listedPrice * 0.8).toLocaleString()}`}
                min="0"
                max={listedPrice}
                step="500"
              />
              {aiConfig.priceFloor && (
                <p
                  className={`text-xs ${
                    floorValid ? 'text-muted-foreground' : 'text-destructive'
                  }`}
                >
                  {floorValid
                    ? `${floorPct}% of listed price — Clara will never accept below this amount`
                    : listedPrice > 0 && floorNum > listedPrice
                    ? 'Floor cannot exceed the listed price'
                    : 'Enter a valid floor price'}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Listed price: ₦{listedPrice.toLocaleString()} — Buyers will never see this
                number
              </p>
            </div>

            {/* Tone */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Negotiation Tone</label>
              <div className="grid grid-cols-2 gap-2">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update({ tone: opt.value as AIConfig['tone'] })}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      aiConfig.tone === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Context */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Extra Context for Clara{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                value={aiConfig.customContext}
                onChange={(e) => update({ customContext: e.target.value })}
                placeholder="E.g. Item is no longer under warranty. Willing to include a free case. Price is firm after first counter."
                rows={3}
                className="resize-none"
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {aiConfig.customContext.length}/1000
              </p>
            </div>

            {/* FAQs */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">
                  FAQs{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pre-answer common buyer questions so Clara replies accurately
                </p>
              </div>

              {aiConfig.faqs.length > 0 && (
                <div className="space-y-2">
                  {aiConfig.faqs.map((faq, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border bg-muted/20 p-3 flex gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Q: {faq.question}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          A: {faq.answer}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFAQ(i)}
                        className="text-destructive hover:text-destructive/80 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {aiConfig.faqs.length < 10 && (
                <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                  <Input
                    value={newFAQ.question}
                    onChange={(e) => setNewFAQ((p) => ({ ...p, question: e.target.value }))}
                    placeholder="Question e.g. Does it come with a charger?"
                  />
                  <Textarea
                    value={newFAQ.answer}
                    onChange={(e) => setNewFAQ((p) => ({ ...p, answer: e.target.value }))}
                    placeholder="Answer e.g. Yes, original charger and cable included."
                    rows={2}
                    className="resize-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addFAQ}
                    disabled={!newFAQ.question.trim() || !newFAQ.answer.trim()}
                    className="w-full bg-transparent"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add FAQ
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {!aiConfig.enabled && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              AI negotiation is off. Buyers will chat directly with you.
            </p>
          </div>
        )}
      </CardContent>

      <div className="flex gap-3 justify-between p-6 border-t border-border">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="w-full sm:w-auto bg-transparent"
        >
          Previous
        </Button>
        <Button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full sm:w-auto"
        >
          {aiConfig.enabled ? 'Publish Listing' : 'Publish Listing'}
        </Button>
      </div>
    </Card>
  )
}
