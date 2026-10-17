import {categories,invalid,named,object} from './model'
export function statusDefinition(value:unknown){const body=object(value);if(!categories.includes(body.category))invalid('Choose a valid status category');return {name:named(body.name),category:body.category}}
