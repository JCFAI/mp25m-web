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
  await expect(page).toHaveURL(new RegExp(route + '$'))

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
  let precedingStep: string | null = null

  for (let i = 0; i < 40; i++) {
    // After Next, the old dialog can remain "ready" for a brief moment.
    // Require the NEXT step identity before reading its geometry.
    if (precedingStep !== null) {
      await expect.poll(
        () => page.locator('[data-tour-step-key]').getAttribute('data-tour-step-key'),
        { timeout: 15_000, message: `No avanzó el recorrido de ${route} desde ${precedingStep}` },
      ).not.toBe(precedingStep)
    }

    await expect(guide).toHaveAttribute('data-tour-ready', 'true', {
      timeout: 15_000,
    })
    await expect(guide).toHaveAttribute('data-tour-floating', 'true')
    await expect(guide.locator('[data-tour-drag-handle]')).toHaveCount(1)
    await expect.poll(async () => {
      const rect = await guide.boundingBox()
      if (!rect) return false
      const view = page.viewportSize()!
      return rect.x >= 8 && rect.y >= 8 &&
        rect.x + rect.width <= view.width - 8 &&
        rect.y + rect.height <= view.height - 8
    }, { message: 'El cuadro flotante debe quedar dentro de la pantalla' }).toBe(true)
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

    // Regression: the first mobile/laptop screen must show the first card,
    // not just a section title sitting at the bottom of the viewport.
    if (route === '/panel' && i === 0 &&
        page.viewportSize()!.width <= 1100) {
      const firstCard = page.locator('[data-tour="module-people"]')
      await expect(firstCard).toHaveCount(1)
      await expect.poll(async () => {
        const [g, card] = await Promise.all([
          guide.boundingBox(),
          firstCard.boundingBox(),
        ])
        return Boolean(g && card &&
          g.y > page.viewportSize()!.height / 2 &&
          card.y >= -4 &&
          card.y + card.height > 80 &&
          card.y < g.y - 24)
      }, { message: 'El primer módulo debe verse antes del cuadro explicativo' })
        .toBe(true)
    }

    if (targetName === 's-skills-search') {
      // Review controls must never be part of the search spotlight.
      await expect(
        page.locator('[data-tour="s-skills-search"]')
          .locator('[data-tour="s-skills-review"]'),
      ).toHaveCount(0)
    }

    if (targetName === 's-profile-details') {
      await expect(
        page.locator('[data-tour="s-profile-details"]')
          .getByRole('heading', { name: 'Identidad en el panel' }),
      ).toBeVisible()
    }

    if (targetName &&
        ['articulation-directory', 's-projects-list', 's-themes-directory']
          .includes(targetName)) {
      const root = page.locator(`[data-tour="${targetName}"]`)
      const reportedEmpty = await root.evaluate(node =>
        node.getAttribute('data-tour-empty') === 'true' ||
        node.querySelector('[data-tour-empty="true"]') !== null,
      )
      if (reportedEmpty) {
        await expect(guide).toHaveAttribute('data-tour-empty-state', 'true')
      }
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
    precedingStep = stepKey
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

  test('las descripciones flotantes se pueden mover con el mouse', async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)
    await page.goto('/panel?tour=1')
    const guide = page.getByRole('dialog', { name: 'Recorrido guiado de MP25M' })
    await expect(guide).toHaveAttribute('data-tour-floating', 'true')
    await expect(guide).toHaveAttribute('data-tour-ready', 'true')
    const handle = guide.locator('[data-tour-drag-handle]')
    const before = await guide.boundingBox()
    const grip = await handle.boundingBox()
    expect(before).toBeTruthy()
    expect(grip).toBeTruthy()
    const x = grip!.x + grip!.width / 2
    const y = grip!.y + grip!.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 32, y + 32, { steps: 8 })
    await page.mouse.up()
    const after = await guide.boundingBox()
    expect(after).toBeTruthy()
    expect(after!.x).toBeGreaterThan(before!.x + 18)
    expect(after!.y).toBeGreaterThan(before!.y + 18)
    await expect(page.locator('[data-tour-spotlight]')).toHaveCount(1)
  })
})
