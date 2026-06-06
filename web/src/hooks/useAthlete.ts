import { useState, useEffect } from 'react'

const FPB_PROXY = '/api/fpb'

export interface AthleteData {
    nome: string | null
    foto: string | null
    numero: string | null
    posicao: string | null
    clube: string | null
    nacionalidade: string | null
    bandeiraUrl: string | null
    pontos: number | null
    ressaltos: number | null
    assistencias: number | null
    desarmes: number | null
    epoca: AthleteSeasonStats | null
    carreira: AthleteCareerStats | null
    inscricoes: AthleteInscricao[]
    biografia: AthleteBiografia | null
}

export interface ShootingStats {
    feitos: number
    tentados: number
    percentagem: number
}

export interface AthleteSeasonStats {
    epoca: string
    jogos: number | null
    mediaMinutos: number | null
    pontos: number | null
    lancamentosCampo: ShootingStats | null
    lancamentos2: ShootingStats | null
    lancamentos3: ShootingStats | null
    lancesLivres: ShootingStats | null
    ressaltosTotal: number | null
    ressaltosOfensivos: number | null
    ressaltosDefensivos: number | null
    assistencias: number | null
    perdasBola: number | null
    roubosBola: number | null
    desarmes: number | null
}

export interface AthleteCareerStats {
    jogos: number | null
    tacasPortugal: number | null
    lancamentosCampo: ShootingStats | null
    lancamentos2: ShootingStats | null
    lancamentos3: ShootingStats | null
    lancesLivres: ShootingStats | null
}

export interface AthleteInscricao {
    epoca: string
    associacao: string
    clube: string
    escalao: string
}

export interface AthleteBiografia {
    nrLicenca: string | null
    dataNascimento: string | null
    nacionalidade: string | null
    posicao: string | null
}

