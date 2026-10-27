import {escapeHTML as esc,safeURL} from './explorer-model.js';
import {filterResearch,DEFAULTS,STUDY_TYPES,STAGES,STATUSES} from './research-model.js';
const $=id=>document.getElementById(id);
const form=$('research-filters');
let data,filters={...DEFAULTS};
const fieldLabels={q:'คำค้น',material:'วัตถุดิบ',output:'Output',product:'พืช',industry:'อุตสาหกรรม',study:'ประเภท',stage:'ระดับการพัฒนา',year:'ปี',status:'สถานะ',organization:'องค์กร',mapping:'รหัสพืช'};
const option=(value,label)=>`<option value="${esc(value)}">${esc(label)}</option>`;
const unique=values=>[...new Set(values.filter(Boolean))];
function populate(name,values,label=x=>x){form.elements[name].innerHTML=option('all','ทั้งหมด')+values.map(x=>option(x,label(x))).join('');}
const industry=id=>data.industries.find(i=>i.industry_id===id)?.name_th||id;
const product=id=>data.products.find(p=>p.product_id===id)?.name_th||id;
const doiLink=r=>safeURL('https://doi.org/'+r.doi);
function statusBadge(r){return `<span class="badge ${r.review_status==='accepted'?'':'pending'}">${esc(STATUSES[r.review_status]||r.review_status)}</span>`;}
function card(r){
 const materials=unique(r.products.map(p=>p.material_form_th));
 return `<article class="library-card"><div class="card-topline"><span>${esc(STUDY_TYPES[r.study_type]||r.study_type)}</span><span>${esc(r.year)}</span></div><h3>${esc(r.title)}</h3><div class="badges">${statusBadge(r)}</div><p class="card-summary">${esc(r.summary)}</p><div class="io-box"><small>INPUT · วัตถุดิบ</small>${materials.length?`<p>${esc(materials.join(' · '))}</p>`:'<p class="missing">ยังไม่จัดโครงสร้างวัตถุดิบในชีต<br>ค้นจากชื่อเรื่องและบทสรุปได้</p>'}<div class="io-output"><small>OUTPUT · การประยุกต์</small><p>${esc(r.application||'ยังไม่ระบุ')}</p></div></div><p class="card-industry">${esc(unique(r.industries.map(i=>industry(i.industry_id))).join(' · ')||'ยังไม่เชื่อมอุตสาหกรรม')}</p><div class="card-actions"><button type="button" data-research-id="${esc(r.id)}">อ่านรายละเอียด ↗</button><a href="${esc(doiLink(r))}" target="_blank" rel="noopener noreferrer">ต้นฉบับ / DOI ↗</a></div></article>`;
}
function readForm(){for(const key of Object.keys(DEFAULTS))filters[key]=form.elements[key].value;}
function writeURL(){const q=new URLSearchParams();for(const [key,value] of Object.entries(filters))if(value!==DEFAULTS[key])q.set(key,value);history.replaceState(null,'',location.pathname+(q.size?'?'+q.toString():''));}
function render(){
 const rows=filterResearch(data,filters);
 $('result-count').textContent=`พบ ${rows.length} งานวิจัย`;
 $('result-context').textContent=`จากทั้งหมด ${data.research.length} งาน · รวมงานที่ยังไม่เชื่อมรหัสพืชเมื่อเลือก “ทั้งหมด”`;
 $('research-grid').innerHTML=rows.length?rows.map(card).join(''):`<div class="empty"><strong>ยังไม่พบงานที่ตรงทุกเงื่อนไข</strong>ลองใช้คำสั้นลง หรือล้างตัวกรองบางรายการ<br><button type="reset" class="load-more">ล้างตัวกรองทั้งหมด</button></div>`;
 $('active-filters').innerHTML=Object.entries(fieldLabels).filter(([key])=>filters[key]!==DEFAULTS[key]).map(([key,label])=>{
  const el=form.elements[key],value=el.tagName==='SELECT'?el.selectedOptions[0]?.textContent:filters[key];
  return `<button type="button" class="filter-chip" data-clear="${key}" aria-label="ล้างตัวกรอง ${esc(label)}">${esc(label)}: ${esc(value)} ×</button>`;
 }).join('');writeURL();
}
function openResearch(id){
 const r=data.research.find(r=>r.id===id);if(!r)return;
 const materials=r.products.map(p=>`<p><b>${esc(p.material_form_th)}</b> · ${esc(product(p.product_id))}<br>${esc(p.mapping_note_th)} <span class="badge pending">${esc(STATUSES[p.review_status]||p.review_status)}</span></p>`).join('');
 const apps=r.industries.map(i=>`<p><b>${esc(industry(i.industry_id))}</b><br>${esc(i.application_th)}<br><span class="source-note">${esc(i.mapping_note_th)} · ${esc(STATUSES[i.review_status]||i.review_status)}</span></p>`).join('');
 $('research-detail').innerHTML=`<h2>${esc(r.title)}</h2><p class="original-title">${esc(r.title_original)}</p><div class="badges">${statusBadge(r)}<span class="badge blue">${esc(STUDY_TYPES[r.study_type]||r.study_type)}</span><span class="badge">${esc(r.year)}</span></div><p><a href="${esc(doiLink(r))}" target="_blank" rel="noopener noreferrer">เปิดต้นฉบับ · DOI ${esc(r.doi)} ↗</a></p><section class="detail-section"><h3>บทสรุป</h3><p>${esc(r.summary)}</p><p class="source-note">ระดับการพัฒนา: ${esc(STAGES[r.stage]||r.stage||'ยังไม่ระบุ')}</p></section><section class="detail-section"><h3>วัตถุดิบและความเชื่อมโยง</h3>${materials||'<p>ยังไม่มีการเชื่อมรหัสพืชในชีต โปรดอ่านวัตถุดิบจากชื่อเรื่อง บทสรุป และต้นฉบับ</p>'}</section><section class="detail-section"><h3>Output และการประยุกต์</h3><p>${esc(r.application)}</p>${apps}</section><section class="limitations"><h3>ข้อจำกัดที่ควรอ่าน</h3><p>${esc(r.limitations||'ยังไม่ระบุในชีต')}</p></section><section class="detail-section"><h3>องค์กรวิจัย</h3><p>${esc(r.organizations.map(o=>o.name_th).join(' · ')||'ยังไม่เชื่อมองค์กรในชีต')}</p></section><section class="detail-section"><h3>เอกสารและแหล่งอ้างอิง</h3>${r.documents.map(d=>`<div>${safeURL(d.document_url)?`<a class="evidence-link" href="${esc(safeURL(d.document_url))}" target="_blank" rel="noopener noreferrer">${esc(d.document_role==='publisher_record'?'หน้าผู้เผยแพร่':d.document_role)} ↗</a>`:''}<p class="source-note">${esc(d.source_note_th||'')}<br>ตรวจข้อมูล: ${esc(d.retrieved_on||'ไม่ระบุ')}</p></div>`).join('')}</section>`;
 $('research-dialog').showModal();$('research-dialog').scrollTop=0;
}
async function start(){try{
 const response=await fetch('data/explorer-data.json',{cache:'no-cache'});if(!response.ok)throw Error('Unable to load research');data=await response.json();
 $('library-total').textContent=data.research.length;
 const dates=unique(data.research.flatMap(r=>r.documents.map(d=>d.retrieved_on))).sort();
 $('library-date').textContent='ตรวจแหล่งข้อมูลล่าสุด '+(dates.at(-1)||'—');
 populate('product',unique(data.research.flatMap(r=>r.products.map(p=>p.product_id))),product);
 populate('industry',unique(data.research.flatMap(r=>r.industries.map(i=>i.industry_id))),industry);
 populate('study',unique(data.research.map(r=>r.study_type)),x=>STUDY_TYPES[x]||x);
 populate('stage',unique(data.research.map(r=>r.stage)),x=>STAGES[x]||x);
 populate('year',unique(data.research.map(r=>String(r.year))).sort((a,b)=>b-a));
 populate('status',['pending','accepted','needs_review'],x=>STATUSES[x]||x);
 const orgs=new Map(data.research.flatMap(r=>r.organizations.map(o=>[o.organization_id,o.name_th])));
 populate('organization',[...orgs.keys()],x=>orgs.get(x));
 $('material-suggestions').innerHTML=unique(data.research.flatMap(r=>r.products.map(p=>p.material_form_th))).map(x=>option(x,x)).join('');
 $('output-suggestions').innerHTML=unique(data.research.map(r=>r.application)).map(x=>option(x,x)).join('');
 const params=new URLSearchParams(location.search);for(const key of Object.keys(DEFAULTS)){const value=params.get(key);const el=form.elements[key];if(value!==null&&(el.tagName!=='SELECT'||[...el.options].some(o=>o.value===value)))el.value=value;}
 readForm();render();
 let timer;
 form.addEventListener('input',e=>{if(e.target.tagName!=='INPUT')return;clearTimeout(timer);timer=setTimeout(()=>{readForm();render();},160);});
 form.addEventListener('change',()=>{clearTimeout(timer);readForm();render();});
 form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);readForm();render();});
 form.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();clearTimeout(timer);readForm();render();}});
 form.addEventListener('reset',e=>{e.preventDefault();clearTimeout(timer);for(const [key,value] of Object.entries(DEFAULTS))form.elements[key].value=value;readForm();render();});
 form.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.clear){clearTimeout(timer);form.elements[b.dataset.clear].value=DEFAULTS[b.dataset.clear];readForm();render();}if(b.dataset.researchId)openResearch(b.dataset.researchId);});
 $('close-research').onclick=()=>$('research-dialog').close();
 const compact=matchMedia('(max-width:760px)');
 $('filter-disclosure').open=!compact.matches;
 compact.addEventListener('change',e=>{$('filter-disclosure').open=!e.matches;});
 $('back-map').href='./';
 }catch(error){console.error(error);$('result-count').textContent='โหลดคลังวิจัยไม่สำเร็จ';$('research-grid').innerHTML='<div class="empty">กรุณารีเฟรชหน้าเว็บเพื่อลองอีกครั้ง</div>';}}
start();
