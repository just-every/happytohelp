const { z} = require("zod");

const boolean = z.boolean();
const string = z.string().nullable();
const array = z.array(z.string()).nullable();
const percent = z.number().int().nullable();

export const insightSchema = (insightContext) => {
    let { last_insights, connection } = insightContext;
    return z.object({
        ...( last_insights?.length > 0 && !connection?.get('is_proxy') ? {
            already_covered: boolean.describe("True if a recent insight already covered the same topic. Set true to skip sending another similar insight; if true, leave the remaining fields empty."),
        } : null),
        content: string.describe("Proactive Insight text shown to a browsing user (a small, dismissible card near the chat launcher). 1-2 short sentences. Reference an observed theme (pricing, setup, returns, etc.) and offer concrete help without being pushy or creepy. Use minimal formatting only if it improves scanning."),
        buttons: z.array(
            z.object({
                text: z.string().describe("Button label shown to the user. For 'send', write a short, specific response in the user's voice (e.g., asking the offered question). For 'close', use a polite dismissal like 'Not now' or 'No thanks'."),
                action: z.enum(['send', 'close']),
            })
        ).describe("Provide 1 - 2 'send' actions and 1 'close' action."),
        loading: string.describe("Short in-progress message shown after the user clicks a 'send' button (like a typing indicator). Keep it brief and specific to what you're doing (e.g., 'Checking returns...'). Do not include the word 'loading'."),
    });
};

export const collectorSchema = (analysisContext) => {
    let { available_ais, last_insights, connection, contact } = analysisContext;

    let shape = {
        summary: string.describe("Up to 3 sentences summarizing the user's recent actions and messages. Be grounded in what you can see; avoid guessing."),
        who: string.describe("Who is this user in context (e.g., new visitor, returning customer, evaluator)? Keep it tentative."),
        what: string.describe("What are they trying to achieve right now?"),
        next: string.describe("What do you think the user will do next? If unsure, say what's most likely based on observed actions."),
        features: array.describe("What 1-2 features or topics is the user most interested in?"),
    };

    available_ais.pluck('type').forEach(type => {
        switch (type) {
            case 'sales':
                shape[type] = z.object({
                    relevant: boolean.describe(`Would a proactive sales-oriented insight likely help the user move forward (clarify fit, pricing, plan choice, next step) without harming trust?`+(contact.get('is_verified') ? " As the user is logged in, it is less likely they need sales." : "")),
                    insight: string.describe(`What information or reassurance is the user missing to move forward? 1 sentence max. This is NOT the final insight copy. If not relevant, leave blank.`),
                    ...( !connection?.get('is_proxy') ? {
                        wait_for_more: boolean.describe(`Should we wait for more actions before interrupting with an insight? True if the user is still progressing; false if they seem stuck, looping, or hesitating.`)
                    } : null),
                });
                break;
            case 'support':
                shape[type] = z.object({
                    relevant: boolean.describe(`Does the user appear stuck, confused, or blocked and likely to benefit from proactive help?`+(!contact.get('is_verified') ? " As the user is not logged in, it is less likely they need account-specific support." : "")),
                    insight: string.describe(`What is the user stuck on or trying to figure out? 1 sentence max. This is NOT the final insight copy. If not stuck, leave blank.`),
                    ...( !connection?.get('is_proxy') ? {
                        can_continue: boolean.describe(`Can the user likely continue without being interrupted? True if they can proceed on their own; false if they're blocked or repeatedly checking the same thing.`)
                    } : null),
                });
                break;
            case 'billing':
                shape[type] = z.object({
                    relevant: boolean.describe(`Does the user have an issue related to billing or payments?`),
                    insight: string.describe(`What billing issue might the user have? 1 sentence max. This is NOT the final insight copy. If none, leave blank.`),
                });
                break;
        }
    });

    if(last_insights?.length > 0) {
        shape.already_covered = boolean.describe("True if recent insights already covered what the user likely needs right now (avoid sending multiple similar insights).");
    }

    return z.object(shape);
};

export const agentSuggestionsSchema = () => {

    const response = z.object({
        button: z.string()
            .trim()
            .describe("Button label shown to the agent (4 words or less)."),
        response: z.string().describe("Send-ready reply text from the human agent. Use short paragraphs/line breaks/Markdown when helpful."),
    });

    return z.object({
        user_goal: z.string().describe("Short summary of what the user most wants right now."),
        responses: z.array(response)
            .min(3)
            .max(4)
            .describe("3-4 distinct suggested replies, ordered by likelihood of use."),
    });
};

