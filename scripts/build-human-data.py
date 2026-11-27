"""Compile reviewed-by-source semantic annotations; never infer relations from keywords."""
from pathlib import Path
import argparse,csv,hashlib,json,re,shutil,xml.etree.ElementTree as ET

REPO=Path(__file__).resolve().parents[1]
ROOT=REPO.parent
DEATHS={'night_death','exile','self_explosion','skill_death'}
PUBLIC={'campaign','discussion'}
EXCLUDED={'setup','interview','replay','postgame'}

def parse_source(text,game):
    pattern=r'發言人 \\\((\d+)\\\) ((?:\d{2}:)?\d{2}:\d{2})\n(.*?)(?=\n發言人|\Z)'
    rows=[]
    for i,m in enumerate(re.finditer(pattern,text,re.S),1):
        seconds=0
        for n in m[2].split(':'):seconds=seconds*60+int(n)
        line=text[:m.start()].count('\n')+1
        rows.append(dict(utterance_id=f'{game}-U{i:03}',game_id=game,utterance_order=i,timestamp=m[2],time_seconds=seconds,
          raw_speaker_label=int(m[1]),raw_text=m[3].strip(),source_line_start=line,source_line_end=line+m[0].strip().count('\n')))
    assert rows,'No transcript segments parsed'
    return rows

