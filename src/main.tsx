import { lazy, Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Box, Check, ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import { asset, catalog, categoryLink, categoryPath, productLink, rubles, type Category, type OptionValue, type Product } from './catalog'
import './styles.css'

const Viewer = lazy(() => import('./Viewer'))
const categories = catalog.categories.filter((category) => !category.parent_id)
const slides = categories.filter((category) => category.cover_url)
const noFinishes: OptionValue[] = []

function Header() {
  return <header className="site-header">
    <div className="shell header-inner">
      <a href="#/" className="brand" aria-label="Форма, главная"><span><Box size={21} strokeWidth={1.8} /></span>форма<span className="brand-dot">.</span></a>
      <nav aria-label="Главная навигация">
        <a href="#/catalog">Каталог</a>
        <a href="#/about">О проекте</a>
      </nav>
      <a className="header-link" href="#/catalog">Открыть каталог <ArrowUpRight size={15} /></a>
    </div>
  </header>
}

function Cover({ path, eager = false }: { path?: string; eager?: boolean }) {
  if (!path) return <div className="cover-placeholder"><Box size={40} strokeWidth={1} /></div>
  return <img src={asset(path)} alt="" draggable={false} loading={eager ? 'eager' : 'lazy'} />
}

function Hero() {
  const [index, setIndex] = useState(0)
  const slide = slides[index]
  const [showPreview, setShowPreview] = useState(false)
  const preview = catalog.products.find((product) => product.category_id === slide?.id && product.model_url)
  const touchStart = useRef<number | null>(null)
  const move = (delta: number) => {
    setShowPreview(false)
    setIndex((value) => (value + delta + slides.length) % slides.length)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (slides.length > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault()
      move(event.key === 'ArrowRight' ? 1 : -1)
    }
  }

  return <section className="hero">
    <div className="hero-copy">
      <p className="eyebrow"><span /> Интерактивный шоурум</p>
      <h1>Рассмотрите<br />со всех сторон<span>.</span></h1>
      <p className="hero-description">Вращайте изделия в 3D, меняйте материалы и сохраняйте свою комплектацию.</p>
      <a className="button primary" href="#/catalog">Смотреть каталог <ArrowRight size={19} /></a>
    </div>
    {slide && <div className="hero-media" role="group" aria-label="Слайдер категорий" onKeyDown={onKeyDown}
      onTouchStart={(event) => { touchStart.current = event.changedTouches[0].clientX }}
      onTouchEnd={(event) => {
        if (showPreview || touchStart.current === null) return
        const delta = event.changedTouches[0].clientX - touchStart.current
        touchStart.current = null
        if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1)
      }}>
      {showPreview && preview ? <Suspense fallback={<Cover path={slide.cover_url} eager />}>
        <Viewer key={preview.id} url={preview.model_url} image={slide.cover_url} finishes={noFinishes}
          label={`3D-превью: ${preview.title}`} preview />
      </Suspense> : <Cover key={slide.id} path={slide.cover_url} eager />}
      {preview && <button className="preview-toggle" aria-pressed={showPreview} onClick={() => setShowPreview(!showPreview)}>
        <Box size={16} /> {showPreview ? 'Закрыть 3D' : 'Смотреть в 3D'}
      </button>}
      <a href={categoryLink(slide.id)} className="slide-label" aria-live="polite">
        {slide.title} <ArrowUpRight size={16} />
      </a>
      {slides.length > 1 && <div className="slide-controls">
        <button aria-label="Предыдущий слайд" onClick={() => move(-1)}><ChevronLeft size={20} /></button>
        <button aria-label="Следующий слайд" onClick={() => move(1)}><ChevronRight size={20} /></button>
      </div>}
    </div>}
  </section>
}

function CategoryGrid({ items }: { items: Category[] }) {
  return <div className="category-grid">
    {items.map((category) => <a className="category-card" key={category.id} href={categoryLink(category.id)}>
      <div className="category-cover"><Cover path={category.cover_url} /></div>
      <div className="category-label"><span>{category.title}</span><ArrowUpRight size={19} strokeWidth={1.65} /></div>
    </a>)}
  </div>
}