export const projectSchema = () => {
    return z.object({
        describe: z.object({
            value: string.describe("Briefly describe the main products or services this project provides."),
            confidence: percent,
        }),
        short_name: z.object({
            value: string.describe("Provide a short name that people would commonly use to refer to this project."),
            confidence: percent,
        }),
        legal_name: z.object({
            value: string.describe("Specify the full legal name of this project or company."),
            confidence: percent,
        }),
        primary_pages: z.object({
            value: array.describe("What URLs are the most important pages on this website which link to others containing useful information (e.g. homepage, help center, sitemap, storefront, API docs)? Include 4 or less."),
            confidence: percent,
        }),
        type: z.object({
            value: z.enum([
                "saas",         // Software as a Service
                "ecommerce",    // Online Shopping
                "news",         // News and Media
                "blog",         // Blogging or Content Creation
                "education",    // Educational Platform
                "gaming",       // Gaming or Entertainment
                "marketplace",  // Online Marketplace
                "non_profit",   // Non-Profit or Charity
                "portfolio",    // Personal or Company Portfolio
                "forum",        // Community Forum
                "social",       // Social Network
                "finance",      // Financial Services or Fintech
                "healthcare",   // Healthcare or Medical
                "real_estate",  // Real Estate Listings
                "other"         // Any other type
            ]).nullable().describe(
                "Select the category that best describes the type of project, such as 'saas' for software services or 'ecommerce' for online shopping."
            ),
            confidence: percent,
        }),
        business_model: z.object({
            value: z.enum([
                "B2C",          // Business to Consumer
                "B2B",          // Business to Business
                "B2B2C",        // Business to Business to Consumer
                "D2C",          // Direct to Consumer
                "B2G",          // Business to Government
                "non_profit",   // Non-Profit
                "marketplace",  // Marketplace platform
                "hybrid",       // Combination of B2B and B2C
                "other"         // Any other type not listed
            ]).nullable().describe(
                "Select the primary business model that best represents the company, e.g., 'B2C' for direct-to-consumer or 'B2B' for business-to-business."
            ),
            confidence: percent,
        }),
        possible_users: z.object({
            value: z.array(z.enum([
                "visitor",            // First-time or casual visitors exploring content
                "subscriber",         // Paid or registered subscribers (e.g., for news or content sites)
                "registered_user",    // Users with an account (e.g., on social, gaming, or SaaS platforms)
                "customer_client",    // End customers of businesses using the service (e.g., SaaS, marketplaces)
                "buyer",              // Buyers in e-commerce or marketplaces
                "seller",             // Sellers or vendors on marketplaces
                "content_creator",    // Users who create or post content (e.g., on social or forum sites)
                "moderator",          // Site or forum moderators (for community or social sites)
                "trial_user",         // Users in a trial phase (e.g., SaaS or subscription services)
                "student",            // Students using educational platforms
                "teacher",            // Teachers or instructors on educational sites
                "administrator",      // Site or service administrators
                "support_seeker",     // Users looking for help or support
                "developer",          // Developers accessing technical resources or APIs
                "advertiser",         // Advertisers using ad placements (e.g., news, social, or media platforms)
                "partner",            // Business partners or affiliates
                "member",             // Members of a club or organization (e.g., on community or non-profit sites)
                "event_attendee",     // Users attending events (e.g., event booking or informational sites)
                "other"               // Any other user type not listed
            ])).nullable().describe(
                "Select all types that best represent users on this website, such as 'visitor' for casual browsers, 'subscriber' for paid content access, 'buyer' or 'seller' for marketplaces, or 'support_seeker' for those needing help."
            ),
            confidence: percent,
        }),
        brand_personality: z.object({
            value: string.describe("Describe the tone or personality this project conveys on its website, such as friendly, professional, innovative, or bold. Think about the overall impression and mood intended to resonate with users."),
            confidence: percent,
        }),
    });
};

export const projectContentOptimizeSchema = () => {
    return z.object({
        pages: z.array(
            z.object({
                url: string.describe("Page URL"),
                text: string.describe("Original text that you would optimize"),
                selector: string.describe("CSS selector of that text"),
            })
        )
        .describe("We’re looking to optimize content on this site. We can change titles and key paragraphs of text specifically so they more relevant to the user. Please pick 10 titles or paragraphs which would be most useful to optimise. Focus on titles and content on the most important pages. Return page URL, text and a css selector for that text. Avoid legal pages and factual information like pricing."),
    });
};

export const optimizeContentSchema = () => {
    return z.object({
        pages: z.array(
            z.object({
                url: string.describe("Page URL"),
                text: string.describe("Optimized text"),
                selector: string.describe("CSS selector of that text"),
            })
        )
        .describe("These are some titles or paragraphs from the company website. We want to optimise them for this user to make the more relevant and speak to the personal objectives. Please return an optimised version of each piece of text. Try to keep the character length similar to avoid the site layout changing significantly."),
    });
};