function parseAthleteHTML(html: string): AthleteData {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // --- Header section ---
    const highlight = doc.querySelector('.athleteDetailHighlight')
    const imageEl = highlight?.querySelector('.image img') as HTMLImageElement | null
    const foto = imageEl?.getAttribute('src') || null
    const numero = highlight?.querySelector('.number')?.textContent?.trim() || null
    const nameEl = highlight?.querySelector('.name')
    const nome = nameEl?.textContent?.trim() || null
    const baseEl = highlight?.querySelector('.base p')
    const baseText = baseEl?.textContent?.trim() || '' // e.g. "BASE, FC Gaia"
    const [posicao, clube] = baseText.split(',').map(s => s.trim())
    const flagImg = highlight?.querySelector('.nationality') as HTMLImageElement | null
    const bandeiraUrl = flagImg?.getAttribute('src') || null
    const nacionalidade = flagImg?.getAttribute('alt') || null

    // Quick stats
    const statBlocks = highlight?.querySelectorAll('.stats-detail > div')
    let pontos: number | null = null
    let ressaltos: number | null = null
    let assistencias: number | null = null
    let desarmes: number | null = null
    statBlocks?.forEach(block => {
        const val = parseInt(block.querySelector('h2')?.textContent || '', 10)
        const label = block.querySelector('p')?.textContent?.trim() || ''
        if (isNaN(val)) return
        if (label === 'PONTOS') pontos = val
        else if (label === 'RESSALTOS') ressaltos = val
        else if (label === 'ASSISTÊNCIAS') assistencias = val
        else if (label === 'DESARMES') desarmes = val
    })

    // --- Época tab (data-tab=1) ---
    const epocaWrapper = doc.querySelector('.epoca-wrapper[data-tab="1"]')
    let epoca: AthleteSeasonStats | null = null
    if (epocaWrapper) {
        const epocaTitle = epocaWrapper.querySelector('.bigger-title')?.textContent?.trim() || ''
        const jogosEl = epocaWrapper.querySelector('.type-rebound .counter')
        const jogos = jogosEl ? parseInt(jogosEl.textContent || '0', 10) : null
        const mediaMinEl = epocaWrapper.querySelector('.half-body .counter')
        const mediaMinutos = mediaMinEl ? parseInt(mediaMinEl.textContent || '0', 10) : null
        const pontosEl = epocaWrapper.querySelectorAll('.type-rebound .counter')
        const pontosEpoca = pontosEl.length > 2 ? parseInt(pontosEl[2]?.textContent || '0', 10) : null

        // Shooting percentages
        const shootingBlocks = epocaWrapper.querySelectorAll('.type-shooting')
        let lancamentosCampo: ShootingStats | null = null
        let lancamentos2: ShootingStats | null = null
        let lancamentos3: ShootingStats | null = null
        let lancesLivres: ShootingStats | null = null
        shootingBlocks.forEach(block => {
            const label = block.querySelector('p')?.textContent?.trim() || ''
            const barEl = block.querySelector('.visible')
            const pctEl = block.querySelector('.bar > p')
            const pct = pctEl ? parseFloat(pctEl.textContent?.replace('%', '') || '0') : 0
            const width = barEl?.getAttribute('widthTemp')
            const feitos = width ? Math.round((parseInt(width, 10) * 1)) : 0 // Approximate
            const stats: ShootingStats = { feitos, tentados: 100, percentagem: pct }
            if (label === 'Lançamentos de campo') lancamentosCampo = stats
            else if (label === '2 Pontos') lancamentos2 = stats
            else if (label === '3 pontos') lancamentos3 = stats
            else if (label === 'Lances Livres') lancesLivres = stats
        })

        // Rebounds
        const reboundBlocks = epocaWrapper.querySelectorAll('.type-rebound.forecebgheight')
        let ressaltosTotal: number | null = null
        let ressaltosOfensivos: number | null = null
        let ressaltosDefensivos: number | null = null
        reboundBlocks.forEach(block => {
            const label = block.querySelector('p')?.textContent?.trim() || ''
            const val = parseInt(block.querySelector('.counter')?.textContent || block.querySelector('.number')?.textContent || '0', 10)
            if (label === 'Total') ressaltosTotal = val
            else if (label === 'Ofensivos') ressaltosOfensivos = val
            else if (label === 'Defensivos') ressaltosDefensivos = val
        })
        // Also check the big rebound block
        const bigRebound = epocaWrapper.querySelector('.type-rebound.big .label p')
        if (bigRebound && ressaltosTotal === null) {
            ressaltosTotal = parseInt(bigRebound.textContent || '0', 10)
        }

        // Outros
        const outrosWrapper = epocaWrapper.querySelector('.other-wrapper.outros')
        let assistenciasEpoca: number | null = null
        let perdasBola: number | null = null
        let roubosBola: number | null = null
        let desarmesEpoca: number | null = null
        outrosWrapper?.querySelectorAll('.half-body, div[style]').forEach(block => {
            const label = block.querySelector('.type')?.textContent?.trim() || ''
            const val = parseInt(block.querySelector('.number')?.textContent || '0', 10)
            if (isNaN(val)) return
            if (label === 'Assistências') assistenciasEpoca = val
            else if (label === 'Perdas de bola') perdasBola = val
            else if (label === 'Roubos de bola') roubosBola = val
            else if (label === 'Desarmes') desarmesEpoca = val
        })

        epoca = {
            epoca: epocaTitle,
            jogos,
            mediaMinutos,
            pontos: pontosEpoca,
            lancamentosCampo,
            lancamentos2,
            lancamentos3,
            lancesLivres,
            ressaltosTotal,
            ressaltosOfensivos,
            ressaltosDefensivos,
            assistencias: assistenciasEpoca,
            perdasBola,
            roubosBola,
            desarmes: desarmesEpoca,
        }
    }

    // --- Carreira tab (data-tab=2) ---
    const carreiraWrapper = doc.querySelector('.carreira-wrapper[data-tab="2"]')
    let carreira: AthleteCareerStats | null = null
    if (carreiraWrapper) {
        const jogosCarreira = parseInt(carreiraWrapper.querySelector('.type-rebound .counter')?.textContent || '0', 10)
        const tacasBlocks = carreiraWrapper.querySelectorAll('.type-rebound')
        let tacasPortugal: number | null = null
        tacasBlocks.forEach(block => {
            const label = block.querySelector('p')?.textContent?.trim() || ''
            if (label.includes('TAÇA DE PORTUGAL') || label.includes('Taça de Portugal')) {
                tacasPortugal = parseInt(block.querySelector('.counter')?.textContent || '0', 10)
            }
        })

        const shootingBlocks = carreiraWrapper.querySelectorAll('.type-shooting')
        let lancamentosCampo: ShootingStats | null = null
        let lancamentos2: ShootingStats | null = null
        let lancamentos3: ShootingStats | null = null
        let lancesLivres: ShootingStats | null = null
        shootingBlocks.forEach(block => {
            const label = block.querySelector('p')?.textContent?.trim() || ''
            const pctEl = block.querySelector('.bar > p')
            const pct = pctEl ? parseFloat(pctEl.textContent?.replace('%', '') || '0') : 0
            const width = block.querySelector('.visible')?.getAttribute('widthTemp')
            const feitos = width ? Math.round(parseInt(width, 10) * 1) : 0
            const stats: ShootingStats = { feitos, tentados: 100, percentagem: pct }
            if (label === 'Lançamentos de campo') lancamentosCampo = stats
            else if (label === '2 Pontos') lancamentos2 = stats
            else if (label === '3 pontos') lancamentos3 = stats
            else if (label === 'Lances Livres') lancesLivres = stats
        })

        carreira = {
            jogos: isNaN(jogosCarreira) ? null : jogosCarreira,
            tacasPortugal,
            lancamentosCampo,
            lancamentos2,
            lancamentos3,
            lancesLivres,
        }
    }

    // --- Inscrições tab (data-tab=5) ---
    const inscricoesWrapper = doc.querySelector('.tab-wrapper[data-tab="5"]')
    const inscricoes: AthleteInscricao[] = []
    if (inscricoesWrapper) {
        const rows = inscricoesWrapper.querySelectorAll('table.fpb-table tr')
        rows.forEach(row => {
            const cells = row.querySelectorAll('td')
            if (cells.length >= 4) {
                inscricoes.push({
                    epoca: cells[0].textContent?.trim() || '',
                    associacao: cells[1].textContent?.trim() || '',
                    clube: cells[2].textContent?.trim() || '',
                    escalao: cells[3].textContent?.trim() || '',
                })
            }
        })
    }

    // --- Biografia tab (data-tab=3) ---
    const biografiaWrapper = doc.querySelector('.biografia-wrapper[data-tab="3"]')
    let biografia: AthleteBiografia | null = null
    if (biografiaWrapper) {
        const resumeDivs = biografiaWrapper.querySelectorAll('.biografia-resume > div')
        let nrLicenca: string | null = null
        let dataNascimento: string | null = null
        let nacionalidadeBio: string | null = null
        let posicaoBio: string | null = null
        resumeDivs.forEach(div => {
            const label = div.querySelector('p')?.textContent?.trim() || ''
            const val = div.querySelector('span')?.textContent?.trim() || ''
            if (label === 'Nr. Licença') nrLicenca = val
            else if (label === 'Data de Nascimento') dataNascimento = val
            else if (label === 'Nacionalidade') nacionalidadeBio = val
            else if (label === 'Posição') posicaoBio = val
        })
        if (nrLicenca || dataNascimento || nacionalidadeBio || posicaoBio) {
            biografia = { nrLicenca, dataNascimento, nacionalidade: nacionalidadeBio, posicao: posicaoBio }
        }
    }

    return {
        nome,
        foto,
        numero,
        posicao: posicao || null,
        clube: clube || null,
        nacionalidade,
        bandeiraUrl,
        pontos: pontos !== null && !isNaN(pontos) ? pontos : null,
        ressaltos: ressaltos !== null && !isNaN(ressaltos) ? ressaltos : null,
        assistencias: assistencias !== null && !isNaN(assistencias) ? assistencias : null,
        desarmes: desarmes !== null && !isNaN(desarmes) ? desarmes : null,
        epoca,
        carreira,
        inscricoes,
        biografia,
    }
}

