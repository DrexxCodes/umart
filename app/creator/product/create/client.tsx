'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Step1Category } from './components/Step1-Category'
import { Step2Condition } from './components/Step2-Condition'
import { Step3Images } from './components/Step3-Images'
import { Step4AIConfig } from './components/Step4-AIConfig'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { generateSearchKeywords } from '@/lib/slugify'
import { CreatorNav } from '@/components/nav/creator-nav'

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
  priceFloor: string
  faqs: FAQ[]
  customContext: string
}

interface ProductData {
  category: string
  subCategory: string
  brand: string
  model: string
  searchKeywords: string[]
  location: string
  price: string
  condition: string
  productAge: ProductAge
  description: string
  defects: string
  additionalInfo: Record<string, string>
  images: string[]
  aiConfig: AIConfig
}

const INITIAL_DATA: ProductData = {
  category: '',
  subCategory: '',
  brand: '',
  model: '',
  searchKeywords: [],
  location: '',
  price: '',
  condition: '',
  productAge: { value: 0, unit: 'days' },
  description: '',
  defects: '',
  additionalInfo: {},
  images: [],
  aiConfig: {
    enabled: false,
    tone: 'friendly',
    priceFloor: '',
    faqs: [],
    customContext: '',
  },
}

const TOTAL_STEPS = 4

export default function CreateProductClient() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [productData, setProductData] = useState<ProductData>(INITIAL_DATA)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleDataChange = (newData: Partial<ProductData>) => {
    setProductData((prev) => ({ ...prev, ...newData }))
    setError('')
  }

  const handleNext = () => {
    if (currentStep === 1) {
      if (productData.brand) {
        const keywords = generateSearchKeywords(productData.brand, productData.model)
        setProductData((prev) => ({ ...prev, searchKeywords: keywords }))
      }
      setCurrentStep(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (currentStep === 2) {
      setCurrentStep(3)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (currentStep === 3) {
      setCurrentStep(4)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (currentStep === 4) {
      handleCreateProduct()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleCreateProduct = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const user = auth.currentUser
      if (!user) throw new Error('You must be logged in to create a product')

      const token = await user.getIdToken()

      // Build the aiConfig payload — convert priceFloor string to number
      const aiConfigPayload = productData.aiConfig.enabled
        ? {
            ...productData.aiConfig,
            priceFloor: parseFloat(productData.aiConfig.priceFloor) || 0,
          }
        : null

      const response = await fetch('/api/creator/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...productData,
          aiConfig: aiConfigPayload,
        }),
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Failed to create product')

      setSuccess('Product created successfully!')
      setTimeout(() => {
        router.push(`/creator/product/create/success?productId=${result.data.productId}`)
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Failed to create product')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <CreatorNav />
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Create Product Listing</h1>
          <p className="text-muted-foreground">Step {currentStep} of {TOTAL_STEPS}</p>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
            <div
              key={step}
              className={`h-2 flex-1 rounded-full transition-colors ${
                step <= currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Error</p>
                <p className="text-sm text-destructive/90 mt-1">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {success && (
          <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/30 p-4">
            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="font-medium text-green-600 dark:text-green-400">{success}</p>
            </div>
          </Card>
        )}

        {currentStep === 1 && (
          <Step1Category data={productData} onChange={handleDataChange} onNext={handleNext} />
        )}
        {currentStep === 2 && (
          <Step2Condition
            data={productData}
            onChange={handleDataChange}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        )}
        {currentStep === 3 && (
          <Step3Images
            data={productData}
            onChange={handleDataChange}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        )}
        {currentStep === 4 && (
          <Step4AIConfig
            data={{ price: productData.price, aiConfig: productData.aiConfig }}
            onChange={handleDataChange}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        )}

        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="p-6 text-center space-y-2">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-medium">Creating your product...</p>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