export const agentSchema = () => {
    return z.object({
        personality: z.object({
            value: string.describe("Describe the tone or personality of how this agent sounds when responding, such as friendly, professional, innovative, or funny. Think about the overall impression and mood they convey with responses. Use two sentences. This will be used when attempting to generate replies in the same style as this agent."),
            confidence: percent,
        }),
        common_greetings: z.object({
            value: string.describe("What are the most common greetings this agent uses when responding to users? e.g. Hi {contact_name}, thanks for contacting us; Hi there!) - do they often use one - what do they most commonly use? Put {contact_name} in place of the user's name. Provide the most common greeting and explain how other ones might differ."),
            confidence: percent,
        }),
        common_sign_off: z.object({
            value: string.describe("What are the most common sign-offs this agent uses when responding to users? e.g. Best regards, James; Cheers etc..) - do they often use one - what do the most commonly use? Include agent's name if they're using it when signing off. Provide the most common sign off and explain how other ones might differ."),
            confidence: percent,
        }),
        uniqueness: z.object({
            value: string.describe("Is there any common quirks of uniqueness in how this agent responds to users? e.g. they often use the words 'That's interesting' or perhaps they are super enthusiastic about certain topics. Use several sentences."),
            confidence: percent,
        }),
    });
};

export const contactSchema = (context) => {
    const { contact, project } = context;

    const formattedDate = new Intl.DateTimeFormat('en', {
        timeZone: decodeURIComponent(contact.get('timezone') || 'UTC'),
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(new Date());

    return z.object({
        upcoming_events: z.object({
            value: array.describe(
                `Today is ${formattedDate} in ${contact.country('the country')} where the user lives. Are there any upcoming events, holidays, or special occasions they might be planning for or purchasing products/services related to?`
            ),
            confidence: percent,
        }),
        user_type: z.object({
            value: z.enum(project.ai_profile('possible_users', [
                "visitor",             // New or returning visitor exploring the site
                "buyer",               // Actively purchasing
                "subscriber",          // Interested in or currently subscribed to services
                "researcher",          // Gathering information before deciding
                "student",             // Learner or student using educational resources
                "developer",           // Technical user focused on integrations or APIs
                "support_seeker",      // User needing help or support
                "administrator",       // Admin or team lead overseeing account
                "partner",             // Business partner or affiliate
                "client_customer",     // End customer of businesses using the platform
                "influencer",          // User with influence on buying decisions for others
                "other"                // Other type not listed
            ])).nullable().describe("Which category best describes the user's role on our site?"),
            confidence: percent,
        }),
        problem: z.object({
            value: string.describe("Briefly describe the problem or pain point the user is facing that led them to our site."),
            confidence: percent,
        }),
        solutions_needed: z.object({
            value: string.describe("What specific solutions or outcomes is the user seeking?"),
            confidence: percent,
        }),
        job: z.object({
            value: string.describe("What is the user's profession, role, or area of expertise?"),
            confidence: percent,
        }),
        role: z.object({
            value: string.describe("What is the user's role in the decision-making process, e.g., decision-maker, researcher, influencer, or approver?"),
            confidence: percent,
        }),
        risk_profile: z.object({
            value: z.enum([
                "risk_averse",         // Avoids risk; values stability
                "cautious",            // Generally careful with decisions
                "balanced",            // Seeks a middle ground between risk and caution
                "opportunistic",       // Willing to take calculated risks
                "high_risk",           // Comfortable taking high risks
                "unspecified"          // No clear risk profile
            ]).nullable().describe("How willing is the user to take risks in their purchasing or decision-making behavior?"),
            confidence: percent,
        }),
        personality: z.object({
            value: z.enum([
                "concise",             // Prefers short, to-the-point information
                "informative",         // Appreciates detailed, factual information
                "conversational",      // Enjoys a casual, friendly tone
                "creative",            // Values unique and innovative perspectives
                "analytical",          // Focused on logic and data-driven details
                "empathetic",          // Responds to warmth and understanding
                "decisive",            // Values a direct approach to action
                "explorative",         // Likes to explore options and alternatives
                "collaborative"        // Appreciates interaction and teamwork in communication
            ]).nullable().describe("Which personality style best represents how the user prefers to engage with our content and site?"),
            confidence: percent,
        }),
    });
};

export const summarySchema = () => {
    return z.object({
        summary: z.string().describe("Downstream use: this summary replaces raw user activity in later prompts. Keep within the provided word limit and prioritize the user's goal, key actions, and any blockers. Be concise and grounded in observed data."),
    });
};
