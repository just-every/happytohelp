import { describeTarget } from "./Describe";

// Elements the host site marks as private context, as the collector itself skips them.
const excluded = element => Boolean(element?.closest?.(".context-exclude"));

export class HesitationDetector {
    constructor(options) {
        // Default options
        this.options = {
            sendMessage: () => {},
            debug: false,
            // Thresholds
            exitIntentThreshold: 5, // px from top
            hoverThreshold: 3000, // ms
            ctaHoverThreshold: 2000, // ms
            idleThreshold: 30000, // ms
            formFieldHesitationThreshold: 3000, // ms
            erraticMovementThreshold: 12, // direction changes (increased from 8)
            erraticMovementTimeWindow: 3000, // ms (increased from 2000)
            erraticMovementMinTimeOnPage: 5000, // ms before starting detection
            ctaProximityThreshold: 100, // px distance to consider "near" a CTA
            messageCooldown: 10000, // ms between duplicate messages
            ...options
        };

        this.destroyed = false;
        this.timers = new Set();
        this.proximityReports = new WeakMap();
        // Internal state
        this.lastActivityTime = Date.now();
        this.lastMousePosition = { x: 0, y: 0 };
        this.mouseMovements = [];
        this.formFocusTime = null;
        this.currentFocusedElement = null;
        this.formCompletions = new Map();
        this.hoverTimers = new Map();
        this.lastScrollY = window.scrollY;
        this.scrollDirection = null;
        this.scrollChangeCount = 0;
        this.lastScrollTime = Date.now();
        this.pageVisitHistory = [];
        this.cartViewCount = 0;
        this.fieldRefocusCount = new Map();
        this.idleTimer = null;
        this.ctaElements = [];
        this.currentHoveredCTA = null;
        this.mutationObserver = null;
        this.pageLoadTime = Date.now();
        this.sentMessages = new Map(); // Track sent messages and timestamps
        this.idleEpisodeReported = false;
        this.eventHandlers = {
            mousemove: this.handleMouseMove.bind(this),
            userActivity: this.handleUserActivity.bind(this),
            scroll: this.handleScroll.bind(this),
            formFocus: this.handleFormFocus.bind(this),
            formBlur: this.handleFormBlur.bind(this),
            formInput: this.handleFormInput.bind(this),
            formError: this.handleFormError.bind(this),
            visibilityChange: this.handleVisibilityChange.bind(this),
            beforeUnload: this.handleBeforeUnload.bind(this),
            popState: this.handlePopState.bind(this),
            mouseover: this.handleMouseOver.bind(this),
            mouseout: this.handleMouseOut.bind(this),
            cartClick: this.handleCartClick.bind(this),
        };

        this.init();
    }

