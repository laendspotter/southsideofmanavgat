import records from './hotels.json';
import type { Hotel,State } from './model';
export const catalogHotels=records as Hotel[];
export function searchKey(value:string){return value.toLocaleLowerCase('de').replace(/ı/g,'i').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
export function mergeCatalog(state:State):State {
 const hidden=new Set([...(state.catalogHidden||[]),...state.history.filter(h=>h.summary==='durch moderation entfernt').map(h=>h.targetId)]);
 const ids=new Set(state.hotels.map(h=>h.id)),names=new Set(state.hotels.map(h=>searchKey(h.name)));
 const additions=catalogHotels.filter(h=>!hidden.has(h.id)&&!ids.has(h.id)&&!names.has(searchKey(h.name)));
 return {...state,hotels:[...state.hotels,...additions.map(h=>({...h}))]};
}
