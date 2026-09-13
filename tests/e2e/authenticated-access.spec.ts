import { expect, test } from '@playwright/test'

const email = process.env.MP25M_E2E_EMAIL ?? 'e2e-admin@mp25m.local'
const password = process.env.MP25M_E2E_PASSWORD

test.describe('acceso autenticado', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(!password, 'Definí MP25M_E2E_PASSWORD para ejecutar las pruebas autenticadas.')

  test('permite acceder al panel de oportunidades', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill(email)
    await page.getByRole('textbox', { name: 'Contraseña' }).fill(password!)
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page).toHaveURL(/\/panel$/)

    const opportunitiesLink = page.getByRole('link', {
      name: 'Oportunidades',
      exact: true,
    })
    await expect(opportunitiesLink).toBeVisible()
    await opportunitiesLink.click()

    await expect(page).toHaveURL(/\/panel\/oportunidades$/)
    await expect(
      page.getByRole('heading', { name: 'Oportunidades', exact: true }),
    ).toBeVisible()
  })

  test('registra una oportunidad para su análisis', async ({ page }) => {
    const title = `Oportunidad E2E ${Date.now()}`

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('textbox', { name: 'Contraseña' }).fill(password!)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(/\/panel$/)

    await page.goto('/panel/oportunidades')
    await page.getByLabel('Título').fill(title)
    await page
      .getByLabel('Descripción')
      .fill('Oportunidad creada por la prueba local para verificar el análisis de Incremento 7.')
    await page.getByRole('button', { name: 'Registrar', exact: true }).click()

    await expect(page).toHaveURL(/\/panel\/oportunidades\?created=1$/)
    await expect(page.getByText('La oportunidad fue registrada correctamente.')).toBeVisible()
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible()
  })

  test('registra un requerimiento declarado para una oportunidad', async ({ page }) => {
    const opportunityTitle = `Oportunidad con requerimiento E2E ${Date.now()}`
    const requirementName = `Requerimiento E2E ${Date.now()}`

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('textbox', { name: 'Contraseña' }).fill(password!)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(/\/panel$/)

    await page.goto('/panel/oportunidades')
    await page.getByLabel('Título').fill(opportunityTitle)
    await page
      .getByLabel('Descripción')
      .fill('Oportunidad local creada para verificar el ciclo de requerimientos del Incremento 7.')
    await page.getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect(page.getByRole('link', { name: opportunityTitle, exact: true })).toBeVisible()
    await page.getByRole('link', { name: opportunityTitle, exact: true }).click()

    await expect(page.getByText('+ Registrar nuevo requerimiento', { exact: true })).toBeVisible()
    await page.getByText('+ Registrar nuevo requerimiento', { exact: true }).click()
    await page.getByLabel('Nombre').fill(requirementName)
    await page
      .getByLabel('Descripción')
      .fill('Condición local creada para comprobar el análisis de requerimientos.')
    await page.getByLabel('Requerimiento obligatorio').check()
    await page
      .getByLabel('Criterio de satisfacción')
      .fill('Existe una evidencia verificable de cumplimiento para la oportunidad.')
    await page.getByRole('button', { name: 'Crear requerimiento', exact: true }).click()

    await expect(page.getByText('El requerimiento fue creado correctamente.')).toBeVisible()

    const requirement = page.locator('article').filter({
      has: page.getByRole('heading', { name: requirementName, exact: true }),
    })
    await expect(requirement).toContainText('Declarado')
  })
})