    schedule(callback, delay) {
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            if (!this.destroyed) callback();
        }, delay);
        this.timers.add(timer);
        return timer;
    }

    cancel(timer) {
        clearTimeout(timer);
        this.timers.delete(timer);
    }

    log(message) {
        if (this.options.debug) {
            console.log(`[HesitationDetector] ${message}`);
        }
    }

    sendHesitationMessage(message) {
        if (this.destroyed) return;
        // Check if the same message was sent recently
        const now = Date.now();
        const lastSent = this.sentMessages.get(message);

        if (lastSent && (now - lastSent < this.options.messageCooldown)) {
            // Skip sending duplicate message during cooldown period
            this.log(`Skipped duplicate message (cooldown): ${message}`);
            return;
        }

        this.log(message);
        this.options.sendMessage(message);
        this.sentMessages.set(message, now);
    }

    init() {
        // Track current page
        this.recordPageVisit(window.location.pathname);

        // Find and store CTAs on the page for hover detection
        this.findCTAs();

        // Set up event listeners
        document.addEventListener('mousemove', this.eventHandlers.mousemove, { passive: true });
        document.addEventListener('click', this.eventHandlers.userActivity, { passive: true });
        document.addEventListener('keydown', this.eventHandlers.userActivity, { passive: true });
        document.addEventListener('scroll', this.eventHandlers.scroll, { passive: true });

        // Form interactions
        document.addEventListener('focus', this.eventHandlers.formFocus, true);
        document.addEventListener('blur', this.eventHandlers.formBlur, true);
        document.addEventListener('input', this.eventHandlers.formInput, true);
        document.addEventListener('invalid', this.eventHandlers.formError, true);

        // Page visibility and unload
        document.addEventListener('visibilitychange', this.eventHandlers.visibilityChange);
        window.addEventListener('beforeunload', this.eventHandlers.beforeUnload);
        window.addEventListener('popstate', this.eventHandlers.popState);

        // Mouse over CTAs
        document.addEventListener('mouseover', this.eventHandlers.mouseover, { passive: true });
        document.addEventListener('mouseout', this.eventHandlers.mouseout, { passive: true });

        // Set up mutation observer to detect DOM changes
        this.setupMutationObserver();

        // Start idle timer
        this.resetIdleTimer();

        // Monitor cart buttons
        this.setupCartMonitoring();

        this.log('Hesitation detector initialized');
    }

    resetIdleTimer() {
        this.clearIdleTimer();

        if (document.hidden || this.idleEpisodeReported) {
            return;
        }

        const idleDelay = Math.max(0, this.options.idleThreshold - (Date.now() - this.lastActivityTime));

        this.idleTimer = this.schedule(() => {
            this.idleTimer = null;

            if (document.hidden || this.idleEpisodeReported) {
                return;
            }

            const idleTime = Date.now() - this.lastActivityTime;
            if (idleTime < this.options.idleThreshold) {
                this.resetIdleTimer();
                return;
            }

            this.idleEpisodeReported = true;
            this.sendHesitationMessage(`Detected extended inactivity (${Math.round(idleTime / 1000)} seconds without interaction) - user may be hesitating`);
        }, idleDelay);
    }

    clearIdleTimer() {
        if (this.idleTimer !== null) {
            this.cancel(this.idleTimer);
            this.idleTimer = null;
        }
    }

    handleUserActivity() {
        this.lastActivityTime = Date.now();
        this.idleEpisodeReported = false;
        this.resetIdleTimer();
    }

    handleMouseMove(event) {
        this.handleUserActivity();

        const currentPosition = {
            x: event.clientX,
            y: event.clientY,
            time: Date.now()
        };

        // Exit intent detection
        if (currentPosition.y <= this.options.exitIntentThreshold && this.lastMousePosition.y > 50) {
            const speed = this.calculateMouseSpeed(this.lastMousePosition, currentPosition);
            if (speed > 0.5) { // Fast upward movement
                this.sendHesitationMessage("Detected exit intent - cursor rapidly moved to top of page");
            }
        }

        // Store mouse movement for erratic movement detection
        this.mouseMovements.push(currentPosition);
        this.cleanupOldMouseMovements();
        this.detectErraticMovement();

        // Check for proximity to CTAs without directly hovering
        this.checkCTAProximity(currentPosition);

        this.lastMousePosition = currentPosition;
    }

    findCTAs() {
        // Clear existing CTAs
        this.ctaElements = [];

        // Find elements that are likely to be CTAs (calls to action) based on their appearance and structure
        // Button elements
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));

        // Links that look like buttons
        const buttonLinks = Array.from(document.querySelectorAll('a.btn, a.button, a[class*="btn-"], a[class*="button-"], a[role="button"]'));

        // Elements with button-like classes
        const buttonClasses = Array.from(document.querySelectorAll('.btn, .button, [class*="btn-"], [class*="button-"], [class*="cta"], [class*="checkout"], [class*="add-to-cart"]'));

        // Checkout/purchase related buttons
        const checkoutButtons = Array.from(document.querySelectorAll('[class*="checkout"], [class*="pay"], [class*="purchase"], [class*="buy"], [class*="add-to-cart"]'));

        // Combine all potential CTAs and filter out duplicates
        const allPotentialCTAs = [...buttons, ...buttonLinks, ...buttonClasses, ...checkoutButtons];

        // Remove duplicates, the site's context-exclude regions and hidden elements
        this.ctaElements = Array.from(new Set(allPotentialCTAs)).filter(element => {
            if (excluded(element)) return false;
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 &&
                rect.height > 0 &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                element.offsetParent !== null; // Element is visible
        });

        this.log(`Found ${this.ctaElements.length} potential CTAs on the page`);
    }

    checkCTAProximity(mousePosition) {
        if (this.ctaElements.length === 0) return;

        // Check if mouse is near any CTA but not hovering directly
        for (const cta of this.ctaElements) {
            const rect = cta.getBoundingClientRect();

            // Calculate center of CTA
            const ctaCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };

            // Calculate distance to CTA center
            const distance = Math.sqrt(
                Math.pow(mousePosition.x - ctaCenter.x, 2) +
                Math.pow(mousePosition.y - ctaCenter.y, 2)
            );

            // Check if mouse is near but not over the CTA
            if (distance < this.options.ctaProximityThreshold &&
                !(mousePosition.x >= rect.left && mousePosition.x <= rect.right &&
                    mousePosition.y >= rect.top && mousePosition.y <= rect.bottom)) {

                const ctaDescription = describeTarget({ target: cta });

                // Only send once per CTA with a cooldown
                if (!this.proximityReports.has(cta) || Date.now() - this.proximityReports.get(cta) > 10000) {
                    this.sendHesitationMessage(`Mouse lingering near ${ctaDescription} without clicking - user may be hesitating`);
                    this.proximityReports.set(cta, Date.now());
                }

                break; // Only report one proximity at a time
            }
        }
    }

    handleMouseOver(event) {
        const target = event.target;

        // Check if the hovered element is a CTA
        if (this.ctaElements.includes(target)) {
            this.currentHoveredCTA = target;

            // Start a hover timer
            if (!this.hoverTimers.has(target)) {
                const timerId = this.schedule(() => {
                    const ctaDescription = describeTarget({ target });
                    this.sendHesitationMessage(`User hovered over ${ctaDescription} for ${this.options.ctaHoverThreshold / 1000} seconds without clicking - showing purchase hesitation`);
                }, this.options.ctaHoverThreshold);

                this.hoverTimers.set(target, timerId);
            }
        }
    }

    handleMouseOut(event) {
        const target = event.target;

        // Clear hover timer if mouse leaves a CTA
        if (this.hoverTimers.has(target)) {
            this.cancel(this.hoverTimers.get(target));
            this.hoverTimers.delete(target);

            if (this.currentHoveredCTA === target) {
                this.currentHoveredCTA = null;
            }
        }
    }

    calculateMouseSpeed(pos1, pos2) {
        const distance = Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
        const timeGap = pos2.time - pos1.time;
        return timeGap > 0 ? distance / timeGap : 0;
    }

    cleanupOldMouseMovements() {
        const now = Date.now();
        const cutoffTime = now - this.options.erraticMovementTimeWindow;
        this.mouseMovements = this.mouseMovements.filter(move => move.time >= cutoffTime);
    }

    detectErraticMovement() {
        // Don't detect erratic movements until user has been on page for a minimum time
        const timeOnPage = Date.now() - this.pageLoadTime;
        if (timeOnPage < this.options.erraticMovementMinTimeOnPage) {
            return;
        }

        // Need a minimum number of data points for meaningful analysis
        if (this.mouseMovements.length < 10) {
            return;
        }

        let directionChanges = 0;
        let prevDirection = null;
        let totalDistance = 0;

        for (let i = 1; i < this.mouseMovements.length; i++) {
            const prev = this.mouseMovements[i-1];
            const curr = this.mouseMovements[i];

            // Calculate distance moved
            const distance = Math.sqrt(
                Math.pow(curr.x - prev.x, 2) +
                Math.pow(curr.y - prev.y, 2)
            );

            totalDistance += distance;

            // Only count direction changes for moves with some minimum distance
            // to avoid counting tiny jitters
            if (distance < 5) continue;

            // Calculate angle of movement
            const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
            const sector = Math.floor((angle + Math.PI) / (Math.PI / 4));

            if (prevDirection !== null && sector !== prevDirection) {
                directionChanges++;
            }

            prevDirection = sector;
        }

        // Require a minimum total distance moved to qualify as erratic
        // This helps filter out small confined movements
        if (totalDistance > 300 && directionChanges >= this.options.erraticMovementThreshold) {
            this.sendHesitationMessage("Detected erratic mouse movements - user may be confused or anxious");
            // Clear the movements to avoid duplicate detections
            this.mouseMovements = [];
        }
    }

    handleScroll(event) {
        this.handleUserActivity();

        const currentScrollY = window.scrollY;
        const currentTime = Date.now();
        const timeDiff = currentTime - this.lastScrollTime;

        // Determine scroll direction
        const newDirection = currentScrollY > this.lastScrollY ? 'down' : 'up';

        // Check for direction change
        if (this.scrollDirection !== null && newDirection !== this.scrollDirection) {
            this.scrollChangeCount++;

            // Check for oscillation (scrolling up and down repeatedly)
            if (this.scrollChangeCount >= 3 && timeDiff < 2000) {
                this.sendHesitationMessage("Detected repeated scroll direction changes - user may be looking for specific information");
                this.scrollChangeCount = 0;
            }
        }

        // Check scroll speed
        const scrollDistance = Math.abs(currentScrollY - this.lastScrollY);
        const scrollSpeed = timeDiff > 0 ? scrollDistance / timeDiff : 0;

        // Unusually fast scrolling (skimming)
        if (scrollSpeed > 2 && scrollDistance > window.innerHeight) {
            this.sendHesitationMessage("Detected unusually fast scrolling - user may be skimming or searching for information");
        }

        // Unusually slow scrolling (careful reading)
        if (scrollSpeed > 0 && scrollSpeed < 0.05 && timeDiff > 1000 && scrollDistance > 50) {
            this.sendHesitationMessage("Detected unusually slow scrolling - user may be carefully reading content");
        }

        this.scrollDirection = newDirection;
        this.lastScrollY = currentScrollY;
        this.lastScrollTime = currentTime;
    }

    handleFormFocus(event) {
        const element = event.target;

        if (this.isFormInputElement(element)) {
            this.handleUserActivity();
            this.formFocusTime = Date.now();
            this.currentFocusedElement = element;

            // Track re-focus on same field
            const fieldId = this.getFieldIdentifier(element);
            const focusCount = this.fieldRefocusCount.get(fieldId) || 0;

            if (focusCount > 0) {
                this.sendHesitationMessage(`User refocused on field ${this.describeField(element)} - may be uncertain about input`);
            }

            this.fieldRefocusCount.set(fieldId, focusCount + 1);

            // Start hover timer for key fields
            if (this.isImportantField(element)) {
                this.cancel(this.hoverTimers.get(element));
                const fieldDesc = this.describeField(element);
                const timerId = this.schedule(() => {
                    if (this.currentFocusedElement === element) {
                        this.sendHesitationMessage(`User has been focused on ${fieldDesc} for ${this.options.formFieldHesitationThreshold / 1000} seconds without typing - may be hesitating`);
                    }
                }, this.options.formFieldHesitationThreshold);

                this.hoverTimers.set(element, timerId);
            }
        }
    }

    handleFormBlur(event) {
        const element = event.target;

        if (this.isFormInputElement(element)) {
            this.handleUserActivity();
            this.formFocusTime = null;
            this.currentFocusedElement = null;

            // Clear any hover timers
            if (this.hoverTimers.has(element)) {
                this.cancel(this.hoverTimers.get(element));
                this.hoverTimers.delete(element);
            }

            // Mark field as completed if it has a value
            if (element.value) {
                const fieldId = this.getFieldIdentifier(element);
                this.formCompletions.set(fieldId, element.value);
            }
        }
    }

    handleFormInput(event) {
        const element = event.target;

        if (this.isFormInputElement(element)) {
            this.handleUserActivity();

            // Clear hover timer as user has started typing
            if (this.hoverTimers.has(element)) {
                this.cancel(this.hoverTimers.get(element));
                this.hoverTimers.delete(element);
            }

            // Check if previously completed field is being changed
            const fieldId = this.getFieldIdentifier(element);
            if (this.formCompletions.has(fieldId)) {
                const previousValue = this.formCompletions.get(fieldId);
                if (element.value !== previousValue && element.value.length > 0) {
                    this.sendHesitationMessage(`User is changing previously entered data in ${this.describeField(element)} - may be uncertain about input`);
                }
            }
        }
    }

    handleFormError(event) {
        this.handleUserActivity();

        const element = event.target;
        const message = element.validationMessage || "unknown error";

        this.sendHesitationMessage(`Form validation error: "${message}" on ${this.describeField(element)} - may cause user hesitation`);

        // Start a timer to check for post-error pause
        this.schedule(() => {
            const timeSinceActivity = Date.now() - this.lastActivityTime;
            if (timeSinceActivity > 5000) {
                this.sendHesitationMessage(`User paused for ${Math.round(timeSinceActivity / 1000)} seconds after form error - may be confused or stuck`);
            }
        }, 5000);
    }

    setupCartMonitoring() {
        // Monitor clicks on cart buttons and checkout elements based on structure and classes
        document.addEventListener('click', this.eventHandlers.cartClick);
    }

    handleCartClick(event) {
        // Use structure to identify cart elements
        // Look for elements that visually appear to be cart-related
        const isCartIcon = event.target.closest('svg, img, i')?.classList.contains('fa-shopping-cart', 'cart-icon');

        // Look for cart-like elements based on structure rather than specific text
        const cartElement = event.target.closest('header button, nav button, .header button, [aria-label]');

        // Detect cart viewing using visual cues and structure
        if ((isCartIcon || (cartElement && this.looksLikeCartElement(cartElement))) &&
            !this.looksLikeCheckoutButton(event.target)) {

            this.cartViewCount++;

            if (this.cartViewCount >= 3) {
                this.sendHesitationMessage(`User has viewed cart ${this.cartViewCount} times without checking out - showing strong purchase hesitation`);
            }
        }
    }

    looksLikeCartElement(element) {
        // Check for visual indicators that this is a cart button
        if (!element) return false;

        // Check if element has an icon that looks like a cart
        const hasCartIcon = element.querySelector('svg, i, img');

        // Check if the element or its children have cart-like classes
        const hasCartClass = element.classList.contains('cart') ||
            Array.from(element.classList).some(cls => cls.includes('cart')) ||
            element.id.includes('cart');

        // Check aria attributes that might indicate a cart
        const ariaLabel = element.getAttribute('aria-label') || '';
        const hasCartAriaLabel = ariaLabel.toLowerCase().includes('cart') ||
            ariaLabel.toLowerCase().includes('basket') ||
            ariaLabel.toLowerCase().includes('bag');

        return hasCartIcon || hasCartClass || hasCartAriaLabel;
    }

    looksLikeCheckoutButton(element) {
        if (!element) return false;

        // Check for visual cues that this is a checkout button
        const el = element.closest('button, a, [role="button"]');
        if (!el) return false;

        // Check classes and attributes
        const hasCheckoutClass = el.classList.contains('checkout') ||
            Array.from(el.classList).some(cls => cls.includes('checkout')) ||
            el.id.includes('checkout');

        // Check if it's styled like a primary action button
        const isPrimaryButton = el.classList.contains('primary') ||
            el.classList.contains('btn-primary') ||
            el.getAttribute('type') === 'submit';

        // Check if it's in a cart context
        const isInCartContext = el.closest('[class*="cart"], [id*="cart"]');

        return (hasCheckoutClass || (isPrimaryButton && isInCartContext));
    }

    setupMutationObserver() {
        // Set up mutation observer to detect dynamic changes to the page
        this.mutationObserver = new MutationObserver((mutations) => {
            // Check if DOM has changed significantly, which might indicate a new page/view
            let significantChanges = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if significant elements were added
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node;

                            // Check if a major UI component was added (like a modal, overlay, new page)
                            if (element.tagName === 'DIV' &&
                                (element.classList.contains('modal') ||
                                    element.classList.contains('overlay') ||
                                    element.classList.contains('page') ||
                                    element.style.position === 'fixed' ||
                                    element.style.position === 'absolute')) {

                                significantChanges = true;
                                break;
                            }
                        }
                    }
                }

                if (significantChanges) break;
            }

            if (significantChanges) {
                // Refresh CTAs after DOM changes
                this.schedule(() => this.findCTAs(), 300);

                // Check if this might be a cart or checkout view
                const potentialCartView = document.querySelector('.cart, .basket, .bag, [class*="cart-"], [id*="cart"]');
                if (potentialCartView) {
                    this.cartViewCount++;

                    if (this.cartViewCount >= 3) {
                        this.sendHesitationMessage(`User has viewed cart ${this.cartViewCount} times - showing purchase hesitation`);
                    }
                }
            }
        });

        // Start observing
        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    handleVisibilityChange() {
        if (document.hidden) {
            this.clearIdleTimer();

            // Page is hidden (user switched tabs)
            this.sendHesitationMessage("User switched away from page - may be comparing products or prices elsewhere");
        } else {
            // Page is visible again
            this.handleUserActivity();
        }
    }

    handleBeforeUnload(event) {
        // Check if user is leaving during checkout
        if (this.isCheckoutPage()) {
            this.sendHesitationMessage("User is leaving during checkout process - strong abandonment signal");
        }
    }

    handlePopState(event) {
        // Track the new page after navigation
        this.recordPageVisit(window.location.pathname);

        // Check for checkout abandonment
        if (this.pageVisitHistory.length >= 2) {
            const currentPage = this.pageVisitHistory[this.pageVisitHistory.length - 1];
            const previousPage = this.pageVisitHistory[this.pageVisitHistory.length - 2];

            if (this.isBacktracking(currentPage, previousPage)) {
                this.sendHesitationMessage(`User navigated backwards in the funnel from ${previousPage} to ${currentPage} - showing purchase hesitation`);
            }
        }
    }

    recordPageVisit(path) {
        this.pageVisitHistory.push(path);

        // If user is viewing a new page, reset activity timer
        this.handleUserActivity();
    }

    isBacktracking(currentPage, previousPage) {
        // Since we don't want to rely on URL patterns, we'll use heuristics based on
        // the page history context and timing

        // If the user goes back in a short time frame, consider it backtracking
        const isQuickReturn = this.pageVisitHistory.length >= 3 &&
            (Date.now() - this.lastActivityTime < 10000);

        // Check if the current page appears to be a step backward in a typical checkout flow
        // This is an approximate heuristic without relying on URLs
        if (isQuickReturn) {
            return true;
        }

        // For multi-page checkout flows, detect using document.referrer
        // This assumes the current structure detection can tell us if we're on a checkout or cart page
        const currentPageType = this.detectCurrentPageType();
        const previousPageType = this.detectPageTypeFromHistory(previousPage);

        // Moving backward in the flow is considered backtracking
        return this.isMovingBackward(currentPageType, previousPageType);
    }

    detectCurrentPageType() {
        // Detect the type of current page based on its structure
        if (this.hasPaymentElements()) {
            return 'payment';
        } else if (this.hasShippingElements()) {
            return 'shipping';
        } else if (this.hasCartElements()) {
            return 'cart';
        } else if (this.hasCheckoutElements()) {
            return 'checkout';
        } else if (this.hasProductElements()) {
            return 'product';
        }
        return 'unknown';
    }

    detectPageTypeFromHistory(path) {
        // This is a best-effort guess at the previous page type
        // In a real implementation, you would store more than just the path
        // when recording page visits

        if (path.includes('payment') || path.includes('billing')) {
            return 'payment';
        } else if (path.includes('shipping') || path.includes('delivery')) {
            return 'shipping';
        } else if (path.includes('cart') || path.includes('basket') || path.includes('bag')) {
            return 'cart';
        } else if (path.includes('checkout')) {
            return 'checkout';
        } else if (path.includes('product') || path.includes('item') || path.includes('detail')) {
            return 'product';
        }
        return 'unknown';
    }

    isMovingBackward(currentType, previousType) {
        // Define the typical checkout flow order
        const flowOrder = ['product', 'cart', 'checkout', 'shipping', 'payment', 'confirmation'];

        const currentIndex = flowOrder.indexOf(currentType);
        const previousIndex = flowOrder.indexOf(previousType);

        // If we can't determine the page types, don't assume backtracking
        if (currentIndex === -1 || previousIndex === -1) {
            return false;
        }

        // Moving to an earlier step in the flow
        return currentIndex < previousIndex;
    }

    hasPaymentElements() {
        return !!document.querySelector(
            'input[name*="card"], input[autocomplete*="cc-"], ' +
            '[class*="payment"], [class*="credit-card"], ' +
            'input[name*="cvv"], input[name*="cvc"]'
        );
    }

    hasShippingElements() {
        return !!document.querySelector(
            'input[name*="address"], input[name*="zip"], ' +
            'input[name*="postal"], input[name*="city"], ' +
            'select[name*="country"], [class*="shipping"]'
        ) && !this.hasPaymentElements();
    }

    hasCartElements() {
        return !!document.querySelector(
            '.cart, .basket, .bag, [class*="cart-"], ' +
            '[id*="cart"], [class*="cart-item"], ' +
            '.shopping-bag, .shopping-cart'
        ) && !this.hasCheckoutElements();
    }

    hasCheckoutElements() {
        return !!document.querySelector(
            'form.checkout, #checkout, .checkout-form, ' +
            '[class*="checkout-"], [class*="checkout_"], ' +
            '.order-summary, .order-review'
        ) && !this.hasPaymentElements() && !this.hasShippingElements();
    }

    hasProductElements() {
        return !!document.querySelector(
            '.product, .product-detail, .item-detail, ' +
            '[class*="product-"], [itemtype*="Product"], ' +
            '.buy-now, .add-to-cart, [class*="product-gallery"]'
        );
    }

    isCheckoutPage() {
        // Use page structure to detect if we're on a checkout-like page
        // Look for common checkout page elements and structures

        // Check for checkout forms
        const hasCheckoutForm = !!document.querySelector('form#checkout, form.checkout, form[name="checkout"]');

        // Check for payment input fields
        const hasPaymentInputs = !!document.querySelector('input[name*="card"], input[autocomplete*="cc-"], [class*="credit-card"]');

        // Check for shipping/address fields
        const hasAddressFields = !!document.querySelector(
            'input[name*="address"], input[name*="zip"], input[name*="postal"], ' +
            'input[name*="city"], input[name*="state"], input[name*="country"]'
        );

        // Check for cart summary elements
        const hasCartSummary = !!document.querySelector(
            '.cart-summary, .order-summary, [class*="cart-items"], ' +
            '[class*="basket-summary"], [class*="order-details"]'
        );

        // Check for checkout steps/progress indicators
        const hasCheckoutProgress = !!document.querySelector(
            '.checkout-steps, .progress-indicator, [class*="checkout-progress"], ' +
            '[class*="steps-"], [class*="step-indicator"]'
        );

        // Look for checkout headings or titles
        const checkoutHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, .title'));
        const hasCheckoutTitle = checkoutHeadings.some(heading => {
            const text = heading.textContent.toLowerCase();
            return text.includes('checkout') || text.includes('payment') ||
                text.includes('shipping') || text.includes('order') ||
                text.includes('billing') || text.includes('delivery');
        });

        return hasCheckoutForm || hasPaymentInputs || (hasAddressFields && hasCartSummary) ||
            hasCheckoutProgress || hasCheckoutTitle;
    }

    // Helper methods
    isFormInputElement(element) {
        if (!element) return false;

        const tag = element.tagName.toLowerCase();
        return (tag === 'input' && !['button', 'submit', 'reset', 'hidden', 'checkbox', 'radio'].includes(element.type)) ||
            tag === 'textarea' ||
            tag === 'select';
    }

    isImportantField(element) {
        if (!element) return false;

        // Check if it's a payment-related or critical field
        const fieldId = (element.id || '').toLowerCase();
        const fieldName = (element.name || '').toLowerCase();
        const fieldType = (element.type || '').toLowerCase();
        const placeholder = (element.placeholder || '').toLowerCase();

        const criticalTerms = ['card', 'credit', 'payment', 'ccv', 'cvc', 'cvv', 'security', 'expir',
            'email', 'phone', 'address', 'zip', 'postal', 'name', 'coupon', 'promo'];

        return criticalTerms.some(term =>
            fieldId.includes(term) ||
            fieldName.includes(term) ||
            fieldType === term ||
            placeholder.includes(term)
        );
    }

    getFieldIdentifier(element) {
        return element.id || element.name || element.placeholder || `input-${element.type}-${Array.from(document.querySelectorAll(element.tagName)).indexOf(element)}`;
    }

    describeField(element) {
        if (!element) return "unknown field";
        // A field inside a context-exclude region is never described by its labels or text.
        if (excluded(element)) return "an excluded field";

        // Use the imported describeTarget function
        const description = describeTarget({ target: element });
        if (description && description.trim()) {
            return description.trim();
        }

        // Fall back if describeTarget doesn't return a useful description
        return `${element.type || 'text'} field`;
    }

    // Clean up when no longer needed
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
        // Remove all event listeners
        document.removeEventListener('mousemove', this.eventHandlers.mousemove);
        document.removeEventListener('click', this.eventHandlers.userActivity);
        document.removeEventListener('keydown', this.eventHandlers.userActivity);
        document.removeEventListener('scroll', this.eventHandlers.scroll);
        document.removeEventListener('focus', this.eventHandlers.formFocus, true);
        document.removeEventListener('blur', this.eventHandlers.formBlur, true);
        document.removeEventListener('input', this.eventHandlers.formInput, true);
        document.removeEventListener('invalid', this.eventHandlers.formError, true);
        document.removeEventListener('visibilitychange', this.eventHandlers.visibilityChange);
        document.removeEventListener('mouseover', this.eventHandlers.mouseover);
        document.removeEventListener('mouseout', this.eventHandlers.mouseout);
        document.removeEventListener('click', this.eventHandlers.cartClick);
        window.removeEventListener('beforeunload', this.eventHandlers.beforeUnload);
        window.removeEventListener('popstate', this.eventHandlers.popState);

        // Stop mutation observer
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }

        // Clear all timers
        this.clearIdleTimer();

        this.hoverTimers.forEach(timerId => clearTimeout(timerId));

        this.hoverTimers.clear();
        this.formCompletions.clear();
        this.fieldRefocusCount.clear();
        this.ctaElements = [];
        this.currentFocusedElement = null;
        this.currentHoveredCTA = null;
        this.log('Hesitation detector destroyed');
    }
}
