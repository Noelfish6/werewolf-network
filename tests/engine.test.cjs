const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/data.js'),'utf8').replace(/^window\.NETWORK_DATA=/,'').replace(/;\s*$/,''));
data.campaign_events=require('../dist/campaign-events.js');
const expectedEdges=JSON.parse(fs.readFileSync(path.join(__dirname,'expected-snapshots.json'),'utf8'));
let engine={};try{engine=require('../dist/engine.js');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
function ready(){assert.equal(typeof engine.buildFrames,'function','replay model must exist');return engine.buildFrames(data);}
test('all three pre-vote snapshots equal supplied research edges',()=>{
 const frames=ready();
 for(const day of [1,2,3]){
  const state=engine.stateAt(data,frames,engine.snapshotIndex(frames,day));
  const actual=state.edges.filter(e=>e.layer!=='vote').map(e=>[e.source,e.target,e.layer].join('|')).sort();
  const expected=expectedEdges.filter(e=>e.day===day).map(e=>[e.Source,e.Target,e.Layer].join('|')).sort();
  assert.deepEqual(actual,expected,`day ${day}`);
 }
});
test('scrubbing backwards and entering the next day cannot retain future stances',()=>{
 const frames=ready();const index=id=>frames.findIndex(f=>f.utterance_id===id);
 const late=engine.stateAt(data,frames,engine.snapshotIndex(frames,3));assert.ok(late.edges.length>0);
 const first=engine.stateAt(data,frames,index('H1-U004'));
 assert.deepEqual(first.edges.map(e=>[e.source,e.target,e.layer]),[['H1-P01','H1-P08','support']]);
 const day2=engine.stateAt(data,frames,index('H1-U051'));assert.deepEqual(day2.edges,[]);
});
test('undetermined replaces a prior direct stance and conditionals never become edges',()=>{
 const frames=ready();const i=frames.findIndex(f=>f.utterance_id==='H1-U034');const state=engine.stateAt(data,frames,i);
 assert.equal(state.edges.some(e=>e.source==='H1-P08'&&e.target==='H1-P06'),false);
 assert.equal(state.edges.some(e=>e.source==='H1-P01'&&e.target==='H1-P05'),true);
 const first=engine.stateAt(data,frames,frames.findIndex(f=>f.utterance_id==='H1-U004'));
 assert.equal(first.edges.some(e=>e.target==='H1-P05'),false);
});
test('ballots are separate, missing votes stay missing and self-votes are excluded',()=>{
 const frames=ready();const at=id=>engine.stateAt(data,frames,frames.findIndex(f=>f.utterance_id===id));
 const sheriff=at('H1-U017');assert.equal(sheriff.edges.filter(e=>e.layer==='vote').length,4);assert.equal(sheriff.ballot,'sheriff');
 const exile=at('H1-U048');assert.equal(exile.edges.filter(e=>e.layer==='vote').length,9);assert.equal(exile.ballot,'exile');
 const d2=at('H1-U077');assert.equal(d2.edges.filter(e=>e.layer==='vote').length,8);assert.equal(d2.edges.some(e=>e.layer==='vote'&&e.source==='H1-P11'),false);assert.ok(d2.notices.some(n=>n.includes('11')));
 const d3=at('H1-U097');assert.equal(d3.edges.filter(e=>e.layer==='vote').length,6);assert.equal(d3.edges.some(e=>e.source===e.target),false);
});
test('interviews and replays are excluded; roles respect the reveal switch',()=>{
 const frames=ready();assert.equal(frames.some(f=>['interview','replay','postgame','setup'].includes(f.phase)),false);
 const wolf=data.players.find(p=>p.seat===5);assert.equal(engine.roleLabel(wolf,false),'');assert.match(engine.roleLabel(wolf,true),/狼人.*已确认/);
 const unknown=data.players.find(p=>p.seat===2);assert.match(engine.roleLabel(unknown,true),/未知/);
});
test('final narrator identities are gated in both the speech and ballot evidence',()=>{
 const final=data.utterances.find(u=>u.utterance_id==='H1-U097');
 assert.equal(typeof engine.quoteForDisplay,'function','narrator privacy gate must exist');
 const hidden=engine.quoteForDisplay(final.raw_text,final.utterance_id,false);
 assert.equal(hidden.includes('十一号狼人'),false);assert.ok(hidden.includes('赛后解说已隐藏'));
 assert.ok(engine.quoteForDisplay(final.raw_text,final.utterance_id,true).includes('十一号狼人'));
 const vote=data.votes.find(v=>v.utterance_id===final.utterance_id);
 assert.equal(engine.quoteForDisplay(vote.evidence_quote,vote.utterance_id,false).includes('五号狼同伴'),false);
 const claim=data.utterances.find(u=>u.utterance_id==='H1-U032');
 assert.equal(engine.quoteForDisplay(claim.raw_text,claim.utterance_id,false),claim.raw_text);
});
test('sheriff election reveals registration and withdrawals only when observed',()=>{
 const frames=ready(),at=id=>engine.stateAt(data,frames,frames.findIndex(f=>f.utterance_id==='H1-'+id)).election;
 assert.ok(at('U003'),'election state must exist');
 assert.deepEqual(at('U003').candidates,['H1-P01','H1-P03','H1-P07','H1-P08','H1-P10','H1-P11','H1-P12']);
 assert.deepEqual(at('U003').withdrawn,[]);assert.equal(at('U003').winner,null);
 assert.deepEqual(at('U006').withdrawn,['H1-P07']);
 assert.deepEqual(at('U010').withdrawn,['H1-P07','H1-P10']);
 assert.deepEqual(at('U016').withdrawn,['H1-P07','H1-P10','H1-P12']);
 assert.equal(at('U016').winner,null);assert.deepEqual(at('U016').votes,[]);
 assert.deepEqual(at('U017').withdrawn,['H1-P07','H1-P08','H1-P10','H1-P12']);
 assert.deepEqual(at('U017').remaining,['H1-P01','H1-P03','H1-P11']);
 assert.equal(at('U017').winner,'H1-P11');
 assert.deepEqual(at('U017').votes.filter(v=>v.action==='vote').map(v=>[v.voter,v.target]),[['H1-P02','H1-P11'],['H1-P05','H1-P11'],['H1-P06','H1-P11'],['H1-P09','H1-P01']]);
 assert.deepEqual(at('U006').withdrawn,['H1-P07']);assert.equal(at('U006').winner,null);
});
test('sheriff persists across days while nomination follows the current day',()=>{
 const frames=ready(),at=id=>engine.stateAt(data,frames,frames.findIndex(f=>f.utterance_id==='H1-'+id));
 const d2=at('U051');assert.equal(d2.election.winner,'H1-P11');assert.equal(d2.election.nomination,null);assert.equal(d2.ballot,'');
 assert.equal(at('U047').election.nomination.target,'H1-P01');
 assert.equal(at('U076').election.nomination.target,'H1-P09');
 assert.equal(at('U096').election.nomination.target,'H1-P08');
});
test('withdrawals retain exact source evidence without assigning the unknown voice',()=>{
 const utterances=new Map(data.utterances.map(u=>[u.utterance_id,u]));
 for(const event of data.campaign_events){
  const u=utterances.get(event.utterance_id);assert.ok(u.raw_text.includes(event.evidence_quote));
  if(event.fact_status==='player_announced')assert.equal(event.actor,u.speaker_id);
 }
 assert.equal(data.campaign_events.find(e=>e.actor==='H1-P08').utterance_id,'H1-U017');
});
