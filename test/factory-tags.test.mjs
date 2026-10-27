import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {attachFactoryTags,matchesFactoryTags} from '../public/factory-tags.js';
import {factoryRows,validState,agriculturalRows,researchRows,mapEstateSelection} from '../public/explorer-model.js';
import {validateFactoryTags} from '../scripts/validate-factory-tags.mjs';
const original=JSON.parse(await readFile(new URL('../public/data/explorer-data.json',import.meta.url),'utf8'));
const snapshot=JSON.parse(await readFile(new URL('../public/data/factory-tags.json',import.meta.url),'utf8'));
const data=attachFactoryTags(structuredClone(original),snapshot),base=validState(data);
test('live Sheet tag totals reconcile without counting several roles twice',()=>{
 const summary=validateFactoryTags(snapshot,original);
 assert.equal(summary.tagged,3061);assert.equal(summary.multiple,520);assert.equal(summary.role_links,4036);
 const counts={TAG_CHEM:828,TAG_FOOD:440,TAG_PLASTIC:1023,TAG_ENERGY:894,TAG_COSMETIC:123,TAG_PHARMA:65,TAG_FEED:44,TAG_RUBBER:322};
 for(const [tag,count] of Object.entries(counts))assert.equal(factoryRows(data,{...base,tags:[tag]}).length,count,tag);
 assert.equal(factoryRows(data,{...base,tagScope:'untagged'}).length,5543);
 const allTags={...base,tags:data.factoryTags.map(t=>t.tag_id),tagMode:'any'};
 const tagged=factoryRows(data,allTags);
 assert.equal(tagged.length,3061);assert(tagged.every(f=>f.tags.length>0));
 assert.equal(new Set(tagged.map(f=>f.id)).size,3061);
 assert.equal(factoryRows(data,{...allTags,tags:[]}).length,8604);
 assert.equal(factoryRows(data,base).length,8604);
});
test('OR is a union and AND intersects on the same factory, never duplicate rows',()=>{
 const a=factoryRows(data,{...base,tags:['TAG_CHEM']}),b=factoryRows(data,{...base,tags:['TAG_PLASTIC']});
 const union=factoryRows(data,{...base,tags:['TAG_CHEM','TAG_PLASTIC'],tagMode:'any'});
 const intersection=factoryRows(data,{...base,tags:['TAG_CHEM','TAG_PLASTIC'],tagMode:'all'});
 assert.equal(union.length,new Set([...a,...b].map(f=>f.id)).size);
 assert.equal(intersection.length,a.filter(f=>b.some(x=>x.id===f.id)).length);
 assert(intersection.length>0&&intersection.length<union.length);
 assert(matchesFactoryTags({tags:[{tag_id:'TAG_PLASTIC'},{tag_id:'TAG_COSMETIC'}]},{tags:['TAG_PLASTIC','TAG_COSMETIC'],tagMode:'all'}));
});
test('tags intersect geography, estate drilldown and literal search',()=>{
 const f=data.factories.find(f=>f.tags.length>1&&f.province_id&&f.district_id);
 const state={...base,province:f.province_id,district:f.district_id,estate:f.estate_id,tags:f.tags.map(t=>t.tag_id),tagMode:'all',query:f.name};
 const rows=factoryRows(data,state);assert(rows.some(x=>x.id===f.id));assert(rows.every(x=>x.province_id===f.province_id&&x.estate_id===f.estate_id&&x.district_id===f.district_id));
 const next={...state,...mapEstateSelection(data,data.estates.find(e=>e.estate_id===f.estate_id).map_id)};
 assert.deepEqual(next.tags,state.tags);assert.equal(next.query,'');
 assert.equal(factoryRows(data,{...state,query:'no-such-factory-000'}).length,0);
});
test('reset/invalid filters normalize; factory tags do not imply crop or research links',()=>{
 assert.deepEqual(base.tags,[]);assert.equal(base.tagMode,'any');assert.equal(base.tagScope,'all');
 assert.deepEqual(validState(data,{tags:['BAD','TAG_FOOD','TAG_FOOD'],tagMode:'invalid'}).tags,['TAG_FOOD']);
 assert.deepEqual(validState(data,{tagScope:'untagged',tags:['TAG_FOOD']}).tags,[]);
 const selected={...base,tags:['TAG_PLASTIC','TAG_FOOD'],tagMode:'all'};
 assert.deepEqual(agriculturalRows(data,selected),agriculturalRows(data,base));assert.deepEqual(researchRows(data,selected),researchRows(data,base));
});
test('validator rejects broken joins, duplicate roles and empty evidence',()=>{
 let bad=structuredClone(snapshot);bad.factories[0].factory_id='MISSING';assert.throws(()=>validateFactoryTags(bad,original),/Unknown factory/);
 bad=structuredClone(snapshot);let t=bad.factories.find(f=>f.tags.length).tags[0];t.roles.push(t.roles[0]);assert.throws(()=>validateFactoryTags(bad,original),/Duplicate factory/);
 bad=structuredClone(snapshot);bad.factories.find(f=>f.tags.length).tags[0].roles[0].evidence='';assert.throws(()=>validateFactoryTags(bad,original),/Missing tag evidence/);
});
