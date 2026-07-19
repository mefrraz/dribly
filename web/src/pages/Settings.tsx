import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    Bell, BellOff, Settings2, ChevronRight, Check, Loader2,
    AlertTriangle, Volume2, Trophy, Activity, Flag
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useFollows } from '../hooks/useFollows'
import { usePushNotifications } from '../lib/usePushNotifications'
import { type Club, displayName } from '../lib/ClubContext'
import { supabase } from '../lib/supabase'
import { fetchBounceClubs } from '../lib/fpbApi'
import { PageHeader } from '../components/PageHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { toast } from '../components/Toast'

// ── Notification type preferences (localStorage) ──
const PREFS_KEY = 'dribly_notification_prefs'

interface NotificationPrefs {
    club_games: boolean
    league_games: boolean
    game_results: boolean
}

function loadPrefs(): NotificationPrefs {
    try {
        const raw = localStorage.getItem(PREFS_KEY)
        if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { club_games: true, league_games: true, game_results: true }
}

function savePrefs(prefs: NotificationPrefs) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

// ── Types for followed data ──
interface FollowedComp {
    competition_id: number
    competition_name: string
    association_name: string
}

// ── Page ──

export default function Settings() {
    const { user } = useAuth()
    const { follows } = useFollows()
    const {
        permission,
        subscriptions,
        subscribing,
        subscribe,
        unsubscribe,
    } = usePushNotifications()

    const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs)
    const [followedClubs, setFollowedClubs] = useState<Club[]>([])
    const [followedComps, setFollowedComps] = useState<FollowedComp[]>([])
    const [loadingFollowed, setLoadingFollowed] = useState(false)

    // ── Persist prefs ──
    const togglePref = (key: keyof NotificationPrefs) => {
        const next = { ...prefs, [key]: !prefs[key] }
        setPrefs(next)
        savePrefs(next)
    }

    // ── Load followed clubs + competitions ──
    useEffect(() => {
        if (!user || follows.length === 0) {
            setFollowedClubs([])
            setFollowedComps([])
            return
        }
        setLoadingFollowed(true)
        const clubIds = follows.filter(f => f.entity_type === 'club').map(f => f.entity_id)
        const compIds = follows.filter(f => f.entity_type === 'competition').map(f => f.entity_id)

        Promise.all([
            clubIds.length > 0
                ? fetchBounceClubs().then(all => all.filter(c => clubIds.includes(c.id)))
                    .then(data => data as Club[])
                : Promise.resolve([] as Club[]),
            compIds.length > 0
                ? supabase.from('competitions').select('competition_id, competition_name, association_id, association_name')
                    .in('competition_id', compIds).eq('season', '2025/2026')
                    .then(({ data }) => {
                        const seen = new Map<number, FollowedComp>()
                        if (data) (data as FollowedComp[]).forEach(c => {
                            if (!seen.has(c.competition_id)) seen.set(c.competition_id, c)
                        })
                        return Array.from(seen.values())
                    })
                : Promise.resolve([] as FollowedComp[]),
        ]).then(([clubs, comps]) => {
            setFollowedClubs(clubs)
            setFollowedComps(comps)
            setLoadingFollowed(false)
        })
    }, [user, follows])

    const hasActiveSubscription = subscriptions.length > 0
    const isSubscribed = permission === 'granted' && hasActiveSubscription
    const notificationsPossible = permission !== 'unsupported'

    return (
        <div className="max-w-xl mx-auto pb-24 px-3">
            <PageHeader />

            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-1 text-center">
                Definições
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-8">
                Gere as notificações e preferências
            </p>

            {/* ── Notifications Section ── */}
            {notificationsPossible ? (
                <>
                    <div className="mb-2 flex items-center gap-2">
                        <Bell size={14} className="text-dribly-purple" strokeWidth={2.5} />
                        <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                            Notificações
                        </h2>
                    </div>

                    {/* Push subscription toggle */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden mb-6">
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                    isSubscribed
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                                }`}>
                                    {isSubscribed ? <Bell size={18} /> : <BellOff size={18} />}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                        {isSubscribed ? 'Notificações ativas' : 'Notificações desativadas'}
                                    </p>
                                    <p className="text-[11px] text-zinc-400 truncate">
                                        {permission === 'denied'
                                            ? 'Bloqueadas pelo navegador'
                                            : hasActiveSubscription
                                                ? `${subscriptions.length} dispositivo(s) registado(s)`
                                                : 'Toque para ativar'}
                                    </p>
                                </div>
                            </div>
                            {isSubscribed ? (
                                <button
                                    onClick={async () => {
                                        const ok = await unsubscribe()
                                        if (ok) toast.success('Notificações desativadas')
                                    }}
                                    className="shrink-0 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors active:scale-[0.97]"
                                >
                                    Desativar
                                </button>
                            ) : (
                                <button
                                    onClick={async () => {
                                        if (!user) {
                                            toast.error('Inicia sessão para ativar notificações')
                                            return
                                        }
                                        const ok = await subscribe()
                                        if (ok) toast.success('Notificações ativadas!')
                                        else if (permission === 'denied') {
                                            toast.error('Notificações bloqueadas. Verifica as definições do navegador.')
                                        }
                                    }}
                                    disabled={subscribing || permission === 'denied'}
                                    className="shrink-0 px-3 py-1.5 rounded-full bg-dribly-purple text-white text-xs font-bold hover:bg-dribly-purple/90 disabled:opacity-50 transition-all active:scale-[0.97] flex items-center gap-1.5"
                                >
                                    {subscribing ? <Loader2 size={12} className="animate-spin" /> : null}
                                    Ativar
                                </button>
                            )}
                        </div>

                        {permission === 'denied' && (
                            <div className="px-4 pb-4">
                                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/30">
                                    <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                                        As notificações estão bloqueadas no teu navegador.
                                        Vai às definições do Chrome (⋮ → Definições → Notificações) e permite notificações para dribly.pt.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Notification type toggles */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Settings2 size={14} className="text-dribly-purple" strokeWidth={2.5} />
                            <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                                Tipos de notificação
                            </h2>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden divide-y divide-zinc-100 dark:divide-white/5">
                            {/* Club games */}
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-dribly-purple/10 flex items-center justify-center">
                                        <Volume2 size={16} className="text-dribly-purple" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                            Jogos dos clubes
                                        </p>
                                        <p className="text-[10px] text-zinc-400">
                                            Notificações para jogos dos clubes que segues
                                        </p>
                                    </div>
                                </div>
                                <Toggle active={prefs.club_games} onChange={() => togglePref('club_games')} />
                            </div>

                            {/* League games */}
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-dribly-purple/10 flex items-center justify-center">
                                        <Trophy size={16} className="text-dribly-purple" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                            Jogos das ligas
                                        </p>
                                        <p className="text-[10px] text-zinc-400">
                                            Notificações para jogos das ligas que segues
                                        </p>
                                    </div>
                                </div>
                                <Toggle active={prefs.league_games} onChange={() => togglePref('league_games')} />
                            </div>

                            {/* Game results */}
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-dribly-purple/10 flex items-center justify-center">
                                        <Flag size={16} className="text-dribly-purple" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                            Resultados finais
                                        </p>
                                        <p className="text-[10px] text-zinc-400">
                                            Notificações quando um jogo termina com resultado
                                        </p>
                                    </div>
                                </div>
                                <Toggle active={prefs.game_results} onChange={() => togglePref('game_results')} />
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-6 text-center mb-6">
                    <BellOff size={28} className="text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        As notificações push não são suportadas neste navegador.
                    </p>
                </div>
            )}

            {/* ── Followed items with notification indicators ── */}
            {user && (followedClubs.length > 0 || followedComps.length > 0) && (
                <>
                    <div className="flex items-center gap-2 mb-3">
                        <Activity size={14} className="text-dribly-purple" strokeWidth={2.5} />
                        <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                            Itens seguidos
                        </h2>
                        {isSubscribed && (
                            <span className="ml-auto text-[10px] font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                                <Check size={10} /> Notificações ativas
                            </span>
                        )}
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden divide-y divide-zinc-100 dark:divide-white/5 mb-6">
                        {loadingFollowed ? (
                            <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                        ) : (
                            <>
                                {followedClubs.map(club => (
                                    <Link
                                        key={club.id}
                                        to={`/clube/${club.slug}/home`}
                                        className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                            {club.logo_url ? (
                                                <img src={club.logo_url} alt="" className="w-6 h-6 object-contain" />
                                            ) : (
                                                <span className="text-xs font-bold text-zinc-400">
                                                    {displayName(club).charAt(0)}
                                                </span>
                                            )}
                                        </div>
                                        <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                                            {displayName(club)}
                                        </span>
                                        {isSubscribed && prefs.club_games && (
                                            <Bell size={14} className="text-green-500 shrink-0" />
                                        )}
                                        <ChevronRight size={14} className="text-zinc-300 shrink-0" />
                                    </Link>
                                ))}
                                {followedComps.map(comp => (
                                    <Link
                                        key={comp.competition_id}
                                        to={`/competicao/${comp.competition_id}`}
                                        className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-dribly-purple/10 flex items-center justify-center shrink-0">
                                            <Trophy size={14} className="text-dribly-purple" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                                                {comp.competition_name}
                                            </p>
                                            <p className="text-[10px] text-zinc-400">{comp.association_name}</p>
                                        </div>
                                        {isSubscribed && prefs.league_games && (
                                            <Bell size={14} className="text-green-500 shrink-0" />
                                        )}
                                        <ChevronRight size={14} className="text-zinc-300 shrink-0" />
                                    </Link>
                                ))}
                            </>
                        )}
                    </div>
                </>
            )}

            {/* ── Profile link ── */}
            <Link
                to="/perfil"
                className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl hover:border-dribly-purple/40 transition-colors"
            >
                <div className="w-9 h-9 rounded-full bg-dribly-purple text-white flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">
                        {user ? (user.email?.charAt(0).toUpperCase()) : '?'}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {user ? 'Perfil' : 'Iniciar sessão'}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                        {user ? user.email : 'Gere a tua conta e preferências'}
                    </p>
                </div>
                <ChevronRight size={16} className="text-zinc-300" />
            </Link>
        </div>
    )
}

// ── Toggle switch component ──
function Toggle({ active, onChange }: { active: boolean; onChange: () => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-dribly-purple/30 focus:ring-offset-2 ${
                active ? 'bg-dribly-purple' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${
                    active ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
        </button>
    )
}
