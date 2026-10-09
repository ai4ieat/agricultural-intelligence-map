import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {filterResearch} from '../public/research-model.js';
const data=JSON.parse(await readFile(new URL('../public/data/explorer-data.json',import.meta.url),'utf8'));
test('library includes all 36 works and unmapped materials remain searchable',()=>{
 assert.equal(filterResearch(data).length,36);
 assert.equal(filterResearch(data,{mapping:'unmapped'}).length,11);
 assert.deepEqual(filterResearch(data,{material:'กากกาแฟ',mapping:'unmapped'}).map(r=>r.id),['RES_A7417A90BB33']);
});
test('material and output intersect and free text searches Thai/English literally',()=>{
 assert.deepEqual(filterResearch(data,{material:'ชานอ้อย',output:'วัสดุปิดแผล'}).map(r=>r.id),['RES_6B2A2134FDA9']);
 assert.equal(filterResearch(data,{material:'กากกาแฟ',output:'วัสดุปิดแผล'}).length,0);
 assert.deepEqual(filterResearch(data,{q:'phb',product:'PRD_CASSAVA'}).map(r=>r.id),['RES_3CC724C8976B']);
 assert.equal(filterResearch(data,{q:'[not-a-regex]'}).length,0);
});
test('facets combine, years sort numerically and acceptance is not inferred',()=>{
 assert.equal(filterResearch(data,{study:'pilot_clinical_study'}).length,1);
 assert.equal(filterResearch(data,{status:'accepted'}).length,0);
 assert.equal(filterResearch(data,{product:'PRD_CASSAVA',industry:'IG_875825912F21'}).length,3);
 const rows=filterResearch(data);assert.ok(rows.every((r,i)=>!i||rows[i-1].year>=r.year));
 const old=filterResearch(data,{sort:'oldest'});assert.ok(old.every((r,i)=>!i||old[i-1].year<=r.year));
 assert.ok(filterResearch(data,{year:'2025'}).every(r=>r.year===2025));
});
