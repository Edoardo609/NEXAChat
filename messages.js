import { db } from 'hatchable';
export const access='public'; export const methods=['GET','OPTIONS'];
export default async function(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Access-Control-Allow-Headers','Content-Type, X-ChatNEXA-User');
 res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 const uid=String(req.headers['x-chatnexa-user']||req.query.userId||'').trim(),id=Number(req.query.chatId);
 if(!uid||!id)return res.status(400).json({error:'Richiesta non valida'});
 const {rows}=await db.query('SELECT m.id,m.role,m.content,m.attachments,m.created_at FROM chatnexa_messages m JOIN chatnexa_chats c ON c.id=m.chat_id WHERE m.chat_id=$1 AND c.user_id=$2 ORDER BY m.created_at ASC',[id,uid]);
 res.json({messages:rows});
}