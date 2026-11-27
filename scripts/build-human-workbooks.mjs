import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const game=process.argv[2];
if(!['H3','H6','H8'].includes(game))throw Error('Choose H3, H6 or H8');
const out=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../outputs',game+'_SNA');
const meta=JSON.parse(await fs.readFile(path.join(out,'manifest.json'),'utf8'));

const data=JSON.parse(await fs.readFile(path.join(out,'tables.json'),'utf8'));
const wb=Workbook.create();
const info=wb.worksheets.add('使用说明'); info.showGridLines=false;
info.getRange('A2').values=[[meta.title+' · '+game]];
info.getRange('A2').format.font={name:'Arial',size:16,bold:true,color:'#243650'};
info.getRange('A4:B14').values=[
 ['项目','说明'],['数据版本','AI辅助首轮编码；2026-11-27；仅依逐字稿'],['时间切片',`按主持昼夜划分${meta.day_count}个白天；第一天包含竞选发言`],
 ['关系单位','玩家对玩家的有向公开身份立场；支持、怀疑分别建层'],
 ['编码规则','逻辑赞同、条件句、集合判断、回放、访谈与遗言不自动算明确边'],
 ['快照规则','每对白天内取最后的明确立场；不跨天继承；未定单元留空'],
 ['角色证据','confirmed已确认；inferred推定；unknown未知'],
 ['关键缺失','说话人、昵称、票型及身份歧义见待核查表；未知不补齐'],
 ['使用方式','按game_id/day筛选，再分关系与票型；不同局的同一座位不是同一玩家'],
 ['复核方式','关系事件表reviewer_decision可记复核意见；编辑不会自动更新矩阵'],
 ['更多说明','原稿、精确引文与来源哈希可核查；CSV/矩阵/GraphML可供分析']
 ];
