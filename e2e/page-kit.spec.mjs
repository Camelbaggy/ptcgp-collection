import { test, expect } from '@playwright/test'
import { buildDemoBackup } from './demo-backup.mjs'

// Kit de page épuré (L01) : en-tête jamais recouvert, feuille d'aide, clavier virtuel.
const backup = buildDemoBackup()
const payload = { name: 'demo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) }

async function importDemo(page) {
  await page.goto('#/reglages')
  page.once('dialog', (d) => d.accept())
  await page.locator('input[type=file]').first().setInputFiles(payload)
  await expect(page.getByText('Sauvegarde restaurée')).toBeVisible({ timeout: 30_000 })
}

const ROUTES = [
  '/collection', '/ajout', '/ajout?onglet=boosters', '/ajout?onglet=extension', '/ajout?onglet=massive', '/echange-partage',
  '/echange-partage?onglet=partage', '/echange-partage?onglet=ami', '/souhaits', '/evenements', '/meta', '/pokedex',
  '/stats', '/stats?onglet=activite', '/stats?onglet=vie', '/historique', '/reglages', '/reglages?onglet=donnees', '/aide',
  '/a-propos', '/collections-a-theme', '/guide-pokemon-zone', '/extension/nouvelle', '/plus', '/points-booster',
]

/** Chevauchements dans l'en-tête : boutons de `.ph-act` entre eux, et éléments fixes (hors barre du bas) sur `.ph`. */
const headerProblems = (page) => page.evaluate(() => {
  const out = []
  const ph = document.querySelector('.ph')
  if (!ph) return ['pas de .ph']
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
  const acts = [...document.querySelectorAll('.ph-act > *')].map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width > 0)
  for (let i = 0; i < acts.length; i++) {
    for (let j = i + 1; j < acts.length; j++) if (hit(acts[i][1], acts[j][1])) out.push(`${acts[i][0].className} / ${acts[j][0].className}`)
    if (acts[i][1].right > window.innerWidth + 1) out.push(`${acts[i][0].className} hors écran`)
  }
  const head = ph.getBoundingClientRect()
  for (const el of document.querySelectorAll('body *')) {
    if (getComputedStyle(el).position !== 'fixed' || el.closest('.tabs, .side') || ph.contains(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && hit(r, head)) out.push(`fixe : ${el.tagName}.${el.className}`)
  }
  return out
})

test.describe('kit de page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('ptcgp:reveal.enabled', 'false') } catch { /* ignore */ }
    })
    await importDemo(page)
    // Synchro « activée » après l'import : l'icône d'état apparaît dans l'en-tête (elle passe vite en « Reconnexion »).
    await page.evaluate(() => localStorage.setItem('ptcgp.sync.enabled', '1'))
    await page.reload()
  })

  for (const width of [360, 412, 450]) {
    test(`en-tête jamais recouvert à ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const problems = []
      for (const r of ROUTES) {
        await page.goto('#' + r)
        await expect(page.locator('.ph').first()).toBeVisible()
        await expect(page.locator('.ph .sync-ico')).toHaveCount(1)
        for (const p of await headerProblems(page)) problems.push(`${r} : ${p}`)
      }
      expect(problems).toEqual([])
    })
  }

  test('aide : ouverture, fermeture (croix, Échap, glisser), focus rendu au « ? »', async ({ page }) => {
    await page.goto('#/souhaits')
    const help = page.locator('.ph').getByRole('button', { name: 'Aide' })
    const dialog = page.getByRole('dialog', { name: 'Aide · Souhaits' })

    await help.click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(help).toBeFocused()

    await help.click()
    await dialog.getByRole('button', { name: 'Fermer' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(help).toBeFocused()

    await help.click()
    const grab = dialog.locator('.sheet-drag')
    const box = await grab.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + 8)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 200, { steps: 8 })
    await page.mouse.up()
    await expect(dialog).toHaveCount(0)
    await expect(help).toBeFocused()
  })

  test('clavier ouvert : barre du bas masquée, barre d\'action en bas', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'barre du bas : mobile seulement')
    await page.goto('#/ajout?onglet=saisie')
    await expect(page.locator('.tabs')).toBeVisible()
    await page.setViewportSize({ width: 412, height: 500 })
    await expect(page.locator('html')).toHaveAttribute('data-kb', 'open')
    await expect(page.locator('.tabs')).toBeHidden()
    await page.setViewportSize({ width: 412, height: 900 })
    await expect(page.locator('html')).not.toHaveAttribute('data-kb', 'open')
    await expect(page.locator('.tabs')).toBeVisible()
  })
})
