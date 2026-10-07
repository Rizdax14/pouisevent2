const fs = require("fs");
const path = require("path");

module.exports = (req, res) => {
  const root = process.cwd();
  const fonts = fs.readdirSync(path.join(root, "fonts")).filter((f) => f.endsWith(".ttf")).length;
  const backgrounds = fs.readdirSync(path.join(root, "assets/insta")).filter((f) => f.startsWith("bg-")).length;
  res.status(200).json({ ok: true, fonts, backgrounds });
};
