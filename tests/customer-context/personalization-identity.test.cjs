const test=require('node:test'),assert=require('node:assert/strict')
const {personalizationFingerprint}=require('../../src/modules/customer-context/profiles/personalization.js')
test('public copy identity ignores private provenance changes while retaining broad category changes',()=>{
 const packet={version:'profile-evidence.v3',company_identity:{name:'Company'},trusted_configuration:{},approved_content:[{id:'copy',text:'Helpful products'}],approved_broad_personalization:[{key:'personality',value:'concise',confidence:70,evidence_ids:['private-1']}]}
 const changed=structuredClone(packet);changed.approved_broad_personalization[0].confidence=95;changed.approved_broad_personalization[0].evidence_ids=['private-2'];assert.equal(personalizationFingerprint(packet),personalizationFingerprint(changed));changed.approved_broad_personalization[0].value='informative';assert.notEqual(personalizationFingerprint(packet),personalizationFingerprint(changed))
})

test('contact schema accepts the native persisted project profile representation',()=>{
 const {contactSchema}=require('../../src/modules/customer-context/profiles/schemas.js')
 const candidate=Object.fromEntries(['upcoming_events','user_type','problem','solutions_needed','job','role','risk_profile','personality'].map(key=>[key,{value:null,confidence:null,evidence_ids:[],evidence_status:'unknown'}]));candidate.user_type={value:'developer',confidence:80,evidence_ids:['message:1'],evidence_status:'supported'}
 assert.equal(contactSchema({project:{ai_profile:{possible_users:{value:['developer']}}}}).safeParse(candidate).success,true)
})
