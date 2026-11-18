/**
 * Captures et vidéos choisies dans la mémoire du téléphone (appli Android) : on retient d'où vient
 * chaque fichier pour pouvoir supprimer l'original une fois les boosters ajoutés (réglage
 * « Supprimer les captures après l'ajout », Android demande une confirmation).
 * Sur le web, et avec un APK qui n'a pas encore `pickMedia`, le champ <input type="file"> reste utilisé.
 */
import { Capacitor } from '@capacitor/core'
import { prefGet, prefSet } from '../storage'
import { HoloNative, captureBlob, isNative } from './holoNative'

export type PickKind = 'image' | 'video' | 'any'

/** Original supprimable de chaque fichier choisi (document Android). */
const origins = new WeakMap<Blob, string>()

/** L'APK installé sait-il choisir des fichiers lui-même ? (lu dans la liste des méthodes du module natif) */
export function hasNativePicker(): boolean {
  if (!isNative) return false
  type Header = { name: string; methods: { name: string }[] }
  const headers = (Capacitor as unknown as { PluginHeaders?: Header[] }).PluginHeaders
  return !!headers?.find((h) => h.name === 'HoloNative')?.methods.some((m) => m.name === 'pickMedia')
}

/** Ouvre le sélecteur d'Android ; liste vide si l'utilisateur annule. */
export async function pickFromPhone(kind: PickKind, multiple: boolean): Promise<File[]> {
  const { items } = await HoloNative.pickMedia({ kind, multiple })
  const files: File[] = []
  for (const it of items) {
    const blob = await captureBlob(it)
    const file = new File([blob], it.name, { type: it.mime || blob.type })
    if (it.deletable) origins.set(file, it.uri)
    files.push(file)
  }
  return files
}

/** Originaux (sans doublon) des fichiers donnés ; vide pour ceux qui ne viennent pas du sélecteur d'Android. */
export function originsOf(blobs: Iterable<Blob>): string[] {
  const out = new Set<string>()
  for (const b of blobs) { const u = origins.get(b); if (u) out.add(u) }
  return [...out]
}

const PREF = 'capture.deleteAfter'
export const isDeleteAfterEnabled = () => prefGet(PREF, true)
export const setDeleteAfterEnabled = (on: boolean) => prefSet(PREF, on)

/** Texte ajouté au message d'enregistrement selon le résultat de la suppression. */
export function deletionNote(r: { deleted: number; failed: number; cancelled: boolean }, asked: number): string {
  if (r.cancelled && !r.deleted) return asked > 1 ? 'captures gardées' : 'capture gardée'
  const parts: string[] = []
  if (r.deleted) parts.push(r.deleted > 1 ? `${r.deleted} captures supprimées du téléphone` : 'capture supprimée du téléphone')
  const left = asked - r.deleted
  if (left > 0) parts.push(left > 1 ? `${left} non supprimées` : '1 non supprimée')
  return parts.join(', ')
}

type Toast = (msg: string, action?: { label: string; run: () => void }) => void

/**
 * Après un enregistrement réussi : affiche le message, puis, si le réglage est actif, supprime les
 * originaux (fenêtre de confirmation d'Android) et complète le message en gardant son action « Annuler ».
 */
export async function toastAndDeleteOrigins(toast: Toast, msg: string, action: Parameters<Toast>[1], uris: string[]): Promise<void> {
  toast(msg, action)
  if (!uris.length || !isNative || !isDeleteAfterEnabled()) return
  try {
    const r = await HoloNative.deleteMedia({ uris })
    toast(`${msg} · ${deletionNote(r, uris.length)}`, action)
  } catch (e) {
    void HoloNative.log({ message: `[galerie] suppression : ${(e as Error).message ?? e}` }).catch(() => {})
    toast(`${msg} · ${deletionNote({ deleted: 0, failed: uris.length, cancelled: false }, uris.length)}`, action)
  }
}
