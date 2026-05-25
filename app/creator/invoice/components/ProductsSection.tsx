'use client'

import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Trash2, Loader2, Plus } from 'lucide-react'

interface Product {
  id: string
  title: string
  price: number
}

interface InvoiceItem {
  id: string
  productId: string
  productName: string
  quantity: number
  price: number
}

interface ProductsSectionProps {
  items: InvoiceItem[]
  onItemsChange: (items: InvoiceItem[]) => void
}

export function ProductsSection({ items, onItemsChange }: ProductsSectionProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [authReady, setAuthReady] = useState(false)

  // Wait for auth to be ready
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthReady(true)
      if (user) {
        fetchProducts()
      } else {
        setError('Please log in to view products')
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError('')
      
      const user = auth.currentUser
      
      if (!user) {
        setError('Please log in to view products')
        setLoading(false)
        return
      }

      // Get a fresh token
      const token = await user.getIdToken(true) // Force refresh

      const response = await fetch('/api/creator/product', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = await response.json()

      if (result.success) {
        setProducts(result.data)
        setError('')
      } else {
        setError(result.error || 'Failed to load products')
      }
    } catch (err: any) {
      console.error('Error fetching products:', err)
      setError(err.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      productId: '',
      productName: '',
      quantity: 1,
      price: 0,
    }
    onItemsChange([...items, newItem])
  }

  const removeItem = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id))
  }

  const updateItem = (id: string, updates: Partial<InvoiceItem>) => {
    onItemsChange(
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }

  const handleProductChange = (itemId: string, productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (product) {
      updateItem(itemId, {
        productId,
        productName: product.title,
        price: product.price,
      })
    }
  }

  const getSelectedProductIds = () => items.map((item) => item.productId)

  if (!authReady || loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive text-sm mb-4">{error}</p>
        {error.includes('log in') && (
          <Button onClick={() => window.location.href = '/auth/login'}>
            Log In
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Products</h3>
        <Button onClick={addItem} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Item
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No items added yet. Click "Add Item" to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <Card key={item.id} className="p-4">
              <div className="flex gap-4 items-start">
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Product {index + 1}
                    </label>
                    <Select
                      value={item.productId}
                      onValueChange={(value: string) =>
                        handleProductChange(item.id, value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => {
                          const isSelected = getSelectedProductIds().includes(
                            product.id
                          )
                          const isCurrentItem = item.productId === product.id

                          // Only show products that aren't selected, or if they're the current item
                          if (isSelected && !isCurrentItem) return null

                          return (
                            <SelectItem key={product.id} value={product.id}>
                              {product.title} (₦{product.price})
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">
                        Quantity
                      </label>
                      <Input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={item.quantity === 0 ? '' : item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, {
                            quantity: e.target.value === '' ? 1 : Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">
                        Unit Price (₦)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={item.price === 0 ? '' : item.price}
                        onChange={(e) =>
                          updateItem(item.id, {
                            price: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="Enter price"
                      />
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">
                      Subtotal:{' '}
                    </span>
                    <span className="font-semibold">
                      ₦{(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}