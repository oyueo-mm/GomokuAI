export function encodeCsv(rows:Record<string,unknown>[]) {
  if(!rows.length)return '';
  const keys=Object.keys(rows[0]);
  const cell=(value:unknown)=>{const s=typeof value==='object'?JSON.stringify(value):String(value??'');return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
  return [keys.map(cell).join(','),...rows.map(row=>keys.map(key=>cell(row[key])).join(','))].join('\r\n');
}
