// React Bootstrap contains programmatic focus, but does not wrap native Tab order.
// Resolve controls at each keypress so disabled/busy and disclosure states are current.
export function trapDialogTab(event) {
    if (event.key !== 'Tab' || event.defaultPrevented) return;
    const dialog = event.currentTarget;
    const candidates = [...dialog.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]')]
        .filter(element => element.tabIndex >= 0 && !element.matches(':disabled')
            && !element.closest('[inert], [hidden]') && element.getClientRects().length > 0
            && getComputedStyle(element).visibility === 'visible');
    const controls = candidates.filter(element => {
        if (!element.matches('input[type="radio"]') || !element.name) return true;
        const group = candidates.filter(other => other.matches('input[type="radio"]') && other.name === element.name && other.form === element.form);
        return element === (group.find(other => other.checked) || group[0]);
    }).sort((left, right) => (left.tabIndex || Infinity) - (right.tabIndex || Infinity));
    const active = dialog.ownerDocument.activeElement;
    const index = controls.indexOf(active);
    if (!controls.length || index === -1 || (event.shiftKey ? index === 0 : index === controls.length - 1)) {
        event.preventDefault();
        (controls.length ? controls[event.shiftKey ? controls.length - 1 : 0] : dialog).focus();
    }
}
