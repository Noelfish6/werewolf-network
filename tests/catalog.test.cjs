const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('../dist/engine.js');
const datasetPath=(game,file)=>{const local=path.join(__dirname,`../../outputs/${game}_SNA`,file);return fs.existsSync(local)?local:path.join(__dirname,'../datasets/human',game,file);};
const window={};const context=vm.createContext({window});
for(const script of ['data.js','campaign-events.js','catalog.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist',script),'utf8'),context);
const games=JSON.parse(JSON.stringify(window.NETWORK_GAMES));
test('catalog contains only the four separately scoped human games',()=>{
 assert.deepEqual(games.map(g=>g.game_id),['H1','H3','H6','H8']);assert.ok(games.every(g=>g.category==='human'));
 for(const {game_id,data} of games){assert.equal(data.players.length,12);assert.ok(data.players.every(p=>p.player_id.startsWith(game_id+'-P')));}
});
for(const {game_id,data} of games.slice(1)){
 test(`${game_id}: a same-segment exile does not erase the reported ballot`,()=>{
  const a=JSON.parse(fs.readFileSync(datasetPath(game_id,'annotations.json'),'utf8'));
  for(const ballot of a.ballots){
   const uid=`${game_id}-U${String(ballot.u).padStart(3,'0')}`,rows=data.votes.filter(v=>v.utterance_id===uid);
   for(const [seat,target] of Object.entries(ballot.votes)){
    const row=rows.find(v=>v.voter===`${game_id}-P${seat.padStart(2,'0')}`);
    assert.equal(row.action,'vote',`${uid} voter ${seat}`);assert.equal(row.target,`${game_id}-P${String(target).padStart(2,'0')}`);
   }
   const matrix=fs.readFileSync(datasetPath(game_id,`matrices/${game_id}_day${ballot.day}_V_${ballot.ballot_type}_${ballot.ballot_round||1}.csv`),'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(r=>r.split(','));
   for(const row of rows.filter(v=>v.action==='vote'&&v.voter!==v.target)){
    const line=matrix.find(r=>r[0]===row.voter),column=matrix[0].indexOf(row.target);assert.equal(line[column],'1',`${uid} actual vote opportunity`);
   }
  }
 });
 test(`${game_id}: all public daily snapshots reconcile with research edges`,()=>{
  const expected=JSON.parse(fs.readFileSync(datasetPath(game_id,'tables.json'),'utf8')).network_edges;
  const frames=E.buildFrames(data);assert.equal(new Set(frames.map(f=>f.day)).size,data.day_count);
  for(const day of [...new Set(frames.map(f=>f.day))]){
   const state=E.stateAt(data,frames,E.snapshotIndex(frames,day,data));
   const edges=state.edges.filter(e=>e.layer!=='vote').map(e=>[e.source,e.target,e.layer].join('|')).sort();
   assert.deepEqual(edges,expected.filter(e=>e.day===day).map(e=>[e.Source,e.Target,e.Layer].join('|')).sort(),`${game_id} day ${day}`);
  }
 });
 test(`${game_id}: every replay frame has exact evidence, local ids and chronological deaths`,()=>{
  const frames=E.buildFrames(data),utterances=new Map(data.utterances.map(u=>[u.utterance_id,u]));let previousOut=new Set();
  for(let i=0;i<frames.length;i++){
   const state=E.stateAt(data,frames,i);assert.ok([...previousOut].every(id=>state.out.has(id)));previousOut=state.out;
   for(const e of state.edges){
    assert.ok(e.source.startsWith(game_id+'-P')&&e.target.startsWith(game_id+'-P'));assert.notEqual(e.source,e.target);
    const u=utterances.get(e.utterance_id);assert.ok(u.utterance_order<=state.frame.utterance_order);
    assert.ok(u.raw_text.includes(e.quote));if(e.layer!=='vote'){assert.equal(state.out.has(e.source),false);assert.equal(state.out.has(e.target),false);}
   }
  }
  for(const r of data.relation_events){const u=utterances.get(r.utterance_id);assert.equal(u.raw_text.slice(r.evidence_char_start,r.evidence_char_end),r.evidence_quote);}
  for(const r of data.redactions){const text=utterances.get(r.utterance_id).raw_text;assert.ok(text.includes(r.starts_at));assert.equal(E.quoteForDisplay(text,r.utterance_id,false,data).includes(r.starts_at),false);}
 });
}
test('self-explosion days do not invent exile votes and badge destruction persists',()=>{
 const h6=games.find(g=>g.game_id==='H6').data,h8=games.find(g=>g.game_id==='H8').data;
 assert.deepEqual([...new Set(h6.votes.filter(v=>v.ballot_type==='exile').map(v=>v.day))],[1,4]);
 assert.deepEqual([...new Set(h8.votes.filter(v=>v.ballot_type==='exile').map(v=>v.day))],[2]);
 const frames=E.buildFrames(h6),final=E.stateAt(h6,frames,frames.length-1);assert.equal(final.election.sheriff,null);assert.equal(final.election.winner,'H6-P07');
});
test('night-result-only days retain events without fabricating observed zero stances',()=>{
 for(const [game,days] of [['H3',[5]],['H8',[4,5]]]){
  const tables=JSON.parse(fs.readFileSync(datasetPath(game,'tables.json'),'utf8'));
  for(const day of days){const rows=tables.snapshot_dyads.filter(r=>r.day===day);
   assert.ok(rows.every(r=>r.analysis_known_mask===0&&r.opportunity_mask===0&&r.support===''&&r.suspect===''),`${game} day ${day} is unobserved`);
   assert.ok(rows.some(r=>r.cell_status==='NA_NO_DISCUSSION'));
  }
 }
});
test('speech praise, agreement with judgments and inspection plans are not identity edges',()=>{
 for(const [game,u,quote] of [['H3',7,'我觉得 1 号发言挺不错的'],['H6',64,'我这把可能我是自己是比较相信 1 号和 9 号的判断了'],['H6',11,'1 号你软站边，所以我才要查你。'],['H8',41,'我就轻轻的赞一下 7 号好不好？轻轻的赞一下。'],['H8',41,'我觉得 2 号跟一个 12 号的发言略显好，他们在分析局势'],['H8',50,'我觉得王师傅上轮的发言真的不好。']]){
  const rows=games.find(g=>g.game_id===game).data.relation_events.filter(r=>r.utterance_order===u&&r.evidence_quote===quote);
  assert.ok(rows.length);assert.ok(rows.every(r=>r.main_eligible===0),`${game} U${u} ${quote}`);
 }
 const direct=games.find(g=>g.game_id==='H3').data.relation_events.filter(r=>r.utterance_order===8&&r.relation==='support');assert.ok(direct.some(r=>r.main_eligible===1));
});
test('public badge and departure events always have a replayable source segment',()=>{
 for(const {game_id,data} of games){
  const frames=new Set(E.buildFrames(data).map(f=>f.utterance_id));
  for(const event of data.key_events.filter(k=>['sheriff_elected','sheriff_transfer','sheriff_badge_destroyed','night_death','exile','self_explosion','skill_death'].includes(k.event_type)))assert.ok(frames.has(event.utterance_id),`${game_id} ${event.event_type} ${event.utterance_id}`);
 }
});
