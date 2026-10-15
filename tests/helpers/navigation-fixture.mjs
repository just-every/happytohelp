import assert from 'node:assert/strict';

export async function navigationFixture(origin) {
  const call = async (path, body, token, method = body === undefined ? 'GET' : 'POST', headers = {}) => {
    const response = await fetch(origin + path, {method, headers: {'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}), ...headers}, body:body === undefined ? undefined : JSON.stringify(body)});
    assert.ok(response.ok, `${method} ${path}: ${response.status} ${await response.clone().text()}`);
    return response.json();
  };
  const email='navigation@example.test', password='synthetic-navigation-regression-password-2026';
  const initial=await call('/api/identity/bootstrap',{email,password,name:'Navigation Alpha',allowedOrigin:origin});
  const owner=await call('/api/identity/login',{email,password});
  const second=await call('/api/management/projects',{name:'Navigation Beta',allowed_origin:origin},owner.token);
  const projects=[];
  for (const [id,name,color,mode] of [[initial.projectId,'Alpha','#2468aa','light'],[second.id,'Beta','#a34567','dark']]) {
    const scoped=await call('/api/identity/switch-project',{projectId:id},owner.token);
    const project=await call(`/api/identity/projects/${id}`,undefined,scoped.token);
    await call(`/api/management/projects/${id}/settings`,{primary_color:color,display_mode:mode,website:`https://${name.toLowerCase()}.example.test`},scoped.token,'PUT');
    const visitor=await call('/api/identity/widget/session',{widgetKey:project.widget_key,name:`${name} Visitor`,email:`${name.toLowerCase()}@example.test`},undefined,'POST',{Origin:origin});
    const conversation=await call('/api/conversations',{projectId:id},visitor.token);
    const message=`${name} private navigation message`;
    await call(`/api/conversations/${conversation.id}/messages`,{localId:`navigation-${name}`,content:message,expectedRevision:0},visitor.token);
    projects.push({id,name,mode,color,message,conversationId:conversation.id});
  }
  return {email,password,projects,call};
}

export async function watchShell(page) {
  await page.evaluate(() => {
    window.navigationProof={document,sidebar:document.querySelector('#sidebar'),timeOrigin:performance.timeOrigin,loading:0,removals:0};
    window.navigationProof.observer=new MutationObserver(records=>{
      const proof=window.navigationProof;
      for(const record of records) for(const removed of record.removedNodes) if(removed===proof.sidebar || removed.contains?.(proof.sidebar)) proof.removals++;
      const isLoading=text=>/Loading (?:your )?workspace/.test(text||'');
      if(isLoading(document.body.innerText)||records.some(record=>[...record.addedNodes].some(node=>isLoading(node.textContent))))proof.loading++;
    });
    window.navigationProof.observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  });
  return page.evaluate(()=>performance.timeOrigin);
}

export async function assertShell(page, timeOrigin, label) {
  const proof=await page.evaluate(()=>({timeOrigin:performance.timeOrigin,document:window.navigationProof?.document===document,sidebar:window.navigationProof?.sidebar===document.querySelector('#sidebar'),loading:window.navigationProof?.loading,removals:window.navigationProof?.removals}));
  assert.deepEqual(proof,{timeOrigin,document:true,sidebar:true,loading:0,removals:0},label);
}
