// Handwritten structural boundaries: unknown containers are not record kinds.
// Expected locations name the refused container, not a guessed descendant.
export const nestedRecord={type:'contact',id:'nested-81',name:'Imani',email:'imani@example.test',external_id:'external-81',created_at:1711929600};
export function nestedCases(record=nestedRecord){return [
 ['object.json','{\n"type":"list",\n"a/b~c": {"box":'+JSON.stringify(record)+'}\n}',3,'/a~1b~0c'],
 ['array.json','{\n"kind":"list",\n"": [\n['+JSON.stringify(record)+']\n]}',4,'//0'],
 ['line.jsonl','\n\n'+JSON.stringify({type:'list',unknown:{a:[{b:[record]}]}}),3,'/unknown'],
 ['objects.json',JSON.stringify({type:'list',unknown:[{container:{inner:[record]}}]}),1,'/unknown/0'],
 ];}
export const nestedUpload=(body,name)=>({method:'POST',headers:{'X-Import-Filename':name,'X-Import-Schema':'2.16'},body});
