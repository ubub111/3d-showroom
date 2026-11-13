import { expect, test } from '@playwright/test'

test('категории и слайдер работают на узком и широком экране', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Рассмотрите/ })).toBeVisible()
  const carousel = page.getByRole('group', { name: 'Слайдер категорий' })
  const next = page.getByRole('button', { name: 'Следующий слайд' })
  await next.click()
  await expect(carousel.getByRole('link', { name: 'Жетоны' })).toBeVisible()
  await next.press('ArrowLeft')
  await carousel.getByRole('link', { name: 'Награды' }).click()
  await expect(page.getByRole('heading', { name: 'Награды' })).toBeVisible()
  await page.getByRole('link', { name: 'Медали' }).click()
  await page.getByRole('link', { name: /Медаль «Север»/ }).click()
  await expect(page.getByText('3D-модель пока недоступна')).toBeVisible()
  expect(await page.locator('body').evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
})

test('модель, смена отделки и сохранение комплектации', async ({ page, browser, isMobile }) => {
  test.setTimeout(75_000)
  await page.goto('/#/catalog/awards')
  const modelResponse = page.waitForResponse((response) => response.url().endsWith('/models/facet.glb'))
  await page.getByRole('link', { name: /Награда «Грань»/ }).click()
  expect((await modelResponse).ok()).toBeTruthy()
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('aria-label', /Награда «Грань»/)
  if (!isMobile) {
    const area = (await canvas.boundingBox())!
    const start = { x: area.x + area.width / 2, y: area.y + area.height / 2 }
    const original = await canvas.screenshot()
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 120, start.y + 24, { steps: 8 })
    await page.mouse.up()
    await expect.poll(async () => (await canvas.screenshot()).equals(original)).toBe(false)
    await page.getByRole('button', { name: 'Сбросить ракурс' }).click()
  }
  const frame = await canvas.screenshot()
  await page.getByText('Графит', { exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Графит' })).toBeChecked()
  await expect.poll(async () => (await canvas.screenshot()).equals(frame)).toBe(false)

  const tallResponse = page.waitForResponse((response) => response.url().endsWith('/models/facet-tall.glb'))
  await page.getByText('Высокая', { exact: true }).click()
  expect((await tallResponse).ok()).toBeTruthy()
  await expect(page.locator('.price')).toHaveText(/6\s*100/)
  const tallFrame = await canvas.screenshot()
  await page.getByRole('button', { name: 'Приблизить' }).click()
  await expect.poll(async () => (await canvas.screenshot()).equals(tallFrame)).toBe(false)
  await page.getByRole('button', { name: 'Сбросить ракурс' }).click()
  await page.getByRole('button', { name: 'Сохранить комплектацию' }).click()
  const link = await page.getByLabel('Ссылка на комплектацию').inputValue()
  expect(link).toContain('finish=smoke&base=tall')
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Графит' })).toBeChecked()

  const context = await browser.newContext()
  try {
    const shared = await context.newPage()
    await shared.goto(link)
    await expect(shared.getByRole('radio', { name: 'Высокая' })).toBeChecked()
    await expect(shared.getByRole('radio', { name: 'Графит' })).toBeChecked()
  } finally {
    await context.close()
  }
})
