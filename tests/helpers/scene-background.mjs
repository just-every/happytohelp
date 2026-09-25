// Resolves the CSS background image of a page's scenery element, fetches it from the page's own
// origin and decodes it, so a test proves the served background actually renders.
export function sceneBackground(page, selector) {
    return page.locator(selector).evaluate(async element => {
        const match = getComputedStyle(element).backgroundImage.match(/url\("?([^")]+)"?\)/);
        if (!match) return null;
        const url = new URL(match[1], location.href);
        const response = await fetch(url);
        const image = new Image();
        image.src = url.href;
        await image.decode();
        return { path: url.pathname, status: response.status, type: response.headers.get('content-type'), width: image.naturalWidth, height: image.naturalHeight };
    });
}
