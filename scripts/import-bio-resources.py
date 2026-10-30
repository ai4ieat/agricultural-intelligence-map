"""Read verified native-Sheets XLSX exports; write only a static web snapshot.

Usage: python scripts/import-bio-resources.py /path/to/exports
Exports: crops.xlsx, fisheries.xlsx, livestock.xlsx. Never place exports in public/.
"""
import sys, json, hashlib, math
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime, timezone
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
INPUT = Path(sys.argv[1])
BASE = json.loads((ROOT/'public/data/explorer-data.json').read_text('utf8'))
PROVINCES = {p['id'] for p in BASE['provinces']}
BOOKS = {'crops':'1mIpJl-2z2Lx6MUx7Y5dAD9foOb9Q-giOWcV0B66Iqt4',
         'fisheries':'1JoTWw_Y6OWeh4_3YW564w9Gj84KFIkRHJ8KbUbjPwTU',
         'livestock':'1H_YJRw72yT7tq-kBcJjnLfkf6uqeHi7giDjeZ-En7RA'}

def workbook(kind):
    wb = openpyxl.load_workbook(INPUT/(kind+'.xlsx'), read_only=True, data_only=True)
    out = {}
    for ws in wb:
        rows = iter(ws.values); headers = next(rows)
        out[ws.title] = [{h:v for h,v in zip(headers,r) if h is not None}
                         for r in rows if any(v is not None for v in r)]
    return out

def sid(*parts):
    return 'BIO_'+hashlib.sha256('|'.join(map(str,parts)).encode()).hexdigest()[:16].upper()

products, sources, series, rows, national, units = {}, {}, {}, {}, {}, {}
report = {'excluded':{}, 'imports':{}}

def add_sources(book):
    for s in book['sources']:
        normalized = dict(s, title_th=s['name_th'], publisher=s['organization'], resource_url=s.get('download_url'))
        if s['source_id'] in sources: assert sources[s['source_id']] == normalized
        sources[s['source_id']] = normalized
    for u in book['units_metrics']:
        if u['reference_kind']=='unit': units[u['reference_id']] = u['name_th']

def metrics(book):
    return {m['reference_id']:{'name':m['name_th'],'unit':m['unit_id'],
            'aggregation':'none' if m['reference_id'].startswith('YIELD_') or m['reference_id'] in ['MILK_YIELD_DAILY','REPORTED_PRICE_KG'] else 'sum'}
            for m in book['units_metrics'] if m['reference_kind']=='metric'}

def new_series(id, product, source, name, scope='province', priority=0, **extra):
    if id not in series:
        assert product in products and source in sources, (product,source)
        series[id] = dict(series_id=id,product_id=product,source_id=source,name=name,
            geography_level=scope,priority=priority,metrics={},years=[],**extra)
    return series[id]

def add_value(s, geo, year, metric, value, desc, *, record_id, locator, status='reported', period=None, note=None, source_id=None, reference_date=None):
    year=int(year); assert geo in PROVINCES or geo=='TH', geo
    assert value is None or isinstance(value,(float,int)) and math.isfinite(value) and value>=0, (record_id,value)
    assert (value is None)==(status=='missing_symbol'), (record_id,value,status)
    bucket = national if geo=='TH' else rows
    key=(s['series_id'],geo,year)
    r=bucket.setdefault(key,dict(series_id=s['series_id'],product_id=s['product_id'],province_id=geo,
          year=year,crop_year=str(period or year),source_id=source_id or s['source_id'],metrics={},evidence={}))
    assert metric not in r['metrics'], ('Duplicate observation',key,metric)
    r['metrics'][metric]=value
    r['evidence'][metric]={k:v for k,v in dict(id=record_id,locator=locator,status=status,note=note,reference_date=reference_date).items() if v not in [None,'']}
    s['metrics'][metric]=desc
    if year not in s['years']: s['years'].append(year)

crop=workbook('crops'); add_sources(crop); cm=metrics(crop)
variants={v['variant_id']:v for v in crop['product_variants']}
for p in crop['products']:
    if p['data_status']=='has_statistics':
        products[p['product_id']]=dict(product_id=p['product_id'],name_th=p['name_th'],category='crops',group=p['crop_group'],definition=p['definition_th'])
