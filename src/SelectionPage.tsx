import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Clipboard, ListPlus, Minus, Plus, Trash2 } from 'lucide-react'
import { CheckoutForm } from './StorePanels'
import { catalog, configurationPrice, engravingText, rubles, volumeDiscount } from './catalog'

export type SelectionLine = { href: string; quantity: number }
const storageKey = 'forma:selection:v1'
export const quantityLimit = 9999

export function loadSelection(): SelectionLine[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (Array.isArray(value)) return value.filter((entry): entry is SelectionLine =>
      entry && typeof entry.href === 'string' && /^#\/product\/[\w-]+(?:\?[^#]*)?$/.test(entry.href)
      && Number.isInteger(entry.quantity) && entry.quantity >= 1 && entry.quantity <= quantityLimit)
  } catch { /* Storage may be unavailable. */ }
  return []
}

export function persistSelection(lines: SelectionLine[]) {
  try { localStorage.setItem(storageKey, JSON.stringify(lines)) }
  catch { /* The selection is still available in the open tab. */ }
}

function describeLine(line: SelectionLine): SelectionLine & {
  title: string; available: boolean; sku?: string; price?: number; details?: string
} {
  const [path, search] = line.href.split('?')
  const product = catalog.products.find(({ id }) => path === `#/product/${id}`)
  if (!product) return { ...line, title: 'Изделие снято с каталога', available: false }
  const params = new URLSearchParams(search)
  const choices = product.options.flatMap((option) => {
    const value = option.values.find(({ value_id }) => value_id === params.get(option.id))
    return value ? [{ option, value }] : []
  })
  if (choices.length !== product.options.length) {
    return { ...line, title: product.title, available: false }
  }
  const price = configurationPrice(product, choices.map(({ value }) => value))
  const details = choices.map(({ option, value }) => `${option.label}: ${value.value_label}`)
  const engraving = product.id === 'facet' && engravingText(params.get('engraving'))
  if (engraving) details.push(`Надпись «${engraving}»`)
  return { ...line, available: true, title: product.title, sku: product.sku, price, details: details.join(' · ') }
}

export function Quantity({ value, label, onChange }: { value: number; label: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const quantity = Number(draft)
    if (Number.isInteger(quantity) && quantity >= 1 && quantity <= quantityLimit) onChange(quantity)
    setDraft(String(Number.isInteger(quantity) && quantity >= 1 && quantity <= quantityLimit ? quantity : value))
  }
  return <div className="selection-quantity">
    <button type="button" aria-label={`Уменьшить тираж: ${label}`} disabled={value <= 1}
      onClick={() => onChange(value - 1)}><Minus size={15} /></button>
    <input type="text" inputMode="numeric" maxLength={4} value={draft} aria-label={`Тираж: ${label}`}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
    <button type="button" aria-label={`Увеличить тираж: ${label}`} disabled={value >= quantityLimit}
      onClick={() => onChange(value + 1)}><Plus size={15} /></button>
  </div>
}

