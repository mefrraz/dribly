import { fetchTeams } from '../src/lib/fpbCompetitionsApi'

async function main() {
    console.log('Fetching Liga Betclic teams...')
    const t = await fetchTeams(10902)
    const withPhoto = t.filter(x => x.photo)
    const benfica = t.filter(x => x.nome.toLowerCase().includes('benfica'))
    console.log('Total:', t.length, 'With photo:', withPhoto.length, 'Benfica:', benfica.length)
    console.log('First 3 with photo:', JSON.stringify(withPhoto.slice(0, 3), null, 2))
    console.log('Benfica teams:', JSON.stringify(benfica.slice(0, 3), null, 2))
}
main()
