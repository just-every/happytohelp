import assert from 'node:assert/strict';
import {inspectState} from './qualification-kit.mjs';

export async function routeVariants({page,origin,projectId,width,records,evidence,run}){
 const project=['conversations','conversations/missing-conversation','ais/missing-ai','macros/missing-macro','agents/missing-agent','plugins/missing-plugin','datasets/missing-dataset','categories/missing-category','training-runs/missing-run','insights/missing-insight'];
 const routes=project.map(path=>({path:`/projects/${projectId}/${path}`,name:path,header:'Route workspace'}));
 for(const path of ['/projects','/projects/create','/conversations','/users/profile','/admin','/admin/users','/admin/ai_defaults/create','/admin/leads/create'])routes.push({path,name:path,header:'Global Inbox'});
 routes.push({path:'/local-agent/authorize?user_code=ABCD-EFGH',name:'local-agent-authorize',header:'Route workspace'});
 routes.push({path:'/projects/missing-project/conversations',name:'missing-workspace',header:'Workspace unavailable'});
 for(const {path,name,header} of routes)await run(`${width}-route-${name}`,async()=>{
  await page.goto(origin+path);assert.equal(new URL(page.url()).pathname,new URL(origin+path).pathname);
  // The workspace is named by the sidebar's switcher (the administration rail has none).
  await (path.startsWith('/admin')?page.locator('#sidebar'):page.getByRole('button',{name:'Switch workspace: '+header,exact:true})).waitFor();
  await page.waitForLoadState('networkidle');await inspectState(page,records,evidence,`${width}-route-${name.replaceAll('/','-')}`);
  return {workspaceHeader:header};
 });
}
