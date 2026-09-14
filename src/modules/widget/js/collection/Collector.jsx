import TurndownService from "turndown";
import {cleanText, removePII} from "./Helper";
import { describeTarget, nameTags } from "./Describe";
import { HesitationDetector } from "./Hesitation";
import { lastAction, recordAction, setMessageHandler, setWidgetState, setCollectorEnabled, onAction, onReady } from "./Action";

export const captureEvents = [
    {type: "mousedown", action: "clicked on", clearAllTimers: true},
    {type: "contextmenu", action: "right clicked on", clearAllTimers: true},
    {type: "mouseover", action: "hovered over", timer: {name: "hover", timeout: 1000, clear: true}},
    {type: "mouseout", timer: {name: "hover", clear: true}},
    {type: "keydown", action: "typed in", timer: {name: "keydown", timeout: 1000, clear: true}},
    {type: "change", action: "set", timer: {name: "keydown", timeout: 100, clear: true}},
    {type: "invalid", action: "entered an invalid value"},
    {type: "submit", action: "submit a form", clearAllTimers: true},
];

const watchClasses = [
    ["error", "saw an error message"],
    ["success", "saw a success message"],
    ["alert-danger", "saw an error message"],
    ["alert-success", "saw a success message"],
    ["alert", "saw a message"],
    ["msg", "saw a message"],
];

let eventTimer = {};
let excludedElements = [];
let lastScrollY = 0;
let selectionTimer = null;
let lastEventTarget = null;

export const scrollAction = (direction, description = "") => (
    description
        ? `Scrolled ${direction} and may be looking at${description}`
        : `Scrolled ${direction}`
);

export const createSettledScrollScheduler = onSettled => {
    let timer = null;

    return () => {
        if(timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            timer = null;
            onSettled();
        }, 300);
    };
};

function recordEventAction(name, event) {
    if(excludedElements) {
        for(let i = 0; i < excludedElements.length; i++) {
            if(event.target === excludedElements[i] || excludedElements[i].contains(event.target)) return;
        }
    }

    // Check for events to ignore
    if(event.type === "scroll" && !event.isTrusted) {
        return;
    }
    if(event.target && ((event.target.classList && event.target.classList.contains("context-exclude")) || (event.target.closest && event.target.closest(".context-exclude")))) {
        return;
    }

    // Check for events to rewrite
    if(event.type === "keydown" && !event.key) {
        name = "auto-filled";
    }
    if(event.type === "change" && ["INPUT", "TEXTAREA"].includes(event.target.tagName) && !(event.target.type && ["radio"].includes(event.target.type.toLowerCase()))) {
        name = "entered";
    }
    if(event.type === "invalid" && event.target.validationMessage) {
        name = `saw an error message "${event.target.validationMessage}"`;
        if(event.target.value) {
            name += ` for`;
        }
        else {
            name += ` in`;
        }
    }

    if(lastEventTarget && event.type === "mouseover" && (lastEventTarget === event.target || lastEventTarget.contains(event.target) || event.target.contains(lastEventTarget))) return;

    let description = describeTarget(event);
    const action = name + description;
    if(!action || !description) return;
    lastEventTarget = event.target;

    if(event.type === "invalid") {
        recordAction("A form was submitted with invalid data");
    }
    recordAction(action);
}

/*
 * Record a DOM event
 */
function recordEvent(captureEvent, event) {
    let recorded = false;

    if(captureEvent.clearAllTimers) {
        for (const timerName in eventTimer) {
            if(eventTimer[timerName]) window.clearTimeout(eventTimer[timerName]);
        }
    }
    if(captureEvent.timer && captureEvent.timer.name) {
        if(captureEvent.timer.clear) {
            if(eventTimer[captureEvent.timer.name]) window.clearTimeout(eventTimer[captureEvent.timer.name]);
        }
        if(captureEvent.action && captureEvent.timer.timeout) {
            recorded = true;
            let timeout = captureEvent.timer.timeout;
            if(event.target.tagName in nameTags || (event.target.parentElement && event.target.parentElement.tagName in nameTags)) {
                timeout = timeout/3; // Shorten the timeout for known elements
            }
            eventTimer[captureEvent.timer.name] = window.setTimeout(() => {
                recordEventAction(captureEvent.action, event);
            }, timeout);
        }
    }

    if(!recorded && captureEvent.action) {
        recordEventAction(captureEvent.action, event);
    }
}

