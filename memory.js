import { db } from 'hatchable';
export const access='public'; export const methods=['GET','POST','PUT','DELETE','OPTIONS'];
export default async function(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Access-Control-Allow-Headers','Content-Type, X-ChatNEXA-User');
 res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 const uid=String(req.headers['x-chatnexa-user']||req.query.device_id||req.query.userId||req.body?.device_id||req.body?.userId||'').trim().slice(0,120);
 if(!uid)return res.status(400).json({error:'Utente non identificato'});
 if(req.method==='GET'){const {rows}=await db.query('SELECT id,content,created_at,updated_at FROM chatnexa_memories WHERE user_id=$1 ORDER BY updated_at DESC',[uid]);return res.json({memories:rows});}
 if(req.method==='POST'){const content=String(req.body?.content||'').trim();if(!content)return res.status(400).json({error:'Scrivi qualcosa da ricordare'});const {rows}=await db.query('INSERT INTO chatnexa_memories(user_id,content) VALUES($1,$2) RETURNING id,content,created_at,updated_at',[uid,content.slice(0,500)]);return res.json({memory:rows[0]});}
 if(req.method==='PUT'){const id=Number(req.body?.id),content=String(req.body?.content||'').trim();if(!id||!content)return res.status(400).json({error:'Ricordo non valido'});const {rows}=await db.query('UPDATE chatnexa_memories SET content=$1,updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id,content,updated_at',[content.slice(0,500),id,uid]);return res.json({memory:rows[0]});}
 const id=String(req.query.id||req.body?.id||''); if(id==='all'){await db.query('DELETE FROM chatnexa_memories WHERE user_id=$1',[uid]);return res.json({ok:true});}
 await db.query('DELETE FROM chatnexa_memories WHERE id=$1 AND user_id=$2',[Number(id),uid]);res.json({ok:true});
}