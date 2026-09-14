function clampSelection(value, position) {
    return Math.max(0, Math.min(String(value).length, Number(position) || 0));
}

function replaceSelection(value, selectionStart, selectionEnd, replacement, selectedStart, selectedEnd) {
    const source = String(value);
    const start = clampSelection(source, selectionStart);
    const end = Math.max(start, clampSelection(source, selectionEnd));

    return {
        value: `${ source.slice(0, start) }${ replacement }${ source.slice(end) }`,
        selectionStart: start + selectedStart,
        selectionEnd: start + selectedEnd,
    };
}

function wrapSelection(value, selectionStart, selectionEnd, before, after, placeholder = 'text') {
    const source = String(value);
    const start = clampSelection(source, selectionStart);
    const end = Math.max(start, clampSelection(source, selectionEnd));
    const selected = source.slice(start, end) || placeholder;

    return replaceSelection(source, start, end, `${ before }${ selected }${ after }`, before.length, before.length + selected.length);
}

function replaceCurrentLinePrefix(value, selectionStart, selectionEnd, prefix, matcher) {
    const source = String(value);
    const start = clampSelection(source, selectionStart);
    const end = Math.max(start, clampSelection(source, selectionEnd));
    const lineStart = source.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = source.indexOf('\n', end);
    const contentEnd = lineEnd === -1 ? source.length : lineEnd;
    const current = source.slice(lineStart, contentEnd);
    const existing = current.match(matcher);
    const previousPrefix = existing ? existing[0] : '';
    const nextPrefix = previousPrefix === prefix ? '' : prefix;
    const next = `${ nextPrefix }${ current.slice(previousPrefix.length) }`;
    const adjustment = nextPrefix.length - previousPrefix.length;

    return {
        value: `${ source.slice(0, lineStart) }${ next }${ source.slice(contentEnd) }`,
        selectionStart: Math.max(lineStart, start + adjustment),
        selectionEnd: Math.max(lineStart, end + adjustment),
    };
}

function prefixSelectedLines(value, selectionStart, selectionEnd, createPrefix, matcher) {
    const source = String(value);
    const start = clampSelection(source, selectionStart);
    const end = Math.max(start, clampSelection(source, selectionEnd));
    const lineStart = source.lastIndexOf('\n', start - 1) + 1;
    const nextLine = source.indexOf('\n', end > start ? end - 1 : end);
    const lineEnd = nextLine === -1 ? source.length : nextLine;
    const lines = source.slice(lineStart, lineEnd).split('\n');
    let offset = 0;
    let nextStart = start;
    let nextEnd = end;

    const nextLines = lines.map((line, index) => {
        const existing = line.match(matcher);
        const previousPrefix = existing ? existing[0] : '';
        const prefix = createPrefix(index, previousPrefix);
        const nextLineValue = `${ prefix }${ line.slice(previousPrefix.length) }`;
        const lineStartOffset = lineStart + offset;
        const difference = nextLineValue.length - line.length;

        if (start >= lineStartOffset) nextStart += difference;
        if (end > lineStartOffset) nextEnd += difference;
        offset += line.length + 1;
        return nextLineValue;
    });

    return {
        value: `${ source.slice(0, lineStart) }${ nextLines.join('\n') }${ source.slice(lineEnd) }`,
        selectionStart: nextStart,
        selectionEnd: nextEnd,
    };
}

function heading(value, selectionStart, selectionEnd, level = 1) {
    const prefix = `${ '#'.repeat(level) } `;
    return replaceCurrentLinePrefix(value, selectionStart, selectionEnd, prefix, /^(?:#{1,6}\s+)/);
}

function quote(value, selectionStart, selectionEnd) {
    return prefixSelectedLines(value, selectionStart, selectionEnd, () => '> ', /^(?:>\s?)/);
}

function bulletList(value, selectionStart, selectionEnd) {
    return prefixSelectedLines(value, selectionStart, selectionEnd, () => '- ', /^(?:[-+*]\s+)/);
}

function orderedList(value, selectionStart, selectionEnd) {
    return prefixSelectedLines(value, selectionStart, selectionEnd, index => `${ index + 1 }. `, /^(?:\d+[.)]\s+)/);
}

function imageMarkdown(url, alt = 'image') {
    const escapedAlt = String(alt).replace(/[\[\]]/g, '\\$&');
    const escapedUrl = String(url).replace(/[()]/g, '\\$&');
    return `![${ escapedAlt }](${ escapedUrl })`;
}

export {
    bulletList,
    heading,
    imageMarkdown,
    orderedList,
    prefixSelectedLines,
    quote,
    replaceSelection,
    wrapSelection,
};
