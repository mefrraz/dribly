/**
 * Priority classifier FINAL — Hardcoded team→club mapping.
 * Only updates priorities for clubs that play in national competitions.
 * Others → priority 5.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) { console.error('Missing env vars'); process.exit(1) }
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: WebSocket } })

// Team name in games → club name in clubs table
const TEAM_TO_CLUB: Record<string, string> = {
    'Ovarense GAVEX': 'A.D.O. Basquetebol da Associação Desportiva Ovarense',
    'Galitos BARREIRO ACEDE': 'Galitos Futebol Clube',
    'UD Oliveirense': 'União Desportiva Oliveirense',
    'Futebol Clube do Porto': 'Futebol Clube do Porto',
    'Queluz O NOSSO PREGO': 'Clube Atlético de Queluz',
    'Esgueira Aveiro OLI': 'Clube do Povo de Esgueira',
    'Imortal LUZiGÁS': 'Imortal Basket Club',
    'SC Vasco da Gama': 'Sporting Clube Vasco da Gama',
    'Sporting Clube de Braga': 'Sporting Clube de Braga',
    'Sporting Clube Portugal': 'Sporting Clube de Portugal',
    'Vitória Sport Clube': 'Vitória Sport Clube',
    'APD Sintra': 'Associação Portuguesa de Deficientes Sintra',
    'Galitos FFONSECA': 'Galitos Futebol Clube',
    'GDESSA Barreiro': 'GDESSA Barreiro',
    'SL Benfica': 'Sport Lisboa e Benfica',
    'Imortal LUSIADAGÁS': 'Imortal Basket Club',
    'Académico FC': 'Académico Futebol Clube',
    'CD José Régio': 'Clube Desportivo José Régio',
    'CLIP TEAMS': 'CLIP Teams Associação Desportiva',
    'Belenenses': 'Clube Futebol Os Belenenses',
    'Sporting CP Sub22': 'Sporting Clube de Portugal',
    'SIMECQ': 'SIMECQ',
    'Maia Basket Clube': 'Maia Basket Clube',
    'Gafanha Reis & Ana': 'Grupo Desportivo da Gafanha',
    'Olivais FC msc_engenharia': 'Olivais Futebol Clube',
    'SC Braga': 'Sporting Clube de Braga',
    'Sampaense Inspecentro': 'Sampaense Basket Club',
    'PAC Kyocera': 'Paço de Arcos Clube',
    'SC Beira-Mar': 'Sport Clube Beira Mar',
    'Galitos Pizzarte': 'Galitos Futebol Clube',
    'FC GAIA - FOKUS': 'Futebol Clube de Gaia',
    'Seixal Superveda': 'Seixal Clube 1925',
    'Olivais FC': 'Olivais Futebol Clube',
    'Juvemaia ACDC/Mecprec': 'Juvemaia - Associação Cultural Desportiva e Cívica',
    'GDAS': 'GDAS',
    'Basquete Barcelos Eticol': 'Basquete Clube de Barcelos',
    'AAUTAD': 'Associação Académica da UTAD',
    'Club Sport Marítimo/CAB': 'Club Sport Marítimo',
    'Ovarense Internutri': 'A.D.O. Basquetebol da Associação Desportiva Ovarense',
    'CTM V. Pouca de Aguiar': 'Centro Treino Municipal Vila Pouca de Aguiar',
    'NCR Valongo Valetel': 'Núcleo Cultural Recreativo de Valongo',
    'Atómicos Eletrosantos-T21': 'Atómicos Sport Clube',
    'Club 5Basket JBL M&PUB': 'Club 5Basket - Associação',
    'GDB Leça Pousadinha Parade': 'Grupo Desportivo Basquete de Leça',
    'CBP': 'CBP2012 - Basquetebol Clube de Penafiel',
    'Juvemaia ACDC': 'Juvemaia - Associação Cultural Desportiva e Cívica',
    'Galitos Sub22 Qviagem': 'Galitos Futebol Clube',
    'CD Aves 1930': 'Clube Desportivo das Aves 1930',
    'Sporting Clube da Madeira': 'Sporting Clube da Madeira',
    'GRIB': 'GRIB',
    'GDRAR': 'GDRAR',
    'FamaBasket': 'FamaBasket - Clube Basquetebol de Famalicão',
    'Associação Académica Pinhalnovense': 'Associação Académica Pinhalnovense',
    'Sampaense Basket Club': 'Sampaense Basket Club',
    'Estrela Calheta FC': 'Estrela Calheta Futebol Clube',
    'União de Leiria': 'União Desportiva Leiria',
    'CBP 2012': 'CBP2012 - Basquetebol Clube de Penafiel',
    'Mirandela BC O Cerdoura': 'Mirandela Basquetebol Clube',
    'CF "Os Bonjoanenses" Faro': 'Clube de Futebol Os Bonjoanenses de Faro',
    'Lac Basquetebol Clube': 'LAC Basquetebol Clube',
    'Monção BC': 'Monção Basket Clube 2000',
    'Esc. Mod. SLBenfica OAZ': 'Escola de Modalidades do Sport Lisboa e Benfica em Oliveira de Azemeis',
    'ACR Vale Cambra': 'Associação Cultural e Recreativa de Vale de Cambra',
    // Sub23 / B teams → map to themselves (not the main club)
    'Galitos Sub23': 'Galitos Futebol Clube',
    'Ovarense Sub23 Olho Marinho': 'A.D.O. Basquetebol da Associação Desportiva Ovarense',
    'Club 5Basket Sub23': 'Club 5Basket - Associação',
    'Beira-Mar sub23': 'Sport Clube Beira Mar',
    'SC Braga Sub23': 'Sporting Clube de Braga',
    'FC Porto Sub23': 'Futebol Clube do Porto',
    'UD Oliveirense Sub23': 'União Desportiva Oliveirense',
    'Illiabum Sub23 EXITCASA': 'Illiabum Clube',
    'FC Gaia Sub23': 'Futebol Clube de Gaia',
    'Imortal Sub23': 'Imortal Basket Club',
    'Queluz Sub23': 'Clube Atlético de Queluz',
    'Sangalhos Sub23': 'Sangalhos Desporto Clube',
    'Gafanha Sub23': 'Grupo Desportivo da Gafanha',
    'Ovarense B': 'A.D.O. Basquetebol da Associação Desportiva Ovarense',
    'Sanjoanense Sub23': 'Associação Desportiva Sanjoanense',
    'Esgueira Sub23': 'Clube do Povo de Esgueira',
    'Vasco da Gama Sub23': 'Sporting Clube Vasco da Gama',
    'Galitos B': 'Galitos Futebol Clube',
    'Olivais Sub23': 'Olivais Futebol Clube',
};

const COMP_PRIORITY: Record<string, number> = {
    'Liga Betclic Feminina': 1, 'Liga Betclic Masculina': 1, 'Liga BCR': 1,
    'Proliga': 2, '1ª Divisão Feminina': 2,
    '1ª Divisão Masculina': 3, '2ª Divisão Feminina': 3,
    '2ª Divisão Masculina': 4,
}

async function main() {
    console.log('🎯 Priority classifier FINAL\n')

    const [{ data: clubs }, { data: games }] = await Promise.all([
        supabase.from('clubs').select('id, name, priority').order('id'),
        supabase.from('games_2025_2026').select('equipa_casa, equipa_fora, competicao'),
    ])
    if (!clubs || !games) { console.error('No data'); process.exit(1) }

    // Build team → best priority
    const teamP = new Map<string, number>()
    for (const g of games as { equipa_casa: string; equipa_fora: string; competicao: string | null }[]) {
        const p = COMP_PRIORITY[(g.competicao || '').trim()]
        if (!p) continue
        for (const t of [g.equipa_casa, g.equipa_fora]) {
            const cur = teamP.get(t) ?? 99
            if (p < cur) teamP.set(t, p)
        }
    }

    // Map teams to clubs using hardcoded mapping
    const clubP = new Map<number, number>()
    let mapped = 0
    let unmatched = 0

    for (const [teamName, p] of teamP) {
        const clubName = TEAM_TO_CLUB[teamName]
        if (!clubName) { unmatched++; continue }

        const club = (clubs as { id: number; name: string }[]).find(c => c.name === clubName)
        if (!club) { console.log(`  ⚠️  Club not found: "${clubName}"`); unmatched++; continue }

        const cur = clubP.get(club.id) ?? 99
        if (p < cur) clubP.set(club.id, p)
        mapped++
    }

    console.log(`  ${mapped} equipas mapeadas, ${unmatched} sem match`)

    // Update
    let updated = 0
    for (const [id, p] of clubP) {
        const club = (clubs as { id: number; name: string; priority: number | null }[]).find(c => c.id === id)
        if (club && club.priority !== p) {
            console.log(`    ${club.priority ?? '?'}→${p}  ${club.name}`)
            await supabase.from('clubs').update({ priority: p }).eq('id', id)
            updated++
        }
    }

    // Unmatched → 5
    let to5 = 0
    for (const c of clubs as { id: number; name: string; priority: number | null }[]) {
        if (!clubP.has(c.id) && c.priority !== 5) {
            await supabase.from('clubs').update({ priority: 5 }).eq('id', c.id)
            to5++
        }
    }

    console.log(`\n✅ ${updated} atualizados, ${to5} → prioridade 5`)
}

main().catch(err => { console.error(err); process.exit(1) })
