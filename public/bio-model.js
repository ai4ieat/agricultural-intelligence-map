// One selected series + year is used consistently across every province.
// Different sources, units, species totals and stock/flow measures are never summed implicitly.
export const CATEGORIES={crops:'พืช',fisheries:'ประมง',livestock:'ปศุสัตว์'};
export const CROP_GROUPS={all:'พืชทุกกลุ่ม',legacy:'พืชเดิม 6 ชนิด',fruit:'ผลไม้',herb_spice:'สมุนไพร / เครื่องเทศ',industrial_processing:'พืชอุตสาหกรรม / แปรรูป'};
const METRIC_ORDER=['PRODUCTION','PRODUCTION_FRUIT','ANIMAL_COUNT','EGG_PRODUCTION','LIVESTOCK_HOLDER_COUNT','PRODUCTION_VALUE'];
const unitNames={TONNE:'ตัน',RAI:'ไร่',KG_PER_RAI:'กก./ไร่',HEAD:'ตัว',EGG:'ฟอง',HOLDER:'ราย',FARM:'ฟาร์ม',HOUSEHOLD:'ครัวเรือน',FRUIT:'ผล',FRUIT_PER_RAI:'ผล/ไร่',THOUSAND_THB:'พันบาท',MILLION_THB:'ล้านบาท',THB_PER_KG:'บาท/กก.',KG_PER_HEAD_DAY:'กก./ตัว/วัน',PRODUCT:'รายการ'};
export const unitLabel=(data,id)=>data.bio?.units[id]||unitNames[id]||id||'';
export const productName=(data,id)=>data.products.find(p=>p.product_id===id)?.name_th||id;
const scope=(data,pid,s)=>s.province==='unknown'?false:s.province&&s.province!=='all'?pid===s.province:s.region&&s.region!=='all'?data.provinces.some(p=>p.id===pid&&p.region===s.region):true;
const wholeCountry=s=>s.province==='all'&&s.region==='all';
export function attachBioResources(data,snapshot){
 if(snapshot.schema_version!==1)throw Error('Unsupported biological resource schema');
 const legacyProducts=data.products.map(p=>({...p,category:'crops',group:'legacy'}));
 const oldSeries=legacyProducts.map(p=>{
  const rows=data.agriculture.filter(r=>r.product_id===p.product_id),metrics={};
  rows.forEach(r=>Object.entries(r.metrics).forEach(([id,m])=>metrics[id]={name:m.name,unit:m.unit,aggregation:id.startsWith('YIELD_')?'none':'sum'}));
  return {series_id:'LEGACY_'+p.product_id,product_id:p.product_id,source_id:rows[0].source_id,name:'ชุดเดิม · '+p.name_th,geography_level:'province',priority:0,years:[...new Set(rows.map(r=>r.year))],metrics,note:'ข้อมูลพืช 6 ชนิดจาก snapshot เดิม อ่านปีเพาะปลูกตามชนิดพืช'};
 });
 const oldRows=data.agriculture.map(r=>({...r,series_id:'LEGACY_'+r.product_id,metrics:Object.fromEntries(Object.entries(r.metrics).map(([k,m])=>[k,m.value])),evidence:{}}));
 data.products=[...legacyProducts,...snapshot.products];
 data.sources=[...new Map([...data.sources,...snapshot.sources].map(s=>[s.source_id,s])).values()];
 data.bio={...snapshot,series:[...oldSeries,...snapshot.series],rows:[...oldRows,...snapshot.rows],units:{...unitNames,...snapshot.units}};
 const b=data.bio;b.byProduct=new Map();b.bySeries=new Map();b.rowsBySeries=new Map();b.nationalBySeries=new Map();
 for(const s of b.series){b.bySeries.set(s.series_id,s);if(!b.byProduct.has(s.product_id))b.byProduct.set(s.product_id,[]);b.byProduct.get(s.product_id).push(s);}
 for(const [items,index] of [[b.rows,b.rowsBySeries],[b.national_rows,b.nationalBySeries]])for(const r of items){if(!index.has(r.series_id))index.set(r.series_id,[]);index.get(r.series_id).push(r);}
 return data;
}
export function resourceProducts(data,state){return data.products.filter(p=>p.category===(state.category||'crops')&&(state.category!=='crops'||!state.group||state.group==='all'||p.group===state.group));}
export function resourceSeries(data,product,year='latest'){
 return [...(data.bio.byProduct.get(product)||[])].filter(s=>year==='latest'||s.years.includes(Number(year)))
 .sort((a,b)=>a.priority-b.priority||Math.max(...b.years)-Math.max(...a.years)||a.series_id.localeCompare(b.series_id));
}
export const selectedSeries=(data,state)=>data.bio.bySeries.get(state.series);
export function defaultSelection(data,product,year='latest'){
 const s=resourceSeries(data,product,year)[0];if(!s)return null;
 const metrics=Object.keys(s.metrics).sort((a,b)=>(METRIC_ORDER.includes(a)?METRIC_ORDER.indexOf(a):100)-(METRIC_ORDER.includes(b)?METRIC_ORDER.indexOf(b):100));
 return {product,series:s.series_id,year:String(year==='latest'?Math.max(...s.years):year),metric:metrics[0]};
}
export function normalizeBioState(data,state){
 const s={category:'crops',group:'all',series:'auto',year:'latest',...state};
 if(!CATEGORIES[s.category])s.category='crops';
 if(!CROP_GROUPS[s.group]||s.category!=='crops')s.group='all';
 const p=data.products.find(p=>p.product_id===s.product);
 if(s.product!=='all'&&!p)s.product='all';
 if(p){s.category=p.category;if(s.category!=='crops'||s.group!=='all'&&s.group!==p.group)s.group='all';}
 if(s.product==='all'){
  const years=resourceYears(data,s);if(s.year!=='latest'&&!years.includes(Number(s.year)))s.year='latest';
  s.series='auto';s.metric=s.category==='crops'?'PRODUCTION':'AVAILABLE_PRODUCTS';return s;
 }
 let series=selectedSeries(data,s);
 if(!series||series.product_id!==s.product){const choice=defaultSelection(data,s.product,s.year)||defaultSelection(data,s.product);Object.assign(s,choice);series=selectedSeries(data,s);}
 if(s.year==='latest'||!series.years.includes(Number(s.year)))s.year=String(Math.max(...series.years));
 if(!series.metrics[s.metric])s.metric=defaultSelectionForSeries(series);
 return s;
}
function defaultSelectionForSeries(s){return METRIC_ORDER.find(id=>s.metrics[id])||Object.keys(s.metrics)[0];}
export function resourceYears(data,state){
 const list=state.product==='all'?resourceProducts(data,state).flatMap(p=>resourceSeries(data,p.product_id)):selectedSeries(data,state)?[selectedSeries(data,state)]:resourceSeries(data,state.product);
 return [...new Set(list.flatMap(s=>s.years))].sort((a,b)=>b-a);
}
export function metricDescriptor(data,state){
 if(state.product==='all')return state.category==='crops'?{name:'ผลผลิตพืชหน่วยตัน',unit:'TONNE',aggregation:'sum'}:{name:'รายการที่มีข้อมูล',unit:'PRODUCT',aggregation:'coverage'};
 return selectedSeries(data,state)?.metrics[state.metric]||{name:'ข้อมูล',unit:'',aggregation:'none'};
}
function hydrate(data,r){const s=data.bio.bySeries.get(r.series_id);return {...r,metrics:Object.fromEntries(Object.entries(r.metrics).map(([id,value])=>[id,{...s.metrics[id],value}]))};}
export function resourceRows(data,state,{national=false,ignoreProvince=false}={}){
 if(state.product==='all')return resourceProducts(data,state).flatMap(p=>{
  const choice=defaultSelection(data,p.product_id,state.year);return choice?resourceRows(data,{...state,...choice},{national,ignoreProvince}):[];
 });
 const index=national?data.bio.nationalBySeries:data.bio.rowsBySeries;
 return (index.get(state.series)||[]).filter(r=>r.year===Number(state.year)&&(national?wholeCountry(state):scope(data,r.province_id,ignoreProvince?{...state,province:'all'}:state))).map(r=>hydrate(data,r));
}
export function resourceProvinceRows(data,state){
 if(state.product!=='all')return resourceRows(data,state);
 const groups=new Map();
 for(const p of resourceProducts(data,state)){
  const choice=defaultSelection(data,p.product_id,state.year);if(!choice)continue;
  for(const r of resourceRows(data,{...state,...choice})){
   const m=r.metrics[state.category==='crops'?'PRODUCTION':choice.metric];
   if(m?.value==null||(state.category==='crops'&&m.unit!=='TONNE'))continue;
   const prior=groups.get(r.province_id)||0;groups.set(r.province_id,prior+(state.category==='crops'?m.value:1));
  }
 }
 const desc=metricDescriptor(data,state);
 return [...groups].map(([province_id,value])=>({province_id,metrics:{[state.metric]:{...desc,value}}}));
}
export function resourceSummary(data,state){
 const desc=metricDescriptor(data,state),rows=resourceProvinceRows(data,state),known=rows.filter(r=>r.metrics[state.metric]?.value!=null);
 const national=state.product==='all'?[]:resourceRows(data,state,{national:true});
 const countryOnly=selectedSeries(data,state)?.geography_level==='national';
 const country=national.find(r=>r.metrics[state.metric]?.value!=null);
 let value=null,label='ผลรวมจังหวัดที่มีข้อมูล';
 if(countryOnly){value=country?.metrics[state.metric]?.value??null;label='ข้อมูลระดับประเทศเท่านั้น';}
 else if(desc.aggregation==='coverage'){value=resourceBreakdown(data,state).filter(r=>r.value!=null&&r.records.some(x=>x.province_id!=='TH')).length;label='รายการในพื้นที่ที่มีข้อมูล';}
 else if(desc.aggregation==='none'){
  if(!['all','unknown'].includes(state.province)&&known.length===1)value=known[0].metrics[state.metric].value;
  else if(wholeCountry(state)&&country){value=country.metrics[state.metric].value;label='ค่าประเทศตามต้นทาง';}
  else label='เลือกจังหวัดเพื่อดูค่า ไม่รวมอัตราหรือราคา';
 }else if(known.length)value=known.reduce((sum,r)=>sum+r.metrics[state.metric].value,0);
 return {value,count:new Set(known.map(r=>r.province_id)).size,unit:desc.unit,label,countryOnly,records:countryOnly?national:rows};
}
export function resourceBreakdown(data,state){
 const entries=resourceProducts(data,state).map(p=>{
  const choice=defaultSelection(data,p.product_id,state.year);
  if(!choice)return {product_id:p.product_id,name:p.name_th,value:null,unit:'',share:null,periods:[],records:[],note:'ไม่มีข้อมูลปีที่เลือก'};
  const s={...state,...choice},summary=resourceSummary(data,s),r=summary.records,series=selectedSeries(data,s);
  return {product_id:p.product_id,name:p.name_th,value:summary.value,unit:summary.unit,share:null,periods:[...new Set(r.map(r=>r.crop_year))],records:r,series_id:s.series,metric:s.metric,year:s.year,countryOnly:series.geography_level==='national',note:series.geography_level==='national'?'เฉพาะระดับประเทศ':''};
 });
 if(state.category==='crops'){
  const total=entries.filter(r=>r.unit==='TONNE'&&!r.countryOnly).reduce((n,r)=>n+(r.value??0),0);
  entries.forEach(r=>{if(r.unit==='TONNE'&&!r.countryOnly&&r.value!=null&&total>0)r.share=r.value/total*100;});
  return entries.sort((a,b)=>(a.unit==='TONNE'&&!a.countryOnly?0:1)-(b.unit==='TONNE'&&!b.countryOnly?0:1)||(b.value??-1)-(a.value??-1));
 }
 return entries.sort((a,b)=>Number(b.value!=null)-Number(a.value!=null)||a.name.localeCompare(b.name,'th'));
}
export function resourcePeriod(data,state){
 if(state.product==='all')return state.year==='latest'?'ปีล่าสุดของแต่ละรายการ':'ปี '+state.year;
 const s=selectedSeries(data,state),r=(data.bio.rowsBySeries.get(s.series_id)||data.bio.nationalBySeries.get(s.series_id)||[]).filter(r=>r.year===Number(state.year));
 const periods=[...new Set(r.map(r=>r.crop_year))];return 'ปี '+(periods.join(', ')||state.year);
}
