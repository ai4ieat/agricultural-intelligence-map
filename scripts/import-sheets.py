"""Build the local review snapshot from four native Sheets XLSX exports.
Usage: python scripts/import-sheets.py <export-directory>
Never edits source workbooks. No network requests or credentials.
"""
import sys,json,datetime,re,hashlib
from pathlib import Path
from collections import defaultdict
from openpyxl import load_workbook
ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'public'/'data'
SRC=Path(sys.argv[1]).resolve()
def cell(v):
 if isinstance(v,(datetime.date,datetime.datetime)):return v.isoformat()[:10]
 return v
def workbook(name):
 w=load_workbook(SRC/(name+'.xlsx'),read_only=True,data_only=True);out={}
 for s in w:
  rows=iter(s.values);headers=next(rows)
  if s.title=='Guide':continue
  out[s.title]=[{str(k):cell(v) for k,v in zip(headers,r) if k is not None} for r in rows if r and r[0] is not None]
 w.close();return out
f,a,ref,r=[workbook(x) for x in ['factories','agriculture','reference','research']]
def index(rows,key):
 result={x[key]:x for x in rows};assert len(result)==len(rows),('Duplicate',key);return result
products=index(ref['products'],'product_id');provinces=index([g for g in ref['geographies'] if g['geography_level']=='province'],'geography_id')
companies=index(f['companies'],'company_id');addresses=index(f['addresses'],'address_id');estates=index(f['estates'],'estate_id');industries=index(ref['industries'],'industry_id')
polys=json.loads((DATA/'provinces.geojson').read_text(encoding='utf8'))
regions={ 'PROV_'+x['properties']['code']:x['properties']['region_id'] for x in polys['features'] }
mapestates=sum([json.loads((DATA/n).read_text(encoding='utf8'))['features'] for n in ['area-ieat.geojson','supplemental-estates.geojson']],[])
aliases=json.loads((DATA/'estate-aliases.json').read_text(encoding='utf8'))
def norm(s):return re.sub(r'[\s()（）\-.,]','',str(s or '').lower()).replace('นิคมอุตสาหกรรม','')
mapnames=defaultdict(set)
for item in mapestates:
 p=item['properties']
 for name in [p.get('name'),p.get('short_name'),p.get('name_en'),aliases.get(p['estate_id'])]:
  if name:mapnames[norm(name)].add(p['estate_id'])
crosswalk=[]
for e in estates.values():
 ids=mapnames[norm(e['estate_name'])];given=e.get('existing_map_estate_id')
 if given:assert given in {x['properties']['estate_id'] for x in mapestates}
 e['map_id']=given or (next(iter(ids)) if len(ids)==1 else None)
 e['match_basis']='sheet_verified' if given else ('exact_normalized_name' if len(ids)==1 else 'unmatched')
 crosswalk.append(e.copy())
factories=[]
for x in f['factories']:
 assert x['operating_status']=='ปกติ';c=companies[x['company_id']];ad=addresses.get(x['address_id'],{});e=estates[x['estate_id']]
 if x.get('industry_group_id'):assert x['industry_group_id'] in industries
 pid=ad.get('province_id');pid=pid if pid in provinces else None
 factories.append(dict(id=x['factory_id'],name=c.get('name_th') or c.get('name_en'),name_en=c.get('name_en'),registration=x.get('registration_number'),estate_id=x['estate_id'],industry_id=x.get('industry_group_id'),province_id=pid,district_id=ad.get('district_id'),district=ad.get('district_name'),activity=x.get('activity_text'),identity_status=x['identity_status'],duplicate_group_id=x.get('duplicate_group_id'),source_row=x['source_row']))
records={}
seen=set()
for x in a['agri_production']:
 assert x['product_id'] in products and x['geography_id'] in provinces
 assert isinstance(x['value'],(float,int)) and x['value']>=0
 key=(x['product_id'],x['geography_id'],x['crop_year_be'],x['source_id'])
 unique=key+(x['metric_id'],);assert unique not in seen;seen.add(unique)
 item=records.setdefault(key,dict(product_id=x['product_id'],province_id=x['geography_id'],crop_year=x['crop_year_be'],year=int(x['year_be']),source_id=x['source_id'],metrics={},source_locator=x['source_locator']))
 item['metrics'][x['metric_id']]={'value':x['value'],'unit':x['unit_id'],'name':x['metric_name_th']}
