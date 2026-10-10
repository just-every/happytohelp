import { markSvg } from '../../ui/homepage/brand-mark'
import { wordSvg } from '../../ui/homepage/brand-word'

// HappyToHelp's own brand, for the Help Center pages no project owns (shell.ts `platform`). Project pages never carry it:
// they show the project's name, logo and colour.

/** The mark and the drawn wordmark from their one source of geometry; decorative, the brand link's hidden text names it. */
export const platformLockup = `<span class="help-center-lockup" aria-hidden="true">${markSvg().trim()}${wordSvg()}</span>`

/** The application's tab icons, as src/routes/__root.tsx links them (same hrefs, types, sizes and order). */
const brands = '/homepage/media/brands'
export const platformIcons = `<link rel="icon" type="image/png" sizes="512x512" href="${brands}/happytohelp-favicon.png"><link rel="icon" type="image/svg+xml" sizes="any" href="${brands}/happytohelp-favicon.svg"><link rel="apple-touch-icon" sizes="180x180" href="${brands}/happytohelp-apple-touch-icon.png">`
