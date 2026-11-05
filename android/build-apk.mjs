// Génère un projet Android TWA (Trusted Web Activity) qui ouvre la PWA en plein écran,
// à partir du manifeste web publié. Utilisé par .github/workflows/android-apk.yml.
import { TwaManifest, TwaGenerator, ConsoleLog } from '@bubblewrap/core'

const SITE = process.env.SITE_URL || 'https://camelbaggy.github.io/ptcgp-collection/'
const out = process.argv[2] || 'twa'
const version = process.env.APP_VERSION || '1.0.0'
const versionCode = Number(process.env.APP_VERSION_CODE || 1)

const manifestUrl = new URL('manifest.webmanifest', SITE)
const res = await fetch(manifestUrl)
if (!res.ok) throw new Error(`manifest ${res.status}`)
const twa = TwaManifest.fromWebManifestJson(manifestUrl, await res.json())

twa.packageId = 'io.github.camelbaggy.ptcgp'
twa.name = 'PTCGP Collection'
twa.launcherName = 'PTCGP'
twa.appVersionName = version
twa.appVersionCode = versionCode
twa.startUrl = new URL(SITE).pathname
twa.fallbackType = 'customtabs'
twa.enableNotifications = false
twa.signingKey = { path: 'android.keystore', alias: 'ptcgp' }
twa.generatorApp = 'ptcgp-ci'
twa.minSdkVersion = 24

console.log(JSON.stringify({ host: twa.host, startUrl: twa.startUrl, icon: twa.iconUrl, version, versionCode }))
await new TwaGenerator().createTwaProject(out, twa, new ConsoleLog('twa'))
