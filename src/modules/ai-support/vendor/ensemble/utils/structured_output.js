import { processSchemaForOpenAI } from './json_schema.js';
function firstSchemaType(schema) {
    if (typeof schema.type === 'string')
        return schema.type;
    if (Array.isArray(schema.type)) {
        return schema.type.find((value) => typeof value === 'string' && value !== 'null');
    }
    return undefined;
}
function exampleFromSchema(schema, depth = 0) {
    if (!schema || typeof schema !== 'object' || depth > 4)
        return null;
    const typedSchema = schema;
    if (typedSchema.const !== undefined)
        return typedSchema.const;
    if (Array.isArray(typedSchema.enum) && typedSchema.enum.length > 0)
        return typedSchema.enum[0];
    if (Array.isArray(typedSchema.anyOf) && typedSchema.anyOf.length > 0) {
        return exampleFromSchema(typedSchema.anyOf[0], depth + 1);
    }
    if (Array.isArray(typedSchema.oneOf) && typedSchema.oneOf.length > 0) {
        return exampleFromSchema(typedSchema.oneOf[0], depth + 1);
    }
    const type = firstSchemaType(typedSchema);
    if (type === 'object' || typedSchema.properties) {
        const example = {};
        const properties = typedSchema.properties && typeof typedSchema.properties === 'object' ? typedSchema.properties : {};
        const keys = Object.keys(properties);
        const required = Array.isArray(typedSchema.required)
            ? typedSchema.required.filter((value) => typeof value === 'string')
            : keys;
        for (const key of required.length > 0 ? required : keys) {
            example[key] = exampleFromSchema(properties[key], depth + 1);
        }
        return example;
    }
    if (type === 'array')
        return [exampleFromSchema(typedSchema.items, depth + 1)];
    if (type === 'string')
        return typeof typedSchema.description === 'string' ? typedSchema.description : 'string';
    if (type === 'integer')
        return Number.isFinite(typedSchema.minimum) ? Math.ceil(typedSchema.minimum) : 1;
    if (type === 'number')
        return Number.isFinite(typedSchema.minimum) ? typedSchema.minimum : 1;
    if (type === 'boolean')
        return true;
    if (type === 'null')
        return null;
    return null;
}
export function createChatJsonSchemaResponseFormat(jsonSchema) {
    const { type: _type, schema, ...jsonSchemaConfig } = jsonSchema;
    return {
        type: 'json_schema',
        json_schema: {
            ...jsonSchemaConfig,
            schema: processSchemaForOpenAI(schema, undefined, 'json_schema'),
        },
    };
}
export function getJsonSchemaFromResponseFormat(responseFormat) {
    if (!responseFormat || typeof responseFormat !== 'object')
        return undefined;
    const typedFormat = responseFormat;
    if (typedFormat.type !== 'json_schema' || !typedFormat.json_schema || typeof typedFormat.json_schema !== 'object') {
        return undefined;
    }
    const jsonSchema = typedFormat.json_schema;
    if (!jsonSchema.schema || typeof jsonSchema.schema !== 'object')
        return undefined;
    return jsonSchema;
}
export function createJsonSchemaInstruction(jsonSchema) {
    const example = exampleFromSchema(jsonSchema.schema);
    return [
        'Respond only with valid JSON.',
        'Do not include markdown fences, prose, comments, or any text outside the JSON value.',
        'The response must match this JSON Schema:',
        JSON.stringify(jsonSchema.schema, null, 2),
        'Example JSON output:',
        JSON.stringify(example, null, 2),
    ].join('\n');
}
export function appendJsonSchemaInstruction(messages, jsonSchema) {
    return [
        ...messages,
        {
            role: 'system',
            content: createJsonSchemaInstruction(jsonSchema),
        },
    ];
}
