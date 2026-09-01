import { db } from 'hatchable';
export const access='public'; export const methods=['GET','POST','OPTIONS'];
export default async function(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Access-Control-Allow-Headers','Content-Type, X-ChatNEXA-User');
 res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 const uid=String(req.headers['x-chatnexa-user']||req.query.userId||req.body?.userId||'').trim();
 if(!uid) return res.status(400).json({error:'Profilo locale non identificato'});
 if(req.method==='GET'){const {rows}=await db.query('SELECT first_name,last_name,display_name,avatar_url,onboarding_done FROM chatnexa_profiles WHERE user_id=$1',[uid]);return res.json({profile:rows[0]||null});}
 const b=req.body||{}, fn=String(b.firstName||'').trim(), ln=String(b.lastName||'').trim(), dn=String(b.displayName||'').trim();
 if(!dn)return res.status(400).json({error:'Inserisci un nome visualizzato'});
 await db.query(`INSERT INTO chatnexa_profiles(user_id,first_name,last_name,display_name,avatar_url,onboarding_done,updated_at) VALUES($1,$2,$3,$4,$5,true,now()) ON CONFLICT(user_id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,display_name=EXCLUDED.display_name,avatar_url=EXCLUDED.avatar_url,onboarding_done=true,updated_at=now()`,[uid,fn,ln,dn,b.avatarUrl||null]);
 const {rows}=await db.query('SELECT first_name,last_name,display_name,avatar_url,onboarding_done FROM chatnexa_profiles WHERE user_id=$1',[uid]);res.json({ok:true,message:'Informazioni salvate',profile:rows[0]});
}