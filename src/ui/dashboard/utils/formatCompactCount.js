const compactCountFormatter = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
});

export default function formatCompactCount(count) {
    return compactCountFormatter.format(count).replace('K', 'k');
}
