const log = require('../../config/log');
const { insightSchema, collectorSchema, projectSchema, projectContentOptimizeSchema, contactSchema, summarySchema, agentSchema, optimizeContentSchema, agentSuggestionsSchema } = require("../schemas/schemas");
const { optimizeMessages } = require("./optimize");
const { agentTools, replyTools } = require("../tools/include");
const { bookshelf} = require("../../config/db");
const { includeContext, includeLastInsight } = require("./includeContext");
const { STABILITY_INSTRUCT, STABILITY_HIGH, STABILITY_MED, STABILITY_LOW, STABILITY_DYNAMIC  } = require("./stability");
const { setAssistantThinking } = require('../../config/requestContext');

const { TASKS, runStream } = require('../ensemble/orchestrator');

/**
 * Build a profile of a project
 *
 * @param {Object} profileContext
 * @returns Promise
 */
const buildProjectProfile = async ( profileContext) => {
    const { project, project_id, dataset_files } = profileContext;

    let messages = await includeContext(profileContext);

    let keys = ['name', 'website', 'help_center_domain', 'timezone'];
    keys.forEach(key => {
        if(project.get(key)) {
            messages.push({
                role: 'developer',
                name: 'adviser',
                content: `Project ${key}: ${project.get(key)}`
            });
        }
    });

    messages.push({
        stability: STABILITY_INSTRUCT,
        role: 'developer',
        name: 'instruction',
        content: [
            "Downstream use: This project profile is stored and used to personalize future replies (tone, terminology, routing) and improve retrieval/search.",
            "Task: Populate the project profile JSON from the information provided above and (optionally) website context.",
            "Success criteria:",
            "- Grounded in evidence (do not guess).",
            "- Prefer concise values that capture the core idea.",
            "- If you are unsure, set the value to null.",
            "Confidence:",
            "- Use 0-100 to reflect certainty.",
            "- If an existing value has high confidence, avoid changing it unless you have stronger evidence.",
            "Output: Return JSON matching the schema.",
        ].join("\n")
    });

    // Include any data found on the website
    let dataContext = [];
    if(project.get('website')) {
        dataContext = getContextFromUrl(dataContext, project.get('website'), dataset_files);
    }
    if(project.get('help_center_domain') && project.get('help_center_domain') !== project.get('website')) {
        dataContext = getContextFromUrl(dataContext, project.get('help_center_domain'), dataset_files);
    }
    dataContext.forEach(content => {
        messages.push({role: 'developer', name: 'researcher', content});
    });

    if(project.get('ai_profile')) {
        messages.push({role: 'developer', name: 'instruction', content: 'This is the existing profile. Please use this as a base to build upon:'});
        messages.push({role: 'developer', name: 'instruction', content: JSON.stringify(project.get('ai_profile'))});
    }

    return runStream({
        project_id,
        task: TASKS.PROFILE,
        tag: 'project_analysis',
        messages: optimizeMessages(messages),
        schema: projectSchema(),
        response_name: 'project_analysis',
    });
};

/**
 * Build a profile of an agent
 *
 * @param {Object} profileContext
 * @returns Promise
 */
const buildAgentProfile = async ( profileContext) => {
    const { agent, project_id } = profileContext;

    let messages = await includeContext(profileContext);
    messages.push({
        stability: STABILITY_INSTRUCT,
        role: 'developer',
        name: 'instruction',
        content: [
            "Downstream use: This agent profile is stored and later used to generate suggested replies that match the agent's tone (greetings, sign-offs, writing style).",
            "Task: Populate the agent profile JSON by analyzing the agent's past messages and behavior.",
            "Success criteria:",
            "- Capture consistent stylistic patterns and preferences.",
            "- Do not overfit to one-off messages.",
            "- If unsure, set the value to null.",
            "Confidence:",
            "- Use 0-100 to reflect certainty.",
            "- Prefer stability: do not change high-confidence existing values without stronger evidence.",
            "Output: Return JSON matching the schema.",
        ].join("\n")
    });

    if (agent.get('ai_profile')) {
        messages.push({role: 'developer', name: 'instruction', content: 'This is the existing profile. Please use this as a base to build upon:'});
        messages.push({role: 'developer', name: 'instruction', content: JSON.stringify(agent.get('ai_profile'))});
    }

    return runStream({
        project_id,
        task: TASKS.PROFILE,
        tag: 'agent_analysis',
        messages: optimizeMessages(messages),
        schema: agentSchema(profileContext),
        response_name: 'agent_analysis',
    });
};

