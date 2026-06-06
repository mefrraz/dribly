import { test, expect } from '@playwright/test'

test.describe('Dribly — smoke tests', () => {
    test('landing page loads', async ({ page }) => {
        const errors: string[] = []
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text())
        })

        await page.goto('/')

        // Page title
        await expect(page).toHaveTitle(/Dribly/)

        // Navigation renders
        await expect(page.getByRole('link', { name: /Início/i })).toBeVisible()

        // Hero section renders
        await expect(page.getByText(/Basquetebol português/i).first()).toBeVisible()

        // No console errors
        expect(errors.filter(e => !e.includes('favicon') && !e.includes('Clerk'))).toEqual([])
    })

    test('clubes page loads', async ({ page }) => {
        await page.goto('/clubes')

        await expect(page.getByRole('heading', { name: /Clubes/i })).toBeVisible()
        await expect(page.getByRole('searchbox', { name: /pesquisar/i })).toBeVisible()
    })

    test('mapa page loads', async ({ page }) => {
        await page.goto('/mapa')

        // Map container renders
        await expect(page.locator('.leaflet-container')).toBeVisible()
    })
})
