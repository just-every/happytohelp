import React,{useEffect,useState} from 'react';
import {nativeRequest} from '../../transport';
import {Section} from '../forms';
import {useConfirmation} from '../ConfirmDialog';
import {AuthenticatorSetup,PasskeySetup,RecoveryCodes} from '../../../identity/two-factor/parts';
import '../stack-table.css';
import './security.css';

const KINDS={totp:'Authenticator app',webauthn:'Passkey or security key'};
const when=value=>value?new Date(value).toLocaleDateString(undefined,{dateStyle:'medium'}):'Never';

/** Profile → Security: this account's authenticator apps, passkeys and recovery codes. */
export default function TwoFactorSettings(){
 const {ask,dialog}=useConfirmation();
 const [status,setStatus]=useState(null),[adding,setAdding]=useState(null),[codes,setCodes]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=()=>nativeRequest('/api/identity/two-factor').then(setStatus).catch(e=>setError(e.message));
 useEffect(()=>{load()},[]);
 const added=result=>{setAdding(null);setNotice('Two-factor sign-in is on.');if(result)setCodes(result);load();};
 const remove=factor=>ask({title:`Remove “${factor.label}”?`,confirmLabel:'Remove',busyLabel:'Removing…',
  body:<p>{status.factors.length===1?'This is your last factor: two-factor sign-in turns off and your recovery codes stop working.':'You can still sign in with your other factors.'}</p>,
  run:async()=>{await nativeRequest(`/api/identity/two-factor/factors/${factor.id}`,{method:'DELETE'});setNotice('Removed.');await load();}});
 const regenerate=async()=>{setError('');try{setCodes((await nativeRequest('/api/identity/two-factor/recovery-codes',{method:'POST'})).recoveryCodes);await load();}catch(e){setError(e.message)}};
 if(!status)return error?<div role="alert" className="alert alert-danger">{error}</div>:null;
 const on=status.factors.length>0;
 return <Section title="Two-factor sign-in" description="After your password, sign in with a code from an authenticator app or with a passkey. Sensitive actions such as exports, erasure and role changes ask for it again after 15 minutes.">
  {error&&<div role="alert" className="alert alert-danger">{error}</div>}{notice&&<div role="status" className="alert alert-success">{notice}</div>}
  {codes&&<RecoveryCodes codes={codes} look="dashboard" onDone={()=>setCodes(null)} doneLabel="Done"/>}
  {!codes&&<>
   <p><span className={`security-badge${on?' security-badge--on':''}`}>{on?'On':'Off'}</span>{status.required&&!on&&<strong> Your workspace requires it.</strong>}</p>
   {on&&<div className="table-responsive"><table className="table stack-table"><thead><tr><th>Factor</th><th>Added</th><th>Last used</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
    {status.factors.map(factor=><tr key={factor.id}><td data-label="Factor"><span>{factor.label}<br/><small className="text-muted">{KINDS[factor.kind]}</small></span></td><td data-label="Added">{when(factor.created_at)}</td><td data-label="Last used">{when(factor.last_used_at)}</td><td className="stack-table__actions"><span className="row-actions-inline"><button type="button" onClick={()=>remove(factor)}>Remove</button></span></td></tr>)}
   </tbody></table></div>}
   {on&&<p>{status.recoveryCodesRemaining} of 10 recovery codes left. <button type="button" className="btn btn-link px-0" onClick={regenerate}>Generate new codes</button></p>}
   {adding==='totp'?<AuthenticatorSetup look="dashboard" onDone={added} onCancel={()=>setAdding(null)}/>
    :adding==='passkey'?<><PasskeySetup look="dashboard" onDone={added}/><button type="button" className="btn btn-link px-0" onClick={()=>setAdding(null)}>Cancel</button></>
    :<div className="tf-actions"><button type="button" className="btn btn-primary" onClick={()=>setAdding('totp')}>Add an authenticator app</button><button type="button" className="btn btn-white" onClick={()=>setAdding('passkey')}>Add a passkey or security key</button></div>}
  </>}
  {dialog}
 </Section>;
}
