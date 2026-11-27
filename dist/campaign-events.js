// 补充程序性事件。仅描述公开退水，不编码为身份支持或怀疑。
// 时间戳由对应逐字稿段落提供；8号只在主持汇总时确认。
(function(root,factory){
 const events=factory();
 if(typeof module==='object'&&module.exports)module.exports=events;
 else root.CAMPAIGN_EVENTS=events;
})(typeof globalThis!=='undefined'?globalThis:this,function(){return [
 {event_type:'sheriff_withdrawal',actor:'H1-P07',utterance_id:'H1-U006',fact_status:'player_announced',evidence_quote:'新手吧，我看王师傅说的那么坚决，我退。'},
 {event_type:'sheriff_withdrawal',actor:'H1-P10',utterance_id:'H1-U010',fact_status:'player_announced',evidence_quote:'但是我现在不准备跳了，我准备退水。'},
 {event_type:'sheriff_withdrawal',actor:'H1-P12',utterance_id:'H1-U015',fact_status:'player_announced',evidence_quote:'我选择退水，过。'},
 {event_type:'sheriff_withdrawal',actor:'H1-P08',utterance_id:'H1-U017',fact_status:'host_confirmed',evidence_quote:'7 号、 8 号、 10 号、 12 号玩家退水',notes:'08:34的“退水”说话人未确认；以08:36主持汇总为8号退水的确认时点。'}
];});
