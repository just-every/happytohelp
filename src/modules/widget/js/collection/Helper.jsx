
function truncateMiddle(text, maxLength) {
    // If the text length is less than or equal to the maxLength, return it as is
    if (text.length <= maxLength) {
        return text;
    }

    // Calculate the length of the text to keep from the start and end
    const keepLength = Math.floor((maxLength - 3) / 2);

    // Get the start and end parts of the text
    const start = text.substring(0, keepLength);
    const end = text.substring(text.length - keepLength);

    // Return the truncated text with ellipsis in the middle
    return `${start}...${end}`;
}

function cleanText(text) {
    if(!text) return "";
    return '"'+truncateMiddle(text.replace(/[\s\n]+/g, " ").trim(), 200)+'"';
}

function textExists(text) {
    return text && text.trim().length > 0;
}

function textElementExists(element) {
    if(element && element.classList.contains("context-exclude")) {
        return false;
    }
    return textExists(element.innerText);
}

function removePII(text) {
    // Attempt to remove PII from the text

    const checks = [
        { name: "email",    regex: /(?:%[0-9A-Fa-f]{2}|[+a-zA-Z0-9._-])+(%40|@)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
        { name: "phone",    regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g },
        { name: "SSN",      regex: /\b\d{3}-\d{2}-\d{4}\b/g },
        { name: "card",     regex: /\b[\dx*]{4}[- ]?[\dx*]{4}[- ]?[\dx*]{4}[- ]?\d{4}\b/g },
        { name: "address",  regex: /\d{1,5}\s\w+(\s\w+)?\s(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Parkway|Pkwy|Circle|Cir|Terrace|Ter|Close|Cl)\b/g },
        { name: "passport", regex: /\b[A-Z]{2}\d{7}\b/g },
        { name: "IP",       regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
    ];

    for(let i = 0; i < checks.length; i++) {
        text = text.replace(checks[i].regex, `~${checks[i].name} removed~`);
    }

    // Special check for other IDs
    text = text.replace(/([a-z]{1,3}\\?[_-])?[A-Za-z0-9]{8,}/g, (str) => {
        // Check for at least one uppercase letter and one digit
        const countLowerCase = (str.match(/[a-z]/g) || []).length;
        const countUpperCase = (str.match(/[A-Z]/g) || []).length;
        const countDigit = (str.match(/\d/g) || []).length;

        // Only replace matches that meet all criteria
        return countLowerCase > 0 && (countUpperCase > 4 || countDigit > 4 || (countUpperCase > 0 && countDigit > 0)) ? `~ID removed~` : str;
    });

    // Clean up markdown
    text = text.replace(/!?\[[^[\]]*?removed~.*?\]\(.*?removed~.*?\)/g, '~URL removed~');
    text = text.replace(/\]\(.*?removed~.*?\)/g, '](~URL removed~)');
    text = text.replace(/!?\[[^[\]]*?removed~.*?\]\((.*?)\)/g, '$1');
    text = text.replace(/!?\[[^a-zA-Z]*\]\(~URL removed~\)/g, '~URL removed~');

    // Clean up URLs
    text = text.replace(/https?:\/\/[^\s]*~[a-zA-Z]+ removed~[^\s]*/g, '~URL removed~');

    // Reduce multiple redactions to one
    text = text.replace(/~([a-zA-Z]+) removed~([^\w\d([]*~[a-zA-Z]+ removed~)+/g, '~$1 removed~');

    // Clean new lines
    text = text.replace(/(\n\s*){3,}/g, '\n\n');

    return text.trim();
}

export {
    truncateMiddle,
    cleanText,
    textExists,
    textElementExists,
    removePII
};
