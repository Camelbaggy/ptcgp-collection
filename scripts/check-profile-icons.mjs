#!/usr/bin/env node
// Guette les nouvelles icônes de profil sur Serebii (update-profile-icons.yml) : compare la page à la liste publiée
// avec l'appli et écrit `new=<n>` dans $GITHUB_OUTPUT ; le workflow relance alors le déploiement, qui les embarque.
import { appendFile } from 'node:fs/promises'
import { getText } from './lib/common.mjs'
import { parseSerebiiIcons } from './lib/profileIcons.mjs'

const SEREBII_ICONS = 'https://www.serebii.net/tcgpocket/icons.shtml'
const LIVE = 'https://camelbaggy.github.io/ptcgp-collection/data/profile-icons.json'

const html = await getText(SEREBII_ICONS)
let fresh = []
if (html) fresh = parseSerebiiIcons(html, SEREBII_ICONS)
let published = null
try { published = JSON.parse((await getText(LIVE, { retries: 1 })) ?? 'null') } catch { published = null }
const known = new Set((published?.icons ?? []).map((i) => i.id))
// Page illisible : rien à faire. Liste publiée absente : premier passage, on déploie si la page a des icônes.
const news = fresh.filter((f) => !known.has(f.id))
console.log(`Serebii: ${fresh.length} icons, published: ${known.size}, new: ${news.map((n) => n.nameEn).join(', ') || 'none'}`)
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `new=${html ? news.length : 0}\n`)
