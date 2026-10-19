# ToolLamp 計畫

這份文件是 ToolLamp 的工作計畫和狀態紀錄。每個 AI session 開始工作前都要先讀完，結束前要更新。
規則細節（程式架構、新增工具的步驟、寫作和設計規範）在 AGENTS.md，兩份都要遵守。

> 這個 repo 是公開的。這份文件只能記錄計畫、狀態和決定，
> 不能寫入帳號、密碼、收款資料、收入金額或任何個人資料。

## 目標

用免費的線上工具累積搜尋流量，靠聯盟連結（之後加上 AdSense）產生副業收入。

- 中文生活工具：對象是台灣使用者，搭配蝦皮分潤。
- 英文電子工程工具：對象是全球工程師，搭配電子零件、開發板的聯盟連結。
- 先用 `toollamp.github.io` 免費經營，流量起來後再買自有網域、申請 AdSense。

## 怎麼使用這份計畫

1. 從「目前階段」裡第一個還沒打勾的項目開始做。一次做一個項目，做完再做下一個。
2. 做完一個項目：把它打勾 `[x]`，並在後面用一句話記錄結果。
3. 遇到需要 Adrian 決定的事，不要自己猜：寫進「待 Adrian 決定」，然後先做其他不受影響的項目。
4. 不要跳到後面的階段，除非 Adrian 明確要求。目前階段全部完成後，把「目前階段」改成下一個。
5. 做了重要的技術或方向決定，記到最下面的「決策紀錄」。
6. session 結束前，給 Adrian 一份摘要：完成了什麼、卡在哪裡、需要他做什麼。

**目前階段：第 4 階段**

## 收益計畫狀態

處理任何與聯盟連結或廣告有關的工作之前，先看這張表。
**狀態不是「已核准」的計畫，不能加入任何連結、追蹤 ID 或廣告程式碼。**
這些計畫只能由 Adrian 本人申請，AI 不能代為申請、建立帳號或填寫個人資料。

| 計畫 | 用在哪些頁面 | 狀態 | 備註 |
|---|---|---|---|
| 蝦皮分潤計畫 | 中文生活工具 | 尚未申請 | |
| AliExpress 聯盟 | 英文電子工具 | 尚未申請 | |
| Amazon Associates | 英文電子工具 | 尚未申請 | 新帳號有成交門檻，申請前先確認 |
| Google AdSense | 全站 | 等待自有網域 | github.io 子網域不能申請 |

Adrian 告訴你某個計畫通過時：更新這張表，再把他提供的連結填進 `assets/affiliates.js`。
不要自己產生或猜測任何聯盟連結。

## 第 1 階段：新增兩個工具

照 AGENTS.md 的「Adding a new tool」checklist 逐項完成，每個工具一個 commit。

- [x] 中文「日期間隔計算」，放在 `zh-tw/life/date-difference/`：已上線，另加「頭尾都算」和「起始日算第 1 天」兩個選項。
  - 兩個日期相差幾天、幾週、幾個月又幾天
  - 從某天加減 N 天是哪一天
  - 開啟時預設帶入今天
  - 說明文章和 FAQ 寫台灣人常搜尋的情境，例如「距離某日還有幾天」、「到期日怎麼算」
- [x] 英文「Voltage divider calculator」，放在 `en/electronics/voltage-divider/`：已上線，列出精確值兩側的 E24 值和各自的誤差。
  - 給 Vin、R1、R2 算 Vout
  - 給 Vin、目標 Vout 和其中一顆電阻，算出另一顆，並建議最接近的 E24 標準值和實際 Vout
  - 顯示分壓電阻的電流和消耗功率
- [x] 兩個工具的測試都涵蓋邊界情況：閏年、跨月、跨年、0、負數、空白輸入：共 43 個測試，日期工具另外和 `Date` 交叉比對 2000 個隨機日期。

## 第 2 階段：聯盟連結架構

只做架構，不填入任何真實連結。