const ATHLETE_CACHE_TTL = 30 * 60_000 // 30 min
const ATHLETE_LS_KEY = (id: string) => `athlete_cache_${id}`
const ATHLETE_LS_TS = (id: string) => `athlete_cache_ts_${id}`

function loadAthleteCache(id: string): AthleteData | null {
    try {
        const raw = localStorage.getItem(ATHLETE_LS_KEY(id))
        const ts = localStorage.getItem(ATHLETE_LS_TS(id))
        if (raw && ts && Date.now() - parseInt(ts) < ATHLETE_CACHE_TTL) {
            return JSON.parse(raw) as AthleteData
        }
    } catch { /* ignore */ }
    return null
}

function saveAthleteCache(id: string, data: AthleteData) {
    try {
        localStorage.setItem(ATHLETE_LS_KEY(id), JSON.stringify(data))
        localStorage.setItem(ATHLETE_LS_TS(id), Date.now().toString())
    } catch { /* ignore */ }
}

export function useAthlete(athleteId: string) {
    const [data, setData] = useState<AthleteData | null>(() => athleteId ? loadAthleteCache(athleteId) : null)
    const [loading, setLoading] = useState(() => !athleteId ? false : !loadAthleteCache(athleteId))
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!athleteId) {
            setLoading(false)
            return
        }

        // If we already have cached data, skip fetch
        const cached = loadAthleteCache(athleteId)
        if (cached) {
            setData(cached)
            setLoading(false)
            return
        }

        let cancelled = false
        setLoading(true)
        setError(null)

        fetch(`${FPB_PROXY}?page=atleta&id=${athleteId}`)
            .then(r => {
                if (!r.ok) throw new Error(`FPB returned ${r.status}`)
                return r.text()
            })
            .then(html => {
                if (cancelled) return
                const parsed = parseAthleteHTML(html)
                saveAthleteCache(athleteId, parsed)
                setData(parsed)
                setLoading(false)
            })
            .catch(err => {
                if (cancelled) return
                setError(err.message || 'Erro ao carregar dados do atleta')
                setLoading(false)
            })

        return () => { cancelled = true }
    }, [athleteId])

    return { data, loading, error }
}
