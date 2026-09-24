import { VillageScene } from './VillageScene';
export const sourceUrl = 'https://github.com/runeditrun/support-happytohelp';
export const docsUrl = `${sourceUrl}/blob/main/README.md`;
export const installerUrl = `${sourceUrl}/blob/main/docs/INSTALLER.md`;

export function VillageHero() {
  return <section className="hero" id="top" aria-labelledby="hero-title">
    <VillageScene name="hero" width={3072} height={1728} alt="A procession follows a mountain river over a stone bridge toward a village, with beacon fires lighting the way." priority />
    <header><a className="brand" href="#top">HappyToHelp</a><nav aria-label="Main navigation"><a href={docsUrl}>Docs</a><a href={sourceUrl}>GitHub</a><a className="button" href={sourceUrl}>Get the code</a></nav></header>
    <div className="inner hero-copy"><h1 id="hero-title"><span>Support.</span> <span>Free.</span> <span>Yours.</span></h1><p>Stop building support for every project you create. HappyToHelp is completely free, MIT licensed, and implements the forefront of AI customer sales and support.</p></div>
  </section>;
}
