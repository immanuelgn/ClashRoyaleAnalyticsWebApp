const { CARDS, withFlags } = require("../_lib/deck");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const items = CARDS.map(withFlags);
  return res.status(200).json(items);
};
