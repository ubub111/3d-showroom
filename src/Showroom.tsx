import { lazy, Suspense, useCallback, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, ArrowUpRight, Box, ChevronLeft, ChevronRight, LayoutList, PanelsTopLeft } from 'lucide-react'
import { catalog, categoryLink, categoryPath, productLink, rubles, type Category, type Product } from './catalog'
import type { PreviewEntry } from './CatalogModels'

const CatalogModels = lazy(() => import('./CatalogModels'))
export const categories = catalog.categories.filter((category) => !category.parent_id)
const catalogLink = '#/catalog'
const plurals = new Intl.PluralRules('ru')
const units = { one: 'изделие', few: 'изделия', many: 'изделий', other: 'изделия', zero: 'изделий', two: 'изделия' }

type Item = {
  id: string; title: string; href: string; description?: string; model?: string; detail?: string
}

function categoryItem(category: Category, related = catalog.products.filter((product) =>
  categoryPath(product.category_id).some(({ id }) => id === category.id))): Item {
  return {
    id: category.id, title: category.title, href: categoryLink(category.id), description: category.description,
    model: related.find((product) => product.model_url)?.model_url,
    detail: `${related.length} ${units[plurals.select(related.length)]}`,
  }
}

function productItem(product: Product): Item {
  return {
    id: product.id, title: product.title, href: productLink(product.id), description: product.description,
    model: product.model_url, detail: product.price === undefined ? product.sku : rubles.format(product.price),
  }
}

function usePreviews() {
  const [entries, setEntries] = useState<PreviewEntry[]>([])
  const register = useCallback((id: string, url: string, turn: number, element: HTMLElement | null) => {
    setEntries((previous) => {
      const next = previous.filter((entry) => entry.id !== id)
      return element ? [...next, { id, url, turn, element }] : next
    })
  }, [])
  return { entries, register }
}

type Register = ReturnType<typeof usePreviews>['register']

function ModelSlot({ item, turn, register, prefix }: { item: Item; turn: number; register: Register; prefix: string }) {
  const { id, model } = item
  const track = useCallback((element: HTMLDivElement | null) => {
    if (model) register(`${prefix}:${id}`, model, turn, element)
  }, [id, model, turn, register, prefix])
  return <div className="model-slot" ref={track}>
    {model ? <div className="model-shadow" /> : <Box className="empty-model" size={47} strokeWidth={1} aria-hidden="true" />}
  </div>
}

function Carousel({ items, label, register }: { items: Item[]; label: string; register: Register }) {
  const [active, setActive] = useState(0)
  const position = useRef<{ x: number; y: number } | null>(null)
  const ignoreClick = useRef(false)
  const end = items.length - 1
  const move = (delta: number) => setActive((index) => Math.min(end, Math.max(0, index + delta)))
  return <div className="carousel" role="group" aria-label={label} tabIndex={0}
    onKeyDown={(event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      move(event.key === 'ArrowRight' ? 1 : -1)
    }}
    onPointerDown={(event) => {
      ignoreClick.current = false
      position.current = event.button === 0 ? { x: event.clientX, y: event.clientY } : null
    }}
    onPointerUp={(event) => {
      const start = position.current
      position.current = null
      if (!start) return
      const dx = event.clientX - start.x
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(event.clientY - start.y)) {
        ignoreClick.current = true
        move(dx < 0 ? 1 : -1)
      }
    }}
    onPointerCancel={() => { position.current = null }}
    onClickCapture={(event) => {
      if (ignoreClick.current && event.detail > 0) event.preventDefault()
      ignoreClick.current = false
    }}>
    <div className="slide-window" data-model-clip><div className="slide-track" style={{ '--active': active } as CSSProperties}>
      {items.map((item, index) => <article key={item.id}
        className={`slide tone-${index % 5}${index === active ? ' is-active' : ''}`} inert={Math.abs(index - active) > 1}>
        <ModelSlot item={item} turn={0.36 + (index % 3) * 0.08} register={register} prefix="carousel" />
        <a className="slide-hit" href={item.href} aria-label={item.title} draggable={false}
          tabIndex={Math.abs(index - active) <= 1 ? 0 : -1} />
        <div className="slide-copy">
          {item.detail && <p className="slide-detail">{item.detail}</p>}
          <h2>{item.title}</h2>
          {item.description && <p className="slide-description">{item.description}</p>}
          <span className="slide-action" aria-hidden="true">Открыть <ChevronRight size={15} /></span>
        </div>
      </article>)}
    </div>
    </div>
    {items.length > 1 && <>
      <button className="carousel-arrow previous" aria-label="Предыдущий слайд" aria-disabled={active === 0} onClick={() => move(-1)}><ChevronLeft size={22} /></button>
      <button className="carousel-arrow next" aria-label="Следующий слайд" aria-disabled={active === end} onClick={() => move(1)}><ChevronRight size={22} /></button>
    </>}
    {items.length > 1 && <p className="carousel-guide">Листайте карусель · нажмите на изделие</p>}
    <span className="sr-only" aria-live="polite">{items[active]?.title} · {active + 1} из {items.length}</span>
  </div>
}

