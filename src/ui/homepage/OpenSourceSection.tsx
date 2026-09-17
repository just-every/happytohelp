import { JourneyMap } from "./JourneyMap";

export function OpenSourceSection() {
  return (
    <section className="home-section dark market" id="open-source" aria-labelledby="open-source-title">
      <JourneyMap section="ownership" />
      <div className="section-inner">
        <div className="license-grid">
          <div className="section-copy">
            <div className="section-marker">05</div>
            <h2 id="open-source-title">100% free. MIT licensed.</h2>
            <p>Run it. Change it. Make it yours. HappyToHelp is built around a simple idea: the software your team relies on should be software you can own and adapt.</p>
            <p>Keep the code, shape the experience and run it in accounts you control. Choose the hosting and AI providers that fit your needs, with the freedom to keep improving the product as your team grows.</p>
          </div>
          <div className="ownership-facts">
            <ul className="license-features">
              <li className="feature">
                <span className="ring">
                  <svg className="icon" aria-hidden="true" focusable="false">
                    <use href="#home-icon-person">
                    </use>
                  </svg>
                </span>
                <div>
                  <h3>MIT licensed</h3>
                  <p>Use, change and keep the source code.</p>
                </div>
              </li>
              <li className="feature">
                <span className="ring">
                  <svg className="icon" aria-hidden="true" focusable="false">
                    <use href="#home-icon-database">
                    </use>
                  </svg>
                </span>
                <div>
                  <h3>Your hosting</h3>
                  <p>Run it in accounts you control.</p>
                </div>
              </li>
              <li className="feature">
                <span className="ring">
                  <svg className="icon" aria-hidden="true" focusable="false">
                    <use href="#home-icon-link">
                    </use>
                  </svg>
                </span>
                <div>
                  <h3>Your AI provider</h3>
                  <p>Choose the services that fit your team.</p>
                </div>
              </li>
            </ul>
            <a className="source-button" href="https://github.com/runeditrun/support-happytohelp">View the source <span>↗</span>
            </a>
          </div>
          <figure className="section-art">
            <img src="/homepage/media/human-story-options/open-c-sculpted.png" alt="Two travelers sharing water at a stone well, rendered as a matte sculpture." loading="lazy" />
          </figure>
        </div>
        <div className="ownership-questions" aria-label="Common questions">
          <details>
            <summary>What is free?</summary>
            <p>The source code. Run and change it under the MIT license. Hosting and AI usage are paid through the accounts you choose.</p>
          </details>
          <details>
            <summary>Can my team still reply?</summary>
            <p>Yes. Keep the conversation and its context together when a person steps in.</p>
          </details>
          <details>
            <summary>Where do agents run?</summary>
            <p>Connect a local computer running Codex or Claude, choose the work it can do, and revoke access when you need to.</p>
          </details>
        </div>
      </div>
    </section>
  );
}
