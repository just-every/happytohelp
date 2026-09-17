import type { CSSProperties } from "react";
import { journeyMaps, type JourneyMapSection } from "./journeyMaps";

export function JourneyMap({ section }: { section: JourneyMapSection }) {
  const map = journeyMaps[section];
  const image = (
    <img
      src={`/homepage/${map.src}`}
      alt=""
      width={map.width}
      height={map.height}
      decoding="async"
      loading={section === "hero" ? "eager" : "lazy"}
    />
  );

  return (
    <div
      className="journey-map-layer"
      data-map-section={section}
      data-map-id={map.id}
      data-invert={String(map.invert)}
      aria-hidden="true"
      style={{ "--map-opacity": map.opacity } as CSSProperties}
    >
      {image}
      {section === "watch" && image}
    </div>
  );
}
