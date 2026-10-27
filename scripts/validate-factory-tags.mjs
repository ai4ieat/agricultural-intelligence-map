import assert from 'node:assert/strict';
export function validateFactoryTags(snapshot,data){
 assert.equal(snapshot.schema_version,1,'Factory tags schema');
 assert(Number.isFinite(Date.parse(snapshot.exported_at)),'Factory tags date');
 const ids=(rows,key)=>{const set=new Set(rows.map(r=>r[key]));assert.equal(set.size,rows.length,'Duplicate '+key);return set;};
 const tags=ids(snapshot.tags,'tag_id'),roles=ids(snapshot.roles,'role_id'),factories=ids(snapshot.factories,'factory_id');
 assert.equal(tags.size,8,'Expected 8 industry tags');assert.equal(factories.size,data.factories.length,'Factory assessment coverage');
 const originals=new Map(data.factories.map(f=>[f.id,f]));
 const statuses=new Set(['AI_ASSIGNED','HUMAN_VERIFIED','NEEDS_REVIEW','INSUFFICIENT_TEXT','NO_TAG_EVIDENCE']);
 const counts=Object.fromEntries([...tags].map(id=>[id,0]));let tagged=0,multiple=0,links=0;
 for(const f of snapshot.factories){
  const source=originals.get(f.factory_id);assert(source,'Unknown factory ID');assert.equal(f.source_row,source.source_row,'Factory source row mismatch');assert(statuses.has(f.status),'Unknown assessment status');
  assert.equal(new Set(f.tags.map(t=>t.tag_id)).size,f.tags.length,'Duplicate factory tag');
  if(f.tags.length)tagged++;if(f.tags.length>1)multiple++;
  for(const t of f.tags){assert(tags.has(t.tag_id),'Unknown tag ID');assert(t.roles.length,'Missing role');assert.equal(new Set(t.roles.map(r=>r.role_id)).size,t.roles.length,'Duplicate factory/tag/role');counts[t.tag_id]++;
   for(const r of t.roles){links++;assert(roles.has(r.role_id),'Unknown role ID');assert(['AI_ASSIGNED','HUMAN_VERIFIED','NEEDS_REVIEW'].includes(r.status),'Invalid link status');assert(typeof r.evidence==='string'&&r.evidence.trim(),'Missing tag evidence');}
  }
 }
 return {factories:factories.size,tagged,multiple,role_links:links,counts};
}
