# Human Games Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for integration. Independent transcript annotation is delegated by game.

**Goal:** 整理三局人类逐字稿，并在现有关系图切换四局。
**Architecture:** 独立语义注释→通用可验证编译器→各局分析产物和静态catalog；现有D3页面按选择重建回放上下文。
**Tech Stack:** Python stdlib、D3.js、原生JS、Node内置测试、artifact-tool工作簿。
**Spec:** docs/superpowers/specs/2026-11-27-human-games-design.md

## Global Constraints
- 只处理人类H1/H3/H6/H8；不读或发布AI材料及视频。
- 保留源文与引文偏移；未知、推定与确认分离，不补齐缺失票。
- 保持H1三天94条研究快照边完全一致。
- 圆形布局、三层开关、逐段回放、赛后身份和竞选信息沿用。

## Review Focus
- 超过一小时的时间戳与多白天动态按钮。
- 混合说话人、跨局座位变化和未确认昵称。
- 自爆/带人/多夜结尾不能当成放逐票。
- 同段终局旁白隐藏及切局清空身份揭示。
- 切局不残留上一局连线、缩放、播放器或证据。

## Tasks
- [x] 三份独立完整语义编码，逐一核验引文和发言覆盖。
- [x] 编译器生成分析表、矩阵、GraphML、源副本、核查清单、manifest及工作簿。
- [x] 测试先行泛化回放引擎：命名空间、动态快照、时序死亡、终局隐私。
- [x] 接入四局选择器、动态时间线和各局竞选状态，构建离线与Pages文件。
- [x] 检查全部数据与H1回归，代码复核、线上发布及桌面/窄屏实测。

## Integration verification
- H3/H6/H8全部336段源文与引文匹配，新增工作簿58853个数据单元与CSV逐格一致。
- Node 28项通过，H1原有94条快照边不变；Python源解析测试通过。
- AI交叉检查将发言评价/判断认可/查验计划保守降级，原证据保留待人工核查。
- 修正同段“先投票后出局”的时序，保留被放逐者的真实投票及票矩阵机会。
- H3第5天、H8第4/5天没有公开讨论，标NA_NO_DISCUSSION，不制造观测零值。
- 33个表页预览完成；身份仅元数据开关揭示，同段终局旁白已设逐局边界。

## Browser verification
- 四局选择器及逐局玩家、3/5/4/5个白天已线上核对。
- 切局暂停播放器并清空身份揭示/焦点；H3第5天终局前缀可读，旁白身份默认隐藏。
- H6警徽作废的主持公告U057从误标setup修正为last_words，28项回归检查通过，31:52原话入口线上验证。
- H8选警票证据键盘入口、无公开讨论的第4/5天与终局隐藏通过。
- 390px窄屏无横向溢出；已恢复默认视口，桌面预览保存到outputs。
- Pages应用版本97450d2完成发布，与本地离线HTML字节一致；全部数据包不含视频或AI玩家材料。
