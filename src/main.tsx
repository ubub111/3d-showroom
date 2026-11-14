import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ArrowRight, ArrowUpRight, Box, Check, ChevronRight, Link2, Search, ShoppingBag } from 'lucide-react'
import { asset, catalog, categoryLink, categoryPath, configurationLink, configurationPrice, productLink, rubles, volumeDiscount, volumeTiers, type OptionValue, type Product } from './catalog'
import { categories, Showroom } from './Showroom'
import { loadSelection, persistSelection, Quantity, quantityLimit, SelectionPage } from './SelectionPage'
import { ProductThumb, StoreDialog, StoreSearch } from './StorePanels'
import './styles.css'

const Viewer = lazy(() => import('./Viewer'))
function Header({ active, count, selectionOpen, onSearch, onCart }: {
  active?: string; count: number; selectionOpen: boolean; onSearch: () => void; onCart: () => void
}) {
  return <header className="site-header">
    <div className="shell header-inner">
      <a href="#/" className="brand" aria-label="Форма, главная"><Box size={28} strokeWidth={1.5} /><span>ФОРМА<small>3D-ШОУРУМ</small></span></a>
      <nav aria-label="Разделы">
        <a href="#/" aria-current={active === '' ? 'page' : undefined}>Главная</a>
        {categories.map((category) => <a key={category.id} href={categoryLink(category.id)}
          aria-current={active === category.id ? 'page' : undefined}>{category.title}</a>)}
      </nav>
      <div className="store-actions">
        <button className="store-icon" type="button" aria-label="Поиск" onClick={onSearch}><Search size={19} /></button>
        <button className="selection-nav" type="button" aria-label={`Корзина, ${count} позиций`}
          aria-expanded={selectionOpen} onClick={onCart}><ShoppingBag size={17} /><span className="cart-label">Корзина</span>
          <span className="cart-count">{count}</span>
        </button>
      </div>
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

function ProductPage({ product, query, returnTo, onAdd, onCart, quantityFor }: {
  product: Product; query: URLSearchParams; returnTo: string
  onAdd: (href: string, quantity: number) => void
  onCart: () => void
  quantityFor: (href: string) => number
}) {
  const [selection, setSelection] = useState(() => initialSelection(product, query))
  const [gallery, setGallery] = useState<'model' | 'photo'>('model')
  const [quantity, setQuantity] = useState(1)
  const [savedLink, setSavedLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const selected = useMemo(() => product.options.flatMap((option) => {
    const value = option.values.find((value) => value.value_id === selection[option.id])
    return value ? [value] : []
  }), [product.options, selection])
  const finishes = useMemo(() => selected.filter((value) => value.color || value.roughness !== undefined || value.metalness !== undefined), [selected])
  const model = selected.findLast((value) => value.asset_url)?.asset_url ?? product.model_url
  const price = configurationPrice(product, selected)
  const selectionHref = configurationLink(product.id, selection)
  const inSelection = quantityFor(selectionHref)
  const path = categoryPath(product.category_id)

  const select = (optionId: string, value: OptionValue) => {
    setSelection({ ...selection, [optionId]: value.value_id })
    setSavedLink('')
    setCopied(false)
    setCopyFailed(false)
  }
  const save = () => {
    const url = new URL(window.location.href)
    url.hash = selectionHref
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
      <div className="product-gallery">
        {gallery === 'photo' && product.image_url ? <div className="viewer-fallback"><img src={asset(product.image_url)} alt={product.title} /></div> :
          <Suspense fallback={<div className="viewer-fallback"><Cover path={product.image_url} /><span>Загрузка 3D…</span></div>}>
            <Viewer url={model} image={product.image_url} finishes={finishes} pinViews={product.id === 'polar'} label={`3D-модель: ${product.title}`} />
          </Suspense>}
        {product.image_url && model && <div className="gallery-controls" role="group" aria-label="Виды изделия">
          <button type="button" aria-pressed={gallery === 'model'} onClick={() => setGallery('model')}><Box size={20} /> 3D</button>
          <button type="button" aria-label="Фото изделия" aria-pressed={gallery === 'photo'} onClick={() => setGallery('photo')}>
            <img src={asset(product.image_url)} alt="" />
          </button>
        </div>}
      </div>
      <section className="configuration-panel" aria-label="Комплектация">
        <p className="eyebrow">{product.sku} · {path.at(-1)?.title}</p>
        <h1>{product.title}</h1>
        {price !== undefined && <div className="product-pricing">
          <p className="price" aria-live="polite">{rubles.format(price)} <small>за шт.</small></p>
          <div className="volume-tiers" aria-label="Скидки за тираж">{volumeTiers.map((tier) =>
            <button type="button" key={tier.quantity} onClick={() => setQuantity(tier.quantity)}>
              от {tier.quantity} шт. <strong>{tier.percent}%</strong>
            </button>)}</div>
          {quantity > 1 && <p className="product-estimate">За {quantity} шт. · {rubles.format(price * quantity - volumeDiscount(quantity, price * quantity).amount)}</p>}
        </div>}
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
        <div className="product-order">
          <Quantity value={quantity} label={product.title} onChange={setQuantity} />
          <button className="button primary save" type="button" disabled={inSelection >= quantityLimit}
          onClick={() => onAdd(selectionHref, quantity)}><ShoppingBag size={17} /> В корзину</button>
          <button className="button secondary" type="button" disabled={inSelection >= quantityLimit}
            onClick={() => { onAdd(selectionHref, quantity); onCart() }}>К оформлению</button>
        </div>
        <div className="product-selection-actions">
          <button type="button" onClick={save}><Link2 size={15} /> Сохранить комплектацию</button>
          <span role="status">{inSelection > 0 && <a href="#/selection">В подборке {inSelection} шт.</a>}</span>
        </div>
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
        <a className="return-link" href={returnTo}><ArrowLeft size={16} /> {returnTo === '#/selection' ? 'Вернуться к подборке' : 'Вернуться в каталог'}</a>
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
  const [preview, setPreview] = useState<Product | null>(null)
  const [panel, setPanel] = useState<'search' | 'cart' | null>(null)
  const [lines, setLines] = useState(loadSelection)
  useEffect(() => persistSelection(lines), [lines])
  const addLine = (href: string, quantity: number) => setLines((current) => current.some((line) => line.href === href)
    ? current.map((line) => line.href === href ? { ...line, quantity: Math.min(quantityLimit, line.quantity + quantity) } : line)
    : [...current, { href, quantity }])
  const changeQuantity = (href: string, quantity: number) => setLines((current) =>
    current.map((line) => line.href === href ? { ...line, quantity } : line))
  const removeLine = (href: string) => setLines((current) => current.filter((line) => line.href !== href))
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
      setPanel(null)
      setPreview(null)
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
  if (home) content = <Showroom key="home" home onOpen={openProduct} onPreview={setPreview} />
  else if (extra !== undefined) content = <Missing />
  else if (page === 'catalog' && (!id || category)) content = <Showroom key={id ?? 'catalog'} category={category} onOpen={openProduct} onPreview={setPreview} />
  else if (page === 'selection' && !id) content = <SelectionPage lines={lines} onQuantity={changeQuantity} onRemove={removeLine} />
  else if (product) content = <ProductPage key={route} product={product} query={new URLSearchParams(search)}
    onAdd={addLine} onCart={() => setPanel('cart')} quantityFor={(href) => lines.find((line) => line.href === href)?.quantity ?? 0}
    returnTo={previousCatalog.current?.product === product.id ? `#${previousCatalog.current.route || '/'}` : categoryLink(product.category_id)} />
  else if (page === 'menu-table' && !id) content = <div className="inner-page page-heading">
    <h1>Меню из таблицы</h1>
    <div className="menu-table"><table><thead><tr><th>Раздел</th><th>Подраздел</th><th>Изделия</th></tr></thead><tbody>
      {catalog.categories.map((category) => {
        const parent = categoryPath(category.id).at(-2)
        return <tr key={category.id}><td>{parent ? <a href={categoryLink(parent.id)}>{parent.title}</a> :
          <a href={categoryLink(category.id)}>{category.title}</a>}</td>
          <td>{parent && <a href={categoryLink(category.id)}>{category.title}</a>}</td>
          <td>{catalog.products.filter((item) => item.category_id === category.id).map((item) =>
            <a key={item.id} href={productLink(item.id)}>{item.title}</a>)}</td></tr>
      })}
    </tbody></table></div>
  </div>
  else if (page === 'about' && !id) content = <About />
  else content = <Missing />
  return <>
    <Header active={active} count={lines.length} selectionOpen={panel === 'cart'} onSearch={() => setPanel('search')} onCart={() => setPanel('cart')} />
    <main className="shell" ref={main} tabIndex={-1} onClick={(event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const href = target.closest('a')?.getAttribute('href')
      if (href?.startsWith('#/product/')) rememberCatalog(href.slice('#/product/'.length).split('?')[0])
    }}>{content}</main>
    {panel === 'search' && <StoreSearch onClose={() => setPanel(null)} onOpen={(product) => {
      setPanel(null)
      openProduct(product)
    }} />}
    {preview && <StoreDialog title={preview.title} onClose={() => setPreview(null)}>
      <div className="quick-photo"><ProductThumb product={preview} /></div>
      <p className="eyebrow">{preview.sku}</p>
      {preview.description && <p className="quick-description">{preview.description}</p>}
      {preview.price !== undefined && <p className="quick-price">от {rubles.format(preview.price)}</p>}
      <button type="button" className="button primary" onClick={() => {
        setPreview(null)
        openProduct(preview)
      }}>Открыть карточку <ArrowRight size={16} /></button>
    </StoreDialog>}
    {panel === 'cart' && <StoreDialog title="Корзина" drawer onClose={() => setPanel(null)}>
      <SelectionPage lines={lines} onQuantity={changeQuantity} onRemove={removeLine} drawer />
      <a className="all-link" href="#/selection" onClick={() => setPanel(null)}>Открыть подборку <ArrowRight size={16} /></a>
    </StoreDialog>}
    <footer className="shell footer"><span>Форма · демонстрационный каталог</span><nav aria-label="Ссылки в подвале"><a href="#/menu-table">Меню из таблицы</a><a href="#/about">О проекте</a></nav></footer>
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
