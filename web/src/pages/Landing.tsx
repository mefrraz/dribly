// RULE: Landing page has NO width constraints (no max-w-* mx-auto)
// Sections use px-4 but span full width for edge-to-edge carousels.

import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, ChevronRight, ChevronLeft, ArrowRight, Trophy, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { GameCard } from '../components/GameCard'
import { useClub, type Club, displayName } from '../lib/ClubContext'
import { useAuth } from '../lib/AuthContext'
import { type Match } from '../components/types'
import { normalize, buildSearchText } from '../lib/clubSearch'
import SplashScreen from '../components/SplashScreen'

const FEATURED_CLUBS = [
    { name: 'FC Porto', slug: 'fc-porto' },
    { name: 'SL Benfica', slug: 'sl-benfica' },
    { name: 'Sporting CP', slug: 'sporting-cp' },
    { name: 'UD Oliveirense', slug: 'ud-oliveirense' },
]


const TUGABASKET_ASSETS = 'https://resultados.tugabasket.com/assets/images/logos'
const ASSOCIATION_LOGOS: Record<number, string> = {
    50: 'fpb.jpg', 1: 'ablisboa.jpg', 2: 'absetubal.jpg', 3: 'abaveiro.jpg',
    4: 'abporto.jpg', 5: 'abbraga.jpg', 6: 'abmadeira.jpg', 7: 'absantarem_novo.jpg',
    8: 'abcoimbra.jpg', 9: 'abalgarve.jpg', 10: 'abviseu.jpg', 11: 'ableiria.jpg',
    12: 'abalentejo.jpg', 13: 'abit.jpg', 14: 'abcastelobranco.jpg', 15: 'abbraganca.jpg',
    16: 'absaomiguel.jpg', 17: 'abviana.jpg', 18: 'abvilareal.jpg', 19: 'abifp.jpg',
    20: 'abguarda.jpg', 22: 'absantamaria.jpg', 24: 'abacores.jpg',
}
function logoUrl(id: number) { const f = ASSOCIATION_LOGOS[id]; return f ? TUGABASKET_ASSETS + '/' + f : '' }
interface Association { association_id: number; association_name: string }
interface CompetitionResult { competition_id: number; competition_name: string; association_id: number; association_name: string }

function Cell({ val }: { val: string }) {
    if (val === '✓') return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold text-xs">✓</span>
    if (val === '✗') return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-xs">✗</span>
    if (val === 'LIMITADO') return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-xs">—</span>
    return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400"><Clock size={12} /></span>
}

