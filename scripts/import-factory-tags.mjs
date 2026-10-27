import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateFactoryTags} from './validate-factory-tags.mjs';
const input=process.argv[2];if(!input)throw Error('Usage: node scripts/import-factory-tags.mjs <bounded-sheet-ranges.json>');
const bytes=await readFile(input),raw=JSON.parse(bytes),objects=name=>{const [header,...rows]=raw[name];return rows.map(row=>Object.fromEntries(header.map((h,i)=>[h,row[i]??''])));};
const tags=objects('tags').map(t=>({tag_id:t.tag_id,name:t.tag_name,inclusion:t.inclusion_scope,exclusion:t.exclusion_scope}));
const roles=objects('tag_roles').map(r=>({role_id:r.role_id,name:r.role_name,definition:r.definition}));
const factories=objects('factory_tag_assessments').map(f=>({factory_id:f.factory_id,status:f.assessment_status,review_note:f.review_note,source_row:f.source_row,tags:[],expected_tag_count:f.tag_count}));
const byId=new Map(factories.map(f=>[f.factory_id,f]));
for(const row of objects('factory_tags')){
 const f=byId.get(row.factory_id);if(!f)throw Error('Unknown factory '+row.factory_id);
 if(row.source_row!==f.source_row)throw Error('Source row mismatch');
 let t=f.tags.find(t=>t.tag_id===row.tag_id);if(!t){t={tag_id:row.tag_id,roles:[]};f.tags.push(t);}
 t.roles.push({role_id:row.role_id,evidence:row.evidence_text,status:row.assessment_status});
}
for(const f of factories){if(f.expected_tag_count!==f.tags.length)throw Error('Assessment count mismatch '+f.factory_id);delete f.expected_tag_count;}
const assessments=objects('factory_tag_assessments');
const dates=new Set(assessments.map(f=>f.assessed_on)),methods=new Set(assessments.map(f=>f.method_version));
if(dates.size!==1||methods.size!==1)throw Error('Mixed assessment runs require per-record provenance');
const [date]=dates;if(!Number.isFinite(date))throw Error('Expected unformatted Sheets date serial');
const assessed_on=new Date(Date.UTC(1899,11,30)+date*86400000).toISOString().slice(0,10);
const snapshot={schema_version:1,exported_at:new Date().toISOString(),assessed_on,source:{spreadsheet_id:'1yBnaU3q-zey4VP3XC3ni4P8JCSmTBhj_XiKZ2NG-oRI',tabs:Object.keys(raw),sha256:createHash('sha256').update(bytes).digest('hex'),method:[...methods][0]},tags,roles,factories};
const data=JSON.parse(await readFile(new URL('../public/data/explorer-data.json',import.meta.url),'utf8'));
const summary=validateFactoryTags(snapshot,data);
const destination=new URL('../public/data/factory-tags.json',import.meta.url),temporary=new URL('../public/data/factory-tags.next.json',import.meta.url);
await writeFile(temporary,JSON.stringify(snapshot));await rename(temporary,destination);console.log(summary);
