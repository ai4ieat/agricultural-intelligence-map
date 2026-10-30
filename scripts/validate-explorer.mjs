import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validateFactoryTags} from './validate-factory-tags.mjs';
import {validateBioResources} from './validate-bio-resources.mjs';

export function validateExplorer(d,mapIds){
 assert.equal(d.schema_version,2,'schema_version');
 assert.equal(d.mode,'review','Only the reviewed prototype contract is implemented');
 assert.ok(Number.isFinite(Date.parse(d.exported_at)),'exported_at');
 const index=(rows,key)=>{assert.ok(Array.isArray(rows),key);const ids=new Set(rows.map(x=>x[key]));assert.equal(ids.size,rows.length,'Duplicate '+key);assert.ok([...ids].every(x=>typeof x==='string'&&x.length),key);return ids;};
 const products=index(d.products,'product_id'),industries=index(d.industries,'industry_id'),provinces=index(d.provinces,'id'),estates=index(d.estates,'estate_id'),sources=index(d.sources,'source_id');
 index(d.factories,'id');index(d.research,'id');
 const pairs=new Set(),years=new Map();
 for(const r of d.agriculture){
  assert.ok(products.has(r.product_id)&&provinces.has(r.province_id)&&sources.has(r.source_id),'Agriculture foreign key');
  const pair=r.product_id+'/'+r.province_id;assert.ok(!pairs.has(pair),'More than one crop/year/source per province: add a year/source selector before importing');pairs.add(pair);
  const period=String(r.year)+'/'+r.crop_year;
  assert.ok(!years.has(r.product_id)||years.get(r.product_id)===period,'Mixed crop years cannot be aggregated');years.set(r.product_id,period);
  assert.ok(Object.keys(r.metrics).length,'Empty metrics');
  for(const [key,m] of Object.entries(r.metrics)){
   assert.ok(m.value===null||(typeof m.value==='number'&&Number.isFinite(m.value)&&m.value>=0),'Invalid metric value');
   const expected=key==='PRODUCTION'?'TONNE':key.startsWith('YIELD_')?'KG_PER_RAI':'RAI';
   assert.equal(m.unit,expected,'Metric unit '+key);
  }
 }
 for(const f of d.factories){
  assert.ok(estates.has(f.estate_id),'Factory estate key');
  assert.ok(!f.province_id||provinces.has(f.province_id),'Factory province key');
  assert.ok(!f.industry_id||industries.has(f.industry_id),'Factory industry key');
  assert.ok(!('coordinates' in f),'Factory coordinates require a verified new contract');
 }
 for(const e of d.estates)if(e.map_id&&mapIds)assert.ok(mapIds.has(e.map_id),'Estate map key');
 const statuses=new Set(['pending','accepted','rejected','needs_review']);
 for(const r of d.research){
  assert.ok(statuses.has(r.review_status),'Research review status');
  assert.ok(typeof r.doi==='string'&&/^10\.\d{4,9}\/[^\s<>"']+$/.test(r.doi),'Research DOI');
  const docs=index(r.documents,'document_id');
  for(const link of [...r.products,...r.industries]){
   assert.ok(link.product_id?products.has(link.product_id):industries.has(link.industry_id),'Research mapping key');
   assert.ok(docs.has(link.evidence_document_id),'Research evidence must belong to the same work');
   assert.ok(statuses.has(link.review_status),'Mapping review status');
  }
 }
 return {agriculture:d.agriculture.length,factory_rows:d.factories.length,research:d.research.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const read=async name=>JSON.parse(await readFile(new URL('../public/data/'+name,import.meta.url),'utf8'));
 const ids=new Set((await Promise.all(['area-ieat.geojson','supplemental-estates.geojson'].map(read))).flatMap(d=>d.features.map(f=>f.properties.estate_id)));
 const data=await read('explorer-data.json');
 console.log(validateExplorer(data,ids));
 console.log(validateFactoryTags(await read('factory-tags.json'),data));
 console.log(validateBioResources(await read('bio-resources.json'),data));
}
