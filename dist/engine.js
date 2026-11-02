(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NetworkEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function buildFrames(data){
    const exclude=new Set(['setup','interview','replay','postgame']);
    return data.utterances.filter(u=>Number(u.day)>0&&!exclude.has(u.phase))
      .sort((a,b)=>Number(a.utterance_order)-Number(b.utterance_order));
  }
  function snapshotIndex(frames,day){
    const ballot=frames.find(f=>Number(f.day)===Number(day)&&f.phase==='exile_ballot');
    let result=0;
    frames.forEach((f,i)=>{if(Number(f.day)===Number(day)&&(!ballot||Number(f.utterance_order)<Number(ballot.utterance_order)))result=i;});
    return result;
  }
  function stateAt(data,frames,index){
    index=Math.max(0,Math.min(frames.length-1,Math.round(Number(index)||0)));
    const frame=frames[index],day=Number(frame.day),order=Number(frame.utterance_order);
    const alive=new Set(data.player_status.filter(s=>Number(s.day)===day&&Number(s.alive_at_prevote)===1).map(s=>s.player_id));
    const latest=new Map(),edges=[],notices=[];
    const rows=data.relation_events.filter(r=>Number(r.day)===day&&Number(r.utterance_order)<=order&&Number(r.main_eligible)===1)
      .sort((a,b)=>Number(a.utterance_order)-Number(b.utterance_order)||Number(a.evidence_char_start)-Number(b.evidence_char_start));
    for(const r of rows){
      if(r.source===r.target||!alive.has(r.source)||!alive.has(r.target))continue;
      const k=r.source+'|'+r.target;
      if(r.relation==='retract_support'||r.relation==='retract_suspect'){
        if(latest.get(k)?.relation===r.relation.slice(8))latest.delete(k);
      }else latest.set(k,r);
    }
    for(const r of latest.values()){
      if(!['support','suspect'].includes(r.relation))continue;
      edges.push({id:r.relation+'|'+r.source+'|'+r.target,source:r.source,target:r.target,layer:r.relation,event:r,utterance_id:r.utterance_id,quote:r.evidence_quote,timestamp:r.timestamp});
    }
    const frameOrder=new Map(data.utterances.map(u=>[u.utterance_id,Number(u.utterance_order)]));
    const ballots=data.votes.filter(v=>Number(v.day)===day&&frameOrder.get(v.utterance_id)<=order);
    let ballot='';
    if(ballots.length){
      const last=ballots.reduce((a,b)=>frameOrder.get(a.utterance_id)>frameOrder.get(b.utterance_id)?a:b);
      ballot=last.ballot_type;
      for(const v of ballots.filter(v=>v.utterance_id===last.utterance_id)){
        if(v.action==='unreported')notices.push(Number(v.voter.slice(-2))+'号的投票未报告，未绘制。');
        if(v.action==='vote'&&v.voter===v.target){notices.push(Number(v.voter.slice(-2))+'号疑似自投，待核查，未绘制自环。');continue;}
        if(v.action!=='vote'||Number(v.is_valid)!==1||!v.target)continue;
        edges.push({id:'vote|'+v.voter+'|'+v.target,source:v.voter,target:v.target,layer:'vote',event:v,utterance_id:v.utterance_id,quote:v.evidence_quote,timestamp:v.timestamp});
      }
    }
    const out=new Set(data.players.filter(p=>!alive.has(p.player_id)).map(p=>p.player_id));
    for(const k of data.key_events){
      if(['exile','night_death'].includes(k.event_type)&&frameOrder.get(k.utterance_id)<=order&&k.target)out.add(k.target);
    }
    return {frame,index,day,edges,out,alive,ballot,notices,latest};
  }
  function roleLabel(player,reveal){
    if(!reveal)return '';
    const labels={seer:'预言家',witch:'女巫',hunter:'猎人',idiot:'白痴',werewolf:'狼人',villager:'平民'};
    if(player.true_role){return (labels[player.true_role]||player.true_role)+' · '+(player.role_status==='confirmed'?'已确认':'推定');}
    if(player.true_camp)return (player.true_camp==='wolf'?'狼人阵营':'好人阵营')+' · '+(player.camp_status==='confirmed'?'已确认':'推定');
    return '身份未知';
  }
  function quoteForDisplay(text,utteranceId,reveal){
    if(reveal||utteranceId!=='H1-U097')return text;
    const boundary=text.indexOf('在本轮游戏中');
    return boundary<0?text:text.slice(0,boundary).trim()+'\n\n〔赛后解说已隐藏，开启赛后视角查看。〕';
  }
  return {buildFrames,snapshotIndex,stateAt,roleLabel,quoteForDisplay};
});
