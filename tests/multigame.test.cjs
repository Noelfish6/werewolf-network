const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../dist/engine.js');
const h1=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../dist/data.js'),'utf8').replace(/^window\.NETWORK_DATA=/,'').replace(/;\s*$/,''));
const clone=()=>JSON.parse(JSON.stringify(h1).replaceAll('H1-','H8-'));
test('election candidate ids belong to the selected game',()=>{
 const d=clone(),frames=E.buildFrames(d),s=E.stateAt(d,frames,frames.findIndex(f=>f.utterance_id==='H8-U017'));
 assert.ok(s.election.candidates.includes('H8-P11'));assert.equal(s.election.candidates.some(id=>id.startsWith('H1-')),false);
});
test('explicit snapshot positions cover days without exile ballots',()=>{
 const d=clone();d.snapshot_utterances={'1':'H8-U015'};
 const frames=E.buildFrames(d);assert.equal(frames[E.snapshotIndex(frames,1,d)].utterance_id,'H8-U015');
});
test('new-game deaths become visible at the event and remove active relations',()=>{
 const d=clone();d.lifecycle_mode='events';d.key_events=[{utterance_id:'H8-U005',event_type:'skill_death',target:'H8-P08'}];
 const frames=E.buildFrames(d),at=id=>E.stateAt(d,frames,frames.findIndex(f=>f.utterance_id===id));
 assert.equal(at('H8-U004').out.has('H8-P08'),false);assert.equal(at('H8-U004').edges.some(e=>e.target==='H8-P08'),true);
 assert.equal(at('H8-U005').out.has('H8-P08'),true);assert.equal(at('H8-U005').edges.some(e=>e.target==='H8-P08'),false);
});
test('per-game final recap redaction preserves the preceding public result',()=>{
 const d=clone();d.redactions=[{utterance_id:'H8-U096',starts_at:'本轮游戏，狼人配置为'}];
 const quote='1号出局，狼人胜利。本轮游戏，狼人配置为3、7、8、9。';
 assert.equal(E.quoteForDisplay(quote,'H8-U096',false,d).includes('3、7、8、9'),false);
 assert.ok(E.quoteForDisplay(quote,'H8-U096',false,d).includes('狼人胜利'));
 assert.equal(E.quoteForDisplay(quote,'H8-U096',true,d),quote);
 assert.match(E.roleLabel({true_role:'guard',role_status:'inferred'},true),/守卫/);
 assert.match(E.roleLabel({true_role:'white_wolf_king',role_status:'confirmed'},true),/白狼王/);
});
test('election winner remains historical while the sheriff badge can transfer or be destroyed',()=>{
 const d=clone();d.key_events.push({event_type:'sheriff_transfer',utterance_id:'H8-U018',actor:'H8-P11',target:'H8-P04'});
 d.key_events.push({event_type:'sheriff_badge_destroyed',utterance_id:'H8-U019',actor:'H8-P04'});
 const frames=E.buildFrames(d),at=id=>E.stateAt(d,frames,frames.findIndex(f=>f.utterance_id===id)).election;
 assert.equal(at('H8-U018').winner,'H8-P11');assert.equal(at('H8-U018').sheriff,'H8-P04');assert.equal(at('H8-U019').sheriff,null);
});
