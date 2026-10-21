import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Tree } from '../src/data.js';
import { MAX_PHOTO_BYTES, PHOTO_DATA_PREFIX, PHOTO_SIDE } from '../src/photo-limits.js';
import { HttpError } from './validation-error.js';
export const PHOTO_PATH = /^\/api\/photos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function decodePhoto(value: string): Buffer {
  const encoded = value.slice(PHOTO_DATA_PREFIX.length);
  if (!value.startsWith(PHOTO_DATA_PREFIX) || !encoded || encoded.length > Math.ceil(MAX_PHOTO_BYTES/3)*4 || encoded.length%4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new HttpError(400,'Невірний формат фото. Завантажте його ще раз.');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > MAX_PHOTO_BYTES) throw new HttpError(400,'Підготовлене фото завелике. Завантажте його ще раз.');
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length-2] !== 0xff || bytes[bytes.length-1] !== 0xd9) throw new HttpError(400,'Пошкоджене фото JPEG.');
  // Read a JPEG frame header without decoding untrusted image content.
  for (let offset=2; offset+3<bytes.length;) {
    if(bytes[offset++]!==0xff)break;
    while(bytes[offset]===0xff)offset++;
    const marker=bytes[offset++];
    if(marker===0xda || marker===0xd9)break;
    if(marker===0x01 || (marker>=0xd0&&marker<=0xd7))continue;
    if(offset+2>bytes.length)break;
    const length=bytes.readUInt16BE(offset);
    if(length<2 || offset+length>bytes.length)break;
    if([0xc0,0xc1,0xc2].includes(marker) && length>=8){
      const height=bytes.readUInt16BE(offset+3),width=bytes.readUInt16BE(offset+5);
      if(width>0&&height>0&&width<=PHOTO_SIDE&&height<=PHOTO_SIDE)return bytes;
      throw new HttpError(400,'Фото має бути не більше 640 × 640 пікселів.');
    }
    offset+=length;
  }
  throw new HttpError(400,'Не вдалося прочитати фото JPEG.');
}

export function validatePhoto(value: unknown): string {
  if(value==='')return '';
  if(typeof value!=='string')throw new HttpError(400,'Невірне фото.');
  if(value.startsWith(PHOTO_DATA_PREFIX)){decodePhoto(value);return value;}
  if(PHOTO_PATH.test(value))return value;
  if(value.length<=1000 && /^https:\/\//i.test(value))return value;
  throw new HttpError(400,'Оберіть фото через кнопку завантаження.');
}

export async function persistPhotos(tree: Tree, ownerId: string, client: PoolClient): Promise<Tree> {
  const references=[...new Set(tree.people.map(p=>PHOTO_PATH.exec(p.photo)?.[1]).filter((id): id is string=>Boolean(id)))];
  if(references.length){
    const found=await client.query('SELECT id FROM ridni_photos WHERE owner_id=$1 AND id=ANY($2::uuid[])',[ownerId,references]);
    if(found.rows.length!==references.length)throw new HttpError(400,'Фото не знайдено у вашому акаунті. Завантажте його ще раз.');
  }
  const uploaded=new Map<string,string>();
  const people=[];
  for(const person of tree.people){
    let photo=person.photo;
    if(photo.startsWith(PHOTO_DATA_PREFIX)){
      if(!uploaded.has(photo)){
        const id=randomUUID();
        await client.query('INSERT INTO ridni_photos(id,owner_id,data) VALUES($1,$2,$3)',[id,ownerId,decodePhoto(photo)]);
        uploaded.set(photo,`/api/photos/${id}`);
      }
      photo=uploaded.get(photo)!;
    }
    people.push({...person,photo});
  }
  return {...tree,people};
}

// Tree writes for one owner share an advisory lock, so cleanup cannot race with a new reference.
export async function lockPhotos(ownerId:string,client:PoolClient){await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[ownerId]);}
export async function cleanUnusedPhotos(ownerId:string,client:PoolClient){
  await client.query(`DELETE FROM ridni_photos p WHERE p.owner_id=$1 AND NOT EXISTS (
    SELECT 1 FROM ridni_trees t CROSS JOIN LATERAL jsonb_array_elements(t.data->'people') person
    WHERE t.owner_id=$1 AND person->>'photo'='/api/photos/'||p.id::text
  )`,[ownerId]);
}
