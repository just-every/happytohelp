import type { VillageIconName } from './VillageIcons';

export function VillageFeature({ icon, title, children }: { icon: VillageIconName; title: string; children: React.ReactNode }) {
  return <article className="feature"><div className="badge" aria-hidden="true"><svg><use href={`#village-${icon}`} /></svg></div><div><h3>{title}</h3><p>{children}</p></div></article>;
}
