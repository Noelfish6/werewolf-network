// Synchronize only changed metadata cells in the existing workbook; preserve layout.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const game=process.argv[2];if(!['H3','H6','H8'].includes(game))throw Error('Choose a human game');
const out=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../outputs',game+'_SNA');
const tables=JSON.parse(await fs.readFile(path.join(out,'tables.json'),'utf8'));
const file=path.join(out,game+'_狼人杀关系网络数据.xlsx');
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(file));
let changed=0;
for(const [table,sheet] of [['players','玩家'],['review_issues','待核查'],['data_dictionary','字段说明']]){
 const rows=tables[table],sh=wb.worksheets.getItem(sheet),cols=sh.getRangeByIndexes(0,0,1,Object.keys(rows[0]).length).values[0];
 const saved=sh.getRangeByIndexes(1,0,rows.length,cols.length).values;
 for(let i=0;i<rows.length;i++)for(let c=0;c<cols.length;c++){
  const value=rows[i][cols[c]]??'';
  if((saved[i]?.[c]??'')!==value){sh.getRangeByIndexes(i+1,c,1,1).values=[[value]];changed++;}
 }
}
wb.recalculate();
const preview=await wb.render({sheetName:'玩家',range:process.argv[3]||'A1:F10',format:'png',scale:1.5});
await fs.writeFile(path.join(out,'_previews/names-confirmed.png'),new Uint8Array(await preview.arrayBuffer()));
const exported=await SpreadsheetFile.exportXlsx(wb);await exported.save(file);
console.log(game,'metadata cells updated:',changed);