- [x] 新增 `assets/affiliates.js`，以 slot 名稱（工具的 slug）為 key 集中管理推薦商品。
      每個 slot 有 0～3 個商品，每個商品有 `name`、`url`、`note`（一句話說明為什麼推薦）。預設全部是空陣列。
      結果：完成，4 個工具的 slot 都是空陣列；不完整、不是 https 的商品會被略過，超過 3 個只取前 3 個。
- [x] 工具頁的 affiliate slot 改成由 `affiliates.js` 渲染：有商品才顯示，沒有就完全不出現。
      連結加上 `rel="sponsored noopener"` 和 `target="_blank"`，保留揭露文字（中文頁中文、英文頁英文）。
      結果：完成，原本註解掉的區塊改成 `<aside ... hidden>`，有商品時才顯示；已用瀏覽器檢查中英文、深淺色。
- [x] 渲染邏輯的測試：空陣列不顯示、有商品時正確顯示、rel 屬性正確：8 個測試，另外檢查 HTML 跳脫，以及每個工具頁都有對應的 slot。
- [x] 更新 AGENTS.md 的「Affiliate slots」段落，說明之後只要改 `affiliates.js`：也更新了新增工具 checklist。

## 第 3 階段：網站必要頁面

AdSense 送審時會檢查這些頁面，現在先做好。中文版和英文版各一份。

- [x] 隱私權政策：網站不收集使用者輸入的資料，所有計算在瀏覽器完成；提及聯盟連結，
      以及未來可能使用 Google AdSense 和 cookie。內容要誠實，不能寫網站實際上沒有做的資料收集。
      結果：`/zh-tw/privacy/`、`/en/privacy/`。如實寫出 localStorage（只記深淺色設定）、GitHub Pages 和 Google Fonts 會收到 IP 位址；本站沒有 cookie。
- [x] 關於 ToolLamp：網站是做什麼的、由「一位台灣的韌體工程師」維護（不寫姓名）
      結果：`/zh-tw/about/`、`/en/about/`，沒有寫姓名。
- [x] 聯絡方式：先連到這個 repo 的 GitHub Issues
      結果：`/zh-tw/contact/`、`/en/contact/`，連到 GitHub Issues（已確認有開啟），並提醒 Issues 是公開的。
- [x] 所有頁面的 footer 加上這三頁的連結，並更新 sitemap.xml
      結果：完成，新增測試檢查每頁 footer、sitemap 和 canonical 網址。

## 第 4 階段：申請草稿

- [ ] 新增 `docs/applications.md`，為「收益計畫狀態」表上的每個計畫準備申請表填寫草稿：
      網站名稱、網址、網站簡介（中英文各一版，約 50 字和 150 字）、內容類型、目標受眾、打算如何推廣商品。
      內容要符合網站當下的真實情況，不誇大流量或規模。
- [ ] 每個計畫的申請條件參考官方說明，查不到或不確定的標註「待確認」，不要猜。

## 第 5 階段：預留廣告版位

- [ ] 在 `site.css` 定義 `.ad-slot` 樣式並預留固定高度，避免之後放廣告時版面跳動
- [ ] 在 AGENTS.md 寫清楚之後要放的位置：工具面板下方、文章中段
- [ ] 目前所有頁面都不放 `.ad-slot` 元素

## 之後的工具點子

依搜尋需求排序，Adrian 可以調整。做完一個就從這裡移到對應階段。

- 中文：聚餐分帳計算、坪數和平方公尺換算、台斤公斤換算、BMI、年齡計算
- 英文：LED current-limiting resistor、UART baud rate error、CRC calculator（CRC-8/16/32）、
  Ohm's law、RC time constant、DMX address DIP switch calculator

## Adrian 要自己做的事

這些需要本人帳號或個人資料，AI 不能代勞。AI 可以提醒，但不要假設已經完成。

