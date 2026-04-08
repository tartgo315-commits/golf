export const COMPARE_PRODUCTS_KEY = 'compare_products';

export type ProductCategory = '一号木' | '铁杆' | '杆身' | '握把';

export type ProductItem = {
  id: string;
  category: ProductCategory;
  brand: string;
  model: string;
  crowdTag: string;
  params: Record<string, string>;
  notes?: string;
};

export const PRODUCT_CATEGORIES: ProductCategory[] = ['一号木', '铁杆', '杆身', '握把'];

export const PRODUCT_DB: ProductItem[] = [
  {
    id: 'driver-ping-g430-max',
    category: '一号木',
    brand: 'Ping',
    model: 'G430 Max',
    crowdTag: '宽容',
    params: { 体积: '460cc', 杆面角: '10.5°', 重心: '深', 适合差点: '12+' },
    notes: '适合希望提升容错和击球稳定性的球手。',
  },
  {
    id: 'driver-taylormade-qi10',
    category: '一号木',
    brand: 'TaylorMade',
    model: 'Qi10',
    crowdTag: '距离',
    params: { 体积: '460cc', 杆面角: '9°', 重心: '中', 适合差点: '8-18' },
    notes: '兼顾速度与容错，适合追求距离的中差点球手。',
  },
  {
    id: 'driver-titleist-tsr3',
    category: '一号木',
    brand: 'Titleist',
    model: 'TSR3',
    crowdTag: '操控',
    params: { 体积: '450cc', 杆面角: '10°', 重心: '浅', 适合差点: '0-10' },
    notes: '反馈清晰，适合具备稳定挥杆的低差点球手。',
  },
  {
    id: 'driver-callaway-paradym',
    category: '一号木',
    brand: 'Callaway',
    model: 'Paradym',
    crowdTag: '宽容',
    params: { 体积: '460cc', 杆面角: '10.5°', 重心: '深', 适合差点: '10+' },
    notes: '上手友好，击球偏差时仍可保持较好距离。',
  },
  {
    id: 'driver-cobra-aerojet-ls',
    category: '一号木',
    brand: 'Cobra',
    model: 'Aerojet LS',
    crowdTag: '低旋',
    params: { 体积: '460cc', 杆面角: '9°', 重心: '前', 适合差点: '5-' },
    notes: '低旋转低弹道，适合挥速快且希望压旋转的球手。',
  },
  {
    id: 'driver-srixon-zx5-mk2',
    category: '一号木',
    brand: 'Srixon',
    model: 'ZX5 Mk II',
    crowdTag: '均衡',
    params: { 体积: '460cc', 杆面角: '10.5°', 重心: '中', 适合差点: '8-15' },
    notes: '各项性能均衡，适合希望一步到位的中差点球手。',
  },
  {
    id: 'shaft-ventus-blue-6s',
    category: '杆身',
    brand: 'Fujikura',
    model: 'Ventus Blue 6S',
    crowdTag: '中低弹道',
    params: { 重量: '63g', 旋转: '低旋', Kick点: '高', 手感: '硬实' },
  },
  {
    id: 'shaft-ventus-red-6s',
    category: '杆身',
    brand: 'Fujikura',
    model: 'Ventus Red 6S',
    crowdTag: '中高弹道',
    params: { 重量: '60g', 旋转: '中旋', Kick点: '低', 手感: '弹柔' },
  },
  {
    id: 'shaft-kaili-white-60s',
    category: '杆身',
    brand: 'Mitsubishi',
    model: "Kai'li White 60S",
    crowdTag: '中高弹道',
    params: { 重量: '60g', 旋转: '中旋', Kick点: '低', 手感: '弹射' },
  },
  {
    id: 'shaft-tour-ad-iz-6s',
    category: '杆身',
    brand: 'Mitsubishi',
    model: 'Tour AD IZ 6S',
    crowdTag: '低弹道',
    params: { 重量: '65g', 旋转: '极低旋', Kick点: '高', 手感: '稳定' },
  },
  {
    id: 'shaft-tensei-av-blue-65s',
    category: '杆身',
    brand: 'Mitsubishi',
    model: 'Tensei AV Blue 65S',
    crowdTag: '中弹道',
    params: { 重量: '65g', 旋转: '中旋', Kick点: '中', 手感: '全能' },
  },
  {
    id: 'shaft-dg-x100',
    category: '杆身',
    brand: 'True Temper',
    model: 'DG X100',
    crowdTag: '低弹道',
    params: { 重量: '130g', 旋转: '低旋', Kick点: '铁杆专用', 手感: '极硬' },
  },
  {
    id: 'shaft-kbs-tour-s',
    category: '杆身',
    brand: 'KBS',
    model: 'KBS Tour S',
    crowdTag: '中弹道',
    params: { 重量: '120g', 旋转: '中旋', Kick点: '铁杆专用', 手感: '稳定' },
  },
  {
    id: 'shaft-nspro-950',
    category: '杆身',
    brand: 'Nippon',
    model: 'NS Pro 950',
    crowdTag: '中高弹道',
    params: { 重量: '95g', 旋转: '中旋', Kick点: '铁杆专用', 手感: '轻弹' },
  },
  {
    id: 'iron-ping-i230',
    category: '铁杆',
    brand: 'Ping',
    model: 'i230',
    crowdTag: '操控',
    params: { 顶线: '薄顶线', 适合差点: '0-10', 重心: '低重心' },
  },
  {
    id: 'iron-callaway-apex',
    category: '铁杆',
    brand: 'Callaway',
    model: 'Apex',
    crowdTag: '宽容',
    params: { 顶线: '中厚顶线', 适合差点: '5-15', 重心: '低深重心' },
  },
  {
    id: 'iron-taylormade-p790',
    category: '铁杆',
    brand: 'TaylorMade',
    model: 'P790',
    crowdTag: '均衡',
    params: { 顶线: '中厚顶线', 适合差点: '5-15', 重心: '中空锻造' },
  },
  {
    id: 'iron-titleist-t200',
    category: '铁杆',
    brand: 'Titleist',
    model: 'T200',
    crowdTag: '均衡',
    params: { 顶线: '中等顶线', 适合差点: '5-12', 重心: '速度口袋' },
  },
  {
    id: 'grip-tour-velvet',
    category: '握把',
    brand: 'Golf Pride',
    model: 'Tour Velvet',
    crowdTag: '全天候',
    params: { 尺寸: 'Standard/Midsize', 重量: '50g', 特点: '经典' },
  },
  {
    id: 'grip-crossline',
    category: '握把',
    brand: 'Lamkin',
    model: 'Crossline',
    crowdTag: '防滑',
    params: { 尺寸: 'Standard/Midsize', 重量: '52g', 特点: '耐用' },
  },
  {
    id: 'grip-traxion',
    category: '握把',
    brand: 'SuperStroke',
    model: 'Traxion',
    crowdTag: '粗握把',
    params: { 尺寸: 'Midsize', 重量: '75g', 特点: '推杆专用' },
  },
];
