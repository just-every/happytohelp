export type VillageIconName = 'bubble' | 'people' | 'spark' | 'book' | 'link' | 'code';

// Paths retained from the 12ui HTML conversion; scoped IDs avoid application icons.
export function VillageIcons() {
  return <svg className="village-symbols" aria-hidden="true"><defs>
    <symbol id="village-bubble" viewBox="0 0 32 32"><path d="M5 5h23v18H16l-8 6v-6H5z" /></symbol>
    <symbol id="village-people" viewBox="0 0 32 32"><circle cx="16" cy="10" r="4" /><path d="M9 27v-5c0-7 14-7 14 0v5M6 8c-5 1-4 8 0 9M26 8c5 1 4 8 0 9M7 20c-5-1-6 3-6 6M25 20c5-1 6 3 6 6M13 24h6" /></symbol>
    <symbol id="village-spark" viewBox="0 0 32 32"><path d="m16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4z" /></symbol>
    <symbol id="village-book" viewBox="0 0 32 32"><path d="M16 7C11 3 6 3 2 5v21c5-2 9-1 14 2 5-3 9-4 14-2V5c-4-2-9-2-14 2v21" /></symbol>
    <symbol id="village-link" viewBox="0 0 32 32"><path d="m13 19 7-7M12 11l5-5c7-7 16 2 9 9l-5 5M20 21l-5 5C8 33-1 24 6 17l5-5" /></symbol>
    <symbol id="village-code" viewBox="0 0 32 32"><path d="m10 7-8 9 8 9m12-18 8 9-8 9M19 3l-6 26" /></symbol>
  </defs></svg>;
}