/**
 * Build a profile of a contact
 *
 * @param {Object} profileContext
 * @returns Promise
 */
const buildContactProfile = async ( profileContext) => {
    const { contact, project_id, project } = profileContext;

    let messages = await includeContext(profileContext);
    messages.push({
        stability: STABILITY_INSTRUCT,
        role: 'developer',
        name: 'instruction',
        content: [
            "Downstream use: This user profile is stored and used to personalize proactive insights and chat replies.",
            "Task: Populate the user profile JSON from observed actions and messages.",
            "Success criteria:",
            "- Grounded and tentative (do not guess; avoid stating uncertain details as facts).",
            "- Prefer concise values that help tailor support/sales appropriately.",
            "- If unsure, set the value to null.",
            "Confidence:",
            "- Use 0-100 to reflect certainty.",
            "- Prefer stability: do not change high-confidence existing values without stronger evidence.",
            "Output: Return JSON matching the schema.",
        ].join("\n")
    });

    if(contact.get('ai_profile')) {
        messages.push({role: 'developer', name: 'instruction', content: 'This is the existing profile. Please use this as a base to build upon:'});
        messages.push({role: 'developer', name: 'instruction', content: JSON.stringify(contact.get('ai_profile'))});
    }

    return runStream({
        project_id,
        task: TASKS.PROFILE,
        tag: 'contact_analysis',
        messages: optimizeMessages(messages),
        schema: contactSchema(profileContext),
        response_name: 'contact_analysis',
    });
};

/**
 * Build a profile of a project
 *
 * @param {Object} profileContext
 * @returns Promise
 */
const buildOptimizeProfile = async ( profileContext) => {
    const { project, project_id, dataset_files } = profileContext;

    let messages = await includeContext(profileContext);

    let keys = ['name', 'website', 'help_center_domain', 'timezone'];
    keys.forEach(key => {
        if(project.get(key)) {
            messages.push({
                role: 'developer',
                name: 'adviser',
                content: `Project ${key}: ${project.get(key)}`
            });
        }
    });

    messages.push({
        stability: STABILITY_INSTRUCT,
        role: 'developer',
        name: 'instruction',
        content: [
            "Downstream use: These selections will be used to personalize on-site content for users (titles and key paragraphs).",
            "Task: Pick 10 titles or paragraphs that would be most useful to optimize for relevance.",
            "Success criteria:",
            "- Prefer high-traffic / high-intent pages (home, product, pricing overview, onboarding, docs).",
            "- Pick text that can be safely reworded without changing factual meaning.",
            "Hard constraints:",
            "- Avoid legal pages and factual details like pricing.",
            "Output: For each selection, return page URL, the exact text, and a CSS selector for that text.",
        ].join("\n")
    });

    messages.push({
        stability: STABILITY_DYNAMIC,
        role: 'developer',
        name: 'instruction',
        content: 'The following is HTML pages taken from the company website.'
    });

    for (let i = 0; i < 20; i++) {
        const file = dataset_files.models[i];
        messages.push({
            stability: STABILITY_DYNAMIC,
            role: 'developer',
            name: 'instruction',
            content: `URL: ${file.get('url')}\n\n${file.get('html')}`,
        });
    }

    return runStream({
        project_id,
        task: TASKS.OPTIMIZE,
        tag: 'project_content_optimization',
        messages: optimizeMessages(messages),
        schema: projectContentOptimizeSchema(),
        response_name: 'project_content_optimization',
    });
};

/**
 * Analyze collector data
 *
 * @param {Object} analysisContext
 * @returns Promise
 */
