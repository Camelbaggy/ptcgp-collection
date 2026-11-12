import { test, expect } from '@playwright/test'
import { buildDemoBackup } from './demo-backup.mjs'

// Écran Ajout épuré (lot L05) : champ de saisie en haut, résultats visibles clavier ouvert, sélecteurs sur une ligne,
// toutes les méthodes atteignables et leurs explications dans l'aide « ? ».
const backup = buildDemoBackup()
const payload = { name: 'demo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) }

async function importDemo(page) {
  await page.goto('#/reglages')
  page.once('dialog', (d) => d.accept())
  await page.locator('input[type=file]').first().setInputFiles(payload)
  await expect(page.getByText('Sauvegarde restaurée')).toBeVisible({ timeout: 30_000 })
}

test.describe('ajout épuré', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('ptcgp:reveal.enabled', 'false') } catch { /* ignore */ } })
    page.on('pageerror', (e) => { throw new Error(`Erreur JS : ${e.message}`) })
    await importDemo(page)
  })

  test('saisie : champ au-dessus de 300 px, 4 résultats visibles avec 500 px de haut', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'clavier virtuel : mobile seulement')
    await page.goto('#/ajout?onglet=saisie')
    const input = page.locator('.ta-input')
    await expect(input).toBeVisible()
    expect((await input.boundingBox()).y).toBeLessThan(300)
    await page.setViewportSize({ width: 412, height: 500 })
    await expect(page.locator('html')).toHaveAttribute('data-kb', 'open')
    await expect(page.locator('.add-pick')).toBeHidden()
    await input.fill('a')
    await expect(page.locator('.ta-item').first()).toBeVisible()
    const fully = await page.evaluate(() => {
      const bar = document.querySelector('.actionbar').getBoundingClientRect()
      return [...document.querySelectorAll('.ta-item')].filter((li) => { const r = li.getBoundingClientRect(); return r.top >= 0 && r.bottom <= bar.top }).length
    })
    expect(fully).toBeGreaterThanOrEqual(4)
  })

  test('360 px : aucun libellé sur deux lignes dans les sélecteurs', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    for (const o of ['booster', 'pioche', 'boosters', 'extension', 'massive']) {
      await page.goto(`#/ajout?onglet=${o}`)
      await expect(page.locator('.add-pick .seg-tabs').first()).toBeVisible()
      const tall = await page.evaluate(() => [...document.querySelectorAll('.add-pick .seg-tabs button')]
        .filter((b) => b.getBoundingClientRect().height > 46).map((b) => b.textContent))
      expect(tall, o).toEqual([])
    }
  })

  test('toutes les méthodes du web sont atteignables, l\'aide reprend leurs explications', async ({ page }) => {
    const cats = { '1 booster': ['Capture', 'Saisie', 'Grille'], 'Pioche miracle': [], '10 boosters': ['Captures', 'Vidéo', 'Saisie'], '1 extension': ['Pokémon-Zone', 'Vidéo', 'Saisie'], 'Mise à jour massive': [] }
    await page.goto('#/ajout?onglet=booster')
    for (const [cat, methods] of Object.entries(cats)) {
      await page.getByRole('group', { name: 'Que veux-tu ajouter ?' }).getByRole('button', { name: cat, exact: false }).click()
      for (const m of methods) {
        await page.getByRole('group', { name: 'Méthode' }).getByRole('button', { name: new RegExp(m) }).first().click()
        await expect(page.locator('.add-page')).toBeVisible()
      }
      await page.getByRole('button', { name: 'Aide' }).click()
      await expect(page.getByRole('dialog')).toContainText(cat === 'Mise à jour massive' ? 'plusieurs extensions' : cat === 'Pioche miracle' ? 'Pioche miracle' : '')
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
  })

  test('changer de booster par la feuille', async ({ page }) => {
    await page.goto('#/ajout?onglet=saisie')
    await page.locator('.change-line').first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('group', { name: 'Extensions' })).toBeVisible()
    await dialog.getByRole('group', { name: 'Extensions' }).getByRole('button').nth(1).click()
    await expect(page.locator('.change-line').first()).toBeVisible()
  })
})
