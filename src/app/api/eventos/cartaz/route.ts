import {getAuthenticatedMember} from '@/lib/auth';
import {supabaseAdmin} from '@/lib/supabase/admin';
import {EVENT_POSTERS_BUCKET,eventPosterUrl} from '@/lib/event-posters';
import {eventPosterExtension,MAX_EVENT_POSTER_BYTES} from '@/lib/event-poster-file';
import {randomUUID} from 'node:crypto';
export async function POST(request:Request){
 const actor=await getAuthenticatedMember();
 if(!actor?.mercurioAtivo||(!actor.isDiretor&&!actor.isSubChefe))return Response.json({error:'Acesso restrito à Direção da escola.'},{status:403});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
 if(Number(request.headers.get('content-length')??0)>MAX_EVENT_POSTER_BYTES+65536)return Response.json({error:'O cartaz deve ter até 3 MB.'},{status:413});
 try{
  const form=await request.formData(),file=form.get('file');
  if(!(file instanceof File)||!file.size)return Response.json({error:'Selecione o cartaz.'},{status:400});
  if(file.size>MAX_EVENT_POSTER_BYTES)return Response.json({error:'O cartaz deve ter até 3 MB.'},{status:413});
  const bytes=new Uint8Array(await file.arrayBuffer());
  let extension:string;
  try{extension=eventPosterExtension(bytes,file.type);}catch(e){return Response.json({error:e instanceof Error?e.message:'Imagem inválida.'},{status:400});}
  const bucket=await supabaseAdmin.storage.getBucket(EVENT_POSTERS_BUCKET);
  if(!bucket.data){
   const {error:bucketError}=await supabaseAdmin.storage.createBucket(EVENT_POSTERS_BUCKET,{public:false,fileSizeLimit:MAX_EVENT_POSTER_BYTES,allowedMimeTypes:['image/jpeg','image/png','image/webp']});
   if(bucketError&&String('statusCode' in bucketError?bucketError.statusCode:'')!=='409')return Response.json({error:'Não foi possível preparar o armazenamento do cartaz.'},{status:503});
  }else if(bucket.data.public)return Response.json({error:'O armazenamento dos cartazes precisa ser privado. Contate o suporte.'},{status:503});
  const path=`${actor.schoolId}/event-posters/${randomUUID()}.${extension}`;
  const {error}=await supabaseAdmin.storage.from(EVENT_POSTERS_BUCKET).upload(path,bytes,{contentType:file.type,upsert:false});
  if(error)return Response.json({error:'Não foi possível enviar o cartaz. Tente novamente.'},{status:503});
  return Response.json({posterPath:path,url:await eventPosterUrl(path)});
 }catch{return Response.json({error:'Não foi possível enviar o cartaz. Tente novamente.'},{status:500});}
}
