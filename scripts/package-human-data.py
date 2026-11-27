"""Snapshot the four human analysis datasets for repo and local delivery (no video)."""
from pathlib import Path
import csv,json,shutil,zipfile
REPO=Path(__file__).resolve().parents[1];ROOT=REPO.parent;OUTPUT=ROOT/'outputs'
index=[]
for game,title in [('H1','第一期第一局'),('H3','第三期第一局'),('H6','第六期第一局'),('H8','第八期第一局')]:
    source=OUTPUT/f'{game}_SNA';dest=REPO/'datasets/human'/game;dest.mkdir(parents=True,exist_ok=True)
    meta=json.loads((source/'manifest.json').read_text());tables=json.loads((source/'tables.json').read_text())
    for item in ['csv','matrices','graphml']:
        shutil.copytree(source/item,dest/item,dirs_exist_ok=True)
    for name in ['annotations.json','tables.json','web.json','manifest.json','validation_report.json','使用说明与编码规则.txt',f'{game}_狼人杀关系网络数据.xlsx']:
        if (source/name).is_file():shutil.copyfile(source/name,dest/name)
    (dest/'source').mkdir(exist_ok=True);shutil.copyfile(source/'source'/meta['source_file'],dest/'source'/meta['source_file'])
    if (source/'evidence').is_dir():shutil.copytree(source/'evidence',dest/'evidence',dirs_exist_ok=True)
    row={'game_id':game,'category':'human','title':title,'day_count':meta['day_count'],'utterances':len(tables['utterances']),'relation_events':len(tables['relation_events']),
         'snapshot_edges':len(tables['network_edges']),'ballot_records':len(tables['votes']),'review_issues':len(tables['review_issues']),'source_sha256':meta['source_sha256'],'coding_status':meta['coding_status']}
    index.append(row)
    with zipfile.ZipFile(OUTPUT/f'{game}_狼人杀关系网络数据包.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(dest.rglob('*')):
            if file.is_file():archive.write(file,Path(f'{game}_SNA')/file.relative_to(dest))
base=REPO/'datasets/human';(base/'index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2))
with (base/'index.csv').open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=list(index[0]));w.writeheader();w.writerows(index)
(base/'README.txt').write_text('四局人类玩家数据：H1第一期、H3第三期、H6第六期、H8第八期，均为第一局。\n各局12个座位仅在本局内对应同一玩家，不能直接按座位跨局合并。\n原始Markdown副本、语义注释（新增三局）、研究表、矩阵、GraphML、工作簿及核查记录完整保存。AI材料和视频未纳入。\n仅夜间/终局公告而无公开讨论的白天保留结果事件，身份网络标NA_NO_DISCUSSION；不能按观测零值分析。\nAI辅助首轮编码与交叉检查，不等于独立人工编码信度验证。疑点见各局review_issues。\n',encoding='utf-8')
with zipfile.ZipFile(OUTPUT/'人类玩家_四局关系网络数据包.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(base.rglob('*')):
        if file.is_file():archive.write(file,Path('人类玩家四局')/file.relative_to(base))
print(json.dumps(index,ensure_ascii=False))
