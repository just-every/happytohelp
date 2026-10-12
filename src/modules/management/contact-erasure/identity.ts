export function contactEmails(row:{email?:unknown;metadata_json?:string|null}){
 let metadata:Record<string,unknown>={};try{metadata=JSON.parse(row.metadata_json||'{}')}catch{}
 return [...new Set([row.email,metadata.provided_email].filter((value):value is string=>typeof value==='string'&&!!value.trim()).map(value=>value.trim().toLowerCase()))]
}
