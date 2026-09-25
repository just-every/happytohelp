import { AsyncLocalStorage } from 'node:async_hooks';
const requests = new AsyncLocalStorage();
export function withWorkerRuntime(runtime, callback) { return requests.run(runtime, callback); }
export function workerRuntime() {
 const runtime = requests.getStore();
 if (!runtime) throw new Error('ENSEMBLE_RUNTIME_REQUIRED');
 return runtime;
}
function objectKey(path) {
 const runtime = workerRuntime();
 const clean = String(path).replaceAll('\\', '/').replace(/^\.\//, '');
 if (clean.split('/').includes('..') || clean.startsWith('/')) throw new Error('INVALID_SOURCE_PATH');
 if (!runtime.files || !runtime.scope) throw new Error('DURABLE_SOURCE_STORAGE_REQUIRED');
 return `${runtime.scope}/ensemble/${clean}`;
}
export const durableFiles = {
 async mkdir() { objectKey(''); },
 async readFile(path) {
  const object = await workerRuntime().files.get(objectKey(path));
  if (!object) throw Object.assign(new Error('Source not found'), {code:'ENOENT'});
  return object.text();
 },
 async writeFile(path, data) { await workerRuntime().files.put(objectKey(path), data); }
};