function Vertical({ items, register }: { items: Item[]; register: Register }) {
  return <div className="vertical-catalog">
    {items.map((item, index) => <article className={`vertical-item tone-${index % 5}`} key={item.id}>
      <ModelSlot item={item} turn={0.36 + (index % 3) * 0.08} register={register} prefix="vertical" />
      <a href={item.href} className="vertical-link">
        <span><strong>{item.title}</strong>{item.description && <span>{item.description}</span>}</span>
        <span>{item.detail}<ArrowUpRight size={18} /></span>
      </a>
    </article>)}
  </div>
}

function ModelStrip({ items, register }: { items: Item[]; register: Register }) {
  return <section className="model-strip" data-model-clip aria-label="Категории">
    {items.map((item, index) => <article className={`tone-${index % 5}`} key={item.id}>
      <ModelSlot item={item} turn={0.36 + (index % 3) * 0.08} register={register} prefix="strip" />
      <a href={item.href}><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRight size={17} /></a>
    </article>)}
  </section>
}

function Subcategories({ items }: { items: Category[] }) {
  if (!items.length) return null
  return <section className="subcategories">
    <h2>Подкатегории</h2>
    <div className="subcategory-grid">
      {items.map((category) => {
        const item = categoryItem(category)
        return <a key={category.id} href={item.href}>
          <Box size={21} />
          <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          <ArrowUpRight size={18} />
        </a>
      })}
    </div>
  </section>
}

export function Showroom({ category, home = false }: { category?: Category; home?: boolean }) {
  const { entries, register } = usePreviews()
  const [vertical, setVertical] = useState(() => {
    try { return sessionStorage.getItem('forma:layout') === 'vertical' }
    catch { return false }
  })
  const setLayout = (value: boolean) => {
    setVertical(value)
    try { sessionStorage.setItem('forma:layout', value ? 'vertical' : 'horizontal') }
    catch { /* Layout can still be changed for the current page. */ }
  }
  const items = home ? categories.map((item) => categoryItem(item)) : catalog.products
    .filter((product) => !category || product.category_id === category.id).map(productItem)
  const descendants = catalog.categories.filter((item) => category ? item.parent_id === category.id : item.parent_id)
  const path = category ? categoryPath(category.id).slice(0, -1) : []
  const label = home ? 'Слайдер категорий' : 'Слайдер товаров'
  return <div className="showroom-page">
    {path.length > 0 && <nav className="breadcrumbs" aria-label="Путь к разделу">
      <a href="#/">Главная</a>
      {path.map((item) => <span key={item.id}><ChevronRight size={13} /><a href={categoryLink(item.id)}>{item.title}</a></span>)}
    </nav>}
    <div className="showroom-heading">
      <div><h1>{home ? '3D-шоурум' : category?.title ?? 'Все изделия'}</h1>
        {category?.description && <p>{category.description}</p>}
      </div>
      <div className="layout-toggle" role="group" aria-label="Вид каталога">
        <button aria-pressed={!vertical} onClick={() => setLayout(false)}><PanelsTopLeft size={16} /> Карусель</button>
        <button aria-pressed={vertical} onClick={() => setLayout(true)}><LayoutList size={16} /> Список</button>
      </div>
    </div>
    {items.length ? vertical ? <Vertical items={items} register={register} /> : <Carousel items={items} label={label} register={register} /> :
      <p className="empty-state">В этом разделе пока нет изделий.</p>}
    {home && !vertical && <ModelStrip items={items} register={register} />}
    {entries.length > 0 && <Suspense fallback={null}><CatalogModels entries={entries} /></Suspense>}
    <Subcategories items={descendants} />
    {home && <a className="all-link" href={catalogLink}>Все изделия <ArrowRight size={16} /></a>}
  </div>
}
