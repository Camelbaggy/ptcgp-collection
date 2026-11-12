import type { HelpBlock } from '../../components/HelpSheet'
import { RECORDING_START_HELP } from '../../lib/native/recordingQueue'
import { CATS, METHOD_LABEL, type AddCat, type AddMethod } from './methods'

/*
 * Textes d'aide de l'écran Ajout (lot L05) : toutes les explications qui étaient dans le flux de la page
 * (sous-titres de catégorie, « Le plus pratique · … », consignes Pokémon-Zone et d'enregistrement d'écran)
 * sont ici, telles quelles, et s'affichent dans la feuille « ? » de l'en-tête.
 */

/** Ce que fait chaque méthode, en une ligne, selon la catégorie. */
export const HINT: Partial<Record<`${AddCat}.${AddMethod}`, string>> = {
  'booster.shot': 'Capture l\'écran de fin d\'ouverture : les cartes sont reconnues, tu vérifies puis valides.',
  'booster.manual': 'Tape le début du nom ou le numéro de chaque carte.',
  'booster.grid': 'Touche les cartes du booster dans la grille de l\'extension.',
  'boosters.screen': 'L\'appli filme le « Résumé ouverture » pendant que tu le fais défiler, puis lit tous les boosters.',
  'boosters.shots': 'Capture le « Résumé ouverture » en descendant (2 boosters par capture), ou envoie des captures déjà faites.',
  'boosters.video': 'Envoie une vidéo du « Résumé ouverture » que tu fais défiler.',
  'boosters.manual': 'Saisis les boosters l\'un après l\'autre, en validant chacun.',
  'mass.screen': 'Enregistre l\'écran « Échange de points Booster » de chaque extension : l\'extension est reconnue toute seule, puis une seule revue pour toutes.',
  'mass.pz': 'Lit ton profil Pokémon-Zone pour plusieurs extensions d\'un coup.',
  'set.pz': 'Lit la page de l\'extension sur ton profil Pokémon-Zone, et seulement celle-là.',
  'set.screen': 'L\'appli filme l\'écran « Échange de points Booster » pendant que tu le fais défiler.',
  'set.video': 'Envoie une vidéo de l\'écran « Échange de points Booster » que tu fais défiler.',
  'set.manual': 'Tape le nombre réel d\'exemplaires de chaque carte de l\'extension.',
  'wonder.manual': 'Cherche la carte que tu as obtenue, puis touche-la : elle est ajoutée à ta collection.',
}

export const ANDROID_PERMISSION = 'Android va te demander l\'autorisation de lire l\'écran : choisis « Tout l\'écran ».'

/** Consignes de « 10 boosters » (récap), par méthode. */
export const RECAP_HELP = {
  screen: 'Touche « Enregistrer depuis le jeu » (choisis « Tout l\'écran »), puis dans le jeu fais défiler le « Résumé ouverture » jusqu\'en bas. Arrête l\'enregistrement depuis la notification et reviens ici.',
  shots: 'Dans le jeu, ouvre le « Résumé ouverture » après une ouverture de plusieurs boosters et fais des captures d\'écran en descendant (2 boosters par capture), puis choisis-les ici.',
  video: 'Dans le jeu, filme l\'écran pendant que tu fais défiler le « Résumé ouverture » jusqu\'en bas, puis choisis la vidéo ici.',
} as const

/** Synchro intégrée Pokémon-Zone (appli Android). */
export const PZ_SYNC_HOW = 'Une fenêtre Pokémon-Zone s\'ouvre sur ton profil. S\'il y a une vérification de sécurité ou une connexion, fais-la : la synchro continue ensuite toute seule, en arrière-plan.'

const steps = (items: React.ReactNode[]) => <ol>{items.map((x, i) => <li key={i}>{x}</li>)}</ol>
const text = (lead: string | undefined, rest?: React.ReactNode) => <>{lead && <p>{lead}</p>}{rest}</>

const PZ_PROFILE = 'Colle une fois l\'adresse de ton profil Pokémon-Zone (par exemple pokemon-zone.com/players/123…/). L\'appli s\'en souviendra pour ouvrir directement tes extensions.'
const PZ_BOOKMARKLET = 'Un favori à lancer sur ton profil Pokémon-Zone. Sur la page d\'une extension, il te propose de lire celle-ci ou toutes tes extensions ; ailleurs sur le profil, il les lit toutes, l\'une après l\'autre (quelques minutes). Il clique sur « Load More » à ta place, relève tes cartes puis ouvre Holothèque sur l\'écran de vérification. Il ne fait que lire tes pages Pokémon-Zone, rien ne passe par ton compte Nintendo.'
const PZ_SAVED = steps([
  <>Sur ton profil Pokémon-Zone, onglet <b>« Sets »</b>, ouvre une extension et clique sur <b>« Load More »</b> jusqu'à ce que le bouton disparaisse.</>,
  'Enregistre la page (Ctrl+S sur PC, « Télécharger la page » sur téléphone). Le dossier _files n\'est pas nécessaire.',
  'Importe le fichier ici. Tu peux en choisir plusieurs, une extension par fichier.',
])
const pzWeb = (what: 'set' | 'mass') => steps([
  'Sur Pokémon-Zone, synchronise ton compte si tu as ouvert des boosters depuis la dernière fois.',
  what === 'set'
    ? <>Lance le favori <b>Holothèque</b> et choisis « Seulement l'extension » : il charge toutes les cartes et te ramène ici.</>
    : <>Lance le favori <b>Holothèque</b> et choisis « Tout » : il lit tes extensions l'une après l'autre (quelques minutes) et te ramène ici.</>,
  'Vérifie les changements, puis « Enregistrer ».',
])

