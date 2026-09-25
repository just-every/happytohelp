const log = console;
export function closePartialJson(partialJson, closeProperties = []) {
    // Try to close the JSON by adding the necessary brackets
    let validJson = null;
    let previousAttempts = {};
    let openProperty = false;

    // Add brackets until the string can be parsed
    while (partialJson) {
        try {
            // Attempt to parse the JSON string
            validJson = JSON.parse(partialJson);
            return { ...validJson, openProperty }; // Return if parsing is successful
        } catch (error) {
            // If there is a SyntaxError, it may be because the JSON is incomplete
            if (error instanceof SyntaxError) {
                // Find how many brackets are missing
                const openBrackets = (partialJson.match(/{/g) || []).length;
                const closeBrackets = (partialJson.match(/}/g) || []).length;
                const openSquareBrackets = (partialJson.match(/\[/g) || []).length;
                const closeSquareBrackets = (partialJson.match(/]/g) || []).length;
                const openQuotes = (partialJson.match(/"/g) || []).length;

                let modified = false;
                // Add missing closing quote if there's an open quote
                if (closeProperties.length > 0 && (openQuotes % 2) !== 0 && !openProperty) {
                    // @todo what about escaped quotes?
                    for (const property of closeProperties) {
                        const regex = new RegExp(`"${property}":\\s*"[^"}]+$`);
                        if (regex.test(partialJson)) {
                            partialJson += '"';
                            openProperty = property;
                            modified = true;
                            break;
                        }
                    }
                }

                // Add missing closing square brackets if necessary
                if (openSquareBrackets > closeSquareBrackets) {
                    const difference = openSquareBrackets - closeSquareBrackets;
                    partialJson += "]".repeat(difference);
                    modified = true;
                }

                // Add missing closing normal brackets if necessary
                if (openBrackets > closeBrackets) {
                    const difference = openBrackets - closeBrackets;
                    partialJson += "}".repeat(difference);
                    modified = true;
                }

                // If brackets are balanced, but there’s still an error, slice back to the last comma
                if (!modified) {
                    const lastCommaIndex = partialJson.lastIndexOf(",");
                    if (lastCommaIndex !== -1) {
                        partialJson = partialJson.slice(0, lastCommaIndex);
                    } else {
                        //log.error("No comma to go back to", partialJson);
                        break;
                    }
                }
            } else {
                log.error("Unexpected error:", error);
                break;
            }
        }

        // Break the loop if the partialJson becomes empty
        if (partialJson.trim().length === 0) {
            break;
        }

        // Check if the length is decreasing to prevent infinite loop
        if (previousAttempts[partialJson]) {
            //log.error("Already attempted to parse this JSON");
            break;
        }

        previousAttempts[partialJson] = 1;
    }

    //log.error("Could not parse JSON", partialJson);
    return null;
}
