'use strict';
// Shared by the browser and the pre-publish validator; no network dependency.
(function(root){
  const fail = message => {throw Error(message);};
  const text = (v,key) => {if(typeof v!=='string'||!v.trim())fail(key+' must be a nonempty string');};
  const nullableText = (v,key) => {if(v!==null)text(v,key);};
  const timestamp = v => {if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))fail('updated_at requires ISO timestamp with timezone');};
  const measure = (m,unit,key) => {if(!m||m.unit!==unit||!(m.value===null||(typeof m.value==='number'&&Number.isFinite(m.value)&&m.value>=0)))fail(key+' has an invalid value or unit');};
  function validate(data,kind,provinces,estateIds=new Set()) {
    if(data?.schema_version!==1||data.dataset!==kind||typeof data.is_sample!=='boolean'||!Array.isArray(data.records))fail('Invalid dataset envelope: '+kind);
    timestamp(data.updated_at);
    const ids=new Set();
    for(const r of data.records){
      text(r.id,'id');if(ids.has(r.id))fail('Duplicate id: '+r.id);ids.add(r.id);
      if(typeof r.province_code!=='string'||provinces.get(r.province_code)!==r.province)fail('Unknown or mismatched province: '+r.id);
      text(r.source?.name,'source.name');nullableText(r.source?.url,'source.url');
      if(r.source.url!==null&&!/^https?:\/\//.test(r.source.url))fail('source.url must be HTTP(S)');
      timestamp(r.updated_at);
      if(kind==='agriculture'){
        text(r.commodity_code,'commodity_code');text(r.commodity,'commodity');
        if(!Number.isInteger(r.reference_year)||r.reference_year<1900||r.reference_year>2200)fail('reference_year must use CE');
        measure(r.cultivated_area,'rai','cultivated_area');measure(r.production,'tonne','production');measure(r.economic_value,'THB','economic_value');nullableText(r.economic_value.basis,'economic_value.basis');
        text(r.season?.name,'season.name');
        for(const k of ['start_month','end_month'])if(!(r.season[k]===null||(Number.isInteger(r.season[k])&&r.season[k]>=1&&r.season[k]<=12)))fail('Invalid season month');
      }else if(kind==='factories'){
        for(const k of ['name','district','business_type_code','business_type'])text(r[k],k);
        if(!Array.isArray(r.coordinates)||r.coordinates.length!==2||!r.coordinates.every(v=>typeof v==='number'&&Number.isFinite(v))||r.coordinates[0]<97||r.coordinates[0]>106||r.coordinates[1]<5||r.coordinates[1]>21)fail('Expected Thailand coordinates [longitude, latitude]: '+r.id);
        for(const k of ['agricultural_inputs','products']){if(!Array.isArray(r[k]))fail(k+' must be an array');r[k].forEach(v=>text(v,k));}
        if(!['tonne/day','tonne/year','litre/day','unit/day'].includes(r.capacity?.unit))fail('Unknown capacity unit');
        measure(r.capacity,r.capacity.unit,'capacity');nullableText(r.capacity.basis,'capacity.basis');
        if(r.estate_id!==null&&!estateIds.has(r.estate_id))fail('Unknown estate_id: '+r.estate_id);
      }else fail('Unknown dataset kind');
    }
    return data;
  }
  // Extension point for future filter controls. Never aggregate different crops or years implicitly.
  function filterRecords(records,{provinceCode,commodityCode,businessTypeCode}={}){
    return records.filter(r=>(!provinceCode||r.province_code===provinceCode)&&(!commodityCode||r.commodity_code===commodityCode)&&(!businessTypeCode||r.business_type_code===businessTypeCode));
  }
  const api={validate,filterRecords};if(typeof module!=='undefined')module.exports=api;else root.AIMData=api;
})(globalThis);
