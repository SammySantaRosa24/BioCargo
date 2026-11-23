import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { createDriverPhotoRouter } from '../src/routes/driverPhotoRoutes.js';

function png() {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c=n; for(let i=0;i<8;i+=1)c=c&1?0xedb88320^(c>>>1):c>>>1; return c>>>0; });
  const chunk=(type,data)=>{const name=Buffer.from(type), body=Buffer.concat([name,data]);let c=0xffffffff;for(const b of body)c=crcTable[(c^b)&255]^(c>>>8);const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([len,body,crc]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,250,20,30,255]))),chunk('IEND',Buffer.alloc(0))]);
}
function makePool(){
  const state={ filename:null, available:true, interests:[] };
  async function execute(sql,values=[]){
    if(sql.includes('FROM usuario')){const id=Number(values[0]);return [[{id,tipo_usuario:id===1?'MOTORISTA':id===2?'EMPRESA':'ADMIN',status:1}]];}
    if(sql.includes('FROM empresa WHERE usuario_id'))return [[{id:50}]];
    if(sql.includes('SELECT m.usuario_id AS usuarioId'))return state.filename?[[{usuarioId:1,disponivel:state.available,foto:state.filename}]]:[[]];
    if(sql.includes('SELECT id FROM interesse'))return [state.interests];
    if(sql.includes('SELECT foto_perfil_arquivo FROM motorista'))return state.filename?[[{foto_perfil_arquivo:state.filename}]]:[[]];
    return [[]];
  }
  return {state,execute,async getConnection(){return {async execute(sql,values=[]){if(sql.includes('SELECT id, foto_perfil_arquivo'))return [[{id:30,fotoAnterior:state.filename}]];if(sql.startsWith('UPDATE motorista SET foto_perfil_arquivo')){state.filename=values[0];return [{affectedRows:1}];}return [[]];},async beginTransaction(){},async commit(){},async rollback(){},release(){}};}};
}
async function withApi(run){const storage=await mkdtemp(path.join(os.tmpdir(),'biocargo-photo-'));const pool=makePool();const app=express();app.use((req,_res,next)=>{const id=Number(req.get('x-test-user'));req.session={...(id?{usuario:{id}}:{}),destroy(callback){callback();}};next();});app.use('/api/v1',createDriverPhotoRouter(pool,{storageDir:storage}));const server=createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{await run(`http://127.0.0.1:${server.address().port}`,pool,storage);}finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await rm(storage,{recursive:true,force:true});}}
function uploadForm(bytes=png(),mime='image/png'){const form=new FormData();form.set('fotoPerfil',new Blob([bytes],{type:mime}),'profile.png');return form;}

test('driver can upload and replace private photo; authorized company and ADMIN can view it',async()=>withApi(async(base,pool,storage)=>{
  const upload=await fetch(`${base}/api/v1/drivers/me/photo`,{method:'PUT',headers:{'x-test-user':'1'},body:uploadForm()});assert.equal(upload.status,200);const first=pool.state.filename;
  const own=await fetch(`${base}/api/v1/drivers/me/photo`,{headers:{'x-test-user':'1'}});assert.equal(own.status,200);assert.equal(own.headers.get('content-type'),'image/png');
  const company=await fetch(`${base}/api/v1/drivers/30/photo`,{headers:{'x-test-user':'2'}});assert.equal(company.status,200);
  const admin=await fetch(`${base}/api/v1/drivers/30/photo`,{headers:{'x-test-user':'3'}});assert.equal(admin.status,200);
  const replace=await fetch(`${base}/api/v1/drivers/me/photo`,{method:'PUT',headers:{'x-test-user':'1'},body:uploadForm()});assert.equal(replace.status,200);assert.notEqual(pool.state.filename,first);assert.equal((await readdir(storage)).length,1);
}));
test('photo upload rejects unauthenticated, invalid and oversized images and hides profiles from unrelated companies',async()=>withApi(async(base,pool)=>{
  assert.equal((await fetch(`${base}/api/v1/drivers/me/photo`,{method:'PUT',body:uploadForm()})).status,401);
  assert.equal((await fetch(`${base}/api/v1/drivers/me/photo`,{method:'PUT',headers:{'x-test-user':'1'},body:uploadForm(Buffer.from('not an image'))})).status,422);
  assert.equal((await fetch(`${base}/api/v1/drivers/me/photo`,{method:'PUT',headers:{'x-test-user':'1'},body:uploadForm(Buffer.alloc(5*1024*1024+1))})).status,422);
  pool.state.filename='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png';pool.state.available=false;
  assert.equal((await fetch(`${base}/api/v1/drivers/30/photo`,{headers:{'x-test-user':'2'}})).status,404);
}));