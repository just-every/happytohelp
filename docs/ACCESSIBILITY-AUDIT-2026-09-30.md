# Dashboard and widget accessibility closeout

This is a bounded local audit of the native dashboard and embedded chat widget. It records the rendered states and checks exercised; it is not a claim of complete WCAG certification or a substitute for assistive-technology and user testing.

## Automated and manual scope

`pnpm run test:accessibility-browser` runs Axe 4.13.0 in Chromium 153.0.8010.12 against tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`. The test uses the locally emitted Worker and a local widget host with synthetic tenant, visitor, conversation and attachment data. It checks these 19 rendered states:

| Surface | Axe states |
| --- | --- |
| Dashboard | Setup; login; populated inbox; open workspace switcher; open composer tools; note dialog; account menu; project settings General; project Appearance; knowledge datasets; knowledge articles; knowledge categories; 320 CSS-pixel mobile inbox. |
| Widget | Consent-granted closed widget; open composer; validation errors; attachment composer; attachment preview dialog; 320 CSS-pixel mobile widget. |

All 19 scans returned **zero Axe violations**. Axe reported no incomplete rule other than `color-contrast`. Of its 83 color-contrast review nodes, the rendered-pixel sampler measured 71 against the background actually composited behind the text; every measurement met Axe’s applicable threshold (lowest 4.61:1). Twelve nodes could not be classified by that sampler. Their disposition is recorded here rather than counted as passing Axe results:

| Incomplete target(s) | Count | Disposition |
| --- | ---: | --- |
| `.conversation-suggestions__empty` under the open note dialog | 1 | The dialog covers this background content, so its current pixels are not available as a text/background pair. The same text in the unobscured populated inbox was measured at 6.06:1. The modal state itself has no Axe violation. |
| `#timezone` | 1 | Axe does not expose the native select’s displayed option as a text node. The actual control foreground/background was measured at 17.27:1, and its embedded select chevron at 3.82:1 against the field surface. |
| `.avatar-title.rounded-circle > span` in the account-menu and mobile states | 2 | Axe could not classify the one-character initials. Direct rendered-style measurement found 6.41:1 against the avatar fill. |
| Widget responder initials in the consent-closed, composer, error, attachment and mobile states | 8 | Axe could not resolve the Shadow DOM pseudo-element/background composition for these repeated initials. The same visible header and launcher initials were directly measured in the open state at 8.73:1 against their blue fill. |

The non-text widget and select icons, their hover/focus states, and keyboard focus indicators were separately checked. The select chevron measured 3.82:1 (3:1 minimum); widget action icons measured at least 4.61:1 (3:1 minimum), including 4.97:1 in the hover/focus checks; the focus ring measured at least 3.51:1 against its surrounding surface (3:1 minimum). Across 37 direct text/initial/icon measurements, all 32 text/initial checks passed (lowest 4.61:1), as did all five widget icon checks. The select chevron result is a separate measurement. Evidence records preserve the foreground, resolved background, ratio and applicable threshold for each check.

Seven keyboard passes made 122 Tab presses and recorded 113 focused controls. Every recorded stop had a non-empty name, a visible focus indicator, and was reachable at its center; no focus indicator measured below 3:1. Name extraction checks `aria-labelledby`, `aria-label`, associated native labels, image alt text, title and visible text. Of the recorded names, 4 came from associated labels, 49 from ARIA labels, 2 from titles and 58 from visible text. The skip link was separately focused and activated to verify that it moves focus to the main region. Escape and focus restoration were checked for the workspace switcher, note dialog and account menu. The widget preview dialog was checked for Tab containment, Escape dismissal and focus restoration; host consent revocation was checked to unmount the widget.

Layout checks measured visible dashboard controls at 1440×1000, 320×568 and a 720×500 viewport equivalent to 200% zoom reflow. The settled widget panel itself—not its zero-height outer host—was measured at 500×815 in a 1440×960 viewport and 320×560 at 320×568. All five measurements reported no document or widget-surface horizontal overflow, no clipped controls, no unnamed controls, no unreachable control centers and no targets smaller than 24×24 CSS pixels. On mobile, the visually covered inbox list is both `inert` and `aria-hidden` while a conversation is open.

## Changes made

The closeout adds visible keyboard focus, a skip link and main-region focus target; fixes navigation and inbox layout around that main region; makes dialog and mobile-covered content unavailable to background keyboard stops; names the reply field and widget actions; repairs native button semantics, dialog focus handling and status announcements; and darkens the measured low-contrast setup, dashboard and widget text/icons. The native select chevron now uses the darker neutral token and is checked at runtime. Existing product layout and the audited widget flow are retained.

The test is split by responsibility: `tests/accessibility-browser.mjs` coordinates the isolated runtime, `tests/helpers/accessibility-axe-audit.mjs` stores scans and contrast dispositions, `tests/helpers/accessibility-interaction-audit.mjs` measures keyboard/layout/manual styles, and separate dashboard/widget flow files exercise their routes and interactions.

## Evidence and limits

The machine-readable results and screenshots are in `/Users/zemaj/.orchestrator/evidence/runeditrun/h2h-accessibility-execution/`. The summary records each Axe scan, incomplete-node disposition, keyboard sequence, layout rectangle, contrast ratio, browser version and emitted artifact hash. In the final audit run the dashboard arrow measurement is also in `dashboard-timezone-chevron-contrast.json`.

This run covers Chromium only. It does not include VoiceOver, NVDA, JAWS, a screen-reader/browser matrix, an independent human usability study, live email/model/provider journeys or hosted deployment. The 200% reflow check uses the corresponding reduced CSS viewport rather than operating-system display scaling. The widget’s local configuration has one human responder, so it exposes a static, named responder and has no picker control to operate. These limitations do not change the scan results, but they bound where those results apply.

`docs/UI-PARITY.md` records the remaining native feature/API differences and why each unsupported legacy capability has no working native equivalent. This accessibility report does not treat those product gaps as accessibility fixes or silently claim feature equality.
