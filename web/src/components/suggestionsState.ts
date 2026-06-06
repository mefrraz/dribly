const KEY = 'dribly_suggestions_done'

export function isSuggestionsDone(): boolean {
    return localStorage.getItem(KEY) === 'true'
}

export function markSuggestionsDone(): void {
    localStorage.setItem(KEY, 'true')
}
