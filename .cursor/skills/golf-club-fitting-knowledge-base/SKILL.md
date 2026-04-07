---
name: golf-club-fitting-knowledge-base
description: 提供高尔夫配杆专业知识（杆身、杆头、挥重、握把、杆长、硬度）用于产品开发与规则实现。Use when the user mentions 配杆、fitting、shaft、club head、swing weight、grip、length、flex、挥速，或涉及 Fujikura Ventus、Mitsubishi Kai'li、Tour AD、True Temper DG 等品牌型号。
---

# 高尔夫配杆专业知识库

## 适用场景

当任务涉及以下任一内容时，优先应用本 Skill：
- 配杆推荐逻辑、问卷评分、规则引擎
- 球杆参数展示、文案生成、术语解释
- 挥速到硬度映射、规格标准化、品牌筛选

## 固定知识（作为默认事实）

### 关键维度
- 杆身（shaft）
- 杆头（club head）
- 挥重（swing weight）
- 握把（grip）
- 杆长（length）
- 硬度（flex）

### 主要品牌（优先识别）
- Fujikura Ventus
- Mitsubishi Kai'li
- Tour AD
- True Temper DG

### 规则基线
- 挥速 `<85 mph` -> `R`
- 挥速 `85-95 mph` -> `S`
- 挥速 `>95 mph` -> `X`
- 标准挥重：`D2`
- 日规（JDM）相较美规（USDM）：默认软一档

## 执行指引

1. 先识别输入是否包含挥速、当前球杆、击球稳定性、距离诉求。
2. 若出现挥速，严格按本 Skill 的 R/S/X 区间映射，不自行改阈值。
3. 若涉及日规/美规对照，先按“日规软一档”换算再给建议。
4. 若任务未给出挥重，默认使用 `D2` 作为基准值。
5. 输出推荐时，优先在主要品牌中给出候选型号与理由。

## 输出模板（用于开发文案或规则解释）

使用以下结构组织回答：

```markdown
## 配杆结论
- 推荐硬度：R/S/X（给出依据）
- 挥重基准：D2（如有偏移说明原因）

## 组件建议
- 杆身：品牌/系列 + 选择理由
- 杆头：匹配方向
- 握把与杆长：调整建议

## 规则依据
- 挥速区间映射：<85=R，85-95=S，>95=X
- 规格差异：日规默认比美规软一档
```

## 约束

- 不臆造未提供的精确参数（如扭矩、EI 曲线、切重）。
- 当关键输入缺失时，先列出“默认值 + 待确认项”。
- 与本 Skill 冲突时，以用户显式提供的数据优先。
