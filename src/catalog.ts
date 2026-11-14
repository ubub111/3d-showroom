import rawCatalog from './catalog.json'

export interface Category {
  id: string
  title: string
  parent_id?: string
  cover_url?: string
  description?: string
}

export interface OptionValue {
  value_id: string
  value_label: string
  modifier: number
  asset_url?: string
  color?: string
  material_name?: string
  roughness?: number
  metalness?: number
}

export interface Option {
  id: string
  label: string
  values: OptionValue[]
}

export interface Product {
  id: string
  category_id: string
  title: string
  sku: string
  price?: number
  model_url?: string
  image_url?: string
  store_url?: string
  description?: string
  options: Option[]
}

export const catalog: { categories: Category[]; products: Product[] } = rawCatalog

export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
export const categoryLink = (id: string) => `#/catalog/${id}`
export const productLink = (id: string) => `#/product/${id}`
export const rubles = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })

export function categoryPath(id: string): Category[] {
  const path = []
  let category = catalog.categories.find((item) => item.id === id)
  while (category) {
    path.unshift(category)
    const parentId = category.parent_id
    category = catalog.categories.find((item) => item.id === parentId)
  }
  return path
}

export function configurationLink(productId: string, selection: Record<string, string>) {
  const params = new URLSearchParams(selection)
  return `${productLink(productId)}${params.size ? `?${params}` : ''}`
}

export function configurationPrice(product: Product, values: OptionValue[]) {
  return product.price === undefined ? undefined : product.price + values.reduce((sum, value) => sum + value.modifier, 0)
}

export const volumeTiers = [
  { quantity: 10, percent: 5 },
  { quantity: 50, percent: 10 },
  { quantity: 100, percent: 15 },
  { quantity: 300, percent: 20 },
]

export function volumeDiscount(quantity: number, subtotal: number) {
  const percent = volumeTiers.findLast((tier) => quantity >= tier.quantity)?.percent ?? 0
  return { percent, amount: Math.round(subtotal * percent / 100) }
}
