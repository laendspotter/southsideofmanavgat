import {NextRequest,NextResponse} from 'next/server';
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {readState,updateState} from '@/lib/store';
import {mutate,publicState,AppError} from '@/lib/model';
import {ZodError} from 'zod';
export const runtime='nodejs';export const dynamic='force-dynamic';
function secret(){const s=process.env.SESSION_SECRET;if(!s||s.length<32)throw new AppError('community-speicher wird noch eingerichtet.',503);return s;}
const sign=(v:string)=>createHmac('sha256',secret()).update(v).digest('hex');
function equal(a:string,b:string){return a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function identity(req:NextRequest){const value=req.cookies.get('southside_guest')?.value||'';const [id,mac]=value.split('.');if(id&&/^[a-f0-9-]{36}$/.test(id)&&mac&&equal(mac,sign(id)))return {id,cookie:value};const fresh=randomUUID();return {id:fresh,cookie:fresh+'.'+sign(fresh)};}
function isAdmin(req:NextRequest){const value=req.headers.get('x-admin-key')||'';return !!process.env.ADMIN_SECRET&&process.env.ADMIN_SECRET.length>=32&&equal(value,process.env.ADMIN_SECRET);}
function respond(data:unknown,cookie:string){const res=NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});res.cookies.set('southside_guest',cookie,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:31536000,path:'/'});return res;}
function errorResponse(e:unknown){if(e instanceof ZodError)return NextResponse.json({error:'bitte alle felder prüfen.',details:e.issues.map(i=>`${i.path.join('.')}: ${i.message}`)},{status:400});return NextResponse.json({error:e instanceof AppError?e.message:'speichern oder laden gerade nicht möglich. bitte erneut versuchen.'},{status:e instanceof AppError?e.status:503});}
export async function GET(req:NextRequest){try{const user=identity(req);const {state}=await readState();return respond(publicState(state,user.id,isAdmin(req)),user.cookie);}catch(e){return errorResponse(e);}}
export async function POST(req:NextRequest){try{const origin=req.headers.get('origin');if(!origin||origin!==req.nextUrl.origin)throw new AppError('ungültige anfrage-herkunft.',403);if(Number(req.headers.get('content-length')||0)>32000)throw new AppError('beitrag zu groß.',413);const raw=await req.text();if(raw.length>32000)throw new AppError('beitrag zu groß.',413);const input=JSON.parse(raw);if(!input||typeof input!=='object')throw new AppError('ungültige anfrage.');const user=identity(req);const ip=req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')||user.id;const rateKey=sign(ip.split(',')[0].trim()).slice(0,32);const admin=isAdmin(req);const state=await updateState(s=>mutate(s,input,user.id,rateKey,admin));return respond(publicState(state,user.id,admin),user.cookie);}catch(e){return errorResponse(e);}}
