// Bitmap bytes and Blob URLs live only while their actual image is on screen.
export class VerifiedImageMounts {
  constructor(read, {IntersectionObserver=globalThis.IntersectionObserver, MutationObserver=globalThis.MutationObserver,
    url=URL, document=globalThis.document}={}) {
    this.read=read; this.url=url; this.document=document; this.mounts=new Map(); this.root=null;
    this.observer=IntersectionObserver?new IntersectionObserver(entries=>{
      for(const entry of entries){ const state=this.mounts.get(entry.target); if(!state) continue;
        if(entry.isIntersecting){state.visible=true;this.load(entry.target,state);}
        else{state.visible=false;this.release(entry.target,state);}
      }
    },{rootMargin:'0px'}):null;
    this.mutation=MutationObserver?new MutationObserver(()=>this.sync(this.root)):null;
  }
  sync(root){
    if(!root) return;
    if(this.root!==root){this.mutation?.disconnect();this.root=root;this.mutation?.observe(root,{childList:true,subtree:true});}
    const elements=new Set(root.querySelectorAll('[data-verified-image]'));
    for(const [element,state] of this.mounts) if(!elements.has(element)||element.dataset.verifiedImage!==state.key){
      this.release(element,state);this.observer?.unobserve(element);this.mounts.delete(element);
    }
    for(const element of elements){
      let state=this.mounts.get(element);
      if(!state){
        let source;try{source=JSON.parse(element.dataset.verifiedImage);}catch(_){continue;}
        if(!source?.url||!/^sha256:[0-9a-f]{64}$/.test(source.hash)||!Number.isSafeInteger(source.size)||source.size<1||source.size>25*1024*1024) continue;
        state={key:element.dataset.verifiedImage,source,visible:!this.observer,controller:null,objectUrl:null};
        this.mounts.set(element,state);
        if(this.observer)this.observer.observe(element);else this.load(element,state);
      }else if(state.objectUrl&&!element.querySelector('img')) this.paint(element,state);
    }
  }
  release(element,state){
    state.controller?.abort();state.controller=null;
    if(state.objectUrl){this.url.revokeObjectURL(state.objectUrl);state.objectUrl=null;}
    element.replaceChildren();
  }
  paint(element,state){
    const img=this.document.createElement('img');img.alt=state.source.alt||'Persona-selected environment image';
    img.src=state.objectUrl;img.decoding='async';element.replaceChildren(img);
  }
  async load(element,state){
    if(!state.visible||state.controller||state.objectUrl)return;
    const controller=new AbortController();state.controller=controller;
    const current=()=>!controller.signal.aborted&&state.visible&&this.mounts.get(element)===state;
    element.textContent='Loading image…';
    try{
      const result=await this.read(state.source.url,state.source.hash,{signal:controller.signal,maxBytes:state.source.size,
        onProgress:({received,total})=>{if(current())element.textContent=total?'Loading image · '+Math.floor(received/total*100)+'%':'Loading image…';}});
      if(!current())return;
      if(!result?.ok||result.size!==state.source.size){element.textContent='Image could not be verified';return;}
      state.objectUrl=this.url.createObjectURL(result.blob);this.paint(element,state);
    }catch(_){if(current())element.textContent='Image unavailable';}
    finally{if(state.controller===controller)state.controller=null;}
  }
  dispose(){
    this.observer?.disconnect();this.mutation?.disconnect();
    for(const [element,state] of this.mounts)this.release(element,state);
    this.mounts.clear();this.root=null;
  }
}
