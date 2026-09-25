import { OpenAIChat } from './openai_chat.js';
import { appendJsonSchemaInstruction, getJsonSchemaFromResponseFormat } from '../utils/structured_output.js';
import { findModel } from '../data/model_data.js';
function supportsNativeStructuredOutput(model) {
    return findModel(model)?.features?.structured_output === true;
}
export class OpenRouterProvider extends OpenAIChat {
    constructor(apiKey) {
        super('openrouter', apiKey, 'https://openrouter.ai/api/v1', {
            'User-Agent': 'HappyToHelp',
            'HTTP-Referer': 'https://github.com/just-every/happytohelp',
            'X-Title': 'HappyToHelp',
        }, {
            provider: {
                require_parameters: true,
                sort: 'throughput',
                ignore: ['Novita'],
            },
        });
    }
    prepareParameters(requestParams) {
        requestParams = super.prepareParameters(requestParams);
        const openRouterParams = requestParams;
        const jsonSchema = getJsonSchemaFromResponseFormat(openRouterParams.response_format);
        if (jsonSchema && openRouterParams.model.startsWith('deepseek/')) {
            openRouterParams.response_format = { type: 'json_object' };
            openRouterParams.messages = appendJsonSchemaInstruction(openRouterParams.messages, jsonSchema);
            return openRouterParams;
        }
        if (jsonSchema && supportsNativeStructuredOutput(openRouterParams.model)) {
            openRouterParams.structured_outputs = true;
            return openRouterParams;
        }
        if (jsonSchema) {
            openRouterParams.response_format = { type: 'json_object' };
            openRouterParams.messages = appendJsonSchemaInstruction(openRouterParams.messages, jsonSchema);
        }
        return openRouterParams;
    }
}
export const openRouterProvider = new OpenRouterProvider();
