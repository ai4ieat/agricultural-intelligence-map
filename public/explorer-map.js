import {number,escapeHTML as esc,provinceMetricRows} from './explorer-model.js';
const fc=features=>({type:'FeatureCollection',features});
export const COLORS=['#d9ebce','#b4d395','#78b470','#438951','#1f6039'];
export function legendStep(max){const raw=max/5;if(!Number.isFinite(raw)||raw<=0)return 1;const quantum=raw>=1e6?5e5:raw>=1e5?1e5:10**Math.floor(Math.log10(raw));return Math.max(quantum,Math.floor(raw/quantum)*quantum);}
export function legendNumber(value){return value>=1e5?number(value/1e6,1)+' ล้าน':number(value,2);}
export function colorFor(value,max){if(value==null)return '#e5e8e2';if(value===0)return '#f5f8ef';return COLORS[Math.min(4,Math.floor(value/legendStep(max)))];}
export function extent(features){const b=new maplibregl.LngLatBounds();function walk(c){if(typeof c[0]==='number')b.extend(c);else c.forEach(walk);}features.forEach(f=>walk(f.geometry.coordinates));return b;}
export async function createMap(data,onProvince,onEstate){
 const paths=['provinces.geojson','province-labels.geojson','area-ieat.geojson','estate-points.geojson','supplemental-estates.geojson','regions.geojson'];
 const [provinces,labels,areas,points,offices,regions]=await Promise.all(paths.map(async n=>{const r=await fetch('data/'+n);if(!r.ok)throw Error(n);return r.json();}));
 const styleResponse=await fetch('basemap.json');if(!styleResponse.ok)throw Error('basemap');const style=await styleResponse.json();
 const paints={background:{'background-color':'#e7eddf'},water:{'fill-color':'#bcdde9'},waterway:{'line-color':'#a7cedd'},park:{'fill-color':'#d9e4cd'},landcover_wood:{'fill-color':'#d5e2c7'},landuse_residential:{'fill-color':'#e1e4d9'}};
 for(const layer of style.layers){if(paints[layer.id])layer.paint={...layer.paint,...paints[layer.id]};if(layer.type==='symbol')layer.layout={...layer.layout,visibility:'none'};}
 const map=new maplibregl.Map({container:'map',style,center:[101,13],zoom:4.8,minZoom:3,maxZoom:18,attributionControl:{compact:true}});
 map.addControl(new maplibregl.NavigationControl({showCompass:true}),'top-left');map.addControl(new maplibregl.ScaleControl({maxWidth:85,unit:'metric'}),'bottom-left');
 const allEstates=[...areas.features,...offices.features],allPoints=[...points.features,...offices.features];
 let state=null,loaded=false,agriculture=new Map(),max=0,selectedEstate=null;
 const farmPaints={background:{'background-color':'#e6e5b7'},water:{'fill-color':'#9bcfce'},waterway:{'line-color':'#7fb9b9'},park:{'fill-color':'#c8d89e'},landcover_wood:{'fill-color':'#bfd29a'},landuse_residential:{'fill-color':'#e4dfb4'}};
 function applyTheme(){if(!loaded)return;const palette=document.documentElement.dataset.theme==='farm'?farmPaints:paints;for(const [id,properties] of Object.entries(palette))if(map.getLayer(id))for(const [key,value] of Object.entries(properties))map.setPaintProperty(id,key,value);}
 document.addEventListener('aim-theme-change',applyTheme);
 map.on('remove',()=>document.removeEventListener('aim-theme-change',applyTheme));
 const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:650;
 function status(text){const el=document.getElementById('map-status');el.textContent=text;el.hidden=!text;}
 map.on('error',e=>{if(e.error?.status||/fetch|network/i.test(e.error?.message||''))status('แผนที่พื้นหลังบางส่วนโหลดไม่ได้ • ข้อมูลในแผงยังใช้งานได้');});
 function fit(features){if(features.length)map.fitBounds(extent(features),{padding:{top:125,bottom:85,left:40,right:45},maxZoom:11,duration});}
 function update(s){state=s;agriculture=new Map(provinceMetricRows(data,{...s,province:'all',region:'all'}).map(r=>[r.province_id,r.metrics[s.metric]?.value??null]));max=Math.max(0,...[...agriculture.values()].filter(v=>v!==null));if(!loaded)return;
  const colored=provinces.features.map(f=>{const pid='PROV_'+f.properties.code;const regionMatch=s.region==='all'||f.properties.region_id===s.region;return {...f,properties:{...f.properties,fill:regionMatch?colorFor(agriculture.get(pid),max):'#e9ede6'}};});
  map.getSource('provinces').setData(fc(colored));map.setFilter('province-selected',['==',['get','code'],s.province.replace('PROV_','')]);
  // Estate geometry stays nationwide; geographic filters apply to result lists only.
  const top=new Set([...agriculture.entries()].filter(([,v])=>v!=null).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id])=>id.replace('PROV_','')));
  map.getSource('highlight-labels').setData(fc(labels.features.filter(f=>top.has(f.properties.code)||'PROV_'+f.properties.code===s.province)));layers();
 }
 function layers(){if(!loaded)return;const set=(ids,show)=>ids.forEach(id=>map.setLayoutProperty(id,'visibility',show?'visible':'none'));set(['agri-fill'],document.getElementById('agri-layer').checked);set(['province-lines','province-labels'],document.getElementById('province-layer').checked);set(['area-fill','area-line','clusters','cluster-count','estate-dots','estate-labels','estate-selected-fill','estate-selected-line','estate-selected-point'],document.getElementById('estate-layer').checked);for(const l of style.layers)if(l.type==='symbol')map.setLayoutProperty(l.id,'visibility',document.getElementById('base-labels').checked?'visible':'none');}
 function clearEstate(){selectedEstate=null;if(loaded)map.getSource('estate-selection').setData(fc([]));}
 function focusProvince(pid){selectedEstate=null;if(loaded)map.getSource('estate-selection').setData(fc([]));const list=pid==='all'?provinces.features:provinces.features.filter(f=>'PROV_'+f.properties.code===pid);if(list.length)fit(list);}
 function focusRegion(region){selectedEstate=null;if(loaded)map.getSource('estate-selection').setData(fc([]));fit(region==='all'?provinces.features:provinces.features.filter(f=>f.properties.region_id===region));}
 function focusEstate(id){const f=allEstates.find(f=>f.properties.estate_id===id);if(!f)return;selectedEstate=id;document.getElementById('estate-layer').checked=true;layers();if(loaded)map.getSource('estate-selection').setData(fc([f]));if(f.geometry.type==='Point')map.easeTo({center:f.geometry.coordinates,zoom:12,duration});else fit([f]);}
 const ready=new Promise(resolve=>map.on('load',()=>{
  map.addSource('provinces',{type:'geojson',data:provinces,attribution:'ขอบเขตจังหวัด: ปภ.'});map.addSource('province-labels',{type:'geojson',data:labels});map.addSource('highlight-labels',{type:'geojson',data:fc([])});
  map.addLayer({id:'agri-fill',type:'fill',source:'provinces',paint:{'fill-color':['coalesce',['get','fill'],'#e5e8e2'],'fill-opacity':.85}});
  map.addLayer({id:'province-lines',type:'line',source:'provinces',paint:{'line-color':'#ffffff','line-width':.85,'line-opacity':.9}});
  map.addLayer({id:'province-selected',type:'line',source:'provinces',filter:['==',['get','code'],''],paint:{'line-color':'#225333','line-width':2.6}});
  map.addLayer({id:'province-labels',type:'symbol',source:'province-labels',minzoom:7,layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':12},paint:{'text-color':'#365740','text-halo-color':'white','text-halo-width':1.7}});
  map.addLayer({id:'top-labels',type:'symbol',source:'highlight-labels',maxzoom:7,layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':12,'text-padding':4},paint:{'text-color':'#24492e','text-halo-color':'#ffffff','text-halo-width':2}});
  map.addSource('areas',{type:'geojson',data:areas});map.addSource('estate-points',{type:'geojson',data:fc(allPoints),cluster:true,clusterMaxZoom:8,clusterRadius:30});map.addSource('estate-selection',{type:'geojson',data:fc([])});
  const estateColor=['case',['==',['get','boundary_status'],'pending'],'#ac855d',['==',['get','category'],'port'],'#398d91','#79618e'];
  map.addLayer({id:'area-fill',type:'fill',source:'areas',minzoom:7,paint:{'fill-color':estateColor,'fill-opacity':.24}});map.addLayer({id:'area-line',type:'line',source:'areas',minzoom:7,paint:{'line-color':estateColor,'line-width':2}});
  map.addLayer({id:'clusters',type:'circle',source:'estate-points',filter:['has','point_count'],paint:{'circle-color':'#79618e','circle-radius':['step',['get','point_count'],13,10,17,30,20],'circle-stroke-color':'#fff','circle-stroke-width':2}});
  map.addLayer({id:'cluster-count',type:'symbol',source:'estate-points',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Noto Sans Regular'],'text-size':11},paint:{'text-color':'#fff'}});
  map.addLayer({id:'estate-dots',type:'circle',source:'estate-points',filter:['!',['has','point_count']],paint:{'circle-color':estateColor,'circle-radius':5,'circle-stroke-color':'white','circle-stroke-width':1.5}});
  map.addLayer({id:'estate-labels',type:'symbol',source:'estate-points',minzoom:9,filter:['!',['has','point_count']],layout:{'text-field':['get','short_name'],'text-font':['Noto Sans Regular'],'text-size':12,'text-anchor':'top','text-offset':[0,1]},paint:{'text-color':'#655075','text-halo-color':'white','text-halo-width':2}});
  map.addLayer({id:'estate-selected-fill',type:'fill',source:'estate-selection',filter:['!=',['geometry-type'],'Point'],paint:{'fill-color':'#79539c','fill-opacity':.3}});map.addLayer({id:'estate-selected-line',type:'line',source:'estate-selection',filter:['!=',['geometry-type'],'Point'],paint:{'line-color':'#4e276f','line-width':3}});map.addLayer({id:'estate-selected-point',type:'circle',source:'estate-selection',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'#ac855d','circle-radius':9,'circle-stroke-color':'white','circle-stroke-width':3}});
  map.on('click',async e=>{
   const es=map.queryRenderedFeatures(e.point,{layers:['clusters','estate-dots','area-fill']});
   if(es.length){const f=es[0];if(f.properties.cluster_id!=null){const z=await map.getSource('estate-points').getClusterExpansionZoom(f.properties.cluster_id);map.easeTo({center:f.geometry.coordinates,zoom:z,duration});}else{onEstate(f.properties.estate_id);focusEstate(f.properties.estate_id);}return;}
   const p=map.queryRenderedFeatures(e.point,{layers:['agri-fill']})[0];if(p)onProvince('PROV_'+p.properties.code);
  });
  const popup=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:13});
  map.on('mousemove',e=>{const estatesHit=map.queryRenderedFeatures(e.point,{layers:['estate-dots','clusters','area-fill']});if(estatesHit.length){const p=estatesHit[0].properties;map.getCanvas().style.cursor='pointer';popup.setLngLat(e.lngLat).setHTML(p.point_count?`<strong>${number(p.point_count)} พื้นที่นิคม / ท่าเรือ</strong>คลิกเพื่อขยายกลุ่ม`:`<strong>${esc(p.short_name||p.name)}</strong>${p.boundary_status==='pending'?'จุดสำนักงาน • รอขอบเขต':'นิคม / ท่าเรือ • คลิกดูรายละเอียด'}`).addTo(map);return;}const hit=map.queryRenderedFeatures(e.point,{layers:['agri-fill']})[0];map.getCanvas().style.cursor=hit?'pointer':'';if(hit&&state){const val=agriculture.get('PROV_'+hit.properties.code);popup.setLngLat(e.lngLat).setHTML(`<strong>${esc(hit.properties.name)}</strong>${val==null?'ไม่มีข้อมูลในชุดนี้':number(val)+' '+(state.metric==='PRODUCTION'?'ตัน':'ไร่')+(state.product==='all'?' · รวมพืชในระบบ':'')}`).addTo(map);}else popup.remove();});map.getCanvas().addEventListener('mouseleave',()=>popup.remove());map.on('movestart',()=>popup.remove());
  loaded=true;applyTheme();status('');if(state)update(state);if(state?.province&&!['all','unknown'].includes(state.province))focusProvince(state.province);else focusRegion(state?.region||'all');resolve();
 }));
 new ResizeObserver(()=>map.resize()).observe(document.getElementById('map'));
 return {map,ready,update,layers,clearEstate,focusProvince,focusRegion,focusEstate,allEstates,getMax:()=>max};
}
