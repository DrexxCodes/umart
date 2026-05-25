'use client'

import React from "react"

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchKeywords } from './SearchKeywords'
import { AdditionalInfo } from './AdditionalInfo'

interface ProductAge {
  value: number
  unit: 'days' | 'months' | 'years'
}

interface Step2Props {
  data: {
    category: string
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
  }
  onChange: (data: any) => void
  onNext: () => void
  onPrevious: () => void
}

const CONDITIONS = ['New', 'Neatly Used', 'Used', 'Damaged']

export function Step2Condition({
  data,
  onChange,
  onNext,
  onPrevious,
}: Step2Props) {
  const handleConditionChange = (condition: string) => {
    onChange({ ...data, condition })
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...data, description: e.target.value })
  }

  const handleDefectsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...data, defects: e.target.value })
  }

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...data, location: e.target.value })
  }

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow empty string so the field can be fully cleared
    onChange({ ...data, price: e.target.value })
  }

  const handleProductAgeChange = (value: string) => {
    const numValue = value === '' ? 0 : Math.max(0, parseInt(value) || 0)
    onChange({ ...data, productAge: { ...data.productAge, value: numValue } })
  }

  const handleProductAgeUnitChange = (unit: 'days' | 'months' | 'years') => {
    onChange({ ...data, productAge: { ...data.productAge, unit } })
  }

  const handleAdditionalInfoChange = (info: Record<string, string | number>) => {
    onChange({ ...data, additionalInfo: info })
  }

  const canProceed =
    data.condition && data.description && data.location && data.price

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Step 2: Item Condition & Price</CardTitle>
        <CardDescription>
          Describe the condition and provide pricing information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Condition */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Item Condition</label>
          <div className="relative">
            <select
              value={data.condition}
              onChange={(e) => handleConditionChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select condition...</option>
              {CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Store Location */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Store Location (State)</label>
          <div className="relative">
            <select
              value={data.location}
              onChange={handleLocationChange}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select state...</option>
              {[
                'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
                'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo',
                'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
                'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
                'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
                'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'Federal Capital Territory',
              ].map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Price */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Price (NGN)</label>
          <Input
            type="number"
            value={data.price === '0' || data.price === '' ? '' : data.price}
            onChange={handlePriceChange}
            placeholder="Enter price in Naira"
            step="1000"
            min="0"
            inputMode="numeric"
          />
        </div>

        {/* Product Age */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Product Age</label>
          <div className="grid grid-cols-3 gap-2">
            <Input
              type="number"
              value={data.productAge.value === 0 ? '' : data.productAge.value}
              onChange={(e) => handleProductAgeChange(e.target.value)}
              placeholder="e.g., 1"
              min="0"
              max="100"
              inputMode="numeric"
              className="col-span-1"
            />
            <div className="col-span-2 relative">
              <select
                value={data.productAge.unit}
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
          <p className="text-xs text-muted-foreground">
            e.g., 3 days, 2 months, or 1 year
          </p>
        </div>

        {/* Search Keywords for Phones */}
        {data.category === 'phones' && (
          <SearchKeywords
            category={data.category}
            brand={data.brand}
            model={data.model}
            searchKeywords={data.searchKeywords}
            onUpdate={(keywords) => onChange({ ...data, searchKeywords: keywords })}
          />
        )}

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Product Description</label>
          <Textarea
            value={data.description}
            onChange={handleDescriptionChange}
            placeholder="Describe the product in detail..."
            rows={4}
            className="resize-none"
          />
        </div>

        {/* Defects */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Known Defects (if any)</label>
          <Textarea
            value={data.defects}
            onChange={handleDefectsChange}
            placeholder="List any known issues or defects..."
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Additional Information */}
        <AdditionalInfo
          data={data.additionalInfo || {}}
          onChange={handleAdditionalInfoChange}
        />
      </CardContent>

      <div className="flex gap-3 justify-between p-6 border-t border-border">
        <Button variant="outline" onClick={onPrevious} className="w-full sm:w-auto bg-transparent">
          Previous
        </Button>
        <Button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full sm:w-auto"
        >
          Next Step
        </Button>
      </div>
    </Card>
  )
}