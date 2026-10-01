import { Icon } from './Icons';
import { Drawing, SketchMarks } from './Sketch';

const points = ['Free, MIT-licensed code', 'Runs in your own Cloudflare account', 'Hosting and AI paid to providers you choose', 'Your code and your data'];

export function YoursDrawing() {
  return <Drawing className="yours-art" label="Drawing of a checklist: free MIT-licensed code, runs in your own Cloudflare account, hosting and AI usage paid to the providers you choose, and you keep your code and data.">
    <SketchMarks variant="sparkle" />
    <div className="d-window yours-card">
      <ul>{points.map(p => <li key={p}><span className="d-check"><Icon name="check" /></span>{p}</li>)}</ul>
    </div>
  </Drawing>;
}
