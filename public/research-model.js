export const STUDY_TYPES={laboratory_experiment:'การทดลองในห้องปฏิบัติการ',economic_consumer_study:'เศรษฐศาสตร์และผู้บริโภค',pilot_scale_experiment:'การทดลองระดับนำร่อง',laboratory_and_lca:'การทดลองและประเมินวัฏจักรชีวิต',pilot_clinical_study:'การศึกษาทางคลินิกนำร่อง'};
export const STAGES={laboratory_material_test:'ทดสอบวัสดุในห้องปฏิบัติการ',laboratory_electrode_device:'อุปกรณ์ขั้วไฟฟ้าในห้องปฏิบัติการ',laboratory_food_packaging_test:'ทดสอบบรรจุภัณฑ์อาหาร',laboratory_prototype:'ต้นแบบในห้องปฏิบัติการ',pilot_scale_process:'กระบวนการระดับนำร่อง',pilot_clinical_trial:'การทดลองทางคลินิกนำร่อง',laboratory_and_life_cycle_assessment:'ห้องปฏิบัติการและประเมินวัฏจักรชีวิต',food_prototype_and_life_cycle_assessment:'ต้นแบบอาหารและประเมินวัฏจักรชีวิต',formulation_and_in_vivo_spf_test:'พัฒนาสูตรและทดสอบ SPF ในสิ่งมีชีวิต',value_chain_and_consumer_analysis:'วิเคราะห์ห่วงโซ่มูลค่าและผู้บริโภค'};
export const STATUSES={pending:'รอตรวจรับ',accepted:'ตรวจรับแล้ว',needs_review:'ต้องตรวจเพิ่มเติม',rejected:'ไม่รับรอง'};
export const DEFAULTS={q:'',material:'',output:'',product:'all',industry:'all',study:'all',stage:'all',year:'all',status:'all',organization:'all',mapping:'all',sort:'newest'};
const norm=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('th');
const matches=(text,query)=>norm(query).trim().split(/\s+/).filter(Boolean).every(word=>norm(text).includes(word));
export function filterResearch(data,filters={}){
 const f={...DEFAULTS,...filters};
 const names=new Map(data.industries.map(i=>[i.industry_id,i.name_th]));
 const rows=data.research.filter(r=>{
  const materials=r.products.map(p=>p.material_form_th||'').join(' ');
  const outputs=[r.application,...r.industries.map(i=>i.application_th)].join(' ');
  const text=[r.title,r.title_original,r.summary,materials,outputs,r.doi,...r.organizations.map(o=>o.name_th),...r.industries.map(i=>names.get(i.industry_id))].join(' ');
  return r.review_status!=='rejected'&&matches(text,f.q)&&matches([materials,r.title,r.title_original,r.summary].join(' '),f.material)&&matches([outputs,r.title,r.title_original,r.summary].join(' '),f.output)
   &&(f.product==='all'||r.products.some(p=>p.product_id===f.product))
   &&(f.industry==='all'||r.industries.some(i=>i.industry_id===f.industry))
   &&(f.study==='all'||r.study_type===f.study)&&(f.stage==='all'||r.stage===f.stage)
   &&(f.year==='all'||String(r.year)===f.year)&&(f.status==='all'||r.review_status===f.status)
   &&(f.organization==='all'||r.organizations.some(o=>o.organization_id===f.organization))
   &&(f.mapping==='all'||(f.mapping==='unmapped'?!r.products.length:r.products.length>0));
 });
 return rows.sort((a,b)=>f.sort==='title'?a.title.localeCompare(b.title,'th'):((f.sort==='oldest'?1:-1)*(a.year-b.year)||a.title.localeCompare(b.title,'th')));
}
