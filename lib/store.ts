import { get,head,put,BlobNotFoundError,BlobPreconditionFailedError } from '@vercel/blob';
import { initialState,AppError,type State } from './model';
const path='community/state-v1.json';
export async function readState(){const result=await get(path,{access:'private',useCache:false});if(!result)return {state:initialState()};if(result.statusCode!==200)throw new AppError('speicher gerade nicht verfügbar.',503);return {state:await new Response(result.stream).json() as State};}
async function revision(){try{return (await head(path)).etag}catch(e){if(e instanceof BlobNotFoundError)return undefined;throw e}}
export async function updateState(fn:(state:State)=>State){for(let attempt=0;attempt<4;attempt++){
 // Storage API revision tags are authoritative for conditional writes. A delivery
 // response can have a representation-specific HTTP ETag (e.g. compression).
 // Bracket the uncached content read with metadata reads to detect intervening writes.
 const before=await revision();const {state}=await readState();const after=await revision();if(before!==after)continue;
 const updated=fn(state);try{await put(path,JSON.stringify(updated),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:!!after,...(after?{ifMatch:after}:{})});return updated;}catch(error){if(error instanceof BlobPreconditionFailedError||(!after&&error instanceof Error&&/already exists/i.test(error.message)))continue;throw error;}
 }throw new AppError('gleichzeitige änderung. bitte erneut speichern.',409);}
