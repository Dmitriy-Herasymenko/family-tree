import express, { type Request, type Response, type NextFunction } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';
import { pool, configured } from './db';
import { hashPassword, verifyPassword, sessionToken, tokenHash } from './security';
import { HttpError, credentials, text, validateTree } from './validation';
import type { Tree } from '../src/data';
import { isAllowedOrigin } from './origin';
import { persistPhotos, lockPhotos, cleanUnusedPhotos } from './photos';

const DAY = 86400000;
export const app = express();
app.disable('x-powered-by');
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options','nosniff'); next(); });
app.use('/api', (req, _res, next) => {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const allowed = process.env.APP_ORIGIN || 'http://localhost:5173';
  if (req.get('x-ridni-client') !== 'web' || !isAllowedOrigin(req.get('origin'),allowed,process.env.NODE_ENV==='production')) return next(new HttpError(403,'Запит із недозволеного джерела.'));
  next();
});
app.use(express.json({ limit: '2mb' }));
const route = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req,res)).catch(next); };
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
async function createSession(userId: string, res: Response) {
  const token = randomBytes(32).toString('hex');
  await pool.query('INSERT INTO ridni_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[tokenHash(token),userId,new Date(Date.now()+30*DAY)]);
  res.cookie('ridni_session',token,{...cookieOptions,maxAge:30*DAY});
}
async function user(req: Request) {
  const token = sessionToken(req.headers.cookie);
  if (!token) throw new HttpError(401,'Увійдіть до свого облікового запису.');
  const { rows } = await pool.query('SELECT u.id,u.name,u.email FROM ridni_sessions s JOIN ridni_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[tokenHash(token)]);
  if (!rows[0]) throw new HttpError(401,'Сесія завершилася. Увійдіть знову.');
  return rows[0] as {id: string; name: string; email: string};
}
// A bounded process-local limiter; use a shared limiter for multiple server instances.
const attempts = new Map<string,{count: number; until: number}>();
app.use('/api/auth', (req,_res,next) => {
  if (req.method!=='POST' || !['/login','/register'].includes(req.path)) return next();
  const now=Date.now();
  for (const [key,value] of attempts) if(value.until<now) attempts.delete(key);
  const key=req.ip || 'unknown'; const entry=attempts.get(key) || {count:0,until:now+15*60*1000};
  if (++entry.count>20 || attempts.size>10000) return next(new HttpError(429,'Забагато спроб. Спробуйте через 15 хвилин.'));
  attempts.set(key,entry);next();
});
app.get('/api/status',(_req,res) => res.json({configured}));
app.use('/api',(_req,_res,next)=>configured?next():next(new HttpError(503,'Базу даних ще не підключено.')));
app.get('/api/auth/me',route(async(req,res)=>res.json({profile:await user(req)})));
app.post('/api/auth/register',route(async(req,res)=>{
  const input=credentials(req.body||{},true);
  const familyName=text(req.body?.familyName ?? 'Моє родинне дерево','Назва родини',80,true);
  const hash=await hashPassword(input.password);
  const id=randomUUID(); const treeId=randomUUID(); const token=randomBytes(32).toString('hex');
  const data={id:treeId,name:familyName,description:'Тут починається історія нашої родини.',people:[],rootId:'',createdAt:new Date().toISOString()};
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO ridni_users(id,name,email,password_hash) VALUES($1,$2,$3,$4)',[id,input.name,input.email,hash]);
    await client.query('INSERT INTO ridni_trees(id,owner_id,data) VALUES($1,$2,$3)',[treeId,id,JSON.stringify(data)]);
    await client.query('INSERT INTO ridni_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[tokenHash(token),id,new Date(Date.now()+30*DAY)]);
    await client.query('COMMIT');
  } catch(error) {await client.query('ROLLBACK');if((error as {code?:string}).code==='23505')throw new HttpError(409,'Ця електронна пошта вже зареєстрована.');throw error;} finally {client.release();}
  res.cookie('ridni_session',token,{...cookieOptions,maxAge:30*DAY});
  res.status(201).json({profile:{id,name:input.name,email:input.email}});
}));
const dummyHash=await hashPassword(randomBytes(32).toString('hex'));
app.post('/api/auth/login',route(async(req,res)=>{
  const input=credentials(req.body||{});
  const {rows}=await pool.query('SELECT id,name,email,password_hash FROM ridni_users WHERE email=$1',[input.email]);
  const account=rows[0]; const valid=await verifyPassword(input.password,account?.password_hash || dummyHash);
  if(!account || !valid)throw new HttpError(401,'Невірна електронна пошта або пароль.');
  await createSession(account.id,res);
  res.json({profile:{id:account.id,name:account.name,email:account.email}});
}));
app.post('/api/auth/logout',route(async(req,res)=>{
  const token=sessionToken(req.headers.cookie);
  if(token)await pool.query('DELETE FROM ridni_sessions WHERE token_hash=$1',[tokenHash(token)]);
  res.clearCookie('ridni_session',cookieOptions);res.json({ok:true});
}));
app.patch('/api/auth/profile',route(async(req,res)=>{
  const account=await user(req);const name=text(req.body?.name,'Ім’я',80,true);
  await pool.query('UPDATE ridni_users SET name=$1 WHERE id=$2',[name,account.id]);
  res.json({profile:{...account,name}});
}));
app.get('/api/trees',route(async(req,res)=>{
  const account=await user(req);
  const {rows}=await pool.query('SELECT data,version FROM ridni_trees WHERE owner_id=$1 ORDER BY created_at,id',[account.id]);
  res.json({trees:rows.map(row=>({...row.data,version:row.version}))});
}));
app.post('/api/trees',route(async(req,res)=>{
  const account=await user(req);let tree=validateTree(req.body);tree.id=randomUUID();tree.createdAt=new Date().toISOString();
  const client=await pool.connect();
  try {
    await client.query('BEGIN');await lockPhotos(account.id,client);
    tree=await persistPhotos(tree,account.id,client);
    await client.query('INSERT INTO ridni_trees(id,owner_id,data) VALUES($1,$2,$3)',[tree.id,account.id,JSON.stringify(tree)]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  res.status(201).json({tree:{...tree,version:1}});
}));
app.post('/api/trees/import',route(async(req,res)=>{
  const account=await user(req);
  if(!Array.isArray(req.body?.trees)||req.body.trees.length<1||req.body.trees.length>20)throw new HttpError(400,'За один раз можна перенести від 1 до 20 дерев.');
  const trees:Tree[]=(req.body.trees as unknown[]).map(validateTree).map(tree=>({...tree,id:randomUUID(),createdAt:new Date().toISOString()}));
  const client=await pool.connect();
  try {await client.query('BEGIN');await lockPhotos(account.id,client);for(let i=0;i<trees.length;i++){trees[i]=await persistPhotos(trees[i],account.id,client);const tree=trees[i];await client.query('INSERT INTO ridni_trees(id,owner_id,data) VALUES($1,$2,$3)',[tree.id,account.id,JSON.stringify(tree)]);}await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  res.status(201).json({trees:trees.map(tree=>({...tree,version:1}))});
}));
app.put('/api/trees/:id',route(async(req,res)=>{
  const account=await user(req);
  if(!/^[0-9a-f-]{36}$/i.test(String(req.params.id)))throw new HttpError(404,'Дерево не знайдено.');
  let tree=validateTree(req.body);tree.id=String(req.params.id);
  const version=req.body?.version;
  if(!Number.isSafeInteger(version)||version<1)throw new HttpError(400,'Відсутня версія дерева. Оновіть сторінку.');
  const client=await pool.connect();let savedVersion:number;
  try {
    await client.query('BEGIN');await lockPhotos(account.id,client);
    const found=await client.query('SELECT version FROM ridni_trees WHERE id=$1 AND owner_id=$2 FOR UPDATE',[tree.id,account.id]);
    if(!found.rows[0])throw new HttpError(404,'Дерево не знайдено.');
    if(found.rows[0].version!==version)throw new HttpError(409,'Дерево змінено в іншій вкладці. Оновіть сторінку перед редагуванням.');
    tree=await persistPhotos(tree,account.id,client);
    const {rows}=await client.query('UPDATE ridni_trees SET data=$1,version=version+1,updated_at=now() WHERE id=$2 AND owner_id=$3 AND version=$4 RETURNING version',[JSON.stringify(tree),tree.id,account.id,version]);
    savedVersion=rows[0].version;
    await cleanUnusedPhotos(account.id,client);await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  res.json({tree:{...tree,version:savedVersion}});
}));
app.get('/api/photos/:id',route(async(req,res)=>{
  const account=await user(req);const id=String(req.params.id);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new HttpError(404,'Фото не знайдено.');
  const {rows}=await pool.query('SELECT data FROM ridni_photos WHERE id=$1 AND owner_id=$2',[id,account.id]);
  if(!rows[0])throw new HttpError(404,'Фото не знайдено.');
  res.set('Content-Type','image/jpeg');res.set('Cross-Origin-Resource-Policy','same-origin');res.send(rows[0].data);
}));
app.use('/api',(_req,_res,next)=>next(new HttpError(404,'Маршрут не знайдено.')));
if(process.env.NODE_ENV==='production'){
  app.use(express.static(path.resolve('dist'),{index:'index.html'}));
  app.get(['/login','/register'],(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
}
app.use((error: unknown,_req: Request,res: Response,_next: NextFunction)=>{
  if(error instanceof HttpError)return res.status(error.status).json({error:error.message});
  const status=(error as {status?:number})?.status;
  if(status===400||status===413)return res.status(status).json({error:status===413?'Завеликий обсяг даних.':'Невірний формат запиту.'});
  console.error('API request failed.');
  res.status(503).json({error:'Не вдалося виконати запит. Перевірте підключення та спробуйте знову.'});
});
