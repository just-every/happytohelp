
// Counts select an interval before the admitted generation increments them.
const PROFILE_INTERVAL = {
    project: [
        0,
        600000, // 10 minutes
        86400000, // 1 day
    ],
    agent: [
        0,
        600000, // 10 minutes
        86400000, // 1 day
    ],
    contact: [
        0,
        120000, // 2 minutes
        600000, // 10 minutes
        6000000, // 100 minutes
        86400000, // 1 day
    ],
    optimize: [
        0,
        86400000, // 1 day
        432000000, // 5 days
    ],
};

const profileCount = (value) => {
    const count = Number(value);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

const profileInterval = (type, count) => {
    const intervals = PROFILE_INTERVAL[type];
    if (!intervals) return 0;
    return intervals[Math.min(profileCount(count), intervals.length - 1)];
};

const timestamp = (value) => {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    return Date.parse(value || '');
};

const withinProfileCooldown = (value, type, count, now) => {
    const startedAt = timestamp(value);
    const reference = timestamp(now);
    return Number.isFinite(startedAt)
        && Number.isFinite(reference)
        && startedAt > reference - profileInterval(type, count);
};

export {
    PROFILE_INTERVAL,
    profileCount,
    profileInterval,
    withinProfileCooldown,
};
