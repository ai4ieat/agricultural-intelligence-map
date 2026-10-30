import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function validateBioResources(b,base){
 assert.equal(b.schema_version,1);assert.ok(Number.isFinite(Date.parse(b.exported_at)));
 const index=(rows,key)=>{const m=new Map(rows.map(r=>[r[key],r]));assert.equal(m.size,rows.length,'Duplicate '+key);return m;};
 const products=index(b.products,'product_id'),series=index(b.series,'series_id'),sources=index(b.sources,'source_id');
 const provinces=new Set(base.provinces.map(p=>p.id)),oldProducts=new Set(base.products.map(p=>p.product_id));
 for(const p of products.values()){assert.ok(!oldProducts.has(p.product_id),'Must preserve original product IDs');assert.ok(['crops','fisheries','livestock'].includes(p.category));}
 for(const s of series.values()){
  assert.ok(products.has(s.product_id)&&sources.has(s.source_id),'Series foreign key');assert.ok(['province','national'].includes(s.geography_level));
  assert.ok(s.years.length&&s.years.every(y=>Number.isInteger(y)&&y>2500&&y<2700));assert.equal(new Set(s.years).size,s.years.length);
  for(const m of Object.values(s.metrics)){assert.ok(b.units[m.unit],'Known metric unit');assert.ok(['sum','none'].includes(m.aggregation));}
 }
 const keys=new Set();
 for(const [rows,isNational] of [[b.rows,false],[b.national_rows,true]])for(const r of rows){
  const s=series.get(r.series_id);assert.ok(s&&s.product_id===r.product_id&&sources.has(r.source_id),'Observation foreign key');
  assert.ok(isNational?r.province_id==='TH':provinces.has(r.province_id),'Map must use actual province IDs only');
  assert.ok(s.years.includes(r.year),'Observation year must exist in series');
  const key=[r.series_id,r.province_id,r.year].join('|');assert.ok(!keys.has(key),'Duplicate series/year/geography');keys.add(key);
  assert.ok(Object.keys(r.metrics).length);
  for(const [id,v] of Object.entries(r.metrics)){
   assert.ok(s.metrics[id],'Metric belongs to series');assert.ok(v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0,'Numeric value');
   const e=r.evidence[id];assert.ok(e?.id&&e.locator,'Evidence locator');assert.ok(['reported','source_rounded','missing_symbol'].includes(e.status));
   assert.equal(v===null,e.status==='missing_symbol','Missing must remain null');
   assert.ok(!/hold_/.test(e.status),'No held records in website totals');
  }
 }
 return {products:products.size,series:series.size,province_rows:b.rows.length,national_rows:b.national_rows.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const read=async name=>JSON.parse(await readFile(new URL('../public/data/'+name,import.meta.url),'utf8'));
 console.log(validateBioResources(await read('bio-resources.json'),await read('explorer-data.json')));
}
