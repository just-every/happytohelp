import moment from 'moment-timezone';

/**
 * The IANA zone name recorded for a contact, or null when none is recorded or the
 * recorded value is not a zone this build knows. Callers show no clock rather than
 * falling back to the viewer's own zone. Contacts store the zone URL-encoded
 * (`Asia%2FTokyo`), so a malformed escape is treated as unknown rather than thrown.
 */
export function contactTimezone(contact) {
    const recorded = contact?.timezone;
    if (typeof recorded !== 'string' || !recorded.trim()) return null;

    let name;
    try {
        name = decodeURIComponent(recorded).trim();
    } catch {
        return null;
    }

    return moment.tz.zone(name) ? name : null;
}
