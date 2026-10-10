import { expect, test, type Page } from '@playwright/test'

const email = process.env.MP25M_E2E_EMAIL
const password = process.env.MP25M_E2E_PASSWORD

const stageSRoutes = [
  '/panel',
  '/panel/personas',
  '/panel/nodos',
  '/panel/organizaciones',
  '/panel/habilidades',
  '/panel/articulaciones',
  '/panel/proyectos',
  '/panel/temas',
  '/panel/perfil',
  '/panel/comentarios-piloto',
] as const

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email!)
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/panel(?:\?|$)/)
}

async function verifyTour(
  page: Page,
  route: string,
  screenshotName: string,
  outputPath: (name: string) => string,
) {
  await page.goto(route)
  await expect(page).toHaveURL(new RegExp(route + '

  const originalBodySpacing = await page.evaluate(() => ({
    top: document.body.style.paddingTop,
    bottom: document.body.style.paddingBottom,
  }))
  const startButton = page.getByRole('button', { name: 'Ver recorrido' })
  const guide = page.getByRole('dialog', { name: 'Recorrido guiado de MP25M' })

  await expect.poll(async () =>
    (await guide.isVisible()) || (await startButton.isVisible()),
  { timeout: 20_000, message: `No se hidrató el tutorial en ${route}` }).toBe(true)

  if (!(await guide.isVisible())) await startButton.click()

  const visited = new Set<string>()
  let verified = 0
  let finished = false

  for (let i = 0; i < 40; i++) {
    // A step is NOT finished simply because the title or target is present.
    // The spotlight and dialog must belong to the same rendered step.
    await expect(guide).toHaveAttribute('data-tour-ready', 'true', {
      timeout: 15_000,
    })
    const stepKey = await guide.getAttribute('data-tour-step-key')
    expect(stepKey).toBeTruthy()
    expect(visited.has(stepKey!), `Paso duplicado en ${route}: ${stepKey}`).toBe(false)
    visited.add(stepKey!)

    const targetName = await guide.getAttribute('data-active-tour-target')
    const spot = page.locator('[data-tour-spotlight]')
    if (targetName) {
      const target = page.locator(`[data-tour="${targetName}"]`)
      await expect(target).toHaveCount(1)
      await expect(spot).toHaveAttribute('data-tour-spotlight', stepKey!)

      await expect.poll(async () => {
        const [g, t, s] = await Promise.all([
          guide.boundingBox(), target.boundingBox(), spot.boundingBox(),
        ])
        if (!g || !t || !s) return 'Faltan dimensiones'
        const viewport = page.viewportSize()!
        const intersectionWidth = Math.max(
          0, Math.min(g.x + g.width, s.x + s.width) - Math.max(g.x, s.x),
        )
        const intersectionHeight = Math.max(
          0, Math.min(g.y + g.height, s.y + s.height) - Math.max(g.y, s.y),
        )
        const overlap = intersectionWidth * intersectionHeight
        const insideTarget =
          s.x >= t.x - 7 && s.x + s.width <= t.x + t.width + 7 &&
          s.y >= t.y - 7 && s.y + s.height <= t.y + t.height + 7
        const visible =
          s.y >= -4 && s.y + s.height <= viewport.height + 4 &&
          s.height >= 30 && s.width >= 30
        return overlap <= 0.5 && insideTarget && visible
          ? 'OK'
          : `Solapamiento=${overlap}; dentro=${insideTarget}; visible=${visible}`
      }, {
        message: `${route} paso ${i + 1} (${stepKey}), foco ${targetName}`,
        timeout: 10_000,
      }).toBe('OK')
      verified++
    } else {
      await expect(spot).toHaveCount(0)
    }

    // Two animation frames make sure that screenshot and geometry reflect
    // the settled current step, not a stale scroll/spotlight transition.
    await page.evaluate(() => new Promise<void>(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ))
    await expect(guide).toHaveAttribute('data-tour-ready', 'true')
    await expect(guide).toHaveAttribute('data-tour-step-key', stepKey!)

    const bodySpacing = await page.evaluate(() => ({
      top: document.body.style.paddingTop,
      bottom: document.body.style.paddingBottom,
    }))
    expect(bodySpacing, `Padding artificial detectado en ${route}`)
      .toEqual(originalBodySpacing)

    if (process.env.MP25M_E2E_TOUR_SCREENSHOTS === 'true') {
      await page.screenshot({
        path: outputPath(`${screenshotName}-paso-${String(i + 1).padStart(2, '0')}.png`),
        fullPage: false,
        animations: 'disabled',
      })
    }

    const finish = guide.getByRole('button', { name: 'Finalizar' })
    if (await finish.isVisible()) {
      await finish.click()
      finished = true
      break
    }
    await guide.getByRole('button', { name: 'Siguiente' }).click()
  }

  expect(finished, `El recorrido de ${route} no terminó`).toBe(true)
  expect(verified, `Sin zonas resaltadas en ${route}`).toBeGreaterThan(0)
  await expect(guide).toHaveCount(0)
  const restored = await page.evaluate(() => ({
    top: document.body.style.paddingTop,
    bottom: document.body.style.paddingBottom,
  }))
  expect(restored).toEqual(originalBodySpacing)
}

test.describe('MP25M_S: el cuadro nunca cubre la zona explicada', () => {
  test.skip(!email || !password, 'Se requieren credenciales de piloto con rol administrador para probar pantallas autenticadas.')

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'portatil', width: 1024, height: 768 },
    { name: 'movil', width: 390, height: 844 },
  ]) {
    test(`recorrido integral ${viewport.name}`, async ({ page }, testInfo) => {
      test.setTimeout(180_000)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await signIn(page)

      for (const route of stageSRoutes) {
        await verifyTour(
          page, route,
          `${viewport.name}-${route.replaceAll('/', '-')}`,
          name => testInfo.outputPath(name),
        )
      }

      // A detail screen is checked when a real articulation already exists.
      await page.goto('/panel/articulaciones')
      const detail = page.locator('a[href^="/panel/articulaciones/"]').first()
      if (await detail.count()) {
        const href = await detail.getAttribute('href')
        if (href) await verifyTour(
          page, href, `${viewport.name}-ficha-articulacion`,
          name => testInfo.outputPath(name),
        )
      }
    })
  }
})
))

  const originalBodySpacing = await page.evaluate(() => ({
    top: document.body.style.paddingTop,
    bottom: document.body.style.paddingBottom,
  }))
  const startButton = page.getByRole('button', { name: 'Ver recorrido' })
  const guide = page.getByRole('dialog', { name: 'Recorrido guiado de MP25M' })

  await expect.poll(async () =>
    (await guide.isVisible()) || (await startButton.isVisible()),
  { timeout: 20_000, message: `No se hidrató el tutorial en ${route}` }).toBe(true)

  if (!(await guide.isVisible())) await startButton.click()

  const visited = new Set<string>()
  let verified = 0
  let finished = false

  for (let i = 0; i < 40; i++) {
    // A step is NOT finished simply because the title or target is present.
    // The spotlight and dialog must belong to the same rendered step.
    await expect(guide).toHaveAttribute('data-tour-ready', 'true', {
      timeout: 15_000,
    })
    const stepKey = await guide.getAttribute('data-tour-step-key')
    expect(stepKey).toBeTruthy()
    expect(visited.has(stepKey!), `Paso duplicado en ${route}: ${stepKey}`).toBe(false)
    visited.add(stepKey!)

    const targetName = await guide.getAttribute('data-active-tour-target')
    const spot = page.locator('[data-tour-spotlight]')
    if (targetName) {
      const target = page.locator(`[data-tour="${targetName}"]`)
      await expect(target).toHaveCount(1)
      await expect(spot).toHaveAttribute('data-tour-spotlight', stepKey!)

      await expect.poll(async () => {
        const [g, t, s] = await Promise.all([
          guide.boundingBox(), target.boundingBox(), spot.boundingBox(),
        ])
        if (!g || !t || !s) return 'Faltan dimensiones'
        const viewport = page.viewportSize()!
        const intersectionWidth = Math.max(
          0, Math.min(g.x + g.width, s.x + s.width) - Math.max(g.x, s.x),
        )
        const intersectionHeight = Math.max(
          0, Math.min(g.y + g.height, s.y + s.height) - Math.max(g.y, s.y),
        )
        const overlap = intersectionWidth * intersectionHeight
        const insideTarget =
          s.x >= t.x - 7 && s.x + s.width <= t.x + t.width + 7 &&
          s.y >= t.y - 7 && s.y + s.height <= t.y + t.height + 7
        const visible =
          s.y >= -4 && s.y + s.height <= viewport.height + 4 &&
          s.height >= 30 && s.width >= 30
        return overlap <= 0.5 && insideTarget && visible
          ? 'OK'
          : `Solapamiento=${overlap}; dentro=${insideTarget}; visible=${visible}`
      }, {
        message: `${route} paso ${i + 1} (${stepKey}), foco ${targetName}`,
        timeout: 10_000,
      }).toBe('OK')
      verified++
    } else {
      await expect(spot).toHaveCount(0)
    }

    // Two animation frames make sure that screenshot and geometry reflect
    // the settled current step, not a stale scroll/spotlight transition.
    await page.evaluate(() => new Promise<void>(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ))
    await expect(guide).toHaveAttribute('data-tour-ready', 'true')
    await expect(guide).toHaveAttribute('data-tour-step-key', stepKey!)

    const bodySpacing = await page.evaluate(() => ({
      top: document.body.style.paddingTop,
      bottom: document.body.style.paddingBottom,
    }))
    expect(bodySpacing, `Padding artificial detectado en ${route}`)
      .toEqual(originalBodySpacing)

    if (process.env.MP25M_E2E_TOUR_SCREENSHOTS === 'true') {
      await page.screenshot({
        path: outputPath(`${screenshotName}-paso-${String(i + 1).padStart(2, '0')}.png`),
        fullPage: false,
        animations: 'disabled',
      })
    }

    const finish = guide.getByRole('button', { name: 'Finalizar' })
    if (await finish.isVisible()) {
      await finish.click()
      finished = true
      break
    }
    await guide.getByRole('button', { name: 'Siguiente' }).click()
  }

  expect(finished, `El recorrido de ${route} no terminó`).toBe(true)
  expect(verified, `Sin zonas resaltadas en ${route}`).toBeGreaterThan(0)
  await expect(guide).toHaveCount(0)
  const restored = await page.evaluate(() => ({
    top: document.body.style.paddingTop,
    bottom: document.body.style.paddingBottom,
  }))
  expect(restored).toEqual(originalBodySpacing)
}

test.describe('MP25M_S: el cuadro nunca cubre la zona explicada', () => {
  test.skip(!email || !password, 'Se requieren credenciales de piloto con rol administrador para probar pantallas autenticadas.')

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'portatil', width: 1024, height: 768 },
    { name: 'movil', width: 390, height: 844 },
  ]) {
    test(`recorrido integral ${viewport.name}`, async ({ page }, testInfo) => {
      test.setTimeout(180_000)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await signIn(page)

      for (const route of stageSRoutes) {
        await verifyTour(
          page, route,
          `${viewport.name}-${route.replaceAll('/', '-')}`,
          name => testInfo.outputPath(name),
        )
      }

      // A detail screen is checked when a real articulation already exists.
      await page.goto('/panel/articulaciones')
      const detail = page.locator('a[href^="/panel/articulaciones/"]').first()
      if (await detail.count()) {
        const href = await detail.getAttribute('href')
        if (href) await verifyTour(
          page, href, `${viewport.name}-ficha-articulacion`,
          name => testInfo.outputPath(name),
        )
      }
    })
  }
})
