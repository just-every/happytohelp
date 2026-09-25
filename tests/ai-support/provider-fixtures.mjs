// Network boundary fixtures only: these never enter application source.
const sse=events=>new Response(events.map(e=>`${e.type?`event: ${e.type}\n`:''}data: ${JSON.stringify(e)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}})
export function providerFixture(host,text='Provider fixture answer'){
 if(host==='api.anthropic.com')return sse([
 {type:'message_start',message:{id:'m1',type:'message',role:'assistant',content:[],usage:{input_tokens:12,output_tokens:0,cache_creation_input_tokens:0,cache_read_input_tokens:0,cache_creation:{ephemeral_5m_input_tokens:0,ephemeral_1h_input_tokens:0}}}},
 {type:'content_block_start',index:0,content_block:{type:'text',text:''}},
 {type:'content_block_delta',index:0,delta:{type:'text_delta',text}},
 {type:'content_block_stop',index:0},
 {type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:4}},
 {type:'message_stop'}])
 if(host==='generativelanguage.googleapis.com')return sse([{candidates:[{content:{role:'model',parts:[{text}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:12,candidatesTokenCount:4,totalTokenCount:16,cachedContentTokenCount:0,thoughtsTokenCount:0}}])
 if(['api.deepseek.com','api.x.ai','openrouter.ai'].includes(host))return sse([
 {id:'c1',choices:[{index:0,delta:{role:'assistant',content:text},finish_reason:null}]},
 {id:'c1',choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:12,completion_tokens:4,total_tokens:16,prompt_tokens_details:{cached_tokens:0,cache_write_tokens:0},completion_tokens_details:{reasoning_tokens:0}}}])
 throw new Error(`Unexpected provider host ${host}`)
}
