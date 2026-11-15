import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowUpRight, Box, Download, Search, X } from 'lucide-react'
import { asset, catalog, categoryPath, productLink, rubles, type Product } from './catalog'

export function StoreDialog({ title, onClose, children, drawer = false }: {
  title: string; onClose: () => void; children: ReactNode; drawer?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = overflow
    }
  }, [])
  return <dialog ref={dialog} aria-label={title} className={drawer ? 'store-dialog store-drawer' : 'store-dialog'}
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="store-dialog-content">
      <header><h2>{title}</h2>
        <button type="button" aria-label="Закрыть" onClick={onClose}><X size={21} /></button>
      </header>
      {children}
    </section>
  </dialog>
}

export function ProductThumb({ product }: { product: Product }) {
  const image = product.image_url
  return image ? <img src={asset(image)} alt="" loading="lazy" /> : <Box size={28} strokeWidth={1.25} />
}

export function ViewerPoster({ image, ready = false }: { image?: string; ready?: boolean }) {
  return <div className="viewer-poster" data-ready={ready} aria-hidden={ready}>
    {image && <img src={asset(image)} alt="" />}
    <span role="status">Загрузка 3D…</span>
  </div>
}

const normalize = (value: string) => value.toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export function StoreSearch({ onClose, onOpen }: { onClose: () => void; onOpen: (product: Product) => void }) {
  const [query, setQuery] = useState('')
  const words = normalize(query).split(' ').filter(Boolean)
  const results = catalog.products.filter((product) => {
    const haystack = normalize([product.title, product.sku, product.description,
      ...categoryPath(product.category_id).map(({ title }) => title),
      ...product.options.flatMap(({ values }) => values.map(({ value_label }) => value_label))].join(' '))
    return words.every((word) => haystack.includes(word))
  })
  return <StoreDialog title="Поиск по магазину" onClose={onClose}>
    <form className="store-search" role="search" onSubmit={(event) => {
      event.preventDefault()
      if (results.length === 1) onOpen(results[0])
    }}>
      <Search size={18} />
      <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        aria-label="Поиск по магазину" placeholder="Название, артикул или отделка" />
    </form>
    <p className="search-count" role="status">{words.length ? `Найдено: ${results.length}` : 'Все изделия'}</p>
    <ul className="search-results">{results.map((product) => <li key={product.id}>
      <a href={productLink(product.id)} onClick={(event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        onOpen(product)
      }}>
        <span className="search-thumb"><ProductThumb product={product} /></span>
        <span><strong>{product.title}</strong><small>{product.sku}</small></span>
        <span>{product.price === undefined ? 'Цена по запросу' : rubles.format(product.price)}</span>
        <ArrowUpRight size={15} />
      </a>
    </li>)}</ul>
  </StoreDialog>
}

export function CheckoutForm({ summary, onCancel }: { summary: string; onCancel: () => void }) {
  const [downloaded, setDownloaded] = useState(false)
  const download = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const text = [
      'Заявка на изготовление · Форма', '',
      `Имя: ${fields.get('name')}`,
      `Телефон: ${fields.get('phone')}`,
      `Компания или ИНН: ${fields.get('company') || '—'}`,
      `Доставка: ${fields.get('delivery')}`,
      `Комментарий: ${fields.get('comment') || '—'}`, '',
      summary,
    ].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'forma-zayavka.txt'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDownloaded(true)
  }
  return <form className="checkout-form" onSubmit={download}>
    <p>Скачайте заявку с контактами, тиражом и комплектациями для передачи менеджеру.</p>
    <label>Имя<input required name="name" autoComplete="name" maxLength={100} /></label>
    <label>Телефон<input required name="phone" type="tel" autoComplete="tel" maxLength={32} pattern="(?:[+0-9\s\(\)\-]*[0-9]){7,}[+0-9\s\(\)\-]*" /></label>
    <label>Компания или ИНН<input name="company" autoComplete="organization" maxLength={150} /></label>
    <fieldset><legend>Доставка</legend>{['Самовывоз', 'Курьер', 'Транспортная компания'].map((method, index) =>
      <label key={method}><input type="radio" name="delivery" value={method} defaultChecked={index === 0} />{method}</label>)}</fieldset>
    <label>Комментарий<textarea name="comment" rows={3} maxLength={1500} placeholder="Гравировка, сроки, пожелания" /></label>
    <button className="button primary" type="submit"><Download size={17} /> Скачать заявку</button>
    <button className="button secondary" type="button" onClick={onCancel}>К корзине</button>
    <p role="status">{downloaded ? 'Заявка скачана' : ''}</p>
  </form>
}
