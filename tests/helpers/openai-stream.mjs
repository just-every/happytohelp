// The OpenAI Responses streaming protocol, for provider fixtures at the network edge only.
// `answer(name,body)` returns the structured result for a named response format, or text.
export function openaiStream(value,usage={input_tokens:20,output_tokens:12}){
 const text=typeof value==='string'?value:JSON.stringify(value)
 const events=[{type:'response.output_text.delta',item_id:'msg',delta:text},{type:'response.output_text.done',item_id:'msg',text},{type:'response.completed',response:{usage:{...usage,total_tokens:usage.input_tokens+usage.output_tokens,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:0}}}}]
 return new Response(events.map(event=>`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}})
}
export const formatName=body=>body?.text?.format?.name