const analyzeCollector = async (analysisContext) => {
    let { project_id, available_ais, contact } = analysisContext;

    let messages = await includeContext(analysisContext);

    messages.push({
        stability: STABILITY_INSTRUCT,
        role: 'developer',
        name: 'instruction',
        content: [
            "UI context: This analysis decides whether to show a proactive Insight card while the user browses.",
            "Task: Decide whether it is a good time to send an Insight and what type of help would be most useful.",
            "Success criteria:",
            "- Treat an Insight as an interruption; recommend sending only if it is likely to be specific and helpful right now (unblock, clarify, reduce decision friction).",
            "- Avoid repeating recent insights or sending multiple similar nudges.",
            "Hard constraints:",
            "- Do not guess facts; base recommendations on observed actions/messages.",
            "Output: Return JSON matching the schema.",
        ].join("\n")
    });

    messages = await includeLastInsight(messages, analysisContext);

    const ai_types = available_ais.pluck('type');
    const [visitor_types, verified_types] = [
        ['sales'],
        ['support', 'billing']
    ].map(criteria =>
        ai_types.filter(item => criteria.includes(item))
    );
    if(contact && verified_types.length > 0 && visitor_types.length > 0) {
        if(contact.get('is_verified')) {
            messages.push({
                stability: STABILITY_INSTRUCT,
                role: 'developer',
                name: 'instruction',
                content: `Heuristic: the user is logged in, so they are more likely to need '${verified_types.join("' or '")}' than '${visitor_types.join("' or '")}'. Use your judgment based on the actual actions/messages.`
            });
        }
        else {
            messages.push({
                stability: STABILITY_INSTRUCT,
                role: 'developer',
                name: 'instruction',
                content: `Heuristic: the user is not logged in, so they may be slightly more likely to need '${visitor_types.join("' or '")}' than '${verified_types.join("' or '")}'. Use your judgment based on the actual actions/messages.`
            });
        }
    }

    return runStream({
        project_id,
        task: TASKS.ANALYSIS,
        tag: 'action_analysis',
        messages: optimizeMessages(messages),
        schema: collectorSchema(analysisContext),
        response_name: 'action_analysis',
    });
};

/**
 * Optimize project website content for the contact
 *
 * @param {Object} analysisContext
 * @returns Promise
 */
const optimizeContentForContact = async (profileContext) => {
    let { project_id, projectOptimize } = profileContext;

    let messages = await includeContext(profileContext);

    messages.push({
        stability: STABILITY_INSTRUCT,
        role: 'developer',
        name: 'instruction',
        content: [
            "UI context: These text changes may be applied directly to the website, so keep edits safe and layout-friendly.",
            "Task: Rewrite each provided title/paragraph to be more relevant to this specific user and their likely goals.",
            "Success criteria:",
            "- Preserve meaning and factual correctness.",
            "- Keep length roughly similar to avoid layout shifts.",
            "Output: Return an optimized version for each piece of text (matching the schema).",
        ].join("\n")
    });
    messages.push({stability: STABILITY_INSTRUCT, role: 'developer', name: 'instruction', content: JSON.stringify(projectOptimize.get('ai_profile'))});

    return runStream({
        project_id,
        task: TASKS.OPTIMIZE,
        tag: 'project_content_optimization_for_contact',
        messages: optimizeMessages(messages),
        schema: optimizeContentSchema(profileContext),
        response_name: 'project_content_optimization_for_contact',
    });
};


/**
 * Generate an insight from collector data
 *
 * @param {Object} insightContext
 * @returns Promise
 */
const makeInsight = async (insightContext) => {
    let { project_id, ai } = insightContext;

    let messages = await includeContext(insightContext);

    messages.push({
        stability: STABILITY_INSTRUCT,
        role: 'developer',
        name: 'instruction',
	        content: [
	            "UI context: This Insight appears as a small, dismissible card near the chat launcher while the user browses. The user did not ask a question yet.",
	            "Task: Generate a short, clickable Insight that feels like a helpful nudge (not a pushy pitch) and helps the user move forward.",
	            "Success criteria:",
	            "- Reference an observed theme (pricing, setup, policy, docs) without being creepy.",
	            "- Offer concrete help or ask one clarifying question.",
	            "- Keep it easy to scan.",
	            "Hard constraints:",
	            "- Do not invent discounts, urgency, or facts not present in context.",
	            "Output: Return JSON matching the schema.",
	        ].join("\n")
	    });

    if(ai?.get('type') === 'sales') {
        messages.push({
            stability: STABILITY_INSTRUCT,
            role: 'developer',
            name: 'instruction',
            content: "Sales insight: reduce decision friction and help the user choose the right option (fit, plan, pricing, next step). Be helpful and specific; avoid pressure tactics."
        });
    }
    else if(ai?.get('type') === 'support') {
        messages.push({
            stability: STABILITY_INSTRUCT,
            role: 'developer',
            name: 'instruction',
            content: "Support insight: help the user complete what they're doing (unblock, clarify steps, answer the likely question). If needed, ask 1 short clarifying question."
        });
    }

    messages = await includeLastInsight(messages, insightContext);

    return runStream({
        project_id,
        task: TASKS.INSIGHT,
        tag: 'insight',
        messages: optimizeMessages(messages),
        schema: insightSchema(insightContext),
        response_name: 'insight',
    });
}

