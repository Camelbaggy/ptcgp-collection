import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.github.camelbaggy.ptcgp',
  appName: 'Holothèque',
  webDir: 'dist',
  backgroundColor: '#0f1420',
  android: { backgroundColor: '#0f1420' },
  server: { androidScheme: 'https' },
  plugins: {
    // Mode manuel : le JS décide quand télécharger et activer un bundle (pas de cloud Capgo).
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: '',
      channelUrl: '',
      appReadyTimeout: 15000,
    },
    // Notifications locales : petite icône blanche `res/drawable/ic_stat_holo.xml`, teinte violette du thème.
    LocalNotifications: {
      smallIcon: 'ic_stat_holo',
      iconColor: '#a794ff',
    },
  },
}

export default config
