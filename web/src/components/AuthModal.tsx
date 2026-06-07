import { useState } from 'react'
import { X, Mail, Lock, User, Loader2, CheckCircle, LogIn, LogOut, Eye, EyeOff } from 'lucide-react'
import { useSignIn, useSignUp, useUser, useClerk } from '@clerk/clerk-react'

interface AuthModalProps {
    isOpen: boolean
    onClose: () => void
    onAuthSuccess?: (method: 'signin' | 'signup') => void
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
    const { isSignedIn, user: clerkUser } = useUser()
    const clerk = useClerk()
    const { signIn, isLoaded: siLoaded, setActive } = useSignIn()
    const { signUp, isLoaded: suLoaded } = useSignUp()

    const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [resetCode, setResetCode] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'sent' | 'verified' | 'pending'>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'password'>('email')
    const [showPassword, setShowPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    // Client Trust 2FA — email code second factor
    const [secondFactorNeeded, setSecondFactorNeeded] = useState(false)
    const [secondFactorCode, setSecondFactorCode] = useState('')

    const isLoaded = siLoaded && suLoaded

    if (!isOpen) return null

    const reset = () => {
        setEmail('')
        setPassword('')
        setUsername('')
        setResetCode('')
        setNewPassword('')
        setStatus('idle')
        setErrorMsg('')
        setForgotStep('email')
        setShowPassword(false)
        setShowNewPassword(false)
        setSecondFactorNeeded(false)
        setSecondFactorCode('')
    }

    const handleClose = () => {
        reset()
        onClose()
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim() || !password) return
        setStatus('loading')
        setErrorMsg('')

        try {
            if (mode === 'signup') {
                if (!username.trim()) {
                    setErrorMsg('Nome de utilizador obrigatório')
                    setStatus('error')
                    return
                }
                const result = await Promise.race([
                    signUp!.create({
                        emailAddress: email.trim(),
                        password,
                        username: username.trim(),
                    }),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('timeout')), 15000)
                    ),
                ])
                console.log('[AuthModal] signUp result:', JSON.stringify({ status: result.status, missingFields: result.missingFields, hasSession: !!result.createdSessionId }))
                if (result.status === 'complete') {
                    await setActive!({ session: result.createdSessionId! })
                    reset()
                    onClose()
                    onAuthSuccess?.('signup')
                } else {
                    // email verification pending — show as info, not error
                    setErrorMsg('Verifica o teu email para confirmares o registo.')
                    setStatus('pending')
                }
            } else {
                // Sign-in — may trigger Client Trust (email code 2FA)
                const result = await Promise.race([
                    signIn!.create({
                        identifier: email.trim(),
                        password,
                    }),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('timeout')), 15000)
                    ),
                ])
                console.log('[AuthModal] signIn result:', JSON.stringify({ status: result.status, supportedSecondFactors: result.supportedSecondFactors?.map((f: { strategy: string }) => f.strategy) }))

                if (result.status === 'complete') {
                    await setActive!({ session: result.createdSessionId! })
                    reset()
                    onClose()
                    onAuthSuccess?.('signin')
                } else if (result.status === 'needs_second_factor') {
                    // Client Trust — email code was sent automatically by Clerk
                    setSecondFactorNeeded(true)
                    setStatus('sent')
                    setErrorMsg('')
                } else {
                    setErrorMsg('Verificação adicional necessária. Verifica o teu email.')
                    setStatus('error')
                }
            }
        } catch (err: unknown) {
            console.error('[AuthModal] caught error:', err)
            setStatus('error')
            // Normalize Clerk error messages to PT
            const clerkErr = err as { errors?: { message: string }[]; message?: string }
            const msg = clerkErr?.errors?.[0]?.message || clerkErr?.message || ''
            if (msg.includes('identifier is invalid') || msg.includes('no user') || msg.includes('Invalid'))
                setErrorMsg('Email ou palavra-passe incorretos.')
            else if (msg.includes('password'))
                setErrorMsg('Palavra-passe demasiado fraca.')
            else if (msg.includes('username'))
                setErrorMsg('Este username já está em uso.')
            else if (msg.includes('timeout'))
                setErrorMsg('O pedido demorou demasiado. Verifica a tua ligação e tenta novamente.')
            else if (msg.includes('email address'))
                setErrorMsg('Este email já está registado.')
            else
                setErrorMsg(msg || 'Ocorreu um erro. Tenta novamente.')
        }
    }

    /** Verify the email code sent by Clerk for Client Trust 2FA */
    const handleVerifySecondFactor = async () => {
        if (!secondFactorCode.trim() || !signIn) return
        setStatus('loading')
        setErrorMsg('')
        try {
            const result = await signIn.attemptSecondFactor({
                strategy: 'email_code',
                code: secondFactorCode.trim(),
            })
            if (result.status === 'complete') {
                await setActive!({ session: result.createdSessionId! })
                reset()
                onClose()
                onAuthSuccess?.('signin')
            } else {
                setStatus('error')
                setErrorMsg('Código inválido. Tenta novamente.')
            }
        } catch {
            setStatus('error')
            setErrorMsg('Código inválido ou expirado.')
        }
    }

    const switchMode = () => {
        if (mode === 'forgot') {
            setMode('signin')
        } else {
            setMode(mode === 'signin' ? 'signup' : 'signin')
        }
        setErrorMsg('')
        setStatus('idle')
    }

    const handleForgotPassword = async () => {
        if (!email.trim() || !signIn) return
        setStatus('loading')
        try {
            await signIn.create({
                identifier: email.trim(),
                strategy: 'reset_password_email_code',
            })
            setStatus('sent')
            setForgotStep('code')
        } catch {
            setStatus('error')
            setErrorMsg('Email não encontrado. Verifica se está correto.')
        }
    }

    const handleVerifyResetCode = async () => {
        if (!resetCode.trim() || !newPassword || !signIn) return
        setStatus('loading')
        setErrorMsg('')
        try {
            const result = await signIn.attemptFirstFactor({
                strategy: 'reset_password_email_code',
                code: resetCode.trim(),
                password: newPassword,
            })
            if (result.status === 'complete') {
                await setActive!({ session: result.createdSessionId! })
                setForgotStep('password')
                setTimeout(() => {
                    reset()
                    onClose()
                    onAuthSuccess?.('signin')
                }, 1500)
            } else {
                setStatus('error')
                setErrorMsg('Código inválido. Tenta novamente.')
            }
        } catch {
            setStatus('error')
            setErrorMsg('Código inválido ou expirado.')
        }
    }

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={mode === 'forgot' ? 'Recuperar palavra-passe' : mode === 'signin' ? 'Iniciar sessão' : 'Criar conta'}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-white/10 p-6 ">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                    aria-label="Fechar"
                >
                    <X size={18} />
                </button>

                {isSignedIn && clerkUser ? (
                    <div className="text-center py-2">
                        <div className="w-14 h-14 mx-auto rounded-full bg-dribly-purple/10 flex items-center justify-center mb-3">
                            <CheckCircle size={28} className="text-dribly-purple" />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Sessão iniciada</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5 break-all">
                            {clerkUser.primaryEmailAddress?.emailAddress}
                        </p>
                        <button
                            onClick={() => { clerk.signOut(); handleClose() }}
                            className="w-full py-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                        >
                            <LogOut size={16} />
                            Terminar sessão
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-5">
                            <div className="w-14 h-14 mx-auto rounded-full bg-dribly-purple/10 flex items-center justify-center mb-3">
                                {mode === 'signin' ? (
                                    <LogIn size={24} className="text-dribly-purple" />
                                ) : (
                                    <User size={24} className="text-dribly-purple" />
                                )}
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
                                {mode === 'forgot' ? 'Recuperar palavra-passe' : mode === 'signin' ? 'Iniciar sessão' : 'Criar conta'}
                            </h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                {mode === 'forgot'
                                    ? 'Receberás um email para redefinir a palavra-passe.'
                                    : mode === 'signin'
                                        ? 'Entra com a tua conta.'
                                        : 'Regista-te para seguir clubes e competições.'}
                            </p>
                        </div>

                        {mode === 'forgot' ? (
                            /* Forgot password mode */
                            <div className="space-y-3">
                                {forgotStep === 'email' ? (
                                    /* Step 1: enter email */
                                    <>
                                        <div className="relative">
                                            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                placeholder="Email"
                                                autoFocus
                                                required
                                                className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple"
                                            />
                                        </div>

                                        {status === 'error' && errorMsg && (
                                            <p className="text-xs text-red-500 font-medium text-center">{errorMsg}</p>
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleForgotPassword}
                                            disabled={!isLoaded || status === 'loading'}
                                            className="w-full py-2.5 rounded-full bg-dribly-purple text-white text-sm font-bold hover:bg-dribly-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                                        >
                                            {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : null}
                                            Enviar email
                                        </button>
                                    </>
                                ) : forgotStep === 'code' ? (
                                    /* Step 2: code sent + enter code + new password */
                                    <>
                                        <div className="text-center">
                                            <CheckCircle size={24} className="text-green-500 mx-auto mb-1" />
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                                                Código enviado para o teu email.
                                            </p>
                                        </div>

                                        <div className="relative">
                                            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                            <input
                                                type="text"
                                                value={resetCode}
                                                onChange={e => setResetCode(e.target.value)}
                                                placeholder="Código de 6 dígitos"
                                                autoFocus
                                                required
                                                maxLength={6}
                                                className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple"
                                            />
                                        </div>

                                        <div className="relative">
                                            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                            <input
                                                type={showNewPassword ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                placeholder="Nova palavra-passe"
                                                minLength={6}
                                                required
                                                className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                            >
                                                {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>

                                        {status === 'error' && errorMsg && (
                                            <p className="text-xs text-red-500 font-medium text-center">{errorMsg}</p>
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleVerifyResetCode}
                                            disabled={!isLoaded || status === 'loading'}
                                            className="w-full py-2.5 rounded-full bg-dribly-purple text-white text-sm font-bold hover:bg-dribly-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                                        >
                                            {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : null}
                                            Redefinir palavra-passe
                                        </button>
                                    </>
                                ) : (
                                    /* Step 3: password changed */
                                    <div className="text-center py-2">
                                        <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                            Palavra-passe alterada com sucesso!
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : secondFactorNeeded ? (
                            /* Client Trust 2FA — enter email code */
                            <div className="space-y-3">
                                <div className="text-center">
                                    <CheckCircle size={24} className="text-green-500 mx-auto mb-1" />
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                                        Código de verificação enviado para o teu email.
                                    </p>
                                </div>
                                <div className="relative">
                                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                    <input
                                        type="text"
                                        value={secondFactorCode}
                                        onChange={e => setSecondFactorCode(e.target.value)}
                                        placeholder="Código de 6 dígitos"
                                        autoFocus
                                        required
                                        maxLength={6}
                                        className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple"
                                    />
                                </div>
                                {status === 'error' && errorMsg && (
                                    <p className="text-xs text-red-500 font-medium text-center">{errorMsg}</p>
                                )}
                                <button
                                    type="button"
                                    onClick={handleVerifySecondFactor}
                                    disabled={!isLoaded || status === 'loading'}
                                    className="w-full py-2.5 rounded-full bg-dribly-purple text-white text-sm font-bold hover:bg-dribly-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] shadow-sm shadow-dribly-purple/20 flex items-center justify-center gap-2"
                                >
                                    {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : null}
                                    Verificar código
                                </button>
                                <p className="text-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSecondFactorNeeded(false)
                                            setSecondFactorCode('')
                                            setStatus('idle')
                                            setErrorMsg('')
                                        }}
                                        className="text-[11px] text-zinc-400 hover:text-dribly-purple transition-colors"
                                    >
                                        Voltar
                                    </button>
                                </p>
                            </div>
                        ) : (
                        <form onSubmit={handleSubmit} className="space-y-3">
                            {/* Username — signup only */}
                            {mode === 'signup' && (
                                <div className="relative">
                                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        placeholder="Nome de utilizador"
                                        autoFocus
                                        required
                                        className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple"
                                    />
                                </div>
                            )}

                            {/* Email */}
                            <div className="relative">
                                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="Email"
                                    autoFocus={mode === 'signin'}
                                    required
                                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple"
                                />
                            </div>

                            {/* Password */}
                            <div className="relative">
                                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Palavra-passe"
                                    minLength={6}
                                    required
                                    className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                >
                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>

                            {/* Status messages */}
                            {status === 'error' && errorMsg && (
                                <p className="text-xs text-red-500 font-medium text-center">{errorMsg}</p>
                            )}
                            {status === 'pending' && errorMsg && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium text-center bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-xl">{errorMsg}</p>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={!isLoaded || status === 'loading'}
                                className="w-full py-2.5 rounded-full bg-dribly-purple text-white text-sm font-bold hover:bg-dribly-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] shadow-sm shadow-dribly-purple/20 flex items-center justify-center gap-2"
                            >
                                {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : null}
                                {mode === 'signin' ? 'Entrar' : 'Criar conta'}
                            </button>
                        </form>
                        )}

                        {/* Forgot password — sign in only */}
                        {mode === 'signin' && (
                            <p className="text-center mt-2">
                                <button
                                    type="button"
                                    onClick={() => { setMode('forgot'); setErrorMsg(''); setStatus('idle') }}
                                    className="text-[11px] text-zinc-400 hover:text-dribly-purple transition-colors"
                                >
                                    Esqueci a palavra-passe?
                                </button>
                            </p>
                        )}

                        {/* Mode switch */}
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center mt-4">
                            {mode === 'forgot' ? (
                                <>Lembraste-te? <button onClick={switchMode} className="text-dribly-purple font-bold hover:underline">Iniciar sessão</button></>
                            ) : mode === 'signin' ? (
                                <>Não tens conta? <button onClick={switchMode} className="text-dribly-purple font-bold hover:underline">Criar conta</button></>
                            ) : (
                                <>Já tens conta? <button onClick={switchMode} className="text-dribly-purple font-bold hover:underline">Iniciar sessão</button></>
                            )}
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}