def compile_game(annotation):
    game=annotation['game_id'];out=ROOT/'outputs'/f'{game}_SNA'
    assert game in {'H3','H6','H8'},'H1 is preserved; AI is outside this build'
    source=ROOT/annotation['source_path']
    if not source.exists():source=REPO/'datasets/human'/game/'source'/Path(annotation['source_path']).name
    raw=source.read_text(encoding='utf-8')
    utterances=parse_source(raw,game);by_u={u['utterance_order']:u for u in utterances}
    pid=lambda n:f'{game}-P{int(n):02}' if n else ''
    uid=lambda n:f'{game}-U{int(n):03}'
    annotations={u['u']:u for u in annotation['utterances']}
    assert len(annotations)==len(annotation['utterances'])==len(utterances)
    assert set(annotations)==set(by_u),'Every original segment must be annotated exactly once'
    for n,u in by_u.items():
        a=annotations[n];speaker=a.get('speaker',0)
        assert 0<=speaker<=12
        u.update(day=a['day'],phase=a['phase'],speaker_id=pid(speaker),speaker_seat=speaker or '',speaker_kind=a['speaker_kind'],
          speaker_resolution='contextual' if speaker else 'host' if a['speaker_kind']=='host' else 'unresolved',
          public_prevote=int(a['phase'] in PUBLIC and bool(speaker)),coding_disposition='no_explicit_identity_relation',notes=a.get('notes',''))
    players=[]
    assert sorted(p['seat'] for p in annotation['players'])==list(range(1,13))
    for p in annotation['players']:
        role=p.get('true_role','');camp=p.get('true_camp','')
        players.append(dict(player_id=pid(p['seat']),game_id=game,seat=p['seat'],display_name=p['display_name'],
          aliases='|'.join(p.get('aliases',[])),name_status=p.get('name_status','contextual'),true_role=role,
          role_status=p.get('role_status','unknown'),true_camp=camp,camp_status=p.get('camp_status','unknown'),
          role_evidence='|'.join(uid(n) for n in p.get('role_evidence',[])),notes=p.get('notes','')))
    relations=[]
    for a in annotation['relations']:
        u=by_u[a['u']];quote=a['quote'];start=u['raw_text'].find(quote)
        assert start>=0 and quote,(game,a['u'],quote)
        source_seat=a.get('source',u['speaker_seat'])
        assert source_seat,(game,a['u'],'Unresolved speaker cannot form player relation')
        for target in a['targets']:
            assert 1<=target<=12
            mode=a.get('mode','asserted');r=a['relation'];notes=a.get('notes','')
            eligible=int(bool(u['public_prevote']) and mode=='asserted' and r in {'support','suspect','undetermined','retract_support','retract_suspect'} and source_seat!=target)
            relations.append(dict(event_id=f'{game}-R{len(relations)+1:04}',game_id=game,day=u['day'],phase=u['phase'],utterance_id=u['utterance_id'],
              utterance_order=u['utterance_order'],timestamp=u['timestamp'],time_seconds=u['time_seconds'],source=pid(source_seat),target=pid(target),relation=r,
              assertion_mode=mode,evidence_quote=quote,evidence_char_start=start,evidence_char_end=start+len(quote),source_line_start=u['source_line_start'],
              main_eligible=eligible,needs_review=int(bool(notes) or mode in {'ambiguous','alternative_set'}),coding_status='AI_first_pass',reviewer_decision='',notes=notes))
            u['coding_disposition']='relation_events_retained'
    events=[]
    for a in annotation['key_events']:
        u=by_u[a['u']];quote=a.get('quote',u['raw_text']);assert quote in u['raw_text'],(game,a['u'],quote)
        target=a.get('target',0)
        if a['event_type']=='self_explosion' and not target:target=a.get('actor',0)
        value='|'.join(map(str,a['candidates'])) if a.get('candidates') else a.get('value','')
        events.append(dict(key_event_id=f'{game}-K{len(events)+1:03}',game_id=game,day=u['day'],phase=u['phase'],timestamp=u['timestamp'],utterance_id=u['utterance_id'],
          event_type=a['event_type'],actor=pid(a.get('actor',0)),target=pid(target),value=value,fact_status=a.get('fact_status','player_claim'),
          evidence_quote=quote,source_line_start=u['source_line_start'],notes=a.get('notes','')))
    events.sort(key=lambda k:int(k['utterance_id'].split('U')[-1]))
    death_orders=[(int(k['utterance_id'].split('U')[-1]),k['target']) for k in events if k['event_type'] in DEATHS and k['target']]
    def alive_at(n):return {p['player_id'] for p in players}-{target for order,target in death_orders if order<=n}
    issues=[]
    def issue(category,us,description,handling):
        issues.append(dict(issue_id=f'{game}-Q{len(issues)+1:03}',category=category,utterance_ids='|'.join(uid(n) for n in us),
          timestamps='|'.join(by_u[n]['timestamp'] for n in us),description=description,handling=handling,status='open',reviewer='',resolution=''))
    for a in annotation.get('review_issues',[]):
        issue(a['category'],a['us'],a['description'],a['handling'])
        for field in ['status','reviewer','resolution']:
            if field in a:issues[-1][field]=a[field]
    for r in relations:
        if r['main_eligible'] and (r['source'] not in alive_at(r['utterance_order']) or r['target'] not in alive_at(r['utterance_order'])):
            r['main_eligible']=0;r['needs_review']=1;r['notes']+='；所指玩家在该段已公开出局，不进入在场玩家网络。'
    days=annotation['days'];assert [d['day'] for d in days]==list(range(1,len(days)+1))
    snapshots={str(d['day']):uid(d['snapshot_u']) for d in days}
    status=[]
    for d in days:
        day=d['day'];cutoff=d['snapshot_u'];start=min(u['utterance_order'] for u in utterances if u['day']==day)
        discussion=next((u['utterance_order'] for u in utterances if u['day']==day and u['phase']=='discussion'),cutoff)
        badge=[k for k in events if k['event_type'] in {'sheriff_elected','sheriff_transfer','sheriff_badge_destroyed'} and int(k['utterance_id'].split('U')[-1])<=cutoff]
        sheriff=''
        for k in badge:sheriff='' if k['event_type']=='sheriff_badge_destroyed' else k['target'] if k['event_type']=='sheriff_transfer' else k['actor']
        assert by_u[cutoff]['day']==day and by_u[cutoff]['phase'] not in EXCLUDED
        expected={pid(n) for n in d['out_before']};assert expected=={pid(n) for n in range(1,13)}-alive_at(start-1),(game,day,'out_before mismatch')
        for p in players:
            id=p['player_id'];alive=int(id in alive_at(cutoff))
            status.append(dict(game_id=game,day=day,player_id=id,alive_at_day_start=int(id in alive_at(start-1)),alive_at_discussion_start=int(id in alive_at(discussion)),
              alive_at_prevote=alive,can_speak=alive,can_vote=alive,observed_public_speech=int(any(u['day']==day and u['speaker_id']==id and u['phase'] in PUBLIC for u in utterances)),
              is_sheriff=int(sheriff==id),sheriff_weight='',notes=d.get('notes','')))
    votes=[]
    for ballot in annotation.get('ballots',[]):
        u=by_u[ballot['u']];eligible=set(ballot['eligible']);reported={int(k):v for k,v in ballot.get('votes',{}).items()};abstain=set(ballot.get('abstain',[]))
        ballot_alive=alive_at(ballot['u']-1) # host reports votes before the same-segment exile
        assert set(reported)<=eligible and abstain<=eligible and not set(reported)&abstain
        for n in range(1,13):
            actor=pid(n);target=pid(reported[n]) if n in reported else '';notes=ballot.get('notes','')
            action='not_alive' if actor not in ballot_alive else 'ineligible' if n not in eligible else 'vote' if target else 'abstain' if n in abstain else 'unreported'
            valid=1 if action in {'vote','abstain'} else '' if action=='unreported' else 0
            review=action=='unreported' or bool(notes)
            if action=='vote' and (target==actor or target not in ballot_alive):review=True;notes+='；疑似自投或指向已出局玩家，原票型保留待核查。'
            votes.append(dict(vote_id=f'{game}-V{len(votes)+1:03}',game_id=game,day=ballot['day'],ballot_type=ballot['ballot_type'],ballot_round=ballot.get('ballot_round',1),
              voter=actor,target=target,action=action,eligible=int(n in eligible and actor in ballot_alive),is_valid=valid,timestamp=u['timestamp'],utterance_id=u['utterance_id'],
              evidence_quote=u['raw_text'],vote_weight='',weight_status='unverified',needs_review=int(review),notes=notes))
        missing=sorted(eligible-set(reported)-abstain)
        if missing:issue('unreported_ballot',[ballot['u']],f'本次投票未报告座位：{missing}。','保留unreported；不补成弃票或推测投向。')
    dyads=[];edges=[]
    for d in days:
        day=d['day'];cutoff=d['snapshot_u'];alive=alive_at(cutoff);latest={}
        has_discussion=any(u['day']==day and u['phase'] in PUBLIC and u['speaker_id'] and u['utterance_order']<=cutoff for u in utterances)
        for r in sorted(relations,key=lambda r:(r['utterance_order'],r['evidence_char_start'])):
            if r['day']!=day or not r['main_eligible'] or r['utterance_order']>cutoff:continue
            pair=(r['source'],r['target'])
            if r['relation'].startswith('retract_'):
                if latest.get(pair,{}).get('relation')==r['relation'][8:]:latest.pop(pair)
            else:latest[pair]=r
        for a in players:
            for b in players:
                source_id=a['player_id'];target_id=b['player_id'];r=latest.get((source_id,target_id))
                reason='NA_SELF' if source_id==target_id else 'NA_OUT_SOURCE' if source_id not in alive else 'NA_OUT_TARGET' if target_id not in alive else 'NA_NO_DISCUSSION' if not has_discussion else 'NA_PENDING' if r and r['relation']=='undetermined' else 'OBSERVED'
                known=int(reason=='OBSERVED');support=int(bool(r and r['relation']=='support')) if known else '';suspect=int(bool(r and r['relation']=='suspect')) if known else ''
                dyads.append(dict(game_id=game,day=day,source=source_id,target=target_id,support=support,suspect=suspect,opportunity_mask=int(has_discussion and source_id!=target_id and source_id in alive and target_id in alive),
                  analysis_known_mask=known,cell_status=reason,last_event_id=r['event_id'] if r else '',last_utterance_id=r['utterance_id'] if r else '',last_relation=r['relation'] if r else '',is_provisional=1))
                for layer,value in [('support',support),('suspect',suspect)]:
                    if value==1:edges.append(dict(game_id=game,day=day,Source=source_id,Target=target_id,Type='Directed',Weight=1,Layer=layer,last_event_id=r['event_id']))
    tables=dict(players=players,player_status=status,utterances=utterances,relation_events=relations,votes=votes,key_events=events,review_issues=issues,snapshot_dyads=dyads,network_edges=edges)
    dictionary_source=ROOT/'outputs/H1_SNA/tables.json'
    if not dictionary_source.exists():dictionary_source=REPO/'datasets/human/H1/tables.json'
    dictionary=json.loads(dictionary_source.read_text())['data_dictionary']
    dictionary=[dict(r) for r in dictionary if r['field'] not in {'player_id'}]
    for r in dictionary:
        r['description_zh']=r['description_zh'].replace('H1-','game_id前缀-').replace('110段','全部段落').replace('共48行','按实际票型生成').replace('1至110','按原稿顺序').replace('1、2、3','从1递增')
        if r['table'] in tables and tables[r['table']] and r['field'] in tables[r['table']][0]:r['example']=str(tables[r['table']][0][r['field']])[:100]
        if r['field']=='timestamp':r['description_zh']='相对视频时间mm:ss或hh:mm:ss，不是日期时间。'
        if r['field']=='true_role':r['description_zh']='赛后角色：seer预言家、witch女巫、hunter猎人、idiot白痴、guard守卫、white_wolf_king白狼王、werewolf狼人、villager平民；空白未知。'
        if r['field']=='game_id':r['description_zh']='对局唯一ID，H1/H3/H6/H8对应四期人类玩家第一局；不可跨局合并座位。'
        if r['field']=='cell_status':r['description_zh']+='；NA_NO_DISCUSSION为仅夜间/终局公告、没有公开讨论机会的白天，不按观测零值分析。'
        if r['field']=='name_status' and any(p['name_status']=='user_confirmed' for p in players):r['description_zh']+='；user_confirmed为用户明确确认昵称。'
        if r['field']=='status' and any(q['status']=='resolved' for q in issues):r['description_zh']='open待核查；resolved已根据明确证据或用户确认解决，见reviewer/resolution。'
    existing={(r['table'],r['field']) for r in dictionary}
    for table,rows in tables.items():
        for field in rows[0] if rows else []:
            if (table,field) not in existing:dictionary.append(dict(table=table,field=field,type='string',description_zh={'alive_at_day_start':'当日首段之前已公开存活状态；死亡随事件推进，不提前透露。','player_id':'局内唯一玩家ID，游戏前缀加座位号。'}.get(field,field),missing_value='空字段；不自动填0',example=str(rows[0][field])[:100]))
    tables['data_dictionary']=dictionary
    for name,rows in tables.items():
        if rows:fields=list(rows[0])
        else:
            with (ROOT/f'outputs/H1_SNA/csv/{name}.csv').open(encoding='utf-8-sig') as f:fields=next(csv.reader(f))
        write_csv(out/'csv'/f'{name}.csv',rows,fields)
    for d in days:
        day=d['day'];lookup={(r['source'],r['target']):r for r in dyads if r['day']==day}
        for layer,column in [('S_support','support'),('D_suspect','suspect'),('M_opportunity','opportunity_mask'),('A_analysis_known','analysis_known_mask')]:
            rows=[{'source':a['player_id'],**{b['player_id']:lookup[a['player_id'],b['player_id']][column] if lookup[a['player_id'],b['player_id']][column]!='' else lookup[a['player_id'],b['player_id']]['cell_status'] for b in players}} for a in players]
            write_csv(out/'matrices'/f'{game}_day{day}_{layer}.csv',rows)
        for ballot in [b for b in annotation.get('ballots',[]) if b['day']==day]:
            vs={v['voter']:v for v in votes if v['utterance_id']==uid(ballot['u'])};rows=[]
            ballot_alive=alive_at(ballot['u']-1)
            registrations=[k for k in events if k['event_type']=='sheriff_candidates' and int(k['utterance_id'].split('U')[-1])<=ballot['u']]
            candidates={pid(n) for n in registrations[-1]['value'].split('|')} if registrations else set()
            candidates-={k['actor'] for k in events if k['event_type']=='sheriff_withdrawal' and int(k['utterance_id'].split('U')[-1])<=ballot['u']}
            for a in players:
                v=vs[a['player_id']];row={'source':a['player_id']}
                for b in players:
                    target_id=b['player_id']
                    val='NA_UNREPORTED' if v['action']=='unreported' else 'NA_OUT_SOURCE' if v['action']=='not_alive' else 'NA_INELIGIBLE' if v['action']=='ineligible' else 'NA_SELF_REVIEW' if v['voter']==target_id and v['target']==target_id else 'NA_SELF' if v['voter']==target_id else 'NA_OUT_TARGET' if target_id not in ballot_alive else 'NA_NOT_CANDIDATE' if ballot['ballot_type']=='sheriff' and target_id not in candidates else int(v['target']==target_id)
                    row[target_id]=val
                rows.append(row)
            write_csv(out/'matrices'/f'{game}_day{day}_V_{ballot["ballot_type"]}_{ballot.get("ballot_round",1)}.csv',rows)
        for layer in ['support','suspect']:
            ns='http://graphml.graphdrawing.org/xmlns';ET.register_namespace('',ns);tree=ET.Element(f'{{{ns}}}graphml')
            for key,scope,kind in [('label','node','string'),('camp','node','string'),('camp_status','node','string'),('alive','node','int'),('event_id','edge','string'),('weight','edge','int')]:ET.SubElement(tree,f'{{{ns}}}key',id=key,**{'for':scope,'attr.name':key,'attr.type':kind})
            graph=ET.SubElement(tree,f'{{{ns}}}graph',id=f'{game}_D{day}_{layer}',edgedefault='directed')
            for p in players:
                node=ET.SubElement(graph,f'{{{ns}}}node',id=p['player_id'])
                for k,v in {'label':f'{p["seat"]}号 {p["display_name"]}','camp':p['true_camp'] or 'unknown','camp_status':p['camp_status'],'alive':int(p['player_id'] in alive_at(d['snapshot_u']))}.items():ET.SubElement(node,f'{{{ns}}}data',key=k).text=str(v)
            for e in edges:
                if e['day']==day and e['Layer']==layer:
                    node=ET.SubElement(graph,f'{{{ns}}}edge',source=e['Source'],target=e['Target']);ET.SubElement(node,f'{{{ns}}}data',key='event_id').text=e['last_event_id'];ET.SubElement(node,f'{{{ns}}}data',key='weight').text='1'
            path=out/'graphml'/f'{game}_day{day}_{layer}.graphml';path.parent.mkdir(exist_ok=True);ET.ElementTree(tree).write(path,encoding='utf-8',xml_declaration=True)
    (out/'source').mkdir(exist_ok=True);shutil.copyfile(source,out/'source'/source.name)
    redactions=[{'utterance_id':uid(r['u']),'starts_at':r['starts_at']} for r in annotation.get('redactions',[])]
    for r in redactions:assert r['starts_at'] in by_u[int(r['utterance_id'].split('U')[-1])]['raw_text']
    meta=dict(game_id=game,title=annotation['title'],category='human',day_count=len(days),duration_seconds=annotation['duration_seconds'],
      source_file=source.name,source_path=annotation['source_path'],source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
      coding_status='AI_first_pass_not_independently_validated',source_video_reviewed=False,lifecycle_mode='events',snapshot_utterances=snapshots,redactions=redactions)
    if annotation.get('name_confirmations'):meta['name_confirmations']=annotation['name_confirmations']
    web={**meta,**tables,'campaign_events':[k for k in events if k['event_type']=='sheriff_withdrawal']}
    manifest={**meta,'counts':{k:len(v) for k,v in tables.items()},'checks':['Every source segment preserved','All quote offsets verified','All player ids game-scoped','No inferred missing ballots','No main self-loops','Unknown identity statuses retained']}
    for filename,obj in [('tables.json',tables),('web.json',web),('manifest.json',manifest)]:
        (out/filename).write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    (out/'使用说明与编码规则.txt').write_text(f'''{annotation['title']}（{game}）公开关系网络数据\nAI辅助首轮语义编码，未完成独立人工复核。原始视频不在项目内，本次只依据逐字稿。\n原文全部{len(utterances)}段保留，按主持昼夜划分{len(days)}个白天。\n支持/怀疑为明确身份立场，条件、逻辑认可、集合猜测和行动建议保留在事件表但不自动绘图。\n表格、矩阵与GraphML使用局内ID，不能把不同局相同座位视为同一玩家。\n快照位置见manifest.snapshot_utterances：通常为实际投票或自爆前最后一次公开发言；仅夜间结尾的白天保留结果帧。\n当日最后明确立场取代此前立场，跨白天重置。不可观察/出局/未定单元保留NA。仅夜间/终局公告、没有公开讨论的白天标为NA_NO_DISCUSSION，不生成观测零值。\n新增局存活状态随公开死亡事件更新；不在实际公布前透露死亡。\n选警和放逐票分开，不生成自爆当天不存在的票型；未报告、弃票、无资格分别标注，票权未经确认留空。\n角色声称不等于真实身份；确认、推定、未知分别记录，具体疑点见review_issues。\n原文SHA256：{meta['source_sha256']}\n''',encoding='utf-8')
    return manifest

def write_csv(path,rows,fields=None):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields or list(rows[0]));w.writeheader();w.writerows(rows)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('games',nargs='*',default=['H3','H6','H8']);args=parser.parse_args()
    for game in args.games:
        path=ROOT/'outputs'/f'{game}_SNA/annotations.json'
        if not path.exists():path=REPO/'datasets/human'/game/'annotations.json'
        a=json.loads(path.read_text());m=compile_game(a);print(game,json.dumps(m['counts']))
if __name__=='__main__':main()
