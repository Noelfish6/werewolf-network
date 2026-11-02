(() => {
 'use strict';
 const $=s=>document.querySelector(s), data=window.NETWORK_DATA, E=window.NetworkEngine;
 if(!window.d3||!data||!E){$('#inspector-content').textContent='页面资源未完整加载，请重新打开完整页面。';return;}
 const frames=E.buildFrames(data), playerById=new Map(data.players.map(p=>[p.player_id,p]));
 const frameIndex=new Map(frames.map((f,i)=>[f.utterance_id,i]));
 const frameOrder=new Map(data.utterances.map(u=>[u.utterance_id,Number(u.utterance_order)]));
 const phases={campaign:'警长竞选',sheriff_ballot:'警长投票',discussion:'公开讨论',exile_ballot:'放逐投票',last_words:'遗言',night_result:'夜间结果'};
 const words={support:'支持',suspect:'怀疑',vote:'投票给'};
 const colors={support:'var(--support)',suspect:'var(--suspect)',vote:'var(--vote)'};
 let cursor=E.snapshotIndex(frames,1), current, focus=null, selectedEdge=null, reveal=false, playing=false,timer=null;
 const visible={support:true,suspect:true,vote:true};
 const nodePosition=new Map(data.players.map(p=>{const angle=-Math.PI/2+(Number(p.seat)-1)*Math.PI/6;return[p.player_id,{x:430+263*Math.cos(angle),y:370+263*Math.sin(angle),angle}];}));
 const svg=d3.select('#network'), defs=svg.append('defs');
 for(const layer of Object.keys(colors)){
   defs.append('marker').attr('id','arrow-'+layer).attr('viewBox','0 0 10 10').attr('refX',9).attr('refY',5).attr('markerWidth',5.5).attr('markerHeight',5.5).attr('orient','auto')
     .append('path').attr('d','M0,0 L10,5 L0,10 Z').attr('fill',colors[layer]);
 }
 const graph=svg.append('g'),edgeLayer=graph.append('g').attr('class','edges');
 graph.append('circle').attr('class','orbit').attr('cx',430).attr('cy',370).attr('r',263);
 const center=graph.append('g').attr('aria-hidden','true');
 center.append('circle').attr('cx',430).attr('cy',370).attr('r',43).attr('fill','var(--bg)').attr('opacity',.93);
 center.append('text').attr('class','center-label').attr('x',430).attr('y',367);
 center.append('text').attr('class','center-subtitle').attr('x',430).attr('y',387);
 const nodeLayer=graph.append('g').attr('class','nodes');
 const zoom=d3.zoom().scaleExtent([.65,2.5]).on('zoom',event=>graph.attr('transform',event.transform));
 svg.call(zoom).on('dblclick.zoom',null);

 function name(id){const p=playerById.get(id);return p?`${p.seat}号 · ${p.display_name}`:'未识别玩家';}
 function seat(id){return playerById.get(id)?.seat||'?';}
 function quote(edge){return E.quoteForDisplay(edge.quote,edge.utterance_id,reveal);}
 function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
 function toast(text){const n=$('#toast');n.textContent=text;n.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>n.classList.remove('visible'),2300);}
 function shownEdges(){return current.edges.filter(e=>visible[e.layer]);}
 function relevant(edge){return !focus||edge.source===focus||edge.target===focus;}
 function choosePlayer(id){selectedEdge=null;focus=focus===id?null:id;render();}
 function chooseEdge(edge){selectedEdge=edge.id;render();}
 function keyActivate(event,fn){if(event.key==='Enter'||event.key===' '){event.preventDefault();fn();}}
 function curve(edge){
   const a=nodePosition.get(edge.source),b=nodePosition.get(edge.target),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
   const layerOffset={support:-12,suspect:6,vote:25}[edge.layer];
   const bow=Math.min(90,length*.15)+layerOffset;
   const x1=a.x+ux*28,y1=a.y+uy*28,x2=b.x-ux*30,y2=b.y-uy*30;
   const cx=(a.x+b.x)/2-uy*bow,cy=(a.y+b.y)/2+ux*bow;
   return `M${x1},${y1}Q${cx},${cy} ${x2},${y2}`;
 }
 function renderGraph(){
   const edges=shownEdges();
   const groups=edgeLayer.selectAll('g.edge').data(edges,e=>e.id).join(enter=>{
     const g=enter.append('g').attr('class','edge');
     g.append('path').attr('class','edge-visual');
     g.append('path').attr('class','edge-hit').attr('role','button')
       .on('click',(event,e)=>{event.stopPropagation();chooseEdge(e);})
       .on('keydown',(event,e)=>keyActivate(event,()=>chooseEdge(e)))
       .on('pointerenter',function(){d3.select(this.parentNode).select('.edge-visual').attr('opacity',1).attr('stroke-width',3);})
       .on('pointerleave',()=>styleEdges());
     g.append('title');return g;
   });
   groups.selectAll('path').attr('d',e=>curve(e));
   groups.select('.edge-visual').attr('stroke',e=>colors[e.layer]).attr('stroke-dasharray',e=>e.layer==='suspect'?'6 5':e.layer==='vote'?'1 5':null).attr('marker-end',e=>'url(#arrow-'+e.layer+')');
   groups.select('.edge-hit').attr('tabindex',e=>focus&&relevant(e)?0:-1).attr('aria-label',e=>`${seat(e.source)}号${words[e.layer]}${seat(e.target)}号，${e.timestamp}，查看原话`);
   groups.select('title').text(e=>`${name(e.source)} ${words[e.layer]} ${name(e.target)}\n${e.timestamp}：${quote(e)}`);
   const nodes=nodeLayer.selectAll('g.node').data(data.players,p=>p.player_id).join(enter=>{
     const g=enter.append('g').attr('class','node').attr('role','button').attr('tabindex',0)
       .on('click',(event,p)=>{event.stopPropagation();choosePlayer(p.player_id);})
       .on('keydown',(event,p)=>keyActivate(event,()=>choosePlayer(p.player_id)));
     g.append('circle').attr('class','speaker-halo').attr('r',32);
     g.append('circle').attr('class','seat-disc').attr('r',24);
     g.append('text').attr('class','seat-number').text(p=>p.seat);
     g.append('text').attr('class','player-name');g.append('text').attr('class','role-label');
     const out=g.append('g').attr('class','out-indicator').attr('transform','translate(18,18)');
     out.append('circle').attr('class','out-mark').attr('r',7);out.append('path').attr('class','out-cross').attr('d','M-2.5,-2.5 L2.5,2.5 M-2.5,2.5 L2.5,-2.5');
     g.append('title');return g;
   });
   nodes.attr('transform',p=>{const pos=nodePosition.get(p.player_id);return `translate(${pos.x},${pos.y})`;})
     .classed('selected',p=>p.player_id===focus).classed('is-out',p=>current.out.has(p.player_id))
     .attr('aria-pressed',p=>String(p.player_id===focus))
     .attr('aria-label',p=>name(p.player_id)+(current.out.has(p.player_id)?'，已出局':'')+(reveal?'，'+E.roleLabel(p,true):'')+'，聚焦关系');
   nodes.select('.speaker-halo').attr('visibility',p=>p.player_id===current.frame.speaker_id?'visible':'hidden');
   nodes.select('.out-indicator').attr('visibility',p=>current.out.has(p.player_id)?'visible':'hidden');
   nodes.select('.player-name').attr('x',p=>labelPosition(p).x).attr('y',p=>labelPosition(p).y).attr('text-anchor',p=>labelPosition(p).anchor).text(p=>p.display_name);
   nodes.select('.role-label').attr('x',p=>labelPosition(p).x).attr('y',p=>labelPosition(p).y+15).attr('text-anchor',p=>labelPosition(p).anchor).text(p=>E.roleLabel(p,reveal));
   nodes.select('title').text(p=>name(p.player_id)+(current.out.has(p.player_id)?' · 已出局':'')+(reveal?'\n'+E.roleLabel(p,true):''));
   center.select('.center-label').text(`第 ${current.day} 天`);
   center.select('.center-subtitle').text(`${12-current.out.size} 人在场`);
   $('#graph-empty').hidden=edges.some(relevant);
   if(!$('#graph-empty').hidden)$('#graph-empty').firstChild.textContent=focus?`${seat(focus)}号当前没有可见连线`:'当前没有可见连线';
   $('#clear-focus').hidden=!focus;
   $('#focus-summary').textContent=focus?`${name(focus)} · ${edges.filter(relevant).length} 条可见关系`:'点击玩家聚焦，点击连线查看原话';
   styleEdges();
 }
 function labelPosition(p){const a=nodePosition.get(p.player_id).angle,c=Math.cos(a),s=Math.sin(a);return{x:c*42,y:s*40+(s>-.2?4:0),anchor:Math.abs(c)<.1?'middle':c>0?'start':'end'};}
 function styleEdges(){
   edgeLayer.selectAll('.edge-visual').attr('opacity',e=>selectedEdge?(e.id===selectedEdge?1:.075):focus?(relevant(e)?.9:.045):e.layer==='vote'?.73:.43)
     .attr('stroke-width',e=>e.id===selectedEdge?3:focus&&relevant(e)?2.1:e.utterance_id===current.frame.utterance_id?2.2:e.layer==='vote'?1.8:1.3);
 }
 function speakerCard(id,meta){
   const p=playerById.get(id),card=el('div','speaker-card');
   const circle=el(p?'button':'span','mini-seat',p?p.seat:'·');
   if(p){circle.setAttribute('aria-label',`聚焦${name(id)}`);circle.addEventListener('click',()=>choosePlayer(id));}
   card.append(circle);const detail=el('div','speaker-meta');detail.append(el('strong','',p?name(id):meta||'主持'));
   if(p&&reveal)detail.append(el('span','role-info',E.roleLabel(p,true)));
   if(meta&&p)detail.append(el('p','',meta));card.append(detail);return card;
 }
 function sourceInfo(edge){
   const line=el('div','source-info');line.append(el('span','',edge.utterance_id));
   const jump=el('button','text-button',`跳到 ${edge.timestamp}`);jump.addEventListener('click',()=>{selectedEdge=null;seek(frameIndex.get(edge.utterance_id));});line.append(jump);return line;
 }
 function listEdges(parent,edges,title){
   const heading=el('div','section-label',title);heading.append(el('span','',`${edges.length} 条`));parent.append(heading);
   if(!edges.length){parent.append(el('p','empty-note','当前没有符合条件的关系。可打开其他图层，或查看另一段发言。'));return;}
   const list=el('div','evidence-list');
   for(const edge of edges){
     const button=el('button','evidence-item '+edge.layer);const line=el('span','edge-title');
     line.append(el('span','',`${seat(edge.source)}号`),el('span','edge-verb',words[edge.layer]),el('span','',`${seat(edge.target)}号`),el('time','',edge.timestamp));
     button.append(line,el('small','',quote(edge)));button.addEventListener('click',()=>chooseEdge(edge));list.append(button);
   }parent.append(list);
 }
 function renderInspector(){
   const content=$('#inspector-content');content.replaceChildren();
   const edge=selectedEdge?shownEdges().find(e=>e.id===selectedEdge):null;
   $('#clear-edge').hidden=!edge;
   if(edge){
     $('#inspector-title').textContent='关系证据';
     content.append(el('div','edge-kind '+edge.layer,words[edge.layer]+(edge.layer==='vote'?` · ${current.ballot==='sheriff'?'选警票':'放逐票'}`:' · 公开身份立场')));
     content.append(speakerCard(edge.source,`${words[edge.layer]} ${name(edge.target)}`));
     content.append(el('div','quote',quote(edge)),sourceInfo(edge));
     if(Number(edge.event.needs_review))content.append(el('div','notice',edge.event.notes||'这条记录存在指代或转写问题，建议结合原视频核查。'));
     if(edge.layer!=='vote')content.append(el('p','inspector-caption','这条连线表示玩家当时公开表达的立场，不能直接解释为真实内心，也不会因赛后身份而更改。'));
   }else if(focus){
     $('#inspector-title').textContent='玩家关系';
     content.append(speakerCard(focus,current.out.has(focus)?'当前已出局，座位仍保留':'当前仍在场'));
     if(!reveal)content.append(el('p','player-overview','身份信息已隐藏。需要赛后比较时，可开启右上方的赛后视角。'));
     const edges=shownEdges().filter(relevant);
     listEdges(content,edges.filter(e=>e.source===focus),'发出的关系');
     listEdges(content,edges.filter(e=>e.target===focus),'收到的关系');
   }else{
     $('#inspector-title').textContent='当前发言';
     const f=current.frame;
     content.append(speakerCard(f.speaker_id,`${f.timestamp} · ${phases[f.phase]||'公开发言'}`));
     if(!f.speaker_id)content.append(el('p','source-info',`${f.timestamp} · ${f.speaker_kind==='host'?'主持播报':'说话人未确认'}`));
     content.append(el('div','quote compact',E.quoteForDisplay(f.raw_text,f.utterance_id,reveal)));
     const si=el('div','source-info',`${f.utterance_id} · 原稿第 ${f.source_line_start} 行`);content.append(si);
     if(f.phase==='last_words')content.append(el('p','notice','遗言可阅读，但不更新此前投票前的关系快照。'));
     const now=shownEdges().filter(e=>e.utterance_id===f.utterance_id);
     if(now.length)listEdges(content,now,'本段形成的可见关系');
     else content.append(el('p','empty-note',f.phase==='night_result'?'新白天开始，关系已重置。':'本段未形成新的可见连线。下方保留当日此前的最新明确立场。'));
     const recent=shownEdges().filter(e=>e.utterance_id!==f.utterance_id).sort((a,b)=>frameOrder.get(b.utterance_id)-frameOrder.get(a.utterance_id)).slice(0,6);
     if(recent.length)listEdges(content,recent,'最近形成的关系');
   }
   for(const note of current.notices)content.append(el('p','notice',note));
 }
 const activity=d3.select('#activity'),scale=d3.scaleLinear().domain([0,frames.length-1]).range([8,1192]);
 const segments=d3.groups(frames,f=>Number(f.day));
 activity.selectAll('rect.day-segment').data(segments).join('rect').attr('class','day-segment')
   .attr('x',g=>scale(frames.indexOf(g[1][0]))).attr('y',39)
   .attr('width',g=>Math.max(2,scale(frames.indexOf(g[1].at(-1)))-scale(frames.indexOf(g[1][0])))).attr('height',3).attr('rx',1.5).attr('fill','var(--line)');
 activity.selectAll('text.day-label').data(segments).join('text').attr('class','day-label').attr('x',g=>scale(frames.indexOf(g[1][0]))).attr('y',53).attr('font-size',10).attr('fill','var(--muted)').text(g=>`第 ${g[0]} 天`);
 const counts=d3.rollup(data.relation_events.filter(r=>Number(r.main_eligible)===1),rs=>rs.length,r=>r.utterance_id);
 activity.selectAll('line.event-bar').data(frames).join('line').attr('class','event-bar').attr('x1',(f,i)=>scale(i)).attr('x2',(f,i)=>scale(i)).attr('y1',f=>34-Math.min(28,(counts.get(f.utterance_id)||0)*2+3)).attr('y2',34).attr('stroke',f=>f.phase.includes('ballot')?'var(--vote)':'var(--line)').attr('stroke-width',4).attr('stroke-linecap','round');
 const cursorLine=activity.append('line').attr('y1',0).attr('y2',43).attr('stroke','var(--primary)').attr('stroke-width',1.6);
 activity.on('click',event=>{const [x]=d3.pointer(event,activity.node());seek(Math.round(scale.invert(x)));});
 $('#timeline').max=frames.length-1;
 function render(){
   current=E.stateAt(data,frames,cursor);
   if(selectedEdge&&!shownEdges().some(e=>e.id===selectedEdge))selectedEdge=null;
   $('#day-heading').textContent=`第 ${current.day} 天`;
   const snapshot=cursor===E.snapshotIndex(frames,current.day);
   $('#phase-label').textContent=snapshot?'投票前快照':phases[current.frame.phase]||'公开发言';
   $('#graph-caption').textContent=current.ballot?`当天立场与${current.ballot==='sheriff'?'选警':'放逐'}票分别呈现，箭头指向被评价者。`:'累积至当前发言，保留当天每对玩家的最后明确立场。';
   for(const layer of Object.keys(visible))$('#'+layer+'-count').textContent=current.edges.filter(e=>e.layer===layer).length;
   $('#vote-label').textContent=current.ballot==='sheriff'?'选警票':current.ballot==='exile'?'放逐票':'投票';
   $('#frame-position').textContent=`${cursor+1} / ${frames.length} 段`;
   $('#current-time').textContent=current.frame.timestamp;
   $('#timeline').value=cursor;
   $('#timeline').setAttribute('aria-valuetext',`第${current.day}天，${current.frame.timestamp}，${phases[current.frame.phase]||'发言'}，第${cursor+1}段`);
   $('#previous').disabled=cursor===0;$('#next').disabled=cursor===frames.length-1;
   document.querySelectorAll('.day-button').forEach(b=>{b.classList.toggle('active',Number(b.dataset.day)===current.day);b.setAttribute('aria-pressed',String(Number(b.dataset.day)===current.day));});
   cursorLine.attr('x1',scale(cursor)).attr('x2',scale(cursor));
   renderGraph();renderInspector();
 }
 function pause(){playing=false;clearTimeout(timer);timer=null;$('#play span').textContent='播放';$('#play use').setAttribute('href','#i-play');$('#play').setAttribute('aria-label','播放后续发言');}
 function schedule(){clearTimeout(timer);if(!playing)return;timer=setTimeout(()=>{if(cursor>=frames.length-1){pause();toast('已到本局结束');return;}cursor++;selectedEdge=null;render();schedule();},1700/Number($('#speed').value));}
 function start(){if(cursor===frames.length-1)cursor=0;playing=true;$('#play span').textContent='暂停';$('#play use').setAttribute('href','#i-pause');$('#play').setAttribute('aria-label','暂停回放');render();schedule();}
 function seek(index){pause();cursor=Math.max(0,Math.min(frames.length-1,Math.round(Number(index)||0)));selectedEdge=null;render();}
 $('#play').addEventListener('click',()=>playing?pause():start());
 $('#previous').addEventListener('click',()=>seek(cursor-1));$('#next').addEventListener('click',()=>seek(cursor+1));
 $('#timeline').addEventListener('input',event=>seek(event.target.value));
 $('#speed').addEventListener('change',schedule);
 $('#restart').addEventListener('click',()=>{pause();cursor=0;selectedEdge=null;focus=null;start();});
 document.querySelectorAll('.day-button').forEach(button=>button.addEventListener('click',()=>seek(E.snapshotIndex(frames,Number(button.dataset.day)))));
 for(const layer of Object.keys(visible))$('#layer-'+layer).addEventListener('change',event=>{visible[layer]=event.target.checked;render();});
 $('#reveal-roles').addEventListener('change',event=>{reveal=event.target.checked;render();});
 $('#clear-focus').addEventListener('click',()=>{focus=null;selectedEdge=null;render();});
 $('#clear-edge').addEventListener('click',()=>{focus=null;selectedEdge=null;render();});
 $('#reset-view').addEventListener('click',()=>{svg.call(zoom.transform,d3.zoomIdentity);});
 svg.on('click.clear',event=>{if(event.target===svg.node()){focus=null;selectedEdge=null;render();}});
 document.addEventListener('keydown',event=>{
   if(event.target.closest('input,select,textarea,button,[role="button"],dialog')||$('#method-dialog').open)return;
   if(event.key===' '){event.preventDefault();playing?pause():start();}
   if(event.key==='ArrowLeft'){event.preventDefault();seek(cursor-1);}
   if(event.key==='ArrowRight'){event.preventDefault();seek(cursor+1);}
   if(event.key==='Escape'){focus=null;selectedEdge=null;render();}
 });
 const dialog=$('#method-dialog');$('#method-button').addEventListener('click',()=>dialog.showModal());$('#close-method').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 $('#export-svg').addEventListener('click',()=>{
   const clone=svg.node().cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','860');clone.setAttribute('height','740');
   const style=document.createElementNS('http://www.w3.org/2000/svg','style');
   style.textContent=':root{'+Array.from(['--bg','--ink','--muted','--primary','--support','--suspect','--vote','--line','--subtle','--dead','--white','--focus']).map(k=>k+':'+getComputedStyle(document.documentElement).getPropertyValue(k)+';').join('')+'}'+Array.from(document.styleSheets).flatMap(s=>{try{return Array.from(s.cssRules).map(r=>r.cssText);}catch{return[];}}).join('\n');
   clone.insertBefore(style,clone.firstChild);clone.querySelectorAll('.edge-hit').forEach(p=>p.remove());
   download(`H1_第${current.day}天_${current.frame.timestamp.replace(':','-')}.svg`,new XMLSerializer().serializeToString(clone),'image/svg+xml;charset=utf-8');toast('已下载当前网络图');
 });
 $('#download-edges').addEventListener('click',()=>{
   const rows=[['game_id','day','timestamp','source','target','layer','evidence_id'],...shownEdges().filter(relevant).map(e=>['H1',current.day,current.frame.timestamp,e.source,e.target,e.layer,e.event.event_id||e.event.vote_id])];
   download(`H1_第${current.day}天_当前边表.csv`,'\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8');toast('已下载当前可见关系');
 });
 render();pause();
 const narrow=window.matchMedia('(max-width:800px)');
 const resizeCanvas=()=>svg.attr('viewBox',narrow.matches?'80 45 700 650':'0 0 860 740');
 narrow.addEventListener('change',resizeCanvas);resizeCanvas();
})();
