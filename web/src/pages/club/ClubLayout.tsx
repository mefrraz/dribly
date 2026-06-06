import { useState, useEffect } from 'react'
import { Outlet, useParams, Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useClub, type Club } from '../../lib/ClubContext'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export default function ClubLayout() {
    const { slug } = useParams<{ slug: string }>()
    const { getClubBySlug } = useClub()
    const [club, setClub] = useState<Club | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!slug) return
        setLoading(true)
        setError(null)
        getClubBySlug(slug)
            .then(c => {
                if (c) {
                    setClub(c)
                } else {
                    setError('Clube não encontrado')
                }
                setLoading(false)
            })
            .catch(() => {
                setError('Erro ao carregar clube')
                setLoading(false)
            })
    }, [slug, getClubBySlug])

    useEffect(() => {
        if (!club) return
        const color = !club.primary_color || club.primary_color === '#000000'
            ? '#7C3AED'
            : club.primary_color
        document.documentElement.style.setProperty('--club-color', color)
        return () => {
            document.documentElement.style.setProperty('--club-color', '#7C3AED')
        }
    }, [club])

    if (loading) {
        return (
            <LoadingSpinner />
        )
    }

    if (error || !club) {
        return (
            <div className="max-w-xl mx-auto px-3 py-32 text-center">
                <AlertCircle size={40} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
                <p className="text-sm text-zinc-500 mb-4">{error || 'Clube não encontrado'}</p>
                <Link to="/" className="text-xs font-bold text-dribly-blue hover:underline">Voltar ao início</Link>
            </div>
        )
    }

    return <Outlet context={{ club }} />
}
