import { JourneyMap } from "./JourneyMap";

export function FeaturesSection() {
  return (
    <section className="home-section dark river" id="features" aria-labelledby="features-title">
      <JourneyMap section="crossing" />
      <div className="section-inner">
        <div className="process-grid">
          <figure className="section-art">
            <img src="/homepage/media/human-story-options/anticipation-c-sculpted.png" alt="Two travelers crossing a stream on a narrow wooden plank, rendered as a matte sculpture." loading="lazy" />
          </figure>
          <div className="section-copy">
            <div className="section-marker">02</div>
            <h2 id="features-title">Help before they need it.</h2>
            <p>Put the right knowledge in reach before a small question becomes a roadblock. Bring your help content, customer context and conversations together, so the next useful step is easier to find.</p>
            <p>Give customers a clear way forward with answers grounded in your own knowledge. When they need more help, your team can step into the conversation with the context already there.</p>
          </div>
          <div className="steps">
            <p className="component-label">The process</p>
            <ol className="process-steps">
              <li className="step">
                <span className="num" aria-hidden="true">1</span>
                <div>
                  <h3>Connect knowledge</h3>
                  <p>Bring help content, customer context and conversations together.</p>
                </div>
              </li>
              <li className="step">
                <span className="num" aria-hidden="true">2</span>
                <div>
                  <h3>Ground answers</h3>
                  <p>Use published knowledge, with source citations people can follow.</p>
                </div>
              </li>
              <li className="step">
                <span className="num" aria-hidden="true">3</span>
                <div>
                  <h3>Bring in your team</h3>
                  <p>Keep the conversation and its context together when a person steps in.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
        <div className="provenance-strip">
          <b>Built from your sources</b>
          <span>
            <svg className="icon" aria-hidden="true" focusable="false">
              <use href="#home-icon-doc">
              </use>
            </svg>Your help content</span>
          <span>
            <svg className="icon" aria-hidden="true" focusable="false">
              <use href="#home-icon-doc">
              </use>
            </svg>Customer context</span>
          <span>
            <svg className="icon" aria-hidden="true" focusable="false">
              <use href="#home-icon-chat">
              </use>
            </svg>Conversations</span>
          <span>
            <svg className="icon" aria-hidden="true" focusable="false">
              <use href="#home-icon-book">
              </use>
            </svg>Published knowledge</span>
        </div>
      </div>
    </section>
  );
}
