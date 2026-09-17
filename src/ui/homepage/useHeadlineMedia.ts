import { useEffect, type RefObject } from 'react';

/** Keep the SVG video clip aligned with the browser's actual wrapped text. */
export function useHeadlineMedia(stageRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const heading = stage.querySelector('h1')!;
    const copy = stage.querySelector('#headline-copy')!;
    const clip = stage.querySelector('clipPath')!;
    const video = stage.querySelector('video')!;
    const frame = stage.querySelector<HTMLElement>('#headline-video-frame')!;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false;
    function syncMask() {
      if (disposed) return;
      const node = copy.firstChild;
      if (!node || !node.textContent) return;
      const origin = stage!.getBoundingClientRect(), style = getComputedStyle(heading);
      const lines: {top: number; left: number; text: string}[] = [];
      for (let i = 0; i < node.textContent.length; i++) {
        const range = document.createRange();
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        let line = lines.at(-1);
        if (!line || Math.abs(line.top - rect.top) > 1) {
          line = {top: rect.top, left: rect.left, text: ''}; lines.push(line);
        }
        line.text += node.textContent[i];
      }
      const baseline = stage!.querySelector('.baseline')!.getBoundingClientRect().top;
      const offset = baseline - lines.at(-1)!.top;
      clip.replaceChildren(...lines.map(line => {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.textContent = line.text.trimEnd();
        text.setAttribute('x', String(line.left - origin.left));
        text.setAttribute('y', String(line.top - origin.top + offset));
        for (const property of ['font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'font-stretch', 'font-kerning', 'font-feature-settings', 'font-variation-settings']) {
          text.style.setProperty(property, style.getPropertyValue(property));
        }
        return text;
      }));
    }
    const still = () => { frame.dataset.playing = 'false'; };
    const canPlay = () => !disposed && !motion.matches && document.visibilityState === 'visible';
    const play = async () => {
      if (!canPlay()) return;
      try { await video.play(); } catch { if (!disposed) still(); }
    };
    const playing = () => {
      if (!canPlay() || video.paused) return;
      syncMask(); frame.dataset.playing = 'true';
    };
    const restore = () => {
      syncMask();
      if (!canPlay()) { video.pause(); still(); }
      else if (video.paused) { still(); void play(); }
    };
    const observer = new ResizeObserver(syncMask);
    observer.observe(heading);
    document.fonts.ready.then(syncMask);
    document.fonts.addEventListener('loadingdone', syncMask);
    video.addEventListener('playing', playing);
    for (const event of ['pause', 'emptied', 'error', 'ended']) video.addEventListener(event, still);
    document.addEventListener('visibilitychange', restore);
    window.addEventListener('pageshow', restore);
    window.addEventListener('focus', restore);
    motion.addEventListener('change', restore);
    video.muted = true;
    syncMask(); void play();
    return () => {
      disposed = true; observer.disconnect(); video.pause();
      document.fonts.removeEventListener('loadingdone', syncMask);
      video.removeEventListener('playing', playing);
      for (const event of ['pause', 'emptied', 'error', 'ended']) video.removeEventListener(event, still);
      document.removeEventListener('visibilitychange', restore);
      window.removeEventListener('pageshow', restore);
      window.removeEventListener('focus', restore);
      motion.removeEventListener('change', restore);
    };
  }, [stageRef]);
}
