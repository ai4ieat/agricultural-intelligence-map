import {normalizeBioState,resourceRows,resourceProvinceRows,resourceBreakdown,resourceProducts} from './bio-model.js';
import {matchesFactoryTags} from './factory-tags.js';
export const REGION_NAMES={north:'เหนือ',northeast:'อีสาน',central:'กลาง',east:'ตะวันออก',west:'ตะวันตก',south:'ใต้'};
export const PRODUCT_SHORT={PRD_RICE:'ข้าว',PRD_SUGARCANE:'อ้อย',PRD_NATURAL_RUBBER:'ยางพารา',PRD_CASSAVA:'มันสำปะหลัง',PRD_FEED_MAIZE:'ข้าวโพด',PRD_OIL_PALM:'ปาล์มน้ำมัน'};
export const number=(n,digits=0)=>n==null?'—':new Intl.NumberFormat('th-TH',{maximumFractionDigits:digits}).format(n);
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeURL(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function inScope(pid,state,data){
 if(state.province==='unknown')return !pid;
 if(state.province&&state.province!=='all')return pid===state.province;
 if(state.region&&state.region!=='all')return data.provinces.some(p=>p.id===pid&&p.region===state.region);
 return true;
}
export function agriculturalRows(data,state,{ignoreProvince=false}={}){if(data.bio)return resourceRows(data,state,{ignoreProvince});const scope=ignoreProvince?{...state,province:'all'}:state;return data.agriculture.filter(r=>(state.product==='all'||r.product_id===state.product)&&inScope(r.province_id,scope,data));}
export function metricSummary(rows,metric){const usable=rows.filter(r=>r.metrics[metric]?.value!=null);const units=new Set(usable.map(r=>r.metrics[metric].unit));if(units.size>1)throw Error('Cannot aggregate mixed units');if(metric.startsWith('YIELD_'))throw Error('Yield must not be summed');return {value:usable.length?usable.reduce((n,r)=>n+r.metrics[metric].value,0):null,count:usable.length,unit:usable[0]?.metrics[metric].unit||null};}
export function registryEstateIds(data,selection){
 if(!selection||selection==='all')return null;
 return selection.startsWith('map:')?data.estates.filter(e=>e.map_id===selection.slice(4)).map(e=>e.estate_id):[selection];
}
export function mapEstateSelection(data,mapId){
 const ids=registryEstateIds(data,'map:'+mapId);
 // Explicit estate selection replaces stale geography/search, keeping crop and industry.
 return {estate:ids.length===1?ids[0]:'map:'+mapId,province:'all',region:'all',district:'all',query:''};
}
export function factoryRows(data,state){const estateIds=registryEstateIds(data,state.estate);const q=(state.query||'').trim().toLocaleLowerCase('th');const estates=new Map(data.estates.map(e=>[e.estate_id,e.estate_name]));return data.factories.filter(f=>inScope(f.province_id,state,data)&&matchesFactoryTags(f,state)&&(!state.industry||state.industry==='all'||f.industry_id===state.industry)&&(!state.district||state.district==='all'||f.district_id===state.district)&&(estateIds===null||estateIds.includes(f.estate_id))&&(!q||[f.name,f.name_en,f.registration,f.activity,estates.get(f.estate_id)].some(t=>String(t||'').toLocaleLowerCase('th').includes(q))));}
export function researchRows(data,state){const okay=x=>x.review_status!=='rejected'&&(!state.acceptedOnly||x.review_status==='accepted');return data.research.filter(r=>(!data.bio||state.researchAll||state.product!=='all'||!state.category||state.category==='crops'||r.products.some(p=>resourceProducts(data,state).some(x=>x.product_id===p.product_id)))&&okay(r)&&(state.researchAll||(state.product==='all'||r.products.some(p=>p.product_id===state.product&&okay(p)))&&(state.industry==='all'||r.industries.some(i=>i.industry_id===state.industry&&okay(i)))));}
export function rankRows(data,state){return provinceMetricRows(data,{...state,province:'all'}).filter(r=>r.metrics[state.metric]?.value!=null).sort((a,b)=>b.metrics[state.metric].value-a.metrics[state.metric].value);}
export function validState(data,input={}){const fallback={product:'all',industry:'all',province:'all',region:'all',metric:'PRODUCTION',district:'all',estate:'all',query:'',acceptedOnly:false,tags:[],tagMode:'any',tagScope:'all'};const s={...fallback,...input};s.tags=[...new Set((Array.isArray(s.tags)?s.tags:[]).filter(id=>(data.factoryTags||[]).some(t=>t.tag_id===id)))];s.tagMode=s.tagMode==='all'?'all':'any';s.tagScope=s.tagScope==='untagged'?'untagged':'all';if(s.tagScope==='untagged')s.tags=[];if(s.product!=='all'&&!data.products.some(p=>p.product_id===s.product))s.product=fallback.product;if(s.industry!=='all'&&!data.industries.some(p=>p.industry_id===s.industry))s.industry='all';if(!['all','unknown'].includes(s.province)&&!data.provinces.some(p=>p.id===s.province))s.province='all';if(s.region!=='all'&&!REGION_NAMES[s.region])s.region='all';if(s.province!=='all'&&data.provinces.find(p=>p.id===s.province)?.region!==s.region)s.region='all';if(data.bio)return normalizeBioState(data,s);if(s.product==='all'||!data.agriculture.some(r=>r.product_id===s.product&&r.metrics[s.metric])||s.metric.startsWith('YIELD_'))s.metric='PRODUCTION';return s;}

// In all-crops mode, map/count/ranking use one aggregate per province.
export function provinceMetricRows(data,state){
 if(data.bio)return resourceProvinceRows(data,state);
 const rows=agriculturalRows(data,state);
 if(state.product!=='all')return rows;
 const groups=new Map();
 for(const row of rows){if(!groups.has(row.province_id))groups.set(row.province_id,[]);groups.get(row.province_id).push(row);}
 return [...groups].map(([province_id,items])=>({province_id,metrics:{PRODUCTION:metricSummary(items,'PRODUCTION')}}));
}
export function productionBreakdown(data,state){
 if(data.bio)return resourceBreakdown(data,state);
 const rows=agriculturalRows(data,{...state,product:'all'});
 const total=metricSummary(rows,'PRODUCTION').value;
 return data.products.map(p=>{
  const records=rows.filter(r=>r.product_id===p.product_id);
  const summary=metricSummary(records,'PRODUCTION');
  return {product_id:p.product_id,name:PRODUCT_SHORT[p.product_id]||p.name_th,value:summary.value,
   share:summary.value!=null&&total>0?summary.value/total*100:null,
   periods:[...new Set(records.map(r=>r.crop_year))],records};
 }).sort((a,b)=>(b.value??-1)-(a.value??-1));
}
