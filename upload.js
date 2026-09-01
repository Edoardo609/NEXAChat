import { storage } from 'hatchable';
export const access='public'; export const methods=['POST','OPTIONS'];
const okTypes=['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','text/csv','application/json','text/markdown','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
export default async function(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Access-Control-Allow-Headers','Content-Type, X-ChatNEXA-User');
 res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 const uid=String(req.headers['x-chatnexa-user']||'').trim();
 if(!uid)return res.status(400).json({error:'Utente non identificato'});
 const files=req.files||[]; if(!files.length)return res.status(400).json({error:'Nessun file ricevuto'});
 const uploaded=[];
 for(const f of files.slice(0,5)){
  if(f.buffer.length>10*1024*1024)return res.status(400).json({error:'Un file supera il limite di 10 MB'});
  const type=f.contentType||'application/octet-stream';
  if(!okTypes.includes(type))return res.status(400).json({error:'Formato non supportato: '+(f.filename||'file')});
  const safe=String(f.filename||'file').replace(/[^a-zA-Z0-9._-]/g,'_');
  const key='chatnexa/'+uid+'/'+Date.now()+'-'+crypto.randomUUID()+'-'+safe;
  const url=await storage.put(key,f.buffer,type);
  uploaded.push({name:f.filename||'file',type,size:f.buffer.length,url});
 }
 res.json({files:uploaded});
}