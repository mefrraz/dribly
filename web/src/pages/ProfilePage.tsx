import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    User, AtSign, FileText, Check, Loader2, LogOut,
    Lock, Key, Monitor, X, Trash2, AlertTriangle, Eye, EyeOff, ArrowLeft,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useUser, useSessionList } from '@clerk/clerk-react'
import { PageHeader } from '../components/PageHeader'
import { logger } from '../lib/logger'

export default function ProfilePage() {
    const { user, signOut } = useAuth()
    const { user: clerkUser } = useUser()
    const { sessions } = useSessionList()
    const navigate = useNavigate()

    // Profile fields
    const [firstName, setFirstName] = useState(user?.firstName || '')
    const [lastName, setLastName] = useState(user?.lastName || '')
    const [username, setUsername] = useState(user?.username || '')
    const [bio, setBio] = useState(user?.bio || '')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Password change
    const [showPwSection, setShowPwSection] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPw, setNewPw] = useState('')
    const [showCurPw, setShowCurPw] = useState(false)
    const [showNewPw, setShowNewPw] = useState(false)
    const [pwStatus, setPwStatus] = useState<'idle' | 'loading' | 'error' | 'ok'>('idle')
    const [pwError, setPwError] = useState('')

    // Delete account
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    if (!user) {
        return (
            <div className="max-w-xl mx-auto px-3 py-16 text-center">
                <p className="text-sm text-zinc-500 mb-4">Inicia sessão para ver o perfil.</p>
                <Link to="/" className="text-xs font-bold text-dribly-purple hover:underline">Voltar ao início</Link>
            </div>
        )
    }

    const handleSave = async () => {
        if (!clerkUser) return
        setSaving(true)
        setSaved(false)
        try {
            await clerkUser.update({
                username: username || undefined,
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                unsafeMetadata: { bio: bio || undefined },
            })
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch {
            logger.error('Failed to update profile')
        }
        setSaving(false)
    }

    const handleChangePassword = async () => {
        if (!clerkUser || !currentPassword || !newPw) return
        setPwStatus('loading')
        setPwError('')
        try {
            await clerkUser.updatePassword({
                currentPassword,
                newPassword: newPw,
            })
            setPwStatus('ok')
            setCurrentPassword('')
            setNewPw('')
            setTimeout(() => setPwStatus('idle'), 2000)
        } catch (err: any) {
            setPwStatus('error')
            const msg = err?.errors?.[0]?.message || ''
            if (msg.includes('incorrect'))
                setPwError('Palavra-passe atual incorreta.')
            else if (msg.includes('weak') || msg.includes('too short'))
                setPwError('Nova palavra-passe demasiado fraca.')
            else
                setPwError(msg || 'Erro ao alterar palavra-passe.')
        }
    }

    const handleDeleteAccount = async () => {
        if (!clerkUser) return
        try {
            await clerkUser.delete()
        } catch {
            alert('Erro ao apagar conta. Tenta novamente.')
        }
    }

    const currentSession = sessions?.find(s => s.status === 'active')

    const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || 'Utilizador'

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#09090b] dark:via-zinc-950 dark:to-[#09090b]">
            <div className="max-w-xl mx-auto px-3 sm:px-5 pt-6 pb-24">
                <PageHeader />

                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-full bg-dribly-purple text-white flex items-center justify-center text-xl font-bold shrink-0">
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-zinc-900 dark:text-white truncate">{displayName}</h1>
                        <p className="text-sm text-zinc-500 truncate">{user.email}</p>
                    </div>
                </div>

                {/* Profile form */}
                <div className="space-y-4">
                    <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                            <AtSign size={12} /> Username
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">@</span>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="teuusername"
                                className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                                <User size={12} /> Primeiro nome
                            </label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                                placeholder="Primeiro"
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                                <User size={12} /> Último nome
                            </label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                                placeholder="Último"
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                            <FileText size={12} /> Bio
                        </label>
                        <textarea
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            placeholder="Conta um pouco sobre ti..."
                            rows={3}
                            maxLength={200}
                            className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple resize-none"
                        />
                        <p className="text-[10px] text-zinc-400 mt-1 text-right">{bio.length}/200</p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full bg-dribly-purple text-white text-sm font-bold hover:bg-dribly-purple/90 disabled:opacity-50 transition-all active:scale-[0.97] shadow-sm shadow-dribly-purple/20"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
                            {saved ? 'Guardado!' : 'Guardar'}
                        </button>

                        <button
                            onClick={async () => { await signOut(); navigate('/') }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-[0.97]"
                        >
                            <LogOut size={16} />
                            Sair
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-white/10">
                    <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Segurança</h2>

                    {/* Change password */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden mb-3">
                        <button
                            onClick={() => setShowPwSection(!showPwSection)}
                            className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Key size={18} className="text-zinc-400" />
                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Mudar palavra-passe</span>
                            </div>
                            <ArrowLeft size={14} className={`text-zinc-400 transition-transform ${showPwSection ? '-rotate-90' : ''}`} />
                        </button>

                        {showPwSection && (
                            <div className="px-4 pb-4 space-y-3">
                                <div className="relative">
                                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                    <input
                                        type={showCurPw ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        placeholder="Palavra-passe atual"
                                        className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30"
                                    />
                                    <button type="button" onClick={() => setShowCurPw(!showCurPw)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                        {showCurPw ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>

                                <div className="relative">
                                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                    <input
                                        type={showNewPw ? 'text' : 'password'}
                                        value={newPw}
                                        onChange={e => setNewPw(e.target.value)}
                                        placeholder="Nova palavra-passe"
                                        className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30"
                                    />
                                    <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                        {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>

                                {pwStatus === 'error' && pwError && (
                                    <p className="text-xs text-red-500 font-medium">{pwError}</p>
                                )}
                                {pwStatus === 'ok' && (
                                    <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                                        <Check size={12} /> Palavra-passe alterada!
                                    </p>
                                )}

                                <button
                                    onClick={handleChangePassword}
                                    disabled={pwStatus === 'loading' || !currentPassword || !newPw}
                                    className="w-full py-2.5 rounded-full bg-dribly-purple text-white text-sm font-bold hover:bg-dribly-purple/90 disabled:opacity-50 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                                >
                                    {pwStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : null}
                                    Alterar palavra-passe
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Active sessions */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden mb-6">
                        <div className="flex items-center gap-3 p-4">
                            <Monitor size={18} className="text-zinc-400" />
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Sessões ativas</span>
                        </div>

                        <div className="border-t border-zinc-100 dark:border-white/5">
                            {sessions?.filter(s => s.status === 'active').map(session => (
                                <div key={session.id}
                                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                                            {session.id === currentSession?.id ? 'Sessão atual' : 'Outro dispositivo'}
                                        </p>
                                        <p className="text-[10px] text-zinc-400">
                                            {(session as any).lastActiveAt
                                                ? new Date((session as any).lastActiveAt).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                                : ''}
                                        </p>
                                    </div>
                                    {session.id !== currentSession?.id && (
                                        <button
                                            onClick={() => session.end()}
                                            className="p-1.5 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                            title="Terminar sessão"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Delete account */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-900/30 overflow-hidden">
                        {!showDeleteConfirm ? (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="w-full flex items-center justify-between p-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <Trash2 size={18} className="text-red-500" />
                                    <span className="text-sm font-medium text-red-600 dark:text-red-400">Apagar conta</span>
                                </div>
                            </button>
                        ) : (
                            <div className="p-4">
                                <div className="flex items-start gap-3 mb-4">
                                    <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">Tens a certeza?</p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            Esta ação é permanente e não pode ser desfeita. A tua conta e todos os dados associados serão apagados.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDeleteAccount}
                                        className="flex-1 py-2.5 rounded-full bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                                    >
                                        <Trash2 size={14} />
                                        Sim, apagar
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="flex-1 py-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