function observeEvents() {
    // We want to record relevant event for detecting what the user is doing to the website
    captureEvents.forEach((captureEvent) =>
        window.addEventListener(captureEvent.type, (event) => recordEvent(captureEvent, event), {capture: true, passive: true})
    );
}


function observeChanges() {

    const observer = new MutationObserver((mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.type === "childList") {
                watchLoop:
                for (const [className, msg] of watchClasses) {
                    if(mutation.target.classList.contains(className) && mutation.target.innerText) {
                        recordAction(msg+": "+cleanText(mutation.target.innerText));
                        break;
                    }
                    else if(mutation.addedNodes) {
                        for(let i = 0; i < mutation.addedNodes.length; i++) {
                            if (mutation.addedNodes[i].classList && mutation.addedNodes[i].classList.contains(className) && mutation.addedNodes[i].innerText) {
                                recordAction(msg+": " + cleanText(mutation.addedNodes[i].innerText));
                                break watchLoop;
                            }
                        }
                    }
                }
            } else if (mutation.type === "attributes") {
                //console.log(`The ${mutation.attributeName} attribute was modified.`, mutation);
            }
        }
    });

    observer.observe(document, { attributes: true, childList: true, subtree: true });
}

function recordScroll() {
    // Try to work out where the user is likely to be looking.

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY; // Current vertical scroll position
    const pageHeight = document.documentElement.scrollHeight; // Total page height
    const bottomOffset = pageHeight - (scrollY + viewportHeight); // Distance to the bottom of the page

    let adjustedCenterY = viewportHeight / 2;

    const scrollDiff = scrollY - lastScrollY;

    lastScrollY = scrollY;

    const direction = scrollDiff > 0 ? "down" : "up";

    if ((scrollY < viewportHeight / 4) || (bottomOffset < viewportHeight / 4)) {
        // The dedicated settled-scroll observer replaces the former generic
        // scroll listener. Retain a compact action when no page focus is useful.
        recordAction(scrollAction(direction));
        return;
    }

    // Adjust the center point based on proximity to the top or bottom
    if (scrollY < viewportHeight / 2) {
        // Near the top of the page, adjust the focus point downwards
        adjustedCenterY -= viewportHeight * 0.2; // Adjust up to 20% above the center
    } else if (bottomOffset < viewportHeight / 2) {
        // Near the bottom of the page, adjust the focus point upwards
        adjustedCenterY += viewportHeight * 0.2; // Adjust up to 20% below the center
    } else {
        // Middle of the page, adjust slightly above the center
        adjustedCenterY -= viewportHeight * 0.05; // 5% above the center
    }

    let centerX = viewportWidth / 2;

    // Get the element at the dynamically adjusted point
    let description = describeTarget({type: "scroll"}, document.elementFromPoint(centerX, adjustedCenterY));
    // If there's no suitable element, look right then left
    if(!description) {
        description = describeTarget({type: "scroll"}, document.elementFromPoint(centerX * 0.8, adjustedCenterY));
    }
    if(!description) {
        description = describeTarget({type: "scroll"}, document.elementFromPoint(centerX * 1.2, adjustedCenterY));
    }

    recordAction(scrollAction(direction, description));
}

function observeScroll() {
    const scheduleSettledScroll = createSettledScrollScheduler(recordScroll);
    window.addEventListener('scroll', scheduleSettledScroll, { passive: true });
}

function observeCommandEvents() {
    window.addEventListener('keydown', function(event) {
        // check if ctrl (or cmd on osx) + shift + F is pressed
        if ((event.ctrlKey || event.metaKey)) {
            if(event.key === "f") {
                recordAction("used the in-page search box");
            }
            else if(event.key === "c") {
                recordAction("copied selected text");
            }
            else if(event.key === "v") {
                recordAction("pasted from clipboard");
            }
            else if(event.key === "t") {
                recordAction("opened a new tab");
            }
            else if(event.key === "r") {
                recordAction("reloaded the page");
            }
        }
    })
}

