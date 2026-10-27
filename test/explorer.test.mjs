import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {agriculturalRows,metricSummary,factoryRows,researchRows,validState,safeURL,escapeHTML,provinceMetricRows,productionBreakdown,rankRows,mapEstateSelection} from '../public/explorer-model.js';
import {colorFor,COLORS,legendStep,legendNumber} from '../public/explorer-map.js';
import {validateExplorer} from '../scripts/validate-explorer.mjs';
const data=JSON.parse(await readFile(new URL('../public/data/explorer-data.json',import.meta.url),'utf8'));
const base=validState(data,{product:'PRD_CASSAVA',industry:'all'});

test('fresh defaults include every crop, industry and area',()=>{
 const state=validState(data);
 for(const key of ['product','industry','province','region','district','estate'])assert.equal(state[key],'all');
 assert.equal(state.query,'');assert.equal(state.acceptedOnly,false);
 assert.equal(factoryRows(data,state).length,data.factories.length);
 assert.equal(provinceMetricRows(data,state).length,77);
});

test('map estate drilldown clears stale area/search and intersects the retained industry',()=>{
 const stale={...base,product:'all',province:'PROV_65',region:'north',district:'old-district',query:'old search',industry:'IG_875825912F21'};
 const selected=validState(data,{...stale,...mapEstateSelection(data,'ieat-9c85713b20b6')});
 assert.equal(selected.estate,'EST_AEB9AEE77E8F');assert.equal(selected.product,'all');assert.equal(selected.industry,stale.industry);
 assert.equal(selected.province,'all');assert.equal(selected.region,'all');assert.equal(selected.district,'all');assert.equal(selected.query,'');
 const all=factoryRows(data,{...selected,industry:'all'});assert.equal(all.length,141);
 const filtered=factoryRows(data,selected);assert(filtered.length>0);assert(filtered.length<all.length);
 assert(filtered.every(f=>f.estate_id==='EST_AEB9AEE77E8F'&&f.industry_id===stale.industry));
 assert.equal(factoryRows(data,{...selected,industry:'all',estate:'all'}).length,8604);
 const restored=validState(data,Object.fromEntries(new URLSearchParams({estate:selected.estate,industry:selected.industry,province:'all'})));
 assert.deepEqual(factoryRows(data,restored).map(f=>f.id),filtered.map(f=>f.id));
});

test('unmapped map estates never fall back to all factories; multiple registry aliases are included',()=>{
 const selection=mapEstateSelection(data,'no-registry-match');
 assert.equal(factoryRows(data,{...base,...selection}).length,0);
 const fixture={estates:[{estate_id:'A',estate_name:'A',map_id:'MAP'},{estate_id:'B',estate_name:'B',map_id:'MAP'},{estate_id:'C',estate_name:'C',map_id:'OTHER'}],factories:[{id:'1',estate_id:'A',province_id:null},{id:'2',estate_id:'B',province_id:'PROV_20'},{id:'3',estate_id:'C',province_id:'PROV_20'}]};
 const multi={...base,...mapEstateSelection(fixture,'MAP')};
 assert.equal(multi.estate,'map:MAP');assert.deepEqual(factoryRows(fixture,multi).map(f=>f.id),['1','2']);
});

test('all crops preserves the selected province, reconciles tonnage and shares',()=>{
 const state=validState(data,{product:'all',province:'PROV_65',industry:'all',metric:'AREA_PLANTED'});
 assert.equal(state.product,'all');assert.equal(state.province,'PROV_65');assert.equal(state.metric,'PRODUCTION');
 const rows=productionBreakdown(data,state);
 assert.deepEqual(rows.map(r=>r.value),[860070,824256,558068,146700,61730,36049]);
 assert.equal(rows[0].product_id,'PRD_SUGARCANE');
 assert.equal(rows.reduce((sum,r)=>sum+r.value,0),2486873);
 assert(Math.abs(rows.reduce((sum,r)=>sum+r.share,0)-100)<1e-10);
 assert.equal(rows.find(r=>r.product_id==='PRD_CASSAVA').share,558068/2486873*100);
 assert.deepEqual(rows[0].periods,['2566/67']);
 assert.deepEqual(rows[1].periods,['2567/68']);
 const mapRows=provinceMetricRows(data,state);
 assert.equal(mapRows.length,1);assert.equal(mapRows[0].metrics.PRODUCTION.value,2486873);
 assert.equal(metricSummary(provinceMetricRows(data,{...state,province:'all'}),'PRODUCTION').value,165823494);
 const ranking=rankRows(data,state);assert.equal(new Set(ranking.map(r=>r.province_id)).size,ranking.length);
});

test('all-crop shares distinguish missing production and zero; industry still filters research',()=>{
 const state={...base,product:'all',province:'unknown'};
 assert(productionBreakdown(data,state).every(r=>r.value===null&&r.share===null));
 const fixture={products:[{product_id:'A',name_th:'A'},{product_id:'B',name_th:'B'}],agriculture:[{product_id:'A',province_id:'P',crop_year:'2567',metrics:{PRODUCTION:{value:0,unit:'TONNE'}}}]};
 const rows=productionBreakdown(fixture,{product:'all',province:'P',region:'all'});
 assert.equal(rows[0].value,0);assert.equal(rows[0].share,null);assert.equal(rows[1].value,null);
 assert.equal(researchRows(data,{...base,product:'all'}).length,36);
 const filtered=researchRows(data,{...base,product:'all',industry:'IG_875825912F21'});
 assert(filtered.length>0);assert(filtered.every(r=>r.industries.some(i=>i.industry_id==='IG_875825912F21')));
});

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

 test('rounded legend boundaries match map colors and retain zero/missing',()=>{
 assert.equal(legendStep(10939568),2000000);assert.equal(legendStep(3660849),700000);
 assert.equal(legendNumber(1500000),'1.5 ล้าน');assert.equal(legendNumber(700000),'0.7 ล้าน');
 for(const max of [10939568,3660849,750000,0]){const step=legendStep(max);for(let i=1;i<5;i++){assert.equal(colorFor(step*i,max),COLORS[i]);assert.equal(colorFor(step*i-0.01,max),COLORS[i-1]);}}
 assert.equal(colorFor(null,10939568),'#e5e8e2');assert.equal(colorFor(0,10939568),'#f5f8ef');
 });
