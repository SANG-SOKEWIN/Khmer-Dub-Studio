import {NextRequest} from 'next/server';
import {createSession,error} from '@/lib/server';
export const runtime='nodejs';
export async function POST(request:NextRequest){try{return await createSession(request);}catch{return error('Session storage unavailable. Configure PostgreSQL and run migrations.',503);}}
