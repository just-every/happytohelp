import React,{useState} from 'react';
import {nativeRequest} from '../transport';
export default function AvatarUpload({projectId,value,onChange}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const upload=async e=>{const file=e.target.files[0];if(!file)return;setBusy(true);setError('');try{const body=new FormData();body.append('file',file);const result=await nativeRequest(`/api/management/projects/${projectId}/brand-media`,{method:'POST',body});onChange(result.url);}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="form-group mb-4"><label className="form-label" htmlFor="avatar-upload">Avatar</label><div className="d-flex align-items-center gap-3">{value&&<img src={value} alt="Current avatar" className="avatar avatar-lg rounded-circle"/>}<input id="avatar-upload" type="file" accept="image/png,image/jpeg" disabled={busy} onChange={upload}/>{value&&<button type="button" className="btn btn-white" onClick={()=>onChange('')}>Remove</button>}</div>{error&&<p className="text-danger" role="alert">{error}</p>}</div>;
}
