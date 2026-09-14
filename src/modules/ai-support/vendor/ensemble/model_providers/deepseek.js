import { OpenAIChat } from './openai_chat.js';
import { applyDeepSeekV4Contract } from './deepseek_v4_contract.js';
import { appendJsonSchemaInstruction, getJsonSchemaFromResponseFormat } from '../utils/structured_output.js';
export class DeepSeekProvider extends OpenAIChat {
    constructor(apiKey) {
        super('deepseek', apiKey, 'https://api.deepseek.com/v1');
    }
    prepareParameters(requestParams) {
        const jsonSchema = getJsonSchemaFromResponseFormat(requestParams.response_format);
        const params = applyDeepSeekV4Contract(super.prepareParameters(requestParams));
        if (jsonSchema) {
            params.response_format = { type: 'json_object' };
            params.messages = appendJsonSchemaInstruction(params.messages, jsonSchema);
        }
        return params;
    }
}
export const deepSeekProvider = new DeepSeekProvider();
