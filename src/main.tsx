import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ArrowRight, ArrowUpRight, Box, Check, ChevronRight, Link2 } from 'lucide-react'
import { asset, catalog, categoryLink, categoryPath, productLink, rubles, type OptionValue, type Product } from './catalog'
import { categories, Showroom } from './Showroom'
import './styles.css'

const Viewer = lazy(() => import('./Viewer'))
function Header({ active }: { active?: string }) {
  return <header className="site-header">
    <div className="shell header-inner">
      <a href="#/" className="brand" aria-label="Форма, главная"><Box size={28} strokeWidth={1.5} /><span>ФОРМА<small>3D-ШОУРУМ</small></span></a>
      <nav aria-label="Разделы">
        <a href="#/" aria-current={active === '' ? 'page' : undefined}>Главная</a>
        {categories.map((category) => <a key={category.id} href={categoryLink(category.id)}
          aria-current={active === category.id ? 'page' : undefined}>{category.title}</a>)}
      </nav>
    </div>
  </header>
}

function Cover({ path }: { path?: string }) {
  return path ? <img src={asset(path)} alt="" draggable={false} /> : <Box size={40} strokeWidth={1} />
}

function Breadcrumbs({ items }: { items: { title: string; href: string }[] }) {
  return <nav className="breadcrumbs" aria-label="Путь к странице">
    <a href="#/">Главная</a>
    {items.map((item) => <span key={item.href}><ChevronRight size={13} /><a href={item.href}>{item.title}</a></span>)}
  </nav>
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

function ProductPage({ product, query, returnTo }: { product: Product; query: URLSearchParams; returnTo: string }) {
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
        <Viewer url={model} image={product.image_url} finishes={finishes} pinViews={product.id === 'polar'} label={`3D-модель: ${product.title}`} />
      </Suspense>
      <section className="configuration-panel" aria-label="Комплектация">
        <p className="eyebrow">{product.sku} · {path.at(-1)?.title}</p>
        <h1>{product.title}</h1>
        {price !== undefined && <p className="price" aria-live="polite">{rubles.format(price)}</p>}
        {product.description && <div className="product-description"><h2>Характеристики</h2><p>{product.description}</p></div>}
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
        <a className="return-link" href={returnTo}><ArrowLeft size={16} /> Вернуться в каталог</a>
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
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/')
  const main = useRef<HTMLElement>(null)
  const previousCatalog = useRef<{ route: string; product: string; scroll: number } | null>(null)
  const rememberCatalog = (product: string) => {
    if (route.startsWith('/product/')) return
    previousCatalog.current = { route, product, scroll: window.scrollY }
  }
  const openProduct = (product: Product) => {
    rememberCatalog(product.id)
    window.location.hash = productLink(product.id)
  }
  useLayoutEffect(() => {
    const previous = previousCatalog.current
    window.scrollTo(0, previous?.route === route ? previous.scroll : 0)
  }, [route])
  useEffect(() => {
    const onHashChange = () => {
      setRoute(window.location.hash.slice(1) || '/')
      main.current?.focus({ preventScroll: true })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  const [pathname, search] = route.split('?')
  const [page, id, extra] = pathname.split('/').slice(1)
  const product = page === 'product' && catalog.products.find((item) => item.id === id)
  const home = !pathname || pathname === '/'
  const category = page === 'catalog' ? catalog.categories.find((item) => item.id === id) : undefined
  const active = home ? '' : categoryPath(category?.id ?? (product ? product.category_id : ''))[0]?.id
  let content
  if (home) content = <Showroom key="home" home onOpen={openProduct} />
  else if (extra !== undefined) content = <Missing />
  else if (page === 'catalog' && (!id || category)) content = <Showroom key={id ?? 'catalog'} category={category} onOpen={openProduct} />
  else if (product) content = <ProductPage key={route} product={product} query={new URLSearchParams(search)}
    returnTo={previousCatalog.current?.product === product.id ? `#${previousCatalog.current.route || '/'}` : categoryLink(product.category_id)} />
  else if (page === 'about' && !id) content = <About />
  else content = <Missing />
  return <>
    <Header active={active} />
    <main className="shell" ref={main} tabIndex={-1} onClick={(event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const href = target.closest('a')?.getAttribute('href')
      if (href?.startsWith('#/product/')) rememberCatalog(href.slice('#/product/'.length))
    }}>{content}</main>
    <footer className="shell footer"><span>Форма · демонстрационный каталог</span><a href="#/about">О проекте</a></footer>
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
