import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Icon } from '../../components/Icon'
import { SectionHead } from '../../components/PageHeader'
import { useToast } from '../../components/Toast'
import { EVENT_KIND_LABEL, type NotifEventKind, type NotifSettings, type PlannedNotif } from '../../lib/notifications/plan'
import { getNotifSettings, setNotifSettings } from '../../lib/notifications/settings'
import { notifPermission, previewPlan, requestNotifPermission, reschedule, sendTestNotification } from '../../lib/notifications/native'

/** Le plugin n'existe que dans les APK récents ; un APK plus ancien reçoit ce code par la mise à jour sans APK. */
const available = Capacitor.isPluginAvailable('LocalNotifications')

const KINDS = Object.keys(EVENT_KIND_LABEL) as NotifEventKind[]

function Switch({ on, onChange, title, desc }: { on: boolean; onChange: (v: boolean) => void; title: string; desc: string }) {
  return (
    <label className="sw-row">
      <span className="grow"><span className="sw-t">{title}</span><span className="sw-d">{desc}</span></span>
      <input type="checkbox" role="switch" className="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={on ? 'chip on' : 'chip'} aria-pressed={on} onClick={onClick}>{children}</button>
}

const whenLabel = (at: number) => {
  const d = new Date(at)
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
  const day = days === 0 ? 'aujourd’hui' : days === 1 ? 'demain' : days < 7
    ? d.toLocaleDateString('fr-FR', { weekday: 'short' }) : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const m = d.getMinutes()
  return `${day} ${d.getHours()} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`
}

/** Réglages › Notifications (appli Android seulement). */
export default function NotificationsCard() {
  const toast = useToast()
  const [s, setS] = useState<NotifSettings>(getNotifSettings)
  const [perm, setPerm] = useState<'granted' | 'denied' | 'prompt' | null>(null)
  const [plan, setPlan] = useState<PlannedNotif[] | null>(null)

  const refresh = useCallback(() => Promise.all([notifPermission(), previewPlan()]).then(([p, pl]) => { setPerm(p); setPlan(pl) }), [])
  useEffect(() => {
    if (!available) return
    let off = false
    void Promise.all([notifPermission(), previewPlan()]).then(([p, pl]) => { if (!off) { setPerm(p); setPlan(pl) } })
    return () => { off = true }
  }, [])

  if (!available) {
    return (
      <section className="card">
        <SectionHead icon="bell" title="Notifications" />
        <p className="muted">Installe la dernière version de l’appli Android pour recevoir des notifications (fin d’évènement, nouvelle extension, rappel de mise à jour).</p>
        <a className="btn" href="https://github.com/Camelbaggy/ptcgp-collection/releases/latest" target="_blank" rel="noopener noreferrer"><Icon name="download" />Télécharger l’appli</a>
      </section>
    )
  }

  const save = (next: NotifSettings) => {
    setS(next); setNotifSettings(next)
    void reschedule().then(refresh)
  }
  const enable = async () => {
    const ok = await requestNotifPermission()
    setPerm(ok ? 'granted' : 'denied')
    if (!ok) { toast('Notifications refusées : autorise-les dans les réglages Android de l’appli.'); return }
    save({ ...s, enabled: true })
  }
  const toggleKind = (k: NotifEventKind) => {
    const kinds = s.events.kinds.includes(k) ? s.events.kinds.filter((x) => x !== k) : [...s.events.kinds, k]
    save({ ...s, events: { ...s.events, kinds } })
  }

  if (!s.enabled || perm !== 'granted') {
    return (
      <section className="card notif-card">
        <SectionHead icon="bell" title="Notifications" />
        <p className="muted">Reçois un mot la veille de la fin d’un évènement, le jour de sortie d’une extension, et un rappel quand ta collection n’a pas été mise à jour depuis un moment. Tout est prévu sur ton téléphone, rien ne passe par Internet.</p>
        {s.enabled && perm === 'denied' && <p className="warn">Android bloque les notifications de l’Holothèque : autorise-les dans les réglages du téléphone (Applications › Holothèque › Notifications).</p>}
        <button className="btn primary" onClick={() => { void enable() }}><Icon name="bell" />Activer les notifications</button>
      </section>
    )
  }

  return (
    <section className="card notif-card">
      <SectionHead icon="bell" title="Notifications" />
      <Switch on={s.events.on} onChange={(on) => save({ ...s, events: { ...s.events, on } })}
        title="Fin d’un évènement" desc="Regroupées si plusieurs finissent en même temps. Jamais entre 22 h et 7 h." />
      {s.events.on && (
        <div className="notif-sub">
          <span className="notif-lbl" id="nt-when">Quand</span>
          <div className="chips" role="group" aria-labelledby="nt-when">
            <Chip on={s.events.when === 'eve'} onClick={() => save({ ...s, events: { ...s.events, when: 'eve' } })}>La veille</Chip>
            <Chip on={s.events.when === '6h'} onClick={() => save({ ...s, events: { ...s.events, when: '6h' } })}>6 h avant</Chip>
            <Chip on={s.events.when === 'both'} onClick={() => save({ ...s, events: { ...s.events, when: 'both' } })}>Les deux</Chip>
          </div>
          <span className="notif-lbl" id="nt-kinds">Quels évènements</span>
          <div className="chips" role="group" aria-labelledby="nt-kinds">
            {KINDS.map((k) => <Chip key={k} on={s.events.kinds.includes(k)} onClick={() => toggleKind(k)}>{EVENT_KIND_LABEL[k]}</Chip>)}
          </div>
        </div>
      )}
      <Switch on={s.expansion.on} onChange={(on) => save({ ...s, expansion: { ...s.expansion, on } })}
        title="Nouvelle extension" desc="Le jour de sa sortie, quand le jeu change de jour." />
      {s.expansion.on && (
        <div className="notif-sub">
          <div className="chips">
            <Chip on={!s.expansion.eve} onClick={() => save({ ...s, expansion: { ...s.expansion, eve: false } })}>Le jour même</Chip>
            <Chip on={s.expansion.eve} onClick={() => save({ ...s, expansion: { ...s.expansion, eve: true } })}>La veille aussi</Chip>
          </div>
        </div>
      )}
      <Switch on={s.reminder.on} onChange={(on) => save({ ...s, reminder: { ...s.reminder, on } })}
        title="Rappel de mise à jour" desc="Si rien n’a été ajouté à ta collection (booster, échange, synchro Pokémon-Zone…), à 19 h." />
      {s.reminder.on && (
        <div className="notif-sub">
          <span className="notif-lbl" id="nt-days">Après</span>
          <div className="chips" role="group" aria-labelledby="nt-days">
            {([3, 7, 14] as const).map((d) => <Chip key={d} on={s.reminder.days === d} onClick={() => save({ ...s, reminder: { ...s.reminder, days: d } })}>{d} jours</Chip>)}
          </div>
        </div>
      )}
      <h3>Prochaines notifications</h3>
      {plan === null ? <p className="muted">Calcul…</p>
        : plan.length === 0 ? <p className="muted">Rien de prévu pour les 30 prochains jours. Synchronise les évènements pour en voir.</p>
        : (
          <ul className="notif-next">
            {plan.slice(0, 6).map((n) => <li key={n.id}><b>{whenLabel(n.at)}</b><span>{n.title}</span></li>)}
            {plan.length > 6 && <li className="muted"><span>et {plan.length - 6} autres</span></li>}
          </ul>
        )}
      <div className="row notif-actions">
        <button className="btn" onClick={() => { void sendTestNotification().then(() => toast('Notification d’essai dans 5 secondes')).catch(() => toast('Impossible d’envoyer la notification')) }}>
          <Icon name="bell" />Envoyer une notification d’essai
        </button>
        <button className="btn ghost" onClick={() => save({ ...s, enabled: false })}>Tout désactiver</button>
      </div>
    </section>
  )
}
