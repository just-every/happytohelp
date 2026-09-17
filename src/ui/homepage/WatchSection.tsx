import { JourneyMap } from "./JourneyMap";

export function WatchSection() {
  return (
    <section className="home-section light watch" id="watch" aria-labelledby="watch-title">
      <JourneyMap section="watch" />
      <div className="section-inner watch-grid">
        <div className="section-copy">
          <div className="section-marker">03</div>
          <h2 id="watch-title">Keep watch as your site changes.</h2>
          <p>Your product keeps moving. New pages go live, features change and yesterday’s answer can fall out of date. Connect your website and help content so your support knowledge can move with them.</p>
          <p>Refresh content on a schedule that suits your team, and review new versions before they replace published knowledge. Keep useful answers connected to what your customers actually see.</p>
        </div>
        <ol className="update-flow">
          <li className="update-row">
            <div className="square">
              <svg className="icon" aria-hidden="true" focusable="false">
                <use href="#home-icon-doc">
                </use>
              </svg>
            </div>
            <div>
              <h3>Published</h3>
              <p>Your current, usable knowledge.</p>
            </div>
          </li>
          <li className="update-row">
            <div className="square">
              <svg className="icon" aria-hidden="true" focusable="false">
                <use href="#home-icon-refresh">
                </use>
              </svg>
            </div>
            <div>
              <h3>Refresh</h3>
              <p>Bring in new or changed source content.</p>
            </div>
          </li>
          <li className="update-row">
            <div className="square">
              <svg className="icon" aria-hidden="true" focusable="false">
                <use href="#home-icon-search">
                </use>
              </svg>
            </div>
            <div>
              <h3>Review &amp; publish</h3>
              <p>Check the new version before replacing published knowledge.</p>
            </div>
          </li>
        </ol>
        <figure className="section-art">
          <img src="/homepage/media/human-story-options/watch-a-sculpted.png" alt="A cloaked traveler keeping watch from a stone window, rendered as a matte sculpture." loading="lazy" />
        </figure>
        <p className="section-note">A failed refresh keeps the last usable published version in place.</p>
      </div>
    </section>
  );
}
