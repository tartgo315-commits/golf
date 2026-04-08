export const COMPARE_PRODUCTS_KEY = 'compare_products';

export type ProductCategory = '一号木' | '球道木' | '铁杆' | '挖起杆' | '推杆' | '杆身' | '握把';

export type ProductItem = {
  id: string;
  category: ProductCategory;
  brand: string;
  model: string;
  crowdTag: string;
  params: Record<string, string>;
  notes: string;
};

export const PRODUCT_CATEGORIES: ProductCategory[] = ['一号木', '球道木', '铁杆', '挖起杆', '推杆', '杆身', '握把'];

export const PRODUCT_DB: ProductItem[] = [
  { id: 'driver-ping-g430-max', category: '一号木', brand: 'Ping', model: 'G430 Max', crowdTag: '宽容', params: { 体积: '460cc', 杆面角: '10.5°', 重心: '深', 适合差点: '12+', 价格参考: '¥3200' }, notes: '适合差点偏高、希望提升容错和开球稳定性的球友。' },
  { id: 'driver-tm-qi10', category: '一号木', brand: 'TaylorMade', model: 'Qi10', crowdTag: '距离', params: { 体积: '460cc', 杆面角: '9°', 重心: '中', 适合差点: '8-18', 价格参考: '¥3800' }, notes: '适合追求球速与距离，同时希望保持一定容错。' },
  { id: 'driver-titleist-tsr3', category: '一号木', brand: 'Titleist', model: 'TSR3', crowdTag: '操控', params: { 体积: '450cc', 杆面角: '10°', 重心: '浅', 适合差点: '0-10', 价格参考: '¥4200' }, notes: '更偏向操控反馈，适合低差点和杆面控制能力较好的球手。' },
  { id: 'driver-callaway-paradym', category: '一号木', brand: 'Callaway', model: 'Paradym', crowdTag: '宽容', params: { 体积: '460cc', 杆面角: '10.5°', 重心: '深', 适合差点: '10+', 价格参考: '¥3500' }, notes: '上手友好，打点不稳定时仍可保持较好容错表现。' },
  { id: 'driver-cobra-aerojet-ls', category: '一号木', brand: 'Cobra', model: 'Aerojet LS', crowdTag: '低旋', params: { 体积: '460cc', 杆面角: '9°', 重心: '前', 适合差点: '5以下', 价格参考: '¥2800' }, notes: '低旋低弹道取向，适合挥速高、希望压低旋转的球手。' },
  { id: 'driver-srixon-zx5-mk2', category: '一号木', brand: 'Srixon', model: 'ZX5 MkII', crowdTag: '均衡', params: { 体积: '460cc', 杆面角: '10.5°', 重心: '中', 适合差点: '8-15', 价格参考: '¥2600' }, notes: '性能均衡，适合作为稳定长期主力开球杆头。' },

  { id: 'iron-ping-i230', category: '铁杆', brand: 'Ping', model: 'i230', crowdTag: '操控', params: { 顶线: '薄', 重心: '低', 适合差点: '0-10', 价格参考: '¥8500(5-PW)' }, notes: '反馈清晰、操控性强，适合击球稳定的球手。' },
  { id: 'iron-callaway-apex', category: '铁杆', brand: 'Callaway', model: 'Apex', crowdTag: '宽容', params: { 顶线: '中厚', 重心: '低深', 适合差点: '5-15', 价格参考: '¥7800' }, notes: '兼顾容错和手感，适合中差点日常下场。' },
  { id: 'iron-tm-p790', category: '铁杆', brand: 'TaylorMade', model: 'P790', crowdTag: '均衡', params: { 顶线: '中厚', 结构: '中空锻造', 适合差点: '5-15', 价格参考: '¥9200' }, notes: '距离和手感兼顾，适合希望升级性能的球友。' },
  { id: 'iron-titleist-t200', category: '铁杆', brand: 'Titleist', model: 'T200', crowdTag: '均衡', params: { 顶线: '中等', 结构: '速度口袋', 适合差点: '5-12', 价格参考: '¥8800' }, notes: '弹道和距离表现平衡，适合作为进阶铁杆组。' },
  { id: 'iron-mizuno-jpx923-hm', category: '铁杆', brand: 'Mizuno', model: 'JPX923 Hot Metal', crowdTag: '宽容', params: { 顶线: '厚', 适合差点: '15+', 结构: '高容错', 价格参考: '¥6500' }, notes: '适合差点偏高球手，强调容错与起球轻松。' },

  { id: 'shaft-ventus-blue-6s', category: '杆身', brand: 'Fujikura', model: 'Ventus Blue 6S', crowdTag: '中低弹道', params: { 重量: '63g', 旋转: '低旋', Kick: '高', 适合挥速: '90+' }, notes: '经典全能低旋杆身，稳定性优秀。' },
  { id: 'shaft-ventus-red-6s', category: '杆身', brand: 'Fujikura', model: 'Ventus Red 6S', crowdTag: '中高弹道', params: { 重量: '60g', 旋转: '中旋', Kick: '低', 适合挥速: '85-100' }, notes: '更容易起飞，适合希望提升发射角的球手。' },
  { id: 'shaft-kaili-white-60s', category: '杆身', brand: 'Mitsubishi', model: "Kai'li White 60S", crowdTag: '中高弹道', params: { 重量: '60g', 旋转: '中旋', Kick: '低', 适合挥速: '80-95' }, notes: '弹射感明显，节奏友好，适合中速挥杆。' },
  { id: 'shaft-tour-ad-iz-6s', category: '杆身', brand: 'Mitsubishi', model: 'Tour AD IZ 6S', crowdTag: '低弹道', params: { 重量: '65g', 旋转: '极低旋', Kick: '高', 适合挥速: '95+' }, notes: '抗扭稳定，适合挥速高且希望控旋转。' },
  { id: 'shaft-tensei-av-blue-65s', category: '杆身', brand: 'Mitsubishi', model: 'Tensei AV Blue 65S', crowdTag: '中弹道', params: { 重量: '65g', 旋转: '中旋', Kick: '中', 适合挥速: '85-100' }, notes: '均衡易上手，适合大多数中速球友。' },
  { id: 'shaft-aldila-ascent-blue-60s', category: '杆身', brand: 'Aldila', model: 'Ascent Blue 60S', crowdTag: '中弹道', params: { 重量: '62g', 旋转: '中旋', Kick: '中', 适合挥速: '80-95' }, notes: '重量友好，适合追求轻量与稳定平衡。' },
  { id: 'shaft-dg-x100', category: '杆身', brand: 'True Temper', model: 'DG X100', crowdTag: '低弹道', params: { 重量: '130g', 旋转: '低旋', 适合挥速: '100+', 适用: '铁杆' }, notes: '经典硬派钢杆身，适合高挥速和强出杆。' },
  { id: 'shaft-kbs-tour-s', category: '杆身', brand: 'KBS', model: 'Tour S', crowdTag: '中弹道', params: { 重量: '120g', 旋转: '中旋', 适合挥速: '90-105', 适用: '铁杆' }, notes: '中性弹道和手感，适合作为铁杆主流配置。' },
  { id: 'shaft-ns-pro-950-gh', category: '杆身', brand: 'Nippon', model: 'NS Pro 950 GH', crowdTag: '中高弹道', params: { 重量: '95g', 旋转: '中旋', 适合挥速: '75-95', 适用: '铁杆' }, notes: '轻量高弹道，适合中低挥速与减负需求。' },
  { id: 'shaft-dg-s200', category: '杆身', brand: 'True Temper', model: 'DG S200', crowdTag: '中低弹道', params: { 重量: '125g', 旋转: '低旋', 适合挥速: '90-100', 适用: '铁杆' }, notes: '稳定扎实，适合偏力量型铁杆节奏。' },

  { id: 'grip-tour-velvet', category: '握把', brand: 'Golf Pride', model: 'Tour Velvet', crowdTag: '全天候', params: { 尺寸: 'Standard/Midsize', 重量: '50g', 特点: '全天候', 价格参考: '¥45/个' }, notes: '最经典通用款，干湿环境都具备稳定抓握。' },
  { id: 'grip-crossline', category: '握把', brand: 'Lamkin', model: 'Crossline', crowdTag: '防滑耐用', params: { 尺寸: 'Standard/Midsize', 重量: '52g', 特点: '防滑耐用', 价格参考: '¥55/个' }, notes: '纹路明显，适合强调耐用和防滑表现。' },
  { id: 'grip-traxion-pistol', category: '握把', brand: 'SuperStroke', model: 'Traxion Pistol', crowdTag: '推杆专用', params: { 尺寸: 'Midsize', 重量: '75g', 特点: '推杆专用', 价格参考: '¥180/个' }, notes: '推杆端稳定性强，帮助降低手腕干扰。' },
  { id: 'grip-mcc-plus4', category: '握把', brand: 'Golf Pride', model: 'MCC Plus4', crowdTag: '中下手轻', params: { 尺寸: 'Standard/Midsize', 重量: '52g', 特点: '中下手轻', 价格参考: '¥65/个' }, notes: '下手段更厚，帮助放松握压与节奏控制。' },
];

export function getProductById(id: string) {
  return PRODUCT_DB.find((item) => item.id === id) || null;
}