function observeSelection() {
    document.addEventListener('selectionchange', (event) => {
        if(selectionTimer) window.clearTimeout(selectionTimer);

        selectionTimer = window.setTimeout(() => {
            // Get the current selection
            const selection = window.getSelection();

            // Check if there is any text selected
            if (selection && selection.rangeCount > 0) {
                const selectedText = selection.toString().trim();

                // If there's selected text, do something with it
                if (selectedText) {
                    recordAction(`Selected the text ${cleanText(selectedText)}`);
                }
            }
        }, 300);
    });
}

function observeRageClicks() {
    const CLICK_THRESHOLD = 4;     // Minimum number of clicks to consider a rage click session.
    const RAGE_TIMEOUT = 300;     // Wait time (in ms) after the last click before recording the event.

    let clickData = {
        lastTarget: null,
        count: 0,
        timer: null
    };

    document.addEventListener('click', function(event) {
        const target = event.target;

        // If the user clicks on a different element than before, first record the previous rage session (if any)
        if (target !== clickData.lastTarget) {
            // If the previous target had enough clicks, record the rage session.
            if (clickData.count >= CLICK_THRESHOLD) {
                let description = describeTarget({ target: clickData.lastTarget });
                if (description) {
                    description = ` on ${description}`;
                }
                recordAction(`Rage clicked ${clickData.count} times${description}`);
            }
            // Reset the count and timer for the new target.
            clickData.count = 0;
            clearTimeout(clickData.timer);
            clickData.timer = null;
            clickData.lastTarget = target;
        }

        // Increment the count for the current target.
        clickData.count++;

        // Restart the timeout timer so that after RAGE_TIMEOUT ms of inactivity the session is recorded.
        clearTimeout(clickData.timer);
        clickData.timer = setTimeout(() => {
            if (clickData.count >= CLICK_THRESHOLD) {
                let description = describeTarget({ target: clickData.lastTarget });
                if (description) {
                    description = ` on ${description}`;
                }
                recordAction(`Rage clicked ${clickData.count} times${description}`);
            }
            // Reset after recording.
            clickData.count = 0;
            clickData.timer = null;
        }, RAGE_TIMEOUT);
    });
}


function observeHesitation() {
    new HesitationDetector({
        sendMessage: recordAction,
        debug: false
    });
}

function getDomain(url) {
    try {
        return new URL(url).hostname; // Extracts the domain (hostname) from the URL
    } catch (e) {
        return null; // In case of an invalid URL
    }
}

let initialized = false;
function init() {
    if (initialized) return;
    initialized = true;
    if(document.referrer && getDomain(window.location.href) !== getDomain(document.referrer)) {
        // We usually won't get this information, but if we do, it's useful to know
        recordAction(`referred from ${document.referrer}`, false, true);
    }

    let pageInfo = [];
    if(window.location.href) pageInfo.push(window.location.href);
    if(document.title ) pageInfo.push(`titled ${cleanText(document.title)}`);

    observeEvents();
    observeCommandEvents();
    observeScroll();
    observeChanges();
    observeSelection();
    observeRageClicks();
    observeHesitation();

    var turndownService = new TurndownService({ bulletListMarker: '-' });
    turndownService.remove(['script', 'style', 'noscript', 'iframe', 'object', 'canvas', 'footer', 'nav', 'select']);

    let markdown;
    if(document.body.cloneNode) {
        const clonedBody = document.body.cloneNode(true);
        clonedBody.querySelectorAll('.context-exclude,.context-markdown-exclude').forEach(el => el.remove());
        markdown = turndownService.turndown(clonedBody);
    }
    else {
        markdown = turndownService.turndown(document.body);
    }

    markdown = markdown.replace(/\[[\s]+/g, "[").replace(/[\s]+\]/g, "]").trim();
    if(markdown) {
        pageInfo.push(`\n${removePII(markdown.trim())}`);
    }

    recordAction("visited page "+pageInfo.join(" ").trim(), false, true);
}

function excludeElement(element) {
    for(let i = 0; i < excludedElements.length; i++) {
        if(element === excludedElements[i]) return;
    }
    if(element) excludedElements.push(element);
}


const Collector = {
    init,
    excludeElement,
    recordAction,
    setMessageHandler,
    setWidgetState,
    setCollectorEnabled,
    lastAction,
    onAction,
    onReady,
}
export default Collector;
