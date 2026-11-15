import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {createHash} from 'node:crypto';
const base=process.env.APP_ORIGIN??'http://localhost:3000';const db=new PrismaClient();
const ids:string[]=[];
after(async()=>{if(ids.length)await db.session.deleteMany({where:{id:{in:ids}}});await db.$disconnect();});
test('anonymous session is reused, has secure attributes and expires',async()=>{
  const initial=await fetch(base+'/api/session',{method:'POST',headers:{origin:base}});assert.equal(initial.status,200);
  const cookie=initial.headers.get('set-cookie');assert.ok(cookie);assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=strict/i);
  const raw=/studio_session=([^;]+)/.exec(cookie)![1],id=createHash('sha256').update(raw).digest('hex');ids.push(id);
  const found=await db.session.findUniqueOrThrow({where:{id}});assert.ok(found.expiresAt>new Date());
  const reused=await fetch(base+'/api/session',{method:'POST',headers:{origin:base,cookie:`studio_session=${raw}`}});assert.equal(reused.status,200);assert.equal(reused.headers.get('set-cookie'),null);
  await db.session.update({where:{id},data:{requestCount:30,windowStart:new Date()}});
  const limited=await fetch(base+'/api/speech',{method:'POST',headers:{origin:base,cookie:`studio_session=${raw}`,'content-type':'application/json'},body:'{}'});assert.equal(limited.status,429);
  await db.session.update({where:{id},data:{expiresAt:new Date(0)}});
  const expired=await fetch(base+'/api/speech',{method:'POST',headers:{origin:base,cookie:`studio_session=${raw}`,'content-type':'application/json'},body:'{}'});assert.equal(expired.status,401);
});
test('missing cookies and cross-origin writes are rejected',async()=>{
  assert.equal((await fetch(base+'/api/speech',{method:'POST',headers:{origin:base}})).status,401);
  assert.equal((await fetch(base+'/api/session',{method:'POST',headers:{origin:'https://attacker.example'}})).status,403);
});
