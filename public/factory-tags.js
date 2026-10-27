export const TAG_SHORT={TAG_CHEM:'เคมีภัณฑ์',TAG_FOOD:'อาหารและเครื่องดื่ม',TAG_PLASTIC:'พลาสติก',TAG_ENERGY:'พลังงาน',TAG_COSMETIC:'เครื่องสำอาง',TAG_PHARMA:'ยาและเภสัชภัณฑ์',TAG_FEED:'อาหารสัตว์',TAG_RUBBER:'ยาง'};
export const TAG_STATUS={AI_ASSIGNED:'จัดกลุ่มโดย AI',HUMAN_VERIFIED:'ตรวจยืนยันแล้ว',NEEDS_REVIEW:'มีประเด็นรอตรวจ',INSUFFICIENT_TEXT:'ข้อมูลกิจการไม่เพียงพอ',NO_TAG_EVIDENCE:'ยังไม่พบหลักฐานสำหรับ 8 Tag'};
export function attachFactoryTags(data,snapshot){
 const byId=new Map(snapshot.factories.map(f=>[f.factory_id,f]));
 data.factoryTags=snapshot.tags;data.tagRoles=snapshot.roles;data.tagSnapshot=snapshot;
 for(const f of data.factories){const a=byId.get(f.id);if(!a)throw Error('Missing factory tag assessment: '+f.id);f.tags=a.tags;f.tagAssessment={status:a.status,note:a.review_note};}
 return data;
}
export function matchesFactoryTags(factory,state){
 const tags=factory.tags||[],selected=state.tags||[];
 if(state.tagScope==='untagged')return tags.length===0;
 if(!selected.length)return true;
 const has=id=>tags.some(t=>t.tag_id===id);
 return state.tagMode==='all'?selected.every(has):selected.some(has);
}
export function tagFilterLabel(state,tags){
 if(state.tagScope==='untagged')return 'โรงงานที่ยังไม่มี Tag';
 if(!state.tags?.length)return 'ทุกอุตสาหกรรม';
 if(state.tagMode!=='all'&&tags.length&&tags.every(t=>state.tags.includes(t.tag_id)))return 'ทุก Tag · ตรงอย่างน้อยหนึ่งกลุ่ม';
 const names=state.tags.map(id=>TAG_SHORT[id]||tags.find(t=>t.tag_id===id)?.name||id);
 return names.join(state.tagMode==='all'?' + ':' / ')+(names.length>1?(state.tagMode==='all'?' · ครบทุก Tag':' · อย่างน้อยหนึ่ง Tag'):'');
}
