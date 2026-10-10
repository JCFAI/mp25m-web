import { expect, test, type Page } from '@playwright/test'

const localOrigin = process.env.PLAYWRIGHT_BASE_URL
const isLocal = ['http://localhost:55442', 'http://127.0.0.1:55442'].includes(
  localOrigin ?? '',
)
const adminEmail = process.env.MP25M_E2E_EMAIL
const participantEmail = 'e2e-participant-s@mp25m.local'
const password = process.env.MP25M_E2E_PASSWORD
const articulationId = process.env.MP25M_E2E_ARTICULATION_ID
const ready = Boolean(isLocal && adminEmail === 'e2e-admin@mp25m.local' &&
  password && articulationId && /^[0-9a-f-]{36}$/i.test(articulationId))

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/panel$/)
}

async function startTour(page: Page) {
  const guide = page.getByRole('dialog', { name: 'Recorrido guiado de MP25M' })
  const start = page.getByRole('button', { name: 'Ver recorrido' })
  await expect.poll(
    async () => await guide.isVisible() || await start.isVisible(),
    { timeout: 15000 },
  ).toBe(true)
  if (!(await guide.isVisible())) await start.click()
  await expect(guide).toHaveAttribute('data-tour-ready', 'true')
  return guide
}

test.describe('MP25M_S: piloto funcional exclusivamente local', () => {
  test.skip(!ready,
    'Protección: sólo se ejecuta con Supabase local y fixture de Articulación válida.')

  for (const viewport of [
    { name: 'escritorio', width: 1440, height: 900 },
    { name: 'movil', width: 390, height: 844 },
  ]) {
    test('Participante básico: menú y tutorial ' + viewport.name,
      async ({ page }, testInfo) => {
        test.setTimeout(120_000)
        await page.setViewportSize({
          width: viewport.width, height: viewport.height,
        })
        await signIn(page, participantEmail)
        const guide = await startTour(page)

        // Estos son exactamente los ocho pasos permitidos al participante S.
        const expected = [
          'modules', 'people', 'nodes', 'organizations',
          'skills', 'profile', 'feedback', 'finish',
        ]
        for (let i = 0; i < expected.length; i++) {
          await expect(guide).toHaveAttribute('data-tour-step-key', expected[i])
          await expect(guide).toHaveAttribute('data-tour-ready', 'true')
          if (i < expected.length - 1) {
            await guide.getByRole('button', { name: 'Siguiente' }).click()
            await expect(guide).toHaveAttribute('data-tour-step-key', expected[i + 1])
          } else {
            await guide.getByRole('button', { name: 'Finalizar' }).click()
          }
        }
        await expect(guide).toHaveCount(0)
        for (const allowed of [
          'module-people', 'module-nodes',
          'module-organizations', 'module-skills',
        ]) {
          await expect(page.locator('[data-tour="' + allowed + '"]')).toHaveCount(1)
        }
        for (const forbidden of [
          'module-articulations', 'module-projects',
          'module-themes', 'home-access',
        ]) {
          await expect(page.locator('[data-tour="' + forbidden + '"]')).toHaveCount(0)
        }
        for (const route of [
          '/panel/personas',
          '/panel/nodos',
          '/panel/organizaciones',
          '/panel/habilidades',
          '/panel/perfil',
          '/panel/comentarios-piloto',
        ]) {
          await page.goto(route)
          await expect(page).toHaveURL(new RegExp(route + '$'))
          const contextualGuide = await startTour(page)
          await expect(contextualGuide).toHaveAttribute('data-tour-ready', 'true')
          await contextualGuide.getByRole('button', { name: 'Salir' }).click()
        }
        await page.screenshot({
          path: testInfo.outputPath('participante-' + viewport.name + '.png'),
          animations: 'disabled',
        })
      })

    test('Articulación local poblada: historia y recorrido ' + viewport.name,
      async ({ page }, testInfo) => {
        test.setTimeout(120_000)
        await page.setViewportSize({
          width: viewport.width, height: viewport.height,
        })
        await signIn(page, adminEmail!)
        await page.goto('/panel/articulaciones/' + articulationId)
        await expect(page.getByRole('heading', {
          name: /E2E LOCAL S - Materiales/,
        })).toBeVisible()
        await expect(page.locator('[data-tour="articulation-summary"]'))
          .toContainText('En seguimiento')
        await expect(page.locator('[data-tour="articulation-history"]'))
          .toContainText('Transición 3')
        await expect(page.locator('[data-tour="articulation-history"]'))
          .toContainText('Pruebas E2E local')
        await expect(page.locator('[data-tour="articulation-participants"]'))
          .toContainText('E2E LOCAL S Persona')
        await expect(page.locator('[data-tour="articulation-followups"]'))
          .toContainText('Reunión ficticia')
        await expect(page.locator('[data-tour="articulation-followups"]'))
          .toContainText('Compromiso ficticio')

        const guide = await startTour(page)
        const steps = [
          'articulation-summary', 'articulation-history',
          'articulation-management', 'articulation-status',
          'articulation-followup', 'articulation-participant-action',
          'articulation-participants', 'articulation-followups',
        ]
        for (const [i, key] of steps.entries()) {
          await expect(guide).toHaveAttribute('data-tour-step-key', key)
          await expect(guide).toHaveAttribute('data-tour-ready', 'true')
          const target = await guide.getAttribute('data-active-tour-target')
          expect(target, 'No se permite un paso de ficha sin destino').toBeTruthy()
          await expect(page.locator('[data-tour="' + target + '"]')).toHaveCount(1)
          await expect(page.locator('[data-tour-spotlight]'))
            .toHaveAttribute('data-tour-spotlight', key)
          await page.screenshot({
            path: testInfo.outputPath(
              'articulacion-' + viewport.name + '-paso-' + String(i + 1).padStart(2, '0') + '.png',
            ),
            animations: 'disabled',
          })
          if (i === steps.length - 1) {
            await guide.getByRole('button', { name: 'Finalizar' }).click()
          } else {
            await guide.getByRole('button', { name: 'Siguiente' }).click()
            await expect(guide).toHaveAttribute('data-tour-step-key', steps[i + 1])
          }
        }
        await expect(guide).toHaveCount(0)
      })
  }

  test('Participante básico no abre la ficha de Articulación por URL',
    async ({ page }) => {
      await signIn(page, participantEmail)
      await page.goto('/panel/articulaciones/' + articulationId)
      await expect(
        page.locator('[data-tour="articulation-summary"]'),
      ).toHaveCount(0)
      await expect(
        page.getByRole('heading', { name: /E2E LOCAL S - Materiales/ }),
      ).toHaveCount(0)
    })
})
