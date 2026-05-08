'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuth } from 'firebase/auth'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, CheckCircle2, Loader2, ChevronDown, Bot, Plus, Trash2, Sparkles } from 'lucide-react'
import { AdditionalInfo } from '../../create/components/AdditionalInfo'

interface ProductAge {
  value: number
  unit: 'days' | 'months' | 'years'
}

interface FAQ {
  question: string
  answer: string
}

interface AIConfig {
  enabled: boolean
  tone: 'friendly' | 'professional' | 'playful' | 'firm'
  priceFloor: number
  faqs: FAQ[]
  customContext: string
}

interface ProductData {
  id: string
  title: string
  category: string
  brand: string
  model: string
  location: string
  price: number
  condition: string
  productAge: ProductAge
  description: string
  defects: string
  additionalInfo: Record<string, string | number>
  images: string[]
  aiConfig?: AIConfig
}

const CONDITIONS = ['New', 'Neatly Used', 'Used', 'Damaged']
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo',
  'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
  'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
  'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'Federal Capital Territory',
]

const TONE_OPTIONS = [
  { value: 'friendly', label: 'Friendly', desc: 'Warm, approachable, conversational' },
  { value: 'professional', label: 'Professional', desc: 'Formal, clear, business-appropriate' },
  { value: 'playful', label: 'Playful', desc: 'Fun, energetic, uses light humour' },
  { value: 'firm', label: 'Firm', desc: 'Direct, minimal small talk, deal-focused' },
]

const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: false,
  tone: 'friendly',
  priceFloor: 0,
  faqs: [],
  customContext: '',
}

interface EditProductClientProps {
  productId: string
}

