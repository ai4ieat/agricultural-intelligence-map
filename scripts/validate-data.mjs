import { readFile } from 'node:fs/promises';
import contract from '../public/data-contract.js';
const read=async file=>JSON.parse(await readFile(new URL('../public/data/'+file,import.meta.url),'utf8'));
const provinces=new Map((await read('provinces.geojson')).features.map(f=>[f.properties.code,f.properties.name]));
const estateIds=new Set([...(await read('area-ieat.geojson')).features,...(await read('supplemental-estates.geojson')).features].map(f=>f.id));
for(const kind of ['agriculture','factories']){
  const data=contract.validate(await read(kind+'.json'),kind,provinces,estateIds);
  console.log(`${kind}: ${data.records.length} valid records; sample=${data.is_sample}`);
}
