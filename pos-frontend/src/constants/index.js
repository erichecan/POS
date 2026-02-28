// 2026-02-28: 中餐正餐演示 - 与后端 seed 菜单一致
import butterChicken from '../assets/images/butter-chicken-4.jpg';
import palakPaneer from '../assets/images/Saag-Paneer-1.jpg';
import biryani from '../assets/images/hyderabadibiryani.jpg';
import masalaDosa from '../assets/images/masala-dosa.jpg';
import choleBhature from '../assets/images/chole-bhature.jpg';
import rajmaChawal from '../assets/images/rajma-chawal-1.jpg';
import paneerTikka from '../assets/images/paneer-tika.webp';
import gulabJamun from '../assets/images/gulab-jamun.webp';
import pooriSabji from '../assets/images/poori-sabji.webp';
import roganJosh from '../assets/images/rogan-josh.jpg';

const SPICE_LEVEL_GROUP = {
  id: "spice_level",
  name: "辣度",
  type: "single",
  required: false,
  options: [
    { id: "spice_none", name: "不辣", priceDelta: 0, defaultSelected: true },
    { id: "spice_light", name: "微辣", priceDelta: 0 },
    { id: "spice_medium", name: "中辣", priceDelta: 0 },
    { id: "spice_hot", name: "重辣", priceDelta: 0 },
  ],
};

const PORTION_SIZE_GROUP = {
  id: "portion_size",
  name: "规格",
  type: "single",
  required: true,
  options: [
    { id: "size_small", name: "小份", priceDelta: -20 },
    { id: "size_regular", name: "标准", priceDelta: 0, defaultSelected: true },
    { id: "size_large", name: "大份", priceDelta: 35 },
  ],
};

const OIL_LEVEL_GROUP = {
  id: "oil_level",
  name: "油量",
  type: "single",
  required: false,
  options: [
    { id: "oil_less", name: "少油", priceDelta: 0 },
    { id: "oil_normal", name: "正常", priceDelta: 0, defaultSelected: true },
    { id: "oil_more", name: "多油", priceDelta: 0 },
  ],
};

const COOKING_STYLE_GROUP = {
  id: "cooking_style",
  name: "做法",
  type: "single",
  required: false,
  options: [
    { id: "style_default", name: "默认做法", priceDelta: 0, defaultSelected: true },
    { id: "style_stir_fry", name: "清炒", priceDelta: 0 },
    { id: "style_dry_pot", name: "干锅", priceDelta: 10 },
    { id: "style_soup", name: "带汤汁", priceDelta: 5 },
  ],
};

const ADD_ON_GROUP = {
  id: "add_on",
  name: "加料",
  type: "multi",
  required: false,
  maxSelect: 3,
  options: [
    { id: "addon_egg", name: "加蛋", priceDelta: 20 },
    { id: "addon_tofu", name: "加豆腐", priceDelta: 30 },
    { id: "addon_rice", name: "加米饭", priceDelta: 15 },
  ],
};

export const popularDishes = [
    { id: 1, image: butterChicken, name: '红烧肉', numberOfOrders: 185 },
    { id: 2, image: palakPaneer, name: '宫保鸡丁', numberOfOrders: 210 },
    { id: 3, image: biryani, name: '扬州炒饭', numberOfOrders: 168 },
    { id: 4, image: masalaDosa, name: '糖醋里脊', numberOfOrders: 142 },
    { id: 5, image: choleBhature, name: '珍珠奶茶', numberOfOrders: 265 },
    { id: 6, image: rajmaChawal, name: '酸梅汤', numberOfOrders: 198 },
    { id: 7, image: paneerTikka, name: '夫妻肺片', numberOfOrders: 156 },
    { id: 8, image: gulabJamun, name: '杨枝甘露', numberOfOrders: 132 },
    { id: 9, image: pooriSabji, name: '小笼包', numberOfOrders: 175 },
    { id: 10, image: roganJosh, name: '清蒸鲈鱼', numberOfOrders: 148 },
  ];


// 2026-02-28: 桌位展示（后端 Table 为真实数据，此处为前端静态占位）
export const tables = [
    { id: 1, name: "1号桌", status: "Booked", initial: "张", seats: 4 },
    { id: 2, name: "2号桌", status: "Available", initial: "李", seats: 6 },
    { id: 3, name: "3号桌", status: "Booked", initial: "王", seats: 2 },
    { id: 4, name: "4号桌", status: "Available", initial: "陈", seats: 4 },
    { id: 5, name: "5号桌", status: "Booked", initial: "刘", seats: 3 },
    { id: 6, name: "6号桌", status: "Available", initial: "赵", seats: 4 },
    { id: 7, name: "7号桌", status: "Booked", initial: "周", seats: 5 },
    { id: 8, name: "8号桌", status: "Available", initial: "吴", seats: 5 },
    { id: 9, name: "9号桌", status: "Booked", initial: "郑", seats: 6 },
    { id: 10, name: "10号桌", status: "Available", initial: "孙", seats: 6 },
    { id: 11, name: "11号桌", status: "Booked", initial: "黄", seats: 4 },
    { id: 12, name: "12号桌", status: "Available", initial: "林", seats: 6 },
    { id: 13, name: "13号桌", status: "Booked", initial: "何", seats: 2 },
    { id: 14, name: "14号桌", status: "Available", initial: "钱", seats: 6 },
    { id: 15, name: "15号桌", status: "Booked", initial: "冯", seats: 3 }
  ];
  
