import React, { useEffect, useState } from 'react';

export default function WorkspaceSidebarArtwork({ project }) {
 const [current,setCurrent] = useState(project);
 useEffect(()=>setCurrent(project),[project]);
 useEffect(()=>{
  const update = event => {
   if(event.detail.projectId===project?.id) setCurrent(previous=>({...previous,sidebar_artwork_enabled:event.detail.artwork_enabled}));
  };
  window.addEventListener('workspace-artwork',update);
  return ()=>window.removeEventListener('workspace-artwork',update);
 },[project?.id]);
 if (!project || current?.id!==project.id || !current?.sidebar_artwork_enabled || !current.sidebar_artwork_url) return null;
 return <img className="workspace-sidebar-artwork" src={current.sidebar_artwork_url} alt="" aria-hidden="true"/>;
}
