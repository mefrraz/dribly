import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
    appId: 'pt.dribly.app',
    appName: 'Dribly',
    webDir: 'web/dist',

    // WebView loads the live site — every Vercel deploy auto-updates the app.
    server: {
        url: 'https://dribly.pt',
        cleartext: false,

    },

    plugins: {
        SplashScreen: {
            launchShowDuration: 3000,
            launchAutoHide: true,
            launchFadeInDuration: 500,
            backgroundColor: '#0D0D14',
            showSpinner: false,
            androidScaleType: 'CENTER_CROP',
        },
    },

    android: {
        allowMixedContent: false,
        captureInput: true,
        webContentsDebuggingEnabled: false,
    },
}

export default config
