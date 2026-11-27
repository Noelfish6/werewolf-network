"""Bundle four human games without videos or AI records; works offline."""
from pathlib import Path
import json
repo=Path(__file__).resolve().parents[1];root=repo.parent
core=['players','player_status','utterances','relation_events','votes','key_events','review_issues','campaign_events']
catalog=[dict(game_id='H1',title='第一期第一局',category='human',data=None)]
for game in ['H3','H6','H8']:
    file=root/f'outputs/{game}_SNA/web.json'
    if not file.exists():file=repo/'datasets/human'/game/'web.json'
    d=json.loads(file.read_text())
    keep={k:v for k,v in d.items() if not isinstance(v,list) or k in core or k=='redactions'}
    catalog.append(dict(game_id=game,title=d['title'],category='human',data=keep))
text='window.NETWORK_GAMES='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n'
text+='window.NETWORK_GAMES[0].data={...window.NETWORK_DATA,game_id:"H1",title:"第一期第一局",category:"human",day_count:3,duration_seconds:3307,campaign_events:window.CAMPAIGN_EVENTS||[]};\n'
(repo/'dist/catalog.js').write_text(text,encoding='utf-8')
print('Human catalog:',len(text.encode()),'bytes')