info.getRange('A4:B14').format.font={name:'Arial',size:11,color:'#243650'};
info.getRange('A4:B14').format.verticalAlignment='center';
info.getRange('A4:B14').format.rowHeight=38;
info.getRange('A4:A14').format.columnWidth=18;
info.getRange('B4:B14').format.columnWidth=93;
info.getRange('B4:B14').format.wrapText=true;
info.getRange('A4:B4').format.fill='#243650';info.getRange('A4:B4').format.font.color='#FFFFFF';
const layouts=[
 ['relation_events','关系事件',['event_id','day','timestamp','source','target','relation','assertion_mode','main_eligible','evidence_quote','needs_review','reviewer_decision']],
 ['votes','投票',['vote_id','day','ballot_type','voter','target','action','eligible','is_valid','timestamp','needs_review','notes']],
 ['network_edges','快照边列表',['day','Layer','Source','Target','Weight','Type','last_event_id']],
 ['snapshot_dyads','全部快照单元',['day','source','target','support','suspect','opportunity_mask','analysis_known_mask','cell_status','last_event_id']],
 ['players','玩家',['seat','player_id','display_name','true_role','role_status','true_camp','camp_status','role_evidence','aliases']],
 ['player_status','每日状态',['day','player_id','alive_at_prevote','can_speak','can_vote','observed_public_speech','is_sheriff']],
 ['key_events','关键事件',['key_event_id','day','timestamp','event_type','actor','target','value','fact_status','evidence_quote']],
 ['utterances','原始逐字稿',['utterance_id','day','phase','timestamp','speaker_id','raw_speaker_label','raw_text','speaker_resolution']],
 ['review_issues','待核查',['issue_id','category','timestamps','description','handling','status','reviewer','resolution']],
 ['data_dictionary','字段说明',['table','field','type','description_zh','missing_value','example']]
];
const previews=path.join(out,'_previews');await fs.mkdir(previews,{recursive:true});
function letter(n){let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
for(const [key,name,first] of layouts){
 const rows=data[key];if(!rows.length)continue;const cols=[...first,...Object.keys(rows[0]).filter(c=>!first.includes(c))];
 const sh=wb.worksheets.add(name);sh.showGridLines=false;
 const matrix=[cols,...rows.map(r=>cols.map(c=>r[c]??''))];
 sh.getRangeByIndexes(0,0,matrix.length,cols.length).values=matrix;
 const all=sh.getRangeByIndexes(0,0,matrix.length,cols.length);
 all.format.font={name:'Arial',size:11,color:'#243650'};
 all.format.verticalAlignment='top';all.format.rowHeight=25;
 sh.freezePanes.freezeRows(1);sh.freezePanes.freezeColumns(2);
 sh.tables.add(`A1:${letter(cols.length-1)}${matrix.length}`,true,game+'_'+key);
 for(let c=0;c<cols.length;c++){
   const field=cols[c],rng=sh.getRangeByIndexes(0,c,matrix.length,1);
   const isLong=['raw_text','evidence_quote','notes','description','handling','description_zh','aliases','example'].includes(field);
   const wrap=isLong||['timestamps','utterance_ids','role_evidence','missing_value'].includes(field);
   rng.format.columnWidth=isLong?(field==='raw_text'?112:field==='evidence_quote'?76:60):wrap?32:Math.max(15,Math.min(30,field.length+3));
   if(wrap) rng.format.wrapText=true;
   if(rows.some(r=>typeof r[field]==='number')) sh.getRangeByIndexes(1,c,rows.length,1).setNumberFormat('0');
   if(field==='needs_review') sh.getRangeByIndexes(1,c,rows.length,1).conditionalFormats.add('cellIs',{operator:'equal',formula:1,format:{fill:'#FFF0CC',font:{color:'#885D00'}}});
 }
 const header=sh.getRangeByIndexes(0,0,1,cols.length);
 header.format.fill='#243650';header.format.font.color='#FFFFFF';header.format.font.bold=true;
 header.format.rowHeight=38;header.format.wrapText=true;header.format.verticalAlignment='center';header.format.horizontalAlignment='center';
 // Fit all long source quotes without truncation. Chinese glyphs occupy more width.
 for(let i=0;i<rows.length;i++){
   let lines=1;
   for(let c=0;c<cols.length;c++){
    const field=cols[c];if(!['raw_text','evidence_quote','notes','description','handling','description_zh','aliases','example','timestamps','utterance_ids','role_evidence','missing_value'].includes(field))continue;
    const width=field==='raw_text'?112:field==='evidence_quote'?76:['timestamps','utterance_ids','role_evidence','missing_value'].includes(field)?32:60;
    const v=String(rows[i][field]??'');
    const units=[...v].reduce((s,x)=>s+(x.charCodeAt(0)>255?2:1),0);
    lines=Math.max(lines,Math.ceil(units/(width*.85))+(v.match(/\n/g)||[]).length);
   }
   if(lines>1) sh.getRangeByIndexes(i+1,0,1,cols.length).format.rowHeight=Math.min(409,lines*17+10);
 }
}
wb.recalculate();
const previewKeys=new Set(process.argv.slice(3));
for(const [key,name] of [['info','使用说明'],...layouts.map(x=>[x[0],x[1]])]){
 if(previewKeys.size && !previewKeys.has(key)) continue;
 const range=key==='info'?'A1:B14': key==='relation_events'?'A1:I5': key==='utterances'?'A1:F8':key==='review_issues'?'A1:E5':'A1:F8';
 const blob=await wb.render({sheetName:name,range,scale:1,format:'png'});
 await fs.writeFile(path.join(previews,key+'.png'),new Uint8Array(await blob.arrayBuffer()));
}
console.log((await wb.inspect({kind:'table',range:'关系事件!A1:I5',include:'values,formulas',tableMaxRows:5,tableMaxCols:9,maxChars:2500})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:1500,summary:'Export error scan'})).ndjson);
const xlsx=await SpreadsheetFile.exportXlsx(wb);await xlsx.save(path.join(out,game+'_狼人杀关系网络数据.xlsx'));
console.log('Workbook exported: 11 sheets.');