function Home() {
  return <>
    <Hero />
    <section className="home-categories">
      <div className="section-header"><h2>Категории</h2><a href="#/catalog">Весь каталог <ArrowDown size={16} /></a></div>
      <CategoryGrid items={categories} />
    </section>
  </>
}

function Breadcrumbs({ items }: { items: { title: string; href: string }[] }) {
  return <nav className="breadcrumbs" aria-label="Путь к странице">
    <a href="#/">Главная</a>
    {items.map((item) => <span key={item.href}><ChevronRight size={13} /><a href={item.href}>{item.title}</a></span>)}
  </nav>
}

function CatalogPage({ id }: { id?: string }) {
  const category = catalog.categories.find((item) => item.id === id)
  if (id && !category) return <Missing />
  const children = catalog.categories.filter((item) => item.parent_id === id)
  const products = catalog.products.filter((product) => !id || product.category_id === id)
  return <div className="inner-page">
    <Breadcrumbs items={[{ title: 'Каталог', href: '#/catalog' }, ...categoryPath(id ?? '').slice(0, -1).map((item) => ({
      title: item.title, href: categoryLink(item.id),
    }))]} />
    <div className="page-heading">
      <h1>{category?.title ?? 'Каталог'}</h1>
      {category?.description && <p>{category.description}</p>}
    </div>
    <nav className="filter-row" aria-label="Категории каталога">
      <a href="#/catalog" aria-current={id ? undefined : 'page'}>Все товары</a>
      {categories.map((item) => <a key={item.id} href={categoryLink(item.id)}
        aria-current={categoryPath(id ?? '')[0]?.id === item.id ? 'page' : undefined}>{item.title}</a>)}
    </nav>
    {category && children.length > 0 && <div className="subcategories">
      <h2>Подкатегории</h2><CategoryGrid items={children} />
    </div>}
    <div className="product-grid">
      {products.map((product) => <a className="category-card product-card" key={product.id} href={productLink(product.id)}>
        <div className="category-cover"><Cover path={product.image_url} />
          {product.model_url && <span className="model-tag"><Box size={14} /> 3D</span>}
        </div>
        <div className="category-label">
          <div><h2>{product.title}</h2>{product.price !== undefined && <p>от {rubles.format(product.price)}</p>}</div>
          <ArrowUpRight size={19} />
        </div>
      </a>)}
    </div>
    {products.length === 0 && <p className="empty-state">В этом разделе пока нет товаров.</p>}
  </div>
}

function initialSelection(product: Product, query: URLSearchParams) {
  let saved: Record<string, string> = {}
  try {
    const value = JSON.parse(localStorage.getItem(`forma:${product.id}`) ?? '{}')
    if (value && typeof value === 'object') saved = value
  } catch { /* Storage may be unavailable in a private or embedded browser. */ }
  const useQuery = product.options.some((option) => query.has(option.id))
  return Object.fromEntries(product.options.map((option) => {
    const requested = useQuery ? query.get(option.id) : saved[option.id]
    const value = option.values.find((value) => value.value_id === requested) ?? option.values[0]
    return [option.id, value.value_id]
  }))
}

