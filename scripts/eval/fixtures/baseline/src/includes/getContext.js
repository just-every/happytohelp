const {randomUUID} = require("node:crypto");
const Message = require("../models/message");
const Dataset = require("../models/dataset");
const DatasetFile = require("../models/dataset_file");
const AI = require("../models/ai");
const CollectorSummary = require("../models/collector_summary");
const CollectorAction = require("../models/collector_action");
const {bookshelf, knex} = require("../config/db");
const Conversation = require("../models/conversation");
const Connection = require("../models/connection");
const Project = require("../models/project");
const Contact = require("../models/contact");
const Insight = require("../models/insight");
const User = require("../models/user");
const MessageThinking = require("../models/message_thinking");
const { decryptData } = require("./secure");
const { log } = require("../config/log");

const NON_ENCRYPTED_ACTIONS_ALLOWED = true; // @todo remove this after all actions have contact_shared_key_id (i.e. one month after deploy)

const getContactSharedKeys = async (project_id, contact_id, currentConnection, retrievals) => {
    if(project_id && contact_id && retrievals.includes('actions')) {

        const contactConnection = currentConnection.get('contact_id') === contact_id && currentConnection.get('contact_shared_key_id')
            ? currentConnection :
            (project_id && contact_id ? await Connection.forge().query(qb => qb
                .where({ project_id, contact_id })
                .where((wqb) => { wqb
                    .whereNot('contact_shared_key',null);
                })
                .orderBy('updated_at', 'DESC')
                .limit(1)
            ).fetch({ require: false }) : null);

        // @todo should we do any clean up here for multiple contact_shared_key_ids? Or will ContactSharedKey.migrateSharedKeys always handle this?

        if(contactConnection) {
            return {
                contact_shared_key: contactConnection.get('contact_shared_key'),
                contact_shared_key_id: contactConnection.get('contact_shared_key_id'),
            };
        }
    }
    return {
        contact_shared_key: false,
        contact_shared_key_id: false,
    };
}

const createThinkingEntry = (thinkingRow, message, content) => {
    const attributes = {
        id: thinkingRow.id ? `thinking-${thinkingRow.id}` : `thinking-${message.id || 'unknown'}-${thinkingRow.get('seq')}`,
        project_id: thinkingRow.get('project_id') || message.get('project_id'),
        conversation_id: thinkingRow.get('conversation_id') || message.get('conversation_id'),
        bucket_id: message.get('bucket_id'),
        contact_id: null,
        agent_id: message.get('agent_id'),
        content,
        created_at: thinkingRow.get('created_at') || message.get('created_at'),
        thinking_id: thinkingRow.get('thinking_id'),
        model: thinkingRow.get('model'),
        signature: thinkingRow.get('signature'),
        seq: thinkingRow.get('seq'),
        type: 'thinking',
    };

    // Must be a real model: `new bookshelf.Collection()` coerces anything that isn't
    // an instance of ModelBase, which would replace these attributes with the object's
    // own keys and leave `related('media')` undefined downstream.
    return Message.forge(attributes);
};

const enrichHistoryWithThinking = async (collection) => {
    if(!collection?.models?.length) {
        return collection;
    }

    const messageIds = collection.models.map((message) => message?.id).filter(Boolean);
    if(messageIds.length === 0) {
        return collection;
    }

    const thinkingRows = await MessageThinking.findAllForMessageIds(messageIds);
    if(!thinkingRows.length) {
        return collection;
    }

    const thinkingByMessageId = new Map();
    thinkingRows.forEach((thinking) => {
        const messageId = thinking.get('message_id');
        if(!messageId) {
            return;
        }

        if(!thinkingByMessageId.has(messageId)) {
            thinkingByMessageId.set(messageId, []);
        }

        thinkingByMessageId.get(messageId).push(thinking);
    });

    const enriched = [];
    collection.models.forEach((message) => {
        if(!message) {
            return;
        }

        const isAssistantMessage = !message.get('contact_id');
        if(isAssistantMessage) {
            const thinkings = thinkingByMessageId.get(message.id) || [];
            thinkings.forEach((thinking) => {
                const thinkingContent = (thinking.get('content') || '').trim();
                if(!thinkingContent) {
                    return;
                }

                enriched.push(createThinkingEntry(thinking, message, thinkingContent));
            });
        }

        enriched.push(message);
    });

    return new bookshelf.Collection(enriched);
};