export function EditProductClient({ productId }: EditProductClientProps) {
  const router = useRouter()
  const [product, setProduct] = useState<ProductData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Clara FAQ input state
  const [newFAQ, setNewFAQ] = useState<FAQ>({ question: '', answer: '' })

  useEffect(() => {
    fetchProduct()
  }, [])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      setError('')
      const auth = getAuth()
      const user = auth.currentUser

      if (!user) {
        router.push('/auth/login')
        return
      }

      const token = await user.getIdToken()
      const response = await fetch(`/api/creator/product/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const result = await response.json()

      if (result.success) {
        setProduct({
          ...result.data,
          productAge: result.data.productAge || { value: 0, unit: 'months' as const },
          additionalInfo: result.data.additionalInfo || {},
          defects: result.data.defects || '',
          aiConfig: result.data.aiConfig
            ? {
                ...DEFAULT_AI_CONFIG,
                ...result.data.aiConfig,
                // Normalise — API stores priceFloor as number
                priceFloor: result.data.aiConfig.priceFloor ?? 0,
              }
            : { ...DEFAULT_AI_CONFIG },
        })
      } else {
        setError(result.error || 'Failed to fetch product')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = <K extends keyof ProductData>(field: K, value: ProductData[K]) => {
    if (product) setProduct({ ...product, [field]: value })
  }

  const handleProductAgeChange = (value: string) => {
    if (product)
      setProduct({ ...product, productAge: { ...product.productAge, value: parseInt(value) || 0 } })
  }

  const handleProductAgeUnitChange = (unit: 'days' | 'months' | 'years') => {
    if (product)
      setProduct({ ...product, productAge: { ...product.productAge, unit } })
  }

  // ── Clara helpers ──────────────────────────────────────────────────────────
  const aiConfig = product?.aiConfig ?? DEFAULT_AI_CONFIG

  const updateClara = (partial: Partial<AIConfig>) => {
    if (!product) return
    setProduct({ ...product, aiConfig: { ...aiConfig, ...partial } })
  }

  const addFAQ = () => {
    if (!newFAQ.question.trim() || !newFAQ.answer.trim()) return
    updateClara({ faqs: [...aiConfig.faqs, { ...newFAQ }] })
    setNewFAQ({ question: '', answer: '' })
  }

  const removeFAQ = (index: number) => {
    updateClara({ faqs: aiConfig.faqs.filter((_, i) => i !== index) })
  }

  const listedPrice = product?.price ?? 0
  const floorNum = typeof aiConfig.priceFloor === 'string'
    ? parseFloat(aiConfig.priceFloor) || 0
    : aiConfig.priceFloor
  const floorPct = listedPrice > 0 ? Math.round((floorNum / listedPrice) * 100) : 0
  const floorValid = floorNum > 0 && floorNum <= listedPrice
  // ──────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!product) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const auth = getAuth()
      const user = auth.currentUser

      if (!user) {
        router.push('/auth/login')
        return
      }

      // Validate Clara if enabled
      if (product.aiConfig?.enabled && !floorValid) {
        setError('Please set a valid minimum price for Clara before saving.')
        setSaving(false)
        return
      }

      const token = await user.getIdToken()

      const aiConfigPayload = product.aiConfig?.enabled
        ? { ...product.aiConfig, priceFloor: floorNum }
        : null

      const response = await fetch(`/api/creator/product/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: product.category,
          brand: product.brand,
          model: product.model,
          location: product.location,
          price: parseFloat(product.price as any),
          condition: product.condition,
          productAge: product.productAge,
          description: product.description,
          defects: product.defects,
          additionalInfo: product.additionalInfo,
          images: product.images,
          aiConfig: aiConfigPayload,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess('Product updated successfully!')
        setTimeout(() => router.push('/creator/product/my-products'), 2000)
      } else {
        setError(result.error || 'Failed to update product')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading / not found states ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Loading product...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="border-destructive/50 bg-destructive/5 p-6">
          <div className="flex gap-3">
            <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0" />
            <div>
              <p className="font-medium text-destructive">Product not found</p>
              <p className="text-sm text-destructive/80 mt-2">
                The product you're trying to edit doesn't exist.
              </p>
              <Link href="/creator/product/my-products" className="mt-4">
                <Button variant="outline" className="bg-transparent">Back to My Products</Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <Link href="/creator/product/my-products">
            <Button variant="outline" className="bg-transparent">Back</Button>
          </Link>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </Card>
        )}

        {success && (
          <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/30 p-4">
            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
            </div>
          </Card>
        )}

        {/* ── Product Details ── */}
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>Edit your product information</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <div className="relative">
                <select
                  value={product.category}
                  onChange={(e) => handleFieldChange('category', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select category...</option>
                  <option value="phones">Phones</option>
                  <option value="laptops">Laptops</option>
                  <option value="furniture">Furniture</option>
                  <option value="books">Books</option>
                  <option value="electronics">Electronics</option>
                </select>
                <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Brand & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Brand</label>
                <Input
                  value={product.brand}
                  onChange={(e) => handleFieldChange('brand', e.target.value)}
                  placeholder="e.g., Samsung"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Model (Optional)</label>
                <Input
                  value={product.model}
                  onChange={(e) => handleFieldChange('model', e.target.value)}
                  placeholder="e.g., Galaxy S23"
                />
              </div>
            </div>

            {/* Location & Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <div className="relative">
                  <select
                    value={product.location}
                    onChange={(e) => handleFieldChange('location', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select state...</option>
                    {NIGERIAN_STATES.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Price (NGN)</label>
                <Input
                  type="number"
                  value={product.price}
                  onChange={(e) => handleFieldChange('price', parseInt(e.target.value) || 0)}
                  placeholder="Enter price"
                  step="1000"
                  min="0"
                />
              </div>
            </div>

            {/* Condition & Product Age */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Condition</label>
                <div className="relative">
                  <select
                    value={product.condition}
                    onChange={(e) => handleFieldChange('condition', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select condition...</option>
                    {CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>{cond}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Product Age</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    value={product.productAge?.value ?? 0}
                    onChange={(e) => handleProductAgeChange(e.target.value)}
                    placeholder="e.g., 1"
                    min="0"
                  />
                  <div className="relative">
                    <select
                      value={product.productAge?.unit ?? 'months'}
                      onChange={(e) => handleProductAgeUnitChange(e.target.value as 'days' | 'months' | 'years')}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="days">Days</option>
                      <option value="months">Months</option>
                      <option value="years">Years</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={product.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="Describe your product..."
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Defects */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Known Defects (if any)</label>
              <Textarea
                value={product.defects || ''}
                onChange={(e) => handleFieldChange('defects', e.target.value)}
                placeholder="List any issues..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Additional Info */}
            <AdditionalInfo
              data={product.additionalInfo || {}}
              onChange={(info) => handleFieldChange('additionalInfo', info)}
            />
          </CardContent>
        </Card>

        {/* ── Clara AI Negotiator ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              Clara — AI Negotiator
            </CardTitle>
            <CardDescription>
              Let Clara handle price negotiations with buyers on your behalf
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/30">
              <div>
                <p className="font-medium text-sm">Enable Clara</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clara will respond to buyers and negotiate price in your chat
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateClara({ enabled: !aiConfig.enabled })}
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

            {aiConfig.enabled ? (
              <>
                {/* Price Floor */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Minimum Acceptable Price (₦)
                    <span className="text-destructive ml-1">*</span>
                  </label>
                  <Input
                    type="number"
                    value={aiConfig.priceFloor || ''}
                    onChange={(e) => updateClara({ priceFloor: parseFloat(e.target.value) || 0 })}
                    placeholder={`e.g. ${Math.round(listedPrice * 0.8).toLocaleString()}`}
                    min="0"
                    max={listedPrice}
                    step="500"
                  />
                  {(aiConfig.priceFloor > 0) && (
                    <p className={`text-xs ${floorValid ? 'text-muted-foreground' : 'text-destructive'}`}>
                      {floorValid
                        ? `${floorPct}% of listed price — Clara will never accept below this`
                        : floorNum > listedPrice
                        ? 'Floor cannot exceed the listed price'
                        : 'Enter a valid floor price'}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Listed price: ₦{listedPrice.toLocaleString()} — Buyers will never see this number
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
                        onClick={() => updateClara({ tone: opt.value as AIConfig['tone'] })}
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
                    onChange={(e) => updateClara({ customContext: e.target.value })}
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
            ) : (
              <div className="rounded-lg border border-border bg-muted/20 p-4 text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Clara is off</p>
                <p className="text-xs text-muted-foreground">
                  Buyers will chat directly with you. Enable Clara to automate negotiations.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Save / Cancel ── */}
        <div className="flex gap-3 justify-between">
          <Link href="/creator/product/my-products" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full bg-transparent">Cancel</Button>
          </Link>
          <Button
            onClick={handleSave}
            disabled={saving || (aiConfig.enabled && !floorValid)}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}