function ProductPage({ product, query }: { product: Product; query: URLSearchParams }) {
  const [selection, setSelection] = useState(() => initialSelection(product, query))
  const [savedLink, setSavedLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const selected = useMemo(() => product.options.flatMap((option) => {
    const value = option.values.find((value) => value.value_id === selection[option.id])
    return value ? [value] : []
  }), [product.options, selection])
  const finishes = useMemo(() => selected.filter((value) => value.color || value.roughness !== undefined || value.metalness !== undefined), [selected])
  const model = selected.findLast((value) => value.asset_url)?.asset_url ?? product.model_url
  const price = product.price === undefined ? undefined : product.price + selected.reduce((sum, value) => sum + value.modifier, 0)
  const path = categoryPath(product.category_id)

  const select = (optionId: string, value: OptionValue) => {
    setSelection({ ...selection, [optionId]: value.value_id })
    setSavedLink('')
    setCopied(false)
    setCopyFailed(false)
  }
  const save = () => {
    const params = new URLSearchParams(selection)
    const url = new URL(window.location.href)
    url.hash = `/product/${product.id}${params.size ? `?${params}` : ''}`
    try { localStorage.setItem(`forma:${product.id}`, JSON.stringify(selection)) }
    catch { /* The configuration is still encoded in the link. */ }
    window.history.replaceState(null, '', url)
    setSavedLink(url.href)
    setCopied(false)
    setCopyFailed(false)
  }

  return <div className="inner-page">
    <Breadcrumbs items={[{ title: 'Каталог', href: '#/catalog' }, ...path.map((item) => ({
      title: item.title, href: categoryLink(item.id),
    }))]} />
    <div className="configuration">
      <Suspense fallback={<div className="viewer-fallback"><Cover path={product.image_url} /><span>Загрузка 3D…</span></div>}>
        <Viewer url={model} image={product.image_url} finishes={finishes} label={`3D-модель: ${product.title}`} />
      </Suspense>
      <section className="configuration-panel" aria-label="Комплектация">
        <p className="eyebrow">{product.sku}</p>
        <h1>{product.title}</h1>
        {product.description && <p className="product-description">{product.description}</p>}
        {product.options.map((option) => <fieldset key={option.id}>
          <legend>{option.label}</legend>
          <div className="option-list">
            {option.values.map((value) => <label key={value.value_id} className="option">
              <input type="radio" name={option.id} value={value.value_id}
                checked={selection[option.id] === value.value_id} onChange={() => select(option.id, value)} />
              <span>
                {value.color && <i aria-hidden="true" style={{ backgroundColor: value.color }} />}
                {value.value_label}
              </span>
            </label>)}
          </div>
        </fieldset>)}
        {price !== undefined && <p className="price" aria-live="polite">{rubles.format(price)}</p>}
        <button className="button primary save" onClick={save}><Link2 size={18} /> Сохранить комплектацию</button>
        {savedLink && <div className="share">
          <label htmlFor="configuration-link">Ссылка на комплектацию</label>
          <div><input id="configuration-link" readOnly value={savedLink} onFocus={(event) => event.currentTarget.select()} />
            <button className="button secondary" onClick={async () => {
              try {
                await navigator.clipboard.writeText(savedLink)
                setCopied(true)
                setCopyFailed(false)
              } catch {
                setCopyFailed(true)
              }
            }}>{copied ? <><Check size={15} /> Скопировано</> : 'Копировать'}</button>
          </div>
          {copyFailed && <p role="status">Выделите ссылку и скопируйте вручную.</p>}
        </div>}
        {product.store_url && <a className="store-link" href={product.store_url}>Перейти в магазин <ArrowUpRight size={16} /></a>}
      </section>
    </div>
  </div>
}

function Missing() {
  return <div className="inner-page page-heading"><h1>Страница не найдена</h1>
    <a className="button primary" href="#/catalog"><ArrowLeft size={17} /> В каталог</a>
  </div>
}

function About() {
  return <div className="inner-page">
    <Breadcrumbs items={[]} />
    <div className="page-heading about"><h1>О проекте</h1>
      <p>«Форма» — демонстрационный 3D-шоурум. В каталоге можно рассмотреть изделия, подобрать отделку и сохранить ссылку на свою комплектацию.</p>
      <p>Изделия и цены приведены для демонстрации.</p>
      <a className="button primary" href="#/catalog">Открыть каталог <ArrowRight size={18} /></a>
    </div>
  </div>
}

function App() {
  const [route, setRoute] = useState(window.location.hash.slice(1))
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    const onHashChange = () => {
      setRoute(window.location.hash.slice(1))
      main.current?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  const [pathname, search] = route.split('?')
  const [page, id, extra] = pathname.split('/').slice(1)
  const product = page === 'product' && catalog.products.find((item) => item.id === id)
  let content
  if (!pathname || pathname === '/') content = <Home />
  else if (extra !== undefined) content = <Missing />
  else if (page === 'catalog') content = <CatalogPage id={id} />
  else if (product) content = <ProductPage key={route} product={product} query={new URLSearchParams(search)} />
  else if (page === 'about' && !id) content = <About />
  else content = <Missing />
  return <>
    <Header />
    <main className="shell" ref={main} tabIndex={-1}>{content}</main>
    <footer className="shell footer"><span>Форма · демонстрационный каталог</span><a href="#/about">О проекте</a></footer>
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
