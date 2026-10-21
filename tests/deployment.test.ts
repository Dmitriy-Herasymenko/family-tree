import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { ServerResponse, type IncomingMessage } from 'node:http';
import type { Request, Response } from 'express';
import handler from '../api/index';
import { allowedAppOrigins, isAllowedOrigin } from '../server/origin';

function request(url:string,method='GET',headers:Record<string,string>={}) {
  return new Promise<{status:number;body:string;headers:ReturnType<ServerResponse['getHeaders']>}>((resolve,reject)=>{
    const req=Readable.from([]) as unknown as IncomingMessage;
    req.url=url;req.method=method;req.headers=headers;
    const res=new ServerResponse(req);
    res.end=((chunk?:unknown)=>{resolve({status:res.statusCode,body:chunk?.toString()||'',headers:res.getHeaders()});return res;}) as ServerResponse['end'];
    try{handler(req as Request,res as Response);}catch(error){reject(error);}
  });
}

test('serverless handler serves the API directly without starting a port listener',async()=>{
  const result=await request('/api/status');
  assert.equal(result.status,200);
  assert.equal(typeof JSON.parse(result.body).configured,'boolean');
  assert.equal(result.headers['cache-control'],'no-store');
});
test('serverless handler keeps API paths and rejects unauthenticated access',async()=>{
  const result=await request('/api/auth/me');
  assert.ok([401,503].includes(result.status));
  assert.equal(typeof JSON.parse(result.body).error,'string');
});
test('foreign-origin writes remain blocked in the serverless handler',async()=>{
  const result=await request('/api/auth/register','POST',{'origin':'https://attacker.example','x-ridni-client':'web'});
  assert.equal(result.status,403);
});
test('Vercel deployment and production domains are explicit allowed origins',()=>{
  const origins=allowedAppOrigins({VERCEL:'1',NODE_ENV:'production',VERCEL_URL:'ridni-abc.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'ridni.vercel.app',APP_ORIGIN:'https://family.example'});
  assert.deepEqual(origins,['https://family.example','https://ridni-abc.vercel.app','https://ridni.vercel.app']);
  assert.ok(origins.some(origin=>isAllowedOrigin('https://ridni.vercel.app',origin,true)));
  assert.ok(!origins.some(origin=>isAllowedOrigin('https://someone-else.vercel.app',origin,true)));
  assert.ok(!origins.some(origin=>isAllowedOrigin('http://localhost:5173',origin,true)));
});
test('production without an origin fails closed while local development keeps localhost',()=>{
  assert.deepEqual(allowedAppOrigins({NODE_ENV:'production'}),[]);
  assert.deepEqual(allowedAppOrigins({VERCEL:'1',NODE_ENV:'production'}),[]);
  assert.deepEqual(allowedAppOrigins({}),['http://localhost:5173']);
});
