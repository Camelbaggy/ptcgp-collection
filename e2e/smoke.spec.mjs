import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { buildDemoBackup } from './demo-backup.mjs'

const backup = buildDemoBackup()
const payload = { name: 'demo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) }

/** Importe le jeu de démonstration par Réglages (comme le ferait un utilisateur). */
async function importDemo(page) {
  await page.goto('#/reglages')
  page.once('dialog', (d) => d.accept())
  await page.locator('input[type=file]').first().setInputFiles(payload)
  await expect(page.getByText('Sauvegarde restaurée')).toBeVisible({ timeout: 30_000 })
}

/** Nombre d'évènements du journal (IndexedDB « ptcgp », table history). */
const countHistory = (page) => page.evaluate(() => new Promise((resolve, reject) => {
  const req = indexedDB.open('ptcgp')
  req.onerror = () => reject(req.error)
  req.onsuccess = () => {
    const c = req.result.transaction('history').objectStore('history').count()
    c.onsuccess = () => { req.result.close(); resolve(c.result) }
  }
}))

const ROUTES = [
  '/', '/collection', '/ajout', '/echange-partage', '/souhaits', '/objectifs', '/evenements', '/meta', '/pokedex',
  '/stats', '/historique', '/reglages', '/aide', '/a-propos', '/profil', '/collections-a-theme',
  '/guide-pokemon-zone', '/extension/nouvelle', '/plus',
]

test.describe('fumée', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('ptcgp:reveal.enabled', 'false') } catch { /* ignore */ } })
    page.on('pageerror', (e) => { throw new Error(`Erreur JS : ${e.message}`) })
    await importDemo(page)
  })

  test('navigation de tous les écrans sans erreur ni débordement', async ({ page }) => {
    for (const r of ROUTES) {
      await page.goto('#' + r)
      await expect(page.locator('main, .page').first()).toBeVisible()
      await expect(page.getByText('Oups, un écran a planté')).toHaveCount(0) // écran de la barrière d'erreur
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `débordement horizontal sur ${r}`).toBeLessThanOrEqual(1)
    }
  })

  test('accueil : taux de collection affiché après import', async ({ page }) => {
    await page.goto('#/')
    await expect(page.getByText(/\d+\s*%/).first()).toBeVisible()
  })

  test('recherche globale : trouve une carte et ouvre sa fiche', async ({ page }) => {
    await page.goto('#/')
    await page.getByRole('button', { name: /Rechercher une carte/ }).first().click()
    const input = page.getByRole('searchbox', { name: 'Rechercher une carte' })
    await expect(input).toBeFocused()
    await input.fill('a1-1')
    const rows = page.locator('.gs-row')
    await expect(rows.first()).toBeVisible()
    await rows.first().click()
    await expect(page.getByRole('button', { name: 'Ajouter aux souhaits' }).or(page.getByRole('button', { name: 'Dans les souhaits' }))).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+k')
    await expect(input).toBeVisible()
  })

  test('ajout d’un pack puis annulation', async ({ page }) => {
    await page.goto('#/ajout?onglet=grille')
    const tiles = page.locator('.grid .tile-main')
    await expect(tiles.first()).toBeVisible()
    for (let i = 0; i < 5; i++) await tiles.nth(i).click()
    await expect(page.getByText(/5 cartes/)).toBeVisible()
    await page.getByRole('button', { name: 'Valider' }).click()
    await expect(page.getByText(/Booster ajouté/)).toBeVisible()
    await expect.poll(() => countHistory(page)).toBe(backup.history.length + 1)
    await page.getByRole('button', { name: 'Annuler' }).click()
    await expect.poll(() => countHistory(page)).toBe(backup.history.length)
  })

  test('historique : modifier puis supprimer un ancien pack', async ({ page }) => {
    await page.goto('#/historique?type=pack')
    const rows = page.locator('.list-item.hist')
    await expect(rows.nth(1)).toBeVisible()
    await rows.nth(1).click()                                     // pas le dernier : un pack plus ancien
    await page.getByRole('button', { name: 'Modifier' }).click()
    await page.getByRole('button', { name: /^Retirer / }).first().click()
    await expect(page.getByText('Effet sur ta collection')).toBeVisible()
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Évènement modifié')).toBeVisible()
    await expect.poll(() => countHistory(page)).toBe(backup.history.length)
    await rows.nth(1).click()
    await page.getByRole('button', { name: 'Supprimer' }).click()
    await page.locator('.he-actions').getByRole('button', { name: 'Supprimer' }).click()
    await expect(page.getByText('Évènement supprimé')).toBeVisible()
    await expect.poll(() => countHistory(page)).toBe(backup.history.length - 1)
  })

  test('échange et partage : écrans utilisables', async ({ page }) => {
    for (const r of ['/echange-partage?onglet=echange', '/echange-partage?onglet=partage', '/echange', '/partage']) {
      await page.goto('#' + r)
      await expect(page.locator('.page')).toBeVisible()
      await expect(page.locator('.page input, .page select, .page button').first()).toBeVisible()
    }
  })

  test('évènements : liste et calendrier remplis', async ({ page }) => {
    await page.goto('#/evenements')
    await expect(page.getByText('Évènement de démonstration (en cours)').first()).toBeVisible()
    await expect(page.getByText('Évènement à venir de démonstration').first()).toBeVisible()
  })

  test('souhaits : bandeau rempli', async ({ page }) => {
    await page.goto('#/souhaits')
    await expect(page.locator('.page img, .page .tile').first()).toBeVisible()
  })

  test('sauvegarde invalide refusée sans rien effacer', async ({ page }) => {
    await page.goto('#/reglages')
    const bad = { ...backup, owned: [{ cardId: 'x', quantity: -3 }] }
    await page.locator('input[type=file]').first().setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) })
    await expect(page.getByText(/Rien n’a été modifié/)).toBeVisible()
  })
})

test.describe('accessibilité (axe-core)', () => {
  // Règles bloquantes : violations « critical » seulement ; le reste est consigné dans le rapport.
  for (const theme of ['dark', 'light']) {
    test(`écrans principaux, thème ${theme}`, async ({ page }, info) => {
      await importDemo(page)
      await page.evaluate((t) => localStorage.setItem('ptcgp:theme', t), theme)
      await page.reload()
      const report = []
      for (const r of ['/', '/collection', '/ajout', '/echange-partage', '/stats', '/evenements']) {
        await page.goto('#' + r)
        await page.waitForTimeout(150)
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
        for (const v of res.violations) report.push({ route: r, id: v.id, impact: v.impact, nodes: v.nodes.length })
      }
      await info.attach(`axe-${theme}.json`, { body: JSON.stringify(report, null, 2), contentType: 'application/json' })
      console.log(`axe ${theme} ${info.project.name}:`, JSON.stringify(report))
      expect(report.filter((v) => v.impact === 'critical'), 'violations critiques').toEqual([])
    })
  }
})
