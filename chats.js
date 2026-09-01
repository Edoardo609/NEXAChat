import { db } from 'hatchable';
export const access='public'; export const methods=['GET','POST','PUT','DELETE','OPTIONS'];
export default async function(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Access-Control-Allow-Headers','Content-Type, X-ChatNEXA-User');
 res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 const uid=String(req.headers['x-chatnexa-user']||req.query.device_id||req.query.userId||req.body?.device_id||req.body?.userId||'').trim().slice(0,120);
 if(!uid)return res.status(400).json({error:'Utente non identificato'});
 if(req.method==='GET'){
  const {rows}=await db.query(`SELECT c.id,c.title,c.created_at,c.updated_at,(SELECT content FROM chatnexa_messages m WHERE m.chat_id=c.id ORDER BY m.created_at DESC LIMIT 1) preview FROM chatnexa_chats c WHERE c.user_id=$1 ORDER BY c.updated_at DESC`,[uid]);
  return res.json({chats:rows});
 }
 if(req.method==='POST'){
  const {rows}=await db.query('INSERT INTO chatnexa_chats(user_id,title) VALUES($1,$2) RETURNING id,title,created_at,updated_at',[uid,String(req.body?.title||'Nuova chat').slice(0,100)]);
  return res.json({chat:rows[0]});
 }
 if(req.method==='PUT'){
  const id=Number(req.body?.id),title=String(req.body?.title||'').trim().slice(0,100);
  if(!id||!title)return res.status(400).json({error:'Titolo non valido'});
  const {rows}=await db.query('UPDATE chatnexa_chats SET title=$1,updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id,title',[title,id,uid]);
  if(!rows[0])return res.status(404).json({error:'Chat non trovata'});
  return res.json({chat:rows[0]});
 }
 const id=Number(req.query.id||req.body?.id);
 await db.query('DELETE FROM chatnexa_chats WHERE id=$1 AND user_id=$2',[id,uid]);
 res.json({ok:true});
}