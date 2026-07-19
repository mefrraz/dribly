import urllib.request, re, time

TUGABASKET = 'https://resultados.tugabasket.com'
SEASON_ID = 64
SEASON = '2025/2026'

ASSOCIATIONS = [
    (50, 'FPB'), (1, 'AB Lisboa'), (2, 'AB Setúbal'), (3, 'AB Aveiro'),
    (4, 'AB Porto'), (5, 'AB Braga'), (6, 'AB Madeira'), (7, 'AB Santarém'),
    (8, 'AB Coimbra'), (9, 'AB Algarve'), (10, 'AB Viseu'), (11, 'AB Leiria'),
    (12, 'AB Alentejo'), (13, 'AB Ilha Terceira'), (14, 'AB Castelo Branco'),
    (15, 'AB Bragança'), (16, 'AB São Miguel'), (17, 'AB Viana do Castelo'),
    (18, 'AB Vila Real'), (19, 'AB Faial e Pico'), (20, 'AB Guarda'),
    (22, 'AB Santa Maria'), (24, 'AB Açores'),
]

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; GaienSes-Bot/1.0)'})
    return urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='replace')

def esc(s):
    return s.replace("'", "''")

seen = set()
all_comps = []

for assoc_id, assoc_name in ASSOCIATIONS:
    url = f'{TUGABASKET}/competitions?associationId={assoc_id}&seasonId={SEASON_ID}'
    try:
        html = fetch(url)
        # Find <a href="getCompetitionDetails?competitionId=NUM" title="NAME">
        matches = re.findall(
            r'href="[^"]*competitionId[=/](\d+)[^"]*"\s+title="([^"]*)"',
            html
        )
        count = 0
        for cid, cname in matches:
            cname = cname.strip()
            key = f'{cid}-{SEASON}'
            if key not in seen:
                seen.add(key)
                all_comps.append((int(cid), cname, assoc_id, assoc_name))
                count += 1
        print(f'{assoc_name}: found {count} competitions')
    except Exception as e:
        print(f'{assoc_name}: ERROR - {e}')
    time.sleep(1)

print(f'\nTotal unique competitions: {len(all_comps)}')

# Generate SQL
rows = []
for cid, cname, aid, aname in all_comps:
    rows.append(f"({cid}, '{esc(cname)}', {aid}, '{esc(aname)}', '{SEASON}', ARRAY[]::text[], NOW(), NOW())")

# Write batches
batch_size = 50
for i in range(0, len(rows), batch_size):
    chunk = rows[i:i+batch_size]
    sql = f"""INSERT INTO competitions (competition_id, competition_name, association_id, association_name, season, club_names, created_at, updated_at)
VALUES {','.join(chunk)}
ON CONFLICT (competition_id, season) DO UPDATE SET
  competition_name = EXCLUDED.competition_name,
  association_name = EXCLUDED.association_name,
  updated_at = NOW();"""
    
    with open(rf'C:\Users\andre\OneDrive\Documentos\gaiensespt\scripts\comp_batch_{i//batch_size+1}.sql', 'w', encoding='utf-8') as f:
        f.write(sql)
    print(f'Batch {i//batch_size+1} written: {len(chunk)} rows')

print('\nDone!')
