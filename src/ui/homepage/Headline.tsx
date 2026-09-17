import { useRef } from 'react';
import { useHeadlineMedia } from './useHeadlineMedia';
const still = '/homepage/media/beacon-positions/beacon-sculpted-toy-start.png';
export function Headline() {
  const stage = useRef<HTMLDivElement>(null);
  useHeadlineMedia(stage);
  return <div className="headline-stage" ref={stage}>
    <h1 id="headline" className="scene-still" style={{backgroundImage: `url('${still}')`}}>
      <span id="headline-copy">Help before they ask.</span><i className="baseline" aria-hidden="true" />
    </h1>
    <div id="headline-video-frame"><video poster={still} src="/homepage/media/beacon-positions/beacon-toy-loop.mp4" id="headline-video" muted loop playsInline preload="auto" aria-hidden="true" /></div>
    <svg className="mask-defs" aria-hidden="true"><defs><clipPath id="headline-clip" clipPathUnits="userSpaceOnUse" /></defs></svg>
  </div>;
}
