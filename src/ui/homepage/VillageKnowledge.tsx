import { VillageFeature } from './VillageFeature';
import { VillageScene } from './VillageScene';

export function VillageKnowledge() {
  return <>
    <section className="context" id="features" aria-labelledby="features-title">
      <VillageScene name="context" width={3072} height={2050} alt="Villagers gather at a support desk in a stone village square." />
      <div className="inner context-copy"><h2 id="features-title">Every conversation, in context.</h2><p className="description">Customer widget, shared inbox and team replies keep the conversation together. Your team can follow the history, understand the customer, and pick up where the last reply left off.</p>
        <div className="features">
          <VillageFeature icon="bubble" title="Customer widget">Let your customers reach you from your site or app.</VillageFeature>
          <VillageFeature icon="people" title="Shared inbox">Keep durable conversations, assignments and customer context together.</VillageFeature>
          <VillageFeature icon="spark" title="Team replies">Collaborate, add internal notes, and bring a person into the conversation.</VillageFeature>
        </div>
      </div>
    </section>
    <section className="knowledge" id="knowledge" aria-labelledby="knowledge-title">
      <VillageScene name="knowledge" width={3072} height={1782} alt="An open stone library where villagers study guides, FAQs and policies." />
      <div className="inner knowledge-copy"><h2 id="knowledge-title">Answers grounded in your knowledge.</h2><p className="description">Bring your team’s expertise and published help content into the conversation, with retrieved sources that help your team check and build on an answer.</p>
        <div className="features">
          <VillageFeature icon="book" title="Published help content">Publish articles and guides in a searchable help center for your customers.</VillageFeature>
          <VillageFeature icon="link" title="Source citations">Use knowledge retrieval and citations to trace supporting information.</VillageFeature>
          <VillageFeature icon="people" title="Connected knowledge">Give configured assistants relevant knowledge and customer context for their suggestions.</VillageFeature>
        </div>
      </div>
    </section>
  </>;
}
