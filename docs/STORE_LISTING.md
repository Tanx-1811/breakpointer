# Chrome Web Store listing

Copy-ready text and the answers the store asks for. Assets live in `brand/` (see `brand/README.md`).

**Live listing:** [https://chromewebstore.google.com/detail/naoadcallefanlcneemohjepkficejjh](https://chromewebstore.google.com/detail/naoadcallefanlcneemohjepkficejjh) — “Breakpointer — Responsive Viewport Tester”, id `naoadcallefanlcneemohjepkficejjh`, publisher Tanix; public since 0.4.0 (17 Oct 2026). Link to it directly, adding `?utm_source=…&utm_medium=…&utm_campaign=…` so the dashboard counts each channel: another extension on the store is also named “Breakpointer”.

**Updating to 0.7.0 (includes 0.6.0's Breakpointer Pro):** the store is still at 0.5.0, so 0.7.0 is uploaded directly — everything below for 0.6.0 applies too. Then: replace both descriptions with the ones below, and in the dashboard's Store listing tab **add six languages** (Spanish, Portuguese (Brazil), French, German, Japanese, Indonesian) with the summaries and descriptions from [store-listing/](store-listing/) (`es.md`, `pt-BR.md`, `fr.md`, `de.md`, `ja.md`, `id.md`). The extension's name and summary in Chrome follow `public/_locales`. Upload the new screenshots `10-audit` (now with the responsive score) and `14-notes`.

**Updating to 0.6.0 (Breakpointer Pro):** first set `PRO_CHECKOUT_URL` (see [PRO.md](PRO.md)), then upload `release/breakpointer-0.6.0.zip`, add the “Breakpointer Pro” section below to both descriptions, and refresh the `scripting` justification (accessibility checks, hidden cookie banners, synced clicks and typing). No permission changed. Say plainly in the description that Pro is paid with a free 7-day trial and that everything free before stays free; if the dashboard asks whether the item has paid features or in-app purchases, answer yes (Pro is bought on the seller's site, not through Chrome).

## Basics

| Field                      | Value                                                                                                                                                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name (from manifest)       | Breakpointer — Responsive Viewport Tester                                                                                                                                                                                                                                                                 |
| Category                   | Developer Tools                                                                                                                                                                                                                                                                                           |
| Languages                  | English (default), Vietnamese                                                                                                                                                                                                                                                                             |
| Store icon                 | `brand/store/store-icon-128.png`                                                                                                                                                                                                                                                                          |
| Small promo tile (440×280) | `brand/store/promo-small-440x280.png` · VI: `promo-small-440x280-vi.png`                                                                                                                                                                                                                                  |
| Marquee (1400×560)         | `brand/store/promo-marquee-1400x560.png` · VI: `promo-marquee-1400x560-vi.png`                                                                                                                                                                                                                            |
| Screenshots (1280×800)     | Upload five, in this order: `1-workspace`, `12-check-pages`, `9-scan`, `13-showcase`, `10-audit` (all in `brand/store/screenshots/en/`, `.png`) · VI: `screenshots/vi/…` · also available: `2-groups`, `3-add-viewport`, `4-dark-rulers`, `5-checks`, `6-inspector`, `7-palette`, `8-resize`, `11-visual` |

## Short description (≤ 132 characters)

Search results show this summary, so it leads with what people type: “responsive design tester”, “screen sizes”, “side by side” (in Vietnamese, “kiểm tra responsive”). Use a term at most five times in the whole listing; never “emulator” or “simulator”.

- **EN:** Responsive design tester: preview any site at many screen sizes side by side and find the exact width where your layout breaks.
- **VI:** Kiểm tra responsive: xem trang ở nhiều kích thước màn hình cùng lúc và tìm chính xác chiều rộng nơi bố cục bị vỡ.

## Detailed description — English

Find where your layout breaks — at every screen size, at once.

Breakpointer shows any website at several viewport sizes side by side, right in Chrome. Each preview gets a real layout width and height, so media queries and responsive layouts behave exactly as they would in a window that size.

**Preview fast**
• Click the toolbar button and choose “Preview this page”, right-click any page or link, press Alt+Shift+P, or type “bpt” and a URL in the address bar.
• 28 common sizes for phones, foldables, tablets, laptops and desktops (search by name or size), plus any custom size.
• Drag a preview's edge to resize it and watch the page reflow live — it snaps to your breakpoints.
• Press Ctrl/⌘ + K to search every command, size, group and page.

**Find where it breaks**
• Responsive score: one number from 0 to 100 for every page — see what costs the most points, in the audit, reports and Check pages.
• Notes: pin what's wrong on any preview (press N) and copy a ready-to-paste bug report with the page, the viewport sizes and your notes.
• Check pages: a whole list of pages — your saved pages, the links on a page or the site's sitemap — checked at every viewport in one run. See which pages break and at which sizes, then copy the table as Markdown or download an HTML report.
• Scan every width: the page is checked at every width of a range, and each issue's first and last width is found to the pixel — on a chart with the page's height, its breakpoints and your viewports. Add a viewport at the worst width in one click.
• Audit: every issue of every size in one place, the page's weight, requests, image pixels, largest contentful paint and layout shift per size, and the type scale of headings, text and buttons — copy any of it as a Markdown table.
• Visual check: save a baseline of every viewport, compare after a change and see what moved, pixel by pixel — side by side, with a slider, or the differences boxed.
• Inspector: click an element in one preview and compare its size, display, font, spacing and layout at every size — what changes is highlighted.
• Breakpoints read from the page's own CSS, plus Tailwind, Bootstrap, Material UI, Chakra UI, Ant Design, Bulma, Foundation or your own — label every viewport and test both sides of each breakpoint.
• Light and dark side by side: show any preview with the page's light or dark styles.
• Responsive checks find sideways scrolling (and the element causing it), a missing viewport tag, tiny text, small touch targets, text cut off by its box, low-contrast text, blurry images, elements covering the screen and layout shifts — highlight them right in the page.
• Scroll one preview and the others show the same content; click a link and every preview opens it.
• Layout outlines, a column grid, pixel rulers, hidden scrollbars and live CSS applied to every size at once — save the CSS you use often as snippets.
• Compare two addresses: a second preview next to every viewport, e.g. staging next to production, following the same pages.
• Simulate colour blindness and blurred vision, reduced motion and paused animations, and stress the layout with longer translated text, right-to-left and text at 200%.
• Measure in CSS pixels, check colour contrast against WCAG with an eyedropper, and lay a design mockup over a preview to compare pixel by pixel.
• Open every viewport as a real window of its exact size (for sites that need your sign-in), keep an always-on-top floating preview next to your editor, or preview the page you're browsing in the side panel.
• Full-page screenshots, text spacing (WCAG), prefers-contrast and print styles, image-size and tab-order labels, and a baseline grid.

**Share what you see**
• Showcase image: your page at several sizes in simple device frames on a backdrop, ready for a portfolio, a client or a post.
• Screenshots of one preview or the workspace, every viewport in one labelled image, copy to the clipboard, and an HTML report of every size with its issues.
• Open any preview in a real window of the exact size.

**Work your way**
• Save viewport groups like “Checkout QA” and switch in one click; eight built-in groups included, among them the most-used screen sizes and WCAG reflow sizes.
• Focus on one viewport, go back and forward between pages, star the pages you test often, zoom with Ctrl/⌘ + wheel and pan with Space + drag.
• Reloads keep every preview where it was scrolled, and can run automatically; share a workspace link that opens the page with your viewports.
• Export and import your setup to share it with your team.
• A clean light and dark design, keyboard shortcuts for everything, in English, Spanish, Portuguese, French, German, Japanese, Indonesian and Vietnamese.

**Breakpointer Pro** (free 7-day trial; everything above stays free)
• Accessibility checks at every size: images without alt text, unnamed buttons and links (often the icon-only menu button that only shows on phones), unlabeled fields, keyboard focus on hidden elements such as a closed off-canvas menu, and a missing page language.
• Sync clicks & typing: open a menu or fill in a form in one preview and every preview of the page does the same — forms are never submitted twice, and passwords and payment fields are never copied.
• Hide cookie banners of common consent tools for clean screenshots and checks (nothing is accepted).
• Projects: save each site's page, viewports, breakpoints, grid, live CSS and comparison, and switch between clients in one click (one project is free).
• Your brand — name, logo and link — on reports and images you send to clients.
• CSV and JSON exports of Check pages, width scans and audits.
• Licences are checked in your browser: no account, nothing sent.

**Private by design**
• No account, no analytics, no server. Settings stay in your browser.
• No access to your sites at install. Some sites block being shown inside other pages, and the in-page tools need your permission too; you can allow Breakpointer on a site (or all sites) when you need to — or only until Chrome closes — and remove access anytime.
• Visual-check baselines stay in your browser and are never uploaded.

**Good to know**
Breakpointer changes the viewport size; it doesn’t emulate a device’s user agent, pixel density, touch input or browser engine. Sign-in state and third-party cookies can behave differently inside previews.

## Detailed description — Tiếng Việt

Tìm chỗ bố cục bị vỡ — ở mọi kích thước màn hình, cùng lúc.

Breakpointer hiển thị bất kỳ website nào ở nhiều kích thước viewport đặt cạnh nhau, ngay trong Chrome. Mỗi bản xem trước có chiều rộng và chiều cao dàn trang thật, nên media query và bố cục responsive hoạt động đúng như trong một cửa sổ cùng kích thước.

**Xem trước thật nhanh**
• Bấm nút trên thanh công cụ và chọn “Xem trước trang này”, chuột phải vào trang hoặc liên kết, nhấn Alt+Shift+P, hoặc gõ “bpt” và URL trên thanh địa chỉ.
• 28 kích thước phổ biến cho điện thoại, máy gập, máy tính bảng, laptop và máy bàn (tìm theo tên hoặc kích thước), cùng kích thước tùy chỉnh.
• Kéo cạnh bản xem trước để đổi kích thước và xem trang dàn lại ngay — tự bắt dính vào breakpoint.
• Nhấn Ctrl/⌘ + K để tìm mọi lệnh, kích thước, nhóm và trang.

**Tìm chỗ bị vỡ**
• Kiểm tra nhiều trang: cả danh sách trang — trang đã lưu, các liên kết trong một trang hoặc sitemap của trang web — được kiểm tra ở mọi viewport trong một lần chạy. Biết ngay trang nào bị vỡ, ở kích thước nào, rồi chép bảng dạng Markdown hoặc tải báo cáo HTML.
• Quét mọi chiều rộng: trang được kiểm tra ở mọi chiều rộng trong khoảng, và chiều rộng nơi mỗi vấn đề bắt đầu, kết thúc được tìm chính xác đến từng pixel — trên biểu đồ kèm chiều cao trang, breakpoint của trang và các viewport của bạn. Thêm viewport ở chiều rộng tệ nhất chỉ với một cú bấm.
• Rà soát: mọi vấn đề ở mọi kích thước tại một chỗ, dung lượng, số yêu cầu, điểm ảnh của ảnh, LCP và độ xê dịch bố cục theo từng kích thước, cùng thang kiểu chữ của tiêu đề, nội dung và nút — chép thành bảng Markdown.
• Kiểm tra hình ảnh: lưu ảnh mốc của mọi viewport, so sánh sau khi thay đổi và thấy phần nào xê dịch, đến từng pixel — cạnh nhau, thanh trượt, hoặc khoanh vùng khác biệt.
• Soi phần tử: bấm một phần tử ở một bản xem trước để so sánh kích thước, display, font, khoảng cách và bố cục ở mọi kích thước — chỗ thay đổi được đánh dấu.
• Breakpoint đọc từ chính CSS của trang, cùng Tailwind, Bootstrap hoặc của riêng bạn — gắn nhãn mọi viewport và thử hai bên mỗi breakpoint.
• Sáng và tối cạnh nhau: hiển thị bản xem trước với kiểu sáng hoặc tối của trang.
• Kiểm tra responsive phát hiện cuộn ngang (và phần tử gây ra), thiếu thẻ viewport, chữ quá nhỏ, vùng chạm quá nhỏ, chữ bị khung cắt, chữ tương phản thấp, ảnh bị mờ, phần tử che màn hình và bố cục xê dịch — đánh dấu ngay trên trang.
• Cuộn một bản xem trước thì các bản khác hiện đúng nội dung đó; bấm liên kết thì mọi bản cùng mở trang đó.
• Viền bố cục, lưới cột, thước đo pixel, ẩn thanh cuộn và CSS trực tiếp áp dụng cho mọi kích thước cùng lúc — lưu những đoạn CSS hay dùng để áp dụng lại.
• So sánh hai địa chỉ: thêm một bản xem trước cạnh mỗi viewport, ví dụ bản staging cạnh bản chính thức, đi theo cùng các trang.
• Mô phỏng mù màu và nhìn mờ, giảm chuyển động và tạm dừng hiệu ứng động, thử độ bền bố cục với chữ dịch dài hơn và hướng phải sang trái.
• Đo theo pixel CSS, kiểm tra độ tương phản màu theo WCAG bằng ống hút màu, và phủ ảnh thiết kế lên bản xem trước để so từng pixel.
• Mở mỗi viewport thành một cửa sổ thật đúng kích thước (cho trang cần đăng nhập), giữ một bản xem trước nổi luôn trên cùng cạnh trình soạn code, hoặc xem nhanh trang đang mở ở thanh bên.
• Chụp toàn trang, giãn chữ (WCAG), tương phản cao và kiểu in, nhãn kích thước ảnh và thứ tự Tab, lưới baseline.

**Chia sẻ điều bạn thấy**
• Ảnh trình diễn: trang của bạn ở nhiều kích thước trong khung thiết bị đơn giản trên nền đẹp, sẵn sàng cho portfolio, khách hàng hoặc bài đăng.
• Chụp một bản xem trước hoặc cả vùng làm việc, ghép mọi viewport thành một ảnh có nhãn, chép vào bộ nhớ tạm, và xuất báo cáo HTML cho mọi kích thước kèm các vấn đề.
• Mở bất kỳ bản xem trước nào trong một cửa sổ thật đúng kích thước.

**Làm việc theo cách của bạn**
• Lưu nhóm viewport như “Kiểm thử thanh toán” và chuyển đổi chỉ với một cú bấm; có sẵn sáu nhóm.
• Tập trung vào một viewport, quay lại/tới giữa các trang, đánh dấu sao trang hay kiểm tra, thu phóng bằng Ctrl/⌘ + lăn chuột và kéo vùng làm việc bằng Space + kéo.
• Tải lại mà mọi bản xem trước vẫn giữ nguyên chỗ đang xem, có thể tự động; chia sẻ liên kết workspace mở trang với đúng các viewport của bạn.
• Xuất và nhập cấu hình để chia sẻ với nhóm của bạn.
• Thiết kế sáng và tối gọn gàng, phím tắt cho mọi thứ, tiếng Anh và tiếng Việt.

**Breakpointer Pro** (dùng thử miễn phí 7 ngày; mọi tính năng ở trên vẫn miễn phí)
• Kiểm tra trợ năng ở mọi kích thước: ảnh thiếu văn bản thay thế, nút và liên kết không có tên (thường là nút menu chỉ có biểu tượng chỉ hiện trên điện thoại), trường nhập không có nhãn, tiêu điểm bàn phím rơi vào phần tử bị ẩn như menu trượt đã đóng, và trang thiếu khai báo ngôn ngữ.
• Đồng bộ nhấp & gõ phím: mở menu hay điền biểu mẫu ở một bản xem trước, mọi bản xem trước của trang đều làm theo — không bao giờ gửi biểu mẫu hai lần, không bao giờ chép mật khẩu hay thông tin thanh toán.
• Ẩn banner cookie của các công cụ phổ biến để ảnh chụp và kiểm tra gọn gàng (không chấp nhận gì cả).
• Thương hiệu của bạn — tên, logo và liên kết — trên báo cáo và hình ảnh gửi cho khách hàng.
• Xuất CSV và JSON kết quả Kiểm tra nhiều trang, quét chiều rộng và rà soát.
• Giấy phép được kiểm tra ngay trong trình duyệt: không tài khoản, không gửi gì đi.

**Tôn trọng quyền riêng tư**
• Không tài khoản, không theo dõi, không máy chủ. Cài đặt chỉ nằm trong trình duyệt của bạn.
• Không truy cập trang web nào khi cài đặt. Một số trang chặn hiển thị bên trong trang khác, và các công cụ chạy trong trang cũng cần bạn cho phép; bạn có thể cho phép Breakpointer trên một trang (hoặc mọi trang) khi cần — hoặc chỉ đến khi đóng Chrome — và gỡ quyền bất cứ lúc nào.
• Ảnh mốc của tính năng kiểm tra hình ảnh chỉ nằm trong trình duyệt của bạn, không bao giờ được tải lên.

**Lưu ý**
Breakpointer thay đổi kích thước viewport; không giả lập user agent, mật độ điểm ảnh, cảm ứng hay nhân trình duyệt của thiết bị. Trạng thái đăng nhập và cookie bên thứ ba có thể hoạt động khác trong bản xem trước.

## Privacy practices tab

**Single purpose:** Preview web pages at multiple viewport sizes side by side to check responsive layouts.

**Permission justifications**

| Permission                               | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                | Saves the user's viewport sizes, saved groups and preferences locally so the workspace is restored next time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `activeTab`                              | When the user clicks the toolbar button, uses the keyboard shortcut or the context menu, reads the current tab's URL so that page can be previewed. No access otherwise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `contextMenus`                           | Adds “Preview this page/link in Breakpointer” to the right-click menu.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `declarativeNetRequestWithHostAccess`    | Many sites send X-Frame-Options or CSP frame-ancestors, which prevents showing them in the preview frames. Others refuse requests marked as frame loads (Fetch Metadata `Sec-Fetch-Dest: iframe`). For sites the user explicitly allows, a session rule removes these headers and marks the request as a document load, only for sub-frame requests in the Breakpointer tab. It does nothing without user-granted host access and never affects normal browsing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `sidePanel`                              | Shows a preview of the page the user is browsing, at a phone or other preset size, in Chrome's side panel — opened from the popup or the context menu. It reads the active tab's URL only when the user granted access to that site or just invoked the extension (activeTab).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `scripting`                              | While a Breakpointer workspace tab is open, registers the extension's own packaged script so it runs inside the preview frames of sites the user has allowed (synced scrolling and navigation, responsive checks, the element inspector, reading the page's breakpoints from its stylesheets, light/dark page colours and reduced-motion styles, paused animations, layout stress tests that pseudo-translate text or switch to right-to-left inside the preview only, layout outlines, user-entered live CSS, reporting the scroll position for a design overlay, measuring the page for the audit, the width scanner and Check pages — load numbers, type sizes, text and background colours — labelling grid and flex layouts, accessibility checks that report which elements lack a text alternative, name or label, hiding the banners of common consent tools with a style when the user asks, repeating the user's clicks and field values in the other previews of the same page when the user turns on synced interactions — never form submissions, passwords or payment fields — and, when the user asks Check pages to add them, listing the addresses of the page's links to other pages of the same site). The script exits at once in any other frame, reports only to the workspace tab, and is unregistered when the last workspace closes. No remote code. |
| Optional host permissions (`<all_urls>`) | Requested at runtime only when the user clicks “Allow on this site” (only that site is requested), “Allow on all sites” or “Allow these sites” in Check pages (only the sites in their list), or when they first take a screenshot (`chrome.tabs.captureVisibleTab` requires `<all_urls>`). With a site allowed, Check pages can also read that site's robots.txt and sitemap (without cookies) to list its pages. Users can revoke access in the extension.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Remote code:** No. All code, including the script that runs in previews, is packaged with the extension. Live CSS is CSS text the user types for their own previews; it is never executed as code.

**Data usage:** The extension does not collect or transmit any user data. (Check: none of the data categories apply.) A Breakpointer Pro licence key the user enters is verified offline and stays in the browser; it is not collected. Certify: not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.

**Privacy policy URL:** https://github.com/Tanx-1811/breakpointer/blob/main/docs/PRIVACY.md

## Support

- Support URL: https://github.com/Tanx-1811/breakpointer/issues (or a support email, if you prefer).
- Homepage: https://github.com/Tanx-1811/breakpointer