/**
 * Summarize actions and summaries
 *
 * @param {bookshelf.Collection} summaries
 * @param {bookshelf.Collection} actions
 * @returns Promise
 */
const createSummary = async (project_id, summaryContext) => {
    const { summaries } = summaryContext;

    let messages = await includeContext(summaryContext);
    messages.push({
        stability: STABILITY_INSTRUCT,
        role: 'developer',
        name: 'instruction',
        content: [
            "Downstream use: This summary is stored and used in place of raw event data in future prompts.",
            "Task: Summarize what the user is trying to achieve and what they've done so far.",
            "Success criteria:",
            "- Specific, grounded, and information-dense (avoid fluff).",
            "- Prefer key nouns and actions over generic statements.",
            "- Avoid exact dates.",
            "Constraint: Follow the word limit below.",
            "Output: Return JSON matching the schema.",
        ].join("\n")
    });

    let totalPages = 0;
    if(summaries && summaries.length > 0) {
        summaries.forEach((summary) => {
            totalPages += summary.get('total_pages');
        });
    }

    let words = totalPages * 3;
    if(words < 50) {
        words = 50;
    }
    else if(words > 500) {
        words = 500;
    }

    messages.push({
        stability: STABILITY_INSTRUCT,
        role: 'developer',
        name: 'instruction',
        content: `Word limit: ${words} words.`
    });

    return runStream({
        project_id,
        task: TASKS.SUMMARY,
        tag: 'summary',
        messages: optimizeMessages(messages),
        schema: summarySchema(),
        response_name: 'summary',
    });
};

const agentSuggestions = async (assistContext, handleChunk = null) => {
    const { project_id, options } = assistContext;

    let messages = [];
    messages.push({
        stability: STABILITY_INSTRUCT,
        role: 'developer',
        name: 'instruction',
        content: [
            "You draft suggested replies for a human support agent. These appear as clickable \"send\" options in the human agent's UI.",
            "",
            "Generate up to 4 send-ready replies the agent could send now.",
            "",
            "Requirements:",
            "- Each reply must be helpful, natural, and send-ready (no meta commentary, no placeholders).",
            "- Replies must be meaningfully different (cover different likely paths) and do not need to agree with each other.",
            "- Button labels must be 4 words or less.",
            "- Use short paragraphs and line breaks when it improves readability.",
            "",
            "Agent-action framing:",
            "- Consider what the agent might reasonably have done since the user asked (completed it, tried and hit a limitation, or needs confirmation).",
            "",
            "Spend time thinking through all the possible paths to make sure you pick the best options",
            "If you need extra information use website_search.",
            "Order replies by likelihood of use (most likely first).",
        ].join("\n")
    });

    messages = await includeContext(assistContext, messages);

    let tools;
    [messages, tools] = agentTools(messages, assistContext);
    log.warn("Running agent_suggestions...");

    return runStream({
        project_id,
        task: TASKS.AGENT_SUGGESTIONS,
        tag: 'agent_suggestions',
        messages: optimizeMessages(messages),
        schema: agentSuggestionsSchema(),
        response_name: 'agent_suggestions',
        handleChunk,
        tools,
        options,
    });
};

const describeHumanAgent = (context) => {
    const { agent, project } = context;
    if(agent) {
        return ` named '${agent.get('first_name')}'`;
    }
    else if(project) {
        return ` from a company called '${project.get('name')}'`;
    }
    return '';
}

// The review stage is intentionally removed in favor of a single higher-quality
// generation pass in agentSuggestions.