const getContext = async (type, currentConnection, retrievals, params = {}) => {
    const project_id = currentConnection.get('project_id');
    const contact_id = (params.conversation ?? currentConnection).get('contact_id');
    const conversation_id = params.conversation ? params.conversation.get('id') : currentConnection.get('conversation_id');

    const { contact_shared_key, contact_shared_key_id } = await getContactSharedKeys(project_id, contact_id, currentConnection, retrievals);
    const short_context = ['reply', 'assist'].includes(type);

    const handlers = {
        ai:             project_id && params.ai_id ? () => AI.where('id', params.ai_id).where('project_id', project_id).fetch({ withRelated: ['ai_default'], require: false }) : null,
        available_ais:  project_id ? () => AI.findAll({ project_id, is_enabled: 1 }, { withRelated: ['ai_default'], require: false }) : null,
        datasets:       project_id ? () => Dataset.getReadyCollections(project_id) : null,
        dataset_files:   project_id ? () => DatasetFile.forge()
            .query(qb => qb
                .where({ project_id })
                .orderBy('rank', 'DESC')
                .limit(130)
            )
            .fetchAll() : null,
        history:        project_id && conversation_id ? () => Message.forge()
            .query(qb => qb
                .where({ project_id, conversation_id })
                .where((wqb) => { wqb
                    .whereNot('contact_id',null)
                    .orWhereNot('agent_id',null);
                })
                .orderBy('created_at', 'DESC')
                .limit(110)
            )
            .fetchAll({ withRelated: [ 'media', 'media.variants' ] })
            .then(collection => new bookshelf.Collection(collection.models.reverse()))
            .then(enrichHistoryWithThinking) : null,
        summaries:      project_id && contact_id ? () => CollectorSummary.forge()
            .query(qb => qb
                .where({ project_id, contact_id })
                .orderBy('end_at', 'DESC')
                .limit(short_context ? 110 : 200)
            )
            .fetchAll()
            .then(collection => new bookshelf.Collection(collection.models.reverse())) : null,
        actions:        project_id && contact_id && (contact_shared_key_id || (NON_ENCRYPTED_ACTIONS_ALLOWED && currentConnection.get('contact_id'))) ? () => CollectorAction.forge()
            .query(qb => qb
                .where({ project_id, contact_id })
                .where((wqb) => {
                    if(NON_ENCRYPTED_ACTIONS_ALLOWED) {
                        wqb.where('contact_shared_key_id', null);
                    }
                    if(contact_shared_key_id) {
                        wqb.orWhere('contact_shared_key_id', contact_shared_key_id);
                    }
                    return wqb;
                })
                .orderBy('created_at', 'DESC')
                .limit(short_context ? 210 : 400)
            )
            .fetchAll()
            .then(async collection => {
                return await Promise.all(collection.models.reverse().filter(async (action) => {
                    if(!action.get('contact_shared_key_id')) {
                        if(NON_ENCRYPTED_ACTIONS_ALLOWED) {
                            return action.set_decrypted_action(action.get('action'));
                        }
                    }
                    else {
                        try {
                            return action.set_decrypted_action(await decryptData(contact_shared_key, JSON.parse(action.get('action')), 'collector'));
                        } catch (e) {
                            log.error('Error while decrypting collector action', e);
                        }
                    }

                    return false;
                }));
            })
            .then(models => new bookshelf.Collection(models)) : null,
        conversation:   project_id && contact_id ? () => Conversation.findOrCreate({ project_id, contact_id }) : null,
        project:        project_id ? () => Project.findById(project_id) : null,
        contact:        contact_id ? () => Contact.findById(contact_id) : null,
        agent:          params.agent_id ? () => User.findById(params.agent_id) : null,
        agent_messages: project_id && currentConnection.get('agent_id') ? () => Message.forge()
            .query(qb => qb
                .where({ project_id })
                .where('agent_id', currentConnection.get('agent_id'))
                .orderBy('created_at', 'DESC')
                .limit(110)
            )
            .fetchAll()
            .then(collection => new bookshelf.Collection(collection.models.reverse())) : null,
        last_insights:  project_id && contact_id ? () => Insight.forge()
            .query(qb => qb
                .where({ project_id, contact_id })
                .where('updated_at', '>', knex.raw('NOW() - INTERVAL 1 WEEK'))
                .orderBy('created_at', 'DESC')
                .limit(3)
            )
            .fetchAll()
            .then(collection => new bookshelf.Collection(collection.models.reverse())) : null,
    };

    const results = await Promise.all(retrievals.map(key => handlers[key]?.() ?? null));
    return {
        type,
        project_id,
        contact_id,
        conversation_id,
        connection: currentConnection,
        ...Object.fromEntries(retrievals.map((key, index) => [key, results[index]]))
    };
};

const getProjectContext = async (currentConnection) =>
    getContext('project', currentConnection, ['available_ais', 'datasets', 'dataset_files']);

const getOptimizeContext = async (currentConnection) =>
    getContext('optimize', currentConnection, ['project', 'datasets', 'dataset_files']);

const getContactContext = async (currentConnection) =>
    getContext('contact', currentConnection, ['history', 'summaries', 'actions', 'project']);

const getOptimizeContactContext = async (currentConnection) =>
    getContext('optimizeContact', currentConnection, ['contact', 'history', 'summaries', 'actions', 'project']);

const getAgentContext = async (currentConnection) =>
    getContext('agent', currentConnection, ['agent', 'agent_messages']);

const getAnalysisContext = async (currentConnection) =>
    getContext('analysis', currentConnection, ['available_ais', 'summaries', 'actions', 'conversation', 'project', 'contact', 'last_insights']);

const getInsightContext = async (currentConnection, ai, insight_analysis) => ({
    ai,
    insight_analysis,
    ...(await getContext('insight', currentConnection, ['available_ais', 'history', 'summaries', 'actions', 'conversation', 'project', 'contact', 'last_insights'])),
});

const getReplyContext = async (ai_id, conversation, currentConnection, options, local_id = null) => ({
    local_id: local_id || randomUUID(),
    conversation,
    options,
    ...(await getContext('reply', currentConnection, ['ai', 'available_ais', 'datasets', 'dataset_files', 'history', 'summaries', 'actions', 'project', 'contact'], { ai_id, conversation })),
});

const getAssistContext = async (conversation, currentConnection, options, agent_id) => ({
    conversation,
    options,
    ...(await getContext('assist', currentConnection, ['datasets', 'dataset_files', 'history', 'summaries', 'actions', 'project', 'contact', 'agent'], { agent_id, conversation })),
});
module.exports = {
    getContext,
    getProjectContext,
    getContactContext,
    getAgentContext,
    getOptimizeContext,
    getOptimizeContactContext,
    getAnalysisContext,
    getInsightContext,
    getReplyContext,
    getAssistContext,
};