research=index(r['research_items'],'research_id');docs=index(r['research_documents'],'document_id');orgs=index(r['research_organizations'],'organization_id')
for x in docs.values():assert x['research_id'] in research
for tab,field,master in [('research_products','product_id',products),('research_industries','industry_id',industries),('research_organization_links','organization_id',orgs)]:
 for x in r[tab]:
  assert x['research_id'] in research and x[field] in master
  assert docs[x['evidence_document_id']]['research_id']==x['research_id']
research_rows=[]
for x in research.values():
 assert docs[x['primary_document_id']]['research_id']==x['research_id']
 if x['review_status']=='rejected':continue
 research_rows.append(dict(id=x['research_id'],title=x['title_th'],title_original=x['title_original'],year=x['publication_year'],doi=x['doi'],summary=x['summary_th'],application=x['application_th'],limitations=x['limitations_th'],study_type=x['study_type'],stage=x['research_stage'],review_status=x['review_status'],products=[v for v in r['research_products'] if v['research_id']==x['research_id'] and v['review_status']!='rejected'],industries=[v for v in r['research_industries'] if v['research_id']==x['research_id'] and v['review_status']!='rejected'],organizations=[orgs[v['organization_id']] for v in r['research_organization_links'] if v['research_id']==x['research_id']],documents=[v for v in docs.values() if v['research_id']==x['research_id']]))
sources={x['source_id']:x for x in ref['sources']}
for x in a['sources']:sources[x['source_id']]=x
public_sources=[{k:x.get(k) for k in ['source_id','title_th','publisher','dataset_url','resource_url','coverage_imported','retrieved_on']} for x in sources.values()]
# Reject multiple periods/sources until the interface has a year/source selector.
index(factories,'id')
pairs=set(); periods={}
for item in records.values():
 pair=(item['product_id'],item['province_id']);assert pair not in pairs,('Multiple periods/sources require a year selector',pair);pairs.add(pair)
 period=(item['year'],item['crop_year']);assert periods.get(item['product_id'],period)==period,'Mixed crop years';periods[item['product_id']]=period
 assert item['source_id'] in sources,'Unknown agriculture source'
 for metric,m in item['metrics'].items():
  expected='TONNE' if metric=='PRODUCTION' else 'KG_PER_RAI' if metric.startswith('YIELD_') else 'RAI'
  assert m['unit']==expected,('Unexpected unit',metric,m['unit'])
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
payload=dict(schema_version=2,mode='review',exported_at=now,source_snapshots={key:hashlib.sha256((SRC/(key+'.xlsx')).read_bytes()).hexdigest() for key in ['factories','agriculture','reference','research']},products=list(products.values()),industries=list(industries.values()),provinces=[{'id':k,'name':v['name_th'],'region':regions[k]} for k,v in provinces.items()],agriculture=list(records.values()),factories=factories,estates=crosswalk,research=research_rows,sources=public_sources,value_chain_links=ref['value_chain_links'],harvest_calendar=a['harvest_calendar'],market_prices=a['market_prices'],economic_stats=a['economic_stats'],industry_summary=a['industry_summary'])
qa=dict(factory_rows=len(factories),factory_rows_without_province=sum(not x['province_id'] for x in factories),estate_matches=sum(bool(x['map_id']) for x in crosswalk),estate_total=len(crosswalk),agriculture_records=len(records),research_items=len(research_rows),review_queue=len(f['review_queue']),counts_are_source_rows=True,source_snapshots=payload['source_snapshots'])
text=json.dumps(payload,ensure_ascii=False,separators=(',',':'),allow_nan=False)
temp=DATA/'explorer-data.next.json';temp.write_text(text,encoding='utf8');temp.replace(DATA/'explorer-data.json')
(ROOT/'data-import-report.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2),encoding='utf8')
(ROOT/'estate-crosswalk.json').write_text(json.dumps(crosswalk,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(qa,ensure_ascii=False))
