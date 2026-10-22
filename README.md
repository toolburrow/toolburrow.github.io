# ToolLamp

小而好用的免費線上工具，所有計算都在瀏覽器裡完成。
Small, free online tools. Everything runs in your browser.

- 中文工具：https://toollamp.github.io/zh-tw/
- English tools: https://toollamp.github.io/en/

工具分成生活、理財和電子三類，每個工具都有中英兩版。
Tools cover everyday life, finance and electronics, and each one has a Chinese and an English version.

## 開發 Development

- 純靜態網站（HTML、CSS、JavaScript），沒有框架和 build step，由 GitHub Pages 直接部署 `main` 分支。
  A plain static site (HTML, CSS, JavaScript) with no framework or build step. GitHub Pages deploys the `main` branch directly.
- 新增工具的規則寫在 [AGENTS.md](AGENTS.md)，工作計畫在 [PLAN.md](PLAN.md)。
  The rules for adding a tool are in [AGENTS.md](AGENTS.md); the work plan is in [PLAN.md](PLAN.md).
- 測試 Tests: `node tests/run.js`

## 授權 License

© 2026 ToolLamp，保留所有權利。程式碼和內容公開只是為了用 GitHub Pages 發布，未經書面同意不得複製、修改、轉載或架設在其他網站。詳見 [LICENSE](LICENSE)。

© 2026 ToolLamp. All rights reserved. The code and content are public only so GitHub Pages can publish them. Do not copy, modify, republish or host them elsewhere without written permission. See [LICENSE](LICENSE).
