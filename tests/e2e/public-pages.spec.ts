import { expect, test } from '@playwright/test'

test('muestra la presentación institucional', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/MP25M/i)
  await expect(
    page.getByRole('heading', {
      name: 'Mapa productivo, capacidades y articulaciones',
    }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ingresar al sistema' })).toBeVisible()
})

test('muestra el acceso al backoffice', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Acceso al sistema' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Contraseña' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
})
