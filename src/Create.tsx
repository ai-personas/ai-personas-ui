import { useEffect, useState } from 'preact/hooks';
import { data, label, request, type Model } from './api';
import { useRecords } from './hooks';
import { Pagination, type Act } from './main';
export function Pick({kind,multiple,value,onChange}:{kind:string;multiple?:boolean;value:string[];onChange:(ids:string[])=>void}) {
  const [query,setQuery]=useState('');const [cursors,setCursors]=useState([0]);const {value:page}=useRecords(kind,'','',query,cursors.at(-1));
  return <fieldset><legend>{kind==='persona'?'Choose personas':'Choose an environment'}</legend><input type="search" aria-label={'Find '+kind} value={query} onInput={e=>{setQuery(e.currentTarget.value);setCursors([0]);}} placeholder="Search…"/>{page?.items.map(r=><label key={r.id} class="check"><input type={multiple?'checkbox':'radio'} checked={value.includes(r.id)} onChange={()=>onChange(multiple ? value.includes(r.id)?value.filter(id=>id!==r.id):[...value,r.id]:[r.id])}/>{label(r)}{kind==='persona' && <small>{data(r).model}</small>}</label>)}<Pagination previous={cursors.length>1} next={page?.next} onPrevious={()=>setCursors(cursors.slice(0,-1))} onNext={()=>page?.next && setCursors([...cursors,page.next])}/></fieldset>;
}
export default function Create({kind,brief,close,act}:{kind:string;brief:string;close:()=>void;act:Act}) {
  const [models,setModels]=useState<Model[]>([]);const [people,setPeople]=useState<string[]>([]);const [env,setEnv]=useState<string[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{if(kind!=='Personas')return;const c=new AbortController();request<Model[]>('/models',{signal:c.signal}).then(setModels).catch(e=>!c.signal.aborted && setError(e.message));return()=>c.abort();},[kind]);
  async function save(form:HTMLFormElement){setBusy(true);setError('');try{const f=new FormData(form);
    if(kind==='Personas'){const model=models[Number(f.get('model'))];await act('persona.create',{provider:model.provider,model:model.id});}
    else if(kind==='Environments')await act('environment.create',{});
    else if(kind==='Network') {const descriptor=String(f.get('descriptor')).trim();if(descriptor){const d=JSON.parse(descriptor);if(d.address)await act('peer.connect',{address:d.address});const {peer,artifact,digest,size,name}=d;await act('transfer.start',{peer,artifact,digest,size,name});}else await act('peer.connect',{address:f.get('address')});}
    else {if(!people.length)throw new Error('Choose at least one persona');let environment=env[0];if(!environment && brief){const r=await act('environment.create',{});environment=(r.result as any).id;}if(!environment)throw new Error('Choose an environment');await act('work.create',{title:f.get('title'),brief:f.get('brief'),environment,personas:people});}
    close();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div class="overlay" role="dialog" aria-label="Create"><form class="create-panel" onSubmit={e=>{e.preventDefault();save(e.currentTarget);}}><header><h2>{kind==='Network'?'Connect or receive':'Create '+kind.toLowerCase()}</h2><button type="button" class="quiet" onClick={close}>Close form</button></header>{error && <p role="alert">{error}</p>}
    {kind==='Personas'?<label>Starting model<select name="model" required>{models.map((m,i)=><option key={m.provider+m.id} value={i}>{m.provider} / {m.name || m.id}</option>)}</select><small>The persona can make subsequent model choices.</small></label>:kind==='Environments'?<p>The personas will author this environment’s name, details and image.</p>:kind==='Network'?<><label>Peer address<input name="address" placeholder="/ip4/…/tcp/…/p2p/…"/></label><label>Or shared artifact details<textarea name="descriptor" rows={5}/></label><p>Both nodes must trust one another to exchange artifacts.</p></>:<><label>Short title<input name="title" required defaultValue={brief?'Learning together':''}/></label><label>Your instructions<textarea name="brief" required rows={6} defaultValue={brief}/></label>{!brief && <Pick kind="environment" value={env} onChange={setEnv}/>}<Pick kind="persona" multiple value={people} onChange={setPeople}/></>}
    <button disabled={busy || kind==='Personas' && !models.length}>{busy?'Saving…':'Create'}</button>
  </form></div>;
}
