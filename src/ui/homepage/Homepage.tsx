import { VillageHero } from './VillageHero';
import { VillageIcons } from './VillageIcons';
import { VillageKnowledge } from './VillageKnowledge';
import { VillageWorkshops, VillageFooter } from './VillageWorkshops';
import './village.css';
import './village-workshops.css';
import './village-responsive.css';

export default function Homepage() {
  return <div className="h2h-village"><VillageIcons /><a className="village-skip" href="#features">Skip to features</a><main><VillageHero /><VillageKnowledge /><VillageWorkshops /></main><VillageFooter /></div>;
}
