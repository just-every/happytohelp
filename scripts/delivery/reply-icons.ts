import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type {Plugin} from 'vite';

const moduleId = 'virtual:happytohelp-reply-icons';
const source = new URL('../../src/ui/dashboard/components/reply-icons/glyphs.json', import.meta.url);
// Keep initial controls inline. Every other catalogue glyph is available as a
// native SVG resource, without sending the entire catalogue as JavaScript.
const controls = ['send','plus','mail','x','pencil','chevron-down','chevron-up','user','circle-check',
    'calendar','clock','ban','map-pin','globe','wifi','monitor','laptop','user-round-check',
    'heading-1','bold','italic','code','list','list-ordered','quote','link','image-plus'];

export function replyIconAssets(): Plugin {
    let base = '/';
    const glyphs: Record<string,string> = JSON.parse(readFileSync(source, 'utf8'));
    const names = Object.keys(glyphs);
    if (names.some(name => !/^[a-z0-9-]+$/.test(name)) || controls.some(name => !glyphs[name])) throw Error('Invalid reply icon source');
    const sprite = `<svg xmlns="http://www.w3.org/2000/svg">${names.map(name => `<symbol id="${name}" viewBox="0 0 24 24">${glyphs[name]}</symbol>`).join('')}</svg>`;
    const fileName = `assets/reply-icons-${createHash('sha256').update(sprite).digest('hex').slice(0,8)}.svg`;
    const common = Object.fromEntries(controls.map(name => [name, glyphs[name]]));
    return {
        name: 'happytohelp:reply-icon-assets',
        configResolved(config) { base = config.base; },
        resolveId(id) { if (id === moduleId) return '\0' + moduleId; },
        load(id) {
            if (id !== '\0' + moduleId) return;
            this.addWatchFile(source.pathname);
            return `export const spriteUrl=${JSON.stringify(base.replace(/\/$/,'')+'/'+fileName)};export const controlGlyphs=${JSON.stringify(common)};`;
        },
        generateBundle() {
            if (this.environment.name === 'client') this.emitFile({type:'asset',fileName,source:sprite});
        },
        configureServer(server) {
            server.middlewares.use((request,response,next) => {
                if (request.url?.split('?')[0] !== base.replace(/\/$/,'')+'/'+fileName) return next();
                response.setHeader('Content-Type','image/svg+xml');
                response.setHeader('Cache-Control','no-store');
                response.end(sprite);
            });
        },
    };
}