const agentReply = async (assistContext, handleChunk = null) => {
    const { project_id, agent, options } = assistContext;

    let messages = [];
    messages.push({
        stability: STABILITY_INSTRUCT,
        role: 'developer',
        name: 'instruction',
        content: [
            `You are drafting the next message on behalf of a human agent${describeHumanAgent(assistContext)}.`,
            "UI context: The output will be inserted into the agent's reply box as editable text.",
            "Hard constraints:",
            "- Output only the message text (no commentary).",
            "- Do not invent real-world actions you cannot confirm from context.",
            "- If you need specific website details, use website_search.",
        ].join("\n")
    });

    if(options.agent_message) {
        messages.push({
            stability: STABILITY_INSTRUCT,
            role: 'developer',
            name: 'instruction',
            content: [
                `${agent ? agent.get('first_name') : "The agent"} has started a draft response. This has not been sent to the user.`,
                `Use the draft as your starting point and ${options.agent_tool} it.`,
                "Mode guide:",
                "- complete: finish the draft into a send-ready message",
                "- improve: polish clarity/tone and fix issues",
                "- extend: add helpful detail (without repeating yourself)",
                "- shorten: make it more concise (without losing key info)",
                "Success criteria:",
                "- Preserve the agent's intent and voice.",
                "- Do not introduce contradictions with the draft.",
                "- Use short paragraphs / markdown only when it improves readability.",
            ].join("\n")
        });
    }
    else {
        messages.push({
            stability: STABILITY_INSTRUCT,
            role: 'developer',
            name: 'instruction',
            content: `Write a send-ready response that could plausibly be from ${agent ? agent.get('first_name') : "a human agent"}. Output only the message text.`
        });
    }

    messages = await includeContext(assistContext, messages);

    if(options.agent_message) {
        messages.push({
            role: 'user',
            name: agent ? agent.get('first_name') : 'Agent',
            content: '[draft] '+options.agent_message,
        });
    }

    let tools;
    [messages, tools] = agentTools(messages, assistContext);

    return runStream({
        project_id,
        task: TASKS.AGENT_REPLY,
        tag: 'agent_reply',
        messages: optimizeMessages(messages),
        handleChunk,
        tools,
        options,
    });
};

const getContextFromUrl = (dataContext, url, dataset_files) => {
    let searchUrl = url.trim().toLowerCase().replace(/\/+$/, '');
    const foundFile = dataset_files.find(dataset_file => dataset_file.get('url') === searchUrl);
    if(foundFile) {
        dataContext.push(`On the page ${foundFile.get('url')} titled "${foundFile.get('title')}"\n${foundFile.get('markdown')}`);
    }
    return dataContext
}


/**
 * Reply to the current conversation
 *
 * @param {Object} replyContext
 * @param {function} handleChunk
 * @returns Promise
 */
const makeReply = async (replyContext, handleChunk = null) => {
    const { project_id, options } = replyContext;

    //replyContext.minimal = false;
    let messages = await includeContext(replyContext);

    messages.push({
        stability: STABILITY_INSTRUCT,
        role: 'developer',
        name: 'instruction',
        content: 'Write the next message to send in this conversation. Be helpful and concise; ask a clarifying question when needed. Use markdown where it improves readability. Do not redirect the user to other support channels. You may offer a human handoff only if the user asks or you truly cannot resolve it here. Output only the message text.'
    });

    if(options.instructions && options.instructions.length > 0) {
        options.instructions.forEach(instruction => {
            messages.push({stability: STABILITY_INSTRUCT, role: 'developer', name: 'instruction', content: instruction});
        });
    }
    else {
        messages.push({stability: STABILITY_INSTRUCT, role: 'developer', name: 'instruction', content: 'Please generate the next response in this conversation.'});
    }

    let tools;
    [messages, tools] = replyTools(messages, replyContext);

    const captureThinking = Boolean(options?.retain_thinking && replyContext.local_id);
    const thinking = [];

    const response = await runStream({
        project_id,
        task: TASKS.USER_REPLY,
        tag: 'make_reply',
        messages: optimizeMessages(messages),
        handleChunk,
        tools,
        options,
        trace: captureThinking
            ? {
                onThinking: (msg) => thinking.push(msg),
            }
            : null,
    });

    if (captureThinking && thinking.length > 0) {
        setAssistantThinking(replyContext.local_id, thinking);
    }

    return response;
};

/**
 * Generate an LLM prompt for a response
 *
 * @param {Object} responseContext
 * @param {function} handleChunk
 * @returns Promise
 */
const makeResponse = async (responseContext) => {

    let messages = await includeContext(responseContext);

    return optimizeMessages(messages);
};

module.exports = {
    buildProjectProfile,
    buildContactProfile,
    buildAgentProfile,
    buildOptimizeProfile,
    analyzeCollector,
    makeInsight,
    createSummary,
    agentSuggestions,
    agentReply,
    makeReply,
    makeResponse,
    optimizeContentForContact,
};
