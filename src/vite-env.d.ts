/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string
declare const __APP_BUILD__: string
declare const __APP_BUILD_DATE__: string
/** version du bundle de l'appli Android (= app-version.json), sinon __APP_BUILD__ */
declare const __APP_BUNDLE__: string
declare const __APP_TARGET__: 'android' | 'web'
