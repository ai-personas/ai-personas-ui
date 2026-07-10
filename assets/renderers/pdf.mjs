/* PDF rendering falls back to the host's sandboxed browser frame. */
export const meta={exts:['pdf'],media_kinds:['pdf','application/pdf'],fetchMode:'bytes',label:'Sandboxed PDF'};
export async function render(){ throw new Error('use sandboxed host PDF renderer'); }
