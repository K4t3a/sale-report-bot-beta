const fetch = require("node-fetch");

const token = process.env.BOT_TOKEN;

async function main() {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = await res.json();
  console.log(data);
}

main().catch(console.error);