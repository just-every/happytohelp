const DISMISSIBLE_AI_TYPES = ['sales', 'support'];
const DISMISSAL_COOLDOWNS_MS = [
    24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
    30 * 24 * 60 * 60 * 1000,
    182 * 24 * 60 * 60 * 1000,
];

function isDismissibleInsightType(aiType) {
    return DISMISSIBLE_AI_TYPES.includes(String(aiType || '').trim().toLowerCase());
}

function getCooldownMs(dismissalCount) {
    if (!dismissalCount || dismissalCount < 1) {
        return 0;
    }

    return DISMISSAL_COOLDOWNS_MS[Math.min(dismissalCount - 1, DISMISSAL_COOLDOWNS_MS.length - 1)];
}

function getInsightClosedAt(insight) {
    if (!insight) {
        return null;
    }

    return typeof insight.get === 'function' ? insight.get('closed_at') : insight.closed_at;
}

function getInsightAiType(insight) {
    if (!insight) {
        return null;
    }

    return typeof insight.get === 'function' ? insight.get('ai_type') : insight.ai_type;
}

function getInsightDismissalCooldown(insights, now = new Date()) {
    const dismissedInsights = (insights || [])
        .filter((insight) => getInsightClosedAt(insight) && isDismissibleInsightType(getInsightAiType(insight)))
        .sort((left, right) => new Date(getInsightClosedAt(right)).getTime() - new Date(getInsightClosedAt(left)).getTime());

    if (dismissedInsights.length === 0) {
        return {
            active: false,
            dismissalCount: 0,
            nextEligibleAt: null,
        };
    }

    const latestClosedAt = new Date(getInsightClosedAt(dismissedInsights[0]));
    const nextEligibleAt = new Date(latestClosedAt.getTime() + getCooldownMs(dismissedInsights.length));

    return {
        active: nextEligibleAt.getTime() > now.getTime(),
        dismissalCount: dismissedInsights.length,
        latestClosedAt,
        nextEligibleAt,
    };
}

export {
    DISMISSAL_COOLDOWNS_MS,
    DISMISSIBLE_AI_TYPES,
    getInsightDismissalCooldown,
    isDismissibleInsightType,
};