function Landing() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<Club[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [selectedIdx, setSelectedIdx] = useState(-1)
    const [games, setGames] = useState<Match[]>([])
    const [gamesLoading, setGamesLoading] = useState(true)
    const [associations, setAssociations] = useState<Association[]>([])
    const [assoOffset, setAssoOffset] = useState(0)
    const [compResults, setCompResults] = useState<CompetitionResult[]>([])
    const [allComps, setAllComps] = useState<CompetitionResult[]>([])
    const carouselRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()
    const { clubs, loadClubs, favoriteClub } = useClub()
    const { user } = useAuth()
    const [splashDone, setSplashDone] = useState(false)

    const normalizedClubs = useMemo(() => clubs.map(c => ({ ...c, _n: buildSearchText(c) })), [clubs])

    useEffect(() => { loadClubs() }, [loadClubs])

    useEffect(() => { const clubPatterns = ['Porto','Benfica','Sporting','Oliveirense']; const orClauses = clubPatterns.map(n => 'equipa_casa.ilike.%' + n + '%,equipa_fora.ilike.%' + n + '%').join(','); supabase.from('games_2025_2026').select('*').or(orClauses).neq('status','FINALIZADO').not('escalao','ilike','%Sub%').gte('data', new Date().toISOString().split('T')[0]).order('data',{ascending:true}).then(({data}:{data:any})=>{if(data){let arr=data as Match[];const counts:Record<string,number>={};arr=arr.filter(m=>{const full=(m.equipa_casa+' '+m.equipa_fora).toUpperCase();const knownTeams=['PORTO','BENFICA','SPORTING','OLIVEIRENSE'];const matchName=['Futebol Clube do Porto','SL Benfica','Sporting Clube Portugal','UD Oliveirense'].find(t=>full.includes(t.toUpperCase()));if(!matchName)return false;const key=knownTeams.find(t=>matchName.toUpperCase().includes(t));if(!key)return false;counts[key]=(counts[key]||0)+1;return counts[key]<=2}).sort(()=>Math.random()-0.5).slice(0,8);setGames(arr)}setGamesLoading(false)}) },[])

    useEffect(() => { if (games.length > 0 && carouselRef.current) { const idx = Math.floor(Math.random() * games.length); carouselRef.current.scrollLeft = idx * 312 } }, [games])

    useEffect(() => {
        supabase.from('competitions').select('association_id,association_name').eq('season','2025/2026').order('association_name').then(({data}) => {
            if (data) {
                const seen = new Map() as Map<number, Association>
                (data as Association[]).forEach((a: Association) => { if (!seen.has(a.association_id)) seen.set(a.association_id, a) })
                const uniq = Array.from(seen.values())
                const shuffled = uniq.sort(() => Math.random() - 0.5)
                setAssociations(shuffled as Association[])
            }
        })
    }, [])

        // Fetch all competitions for search
    useEffect(() => { supabase.from('competitions').select('competition_id, competition_name, association_id, association_name').eq('season','2025/2026').then(({data}) => { if (data) { const seen: Record<number, CompetitionResult> = {}; (data as CompetitionResult[]).forEach(r => { if (!seen[r.competition_id]) seen[r.competition_id] = r }); setAllComps(Object.values(seen)) } }) }, [])

    // Auto-scroll associations carousel every 2s
    useEffect(() => {
        if (associations.length === 0) return
        const id = setInterval(() => {
            setAssoOffset(prev => {
                const next = prev - 1
                const totalWidth = associations.length * 200
                return next < -totalWidth ? 0 : next
            })
        }, 40)
        return () => clearInterval(id)
    }, [associations.length])

        // Search effects (clubs + competitions, max 3 each)
    useEffect(() => { if (!query.trim()) { setResults([]); setCompResults([]); setShowDropdown(false); setSelectedIdx(-1); return }; const q = normalize(query); setResults(normalizedClubs.filter(c => c._n.includes(q)).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999)).slice(0, 3)); if (allComps.length > 0) { const filtered = allComps.filter(r => normalize(r.competition_name).includes(q)).slice(0, 3); setCompResults(filtered) }; setShowDropdown(true); setSelectedIdx(-1) }, [query, normalizedClubs, allComps])
    useEffect(() => { const f = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) setShowDropdown(false) }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f) }, [])

        const totalResults = results.length + compResults.length
    const handleKeyDown = (e: React.KeyboardEvent) => { if (!showDropdown || totalResults === 0) return; if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, totalResults - 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, -1)) } else if (e.key === 'Enter' && selectedIdx >= 0) { e.preventDefault(); if (selectedIdx < results.length) selectClub(results[selectedIdx]); else { const comp = compResults[selectedIdx - results.length]; navigate('/standings/' + comp.association_id + '/' + comp.competition_id); setQuery(''); setShowDropdown(false) } } else if (e.key === 'Escape') { setShowDropdown(false) } }

    const selectClub = (club: Club) => { navigate('/clube/' + club.slug + '/home'); setQuery(''); setShowDropdown(false) }
    const scrollCarousel = (dir: number) => { if (!carouselRef.current) return; const el = carouselRef.current; const max = el.scrollWidth - el.clientWidth; if (dir > 0 && el.scrollLeft >= max - 10) { el.scrollTo({ left: 0, behavior: 'smooth' }) } else if (dir < 0 && el.scrollLeft <= 10) { el.scrollTo({ left: max, behavior: 'smooth' }) } else { el.scrollBy({ left: dir * 312, behavior: 'smooth' }) } }
    return (
        <>
            {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
            <div className="pb-24">
            {/* Hero */}
            <div className="relative z-30 bg-gradient-to-b from-dribly-purple/5 via-transparent to-transparent dark:from-dribly-purple/10 dark:via-transparent dark:to-transparent -mt-4 md:-mt-6">
                <div className="max-w-2xl mx-auto px-4 pt-20 md:pt-36 pb-14 md:pb-20 text-center relative">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dribly-purple/10 dark:bg-dribly-purple/20 text-dribly-purple text-[11px] font-bold uppercase tracking-wider mb-6 animate-fade-in"><span className="w-1.5 h-1.5 rounded-full bg-dribly-purple animate-pulse" />Época 2025/2026</div>
                    <h1 className="text-4xl md:text-7xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-2 animate-slide-up">Dribly<span className="text-dribly-purple">.</span></h1>
                    <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed mb-6 animate-slide-up">Resultados de todos os clubes de basquetebol em Portugal</p>
                    <div className="flex flex-wrap justify-center gap-2 mb-6 animate-slide-up">{FEATURED_CLUBS.map(({ name, slug }) => { const c = clubs.find(x => x.slug === slug); if (!c) return null; return (<button key={c.slug} onClick={() => selectClub(c)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-dribly-purple/30 hover:text-dribly-purple hover:shadow-sm transition-all ${slug === 'ud-oliveirense' ? 'hidden sm:flex' : ''}`}><span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">{c.logo_url ? <img src={c.logo_url} alt="" className="w-3.5 h-3.5 object-contain" /> : <span className="text-[9px] font-bold text-zinc-500">{name.charAt(0).toUpperCase()}</span>}</span>{displayName(c)}</button>) })}</div>
                    <div className="max-w-lg mx-auto relative animate-slide-up" ref={dropdownRef}><div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><Search size={20} className="text-zinc-400" /></div><input ref={inputRef} type="text" value={query} onChange={e => { setQuery(e.target.value); setSelectedIdx(-1) }} onKeyDown={handleKeyDown} onFocus={() => query.trim() && setShowDropdown(true)} placeholder="Pesquisar clubes e competições..." className="w-full pl-12 pr-4 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none shadow-lg shadow-zinc-200/50 dark:shadow-black/20 transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple" />{showDropdown && totalResults > 0 && (<div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 text-left">{results.length > 0 && (<div><div className="px-4 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Clubes</div>{results.map((club,i) => (<button key={club.slug} onClick={() => selectClub(club)} className={'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ' + (selectedIdx === i ? 'bg-dribly-purple/10 dark:bg-dribly-purple/20' : 'hover:bg-zinc-50 dark:hover:bg-white/5')}><div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">{club.logo_url ? <img src={club.logo_url} alt="" className="w-6 h-6 object-contain" /> : <span className="text-xs font-bold text-zinc-500">{displayName(club).charAt(0).toUpperCase()}</span>}</div><span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{displayName(club)}</span></button>))}</div>)}{compResults.length > 0 && (<div className={results.length > 0 ? 'border-t border-zinc-100 dark:border-white/5' : ''}><div className="px-4 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Competições</div>{compResults.map((comp,i) => { const idx = results.length + i; return (<button key={'comp-'+comp.competition_id} onClick={() => { navigate('/standings/' + comp.association_id + '/' + comp.competition_id); setQuery(''); setShowDropdown(false) }} className={'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ' + (selectedIdx === idx ? 'bg-dribly-purple/10 dark:bg-dribly-purple/20' : 'hover:bg-zinc-50 dark:hover:bg-white/5')}><div className="w-9 h-9 rounded-full bg-dribly-purple/10 dark:bg-dribly-purple/20 flex items-center justify-center shrink-0"><Trophy size={16} className="text-dribly-purple" /></div><div className="min-w-0"><span className="text-sm font-medium text-zinc-900 dark:text-white truncate block">{comp.competition_name}</span><span className="text-[10px] text-zinc-400">{comp.association_name}</span></div></button>) })}</div>)}{(results.length === 3 || compResults.length === 3) && (<Link to={'/search?q=' + encodeURIComponent(query)} onClick={() => setShowDropdown(false)} className="block w-full text-center py-3 text-xs font-bold text-dribly-purple hover:bg-dribly-purple/5 border-t border-zinc-100 dark:border-white/5 transition-colors">Ver todos os resultados</Link>)}</div>)}</div>
                    {!user && favoriteClub && (<Link to={'/clube/' + favoriteClub.slug + '/home'} className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full bg-dribly-purple/5 dark:bg-dribly-purple/10 text-dribly-purple text-xs font-bold border border-dribly-purple/20 hover:bg-dribly-purple/10 dark:hover:bg-dribly-purple/20 transition-all group animate-slide-up"><HomeIcon size={14} /><span>Continuar com {displayName(favoriteClub)}</span><ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" /></Link>)}
                </div>
            </div>

            {/* Stats */}
            <div className="bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-white/5"><div className="px-4 py-4 flex items-center justify-center gap-6 md:gap-16"><div className="text-center"><span className="text-lg font-black text-zinc-900 dark:text-white">{clubs.length}</span><p className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">Clubes</p></div><div className="w-px h-8 bg-zinc-200 dark:bg-white/10" /><div className="text-center"><span className="text-lg font-black text-zinc-900 dark:text-white">{allComps.length || '-'}</span><p className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">Competições</p></div><div className="w-px h-8 bg-zinc-200 dark:bg-white/10" /><div className="text-center"><span className="text-lg font-black text-zinc-900 dark:text-white">{new Set(allComps.map(c => c.association_id)).size || '-'}</span><p className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">Associações</p></div></div></div>

            {/* Jogos em Destaque — gradient fades both sides, wider cards */}
            <div className="py-8">
                <div className="max-w-5xl mx-auto px-4 mb-4"><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-dribly-purple animate-pulse" />Jogos em Destaque</h2><div className="flex gap-1"><button onClick={() => scrollCarousel(-1)} className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"><ChevronLeft size={16} /></button><button onClick={() => scrollCarousel(1)} className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button></div></div></div>
                <div className="max-w-5xl mx-auto px-4 relative">
                    {gamesLoading ? (<div className="flex gap-3 overflow-hidden">{[1,2,3].map(i => <div key={i} className="min-w-[320px] h-48 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse shrink-0" />)}</div>) : games.length === 0 ? (<p className="text-xs text-zinc-400 text-center py-8">Nenhum jogo em destaque de momento.</p>) : (<div className="relative"><div ref={carouselRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory scroll-smooth items-stretch"><div className="shrink-0 w-[calc(50vw-24px)] md:hidden" />{[...games, ...games].map((match, idx) => (<div key={match.slug || match.id + '-' + idx} className="min-w-[80vw] md:min-w-[320px] shrink-0 snap-center h-full"><GameCard match={match} mode="agenda" /></div>))}<div className="shrink-0 w-[calc(50vw-24px)] md:hidden" /></div><div className="absolute left-0 top-0 bottom-2 w-24 sm:w-32 bg-gradient-to-r from-zinc-50 dark:from-zinc-950 to-transparent pointer-events-none z-10 hidden md:block" /><div className="absolute right-0 top-0 bottom-2 w-24 sm:w-32 bg-gradient-to-l from-zinc-50 dark:from-zinc-950 to-transparent pointer-events-none z-10 hidden md:block" /></div>)}
                </div>
            </div>

            {/* Associations carousel — infinite auto-scroll */}
            <div className="py-8 bg-white dark:bg-zinc-950 border-t border-b border-zinc-100 dark:border-white/5">
                <div className="mb-5 px-4 text-center">
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-white inline-flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-dribly-purple animate-pulse" />Associações de Basquetebol</h2>
                </div>
                {associations.length > 0 ? (
                    <div className="relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white dark:from-zinc-950 to-transparent pointer-events-none z-10" />
                        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white dark:from-zinc-950 to-transparent pointer-events-none z-10" />
                        <div className="flex gap-4 py-2" style={{ transform: 'translateX(' + assoOffset + 'px)', transition: 'none', width: (associations.length * 2 * 132) + 'px' }}>
                            {[...associations, ...associations].map((a, i) => (
                                <Link key={a.association_id + '-' + i} to={'/standings/' + a.association_id} className="w-[110px] h-[110px] shrink-0 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-center hover:scale-105 transition-transform duration-300 shadow-sm group overflow-hidden">
                                    {(() => { const url = logoUrl(a.association_id); return url ? <img src={url} alt={a.association_name} className="w-full h-full object-contain" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} /> : <span className="text-dribly-purple font-black text-xl">{a.association_name.replace("AB ","").substring(0,3).toUpperCase()}</span> })()}
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : null}
                <div className="text-center mt-6">
                    <Link to="/standings" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-dribly-purple text-white text-sm font-bold hover:bg-dribly-purple-dim transition-colors shadow-sm group">Ver todas as classificações<ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" /></Link>
                </div>
            </div>

            {/* O que encontras — unique card design */}
            <div className="px-4 py-10 max-w-4xl mx-auto">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-2 text-center">Tudo o que precisas</h2>
                <p className="text-xs text-zinc-500 text-center mb-6">A melhor forma de seguir o basquetebol português</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-dribly-purple to-dribly-purple-dark p-5 text-white shadow-md hover:shadow-lg transition-all">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-bl-3xl -mr-4 -mt-4" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            </div>
                            <h3 className="text-sm font-bold mb-1">Jogos e Agenda</h3>
                            <p className="text-[11px] text-white/70 leading-relaxed">Próximos jogos de cada clube com datas, horas e locais</p>
                        </div>
                    </div>
                    <div className="group relative overflow-hidden rounded-2xl bg-zinc-900 dark:bg-zinc-800 p-5 text-white shadow-md hover:shadow-lg transition-all">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-bl-3xl -mr-4 -mt-4" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-dribly-purple/30 flex items-center justify-center mb-4">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                            </div>
                            <h3 className="text-sm font-bold mb-1 text-white">Resultados</h3>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">Fichas de jogo com placares, confrontos e mapas</p>
                        </div>
                    </div>
                    <div className="group relative overflow-hidden rounded-2xl bg-zinc-900 dark:bg-zinc-800 p-5 text-white shadow-md hover:shadow-lg transition-all">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-bl-3xl -mr-4 -mt-4" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-dribly-purple/30 flex items-center justify-center mb-4">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                            </div>
                            <h3 className="text-sm font-bold mb-1 text-white">Classificações</h3>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">Tabelas de todas as competições da FPB</p>
                        </div>
                    </div>
                    <div className="group relative overflow-hidden rounded-2xl bg-zinc-900 dark:bg-zinc-800 p-5 text-white shadow-md hover:shadow-lg transition-all">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-bl-3xl -mr-4 -mt-4" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-dribly-purple/30 flex items-center justify-center mb-4">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            </div>
                            <h3 className="text-sm font-bold mb-1 text-white">79 Clubes</h3>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">De todas as divisões e associações</p>
                        </div>
                    </div>
                </div>
            </div>



            {/* Comparison: BIG table-like comparison */}
            <div className="px-4 py-12 max-w-4xl mx-auto">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-2 text-center">Porquê o Dribly?</h2>
                <p className="text-xs text-zinc-500 text-center mb-8">Comparação completa com outras plataformas de basquetebol português</p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm table-fixed">
                        <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-700">
                                <th className="text-left py-3 pr-3 font-bold text-zinc-600 dark:text-zinc-400 w-[28%]">Função</th>
                                <th className="text-center py-3 px-1 font-bold text-dribly-purple w-[14.4%]"><div className="inline-flex items-center justify-center gap-1"><span className="w-2 h-2 rounded-full bg-dribly-purple shrink-0" /><span>Dribly</span></div></th>
                                <th className="text-center py-3 px-1 font-bold text-zinc-500 dark:text-zinc-400 w-[14.4%]">FPB</th>
                                <th className="text-center py-3 px-1 font-bold text-zinc-500 dark:text-zinc-400 w-[14.4%]">Swish</th>
                                <th className="hidden md:table-cell text-center py-3 px-1 font-bold text-zinc-500 dark:text-zinc-400 w-[14.4%]">TugaBasket</th>
                                <th className="hidden md:table-cell text-center py-3 px-1 font-bold text-zinc-500 dark:text-zinc-400 w-[14.4%]">FPB TV</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['Mobile-first',                    '✓', '✓', '✓', '✗', '✓'],
                                ['PWA / App instalável',            '✓', '✗', '✓', '✗', '✗'],
                                ['Plataforma web',                  '✓', '✓', '✗', '✓', '✓'],
                                ['Open Source',                     '✓', '✗', '✗', '✗', '✗'],
                                ['Contas / Login',                  '✓', '✗', '✓', '✗', '✓'],
                                ['Offline parcial',                 '✓', '✗', '✗', '✗', '✗'],
                                ['Pesquisa de clubes',              '✓', '✓', 'LIMITADO', '✗', '✗'],
                                ['Pesquisa de competições',         '✓', '✓', 'LIMITADO', '✗', '✗'],
                                ['Fichas de jogo',                  '✓', '✓', '✓', '✗', '✗'],
                                ['Mapas / localização',             '✓', '✗', '✗', '✗', '✗'],
                                ['Classificações',                  '✓', '✗', '✓', '✓', '✗'],
                                ['Favoritos / seguir clubes',       '✓', '✗', '✓', '✗', '✗'],
                                ['Atualização automática',          '✓', '✓', '✓', '✗', '✗'],
                                ['Gratuito',                        '✓', '✓', '✗', '✓', '✓'],
                                ['Modo claro / escuro',             '✓', '✗', '✓', '✗', '✗'],
                                ['Multi-clube',                     '✓', '✓', 'LIMITADO', '✗', '✗'],
                                ['Multi-escalão',                   '✓', '✓', 'LIMITADO', '✗', '✗'],
                                ['Equipas por clube',               '✓', '✓', 'LIMITADO', '✗', '✗'],
                                ['Dados oficiais FPB',              '✓', '✓', '✓', '✗', '✗'],
                            ].map(([feat, d, fpb, swish, tuga, fpbtv]) => (
                                <tr key={feat} className="border-b border-zinc-100 dark:border-zinc-800">
                                    <td className="py-3 pr-3 font-medium text-zinc-800 dark:text-zinc-200 text-xs">{feat}</td>
                                    <td className="text-center py-3 px-1"><Cell val={d} /></td>
                                    <td className="text-center py-3 px-1"><Cell val={fpb} /></td>
                                    <td className="text-center py-3 px-1"><Cell val={swish} /></td>
                                <td className="hidden md:table-cell text-center py-3 px-1"><Cell val={tuga} /></td>
                                <td className="hidden md:table-cell text-center py-3 px-1"><Cell val={fpbtv} /></td>
                                </tr>
                            ))}
                            {/* Streaming de jogos — hidden on mobile */}
                            <tr className="hidden md:table-row border-b border-zinc-100 dark:border-zinc-800">
                                <td className="py-3 pr-3 font-medium text-zinc-800 dark:text-zinc-200 text-xs">Streaming de jogos</td>
                                <td className="text-center py-3 px-1"><Cell val="Futuro" /></td>
                                <td className="text-center py-3 px-1"><Cell val="✗" /></td>
                                <td className="text-center py-3 px-1"><Cell val="✗" /></td>
                                <td className="hidden md:table-cell text-center py-3 px-1"><Cell val="✗" /></td>
                                <td className="hidden md:table-cell text-center py-3 px-1"><Cell val="✓" /></td>
                                </tr>
                        </tbody>
                    </table>
                </div>

                <p className="text-[10px] text-zinc-400 text-center mt-6 leading-relaxed max-w-md mx-auto">
                    O Dribly é a única plataforma gratuita, mobile-first e com suporte offline para acompanhares todo o basquetebol português com dados sempre atualizados.
                </p>
            </div>
            {/* Como obtemos os dados — visual improved */}
            <div className="bg-white dark:bg-zinc-950 border-t border-b border-zinc-100 dark:border-white/5 py-10">
                <div className="px-4">
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-6 text-center">Fontes dos dados</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-6">
                        <div className="glass-card p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-dribly-purple/10 dark:bg-dribly-purple/20 flex items-center justify-center shrink-0">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-zinc-900 dark:text-white">FPB</h3>
                                <p className="text-[10px] text-zinc-500">Jogos, resultados e calendários</p>
                            </div>
                        </div>
                        <div className="glass-card p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-dribly-purple/10 dark:bg-dribly-purple/20 flex items-center justify-center shrink-0">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-zinc-900 dark:text-white">TugaBasket</h3>
                                <p className="text-[10px] text-zinc-500">Classificações e competições</p>
                            </div>
                        </div>
                        <div className="glass-card p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-dribly-purple/10 dark:bg-dribly-purple/20 flex items-center justify-center shrink-0">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Base de dados própria</h3>
                                <p className="text-[10px] text-zinc-500">Dados sincronizados e sempre disponíveis</p>
                            </div>
                        </div>
                    </div>
                    <p className="text-[10px] text-zinc-400 text-center max-w-md mx-auto leading-relaxed">
                        Os dados são sincronizados sempre que abres o Dribly e ficam disponíveis offline.
                    </p>
                </div>
            </div>
        </div>
        </>
    )
}

function HomeIcon({ size, className }: { size: number; className?: string }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>) }

export default Landing