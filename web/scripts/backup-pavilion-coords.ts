import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const { data } = await s.from('pavilions').select('id, nome, lat, lng, distrito, concelho, geocode_ok').order('id')
if (!data) { console.log('No data'); process.exit(1) }

fs.writeFileSync('web/scripts/old-pavilion-coords-backup.json', JSON.stringify(data, null, 2))
console.log(`💾 ${data.length} pavilions backed up to old-pavilion-coords-backup.json`)
