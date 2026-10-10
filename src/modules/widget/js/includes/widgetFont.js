// The embedded widget carries this licensed font with it, including on customer pages.
// The asset import inlines its font URL, so no customer host or third-party font service is needed.
import fontUrl from '../../../../../public/fonts/inter/InterVariable.woff2?inline';

export function loadWidgetFont() {
    const family = 'HappyToHelp Inter';
    // CSSOM serializes names containing spaces with surrounding quotes.
    if ([...document.fonts].some(face => face.family.replace(/^(["'])(.*)\1$/, '$2') === family)) return;
    const face = new FontFace(family, `url("${fontUrl}")`, {weight: '100 900', style: 'normal'});
    document.fonts.add(face);
    // CSS also initiates loading when text uses the face. A failed load remains observable
    // as FontFace.status === 'error' rather than an unhandled application rejection.
    face.load().catch(() => {});
}
