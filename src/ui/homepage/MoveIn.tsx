import { HydrationUnit } from '../../vendor/base/hydration/unit';
import { ImportDrawing } from './drawings/ImportDrawing';
import { installerUrl } from './repository';
import { useReveal } from './reveal/useReveal';

const steps = [
  ['Install it.', 'Codex or Claude can help.'],
  ['Bring your help centre.', 'From Zendesk, Intercom or Freshdesk.'],
  ['Add the chat widget.', 'One script tag on your site.'],
];

export function MoveIn() {
  const reveal = useReveal<HTMLOListElement>();
  return <HydrationUnit><section className="section split" id="move-in" aria-labelledby="move-in-title">
    <div className="split-copy">
      <h2 id="move-in-title">Try it beside what you have</h2>
      <p>Keep your current helpdesk running while you try it.</p>
      <ol className="steps" ref={reveal}>{steps.map(([lead, text]) => <li key={lead}><b>{lead}</b> {text}</li>)}</ol>
      <div className="actions"><a className="text-link" href={installerUrl}>Read the installation guide</a></div>
    </div>
    <ImportDrawing />
  </section></HydrationUnit>;
}
