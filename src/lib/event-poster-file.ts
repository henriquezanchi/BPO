export const MAX_EVENT_POSTER_BYTES=3*1024*1024;
export function eventPosterExtension(bytes:Uint8Array,mime:string){
 if(!bytes.length||bytes.length>MAX_EVENT_POSTER_BYTES)throw Error('O cartaz deve ter até 3 MB.');
 if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
 if(mime==='image/png'&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'png';
 if(mime==='image/webp'&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'webp';
 throw Error('Selecione um cartaz JPG, PNG ou WebP válido.');
}