export function SelectionPage({ lines, onQuantity, onRemove, drawer = false }: {
  lines: SelectionLine[]
  drawer?: boolean
  onQuantity: (href: string, quantity: number) => void
  onRemove: (href: string) => void
}) {
  const [checkout, setCheckout] = useState(false)
  const [showText, setShowText] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const items = lines.map(describeLine)
  const subtotal = items.reduce((sum, line) => sum + (line.price ?? 0) * line.quantity, 0)
  const quantity = items.reduce((sum, line) => sum + line.quantity, 0)
  const discount = volumeDiscount(quantity, subtotal)
  const total = subtotal - discount.amount
  const complete = items.every((line) => line.price !== undefined)
  const totalLabel = complete ? 'Ориентировочная сумма' : 'Изделия с указанной ценой'
  const copyText = ['Подборка для расчёта тиража', '', ...items.flatMap((line) => [
    `${line.title}${line.sku ? ` (${line.sku})` : ''} × ${line.quantity} шт. · ${line.price === undefined ? 'цена уточняется' : rubles.format(line.price * line.quantity)}`,
    ...(line.details ? [line.details] : []),
    ...(line.available ? [new URL(line.href, location.href).href] : ['Комплектация больше недоступна']),
    '',
  ]), ...(discount.percent ? [`Скидка за тираж ${discount.percent}%: −${rubles.format(discount.amount)}`] : []), `${totalLabel}: ${rubles.format(total)}`].join('\n')
  if (checkout && items.length) return <div className={drawer ? '' : 'inner-page'}>
    <h2 className="checkout-heading">Оформление заказа</h2>
    <p className="checkout-total">{totalLabel} · {rubles.format(total)}</p>
    <CheckoutForm summary={copyText} onCancel={() => setCheckout(false)} />
  </div>
  return <div className={drawer ? 'selection-page drawer-selection' : 'inner-page selection-page'}>
    {!drawer && <><a className="return-link selection-back" href="#/catalog"><ArrowLeft size={16} /> В каталог</a>
    <div className="page-heading"><h1>Подборка</h1>
      <p>Укажите тираж и скопируйте список с выбранными комплектациями.</p>
    </div></>}
    {items.length ? <div className="selection-layout">
      <ul className="selection-list">
        {items.map((line) => <li className="selection-line" key={line.href}>
          <div className="selection-product">
            {line.sku && <span className="eyebrow">{line.sku}</span>}
            {line.available ? <a href={line.href}>{line.title}<ArrowUpRight size={15} /></a> : <strong>{line.title}</strong>}
            {line.details && <p>{line.details}</p>}
            {!line.available && <p>Комплектация больше недоступна</p>}
          </div>
          <Quantity value={line.quantity} label={line.details ? `${line.title}, ${line.details}` : line.title}
            onChange={(next) => { onQuantity(line.href, next); setCopyStatus('') }} />
          <div className="selection-line-price">
            <strong>{line.price === undefined ? 'Уточняется' : rubles.format(line.price * line.quantity)}</strong>
            {line.price !== undefined && <small>{rubles.format(line.price)} за шт.</small>}
          </div>
          <button className="selection-remove" type="button" aria-label={`Убрать: ${line.title}`}
            onClick={() => { onRemove(line.href); setCopyStatus('') }}><Trash2 size={17} /></button>
        </li>)}
      </ul>
      <aside className="selection-summary" aria-label="Итоги подборки">
        <span>{items.length} поз. · {quantity} шт.</span>
        {discount.percent > 0 && <dl className="discount-summary">
          <div><dt>Сумма без скидки</dt><dd>{rubles.format(subtotal)}</dd></div>
          <div><dt>Скидка за тираж {discount.percent}%</dt><dd>−{rubles.format(discount.amount)}</dd></div>
        </dl>}
        <p>{totalLabel}</p><strong aria-live="polite">{rubles.format(total)}</strong>
        <button className="button primary" type="button" onClick={() => setCheckout(true)}>Оформить заказ</button>
        <button className="button secondary" type="button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(copyText)
            setCopyStatus('Подборка скопирована')
          } catch {
            setShowText(true)
            setCopyStatus('Выделите и скопируйте текст')
          }
        }}><Clipboard size={17} /> Копировать подборку</button>
        <button className="selection-text-toggle" type="button" aria-expanded={showText}
          onClick={() => setShowText(!showText)}>{showText ? 'Скрыть текст' : 'Показать текст'}</button>
        <div className="selection-feedback" role="status">{copyStatus}</div>
        {showText && <textarea aria-label="Текст подборки" readOnly value={copyText} onFocus={(event) => event.currentTarget.select()} />}
      </aside>
    </div> : <div className="selection-empty">
      <ListPlus size={27} />
      <p>Добавьте изделия из каталога.</p>
      <a className="button primary" href="#/catalog">Открыть каталог</a>
    </div>}
  </div>
}
