'use strict';
const $=id=>document.getElementById(id);
const fc=features=>({type:'FeatureCollection',features});
const number=n=>new Intl.NumberFormat('th-TH',{maximumFractionDigits:1}).format(n);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let map,areas,estates,points,inventory,admin,selected=null,category='estate',region='all',filtered=[],ready=false;
const regionOrder=['north','northeast','central','east','west','south'];
const adminLayerIds=['province-fill','province-lines','region-lines','region-names','province-names'];

const themeWater={forge:'#4c7276',official:'#527f94'};
const originalMapPaint=new Map();
const officialProvinceColors=['match',['get','color'],
 '#426b9d','#7493ae',
 '#4c8463','#7fa08a',
 '#91608d','#a3829e',
 '#aa653c','#bd9877',
 '#9583ac'];
const officialProvinceLabelColors=['match',['get','color'],
 '#426b9d','#3d5873',
 '#4c8463','#42654f',
 '#91608d','#6b486c',
 '#aa653c','#815332',
 '#534168'];
const officialMapPaint={
 background:{'background-color':'#dddcd1'},
 park:{'fill-color':'#bdcbb3'},
 landuse_residential:{'fill-color':'#c9c6cb'},
 landcover_wood:{'fill-color':'#b9c9b1'},
 building:{'fill-color':'#b6afbd','fill-outline-color':'#eee9f1'},
 highway_motorway_subtle:{'line-color':'#8b98a4','line-opacity':.96},
 highway_motorway_casing:{'line-color':'#8e99a3'},
 highway_motorway_inner:{'line-color':['interpolate',['linear'],['zoom'],6,'#ffffff',8,'#ffffff']},
 highway_motorway_bridge_casing:{'line-color':'#8e99a3'},
 highway_motorway_bridge_inner:{'line-color':['interpolate',['linear'],['zoom'],6,'#ffffff',8,'#ffffff']},
 highway_major_subtle:{
  'line-color':['interpolate',['linear'],['zoom'],5,'#dbe2e7',8,'#ffffff',10.9,'#ffffff'],
  'line-opacity':['interpolate',['linear'],['zoom'],5,.92,9,.96,10.9,1],
  'line-width':['interpolate',['linear'],['zoom'],5,1.3,8,1.7,10.9,2.2]
 },
 highway_minor:{
  'line-color':['interpolate',['linear'],['zoom'],8,'#edf1f4',11,'#ffffff',14,'#ffffff'],
  'line-opacity':['interpolate',['linear'],['zoom'],8,.88,11,.94,14,1]
 },
 'area-fill':{'fill-opacity':['interpolate',['linear'],['zoom'],8,.18,11,.3,15,.4],'fill-color':['case',['==',['get','boundary_status'],'pending'],'#a48368',['match',['get','category'],'port','#648b90','#71518f']]},
 'area-line':{'line-width':['interpolate',['linear'],['zoom'],8,1.4,13,2.4],'line-color':['case',['==',['get','boundary_status'],'pending'],'#a48368',['match',['get','category'],'port','#648b90','#71518f']]},
 'selected-fill':{'fill-color':'#79539c'},'selected-line':{'line-color':'#4e276f'},
 clusters:{'circle-color':'#654480','circle-stroke-color':'#f9f7fc'},
 'estate-dots':{'circle-color':['case',['==',['get','boundary_status'],'pending'],'#a48368',['match',['get','category'],'port','#648b90','#71518f']]},
 'selected-point':{'circle-color':'#a48368','circle-stroke-color':'#79614a'},
 'estate-labels':{'text-color':'#4f4563'},
 'province-fill':{'fill-color':officialProvinceColors,'fill-opacity':['interpolate',['linear'],['zoom'],6.5,0,7.1,.18,9,.22,12,.15,15,.08]},'province-lines':{'line-color':'#8b759e'},
 'region-lines':{'line-color':'#655073'},'region-names':{'text-color':'#51485e'},
 'province-names':{'text-color':officialProvinceLabelColors}
};
function applyMapTheme(){
 if(!ready)return;
 const official=document.documentElement.dataset.theme==='official';
 for(const [layer,properties] of Object.entries(officialMapPaint)){
  if(!map.getLayer(layer))continue;
  for(const [property,value] of Object.entries(properties)){
   const key=layer+':'+property;
   if(!originalMapPaint.has(key))originalMapPaint.set(key,map.getPaintProperty(layer,property));
   map.setPaintProperty(layer,property,official?value:originalMapPaint.get(key));
  }
 }
 for(const [layer,property] of [['water','fill-color'],['waterway','line-color']]){
  if(map.getLayer(layer))map.setPaintProperty(layer,property,$('water').value);
 }
}
function setTheme(choice,persist=true){
 const theme=choice==='official'?'official':'forge';
 const previous=document.documentElement.dataset.theme==='official'?'official':'forge';
 themeWater[previous]=$('water').value;
 document.documentElement.dataset.theme=theme;
 $('water').value=themeWater[theme];
 document.title=theme==='official'?'Agricultural Intelligence Map':'Agricultural Intelligence Map · Forge';
 document.querySelector('.brand').setAttribute('aria-label',theme==='official'?'Agricultural Intelligence Map หน้าแรก':'Agricultural Intelligence Map หน้าแรก');
 document.querySelector('.header-label').textContent=theme==='official'?'แผนที่เกษตรและอุตสาหกรรม':'ศูนย์บัญชาการแผนที่นิคม';
 document.querySelector('.snapshot').textContent=theme==='official'?'ข้อมูลขอบเขตและพิกัดสำนักงาน':'ขอบเขตเดิม + พิกัดสำนักงาน';
 document.querySelector('.eyebrow').textContent=theme==='official'?'ระบบข้อมูลเชิงพื้นที่':'SECTOR EXPLORER';
 document.querySelector('.intro').textContent=theme==='official'?'ค้นหาและตรวจสอบข้อมูลพื้นที่บนแผนที่':'เลือกพื้นที่ แล้วดูรายละเอียดบนแผนที่';
 document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===theme)));
 if(persist){try{localStorage.setItem('aim-theme',theme);}catch{}}
 applyMapTheme();
 
}
function setupTheme(){
 document.querySelectorAll('[data-theme-choice]').forEach(button=>button.onclick=()=>setTheme(button.dataset.themeChoice));
 let stored='official';try{stored=localStorage.getItem('aim-theme')||'official';}catch{}
 setTheme(stored,false);
}
let hoverKey='',hoverRequest=0,hoverCloseTimer;
function closeEstateHover(){clearTimeout(hoverCloseTimer);hoverRequest++;hoverKey='';$('estate-hover').hidden=true;}
function scheduleHoverClose(){clearTimeout(hoverCloseTimer);hoverCloseTimer=setTimeout(closeEstateHover,240);}
function positionEstateHover(point){const panel=$('estate-hover'),stage=$('map');const width=panel.offsetWidth,height=panel.offsetHeight;const x=point.x+20+width<=stage.clientWidth-10?point.x+20:point.x-width-20;panel.style.left=Math.max(10,Math.min(x,stage.clientWidth-width-10))+'px';panel.style.top=Math.max(10,Math.min(point.y-20,stage.clientHeight-height-10))+'px';}
async function showEstateHover(features,point){
 const unique=[...new Map(features.map(f=>[f.properties.cluster_id!==undefined?'cluster:'+f.properties.cluster_id:'estate:'+f.properties.estate_id,f])).values()];
 const key=unique.map(f=>f.properties.cluster_id!==undefined?'c'+f.properties.cluster_id:'e'+f.properties.estate_id).sort().join('|');
 clearTimeout(hoverCloseTimer);if(key===hoverKey)return;hoverKey=key;const request=++hoverRequest;const panel=$('estate-hover');
 panel.innerHTML='<div class="hover-heading">กำลังโหลดรายชื่อ…</div>';panel.hidden=false;positionEstateHover(point);
 try{
  const source=map.getSource('estate-points');
  // Request every leaf, not the API default page of ten results.
  const groups=await Promise.all(unique.map(f=>f.properties.cluster_id!==undefined?source.getClusterLeaves(f.properties.cluster_id,Number(f.properties.point_count),0):[f]));
  if(request!==hoverRequest)return;
  const allowed=new Set(filtered.map(f=>f.id));
  const members=[...new Map(groups.flat().filter(f=>allowed.has(f.properties.estate_id)).map(f=>[f.properties.estate_id,f])).values()].sort((a,b)=>a.properties.name.localeCompare(b.properties.name,'th'));
  if(!members.length){closeEstateHover();return;}
  panel.innerHTML=`<div class="hover-heading"><strong>รายชื่อในจุดนี้</strong><span>${number(members.length)} รายการ</span></div><ol class="hover-list">${members.map(f=>`<li><button type="button" data-hover-estate="${safe(f.properties.estate_id)}">${safe(f.properties.name)}</button></li>`).join('')}</ol><div class="hover-footer">คลิกชื่อเพื่อดูพื้นที่</div>`;
  positionEstateHover(point);
 }catch{if(request===hoverRequest){panel.innerHTML='<div class="hover-heading">โหลดรายชื่อไม่สำเร็จ ลองชี้อีกครั้ง</div>';positionEstateHover(point);hoverKey='';}}
}
function setupEstateHover(){
 const panel=$('estate-hover');panel.addEventListener('mouseenter',()=>clearTimeout(hoverCloseTimer));panel.addEventListener('mouseleave',scheduleHoverClose);panel.addEventListener('focusin',()=>clearTimeout(hoverCloseTimer));panel.addEventListener('focusout',e=>{if(!panel.contains(e.relatedTarget))scheduleHoverClose();});
 panel.addEventListener('click',e=>{const button=e.target.closest('[data-hover-estate]');if(button){const id=button.dataset.hoverEstate;closeEstateHover();selectEstate(id);}});
 panel.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
 map.on('mousemove',e=>{if(map.isMoving())return;const hits=map.queryRenderedFeatures(e.point,{layers:['clusters','estate-dots']});if(hits.length)showEstateHover(hits,e.point);else scheduleHoverClose();});
 map.getCanvas().addEventListener('mouseleave',scheduleHoverClose);map.on('movestart',closeEstateHover);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeEstateHover();});
}
async function getJSON(url){const r=await fetch(url);if(!r.ok)throw Error('โหลดข้อมูลไม่สำเร็จ');return r.json();}
function message(t){$('map-status').textContent=t;$('map-status').hidden=!t;}
function regionOptions(candidates){$('region-filter').innerHTML='<option value="all">ทุกภาค · '+number(candidates.length)+' รายการ</option>'+regionOrder.map(id=>{const r=admin.regions.features.find(f=>f.properties.id===id);return `<option value="${id}">${r.properties.name} · ${number(candidates.filter(f=>f.properties.region_id===id).length)} รายการ</option>`;}).join('');$('region-filter').value=region;}
function fitRegion(){if(region==='all'){fit(admin.regions.features,6.2);return;}const r=admin.regions.features.find(f=>f.properties.id===region);if(r)fit([r],8.5);}
function applyAdmin(){if(!ready)return;for(const id of adminLayerIds)map.setLayoutProperty(id,'visibility',$('admin-boundaries').checked?'visible':'none');}
function addAdminLayers(){
 map.addSource('provinces',{type:'geojson',data:admin.provinces,attribution:'ขอบเขตจังหวัด: <a href="https://gis-portal.disaster.go.th/arcgis/rest/services/DDPM_MAP_PROVINCE/MapServer/0" target="_blank">ปภ.</a>'});
 map.addSource('province-labels',{type:'geojson',data:admin.provinceLabels});
 map.addSource('regions',{type:'geojson',data:admin.regions});map.addSource('region-labels',{type:'geojson',data:admin.regionLabels});
 map.addLayer({id:'province-fill',type:'fill',source:'provinces',minzoom:6.5,paint:{'fill-color':['get','color'],'fill-opacity':['interpolate',['linear'],['zoom'],6.5,0,7.1,.13,9,.17,12,.1,15,.06]}},'water');
 map.addLayer({id:'province-lines',type:'line',source:'provinces',minzoom:6.5,paint:{'line-color':['get','color'],'line-width':['interpolate',['linear'],['zoom'],6.5,1,9,1.5,13,2],'line-dasharray':[3,3],'line-opacity':['interpolate',['linear'],['zoom'],6.5,0,7,.65,10,.8,15,.45]}});
 map.addLayer({id:'region-lines',type:'line',source:'regions',paint:{'line-color':'#655a43','line-width':['interpolate',['linear'],['zoom'],4,1.3,7,2.2,11,2.5],'line-dasharray':[5,3],'line-opacity':['interpolate',['linear'],['zoom'],4,.8,8,.75,12,.42]}});
 map.addLayer({id:'region-names',type:'symbol',source:'region-labels',maxzoom:7.1,layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],4,14,6.5,19],'text-max-width':14},paint:{'text-color':'#514b3b','text-halo-color':'#ffffff','text-halo-width':2,'text-opacity':['interpolate',['linear'],['zoom'],6.4,1,7.1,0]}});
 map.addLayer({id:'province-names',type:'symbol',source:'province-labels',minzoom:6.7,layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],6.7,13,9,17,12,19],'text-padding':2,'text-max-width':12,'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':['get','color'],'text-halo-color':'#ffffff','text-halo-width':2,'text-opacity':['interpolate',['linear'],['zoom'],6.7,0,7.2,1]}});
}
function bounds(features){const b=new maplibregl.LngLatBounds();for(const f of features){const p=f.properties.bbox;b.extend([p[0],p[1]]);b.extend([p[2],p[3]]);}return b;}
function fit(features,maxZoom=13){if(!map||!features.length)return;map.fitBounds(bounds(features),{padding:innerWidth<700?50:85,maxZoom,duration:reduceMotion?0:850});}
function download(data,filename){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/geo+json'}));a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function clearDetail(){selected=null;$('detail').hidden=true;$('results').hidden=false;if(ready)map.getSource('selection').setData(fc([]));}
function selectEstate(id){const f=estates.features.find(f=>f.id===id);if(!f)return;selected=id;const p=f.properties;$('results').hidden=true;$('detail').hidden=false;
 if(f.geometry.type==='Point'){
 $('detail').innerHTML=`<button class="back" id="back-results">‹ กลับไปรายการ</button><div><span class="type-badge pending-badge">พิกัดสำนักงาน · รอขอบเขต</span></div><h2>${safe(p.short_name)}</h2><p class="english">${safe(p.name)}</p><p class="point-notice">แสดงตำแหน่งสำนักงานตามไฟล์ที่นำเข้า ยังไม่มีขอบเขตพื้นที่นิคม</p><dl><dt>จังหวัด / ภาค</dt><dd>${safe(p.province)} · ${safe(p.region)}</dd><dt>ละติจูด</dt><dd>${p.latitude.toFixed(6)}</dd><dt>ลองจิจูด</dt><dd>${p.longitude.toFixed(6)}</dd><dt>แหล่งพิกัด</dt><dd>${safe(p.coordinate_source)} · แถว ${p.source_row}</dd><dt>ข้อมูลที่รอเพิ่ม</dt><dd>ขอบเขตนิคม ขนาดพื้นที่ และรายละเอียดโครงการล่าสุด</dd></dl><button id="download-one" class="download">ดาวน์โหลดจุดพิกัดนี้</button><p class="source-note">ไฟล์พิกัดไม่ได้ระบุวันที่ปรับปรุงข้อมูล จุดสำนักงานไม่ใช่ขอบเขตหรือจุดกึ่งกลางของนิคม</p>`;
 }else{
 $('detail').innerHTML=`<button class="back" id="back-results">‹ กลับไปรายการ</button><div><span class="type-badge">${p.category==='port'?'ท่าเรืออุตสาหกรรม':'นิคมอุตสาหกรรม'}</span></div><h2>${safe(p.short_name)}</h2><p class="english">${safe(p.name_en||p.name)}</p><div class="area-number">${typeof p.area_rai==='number'?number(p.area_rai):'—'}<span>ไร่</span></div><p class="area-caption">พื้นที่ระบุในข้อมูลต้นฉบับ</p><dl><dt>การดำเนินงาน</dt><dd>${safe(p.operation||'ไม่ได้ระบุ')}</dd><dt>ส่วนขอบเขต</dt><dd>${p.parts} ส่วน</dd><dt>วันที่อนุมัติตามต้นฉบับ</dt><dd>${safe(p.approved_date_raw||'ไม่ได้ระบุ')}</dd><dt>แหล่งข้อมูลขอบเขต</dt><dd>${safe(p.source||'ไฟล์แผนที่ต้นฉบับ')}</dd></dl><button id="download-one" class="download">ดาวน์โหลดขอบเขตพื้นที่นี้</button><p class="source-note">ข้อมูลจากไฟล์ที่นำเข้า ยังไม่ได้ยืนยันกับขอบเขตทางการล่าสุด วันที่และขนาดพื้นที่แสดงตามต้นฉบับ</p>`;
 }
 $('back-results').onclick=clearDetail;$('download-one').onclick=()=>download(fc([f]),p.estate_id+'.geojson');if(ready)map.getSource('selection').setData(fc([f]));fit([f],10);window.IEAT_SHEET?.reveal();$('sidebar').classList.remove('collapsed');$('mobile-panel').setAttribute('aria-expanded','true');}
function updateResults(){if(!estates)return;closeEstateHover();clearDetail();const q=$('search').value.trim().toLocaleLowerCase('th');const candidates=estates.features.filter(f=>(category==='all'||f.properties.category===category)&&[f.properties.name,f.properties.name_en,f.properties.short_name,f.properties.alias_name].some(s=>String(s||'').toLocaleLowerCase('th').includes(q)));regionOptions(candidates);filtered=candidates.filter(f=>region==='all'||f.properties.region_id===region).sort((a,b)=>a.properties.short_name.localeCompare(b.properties.short_name,'th'));
 $('result-count').textContent=number(filtered.length)+' รายการ';$('fit-results').disabled=!filtered.length;
 $('estate-list').innerHTML=filtered.length?filtered.map(f=>{const p=f.properties;return `<button class="estate-row ${p.category} ${p.boundary_status==='pending'?'pending':''}" data-id="${p.estate_id}" aria-label="ดู ${safe(p.name)}"><span class="marker" aria-hidden="true">${p.category==='port'?'◇':'⬡'}</span><span class="row-copy"><span class="row-name">${safe(p.short_name)}</span><span class="row-meta"><span>${p.boundary_status==='pending'?'พิกัดสำนักงาน':typeof p.area_rai==='number'?number(p.area_rai)+' ไร่':'ไม่ระบุพื้นที่'}</span><span>${p.boundary_status==='pending'?'รอขอบเขต':p.parts>1?p.parts+' ส่วนขอบเขต':p.category==='port'?'ท่าเรือ':'นิคมอุตสาหกรรม'}</span></span></span><span class="row-open" aria-hidden="true">›</span></button>`;}).join(''):'<div class="empty"><strong>ไม่พบพื้นที่ที่ค้นหา</strong>ลองใช้ชื่อสั้น ๆ หรือเปลี่ยนประเภทพื้นที่<br><button id="reset-search">ล้างการค้นหา</button></div>';
 if($('reset-search'))$('reset-search').onclick=()=>{$('search').value='';updateResults();};
 if(ready){const ids=new Set(filtered.map(f=>f.id));map.getSource('areas').setData(fc(filtered.filter(f=>f.geometry.type!=='Point')));map.getSource('estate-points').setData(fc(points.features.filter(f=>ids.has(f.id))));}}
function setupMap(){map=new maplibregl.Map({container:'map',style:'basemap.json',center:[101,13.15],zoom:5.4,minZoom:4,maxZoom:18,attributionControl:{compact:true}});map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');map.addControl(new maplibregl.ScaleControl({maxWidth:100,unit:'metric'}),'bottom-left');
 map.on('load',()=>{if(matchMedia('(max-width:700px)').matches){const attribution=document.querySelector('.maplibregl-ctrl-attrib');attribution?.classList.remove('maplibregl-compact-show');attribution?.removeAttribute('open');}const creditButton=document.querySelector('.maplibregl-ctrl-attrib-button');if(creditButton){creditButton.title='เครดิตแผนที่';creditButton.setAttribute('aria-label','เครดิตแผนที่');}const attribution=document.querySelector('.maplibregl-ctrl-attrib');const credit=document.querySelector('.map-credit');const controlRow=document.querySelector('.maplibregl-ctrl-bottom-right');if(attribution&&credit&&controlRow){controlRow.classList.add('credit-inline');controlRow.insertBefore(credit,attribution);}});
 map.on('error',e=>{if(e.error?.message?.includes('fetch')||e.error?.status)message('แผนที่พื้นหลังบางส่วนโหลดไม่ได้ กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต');});
 map.on('load',()=>{addAdminLayers();map.addSource('areas',{type:'geojson',data:fc(filtered.filter(f=>f.geometry.type!=='Point'))});map.addSource('selection',{type:'geojson',data:fc([])});map.addSource('estate-points',{type:'geojson',data:fc(points.features.filter(f=>f.properties.category==='estate')),cluster:true,clusterMaxZoom:8,clusterRadius:32});
 const color=['case',['==',['get','boundary_status'],'pending'],'#c97924',['match',['get','category'],'port','#367e70','#963f43']];
 map.addLayer({id:'area-fill',type:'fill',source:'areas',minzoom:8,paint:{'fill-color':color,'fill-opacity':['interpolate',['linear'],['zoom'],8,.1,11,.25,15,.36]}});
 map.addLayer({id:'area-line',type:'line',source:'areas',minzoom:8,paint:{'line-color':color,'line-width':['interpolate',['linear'],['zoom'],8,1,13,2]}});
 map.addLayer({id:'selected-fill',type:'fill',source:'selection',paint:{'fill-color':'#b34f43','fill-opacity':.25}});map.addLayer({id:'selected-line',type:'line',source:'selection',paint:{'line-color':'#792b30','line-width':3}});
 map.addLayer({id:'clusters',type:'circle',source:'estate-points',filter:['has','point_count'],paint:{'circle-color':'#963f43','circle-radius':['step',['get','point_count'],19,5,23,20,29],'circle-stroke-color':'#e6d5ad','circle-stroke-width':3,'circle-opacity':.96}});
 map.addLayer({id:'cluster-count',type:'symbol',source:'estate-points',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Noto Sans Regular'],'text-size':14,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
 map.addLayer({id:'estate-dots',type:'circle',source:'estate-points',filter:['!',['has','point_count']],paint:{'circle-color':color,'circle-radius':['interpolate',['linear'],['zoom'],5,6,10,7,14,4],'circle-stroke-color':'white','circle-stroke-width':2}});
 map.addLayer({id:'selected-point',type:'circle',source:'selection',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'#c97924','circle-radius':11,'circle-opacity':.25,'circle-stroke-color':'#9b530c','circle-stroke-width':3}});
 map.addLayer({id:'estate-labels',type:'symbol',source:'estate-points',minzoom:8,filter:['!',['has','point_count']],layout:{'text-field':['get','short_name'],'text-font':['Noto Sans Regular'],'text-size':13,'text-anchor':'top','text-offset':[0,1],'text-max-width':15},paint:{'text-color':'#522b28','text-halo-color':'white','text-halo-width':2}});
 map.on('click','clusters',async e=>{const f=e.features[0];const z=await map.getSource('estate-points').getClusterExpansionZoom(f.properties.cluster_id);map.easeTo({center:f.geometry.coordinates,zoom:z,duration:reduceMotion?0:600});});
 map.on('click','estate-dots',e=>selectEstate(e.features[0].properties.estate_id));
 map.on('click','area-fill',e=>{const layers=['estate-dots','clusters'];if(map.getLayer('factory-points'))layers.push('factory-points');if(!map.queryRenderedFeatures(e.point,{layers}).length)selectEstate(e.features[0].properties.estate_id);});
 for(const id of ['clusters','estate-dots','area-fill']){map.on('mouseenter',id,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',id,()=>map.getCanvas().style.cursor='');}
 setupEstateHover();const pendingSelection=selected;ready=true;updateResults();applyBoundaries();applyBaseLabels();applyAdmin();applyMapTheme();if(pendingSelection)selectEstate(pendingSelection);else fitRegion();message('');window.dispatchEvent(new CustomEvent('aim-map-ready',{detail:{map,admin,estates}}));
 });
}
function applyBoundaries(){if(!ready)return;for(const id of ['area-fill','area-line','selected-fill','selected-line'])map.setLayoutProperty(id,'visibility',$('boundaries').checked?'visible':'none');}
function applyBaseLabels(){if(!ready)return;for(const l of map.getStyle().layers){if(l.type==='symbol'&&l.source==='openmaptiles'){map.setLayoutProperty(l.id,'visibility',$('base-labels').checked?'visible':'none');}}}
function setupControls(){document.querySelector('.sidebar-footer a').onclick=e=>{e.preventDefault();download(areas,'ieat-boundaries.geojson');};for(const b of document.querySelectorAll('[data-category]'))b.onclick=()=>{category=b.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});updateResults();fitRegion();};$('region-filter').onchange=e=>{region=e.target.value;updateResults();fitRegion();};$('search').oninput=updateResults;$('estate-list').onclick=e=>{const b=e.target.closest('[data-id]');if(b)selectEstate(b.dataset.id);};$('fit-results').onclick=()=>fit(filtered,12);$('national').onclick=()=>{region='all';updateResults();fitRegion();};$('east').onclick=()=>map?.fitBounds([[100.65,12.5],[102.15,13.65]],{padding:55,duration:reduceMotion?0:700});$('central').onclick=()=>map?.fitBounds([[99.6,13.4],[101.25,14.9]],{padding:55,duration:reduceMotion?0:700});document.querySelectorAll('.map-shortcuts button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.map-shortcuts button').forEach(x=>x.classList.toggle('active',x===b));}));
 const sidebarToggle=$('sidebar-collapse'),workspace=document.querySelector('.workspace');if(sidebarToggle&&workspace)sidebarToggle.onclick=()=>{const collapsed=workspace.classList.toggle('sidebar-hidden');sidebarToggle.textContent=collapsed?'›':'‹';sidebarToggle.setAttribute('aria-expanded',String(!collapsed));const label=collapsed?'เปิดแผงรายการ':'ย่อแผงรายการ';sidebarToggle.setAttribute('aria-label',label);sidebarToggle.title=label;map?.resize();};
 function layers(open){$('layers-panel').hidden=!open;$('layers-button').setAttribute('aria-expanded',String(open));} $('layers-button').onclick=()=>layers($('layers-panel').hidden);$('close-layers').onclick=()=>layers(false);$('boundaries').onchange=applyBoundaries;$('estate-points-toggle').onchange=()=>{if(ready)for(const id of ['clusters','cluster-count','estate-dots','estate-labels','selected-point'])map.setLayoutProperty(id,'visibility',$('estate-points-toggle').checked?'visible':'none');};$('admin-boundaries').onchange=applyAdmin;$('base-labels').onchange=applyBaseLabels;$('water').onchange=()=>{if(ready){map.setPaintProperty('water','fill-color',$('water').value);map.setPaintProperty('waterway','line-color',$('water').value);}};new ResizeObserver(()=>map?.resize()).observe($('map'));
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('search').focus();}if(e.key==='Escape'){layers(false);clearDetail();}});
}
async function start(){try{const data=await Promise.all(['area-ieat.geojson','estate-points.geojson','inventory.json','provinces.geojson','province-labels.geojson','regions.geojson','region-labels.geojson','supplemental-estates.geojson','estate-aliases.json'].map(file=>getJSON('data/'+file)));[areas,points,inventory]=data;estates=fc([...areas.features.map(f=>({...f,properties:{...f.properties,alias_name:data[8][f.id]||''}})),...data[7].features]);points=fc([...points.features,...data[7].features]);admin={provinces:data[3],provinceLabels:data[4],regions:data[5],regionLabels:data[6]};for(const kind of ['estate','port'])document.querySelector(`[data-category="${kind}"] span`).textContent=number(estates.features.filter(f=>f.properties.category===kind).length);$('data-counts').textContent=`${number(areas.features.filter(f=>f.properties.category==='estate').length)} นิคมมีขอบเขต · ${number(data[7].features.length)} นิคมรอขอบเขต · ท่าเรือ 1`;
setupControls();updateResults();if(typeof maplibregl==='undefined')throw Error('ไม่สามารถเปิดส่วนแสดงแผนที่ได้');setupMap();}catch(e){message('เปิดแผนที่ไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ คุณยังดาวน์โหลด GeoJSON ได้');if(!areas)$('result-count').textContent='โหลดข้อมูลไม่สำเร็จ';console.error(e);}}
setupTheme();
start();


