import { fields,safeKeys } from './ui/seed.mjs';
import { validateInput } from './inputs.mjs';
import { install } from './run.mjs';
import { resolveAddress } from './address.mjs';
import { agentHandoff } from './agent-handoff.mjs';
import { createWorkspaceArt,imageLimit } from './workspace-art.mjs';
import { createArtworkBridge } from './artwork-bridge.mjs';
export const seed={
 product:'HappyToHelp',features:{hosting:true,email:true,github:true,artwork:true},browserModule:'scripts/installer/ui/seed.mjs',background:'public/setup/ocean.png',
 model:{fields,safeKeys,secretScopes:{password:['email'],apiToken:['accountId'],emailApiKey:['emailProvider','emailAccountId']}},
 defaults:info=>({target:'local',ownerName:info.name||'',email:info.email||'',name:'',primaryColor:'#7c3aed',accountId:info.cloudflareAccount||''}),
 validateInput,install,resolveAddress,handoff:agentHandoff,
 async artwork(root,store){const artworkBridge=createArtworkBridge({onStatus:status=>{store.state.workspaceArtTransfer=status;}});const workspaceArt=await createWorkspaceArt(root,store,{onSidebar:asset=>artworkBridge.deliver(asset)});return {workspaceArt,artworkBridge,imageLimit};},
};
