export function updateNavigationUnreadBadge(count) {
    const badge = document.getElementById('navigation-inbox-unread');
    const label = badge?.querySelector('.navbar-unread-count');

    if (!badge || !label || !Number.isFinite(count) || count < 0) {
        return;
    }

    badge.dataset.count = String(count);
    label.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
    label.setAttribute('aria-label', `${ count } unread conversations`);
}
