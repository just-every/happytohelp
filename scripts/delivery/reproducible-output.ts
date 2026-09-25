import type { Plugin } from 'vite'

// TanStack Start's server manifest module (VIRTUAL_MODULES.startManifest).
const startManifestModule = 'tanstack-start-manifest:v'

// Emitted Worker and client code must not depend on the checkout location.
// TanStack Start serializes each route's absolute source path into the server
// start manifest. That path is only a build-time lookup key for route chunks;
// the runtime reads route children and assets. Keep it relative to the project
// root, and refuse any emitted chunk that still names the builder's directory.
export function reproducibleOutput(): Plugin {
  let root = ''
  return {
    name: 'happytohelp:reproducible-output',
    apply: 'build',
    configResolved(config) {
      root = `${config.root.replaceAll('\\', '/').replace(/\/$/, '')}/`
    },
    transform: {
      order: 'post',
      handler(code, id) {
        if (!id.includes(startManifestModule) || !code.includes(root)) return
        return { code: code.replaceAll(`"${root}`, '"'), map: null }
      },
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk' && output.code.includes(root)) {
          throw new Error(`Emitted chunk ${output.fileName} contains the absolute build directory ${root}`)
        }
      }
    },
  }
}
