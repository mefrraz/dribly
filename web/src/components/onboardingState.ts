export type TourTrigger = 'signup' | 'login' | 'manual'

const ONBOARDING_KEY = 'dribly_onboarding_done'

export function isOnboardingDone(): boolean {
    return localStorage.getItem(ONBOARDING_KEY) === 'true'
}

export function markOnboardingDone(): void {
    localStorage.setItem(ONBOARDING_KEY, 'true')
}

export function triggerOnboarding(): void {
    localStorage.removeItem(ONBOARDING_KEY)
}
