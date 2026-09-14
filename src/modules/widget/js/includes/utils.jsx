// Loads fonts needed onto page.

function addHeadLink(rel, href, crossorigin) {
    const linkElement = document.createElement('link');
    linkElement.rel = rel;
    linkElement.href = href;
    if (crossorigin) {
        linkElement.crossOrigin = crossorigin;
    }
    document.head.appendChild(linkElement);
}

function fontHelper() {
    addHeadLink('preconnect', 'https://fonts.googleapis.com');
    addHeadLink('preconnect', 'https://fonts.gstatic.com', 'anonymous');
    addHeadLink('stylesheet', 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300..800&display=swap');
}

// Simple animation timing helper. Will need to use a better react animation library for more advanced work.
function animationHelper() {
    var startsWith = function(str, search, rawPos) {
        var pos = rawPos > 0 ? rawPos|0 : 0;
        return str.substring(pos, pos + search.length) === search;
    };
    document.addEventListener('animationstart', function (e) {
        if (startsWith(e.animationName, 'happytohelp-in')) {
            e.target.classList.add('happytohelp-in-complete');
        }
    });
    document.addEventListener('animationend', function (e) {
        if (startsWith(e.animationName, 'happytohelp-out')) {
            e.target.classList.remove('happytohelp-in-complete');
        }
    });
};

// Save the vh & vw using JS. Resolves problems with mobile browsers.
export function updateViewportProperties(shadowHost) {
    // Choose the target element: the shadow host if provided, otherwise the document root.
    const target = shadowHost || document.documentElement;

    // Retrieve the computed top margin of the parent window's body.
    const bodyStyle = window.getComputedStyle(document.body);
    const marginTop = parseFloat(bodyStyle.marginTop) || 0;

    // Get the viewport dimensions.
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;

    // Subtract the top margin from the height.
    const adjustedHeight = viewportHeight - marginTop;

    // Calculate the custom properties (1% of the effective dimensions) and round to 2 decimals.
    const vh = (adjustedHeight * 0.01).toFixed(2);
    const vw = (viewportWidth * 0.01).toFixed(2);

    // Set the CSS custom properties.
    target.style.setProperty('--vh', `${vh}px`);
    target.style.setProperty('--vw', `${vw}px`);
    target.style.setProperty('--offset-top', `${marginTop}px`);
}

// Handle viewport units
function styleHelper(shadowHost) {
    window.addEventListener('resize', () => {
        updateViewportProperties(shadowHost);
    });
    window.addEventListener('load', () => {
        updateViewportProperties(shadowHost)
    });
    updateViewportProperties(shadowHost);
};

export function initHelpers(shadowHost) {
    fontHelper();
    animationHelper();
    styleHelper(shadowHost);
};

let originalViewportContent = null;
let originalThemeContent = null;

// Add meta tags for open state
export function openMetaTags() {
    if(!window.matchMedia("(max-width: 768px)").matches) {
        return;
    }

    document.body.style.zoom = 1;
    window.scrollTo({ left: 0, behavior: 'instant' });

    let viewportMeta = document.querySelector("meta[name=viewport]");
    if (!viewportMeta) {
        // If no viewport meta tag exists, create one and mark that it didn’t originally exist
        viewportMeta = document.createElement("meta");
        viewportMeta.name = "viewport";
        document.head.appendChild(viewportMeta);
    } else {
        // Save the original content and mark that a tag did exist
        originalViewportContent = viewportMeta.content;
    }
    viewportMeta.content = "width=device-width, height=device-height, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-content";

    let themeMeta = document.querySelector("meta[name=theme-color]");
    if (!themeMeta) {
        // If no viewport meta tag exists, create one and mark that it didn’t originally exist
        themeMeta = document.createElement("meta");
        themeMeta.name = "theme-color";
        document.head.appendChild(themeMeta);
    } else {
        // Save the original content and mark that a tag did exist
        originalThemeContent = themeMeta.content;
    }
    themeMeta.content = "#ffffff";
}

// Remove or reset meta tags for closed state
export function closeMetaTags() {
    if(!window.matchMedia("(max-width: 768px)").matches) {
        return;
    }

    let viewportMeta = document.querySelector("meta[name=viewport]");
    if (viewportMeta) {
        if (originalViewportContent) {
            viewportMeta.content = originalViewportContent;
        } else {
            viewportMeta.remove();
        }
    }

    let themeMeta = document.querySelector("meta[name=theme-color]");
    if (themeMeta) {
        if (originalThemeContent) {
            themeMeta.content = originalThemeContent;
        } else {
            themeMeta.remove();
        }
    }
}
