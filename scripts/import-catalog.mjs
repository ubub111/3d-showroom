import { readFile, writeFile } from 'node:fs/promises'
import { parse } from 'csv-parse/sync'
import { z } from 'zod'

const root = new URL('../', import.meta.url)
const slug = z.string().regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/)
const empty = (schema) => z.union([z.literal('').transform(() => undefined), schema])
const integer = z.string().regex(/^-?\d+$/).transform(Number).pipe(z.number().int())
const unit = z.string().trim().min(1).transform(Number).pipe(z.number().min(0).max(1))
const title = z.string().min(1)
const asset = empty(z.string().regex(/^(?:\/?[\w-]+\/)*[\w.-]+$/).refine(
  (value) => value.split('/').every((part) => part !== '.' && part !== '..'),
))
const storeLink = empty(z.url({ protocol: /^https?$/ }))
const categoryRow = z.object({
  id: slug, parent_id: empty(slug), title, sort_order: integer,
  cover_url: asset, description: z.string().optional(),
})
const productRow = z.object({
  id: slug, category_id: slug, title, sku: title, price: empty(integer.pipe(z.number().min(0))),
  model_url: asset, image_url: asset, sort_order: integer, store_url: storeLink,
  description: z.string().optional(),
})
const optionRow = z.object({
  product_id: slug, option_id: slug, option_name: title, value_id: slug,
  value_label: title, modifier: empty(integer).transform((value) => value ?? 0), asset_url: asset,
  color: empty(z.string().regex(/^#[\da-f]{6}$/i)).optional(),
  material_name: empty(title).optional(), roughness: empty(unit).optional(), metalness: empty(unit).optional(),
})

async function readTable(name, schema) {
  const file = await readFile(new URL(`data/${name}.csv`, root), 'utf8')
  const rows = parse(file, { columns: true, skip_empty_lines: true, trim: true, bom: true, info: true })
  return rows.flatMap(({ record, info }) => {
    if (name === 'product_options' && !record.value_id && !record.value_label) return []
    const parsed = schema.safeParse(record)
    if (!parsed.success) {
      throw new Error(`${name}.csv, строка ${info.lines}: ${parsed.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      ).join(', ')}`)
    }
    return [parsed.data]
  })
}

function indexById(rows, name) {
  const index = new Map()
  for (const row of rows) {
    if (index.has(row.id)) throw new Error(`${name}: повтор ID ${row.id}`)
    index.set(row.id, row)
  }
  return index
}

const [categories, products, options] = await Promise.all([
  readTable('categories', categoryRow),
  readTable('products', productRow),
  readTable('product_options', optionRow),
])
const categoriesById = indexById(categories, 'categories')
const productsById = indexById(products, 'products')
for (const category of categories) {
  const visited = new Set([category.id])
  let parent = category.parent_id
  while (parent) {
    if (visited.has(parent)) throw new Error(`Цикл категорий: ${category.id} → ${parent}`)
    const row = categoriesById.get(parent)
    if (!row) throw new Error(`Не найдена родительская категория: ${parent}`)
    visited.add(parent)
    parent = row.parent_id
  }
}
for (const product of products) {
  if (!categoriesById.has(product.category_id)) {
    throw new Error(`${product.id}: не найдена категория ${product.category_id}`)
  }
}

const optionsByProduct = new Map()
for (const option of options) {
  const { product_id, option_id, option_name, ...value } = option
  if (!productsById.has(product_id)) throw new Error(`Опция ссылается на неизвестный товар: ${product_id}`)
  const groups = optionsByProduct.get(product_id) ?? new Map()
  const group = groups.get(option_id) ?? { id: option_id, label: option_name, values: [] }
  if (group.label !== option_name || group.values.some(({ value_id }) => value_id === value.value_id)) {
    throw new Error(`Несогласованная или повторная опция: ${product_id}/${option_id}/${value.value_id}`)
  }
  group.values.push(value)
  groups.set(option_id, group)
  optionsByProduct.set(product_id, groups)
}

const byOrder = (a, b) => a.sort_order - b.sort_order
const catalog = {
  categories: categories.sort(byOrder),
  products: products.sort(byOrder).map((product) => ({
    ...product,
    options: [...(optionsByProduct.get(product.id)?.values() ?? [])],
  })),
}
await writeFile(new URL('src/catalog.json', root), `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Каталог: ${categories.length} категорий, ${products.length} товаров`)
