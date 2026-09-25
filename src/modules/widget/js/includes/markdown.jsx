function closeUnclosedMarkdown(text) {
    const markers = ['***', '~~', '**', '__', '*', '_', '```', '`', '$$', '$'];
    const stack = [];
    let i = 0;
    const length = text.length;

    while (i < length) {
        let marker = null;

        // Check for markers up to 3 characters long
        for (let len = 3; len > 0; len--) {
            if (i + len <= length) {
                let substr = text.substr(i, len);
                if (markers.includes(substr)) {
                    marker = substr;
                    i += len;
                    break;
                }
            }
        }

        if (marker) {
            if (stack.length > 0 && stack[stack.length - 1] === marker) {
                stack.pop();
            } else {
                stack.push(marker);
            }
        }
        // Handling for links and images
        else if (text.charAt(i) === '[') {
            const closingIndex = text.indexOf(']', i);
            if (closingIndex === -1) {
                // Unclosed link/image text
                stack.push(']');
                i += 1;
            } else {
                i = closingIndex + 1;

                // Check for the '(' following ']'
                if (i < length && text.charAt(i) === '(') {
                    const closingParenIndex = text.indexOf(')', i);
                    if (closingParenIndex === -1) {
                        // Unclosed URL
                        stack.push(')');
                        i = length;
                    } else {
                        i = closingParenIndex + 1;
                    }
                }
            }
        }
        // Handling for HTML tags
        else if (text.charAt(i) === '<') {
            const closingIndex = text.indexOf('>', i);
            if (closingIndex === -1) {
                // Unclosed HTML tag
                stack.push('>');
                i = length;
            } else {
                i = closingIndex + 1;
            }
        }
        else {
            i += 1;
        }
    }

    // Append closing markers for any unclosed emphasis
    while (stack.length > 0) {
        text += stack.pop();
    }

    return text;
}


export {
    closeUnclosedMarkdown,
};
