import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArchive} from '../app/research/archiveValidation.mjs';
const contract={kind:'object',fields:{count:{shape:{kind:'number'},optional:false},sourceUrl:{shape:{kind:'string'},optional:true}}};
test('valid structural archive loads without mutation',()=>{assert.deepEqual(parseArchive('{"count":2}',contract),{count:2});});
test('missing fields and malformed JSON are rejected',()=>{assert.throws(()=>parseArchive('{}',contract));assert.throws(()=>parseArchive('not json',contract));});
test('active and credential-bearing links cannot enter archives',()=>{for(const sourceUrl of ['javascript:alert(1)','https://user:secret@example.com/','file:///private'])assert.throws(()=>parseArchive(JSON.stringify({count:1,sourceUrl}),contract));});
test('prototype keys, extreme sizes and numeric overflow are rejected',()=>{
  assert.throws(()=>parseArchive('{"count":1,"__proto__":{}}',contract));
  assert.throws(()=>parseArchive('{"count":1e999}',contract));
  assert.throws(()=>parseArchive(' '.repeat(8*1024*1024+1),contract));
});
