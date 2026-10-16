import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PoolClient } from 'pg';
import { demoTree } from '../src/data';
import { checkPhotoFile } from '../src/photo';
import { PHOTO_DATA_PREFIX, MAX_PHOTO_BYTES } from '../src/photo-limits';
import { decodePhoto, validatePhoto, persistPhotos } from '../server/photos';
import { validateTree } from '../server/validation';
import PhotoPicker from '../src/PhotoPicker';
const jpeg=readFileSync(new URL('./fixtures/portrait.jpg',import.meta.url));
const photo=PHOTO_DATA_PREFIX+jpeg.toString('base64');

test('photo picker accepts supported images and rejects oversized, empty and unsupported files',()=>{
  for(const type of ['image/jpeg','image/png','image/webp'])assert.doesNotThrow(()=>checkPhotoFile({size:1024,type}));
  assert.throws(()=>checkPhotoFile({size:11*1024*1024,type:'image/jpeg'}),/10 МБ/);
  assert.throws(()=>checkPhotoFile({size:0,type:'image/jpeg'}));
  for(const type of ['image/svg+xml','text/html','application/pdf'])assert.throws(()=>checkPhotoFile({size:100,type}));
});
test('server accepts small JPEG portraits, existing HTTPS pictures and private references',()=>{
  assert.deepEqual(decodePhoto(photo),jpeg);assert.equal(validatePhoto(photo),photo);
  assert.equal(validatePhoto('/api/photos/12345678-1234-1234-1234-123456789abc'),'/api/photos/12345678-1234-1234-1234-123456789abc');
  assert.equal(validatePhoto('https://images.example.com/photo.jpg'),'https://images.example.com/photo.jpg');
  assert.equal(validatePhoto(''),'');
});
test('server rejects malformed, oversized or disguised photo content',()=>{
  for(const value of ['javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','/api/photos/../../secret',PHOTO_DATA_PREFIX+'invalid','data:image/png;base64,AAAA',PHOTO_DATA_PREFIX+Buffer.from('<html>not a JPEG</html>').toString('base64')])assert.throws(()=>validatePhoto(value));
  assert.throws(()=>decodePhoto(PHOTO_DATA_PREFIX+Buffer.alloc(MAX_PHOTO_BYTES+1).toString('base64')));
  const large=Buffer.from(jpeg);const sof=large.indexOf(Buffer.from([0xff,0xc0]));assert.ok(sof>0);large.writeUInt16BE(4000,sof+7);
  assert.throws(()=>decodePhoto(PHOTO_DATA_PREFIX+large.toString('base64')),/640/);
});
test('tree validation preserves a staged photo for atomic persistence',()=>{
  const tree=demoTree();tree.people[0].photo=photo;
  assert.equal(validateTree(tree).people[0].photo,photo);
});
test('persisting photos stores binary once, returns a private URL and leaves input unchanged',async()=>{
  const tree=demoTree();tree.people[0].photo=photo;tree.people[1].photo=photo;
  let inserts=0;
  const client={query:async(sql:string,params:unknown[])=>{assert.match(sql,/INSERT INTO ridni_photos/);assert.equal(params[1],'owner');assert.deepEqual(params[2],jpeg);inserts++;return {rows:[]};}} as unknown as PoolClient;
  const saved=await persistPhotos(tree,'owner',client);
  assert.equal(inserts,1);assert.match(saved.people[0].photo,/^\/api\/photos\//);
  assert.equal(saved.people[0].photo,saved.people[1].photo);assert.equal(tree.people[0].photo,photo);
});
test('photos belonging to another account cannot be attached to a tree',async()=>{
  const tree=demoTree();tree.people[0].photo='/api/photos/12345678-1234-1234-1234-123456789abc';
  const client={query:async(sql:string,params:unknown[])=>{assert.match(sql,/owner_id=\$1/);assert.equal(params[0],'different-owner');return {rows:[]};}} as unknown as PoolClient;
  await assert.rejects(()=>persistPhotos(tree,'different-owner',client),/вашому акаунті/);
});
test('photo picker exposes a file input, preview and optional replacement/removal',()=>{
  const html=renderToStaticMarkup(createElement(PhotoPicker,{person:demoTree().people[0],onChange:()=>{},onProcessing:()=>{}}));
  assert.match(html,/type="file"/);assert.match(html,/image\/jpeg,image\/png,image\/webp/);
  assert.match(html,/Замінити фото/);assert.match(html,/Прибрати/);
});
