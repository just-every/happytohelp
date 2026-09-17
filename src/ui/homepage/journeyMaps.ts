// Selected artwork from the approved prototype journey-maps-data.json.
export const journeyMaps = {
  "hero": {
    "id": "hero-b",
    "src": "media/journey-maps/hero-b.png",
    "width": 1774,
    "height": 887,
    "opacity": 0.075,
    "invert": false
  },
  "crossing": {
    "id": "crossing-b",
    "src": "media/journey-maps/crossing-b-lines.png",
    "width": 1774,
    "height": 887,
    "opacity": 0.12,
    "invert": true
  },
  "watch": {
    "id": "watch-b",
    "src": "media/journey-maps/watch-b.png",
    "width": 1774,
    "height": 887,
    "opacity": 0.075,
    "invert": false
  },
  "agents": {
    "id": "agents-b",
    "src": "media/journey-maps/agents-b.png",
    "width": 1774,
    "height": 887,
    "opacity": 0.06,
    "invert": false
  },
  "ownership": {
    "id": "ownership-a",
    "src": "media/journey-maps/ownership-a-lines.png",
    "width": 1774,
    "height": 887,
    "opacity": 0.12,
    "invert": true
  }
} as const;

export type JourneyMapSection = keyof typeof journeyMaps;
