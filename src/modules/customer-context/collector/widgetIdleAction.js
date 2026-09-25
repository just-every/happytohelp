
// Browser telemetry, not a user action. Its duration changes on every heartbeat.
const RECURRING_WIDGET_IDLE_ACTION = /^detected extended inactivity\s*\((\d+) seconds without interaction\)\s*-\s*user may be hesitating\.?$/i;
const INITIAL_WIDGET_IDLE_WINDOW_SECONDS = 60;

const widgetIdleSeconds = (value) => {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(RECURRING_WIDGET_IDLE_ACTION);
    if (!match) return null;
    const seconds = Number(match[1]);
    return Number.isFinite(seconds) ? seconds : null;
};

const isRecurringWidgetIdleAction = (value) => widgetIdleSeconds(value) !== null;
const isSustainedWidgetIdleAction = (value) => (widgetIdleSeconds(value) || 0) > INITIAL_WIDGET_IDLE_WINDOW_SECONDS;

export {
    isRecurringWidgetIdleAction,
    isSustainedWidgetIdleAction,
    widgetIdleSeconds,
};
