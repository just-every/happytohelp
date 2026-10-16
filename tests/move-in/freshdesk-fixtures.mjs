// Freshdesk API v2 objects in the singular wrappers the Move in script writes, wholly synthetic.
// Bodies are plain text: HTML conversion needs the Workers runtime, which the native harness covers.
const at=minutes=>new Date(Date.UTC(2024,0,2,9,minutes)).toISOString();
export const contact={contact:{id:7,name:'Ada Customer',email:'ada@example.test',other_emails:['ada.alt@example.test'],active:true,tags:['vip'],created_at:at(0),updated_at:at(0)}};
export const agent={agent:{id:900,type:'support_agent',available:true,contact:{name:'Historical Teammate',email:'teammate@example.test',created_at:at(0),updated_at:at(0)},created_at:at(0),updated_at:at(0)}};
export function ticket(id=5001,status=4){return {ticket:{id,subject:'Refund question',description:'Where is my refund?',description_text:'Where is my refund?',status,priority:1,source:1,type:'Question',requester_id:7,responder_id:900,spam:false,tags:['Billing'],attachments:[],stats:{resolved_at:status===4?at(30):null,closed_at:null},created_at:at(1),updated_at:at(40),conversations:[
 {id:id*10+1,body:'Private triage',body_text:'Private triage',incoming:false,private:true,user_id:900,source:2,ticket_id:id,attachments:[],created_at:at(5),updated_at:at(5)},
 {id:id*10+2,body:'Refund sent.',body_text:'Refund sent.',incoming:false,private:false,user_id:900,source:0,ticket_id:id,attachments:[{id:77,name:'receipt.pdf',content_type:'application/pdf',size:1200,created_at:at(10),updated_at:at(10)}],created_at:at(10),updated_at:at(10)},
 {id:id*10+3,body:'Thanks!',body_text:'Thanks!',incoming:true,private:false,user_id:7,source:0,ticket_id:id,attachments:[],created_at:at(20),updated_at:at(20)}]}};}
export const cannedResponse={canned_response:{id:31,title:'Refund timing',content:'Refunds take 5 days.',content_html:null,folder_id:3,visibility:0,attachments:[],created_at:at(0),updated_at:at(0)}};
