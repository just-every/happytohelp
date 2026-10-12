// Test network edge only: no external service is contacted by the emitted Worker.
export default async request=>{
 const url=new URL(request.url);
 if(url.origin==='https://receiver.example.com'||url.href==='https://slack.com/api/chat.postMessage')return new Response('',{status:401});
 throw Error('External request prohibited');
};
