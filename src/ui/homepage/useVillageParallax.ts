import { useEffect, useRef } from 'react';

/** Motion changes composited layers only; it never participates in React rendering. */
export function useVillageParallax(enabled: boolean, movement = 8) {
  const sceneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !enabled) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let listening = false;
    let frame = 0;
    const render = () => {
      frame = 0;
      const progress = Math.max(-1, Math.min(1, -scene.getBoundingClientRect().top / window.innerHeight));
      scene.style.setProperty('--scene-x', `${(progress * movement * .375).toFixed(2)}px`);
      scene.style.setProperty('--scene-y', `${(progress * movement).toFixed(2)}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
    const stop = () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
      frame = 0;
      listening = false;
    };
    const sync = () => {
      if (preference.matches || !visible) {
        stop();
        scene.dataset.parallaxState = preference.matches ? 'reduced' : 'offscreen';
        if (preference.matches) {
          scene.style.removeProperty('--scene-x');
          scene.style.removeProperty('--scene-y');
        }
        return;
      }
      if (!listening) {
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        listening = true;
      }
      scene.dataset.parallaxState = 'active';
      schedule();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(scene);
    preference.addEventListener('change', sync);
    sync();
    return () => { observer.disconnect(); preference.removeEventListener('change', sync); stop(); };
  }, [enabled, movement]);
  return sceneRef;
}
