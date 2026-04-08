export type QuizType = 'driver' | 'iron' | 'fairway' | 'wedge' | 'putter';
export type Question = { id: string; title: string; options: { id: string; label: string }[] };

export const QUIZ_BANK: Record<QuizType, Question[]> = {
  driver: [
    { id: 'd1', title: '你的一号木最常见失误？', options: [{ id: 'right', label: '右曲' }, { id: 'left', label: '左曲' }, { id: 'thin', label: '打薄' }, { id: 'top', label: '打厚' }] },
    { id: 'd2', title: '你目前弹道高度？', options: [{ id: 'high', label: '偏高' }, { id: 'mid', label: '中等' }, { id: 'low', label: '偏低' }, { id: 'unstable', label: '不稳定' }] },
    { id: 'd3', title: '你更看重什么？', options: [{ id: 'forgiving', label: '容错' }, { id: 'distance', label: '距离' }, { id: 'control', label: '操控' }, { id: 'feel', label: '手感' }] },
    { id: 'd4', title: '你对杆身手感偏好？', options: [{ id: 'soft', label: '更顺滑' }, { id: 'neutral', label: '中性' }, { id: 'firm', label: '更扎实' }, { id: 'none', label: '无所谓' }] },
  ],
  iron: [
    { id: 'i1', title: '你铁杆纯击球（打甜）的频率？', options: [{ id: 'rare', label: '很少' }, { id: 'sometimes', label: '偶尔' }, { id: 'often', label: '经常' }, { id: 'stable', label: '非常稳定' }] },
    { id: 'i2', title: '站位时你更喜欢的杆头顶线？', options: [{ id: 'thick', label: '较厚偏易打' }, { id: 'mid', label: '中等' }, { id: 'thin', label: '薄接近刀背' }, { id: 'any', label: '无所谓' }] },
    { id: 'i3', title: '铁杆最常见的失误？', options: [{ id: 'right', label: '右曲' }, { id: 'left', label: '左曲' }, { id: 'thin', label: '打薄' }, { id: 'fat', label: '打厚' }] },
    { id: 'i4', title: '你最希望新铁杆带来什么？', options: [{ id: 'forgiving', label: '更宽容' }, { id: 'farther', label: '更远' }, { id: 'accurate', label: '更准' }, { id: 'feel', label: '更好手感' }] },
  ],
  fairway: [
    { id: 'f1', title: '你球道木主要从哪里打？', options: [{ id: 'fairway', label: '球道草地' }, { id: 'rough', label: '粗草区' }, { id: 'tee', label: '发球台' }, { id: 'all', label: '都有' }] },
    { id: 'f2', title: '典型弹道？', options: [{ id: 'high', label: '偏高' }, { id: 'low', label: '偏低' }, { id: 'mid', label: '中等' }, { id: 'unstable', label: '不稳定' }] },
    { id: 'f3', title: '最常见失误？', options: [{ id: 'right', label: '右曲' }, { id: 'left', label: '左曲' }, { id: 'thin', label: '打薄' }, { id: 'short', label: '距离不足' }] },
    { id: 'f4', title: '最希望改善？', options: [{ id: 'launch', label: '起飞容易' }, { id: 'distance', label: '距离更远' }, { id: 'stable', label: '弹道更稳' }, { id: 'spin', label: '侧旋更少' }] },
  ],
  wedge: [
    { id: 'w1', title: '主要用在什么距离？', options: [{ id: '100', label: '100码内' }, { id: '80', label: '80码内' }, { id: '60', label: '60码内' }, { id: 'sand', label: '沙坑专用' }] },
    { id: 'w2', title: '你的果岭周围短打？', options: [{ id: 'confident', label: '很自信' }, { id: 'normal', label: '一般' }, { id: 'unstable', label: '不稳定' }, { id: 'need', label: '需要改善' }] },
    { id: 'w3', title: '最常用杆面角？', options: [{ id: '52', label: '52°' }, { id: '56', label: '56°' }, { id: '60', label: '60°' }, { id: 'unknown', label: '不确定' }] },
    { id: 'w4', title: '最希望改善？', options: [{ id: 'distance', label: '距离控制' }, { id: 'spin', label: '旋转量' }, { id: 'sand', label: '沙坑表现' }, { id: 'consistency', label: '整体一致性' }] },
  ],
  putter: [
    { id: 'p1', title: '你的推击弧线？', options: [{ id: 'straight', label: '直线型' }, { id: 'arc-light', label: '轻微弧线' }, { id: 'arc-big', label: '明显弧线' }, { id: 'unknown', label: '不确定' }] },
    { id: 'p2', title: '常见失误？', options: [{ id: 'short', label: '推短' }, { id: 'long', label: '推长' }, { id: 'left', label: '偏左' }, { id: 'right', label: '偏右' }] },
    { id: 'p3', title: '偏好杆头形状？', options: [{ id: 'blade', label: '刀背型' }, { id: 'mallet', label: '大型槌头' }, { id: 'mid-mallet', label: '小型槌头' }, { id: 'any', label: '无所谓' }] },
    { id: 'p4', title: '最希望改善？', options: [{ id: 'distance', label: '距离感' }, { id: 'line', label: '方向感' }, { id: 'long', label: '长推' }, { id: 'short', label: '短推' }] },
  ],
};

export const TITLE_BY_TYPE: Record<QuizType, string> = {
  driver: '一号木问卷',
  iron: '铁杆问卷',
  fairway: '球道木问卷',
  wedge: '挖起杆问卷',
  putter: '推杆问卷',
};
