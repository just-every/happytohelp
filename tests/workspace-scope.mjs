import assert from 'node:assert/strict';
import test from 'node:test';
import {actsOnSessionProject,isInboxPath,projectIdFromPath} from '../src/ui/native/workspace-scope.ts';

test('the project in a dashboard URL is the only thing that selects a workspace',()=>{
 assert.equal(projectIdFromPath('/projects/abc/conversations/c1'),'abc');
 assert.equal(projectIdFromPath('/projects/abc'),'abc');
 assert.equal(projectIdFromPath('/projects/a%20b/edit'),'a b');
 assert.equal(projectIdFromPath('/projects/%E0%A4%A/edit'),'%E0%A4%A','a malformed escape is passed through, so the server refuses it as an unknown project');
 for(const path of ['/projects','/projects/','/projects/create','/conversations','/users/profile','/admin'])assert.equal(projectIdFromPath(path),undefined,path);
});

test('only the pairing page acts on the session project without naming it',()=>{
 assert.equal(actsOnSessionProject('/local-agent/authorize'),true);
 assert.equal(actsOnSessionProject('/local-agent/authorize/'),true);
 for(const path of ['/local-agent','/projects/p/local-agent','/users/profile','/conversations'])assert.equal(actsOnSessionProject(path),false,path);
});

test('the inbox renders for inbox paths unless the account has no project or the URL project is unavailable',()=>{
 for(const path of ['/','/conversations','/conversations/c','/projects/p/conversations','/projects/p/conversations/c'])assert.equal(isInboxPath(path,{}),true,path);
 for(const path of ['/projects','/projects/p/edit','/users/profile'])assert.equal(isInboxPath(path,{}),false,path);
 assert.equal(isInboxPath('/projects/p/conversations',{projectUnavailable:'p'}),false,'an unavailable project never renders the inbox');
 assert.equal(isInboxPath('/conversations',{accountOnly:true}),false);
});
