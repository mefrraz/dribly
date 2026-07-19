const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY in .env");
    process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("Fetching https://www.fpb.pt/clubes/ ...");
    const res = await fetch("https://www.fpb.pt/clubes/", { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();

    const clubs = [];
    const blocks = html.split('class="clube-body"');
    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const colorMatch = block.match(/background-color:\s*([^;'"<>]+)/);
        if (!colorMatch) continue;
        const color = colorMatch[1].trim();

        const idx = html.indexOf(block);
        const context = html.substring(Math.max(0, idx - 500), idx);
        const idMatch = context.match(/href="\/calendario\/clube_(\d+)"/);
        if (!idMatch) continue;
        const id = parseInt(idMatch[1]);

        const nameMatch = block.match(/<div class="clube-name">([^<]*)<\/div>/);
        const shortMatch = block.match(/<div class="clube-shortname">([^<]*)<\/div>/);
        const name = nameMatch ? nameMatch[1].trim() : (shortMatch ? shortMatch[1].trim() : "");
        const logoMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*>/);
        const localMatch = block.match(/<div class="clube-local">([^<]*)<\/div>/);
        const regionMatch = block.match(/<div class="clube-region">([^<]*)<\/div>/);

        clubs.push({
            id, name,
            short_name: shortMatch ? shortMatch[1].trim() : name,
            color,
            logo_url: logoMatch ? logoMatch[1].trim() : null,
            local: localMatch ? localMatch[1].trim() : "",
            region: regionMatch ? regionMatch[1].trim() : "",
        });
    }

    console.log("Found " + clubs.length + " clubs");
    fs.writeFileSync("C:/Users/andre/OneDrive/Documentos/gaiensespt/scrapers/scraped_clubs.json", JSON.stringify(clubs, null, 2), "utf8");

    let updated = 0, errors = 0;
    for (const club of clubs) {
        const isBlack = club.color === "#000000" || club.color === "#000";
        const slug = club.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const r = await supabase.from("clubs").upsert({
            id: club.id,
            name: club.name,
            search_name: club.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
            slug,
            primary_color: isBlack ? "#7C3AED" : club.color,
            logo_url: club.logo_url,
        }, { onConflict: "id" });
        if (r.error) { errors++; if (errors <= 3) console.error("Error " + club.id + ": " + r.error.message); }
        else updated++;
    }
    console.log("Done: " + updated + " upserted, " + errors + " errors");
}
main();
