import {build} from 'esbuild';
import {createRequire} from 'node:module';

// A deterministic hook host executes the real component and all of its effects.
// Browser coverage exercises the same recovery paths with React DOM and a Worker.
export async function contextHooks(context) {
  const slots = [], effects = [];
  let cursor = 0, dirty = true, output;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const hooks = {
    createContext: value => ({value, Provider: 'provider'}),
    useContext: () => context,
    createElement: (type, props) => ({type, props}),
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = {value: typeof initial === 'function' ? initial() : initial};
      const slot = slots[index];
      slot.set ||= value => {
        const next = typeof value === 'function' ? value(slot.value) : value;
        if (!Object.is(next, slot.value)) {slot.value = next; dirty = true;}
      };
      return [slot.value, slot.set];
    },
    useRef(initial) {const index = cursor++; return slots[index] ||= {current: initial};},
    useCallback(callback, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = {deps, callback};
      return slots[index].callback;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) {
        const previous = slots[index];
        slots[index] = {deps};
        effects.push(() => {previous?.cleanup?.(); slots[index].cleanup = effect();});
      }
    },
  };
  const bundle = await build({entryPoints: ['src/modules/widget/js/context/ConnectContext.jsx'], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', logLevel: 'silent'});
  const require = createRequire(new URL('../../package.json', import.meta.url)), module = {exports: {}};
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(id => id === 'react' ? hooks : require(id), module, module.exports);
  const props = {open: true, setInsightOpen() {}, setOpen() {}};
  return {
    get value() {this.flush(); return output.props.value;},
    flush() {
      for (let count = 0; dirty || effects.length; count++) {
        if (count > 50) throw new Error('Context did not settle');
        if (dirty) {dirty = false; cursor = 0; output = module.exports.ConnectProvider(props);}
        effects.splice(0).forEach(effect => effect());
      }
    },
    close() {slots.forEach(slot => slot?.cleanup?.());},
  };
}
