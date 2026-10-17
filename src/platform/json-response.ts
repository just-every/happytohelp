/** A JSON error body with its status, for an HTTPException that must carry a machine-readable code. */
export const jsonResponse=(body:unknown,status:number)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=UTF-8'}})
