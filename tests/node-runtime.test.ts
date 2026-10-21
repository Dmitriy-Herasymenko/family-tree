import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { databaseConfig } from '../server/database-config.js';

test('compiled serverless API loads in native Node ESM without tsx',()=>{
  const output=mkdtempSync(path.join(tmpdir(),'ridni-native-api-'));
  try {
    const compile=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.server.json','--noEmit','false','--outDir',output,'--rootDir','.'],{encoding:'utf8'});
    assert.equal(compile.status,0,compile.stdout+compile.stderr);
    writeFileSync(path.join(output,'package.json'),JSON.stringify({type:'module'}));
    symlinkSync(path.resolve('node_modules'),path.join(output,'node_modules'),process.platform==='win32'?'junction':'dir');
    const entry=pathToFileURL(path.join(output,'api/index.js')).href;
    const run=spawnSync(process.execPath,['--input-type=module','-e',`const {default:handler}=await import(${JSON.stringify(entry)});if(typeof handler!=='function')throw Error('Invalid API export');console.log('API_READY');`],{encoding:'utf8',env:{...process.env,DATABASE_URL:'invalid-connection-string'}});
    assert.equal(run.status,0,run.stderr);
    assert.match(run.stdout,/API_READY/);
  }finally{rmSync(output,{recursive:true,force:true});}
});
test('missing and malformed database settings do not crash module initialization',()=>{
  assert.equal(databaseConfig(undefined).issue,'missing_database_url');
  assert.equal(databaseConfig('').issue,'missing_database_url');
  for(const value of ['not-a-url','https://example.com/db','postgresql://host','"postgresql://user:pass@host/db"'])assert.equal(databaseConfig(value).issue,'invalid_database_url');
});
test('valid Postgres configuration keeps TLS verification and never reports credentials in errors',()=>{
  const config=databaseConfig('postgresql://user:sample-password@host.example/db?sslmode=require');
  assert.equal(config.issue,undefined);
  assert.equal(new URL(config.connectionString!).searchParams.get('sslmode'),'verify-full');
  assert.deepEqual(databaseConfig('invalid sample-password'),{issue:'invalid_database_url'});
});
