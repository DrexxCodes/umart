'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Edit, ToggleRight, ToggleLeft, Bot, BotOff } from 'lucide-react'

interface AIConfig {
  enabled: boolean
  tone: string
  priceFloor: number
  faqs: { question: string; answer: string }[]
  customContext: string
}

interface Product {
  id: string
  title: string
  brand: string
  price: number
  location: string
  status: 'active' | 'inactive'
  images: string[]
  createdAt: any
  aiConfig?: AIConfig
}

export function MyProductsClient() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchProducts()
      } else {
        router.push('/auth/login')
      }
    })
    return () => unsubscribe()
  }, [router])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError('')
      const user = auth.currentUser
      if (!user) { router.push('/auth/login'); return }

      const token = await user.getIdToken()
      const response = await fetch('/api/creator/product', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()

      if (result.success) {
        setProducts(result.data)
      } else {
        setError(result.error || 'Failed to fetch products')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const toggleProductStatus = async (productId: string, currentStatus: string) => {
    try {
      setUpdatingId(productId)
      const user = auth.currentUser
      if (!user) { router.push('/auth/login'); return }

      const token = await user.getIdToken()
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

      const response = await fetch(`/api/creator/product/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const result = await response.json()
      if (result.success) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, status: newStatus as 'active' | 'inactive' } : p
          )
        )
      } else {
        setError(result.error || 'Failed to update product status')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Loading your products...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold">My Products</h1>
            <p className="text-muted-foreground mt-2">Manage your product listings</p>
          </div>
          <Link href="/creator/product/create">
            <Button>Create New Product</Button>
          </Link>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {products.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-lg">
                You haven't created any products yet
              </p>
              <Link href="/creator/product/create">
                <Button>Create Your First Product</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => {
              const claraOn = product.aiConfig?.enabled === true
              return (
                <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Product Image */}
                  {product.images.length > 0 && (
                    <div className="relative w-full h-48 bg-muted overflow-hidden">
                      <img
                        src={product.images[0] || '/placeholder.svg'}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                      <Badge
                        className={`absolute top-2 right-2 ${
                          product.status === 'active'
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gray-600 hover:bg-gray-700'
                        }`}
                      >
                        {product.status}
                      </Badge>
                    </div>
                  )}

                  <CardHeader>
                    <CardTitle className="text-lg line-clamp-2">{product.title}</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-primary">
                        ₦{product.price.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">{product.location}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Link href={`/creator/product/my-products/${product.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                            <Edit className="w-4 h-4" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2 bg-transparent"
                          onClick={() => toggleProductStatus(product.id, product.status)}
                          disabled={updatingId === product.id}
                        >
                          {updatingId === product.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : product.status === 'active' ? (
                            <>
                              <ToggleRight className="w-4 h-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4" />
                              Activate
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Clara indicator */}
                      <div
                        title={claraOn ? 'Clara will sell for you' : 'Clara is not going to sell this product'}
                        className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors cursor-default select-none ${
                          claraOn
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        {claraOn ? (
                          <Bot className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <BotOff className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span>
                          {claraOn ? 'Clara is selling this' : 'Clara is off'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}