const VIDEO_SCREEN = steps([
  <>Touche <b>« Enregistrer depuis le jeu »</b> (choisis « Tout l'écran »), puis « Démarrer dans 5 s ».</>,
  <>Dans le jeu, ouvre l'extension puis l'écran <b>« Échange de points Booster »</b> et fais défiler la liste <b>jusqu'en bas</b>, sans te presser.</>,
  'Arrête l\'enregistrement depuis la notification et reviens ici : l\'appli lit le nombre d\'exemplaires de chaque carte, sans rien envoyer en ligne.',
])
const VIDEO_FILE = steps([
  <>Dans le jeu, ouvre l'extension puis l'écran <b>« Échange de points Booster »</b>.</>,
  <>Lance l'enregistrement de l'écran et fais défiler la liste <b>jusqu'en bas</b>, sans te presser.</>,
  'Importe la vidéo ici : l\'appli lit le nombre d\'exemplaires de chaque carte, sans rien envoyer en ligne.',
])
const MASS_SCREEN = steps([
  <>Touche <b>« Enregistrer depuis le jeu »</b> (« Tout l'écran »), puis « Démarrer dans 5 s ».</>,
  <>Dans le jeu, ouvre une extension, puis l'écran <b>« Échange de points Booster »</b> et fais défiler la liste <b>jusqu'en bas</b>.</>,
  <>Arrête l'enregistrement : l'appli <b>reconnaît l'extension toute seule</b> et la coche ci-dessous. Recommence pour la suivante.</>,
  <>Quand tu as fini, vérifie et enregistre <b>en une seule fois</b>.</>,
])
const NATIVE_CAPTURE = <>
  <p>{ANDROID_PERMISSION}</p>
  <p>Capture prête : ouvre le jeu sur l'écran de fin d'ouverture du booster, puis touche « Capturer dans 5 s ». Le téléphone vibre quand c'est fait, puis reviens ici.</p>
  <p>Ou, depuis le jeu, touche « Capturer dans 3 s » dans la notification d'Holothèque.</p>
</>
const NATIVE_RECORDING = <><p>{ANDROID_PERMISSION}</p><p>{RECORDING_START_HELP}</p></>

/** Détail d'une méthode (en plus de sa ligne `HINT`), selon la plateforme. */
function detail(cat: AddCat, m: AddMethod, native: boolean): React.ReactNode {
  switch (`${cat}.${m}`) {
    case 'booster.shot': return <>
      <p>Choisis l'image, ou colle-la ici (Ctrl+V sur PC). Une capture = un booster : tu peux en ajouter plusieurs avant de valider.</p>
      {native && NATIVE_CAPTURE}
    </>
    case 'booster.manual': return <p>Touche une carte de la liste (ou Entrée) pour l'ajouter au booster, puis « Valider ». « Changer » choisit l'extension, le booster, ou la recherche dans tous les boosters de l'extension.</p>
    case 'boosters.screen': return <><p>{RECAP_HELP.screen}</p>{NATIVE_RECORDING}</>
    case 'boosters.shots': return <><p>{RECAP_HELP.shots}</p>{native && NATIVE_CAPTURE}</>
    case 'boosters.video': return <p>{RECAP_HELP.video}</p>
    case 'set.screen': return <>{VIDEO_SCREEN}{NATIVE_RECORDING}</>
    case 'set.video': return VIDEO_FILE
    case 'mass.screen': return <>{MASS_SCREEN}<p>Rien n'est enregistré avant ta validation. Les extensions aux cartes brillantes (boosters de luxe) ne sont pas lisibles à l'écran : saisie manuelle.</p>{NATIVE_RECORDING}</>
    case 'set.pz': case 'mass.pz': return native
      ? <><p>{PZ_SYNC_HOW}</p>{cat === 'mass' && <p>« Aussi le profil » lit aussi l'accueil, les stats, les collections à thème et les souhaits de ton profil. « Changer » choisit les extensions à lire.</p>}</>
      : pzWeb(cat === 'set' ? 'set' : 'mass')
    case 'wonder.manual': return <p>Un évènement s'ajoute à l'historique : tu peux le modifier ou le supprimer depuis Historique.</p>
    default: return null
  }
}

/** Feuille d'aide de l'écran Ajout pour la catégorie affichée : la catégorie, puis chaque méthode, la recommandée en premier. */
export function addHelp(cat: AddCat, methods: AddMethod[], native: boolean): HelpBlock[] {
  const info = CATS.find((c) => c.id === cat)!
  const blocks: HelpBlock[] = [{ title: info.label, text: info.sub + '.' }]
  methods.forEach((m, i) => {
    const hint = HINT[`${cat}.${m}`]
    blocks.push({
      title: methods.length > 1 ? `${METHOD_LABEL[m].label}${i === 0 ? ' · le plus pratique' : ''}` : undefined,
      text: text(hint, detail(cat, m, native)),
    })
  })
  if (methods.includes('pz')) {
    blocks.push({ title: 'Profil Pokémon-Zone', text: PZ_PROFILE })
    if (!native) blocks.push({ title: 'Le favori « Envoyer vers Holothèque »', text: PZ_BOOKMARKLET })
    blocks.push({ title: 'Avec une page enregistrée (.html, .mhtml)', text: PZ_SAVED })
  }
  if (cat === 'boosters' && methods.length > 1) blocks.push({ text: 'Vérifie chaque booster. Les cartes surlignées sont incertaines ; décoche un booster pour ne pas l\'ajouter.' })
  return blocks
}
