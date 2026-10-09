'use strict';
(() => {
  const el=id=>document.getElementById(id);
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>v===null?'ไม่มีข้อมูล':new Intl.NumberFormat('th-TH').format(v);
  const date=v=>new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
  const units={'rai':'ไร่','tonne':'ตัน','THB':'บาท','tonne/day':'ตัน/วัน','tonne/year':'ตัน/ปี','litre/day':'ลิตร/วัน','unit/day':'หน่วย/วัน'};
  const metric=m=>m.value===null?'ไม่มีข้อมูล':number(m.value)+' '+units[m.unit];
  let popup, map, agriculture, factories;
  function show(coordinates,html){
    popup?.remove();
    popup=new maplibregl.Popup({maxWidth:'340px',focusAfterOpen:true}).setLngLat(coordinates).setHTML('<div class="ag-detail">'+html+'</div>').addTo(map);
  }
  function source(r){return `<p class="ag-source">แหล่งที่มา: ${escape(r.source.name)}${r.source.url?` <a href="${escape(r.source.url)}" target="_blank" rel="noopener noreferrer">เปิดแหล่งข้อมูล ↗</a>`:''}<br>อัปเดต: ${escape(date(r.updated_at))} (เวลาไทย)</p>`;}
  const badge=data=>data.is_sample?'<span class="ag-badge">ข้อมูลสมมติ · ใช้ทดสอบเท่านั้น</span>':'';
  function updateVisibility(){
    const ag=el('agriculture-toggle').checked,fac=el('factories-toggle').checked;
    for(const id of ['agriculture-fill','agriculture-outline'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',ag?'visible':'none');
    if(map.getLayer('factory-points'))map.setLayoutProperty('factory-points','visibility',fac?'visible':'none');
    el('sample-banner').hidden=!(ag&&agriculture?.is_sample||fac&&factories?.is_sample);
    popup?.remove();
  }
  window.addEventListener('aim-map-ready',async event=>{
    const {admin,estates}=event.detail;map=event.detail.map;
    const provinces=new Map(admin.provinces.features.map(f=>[f.properties.code,f.properties.name]));
    const estateIds=new Set(estates.features.map(f=>f.id));
    async function load(kind){
      const response=await fetch('data/'+kind+'.json',{cache:'no-cache'});
      if(!response.ok)throw Error('HTTP '+response.status);
      return AIMData.validate(await response.json(),kind,provinces,estateIds);
    }
    const results=await Promise.allSettled([load('agriculture'),load('factories')]);
    if(results[0].status==='fulfilled'){
      agriculture=results[0].value;
      const codes=new Set(agriculture.records.map(r=>r.province_code));
      map.addSource('agriculture',{type:'geojson',data:{type:'FeatureCollection',features:admin.provinces.features.filter(f=>codes.has(f.properties.code))}});
      // Presence only: no cross-crop total or misleading quantity colour scale in this scaffold.
      map.addLayer({id:'agriculture-fill',type:'fill',source:'agriculture',layout:{visibility:'none'},paint:{'fill-color':'#3c8964','fill-opacity':.27}},'area-fill');
      map.addLayer({id:'agriculture-outline',type:'line',source:'agriculture',layout:{visibility:'none'},paint:{'line-color':'#317652','line-width':2}},'area-fill');
      map.on('click','agriculture-fill',e=>{
        const top=map.queryRenderedFeatures(e.point,{layers:['estate-dots','clusters','area-fill',...(map.getLayer('factory-points')?['factory-points']:[])]});if(top.length)return;
        const code=e.features[0].properties.code;
        const rows=AIMData.filterRecords(agriculture.records,{provinceCode:code});
        show(e.lngLat,badge(agriculture)+`<h2>${escape(provinces.get(code))}</h2><p>สีเขียว = มีรายการข้อมูล ไม่ได้เปรียบเทียบปริมาณ</p>`+rows.map(r=>`<h3>${escape(r.commodity)} · ${r.reference_year}</h3><dl><dt>พื้นที่เพาะปลูก</dt><dd>${metric(r.cultivated_area)}</dd><dt>ผลผลิต</dt><dd>${metric(r.production)}</dd><dt>ฤดูกาล</dt><dd>${escape(r.season.name)}${r.season.start_month&&r.season.end_month?` · เดือน ${r.season.start_month}–${r.season.end_month}`:''}</dd><dt>มูลค่า</dt><dd>${metric(r.economic_value)}</dd></dl>${r.economic_value.basis?`<p>${escape(r.economic_value.basis)}</p>`:''}${source(r)}`).join(''));
      });
      el('agriculture-toggle').disabled=false;
    }
    if(results[1].status==='fulfilled'){
      factories=results[1].value;
      map.addSource('factories',{type:'geojson',data:{type:'FeatureCollection',features:factories.records.map(r=>({type:'Feature',geometry:{type:'Point',coordinates:r.coordinates},properties:{id:r.id}}))}});
      map.addLayer({id:'factory-points',type:'circle',source:'factories',layout:{visibility:'none'},paint:{'circle-radius':8,'circle-color':'#dd863c','circle-stroke-color':'#fff','circle-stroke-width':2}});
      map.on('click','factory-points',e=>{
        const r=factories.records.find(r=>r.id===e.features[0].properties.id);
        const estate=estates.features.find(f=>f.id===r.estate_id);
        show(r.coordinates,badge(factories)+`<h2>${escape(r.name)}</h2><p>${escape(r.district)} · ${escape(r.province)}</p><dl><dt>ประเภทธุรกิจ</dt><dd>${escape(r.business_type)}</dd><dt>วัตถุดิบ</dt><dd>${escape(r.agricultural_inputs.join(', ')||'ไม่มีข้อมูล')}</dd><dt>สินค้า</dt><dd>${escape(r.products.join(', ')||'ไม่มีข้อมูล')}</dd><dt>กำลังผลิต</dt><dd>${metric(r.capacity)}</dd><dt>ฐานกำลังผลิต</dt><dd>${escape(r.capacity.basis||'ไม่มีข้อมูล')}</dd><dt>นิคมที่ตั้ง</dt><dd>${escape(estate?.properties.name||'ไม่ได้ระบุ')}</dd><dt>พิกัด (ลองจิจูด, ละติจูด)</dt><dd>${r.coordinates.join(', ')}</dd></dl>${source(r)}`);
      });
      el('factories-toggle').disabled=false;
    }
    ['agriculture-toggle','factories-toggle'].forEach(id=>el(id).addEventListener('change',updateVisibility));
    for(const id of ['agriculture-fill','factory-points'])if(map.getLayer(id)){
      map.on('mouseenter',id,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',id,()=>map.getCanvas().style.cursor='');
    }
    const errors=results.map((r,i)=>r.status==='rejected'?(i===0?'เกษตร':'โรงงาน'):null).filter(Boolean);
    const anySample=agriculture?.is_sample||factories?.is_sample;
    document.querySelector('.sample-note').textContent=anySample?'ชั้นข้อมูลทดสอบ · ตัวเลขและโรงงานสมมติ':'ชั้นข้อมูลเกษตรและผู้ประกอบการ';
    for(const [id,data,title] of [['agriculture-toggle',agriculture,'เกษตรจังหวัด'],['factories-toggle',factories,'โรงงาน']]){
      const label=el(id).closest('label').querySelector('span');
      label.lastChild.textContent=title+(data?.is_sample?' (ตัวอย่าง)':'');
    }
    el('sample-status').textContent=errors.length?'โหลดข้อมูล '+errors.join(' / ')+' ไม่สำเร็จ · ลองรีเฟรชหน้าเว็บ':`${anySample?'พร้อมทดสอบ':'พร้อมใช้งาน'}: เกษตร ${agriculture.records.length} รายการ · โรงงาน ${factories.records.length} จุด · สีเขียวระบุจังหวัดที่มีข้อมูล`;
    results.filter(r=>r.status==='rejected').forEach(r=>console.error(r.reason));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')popup?.remove();});
  });
})();
