const fs = require("fs");
const AgentCore = require("../app/agent-core.js");

const rules = JSON.parse(fs.readFileSync("./data/agent/intent_rules_day1.json", "utf8"));

const cases = [
  {
    text: "我充值了30元没到账",
    expectedCategory: "支付充值",
    expectedPriority: "P0",
  },
  {
    text: "微信扣了68块但是钻石没到账",
    expectedCategory: "支付充值",
    expectedPriority: "P0",
  },
  {
    text: "兑换钻石没到账",
    expectedCategory: "资产道具",
    expectedSubCategory: "钻石兑换异常",
    expectedPriority: "P1",
  },
  {
    text: "用钻石买金币失败了，钻石扣了金币没给",
    expectedCategory: "资产道具",
    expectedSubCategory: "钻石购买金币异常",
    expectedPriority: "P1",
  },
  {
    text: "我的金币少了10w",
    expectedCategory: "资产道具",
    expectedSubCategory: "金币异常",
    expectedPriority: "P1",
  },
  {
    text: "结算后欢乐豆少了4k",
    expectedCategory: "资产道具",
    expectedSubCategory: "结算后资产异常",
    expectedPriority: "P1",
  },
  {
    text: "豆子没了，不知道怎么回事",
    expectedCategory: "资产道具",
    expectedSubCategory: "金币异常",
    expectedPriority: "P1",
  },
  {
    text: "钱没了",
    expectedCategory: "未识别",
    expectedPriority: "P3",
  },
  {
    text: "新手赛事奖励没发，少了5w金币",
    expectedCategory: "活动奖励",
    expectedPriority: "P1",
  },
  {
    text: "订单支付成功但道具没发",
    expectedCategory: "支付充值",
    expectedPriority: "P0",
  },
];

for (const item of cases) {
  const route = AgentCore.classifyMessage(item.text, rules);
  if (route.category !== item.expectedCategory) {
    throw new Error(`${item.text} expected category ${item.expectedCategory}, got ${route.category}`);
  }
  if (item.expectedSubCategory && route.sub_category !== item.expectedSubCategory) {
    throw new Error(`${item.text} expected sub category ${item.expectedSubCategory}, got ${route.sub_category}`);
  }
  if (route.priority_hint !== item.expectedPriority) {
    throw new Error(`${item.text} expected priority ${item.expectedPriority}, got ${route.priority_hint}`);
  }
}

console.log("Asset classification smoke tests passed");
