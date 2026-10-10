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
  await expect(page).toHaveURL(new RegExp(route.replaceAll('/', '\\/') + '$'))

  const startButton = page.getByRole('button', { name: 'Ver recorrido' })
  await expect(startButton).toBeVisible()
  await startButton.click()

  const guide = page.getByRole('dialog', { name: 'Recorrido guiado de MP25M' })
  await expect(guide).toBeVisible()

  let verified = 0
  for (let i = 0; i < 40; i++) {
    await expect(guide).toBeVisible()
    const targetName = await guide.getAttribute('data-active-tour-target')

    if (targetName) {
      const target = page.locator(`[data-tour="${targetName}"]`)
      await expect(target).toHaveCount(1)

      await expect.poll(async () => {
        const g = await guide.boundingBox()
        const t = await target.boundingBox()
        if (!g || !t) return 'Elementos sin dimensiones'
        const margin = Math.round(t.y - (g.y + g.height))
        const visible = t.y < page.viewportSize()!.height - 56
        return margin >= 10 && visible ? 'OK' : `Solapamiento: ${margin}px; visible: ${visible}`
      }, { message: `${route} paso ${i + 1}, destino ${targetName}`, timeout: 6000 }).toBe('OK')
      verified++
    }

    if (process.env.MP25M_E2E_TOUR_SCREENSHOTS === 'true') {
      await page.screenshot({
        path: outputPath(`${screenshotName}-paso-${String(i + 1).padStart(2, '0')}.png`),
        fullPage: false,
      })
    }

    const finish = guide.getByRole('button', { name: 'Finalizar' })
    if (await finish.isVisible()) {
      await finish.click()
      break
    }

    await guide.getByRole('button', { name: 'Siguiente' }).click()

    if (i === 39) throw new Error(`El recorrido en ${route} excede 40 pasos`)
  }

  expect(verified, `La pantalla ${route} no resaltó ninguna región`).toBeGreaterThan(0)
  await expect(guide).toHaveCount(0)
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
