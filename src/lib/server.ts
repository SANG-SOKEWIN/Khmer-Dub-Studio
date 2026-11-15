import {PrismaClient} from '@prisma/client';
import {createHash,randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
const state=globalThis as unknown as {studioPrisma?:PrismaClient};
export const db=state.studioPrisma??new PrismaClient();
if(process.env.NODE_ENV!=='production')state.studioPrisma=db;
export const SESSION_COOKIE='studio_session';
export function sessionHash(token:string):string{return createHash('sha256').update(token).digest('hex');}
export function originAllowed(request:NextRequest):boolean {
  const expected=process.env.APP_ORIGIN;
  if(!expected)return false;
  return request.headers.get('origin')===expected && !['cross-site'].includes(request.headers.get('sec-fetch-site')??'');
}
export function error(message:string,status:number){return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});}
export async function createSession(request:NextRequest){
  if(!originAllowed(request))return error('Origin not allowed.',403);
  const current=request.cookies.get(SESSION_COOKIE)?.value;
  if(current&&/^[a-f0-9]{64}$/.test(current)){
    const existing=await db.session.findUnique({where:{id:sessionHash(current)}});
    if(existing&&existing.expiresAt>new Date())return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }
  const token=randomBytes(32).toString('hex');
  await db.session.deleteMany({where:{expiresAt:{lt:new Date()}}});
  await db.session.create({data:{id:sessionHash(token),expiresAt:new Date(Date.now()+8*3600_000)}});
  const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:8*3600});return response;
}
export async function authorizeSpeech(request:NextRequest):Promise<number>{
  if(!originAllowed(request))return 403;
  const token=request.cookies.get(SESSION_COOKIE)?.value;
  if(!token||! /^[a-f0-9]{64}$/.test(token))return 401;
  const id=sessionHash(token),now=new Date();
  // A single atomic statement prevents concurrent requests from exceeding the window.
  const rows=await db.$queryRaw<{id:string}[]>`UPDATE "Session" SET "requestCount" = CASE WHEN "windowStart" < NOW() - INTERVAL '1 minute' THEN 1 ELSE "requestCount" + 1 END, "windowStart" = CASE WHEN "windowStart" < NOW() - INTERVAL '1 minute' THEN NOW() ELSE "windowStart" END WHERE "id" = ${id} AND "expiresAt" > ${now} AND ("windowStart" < NOW() - INTERVAL '1 minute' OR "requestCount" < 30) RETURNING "id"`;
  if(rows.length)return 200;
  const session=await db.session.findUnique({where:{id}});return !session||session.expiresAt<=now?401:429;
}
export async function boundedJson(request:Request,limit=16000):Promise<unknown>{
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('Use application/json.');
  if(Number(request.headers.get('content-length')??0)>limit)throw new Error('Request too large.');
  const reader=request.body?.getReader();if(!reader)throw new Error('Missing request body.');let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw new Error('Request too large.');chunks.push(value);}}finally{await reader.cancel();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
