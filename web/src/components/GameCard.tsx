import { useState, memo } from 'react'
import { Link } from 'react-router-dom'
import { Clock, MapPin, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Match } from './types'
import { isClubWin } from '../lib/matchUtils'

interface GameCardProps {
  match: Match
  mode: 'agenda' | 'results'
  clubName?: string
  clubSlug?: string
}

function hasHora(hora: string | null | undefined): boolean {
  return !!hora && hora.replace(/[^0-9]/g, '').length > 0
}

const GameCardInner = ({ match, mode, clubName, clubSlug }: GameCardProps) => {
  const slug = match.slug || `${match.data}-${match.equipa_casa.toLowerCase().replace(/\s+/g, '-')}-${match.equipa_fora.toLowerCase().replace(/\s+/g, '-')}`
  const won = clubName ? isClubWin(match, clubName) : null
  const isLive = match.status === 'A DECORRER'
  const linkSlug = clubSlug ? `/jogo/${slug}?clube=${clubSlug}` : `/jogo/${slug}`

  const badge = mode === 'agenda'
    ? null
    : won === true
      ? { icon: TrendingUp, label: 'VITÓRIA', className: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' }
      : won === false
        ? { icon: TrendingDown, label: 'DERROTA', className: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' }
        : won === 'draw'
          ? { icon: Minus, label: 'EMPATE', className: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' }
          : { icon: Minus, label: 'FIN', className: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500' }

  return (
    <Link to={linkSlug} className="glass-card flex flex-col group active:scale-[0.98]">
      {/* Top bar */}
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-zinc-100 dark:border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          {mode === 'agenda' ? (
            <>
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 tracking-wider">
                {new Date(match.data).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
              </span>
              {hasHora(match.hora) && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600">·</span>
                  <Clock size={10} className="text-dribly-purple shrink-0" strokeWidth={3} />
                  <span className="text-[10px] font-bold text-dribly-purple tracking-wider">
                    {match.hora!.slice(0, 5)}
                  </span>
                </>
              )}
            </>
          ) : badge && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.className}`}>
              <badge.icon size={10} />
              {badge.label}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {isLive && (
            <span className="text-red-500 text-[10px] font-bold flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              LIVE
            </span>
          )}
          <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate">
            {match.escalao}
          </span>
        </div>
      </div>

      {/* Teams */}
      <div className="p-4 flex flex-col gap-3">
        <TeamRow name={match.equipa_casa} logo={match.logotipo_casa} score={mode === 'results' ? match.resultado_casa : null} dimmed={match.resultado_casa !== null && match.resultado_fora !== null && match.resultado_casa < match.resultado_fora} />
        <TeamRow name={match.equipa_fora} logo={match.logotipo_fora} score={mode === 'results' ? match.resultado_fora : null} dimmed={match.resultado_casa !== null && match.resultado_fora !== null && match.resultado_fora < match.resultado_casa} />
      </div>

      {/* Bottom bar */}
      <div className="px-4 pb-4 pt-0 flex justify-between items-center text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
        <div className="flex items-center gap-1.5 truncate max-w-[70%]">
          {match.local ? (
            <>
              <MapPin size={10} className="shrink-0 text-dribly-purple" />
              <span className="truncate text-zinc-500">{match.local}</span>
            </>
          ) : (
            <span className="truncate text-zinc-500">{match.competicao}</span>
          )}
        </div>
        <ChevronRight size={14} className="text-zinc-400 group-hover:text-dribly-blue transition-colors" />
      </div>
    </Link>
  )
}

function TeamRow({ name, logo, score, dimmed }: { name: string; logo: string | null; score: number | null; dimmed: boolean }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className={`flex items-center justify-between ${dimmed ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        {logo && !imgError ? (
          <img 
            src={logo} 
            alt="" 
            className="w-8 h-8 object-contain rounded-full bg-zinc-50 dark:bg-zinc-800" 
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-8 h-8 bg-zinc-100 dark:bg-white/10 rounded-full flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <span className="text-sm font-bold text-zinc-900 dark:text-white leading-tight truncate">
          {name.toUpperCase()}
        </span>
      </div>
      {score !== null && (
        <span className="text-xl font-mono font-bold text-zinc-900 dark:text-white tabular-nums shrink-0 ml-2">
          {score}
        </span>
      )}
    </div>
  )
}

export const GameCard = memo(GameCardInner)
