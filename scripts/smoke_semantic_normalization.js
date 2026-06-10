const AgentCore = require("../app/agent-core.js");

const cases = [
  {
    text: "我的金币少了10w",
    expected: {
      resource_type: "game_currency",
      resource_terms: ["金币"],
      game_currency_amount: 100000,
    },
  },
  {
    text: "少了4k欢乐豆",
    expected: {
      resource_type: "game_currency",
      resource_terms: ["欢乐豆"],
      game_currency_amount: 4000,
    },
  },
  {
    text: "豆子没了",
    expected: {
      resource_type: "game_currency",
      resource_terms: ["豆子"],
    },
  },
  {
    text: "我充了30元没到账",
    expected: {
      real_money_amount: 30,
      resource_type: "real_money",
    },
  },
  {
    text: "钱没了",
    expected: {
      resource_type: "ambiguous_money",
      money_ambiguous: true,
    },
  },
  {
    text: "充值的钱没到账",
    expected: {
      resource_type: "real_money",
      money_context: "payment",
    },
  },
  {
    text: "结算后钱少了",
    expected: {
      resource_type: "game_currency",
      money_context: "game_asset",
    },
  },
  {
    text: "我的钻石少了2k",
    expected: {
      resource_type: "premium_currency",
      resource_terms: ["钻石"],
      premium_currency_amount: 2000,
      normalized_resource: "钻石",
    },
  },
  {
    text: "兑换钻石没到账",
    expected: {
      resource_type: "premium_currency",
      resource_terms: ["钻石"],
      asset_context: "exchange",
    },
  },
  {
    text: "用钻石买金币失败了",
    expected: {
      resource_type: "mixed_game_asset",
      resource_terms: ["钻石", "金币"],
      asset_context: "diamond_to_coin",
    },
  },
];

for (const item of cases) {
  const entities = AgentCore.detectEntities(item.text);
  for (const [key, value] of Object.entries(item.expected)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (!entities[key]?.includes(entry)) {
          throw new Error(`${item.text} expected ${key} to include ${entry}, got ${JSON.stringify(entities[key])}`);
        }
      }
      continue;
    }
    if (entities[key] !== value) {
      throw new Error(`${item.text} expected ${key}=${value}, got ${entities[key]}`);
    }
  }
}

console.log("Semantic normalization smoke tests passed");
