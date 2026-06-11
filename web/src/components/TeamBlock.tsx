import { Link } from 'react-router-dom'


/**
 * Team logo + name block used in the game hero card.
 * If clubSlug is provided, wraps in a link to the club page.
 */
export function TeamBlock({ name, logo, clubSlug }: {
    name: string
    logo: string | null
    clubSlug?: string | null
}) {
    const content = (
        <div className="flex-1 flex flex-col items-center text-center gap-1 min-w-0">
            <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                {logo ? (
                    <img src={logo} alt="" className="w-14 h-14 object-contain" />
                ) : (
                    <span className="text-2xl font-bold text-zinc-500">{name.charAt(0)}</span>
                )}
            </div>
            <p className="text-xs font-black text-zinc-900 dark:text-white leading-tight truncate w-full">
                {name}
            </p>
        </div>
    )
    if (clubSlug) {
        return <Link to={"/clube/" + clubSlug + "/home"} className="flex-1 hover:opacity-80 transition-opacity">{content}</Link>
    }
    return content
}
