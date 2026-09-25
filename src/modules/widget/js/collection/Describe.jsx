import { cleanText, textExists, textElementExists } from "./Helper";

const nameTags = {
    "A": "a link",
    "BUTTON": "a button",
    "INPUT": "an input",
    "SELECT": "a select input",
    "TEXTAREA": "a textarea",
    "LABEL": "a label",
    "LI": "a list item",
    "CODE": "a code block",
    "IMG": "an image",
    "SVG": "an image",
    "AREA": "an image map",
    "AUDIO": "an audio player",
    "VIDEO": "a video",
    "H1": "a title",
    "H2": "a title",
    "H3": "a subtitle",
    "H4": "a subtitle",
    "H5": "a subtitle",
    "H6": "a subtitle",
}

function isComplexElement(element, depth = 1) {
    if(depth > 3 || (element.children && element.children.length > 3)) return true;
    if(element.children) {
        for(let i = 0; i < element.children.length; i++) {
            if(isComplexElement(element.children[i], depth + 1)) return true;
        }
    }
    return false;
}

function describeForm(form) {
    let description = [];
    if(form.action) description.push(`to ${form.action}`);

    const formData = new FormData(form);
    const formValues = {};
    formData.forEach((value, key) => {
        const field = form.elements[key];
        formValues[key] = field && field.type === 'password' ? '~password removed~' : value;
    });

    if(formValues) {
        description.push("with the values: "+JSON.stringify(formValues));
    }

    return description.length > 0 ? " "+description.join(" ") : "";
}

function describeTarget(event, targetElement = null) {
    targetElement = targetElement || event.target;
    if(!event || !targetElement) return "";
    let description = [];

    if(event.type === "submit" && targetElement.tagName === "FORM") {
        return describeForm(targetElement);
    }

    if(targetElement.tagName in nameTags) {
        if(targetElement.tagName === "INPUT" && targetElement.type && !["text"].includes(targetElement.type.toLowerCase())) {
            description.push("a "+targetElement.type+" input");
        }
        else if(targetElement.tagName === "A") {
            if(targetElement.classList.contains("nav-link")) {
                if(targetElement.classList.contains("active")) {
                    description.push("an active");
                }
                else {
                    description.push("a");
                }
                if(targetElement.closest(".nav-tabs")) {
                    description.push("menu tab");
                }
                else {
                    description.push("menu item");
                }
            }
            else if(targetElement.classList.contains("btn")) {
                description.push("a button");
            }
        }
        else if(targetElement.tagName === "LI") {
            if(targetElement.classList.contains("nav-item")) {
                if(targetElement.closest(".nav-tabs")) {
                    description.push("menu tab");
                }
                else {
                    description.push("menu item");
                }
            }
        }

        if(description.length === 0) {
            description.push(nameTags[targetElement.tagName]);
        }
    }
    else if(targetElement.parentElement && targetElement.parentElement.tagName in nameTags) {
        return describeTarget(event, targetElement.parentElement);
    }
    else if(targetElement.parentElement && targetElement.parentElement.parentElement && targetElement.parentElement.parentElement.tagName in nameTags) {
        return describeTarget(event, targetElement.parentElement.parentElement);
    }

    if(description.length > 0) {
        if(targetElement.getAttribute("href") && targetElement.getAttribute("href") !== "#") {
            description.push("to " + targetElement.getAttribute("href"));
        }
        if(targetElement.src) description.push("(" + targetElement.src + ")");
        if(targetElement.name) {
            let skipName = false;
            if(targetElement.labels) {
                for(let i = 0; i < targetElement.labels.length; i++) {
                    if(targetElement.labels[i].innerText.toLowerCase().includes(targetElement.name.toLowerCase()) ||
                        targetElement.labels[i].innerText.toLowerCase().includes(targetElement.name.toLowerCase().replace(/[_-]+/g, " "))) {
                        skipName = true;
                        break;
                    }
                }
            }
            if(!skipName) description.push(`named ${cleanText(targetElement.name)}`);
        }
        if(targetElement.title) description.push(`titled ${cleanText(targetElement.title)}`);
        if(targetElement.labels) {
            for(let i = 0; i < targetElement.labels.length; i++) {
                description.push(`labeled ${cleanText(targetElement.labels[i].innerText.replace(/\b(required|optional)\b/i, ''))}`);
            }
        }
        if(targetElement.placeholder) description.push(`with the placeholder ${cleanText(targetElement.placeholder)}`);
        if(targetElement.value) {
            if(targetElement.tagName === "SELECT") {
                // special case for select elements
                description.unshift(`the selected option to ${cleanText(targetElement.options[targetElement.selectedIndex].text)} on`);
            }
            else if(targetElement.type && !["password", "button"].includes(targetElement.type.toLowerCase()) && targetElement.tagName !== "BUTTON") {
                if(event.type === "keydown") {
                    description.unshift(`the text ${cleanText(targetElement.value)} in`);
                }
                else {
                    description.unshift(`the value ${cleanText(targetElement.value)} in`);
                }
            }
        }
    }

    if(!description.length && isComplexElement(targetElement)) {
        // For now, we will not describe complex elements without other attributes
        // They tend to be too verbose and not very useful
        if(event.type === "scroll" && targetElement.childNodes) {
            // For scroll events we do want the text of complex elements, but only if it's directly contained in text nodes assocaited with it
            let childText = [];
            targetElement.childNodes.forEach(node => {
                // Check if the node is a text node
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                    // Append the text content of this text node to the result
                    childText.push(node.textContent.trim());
                }
            });
            if(childText.length > 0 && textExists(childText.join(" "))) {
                description.push(`the text ${cleanText(childText.join(" "))}`);
            }
        }
    }
    else {
        if(targetElement.tagName === "SELECT") {
            // Do not get the text of select elements
        }
        else if(targetElement.classList.contains("context-exclude-text")) {
            // Do not get the text of exclude elements
        }
        else if(textElementExists(targetElement)) {
            description.push(`${description.length > 0 ? "with " : ""}the text ${cleanText(targetElement.innerText)}`);
        }
        else if(targetElement.alt) {
            description.push(`with the alt text ${cleanText(targetElement.alt)}`);
        }
        else if(targetElement.children) {
            const children = targetElement.children;
            childrenLoop:
                for(let i = 0; i < children.length; i++) {
                    if(textElementExists(children[i])) {
                        description.push(`${description.length > 0 ? "with " : ""}the text ${cleanText(children[i].innerText)}`);
                        break;
                    }
                    else if(children[i].children) {
                        const subchildren = children[i].children;
                        for(let j = 0; j < subchildren.length; j++) {
                            if(textElementExists(subchildren[j])) {
                                description.push(`${description.length > 0 ? "with " : ""}the text ${cleanText(subchildren[j].innerText)}`);
                                break childrenLoop;
                            }
                        }
                    }
                }
        }
    }

    return description.length > 0 ? " "+description.join(" ") : "";
}

export {
    nameTags,
    describeForm,
    describeTarget
};