- [x] 把 GitHub 組織 `toolburrow` 改名為 `toollamp`（組織 Settings → Change organization name）：已完成。
- [x] 把 repo `toolburrow.github.io` 改名為 `toollamp.github.io`（repo Settings → Repository name），確認網站在 `https://toollamp.github.io/` 能打開：已完成，13 頁都能正常開啟，舊網址已失效。
- [ ] 考慮現在就買下 `toollamp.com`，避免好名字被別人註冊走（買之前先到註冊商網站確認還沒人註冊）
- [ ] 到智慧財產局和美國 USPTO 查 ToolLamp 有沒有人註冊商標
- [ ] 到 Google Search Console 驗證網站並提交 `https://toollamp.github.io/sitemap.xml`
- [ ] 申請蝦皮分潤計畫
- [ ] 申請 AliExpress 聯盟或 Amazon Associates
- [ ] 流量穩定後購買自有網域，再申請 AdSense

## 待 Adrian 決定

- 日期工具 FAQ 引用民法第 120 條（始日不算入）和第 122 條（末日遇休息日以次日代之），請確認說法沒問題。工具本身不會自動順延假日。
- 日期工具開啟時的預設情境是「到明年 1 月 1 日還有幾天」，要不要換成別的？
- AGENTS.md 和現有程式碼有幾處不一致，還沒改：
  - 「header、footer 保持一致」沒說以哪一版為準：首頁 footer 是雙語，工具頁是單語加分潤聲明。
  - 「第一次載入就要有結果」沒說是每個面板都要，還是整頁有就好。電阻頁的 Value to colors 和民國頁的日期換算一開始都是空的。
  - 沒寫能不能用頁面專屬的 `<style>`，電阻頁和兩個新工具都有用。
  - meta description「約 155 字」沒說中文怎麼算。
- 加廣告時，所有頁面 footer 的「不會上傳任何資料」要改寫。計算確實不會上傳，但 AdSense 會用 cookie。可以在第 3 階段做隱私權政策時一起處理。
- footer 寫「部分頁面含有聯盟連結」，但目前還沒有任何聯盟連結。要先拿掉，等第一個計畫核准再加回來，還是先保留？

## 決策紀錄

- 2026-10-19：網站名稱定為 Toolburrow，放在 GitHub 組織 `toolburrow` 底下，網址 `toolburrow.github.io`。
- 2026-10-19：發現 toolburrow.com 已有同名、同類型的線上工具網站（2026-07 註冊），改名為 ToolLamp。改名前查過 Google、.com/.net/.app 網域和 GitHub 帳號都沒有人用。GitHub 組織改為 `toollamp`，網址改為 `toollamp.github.io`。
- 2026-10-19：純靜態網站，不用框架、不用 build step，由 GitHub Pages 直接部署 main 分支。
- 2026-10-19：先用聯盟連結，等有自有網域再申請 AdSense。
- 2026-10-19：第一批工具是「民國西元換算」（中文）和「電阻色碼計算器」（英文），已上線。
- 2026-10-19：不開分支、不開 PR，直接 commit 到 main；push 前一定先跑 `node tests/run.js`。
- 2026-10-19：AI 一律用繁體中文跟 Adrian 溝通。
- 2026-10-19：日期計算不用 `Date`，改用日數換算，避免時區和日光節約時間讓結果差一天。月份相加遇到月底時取當月最後一天（1/31 加 1 個月是 2/28 或 2/29）。
- 2026-10-19：分壓計算器的「最接近 E24 值」是指讓 Vout 誤差最小的那一個，兩側的值都會列出。電阻輸入的 `m` 視為 M（百萬），和電阻色碼頁一致。
- 2026-10-19：聯盟連結集中在 `assets/affiliates.js`，工具頁只放空的 `<aside hidden>`；商品網址只接受 https，名稱和說明會做 HTML 跳脫。
- 2026-10-19：隱私權、關於、聯絡頁放在 `/zh-tw/` 和 `/en/` 底下，不放在 category 裡。之後要加入廣告、分析或新的第三方資源，必須在同一個 commit 先更新兩份隱私權政策。