// 2026-02-28: 凉菜 - 与后端 seed 一致
export const startersItem = [
    { id: 1, name: "夫妻肺片", price: 38, category: "凉菜", optionGroups: [PORTION_SIZE_GROUP, SPICE_LEVEL_GROUP] },
    { id: 2, name: "蒜泥黄瓜", price: 18, category: "凉菜" },
    { id: 3, name: "口水鸡", price: 42, category: "凉菜", optionGroups: [PORTION_SIZE_GROUP, SPICE_LEVEL_GROUP] },
    { id: 4, name: "凉拌木耳", price: 22, category: "凉菜" },
    { id: 5, name: "皮蛋豆腐", price: 28, category: "凉菜" },
  ];
  
// 2026-02-28: 热菜 - 与后端 seed 一致
export const mainCourse = [
  { id: 1, name: "宫保鸡丁", price: 48, category: "热菜", optionGroups: [PORTION_SIZE_GROUP, SPICE_LEVEL_GROUP] },
  { id: 2, name: "糖醋里脊", price: 52, category: "热菜" },
  { id: 3, name: "红烧肉", price: 58, category: "热菜" },
  { id: 4, name: "清蒸鲈鱼", price: 88, category: "热菜" },
  { id: 5, name: "麻婆豆腐", price: 38, category: "热菜", optionGroups: [SPICE_LEVEL_GROUP] },
  { id: 6, name: "鱼香肉丝", price: 45, category: "热菜" },
  { id: 7, name: "东坡肉", price: 68, category: "热菜" },
];

// 2026-02-28: 饮品 - 与后端 seed 一致
export const beverages = [
  { id: 1, name: "珍珠奶茶", price: 22, category: "饮品" },
  { id: 2, name: "酸梅汤", price: 18, category: "饮品" },
  { id: 3, name: "柠檬水", price: 15, category: "饮品" },
  { id: 4, name: "鲜榨橙汁", price: 28, category: "饮品" },
];

// 2026-02-28: 汤羹 - 与后端 seed 一致
export const soups = [
  { id: 1, name: "酸辣汤", price: 28, category: "汤羹" },
  { id: 2, name: "老鸭汤", price: 48, category: "汤羹" },
  { id: 3, name: "冬瓜排骨汤", price: 42, category: "汤羹" },
  { id: 4, name: "西红柿蛋汤", price: 22, category: "汤羹" },
];

// 2026-02-28: 甜品 - 与后端 seed 一致
export const desserts = [
  { id: 1, name: "绿豆糕", price: 18, category: "甜品" },
  { id: 2, name: "桂花糕", price: 22, category: "甜品" },
  { id: 3, name: "红豆糕", price: 20, category: "甜品" },
  { id: 4, name: "杨枝甘露", price: 32, category: "甜品" },
];

// 2026-02-28: 主食 - 与后端 seed 一致
export const pizzas = [
  { id: 1, name: "小笼包", price: 32, category: "主食" },
  { id: 2, name: "扬州炒饭", price: 35, category: "主食" },
  { id: 3, name: "葱油拌面", price: 28, category: "主食" },
  { id: 4, name: "蛋炒饭", price: 25, category: "主食" },
];

// 2026-02-28: 酒水 - 与后端 seed 一致
export const alcoholicDrinks = [
  { id: 1, name: "茅台", price: 188, category: "酒水" },
  { id: 2, name: "啤酒", price: 18, category: "酒水" },
  { id: 3, name: "红酒", price: 98, category: "酒水" },
  { id: 4, name: "黄酒", price: 38, category: "酒水" },
];

// 2026-02-28: 移除 salads，用 menus 覆盖 7 类
export const menus = [
  { id: 1, name: "凉菜", bgColor: "#22c55e", icon: "🥗", items: startersItem },
  { id: 2, name: "热菜", bgColor: "#ef4444", icon: "🍖", items: mainCourse },
  { id: 3, name: "汤羹", bgColor: "#f97316", icon: "🍜", items: soups },
  { id: 4, name: "主食", bgColor: "#eab308", icon: "🍚", items: pizzas },
  { id: 5, name: "饮品", bgColor: "#06b6d4", icon: "🥤", items: beverages },
  { id: 6, name: "甜品", bgColor: "#ec4899", icon: "🍰", items: desserts },
  { id: 7, name: "酒水", bgColor: "#8b5cf6", icon: "🍶", items: alcoholicDrinks },
];

// 2026-02-28: 中餐演示指标
export const metricsData = [
  { title: "营业额", value: "¥15,680", percentage: "12%", color: "#025cca", isIncrease: false },
  { title: "订单数", value: "30", percentage: "16%", color: "#02ca3a", isIncrease: true },
  { title: "会员数", value: "1,200", percentage: "10%", color: "#f6b100", isIncrease: true },
  { title: "菜品数", value: "33", percentage: "8%", color: "#be3e3f", isIncrease: true },
];

export const itemsData = [
  { title: "菜品分类", value: "7", percentage: "12%", color: "#5b45b0", isIncrease: false },
  { title: "菜品数量", value: "33", percentage: "12%", color: "#285430", isIncrease: true },
  { title: "进行中订单", value: "12", percentage: "12%", color: "#735f32", isIncrease: true },
  { title: "桌位数", value: "12", color: "#7f167f" },
];

// 2026-02-28: 前端静态订单示例（实际订单来自后端 API）
export const orders = [
  { id: "101", customer: "张明", status: "Ready", dateTime: "2025-02-24 18:32", items: 3, tableNo: 1, total: 82 },
  { id: "102", customer: "李芳", status: "In Progress", dateTime: "2025-02-24 18:45", items: 5, tableNo: 2, total: 238 },
  { id: "103", customer: "王强", status: "Ready", dateTime: "2025-02-24 19:00", items: 3, tableNo: 3, total: 128 },
  { id: "104", customer: "陈静", status: "In Progress", dateTime: "2025-02-24 19:15", items: 2, tableNo: 4, total: 124 },
];
