// Types de scripts/lib/profileIcons.mjs (importé par les tests de src/lib/profileIcons).
export interface SerebiiPageIcon { id: string; nameEn: string; method: string; src: string }
export interface ListedIcon { id: string; nameEn: string; method?: string; added?: string; [k: string]: unknown }
export function serebiiIconId(file: string): string | null
export function parseSerebiiIcons(html: string, pageUrl: string): SerebiiPageIcon[]
export function mergeIconLists(prev: ListedIcon[] | null | undefined, fresh: ListedIcon[], today: string): { icons: ListedIcon[]; added: string[] }
