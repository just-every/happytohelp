import { TaskFormDrawing } from './drawings/TaskFormDrawing';

export function HandoffDetail() {
  return <section className="section split" id="handoff" aria-labelledby="handoff-title">
    <div className="split-copy">
      <h2 id="handoff-title">How the handoff works</h2>
      <p>For each task you choose the computer and the action. Investigate is read-only and is the default. Resolve allows the changes you describe in your instructions. Resolve &amp; reply also lets HappyToHelp send one reply, but only after the worker reports verified work. Every task is scoped to its conversation and workspace, and the results come back as suggestions your team can use or run.</p>
    </div>
    <TaskFormDrawing />
  </section>;
}
