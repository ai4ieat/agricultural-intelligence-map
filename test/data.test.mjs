import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import contract from '../public/data-contract.js';
const read=async f=>JSON.parse(await readFile(new URL('../public/data/'+f,import.meta.url),'utf8'));
const ag=await read('agriculture.json'),factories=await read('factories.json');
const provinces=new Map((await read('provinces.geojson')).features.map(f=>[f.properties.code,f.properties.name]));
const validate=(data,kind)=>contract.validate(data,kind,provinces);
test('sample data has valid province joins and preserves missing values',()=>{validate(ag,'agriculture');validate(factories,'factories');assert.equal(ag.records[2].production.value,null);});
test('duplicate IDs and invalid province joins are rejected',()=>{let d=structuredClone(ag);d.records.push(d.records[0]);assert.throws(()=>validate(d,'agriculture'),/Duplicate/);d=structuredClone(ag);d.records[0].province_code='99';assert.throws(()=>validate(d,'agriculture'),/province/);});
test('reject swapped coordinates, unknown estate and numeric strings',()=>{let d=structuredClone(factories);d.records[0].coordinates.reverse();assert.throws(()=>validate(d,'factories'),/coordinates/);d=structuredClone(factories);d.records[0].estate_id='invented';assert.throws(()=>validate(d,'factories'),/estate/);d=structuredClone(ag);d.records[0].production.value='7200';assert.throws(()=>validate(d,'agriculture'),/value/);});
test('zero is a real value; invalid units and missing timezone fail',()=>{let d=structuredClone(ag);d.records[0].production.value=0;validate(d,'agriculture');d.records[0].production.unit='kg';assert.throws(()=>validate(d,'agriculture'),/unit/);d=structuredClone(ag);d.updated_at='2026-10-09';assert.throws(()=>validate(d,'agriculture'),/timezone/);});
test('filter extension selects province, crop and business type',()=>{assert.equal(contract.filterRecords(ag.records,{commodityCode:'rice'}).length,2);assert.equal(contract.filterRecords(ag.records,{provinceCode:'21'}).length,1);assert.equal(contract.filterRecords(factories.records,{businessTypeCode:'grain-processing'}).length,1);});
test('public application has no legacy endpoints, monitoring modules or direct Sheets calls',async()=>{
  const publicRoot=new URL('../public/',import.meta.url);
  for(const f of await readdir(publicRoot)){
    if(!/\.(js|html|css|json)$/.test(f))continue;
    const s=await readFile(new URL(f,publicRoot),'utf8');
    assert.doesNotMatch(s,/\/api\/|workers\.dev|sheets\.googleapis|docs\.google\.com\/spreadsheets|IEAT_(?:WATER|RAIN|DAMS|CONTROLS|TERRAIN|FLOOD)|nasa-flood|dashboard\.html/i,f);
  }
});
