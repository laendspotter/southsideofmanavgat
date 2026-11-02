import { z } from 'zod';
import { catalogHotels } from './catalog';
export const areas = ['gündoğdu','çolaklı','evrenseki','kumköy','ılıca','side','manavgat'] as const;
const text = (max:number) => z.string().trim().min(1).max(max);
const url = z.union([z.literal(''),z.url().refine(v=>/^https?:\/\//.test(v),'nur http(s)-links')]);
const day = z.number().int().min(0).max(6);
const coord = z.object({lat:z.number().min(36.70).max(36.90),lng:z.number().min(31.15).max(31.50),name:text(80)});
const common = {name:text(120),area:z.enum(areas),note:z.string().trim().max(1500).default(''),source:url.default('')};
export const hotelSchema = z.object({...common});
export const lineSchema = z.object({...common,from:text(100),to:text(100),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),interval:z.number().int().min(1).max(240),days:z.array(day).min(1).max(7),season:text(120),fare:z.string().trim().max(100).default(''),points:z.array(coord).min(2).max(100),direction:z.enum(['both','one']),observed:z.iso.date()});
export const bazaarSchema = z.object({...common,days:z.array(day).min(1).max(7),hours:text(100),observed:z.iso.date()});
export const reviewSchema = z.object({hotelId:text(80),author:text(40),recommend:z.boolean(),rating:z.number().int().min(1).max(5),food:z.number().int().min(1).max(5),room:z.number().int().min(1).max(5),beach:z.number().int().min(1).max(5),title:text(120),body:z.string().trim().min(20).max(3000),visited:z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/)}).refine(r=>r.visited<=new Date().toISOString().slice(0,7),'reisezeit liegt in der zukunft');
export const reportSchema = z.object({targetId:text(80),reason:z.string().trim().min(10).max(1000)});
export type Hotel = z.infer<typeof hotelSchema> & {id:string;updatedAt:string};
export type Line = z.infer<typeof lineSchema> & {id:string;updatedAt:string};
export type Bazaar = z.infer<typeof bazaarSchema> & {id:string;updatedAt:string};
export type Review = z.infer<typeof reviewSchema> & {id:string;updatedAt:string;owner:string};
export type Report = z.infer<typeof reportSchema> & {id:string;createdAt:string;owner:string;resolved?:boolean};
export type History = {id:string;targetId:string;kind:string;at:string;summary:string;previous:unknown};
export type State = {catalogHidden?:string[];hotels:Hotel[];lines:Line[];bazaars:Bazaar[];reviews:Review[];reports:Report[];history:History[];limits:Record<string,{count:number;until:number}>};
export function initialState():State {return {hotels:catalogHotels.map(h=>({...h})),lines:[],bazaars:[],reviews:[],reports:[],history:[],limits:{}};}
export class AppError extends Error {constructor(message:string,public status=400){super(message)}}
export function mutate(s:State, input:Record<string,unknown>, owner:string, rateKey:string, admin=false):State {
 const now=Date.now(),at=new Date(now).toISOString(),kind=String(input.kind),action=String(input.action||'create');
 s.limits=Object.fromEntries(Object.entries(s.limits).filter(([,v])=>v.until>now));
 const limit=s.limits[rateKey]||{count:0,until:now+3600000}; if(limit.count>=30)throw new AppError('zu viele beiträge. bitte später erneut versuchen.',429);
 s.limits[rateKey]={...limit,count:limit.count+1};
 if(kind==='moderate'){
  if(!admin)throw new AppError('moderationsschlüssel fehlt oder ist falsch.',403);
  if(action==='resolve'){const report=s.reports.find(r=>r.id===input.id);if(!report)throw new AppError('meldung nicht gefunden.',404);report.resolved=true;return s;}
  const target=String(input.id);for(const key of ['hotels','lines','bazaars','reviews'] as const){const item=s[key].find(x=>x.id===target);if(item){s.history.unshift({id:crypto.randomUUID(),targetId:target,kind:key,at,summary:'durch moderation entfernt',previous:item});(s[key] as {id:string}[])=s[key].filter(x=>x.id!==target);if(key==='hotels'){s.reviews=s.reviews.filter(r=>r.hotelId!==target);s.catalogHidden=[...new Set([...(s.catalogHidden||[]),target])];}return s;}}throw new AppError('beitrag nicht gefunden.',404);
 }
 if(kind==='report') {const r=reportSchema.parse(input.data);if(![...s.hotels,...s.lines,...s.bazaars,...s.reviews].some(x=>x.id===r.targetId))throw new AppError('beitrag nicht gefunden.',404);if(s.reports.length>=2000)throw new AppError('meldebereich ist voll. moderation erforderlich.',503);s.reports.unshift({...r,id:crypto.randomUUID(),createdAt:at,owner});return s;}
 if(kind==='review') {const r=reviewSchema.parse(input.data);if(!s.hotels.some(h=>h.id===r.hotelId))throw new AppError('hotel nicht gefunden.',404);const existing=s.reviews.find(x=>x.hotelId===r.hotelId&&x.owner===owner);if(s.reviews.length>=2000&&!existing)throw new AppError('bewertungsbereich voll.',503);if(existing){s.history.unshift({id:crypto.randomUUID(),targetId:existing.id,kind,at,summary:'bewertung aktualisiert',previous:existing});s.reviews=s.reviews.filter(x=>x.id!==existing.id);}s.reviews.unshift({...r,id:existing?.id||crypto.randomUUID(),owner,updatedAt:at});return s;}
 const key=kind==='line'?'lines':kind==='hotel'?'hotels':kind==='bazaar'?'bazaars':null;if(!key)throw new AppError('unbekannter beitragstyp.');
 const data=(kind==='line'?lineSchema:kind==='hotel'?hotelSchema:bazaarSchema).parse(input.data);
 if('observed' in data&&typeof data.observed==='string'&&data.observed>at.slice(0,10))throw new AppError('prüfdatum liegt in der zukunft.');
 if(action==='edit') {const index=s[key].findIndex(x=>x.id===input.id);if(index<0)throw new AppError('beitrag nicht gefunden.',404);const old=s[key][index];if(old.updatedAt!==input.baseVersion)throw new AppError('inzwischen hat jemand diesen beitrag geändert. bitte neu laden und deine änderung erneut prüfen.',409);s.history.unshift({id:crypto.randomUUID(),targetId:old.id,kind,at,summary:String(input.reason||'community-korrektur').slice(0,200),previous:old});(s[key] as unknown[])[index]={...data,id:old.id,updatedAt:at};}
 else {if(s[key].length>=500)throw new AppError('bereich voll. moderation erforderlich.',503);if(s[key].some(x=>x.name.toLocaleLowerCase()===data.name.toLocaleLowerCase()))throw new AppError('diesen namen gibt es schon. bitte vorhandenen beitrag bearbeiten.',409);(s[key] as unknown[]).unshift({...data,id:crypto.randomUUID(),updatedAt:at});s.history.unshift({id:crypto.randomUUID(),targetId:s[key][0].id,kind,at,summary:'neu von der community',previous:null});}
 s.history=s.history.slice(0,2000); return s;
}
export function publicState(s:State,owner:string,admin=false){return {hotels:s.hotels,lines:s.lines,bazaars:s.bazaars,reviews:s.reviews.map(({owner:who,...r})=>({...r,mine:who===owner})),reports:admin?s.reports.map(({owner:_,...r})=>r):[],reportCount:s.reports.filter(x=>!x.resolved).length,history:s.history.map(({previous,...h})=>({...h,previous: ![...s.hotels,...s.lines,...s.bazaars,...s.reviews].some(x=>x.id===h.targetId)?null:typeof previous==='object'&&previous&&'owner' in previous?{...previous,owner:undefined}:previous})),admin};}
