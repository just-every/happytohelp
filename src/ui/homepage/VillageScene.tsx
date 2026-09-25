import { useVillageParallax } from './useVillageParallax';

export function VillageScene({ name, width, height, alt, priority = false }: { name: string; width: number; height: number; alt: string; priority?: boolean }) {
  const layered = name === 'hero' || name === 'context';
  const layerWidth = name === 'hero' ? 1672 : 1535;
  const layerHeight = name === 'hero' ? 941 : 1024;
  const sceneRef = useVillageParallax(layered, name === 'context' ? 4 : 8);
  return <div ref={sceneRef} className={`village-scene village-scene-${name}`} data-layered={layered || undefined}>
    <img className="art" src={`/homepage/village/${name}${layered ? '-background' : ''}.webp`} width={layered ? layerWidth : width} height={layered ? layerHeight : height} alt={alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />
    {layered && <img className="art scene-foreground" src={`/homepage/village/${name}-foreground.webp`} width={layerWidth} height={layerHeight} alt="" aria-hidden="true" loading={priority ? 'eager' : 'lazy'} decoding="async" />}
  </div>;
}