for obs in crop['crop_stats']+crop['national_stats']:
    p=obs['product_id']; v=variants[obs['variant_id']]; source=obs['source_id']; scope='national' if obs['geography_id']=='TH' else 'province'
    priority=(0 if scope=='province' else 100)+(0 if v['default_variant']=='yes' else 30)+(0 if source.startswith('SRC_OAE') else 10 if source.startswith('SRC_COSME') else 20)
    s=new_series(sid('crops',p,obs['variant_id'],source),p,source,v['name_th'],scope,priority,variant_id=obs['variant_id'])
    add_value(s,obs['geography_id'],obs['year_be'],obs['metric_id'],obs['value'],cm[obs['metric_id']],
        record_id=obs['observation_id'],locator=obs['source_locator'],status=obs['value_status'],period=obs['crop_year_be'],note=obs['note'])
report['excluded']['crops_review_rows']=len(crop['review_queue'])
report['excluded']['crops_catalog_without_statistics']=len(crop['products'])-len(products)
for s in series.values():
    if s['source_id'].startswith('SRC_DOAE_HERB_VALUE'):
        s['note']='มูลค่าผลผลิตตามรายงานระดับประเทศ ไม่ใช่ราคาตลาดปัจจุบัน; กฤษณาปี 2568 มีค่าสูงผิดช่วง ต้องตรวจคำอธิบายต้นทางก่อนวิเคราะห์การเติบโต'
    elif s['source_id'].startswith('SRC_COSME'):
        s['note']='ข้อมูลกรมส่งเสริมการเกษตรผ่าน CosmeHerb; จังหวัดที่ไม่มีรายการไม่ใช่ศูนย์ ไม่ใช้ราคาเฉลี่ย/ผลผลิตต่อไร่ที่วิธีรวมยังไม่ชัดเจน'
    elif 'SISAKET' in s['source_id']:
        s['note']='เฉพาะจังหวัดศรีสะเกษ; ค่าผลผลิตปี 2568 มีการปัดเศษ ห้ามตีความ 0 ตันว่าไม่มีผลผลิต'
    elif 'GARLIC' in s['source_id']:
        s['note']='เว้นปี 2565 ซึ่งตัวเลขต้นทางขัดแย้งกันและพักไว้ตรวจสอบ'
    elif 'SOYBEAN' in s['source_id']:
        s['note']='ปี 2564 ยอดพื้นที่รวมจังหวัดต่างจากยอดประเทศ 21 ไร่ เก็บค่าตามต้นทาง'

fish=workbook('fisheries'); add_sources(fish); fm=metrics(fish)
methods={m['culture_method_id']:m for m in fish['culture_methods']}
for p in fish['products']:
    products[p['product_id']]=dict(product_id=p['product_id'],name_th=p['name_th'],category='fisheries',group='aquaculture',definition=p['definition_th'])
aggregate=defaultdict(list); raw_keys=set(); held=other=0
fields={'production_tonnes':'PRODUCTION','value_thousand_thb':'AQ_PRODUCTION_VALUE','area_rai':'AQ_AREA','farm_count':'AQ_FARM_COUNT'}
for o in fish['aquaculture_stats']:
    if o['record_status']!='ready': held+=1; continue
    if o['map_eligible']!='yes': other+=1; continue
    key=(o['product_id'],o['source_id'],o['culture_method_id'],int(o['year_be']),o['geography_id'])
    assert key not in raw_keys, ('Duplicate ready aquaculture grain',key)
    raw_keys.add(key); method=methods[o['culture_method_id']]
    s=new_series(sid('fisheries',*key[:3]),o['product_id'],o['source_id'],method['source_group']+' · '+method['name_th'],priority=10,
        culture_method_id=o['culture_method_id'],note='เฉพาะการเพาะเลี้ยง; ฟาร์ม/พื้นที่ตามชนิดและวิธีเลี้ยง อาจซ้ำกับชนิดอื่น ไม่ใช่จำนวนไม่ซ้ำทั้งระบบ')
    for field,metric in fields.items():
        value=o[field]
        add_value(s,o['geography_id'],o['year_be'],metric,value,fm[metric],record_id=o['statistic_id'],locator='source row '+str(int(o['source_row'])),status='missing_symbol' if value is None else 'reported')
    aggregate[(o['product_id'],o['source_id'],int(o['year_be']),o['geography_id'])].append(o)
