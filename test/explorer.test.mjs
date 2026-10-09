import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {agriculturalRows,metricSummary,factoryRows,researchRows,validState,safeURL,escapeHTML} from '../public/explorer-model.js';
import {colorFor,COLORS} from '../public/explorer-map.js';
import {validateExplorer} from '../scripts/validate-explorer.mjs';
const data=JSON.parse(await readFile(new URL('../public/data/explorer-data.json',import.meta.url),'utf8'));
const base=validState(data,{industry:'all'});

test('invalid cross-region state normalizes and choropleth boundaries agree',()=>{
 assert.equal(validState(data,{region:'south',province:'PROV_30'}).region,'all');
 assert.equal(validState(data,{region:'south',province:'unknown'}).region,'all');
 assert.equal(colorFor(null,100),'#e5e8e2');assert.equal(colorFor(0,100),'#f5f8ef');
 assert.equal(colorFor(19,100),COLORS[0]);assert.equal(colorFor(20,100),COLORS[1]);assert.equal(colorFor(99,100),COLORS[4]);assert.equal(colorFor(100,100),COLORS[4]);
});
test('published snapshot validator rejects duplicate periods and broken research evidence',()=>{
 validateExplorer(data);
 let d=structuredClone(data);d.agriculture.push({...d.agriculture[0],year:2568});assert.throws(()=>validateExplorer(d),/More than one/);
 d=structuredClone(data);d.agriculture[0].metrics.PRODUCTION.unit='RAI';assert.throws(()=>validateExplorer(d),/Metric unit/);
 d=structuredClone(data);d.research[0].products[0].evidence_document_id='other-work';assert.throws(()=>validateExplorer(d),/same work/);
});
test('six production totals reconcile to original OAE source controls',()=>{
 const controls={PRD_CASSAVA:28624312,PRD_RICE:27008658,PRD_SUGARCANE:82169922,PRD_NATURAL_RUBBER:4811033,PRD_FEED_MAIZE:4657571,PRD_OIL_PALM:18551998};
 for(const [product,expected] of Object.entries(controls))assert.equal(metricSummary(agriculturalRows(data,{...base,product}),'PRODUCTION').value,expected,product);
 assert.equal(metricSummary(agriculturalRows(data,base),'PRODUCTION').count,54);
});
test('province totals, no-data and zero remain distinct; yields are never summed',()=>{
 assert.equal(metricSummary(agriculturalRows(data,{...base,province:'PROV_30'}),'PRODUCTION').value,3660849);
 assert.equal(metricSummary(agriculturalRows(data,{...base,province:'PROV_10'}),'PRODUCTION').value,null);
 assert.equal(metricSummary([{metrics:{PRODUCTION:{value:0,unit:'TONNE'}}}],'PRODUCTION').value,0);
 assert.throws(()=>metricSummary(agriculturalRows(data,base),'YIELD_HARVESTED'),/must not/);
});
test('geographic filters preserve unknown factory addresses and district intersections',()=>{
 assert.equal(factoryRows(data,base).length,8604);
 assert.equal(factoryRows(data,{...base,province:'unknown'}).length,215);
 const p=factoryRows(data,{...base,province:'PROV_20'});assert(p.length>0);assert(p.every(r=>r.province_id==='PROV_20'));
 const d=p.find(r=>r.district_id);const rows=factoryRows(data,{...base,province:'PROV_20',district:d.district_id});assert(rows.length>0);assert(rows.every(r=>r.province_id==='PROV_20'&&r.district_id===d.district_id));
});
test('text search is literal and does not infer that every result manufactures tyres',()=>{
 const rows=factoryRows(data,{...base,query:'ยางรถ'});assert.equal(rows.length,44);assert(rows.some(r=>r.activity.includes('คลังสินค้า')));
 assert.equal(factoryRows(data,{...base,query:'no-such-factory-000'}).length,0);
 assert.equal(factoryRows(data,{...base,industry:'IG_875825912F21'}).length,567);
});
test('research uses crop AND industry joins; pending mappings cannot pass accepted-only',()=>{
 assert.deepEqual(researchRows(data,{...base,industry:'IG_875825912F21'}).map(r=>r.id),['RES_F5CE3C91CAFE','RES_7E33175BDF62','RES_3CC724C8976B']);
 assert.equal(researchRows(data,{...base,product:'PRD_NATURAL_RUBBER',industry:'IND_TYRE_MANUFACTURING'}).length,1);
 assert.equal(researchRows(data,{...base,product:'PRD_SUGARCANE',industry:'IND_TYRE_MANUFACTURING'}).length,0);
 assert.equal(researchRows(data,{...base,acceptedOnly:true}).length,0);
 const all=researchRows(data,{...base,researchAll:true});assert.equal(all.length,36);assert.equal(all.filter(r=>!r.products.length).length,11);
 assert.ok(all.some(r=>r.id==='RES_A7417A90BB33')); // Coffee study has no link to the six mapped crops.
 assert.equal(researchRows(data,{...base,researchAll:true,acceptedOnly:true}).length,0);
});
test('all current normalized IDs join and source records are not silently deduplicated',()=>{
 assert.equal(new Set(data.factories.map(f=>f.id)).size,8604);
 const provinces=new Set(data.provinces.map(p=>p.id)),industries=new Set(data.industries.map(i=>i.industry_id)),estates=new Set(data.estates.map(e=>e.estate_id));
 for(const f of data.factories){assert(!f.province_id||provinces.has(f.province_id));assert(!f.industry_id||industries.has(f.industry_id));assert(estates.has(f.estate_id));assert(!('coordinates' in f));}
 const seen=new Set();for(const r of data.agriculture){const key=[r.product_id,r.province_id,r.crop_year].join('|');assert(!seen.has(key));seen.add(key);}
});
test('untrusted source text is escaped and unsafe URLs rejected',()=>{assert.equal(safeURL('javascript:alert(1)'),null);assert.equal(safeURL('https://doi.org/10.3390/su152014713'),'https://doi.org/10.3390/su152014713');assert.equal(escapeHTML('<script>"&'),'&lt;script&gt;&quot;&amp;');});
test('entrypoint loads real data explorer without legacy samples or monitoring scripts',async()=>{const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.match(html,/explorer.js/);assert.doesNotMatch(html,/src="(?:app|mobile-layout|agriculture|data-contract)\.js"/);assert.doesNotMatch(html,/ข้อมูลสมมติ|ตัวอย่าง|NASA|Terrain|AI Chat/);});
