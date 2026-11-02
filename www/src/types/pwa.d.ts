declare const __APP_VERSION__: string
declare const __PRIVACY_MD__: string // PRIVACY.md 전문(vite define)
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions { immediate?: boolean; onNeedRefresh?: () => void; onOfflineReady?: () => void; onRegisteredSW?: (url: string, r?: ServiceWorkerRegistration) => void; onRegisterError?: (e: unknown) => void }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}
