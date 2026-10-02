import { ImportDrawing } from './drawings/ImportDrawing';
import { installerUrl } from './repository';

const steps = [
  ['Install it.', 'The installer asks only for what it cannot find, and nothing is set up until you approve. Codex or Claude can fill it in.'],
  ['Bring your help centre.', 'Import your articles and categories from Zendesk, Intercom or Freshdesk. Your old helpdesk is only read, never changed, and you can run the import again to pick up new edits.'],
  ['Add the chat widget.', 'One script tag on your website.'],
];

export function MoveIn() {
  return <section className="section split split--reverse" id="move-in" aria-labelledby="move-in-title">
    <div className="split-copy">
      <h2 id="move-in-title">Try it beside what you have</h2>
      <p>Keep your current helpdesk running while you try it. Nothing there changes.</p>
      <ol className="steps">{steps.map(([lead, text]) => <li key={lead}><b>{lead}</b> {text}</li>)}</ol>
      <p>Want to look around first? Every empty workspace can open a demo inbox with sample conversations.</p>
      <div className="actions"><a className="text-link" href={installerUrl}>Read the installation guide</a></div>
    </div>
    <ImportDrawing />
  </section>;
}
