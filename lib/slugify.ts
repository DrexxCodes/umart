// Generic keyword generator for any brand + model
// Works for phones, laptops, shoes, gadgets, clothing, etc.

// Common product variant suffixes worth expanding
const PRODUCT_VARIANTS: Record<string, string[]> = {
  'plus': ['plus', '+'],
  'pro': ['pro'],
  'pro max': ['pro max', 'pm'],
  'ultra': ['ultra'],
  'max': ['max'],
  'lite': ['lite'],
  'mini': ['mini'],
  'xr': ['xr'],
  'xs': ['xs'],
  'se': ['se'],
  'fe': ['fe'],
  'note': ['note'],
  'edge': ['edge'],
  'fold': ['fold'],
  'flip': ['flip'],
  'zoom': ['zoom'],
  'air': ['air'],
  'neo': ['neo'],
  'slim': ['slim'],
  'turbo': ['turbo'],
  'smart': ['smart'],
  'classic': ['classic'],
  'sport': ['sport'],
  'active': ['active'],
  'elite': ['elite'],
  'one': ['one'],
  'gaming': ['gaming'],
}

export function generateSearchKeywords(brand: string, model?: string): string[] {
  const brandLower = brand.toLowerCase().trim()
  const modelLower = (model ?? '').toLowerCase().trim()

  const keywords: Set<string> = new Set()

  // Always add the brand by itself
  keywords.add(brandLower)

  // Also add individual brand words (e.g. "New Balance" → "new balance", "new", "balance")
  brandLower.split(/\s+/).filter(Boolean).forEach((w) => keywords.add(w))

  if (!modelLower) {
    return Array.from(keywords).filter((k) => k.length > 1).sort()
  }

  // Add model and brand+model
  keywords.add(modelLower)
  keywords.add(`${brandLower} ${modelLower}`)

  // Extract all number sequences from the model
  const numbers = modelLower.match(/\d+/g) ?? []
  numbers.forEach((n) => {
    keywords.add(n)
    keywords.add(`${brandLower} ${n}`)
  })

  // Extract all non-numeric word tokens from the model
  const modelWords = modelLower.replace(/\d+/g, ' ').split(/\s+/).filter((w) => w.length > 1)
  modelWords.forEach((w) => {
    keywords.add(w)
    keywords.add(`${brandLower} ${w}`)
    numbers.forEach((n) => keywords.add(`${w} ${n}`))
  })

  // Detect known variants in the model string and expand them
  for (const [variant, aliases] of Object.entries(PRODUCT_VARIANTS)) {
    if (modelLower.includes(variant)) {
      aliases.forEach((alias) => {
        keywords.add(alias)
        keywords.add(`${brandLower} ${alias}`)
        numbers.forEach((n) => {
          keywords.add(`${n} ${alias}`)
          keywords.add(`${n}${alias}`)
          keywords.add(`${brandLower} ${n} ${alias}`)
        })
      })
    }
  }

  // Brand-specific expansions
  // Apple iPhones
  if (brandLower === 'apple' && modelLower.includes('iphone')) {
    keywords.add('iphone')
    numbers.forEach((n) => {
      keywords.add(`iphone ${n}`)
      keywords.add(`iphone${n}`)
    })
  }

  // Samsung Galaxy
  if (brandLower === 'samsung' && modelLower.includes('galaxy')) {
    keywords.add('galaxy')
    numbers.forEach((n) => {
      keywords.add(`galaxy ${n}`)
      keywords.add(`samsung galaxy ${n}`)
    })
    modelWords.forEach((w) => {
      if (w !== 'galaxy') {
        numbers.forEach((n) => keywords.add(`galaxy ${w} ${n}`))
      }
    })
  }

  // Nike / Adidas / shoe brands — add size-agnostic terms
  if (['nike', 'adidas', 'puma', 'reebok', 'new balance', 'converse', 'vans'].includes(brandLower)) {
    keywords.add('shoes')
    keywords.add('sneakers')
    keywords.add('trainers')
    keywords.add(`${brandLower} shoes`)
    keywords.add(`${brandLower} sneakers`)
  }

  return Array.from(keywords).filter((k) => k.length > 1).sort()
}