for (p,source,year,geo),items in aggregate.items():
    s=new_series(sid('fisheries',p,source,'all_methods'),p,source,sources[source]['name_th']+' · รวมวิธีเลี้ยง',priority=0,
        culture_method_id='all',note='ผลรวมเฉพาะจังหวัดที่ระบุชื่อและแถวผ่านตรวจ ปีเดียวกัน; ไม่รวมพื้นที่อื่นๆ และแถวปูที่พักตรวจ ไม่ใช่ยอดทางการทั้งชุด; รวมวิธีเลี้ยงได้เฉพาะผลผลิต/มูลค่า')
    for field,metric in list(fields.items())[:2]:
        known=[o[field] for o in items if o[field] is not None]
        # Do not turn a partial aggregate with missing inputs into a complete total.
        value=sum(known) if len(known)==len(items) else None
        add_value(s,geo,year,metric,value,fm[metric],record_id=';'.join(o['statistic_id'] for o in items),locator='source rows '+','.join(str(int(o['source_row'])) for o in items),status='reported' if value is not None else 'missing_symbol')
report['excluded'].update(fisheries_held_rows=held,fisheries_other_geography_rows=other)

live=workbook('livestock'); add_sources(live); lm=metrics(live)
for p in live['products']:
    products[p['product_id']]=dict(product_id=p['product_id'],name_th=p['name_th'],category='livestock',group=p['product_group'],parent_product_id=p['parent_product_id'],definition=p['definition_th'])
for s in live['series']:
    priority=(0 if s['default_for_metric']=='yes' else 50)+(0 if s['metric_id'] in ['ANIMAL_COUNT','PRODUCTION','EGG_PRODUCTION'] else 10)
    new_series(s['series_id'],s['product_id'],s['source_id'],s['name_th'],priority=priority,
        note=sources[s['source_id']].get('scope_note') or '',time_basis=s['time_basis'])
ls={s['series_id']:s for s in live['series']}
for o in live['livestock_stats']+live['national_totals']:
    s=series[o['series_id']]; metric=ls[o['series_id']]['metric_id']
    add_value(s,o['geography_id'],o['year_be'],metric,o['value'],lm[metric],record_id=o['observation_id'],locator=o['source_locator'],status=o['value_status'],reference_date=o['reference_date'],source_id=o.get('control_source_id'))

used={s['product_id'] for s in series.values()}; assert used==set(products), used^set(products)
assert not set(products)&{p['product_id'] for p in BASE['products']}, 'Existing product IDs must not be overwritten'
for s in series.values(): s['years'].sort(reverse=True)
for kind,id in BOOKS.items():
    report['imports'][kind]={'spreadsheet_id':id,'url':f'https://docs.google.com/spreadsheets/d/{id}/edit',
        'sha256':hashlib.sha256((INPUT/(kind+'.xlsx')).read_bytes()).hexdigest()}
report.update(products_by_category=dict(Counter(p['category'] for p in products.values())),series=len(series),province_rows=len(rows),national_rows=len(national))
result=dict(schema_version=1,exported_at=datetime.now(timezone.utc).isoformat(),imports=report['imports'],
    products=list(products.values()),series=list(series.values()),rows=list(rows.values()),national_rows=list(national.values()),
    sources=list(sources.values()),units=units,report=report)
target=ROOT/'public/data/bio-resources.json'; temp=target.with_suffix('.next.json')
temp.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf8');temp.replace(target)
(ROOT/'bio-import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='imports'},ensure_ascii=False,indent=2))
print('Static JSON bytes:',target.stat().st_size)
