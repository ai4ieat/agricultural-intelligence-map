import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {attachBioResources,resourceSummary,resourceRows,resourceSeries,resourceProducts,metricDescriptor,selectedSeries,unitLabel} from '../public/bio-model.js';
import {validState,provinceMetricRows,productionBreakdown,researchRows,factoryRows} from '../public/explorer-model.js';
import {validateBioResources} from '../scripts/validate-bio-resources.mjs';
import {legendNumber,legendStep,colorFor,COLORS} from '../public/explorer-map.js';
const read=async n=>JSON.parse(await readFile(new URL('../public/data/'+n,import.meta.url),'utf8'));
const original=await read('explorer-data.json'),snapshot=await read('bio-resources.json');
const data=attachBioResources(structuredClone(original),snapshot);
const state=input=>validState(data,input);
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.00001,`${a} != ${b}`);

test('new relational snapshot joins to original provinces and adds 150 products without replacing six originals',()=>{
 assert.equal(validateBioResources(snapshot,original).products,150);
 for(const [category,count] of [['crops',104],['fisheries',39],['livestock',13]])assert.equal(resourceProducts(data,state({category})).length,count);
 assert.deepEqual(data.agriculture,original.agriculture);assert.equal(data.factories.length,8604);
 assert.deepEqual(snapshot.report.excluded,{crops_review_rows:181,crops_catalog_without_statistics:1,fisheries_held_rows:41,fisheries_other_geography_rows:8});
});
test('province production reconciles to independently read Google Sheet controls',()=>{
 for(const [product,value,unit,count] of [
  ['PRD_DURIAN',1573851.69,'TONNE',67],['PRD_MATURE_COCONUT',597541122,'FRUIT',43],
  ['PRD_AQ_0021',275958,'TONNE',77],['PRD_LV_PIG',11636358,'HEAD',75],
  ['PRD_LV_RAW_MILK',1032421,'TONNE',70],['PRD_LV_DUCK_EGG',2226048620,'EGG',77]]){
  const s=state({product}),sum=resourceSummary(data,s);close(sum.value,value);assert.equal(sum.unit,unit,product);assert.equal(sum.count,count,product);
 }
});
test('all-crop map and shares include only provincial tonnes; preserve old-six subgroup totals',()=>{
 const legacy=state({group:'legacy'});assert.equal(resourceSummary(data,legacy).value,165823494);
 const scoped=state({group:'legacy',province:'PROV_65'});assert.equal(resourceSummary(data,scoped).value,2486873);
 close(productionBreakdown(data,scoped).reduce((n,r)=>n+(r.share||0),0),100);
 const all=state({});const breakdown=productionBreakdown(data,all);
 assert.equal(breakdown.find(p=>p.product_id==='PRD_MATURE_COCONUT').share,null);
 close(resourceSummary(data,all).value,breakdown.filter(r=>r.unit==='TONNE'&&!r.countryOnly).reduce((n,r)=>n+(r.value||0),0));
 assert.equal(provinceMetricRows(data,all).length,77);
});
test('national-only lime is never assigned to a province or treated as zero',()=>{
 const national=state({product:'PRD_LIME'});assert.equal(selectedSeries(data,national).geography_level,'national');
 assert.ok(resourceSummary(data,national).value>0);assert.equal(provinceMetricRows(data,national).length,0);
 const province=state({...national,province:'PROV_30'});assert.equal(resourceSummary(data,province).value,null);
});
test('same source/year is applied countrywide, no filling a province from another source or year',()=>{
 const durian=state({product:'PRD_DURIAN',year:'2564'}),rows=resourceRows(data,durian);
 assert.equal(new Set(rows.map(r=>r.source_id)).size,1);assert.ok(rows.every(r=>r.year===2564));assert.equal(new Set(rows.map(r=>r.province_id)).size,rows.length);
 const garlic=state({product:'PRD_GARLIC'});assert.ok(resourceSeries(data,garlic.product).every(s=>!s.years.includes(2565)));
 const dld=state({product:'PRD_LV_DAIRY_CATTLE'});assert.equal(selectedSeries(data,dld).source_id,'SRC_DLD_BOOK_2569');
 const oae=state({...dld,series:'SER_OAE_DAIRY_CATTLE_ANIMAL_COUNT',year:'2567'});assert.equal(selectedSeries(data,oae).source_id,'SRC_OAE_MILK_PROV');assert.ok(resourceRows(data,oae).every(r=>r.year===2567));
});
test('fish sum of culture methods has no farm/area double counts; selecting a method exposes its own measures',()=>{
 const nil=state({product:'PRD_AQ_0021'});assert.equal(selectedSeries(data,nil).culture_method_id,'all');assert.ok(!selectedSeries(data,nil).metrics.AQ_FARM_COUNT);
 const ponds=resourceSeries(data,nil.product).find(s=>s.culture_method_id==='MTH_AQUACULTURE_03');
 const pondState=state({...nil,series:ponds.series_id,metric:'AQ_FARM_COUNT'});assert.equal(metricDescriptor(data,pondState).unit,'FARM');assert.ok(resourceSummary(data,pondState).value>0);
 assert.ok(resourceSummary(data,pondState).value<27595800);
});
test('livestock all shows coverage, not total animals + eggs + milk; rate is never summed',()=>{
 const s=state({category:'livestock'});assert.equal(s.metric,'AVAILABLE_PRODUCTS');assert.equal(resourceSummary(data,s).unit,'PRODUCT');assert.equal(resourceSummary(data,s).value,13);
 const rows=provinceMetricRows(data,s);assert.ok(rows.every(r=>r.metrics.AVAILABLE_PRODUCTS.value<=13));
 const daily=state({product:'PRD_LV_DAIRY_CATTLE',series:'SER_OAE_DAIRY_CATTLE_MILK_YIELD_DAILY',year:'2567',metric:'MILK_YIELD_DAILY'});
 assert.equal(metricDescriptor(data,daily).aggregation,'none');
 const sum=resourceRows(data,daily).reduce((n,r)=>n+(r.metrics.MILK_YIELD_DAILY?.value||0),0);assert.notEqual(resourceSummary(data,daily).value,sum);
 assert.equal(unitLabel(data,'EGG'),'ฟอง');
});
test('missing livestock PDF symbols remain null, reported zeros remain zero and are not filled',()=>{
 const nullRow=snapshot.rows.find(r=>Object.values(r.metrics).some(v=>v===null));assert.ok(nullRow);
 const metric=Object.keys(nullRow.metrics).find(m=>nullRow.metrics[m]===null);
 assert.equal(resourceSummary(data,state({product:nullRow.product_id,series:nullRow.series_id,year:String(nullRow.year),province:nullRow.province_id,metric})).value,null);
 const zero=snapshot.rows.find(r=>Object.entries(r.metrics).some(([m,v])=>v===0&&r.evidence[m].status==='reported'));assert.ok(zero);
 const zm=Object.keys(zero.metrics).find(m=>zero.metrics[m]===0&&zero.evidence[m].status==='reported');
 assert.equal(resourceSummary(data,state({product:zero.product_id,series:zero.series_id,year:String(zero.year),province:zero.province_id,metric:zm})).value,0);
});
test('resource filters do not invent factory materials or research mappings',()=>{
 const pig=state({product:'PRD_LV_PIG',province:'PROV_30'});assert.equal(researchRows(data,pig).length,0);
 assert.equal(researchRows(data,state({category:'fisheries'})).length,0);
 assert.deepEqual(factoryRows(data,pig).map(f=>f.id),factoryRows(data,{...pig,product:'PRD_CASSAVA'}).map(f=>f.id));
 assert.deepEqual(state({category:'bad',product:'missing',series:'missing',year:'1'}).product,'all');
});
test('small herb tonnages retain distinct readable legend thresholds',()=>{
 const step=legendStep(.0002);assert.notEqual(legendNumber(step),'0');assert.notEqual(legendNumber(step),legendNumber(step*2));
 assert.equal(colorFor(step,.0002),COLORS[1]);assert.equal(legendNumber(1500000),'1.5 ล้าน');
});
