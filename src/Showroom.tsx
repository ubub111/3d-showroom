import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, ArrowUpRight, Box, Eye, ChevronLeft, ChevronRight, LayoutList, PanelsTopLeft } from 'lucide-react'
import { catalog, categoryLink, categoryPath, productLink, rubles, type Category, type Product } from './catalog'
import type { PreviewEntry } from './CatalogModels'
import { ProductThumb } from './StorePanels'

const PinShowcase = lazy(() => import('./PinShowcase'))
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

const carouselPositions = new Map<string, string>()

function Carousel({ items, label, register, section }: { items: Item[]; label: string; register: Register; section: string }) {
  const [active, setActive] = useState(() => Math.max(0, items.findIndex((item) => item.id === carouselPositions.get(section))))
  const position = useRef<{ x: number; y: number } | null>(null)
  const ignoreClick = useRef(false)
  const end = items.length - 1
  useEffect(() => { carouselPositions.set(section, items[active].id) }, [section, items, active])
  const move = (delta: number) => setActive((index) => Math.min(end, Math.max(0, index + delta)))
  return <div className={section === 'home' ? 'carousel carousel-home' : 'carousel'} role="group" aria-label={label} tabIndex={0}
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
        <div className="slide-copy" aria-hidden={index !== active}>
          {section === 'home' && <span className="slide-kicker"><Box size={15} strokeWidth={1.5} /> 3D-коллекция</span>}
          {item.detail && section !== 'home' && <p className="slide-detail">{item.detail}</p>}
          <h2>{item.title}</h2>
          {item.description && <p className="slide-description">{item.description}</p>}
          <span className="slide-action" aria-hidden="true">{section === 'home' ? 'Смотреть товары' : 'Открыть'} <ChevronRight size={15} /></span>
        </div>
      </article>)}
    </div>
    </div>
    {items.length > 1 && <>
      <button className="carousel-arrow previous" aria-label="Предыдущий слайд" aria-disabled={active === 0} onClick={() => move(-1)}><ChevronLeft size={22} /></button>
      <button className="carousel-arrow next" aria-label="Следующий слайд" aria-disabled={active === end} onClick={() => move(1)}><ChevronRight size={22} /></button>
    </>}
    {items.length > 1 && (section === 'home' ? <div className="collection-steps" aria-label="Коллекции">
      {items.map((item, index) => <button key={item.id} type="button" aria-current={index === active ? 'true' : undefined}
        onClick={() => setActive(index)}>{item.title}</button>)}
    </div> : <p className="carousel-guide">Листайте карусель · нажмите на изделие</p>)}
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

function ProductRows({ sections, onPreview }: { sections: Category[]; onPreview: (product: Product) => void }) {
  return <div className="store-shelves">{sections.map((section) => {
    const products = catalog.products.filter((product) => categoryPath(product.category_id).some(({ id }) => id === section.id))
    if (!products.length) return null
    return <section className="store-shelf" key={section.id}>
      <header><h2><a href={categoryLink(section.id)}>{section.title} <ChevronRight size={18} /></a></h2>
        <a href={categoryLink(section.id)} aria-label={`Все товары раздела ${section.title}`}>Все · {products.length}</a></header>
      <ul>{products.map((product) => <li key={product.id}>
        <a href={productLink(product.id)}><span className="shelf-photo"><ProductThumb product={product} /></span>
          <strong>{product.title}</strong>{product.price !== undefined && <small>от {rubles.format(product.price)}</small>}</a>
        <button type="button" className="quick-preview" aria-label={`Быстрый просмотр: ${product.title}`} onClick={() => onPreview(product)}><Eye size={17} /></button>
      </li>)}</ul>
    </section>
  })}</div>
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

export function Showroom({ category, home = false, onOpen, onPreview }: { category?: Category; home?: boolean; onOpen: (product: Product) => void; onPreview: (product: Product) => void }) {
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
  const products = catalog.products.filter((product) => !category || product.category_id === category.id)
  const showcase = category?.id === 'pins' && !vertical
  const featured = showcase ? products.filter((product) => product.model_url).slice(0, 3) : []
  const hasShowcase = featured.length > 0
  const items = home ? categories.map((item) => categoryItem(item)) : products.map(productItem)
  const descendants = catalog.categories.filter((item) => category ? item.parent_id === category.id : item.parent_id)
  const path = category ? categoryPath(category.id).slice(0, -1) : []
  const label = home ? 'Слайдер категорий' : 'Слайдер товаров'
  const layoutToggle = <div className="layout-toggle" role="group" aria-label="Вид каталога">
        <button aria-pressed={!vertical} onClick={() => setLayout(false)}><PanelsTopLeft size={16} /> {category?.id === 'pins' ? '3D-витрина' : 'Карусель'}</button>
        <button aria-pressed={vertical} onClick={() => setLayout(true)}><LayoutList size={16} /> Список</button>
      </div>
  return <div className="showroom-page">
    {path.length > 0 && <nav className="breadcrumbs" aria-label="Путь к разделу">
      <a href="#/">Главная</a>
      {path.map((item) => <span key={item.id}><ChevronRight size={13} /><a href={categoryLink(item.id)}>{item.title}</a></span>)}
    </nav>}
    <div className={home ? 'showroom-heading home-heading' : 'showroom-heading'}>
      <div className={home ? 'sr-only' : undefined}><h1>{home ? '3D-шоурум' : category?.title ?? 'Все изделия'}</h1>
        {category?.description && <p>{category.description}</p>}
      </div>
      {!home && layoutToggle}
    </div>
    {hasShowcase ? <>
      <Suspense fallback={<div className="pin-showcase" role="status">Загрузка 3D…</div>}>
        <PinShowcase products={featured} onOpen={onOpen} />
      </Suspense>
      <div className="pin-links" aria-label="Изделия в разделе">
        {products.map((product) => <a key={product.id} href={productLink(product.id)}>
          <span className="pin-card-image"><ProductThumb product={product} /></span>
          <span className="pin-card-info">
            <strong>{product.title}</strong>
            {product.price !== undefined && <small>от {rubles.format(product.price)}</small>}
          </span>
          <ArrowUpRight className="pin-card-arrow" size={16} aria-hidden="true" />
        </a>)}
      </div>
    </> : items.length ? vertical ? <Vertical items={items} register={register} /> :
      <Carousel items={items} label={label} register={register} section={home ? 'home' : category?.id ?? 'catalog'} /> :
      <p className="empty-state">В этом разделе пока нет изделий.</p>}
    {home && <div className="home-view-controls"><h2>Каталог изделий</h2>{layoutToggle}</div>}
    {entries.length > 0 && <Suspense fallback={null}><CatalogModels entries={entries} /></Suspense>}
    {home && <ProductRows sections={categories} onPreview={onPreview} />}
    {home && !vertical && <ModelStrip items={items} register={register} />}
    <Subcategories items={descendants} />
    {home && <a className="all-link" href={catalogLink}>Все изделия <ArrowRight size={16} /></a>}
  </div>
}
