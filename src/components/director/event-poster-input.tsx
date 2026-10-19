"use client";
import {useState} from 'react';
export function EventPosterInput({initialPath,initialUrl,onUploading}:{initialPath?:string|null;initialUrl?:string|null;onUploading:(value:boolean)=>void}){
 const [path,setPath]=useState(initialPath??''),[preview,setPreview]=useState(initialUrl??''),[message,setMessage]=useState(''),[uploading,setUploading]=useState(false);
 async function upload(file:File|undefined){
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3*1024*1024){setMessage('Escolha JPG, PNG ou WebP de até 3 MB.');return;}
  setUploading(true);onUploading(true);setMessage('');
  try{const form=new FormData();form.set('file',file);const response=await fetch('/api/eventos/cartaz',{method:'POST',body:form});const data=await response.json();if(!response.ok)throw Error(data.error);setPath(data.posterPath);setPreview(data.url??'');setMessage('Cartaz enviado. Salve o evento para publicar a alteração.');}
  catch(error){setMessage(error instanceof Error?error.message:'Não foi possível enviar o cartaz.');}
  finally{setUploading(false);onUploading(false);}
 }
 return <div className="space-y-2"><label className="flex flex-col gap-1 text-xs">Cartaz (JPG, PNG ou WebP; até 3 MB)<input aria-label="Cartaz do evento" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e=>void upload(e.target.files?.[0])} className="w-full min-w-0 rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700"/></label><input type="hidden" name="posterPath" value={path}/>{preview&&<>
 {/* eslint-disable-next-line @next/next/no-img-element -- cartaz privado com URL assinada e proporção original */}
 <img src={preview} alt="Prévia do cartaz" className="max-h-80 w-full rounded-lg object-contain"/></>}
 {path&&<button type="button" disabled={uploading} onClick={()=>{setPath('');setPreview('');setMessage('Cartaz removido. Salve o evento para confirmar.');}} className="py-2 text-xs text-red-700 dark:text-red-300">Remover cartaz</button>}{uploading&&<p role="status" className="text-xs">Enviando cartaz…</p>}{message&&<p role="status" className="text-xs">{message}</p>}</div>;
}
