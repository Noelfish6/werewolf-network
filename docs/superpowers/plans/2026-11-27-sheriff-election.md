# Sheriff Election Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline.

**Goal:** 展示随时间线更新的警长竞选过程、状态及选警结果。
**Architecture:** 在独立的可追溯补充数据中记录4条退水事件；引擎合并已有关键事件与投票生成 election 状态，页面只负责呈现。
**Tech Stack:** D3.js、原生JS、Node测试、Python离线构建。
**Spec:** docs/superpowers/specs/2026-11-27-sheriff-election-design.md

## Global Constraints
- 不提前显示未来事实，未知说话人不强行指定。
- 不修改现有三层关系定义或研究快照。
- 维持离线单文件与GitHub Pages版本一致。

## Review Focus
- 退回竞选前不显示候选或当选者。
- 8号退水在主持汇总时才确认。
- 下一白天保留警长，选警票不混入放逐票。
- 零票候选、弃票及无投票资格区分清楚。
- 窄屏信息栏换行，不盖住关系图。

## Task 1: 回放状态与证据
- [x] 增加失败测试：报名、逐次退水、结果、回退、跨白天与提名。
- [x] 增加 dist/campaign-events.js；扩展 engine.stateAt 返回 election。
- [x] 运行全部 Node 测试并保持既有94条快照边一致。

## Task 2: 展示与交付
- [x] 添加可展开过程栏、节点标记、证据跳转、两个时间线入口。
- [x] 更新说明并构建离线文件，同步docs与outputs，打包源码。
- [x] 提交并推送现有公开站点，检查线上交互、移动布局及构建版本。

## Verification record
- Node测试9/9通过，原有94条研究快照边保持一致。
- 独立代码检查发现summary空格键被全局快捷键截获，已加入排除；线上验证空格展开不启动播放。
- 线上验证竞选起点、选警结果、12号退水原话跳转、跨白天警长保留、投票图层开关和默认身份隐藏。
- 390px窄屏无横向溢出；调整下半圈竞选文字位置并扩大SVG可见范围，避免昵称重叠或裁切。
- GitHub Pages应用版本4d1efbb已构建；离线版、docs与outputs文件完全一致。
