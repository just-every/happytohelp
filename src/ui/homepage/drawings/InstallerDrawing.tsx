import { Icon } from './Icons';
import { Drawing, SketchMarks } from './Sketch';

const groups = [{ name: 'Workspace', done: true }, { name: 'Your account', done: true }, { name: 'Hosting & connections', done: false }];

// The installer's "Hosting & connections" step: the setup groups down the left, the current step's fields on the right.
export function InstallerDrawing() {
  return <Drawing className="installer-art" label="Drawing of the HappyToHelp installer: Workspace and Your account are done, and Hosting & connections is choosing to publish online with Cloudflare, the team workspace address and Cloudflare Email Sending.">
    <SketchMarks variant="sparkle" />
    <div className="d-window ins-window">
      <ul className="ins-rail">
        {groups.map(({ name, done }) => <li key={name} className={done ? undefined : 'is-current'}>{done ? <span className="d-check"><Icon name="check" /></span> : <span className="ins-dot" />}{name}</li>)}
      </ul>
      <div className="ins-panel">
        <b className="ins-title">Hosting &amp; connections</b>
        <div className="ins-field"><span>Install to</span><span className="ins-options"><span className="d-btn">Run locally</span><span className="d-btn d-btn--chosen">Publish online with Cloudflare</span></span></div>
        <div className="ins-field"><span>Team workspace address</span><span className="ins-input">https://northwind-support.example.workers.dev</span><small>The HTTPS address your team will open to use HappyToHelp.</small></div>
        <div className="ins-field"><span>Email service</span><span className="ins-input ins-select">Cloudflare Email Sending<Icon name="chevron" /></span></div>
        <span className="d-btn d-btn--ink ins-continue">Continue</span>
      </div>
    </div>
  </Drawing>;
}
