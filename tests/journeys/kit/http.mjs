// A JSON client for a running HappyToHelp origin; every request goes through its real HTTP door.
export function client(origin){
 const request=(path,{body,token,method=body===undefined?'GET':'POST',headers={},raw=false}={})=>fetch(origin+path,{method,redirect:'manual',headers:{...(body!==undefined&&!raw?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{}),...headers},body:body===undefined?undefined:raw?body:JSON.stringify(body)})
 // `call` returns status, headers and parsed body; `status` makes an unexpected status fail with its body.
 const call=async(path,options={})=>{
  const response=await request(path,options),text=await response.text();let data
  try{data=text?JSON.parse(text):null}catch{data=text}
  if(options.status!==undefined&&response.status!==options.status)throw new Error(`${options.method||(options.body===undefined?'GET':'POST')} ${path}: expected ${options.status}, got ${response.status}: ${text.slice(0,500)}`)
  return {status:response.status,headers:response.headers,data}
 }
 const ok=async(path,options={})=>{const {status,data}=await call(path,options);if(status<200||status>299)throw new Error(`${path}: ${status} ${JSON.stringify(data).slice(0,500)}`);return data}
 return {origin,request,call,ok}
}
