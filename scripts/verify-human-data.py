"""Verify source/CSV/JSON/GraphML and every saved workbook data cell."""
from pathlib import Path
import csv,hashlib,json,posixpath,re,zipfile,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]
SHEETS={'关系事件':'relation_events','投票':'votes','快照边列表':'network_edges','全部快照单元':'snapshot_dyads','玩家':'players','每日状态':'player_status','关键事件':'key_events','原始逐字稿':'utterances','待核查':'review_issues','字段说明':'data_dictionary'}

def verify(game):
    p=ROOT/'outputs'/f'{game}_SNA'
    if not p.exists():p=Path(__file__).resolve().parents[1]/'datasets/human'/game
    data=json.loads((p/'tables.json').read_text());meta=json.loads((p/'manifest.json').read_text())
    assert hashlib.sha256((p/'source'/meta['source_file']).read_bytes()).hexdigest()==meta['source_sha256']
    if (ROOT/meta['source_path']).exists():assert (ROOT/meta['source_path']).read_bytes()==(p/'source'/meta['source_file']).read_bytes()
    uids={u['utterance_id']:u for u in data['utterances']};ids={p['player_id'] for p in data['players']};assert len(ids)==12
    for name,rows in data.items():
        with (p/'csv'/f'{name}.csv').open(encoding='utf-8-sig',newline='') as f:csv_rows=list(csv.DictReader(f))
        assert len(csv_rows)==len(rows)
        for left,right in zip(csv_rows,rows):assert left=={k:str(v) for k,v in right.items()},(game,name)
    for r in data['relation_events']:
        assert r['source'] in ids and r['target'] in ids
        assert uids[r['utterance_id']]['raw_text'][r['evidence_char_start']:r['evidence_char_end']]==r['evidence_quote']
        if r['main_eligible']:assert r['source']!=r['target'] and r['assertion_mode']=='asserted' and r['phase'] in {'campaign','discussion'}
    for r in data['snapshot_dyads']:
        if not r['analysis_known_mask']:assert r['support']==r['suspect']==''
    ns={'g':'http://graphml.graphdrawing.org/xmlns'}
    for f in (p/'graphml').glob('*.graphml'):
        graph=ET.parse(f);day=int(re.search(r'day(\d+)',f.name)[1]);layer='support' if 'support' in f.name else 'suspect'
        assert len(graph.findall('.//g:node',ns))==12
        assert len(graph.findall('.//g:edge',ns))==sum(e['day']==day and e['Layer']==layer for e in data['network_edges'])
    n={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'};compared=0
    with zipfile.ZipFile(p/f'{game}_狼人杀关系网络数据.xlsx') as z:
        strings=[''.join(si.itertext()) for si in ET.fromstring(z.read('xl/sharedStrings.xml'))] if 'xl/sharedStrings.xml' in z.namelist() else []
        rels={r.attrib['Id']:r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        sheets=ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',n);assert len(sheets)==11
        for sheet in sheets:
            name=sheet.attrib['name']
            if name not in SHEETS:continue
            target=rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            filename=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join('xl',target))
            records={}
            for row in ET.fromstring(z.read(filename)).findall('m:sheetData/m:row',n):
                vals={}
                for cell in row.findall('m:c',n):
                    typ=cell.attrib.get('t','n');assert typ!='e',(game,name,cell.attrib['r'])
                    value=cell.find('m:v',n)
                    text=strings[int(value.text)] if typ=='s' and value is not None else ''.join(cell.find('m:is',n).itertext()) if typ=='inlineStr' else value.text if value is not None else ''
                    vals[re.match('[A-Z]+',cell.attrib['r'])[0]]=text
                records[int(row.attrib['r'])]=vals
            expected=data[SHEETS[name]];assert len(records)==len(expected)+1,(game,name)
            for i,row in enumerate(expected,2):
                for col,field in records[1].items():assert records[i].get(col,'')==str(row[field]),(game,name,i,field);compared+=1
    report={'game_id':game,'result':'PASS','counts':{k:len(v) for k,v in data.items()},'source_sha256':meta['source_sha256'],'xlsx_cells_compared_to_csv':compared,
      'checks':['unchanged original/source copy','all CSV and JSON fields identical','exact evidence offsets','valid game-scoped foreign keys','unobserved NA cells retained','GraphML matches daily edges','all saved workbook data cells match source tables'],
      'limits':['AI-assisted first-pass semantic coding; no independent human reliability certification','No source video reviewed for these new games','Ambiguous names, speakers, votes and identities retained in review issues']}
    (p/'validation_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(game,'PASS',compared,'saved workbook cells checked')

if __name__=='__main__':
    for game in ['H3','H6','H8']:verify(game)
