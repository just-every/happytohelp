import type { Plugin } from 'vite';

const moduleId = 'virtual:happytohelp-module-preloads';
const resolvedId = '\0' + moduleId;

/** Start lists a route chunk and its direct imports. Retain the emitted static
 * graph so the Worker can discover the rest in the same streamed head. */
export function workspaceModulePreloads(): Plugin {
    let base = '/';
    let graph: Record<string, string[]> = {};
    return {
        name: 'happytohelp:workspace-module-preloads',
        configResolved(config) { base = config.base; },
        resolveId(id) { if (id === moduleId) return resolvedId; },
        load(id) { if (id === resolvedId) return `export default ${JSON.stringify(graph)};`; },
        generateBundle(_options, bundle) {
            if (this.environment.name !== 'client') return;
            const chunks = Object.values(bundle).filter(output => output.type === 'chunk');
            const imports = new Map(chunks.map(chunk => [chunk.fileName, chunk.imports]));
            const href = (file: string) => base.replace(/\/$/, '') + '/' + file;
            graph = Object.fromEntries(chunks.map(chunk => {
                const seen = new Set([chunk.fileName]);
                const dependencies: string[] = [];
                const visit = (file: string) => {
                    for (const child of imports.get(file) || []) {
                        if (seen.has(child) || !imports.has(child)) continue;
                        seen.add(child);
                        dependencies.push(href(child));
                        visit(child);
                    }
                };
                visit(chunk.fileName);
                return [href(chunk.fileName), dependencies];
            }));
        },
    };
}
