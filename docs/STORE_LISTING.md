# Chrome Web Store listing

Copy-ready text and the answers the store asks for. Assets live in `brand/` (see `brand/README.md`).

## Basics

| Field                      | Value                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name (from manifest)       | Breakpointer — Responsive Viewport Tester                                                                                                                                                                                             |
| Category                   | Developer Tools                                                                                                                                                                                                                       |
| Languages                  | English (default), Vietnamese                                                                                                                                                                                                         |
| Store icon                 | `brand/store/store-icon-128.png`                                                                                                                                                                                                      |
| Small promo tile (440×280) | `brand/store/promo-small-440x280.png` · VI: `promo-small-440x280-vi.png`                                                                                                                                                              |
| Marquee (1400×560)         | `brand/store/promo-marquee-1400x560.png` · VI: `promo-marquee-1400x560-vi.png`                                                                                                                                                        |
| Screenshots (1280×800)     | Upload five, in this order: `1-workspace`, `6-inspector`, `8-resize`, `7-palette`, `5-checks` (all in `brand/store/screenshots/en/`, `.png`) · VI: `screenshots/vi/…` · also available: `2-groups`, `3-add-viewport`, `4-dark-rulers` |

## Short description (≤ 132 characters)

- **EN:** Preview websites at multiple viewport sizes and check responsive layouts directly in Chrome.
- **VI:** Xem trước website ở nhiều kích thước viewport và kiểm tra bố cục responsive ngay trong Chrome.

## Detailed description — English

Find where your layout breaks — at every screen size, at once.

Breakpointer shows any website at several viewport sizes side by side, right in Chrome. Each preview gets a real layout width and height, so media queries and responsive layouts behave exactly as they would in a window that size.

**Preview fast**
• Click the toolbar button and choose “Preview this page”, right-click any page or link, press Alt+Shift+P, or type “bpt” and a URL in the address bar.
• 22 common sizes for phones, foldables, tablets, laptops and desktops (search by name or size), plus any custom size.
• Drag a preview's edge to resize it and watch the page reflow live — it snaps to your breakpoints.
• Press Ctrl/⌘ + K to search every command, size, group and page.

**Find where it breaks**
• Inspector: click an element in one preview and compare its size, display, font, spacing and layout at every size — what changes is highlighted.
• Breakpoints read from the page's own CSS, plus Tailwind, Bootstrap or your own — label every viewport and test both sides of each breakpoint.
• Light and dark side by side: show any preview with the page's light or dark styles.
• Responsive checks find sideways scrolling (and the element causing it), a missing viewport tag, tiny text and small touch targets — highlight them right in the page.
• Scroll one preview and the others show the same content; click a link and every preview opens it.
• Layout outlines, a column grid, pixel rulers, hidden scrollbars and live CSS applied to every size at once — save the CSS you use often as snippets.
• Compare two addresses: a second preview next to every viewport, e.g. staging next to production, following the same pages.
• Simulate colour blindness and blurred vision, reduced motion and paused animations, and stress the layout with longer translated text and right-to-left.
• Measure in CSS pixels, check colour contrast against WCAG with an eyedropper, and lay a design mockup over a preview to compare pixel by pixel.
• Open every viewport as a real window of its exact size (for sites that need your sign-in), keep an always-on-top floating preview next to your editor, or preview the page you're browsing in the side panel.
• Full-page screenshots, text spacing (WCAG), prefers-contrast and print styles, image-size and tab-order labels, and a baseline grid.

**Share what you see**
• Screenshots of one preview or the workspace, every viewport in one labelled image, copy to the clipboard, and an HTML report of every size with its issues.
• Open any preview in a real window of the exact size.

**Work your way**
• Save viewport groups like “Checkout QA” and switch in one click; six built-in groups included.
• Focus on one viewport, go back and forward between pages, star the pages you test often, zoom with Ctrl/⌘ + wheel and pan with Space + drag.
• Export and import your setup to share it with your team.
• A clean light and dark design, keyboard shortcuts for everything, English and Vietnamese.

**Private by design**
• No account, no analytics, no server. Settings stay in your browser.
• No access to your sites at install. Some sites block being shown inside other pages, and the in-page tools need your permission too; you can allow Breakpointer on a site (or all sites) when you need to, and remove access anytime.

**Good to know**
Breakpointer changes the viewport size; it doesn’t emulate a device’s user agent, pixel density, touch input or browser engine. Sign-in state and third-party cookies can behave differently inside previews.

## Detailed description — Tiếng Việt

Tìm chỗ bố cục bị vỡ — ở mọi kích thước màn hình, cùng lúc.

Breakpointer hiển thị bất kỳ website nào ở nhiều kích thước viewport đặt cạnh nhau, ngay trong Chrome. Mỗi bản xem trước có chiều rộng và chiều cao dàn trang thật, nên media query và bố cục responsive hoạt động đúng như trong một cửa sổ cùng kích thước.

**Xem trước thật nhanh**
• Bấm nút trên thanh công cụ và chọn “Xem trước trang này”, chuột phải vào trang hoặc liên kết, nhấn Alt+Shift+P, hoặc gõ “bpt” và URL trên thanh địa chỉ.
• 22 kích thước phổ biến cho điện thoại, máy gập, máy tính bảng, laptop và máy bàn (tìm theo tên hoặc kích thước), cùng kích thước tùy chỉnh.
• Kéo cạnh bản xem trước để đổi kích thước và xem trang dàn lại ngay — tự bắt dính vào breakpoint.
• Nhấn Ctrl/⌘ + K để tìm mọi lệnh, kích thước, nhóm và trang.

**Tìm chỗ bị vỡ**
• Soi phần tử: bấm một phần tử ở một bản xem trước để so sánh kích thước, display, font, khoảng cách và bố cục ở mọi kích thước — chỗ thay đổi được đánh dấu.
• Breakpoint đọc từ chính CSS của trang, cùng Tailwind, Bootstrap hoặc của riêng bạn — gắn nhãn mọi viewport và thử hai bên mỗi breakpoint.
• Sáng và tối cạnh nhau: hiển thị bản xem trước với kiểu sáng hoặc tối của trang.
• Kiểm tra responsive phát hiện cuộn ngang (và phần tử gây ra), thiếu thẻ viewport, chữ quá nhỏ và vùng chạm quá nhỏ — đánh dấu ngay trên trang.
• Cuộn một bản xem trước thì các bản khác hiện đúng nội dung đó; bấm liên kết thì mọi bản cùng mở trang đó.
• Viền bố cục, lưới cột, thước đo pixel, ẩn thanh cuộn và CSS trực tiếp áp dụng cho mọi kích thước cùng lúc — lưu những đoạn CSS hay dùng để áp dụng lại.
• So sánh hai địa chỉ: thêm một bản xem trước cạnh mỗi viewport, ví dụ bản staging cạnh bản chính thức, đi theo cùng các trang.
• Mô phỏng mù màu và nhìn mờ, giảm chuyển động và tạm dừng hiệu ứng động, thử độ bền bố cục với chữ dịch dài hơn và hướng phải sang trái.
• Đo theo pixel CSS, kiểm tra độ tương phản màu theo WCAG bằng ống hút màu, và phủ ảnh thiết kế lên bản xem trước để so từng pixel.
• Mở mỗi viewport thành một cửa sổ thật đúng kích thước (cho trang cần đăng nhập), giữ một bản xem trước nổi luôn trên cùng cạnh trình soạn code, hoặc xem nhanh trang đang mở ở thanh bên.
• Chụp toàn trang, giãn chữ (WCAG), tương phản cao và kiểu in, nhãn kích thước ảnh và thứ tự Tab, lưới baseline.

**Chia sẻ điều bạn thấy**
• Chụp một bản xem trước hoặc cả vùng làm việc, ghép mọi viewport thành một ảnh có nhãn, chép vào bộ nhớ tạm, và xuất báo cáo HTML cho mọi kích thước kèm các vấn đề.
• Mở bất kỳ bản xem trước nào trong một cửa sổ thật đúng kích thước.

**Làm việc theo cách của bạn**
• Lưu nhóm viewport như “Kiểm thử thanh toán” và chuyển đổi chỉ với một cú bấm; có sẵn sáu nhóm.
• Tập trung vào một viewport, quay lại/tới giữa các trang, đánh dấu sao trang hay kiểm tra, thu phóng bằng Ctrl/⌘ + lăn chuột và kéo vùng làm việc bằng Space + kéo.
• Xuất và nhập cấu hình để chia sẻ với nhóm của bạn.
• Thiết kế sáng và tối gọn gàng, phím tắt cho mọi thứ, tiếng Anh và tiếng Việt.

**Tôn trọng quyền riêng tư**
• Không tài khoản, không theo dõi, không máy chủ. Cài đặt chỉ nằm trong trình duyệt của bạn.
• Không truy cập trang web nào khi cài đặt. Một số trang chặn hiển thị bên trong trang khác, và các công cụ chạy trong trang cũng cần bạn cho phép; bạn có thể cho phép Breakpointer trên một trang (hoặc mọi trang) khi cần, và gỡ quyền bất cứ lúc nào.

**Lưu ý**
Breakpointer thay đổi kích thước viewport; không giả lập user agent, mật độ điểm ảnh, cảm ứng hay nhân trình duyệt của thiết bị. Trạng thái đăng nhập và cookie bên thứ ba có thể hoạt động khác trong bản xem trước.

## Privacy practices tab

**Single purpose:** Preview web pages at multiple viewport sizes side by side to check responsive layouts.

**Permission justifications**

| Permission                               | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                | Saves the user's viewport sizes, saved groups and preferences locally so the workspace is restored next time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `activeTab`                              | When the user clicks the toolbar button, uses the keyboard shortcut or the context menu, reads the current tab's URL so that page can be previewed. No access otherwise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `contextMenus`                           | Adds “Preview this page/link in Breakpointer” to the right-click menu.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `declarativeNetRequestWithHostAccess`    | Many sites send X-Frame-Options or CSP frame-ancestors, which prevents showing them in the preview frames. Others refuse requests marked as frame loads (Fetch Metadata `Sec-Fetch-Dest: iframe`). For sites the user explicitly allows, a session rule removes these headers and marks the request as a document load, only for sub-frame requests in the Breakpointer tab. It does nothing without user-granted host access and never affects normal browsing.                                                                                                                                                                                                                                                            |
| `sidePanel`                              | Shows a preview of the page the user is browsing, at a phone or other preset size, in Chrome's side panel — opened from the popup or the context menu. It reads the active tab's URL only when the user granted access to that site or just invoked the extension (activeTab).                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `scripting`                              | While a Breakpointer workspace tab is open, registers the extension's own packaged script so it runs inside the preview frames of sites the user has allowed (synced scrolling and navigation, responsive checks, the element inspector, reading the page's breakpoints from its stylesheets, light/dark page colours and reduced-motion styles, paused animations, layout stress tests that pseudo-translate text or switch to right-to-left inside the preview only, layout outlines, user-entered live CSS, and reporting the scroll position for a design overlay). The script exits at once in any other frame, reports only to the workspace tab, and is unregistered when the last workspace closes. No remote code. |
| Optional host permissions (`<all_urls>`) | Requested at runtime only when the user clicks “Allow on this site” (only that site is requested) or “Allow on all sites”, or when they first take a screenshot (`chrome.tabs.captureVisibleTab` requires `<all_urls>`). Users can revoke access in the extension.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Remote code:** No. All code, including the script that runs in previews, is packaged with the extension. Live CSS is CSS text the user types for their own previews; it is never executed as code.

**Data usage:** The extension does not collect or transmit any user data. (Check: none of the data categories apply.) Certify: not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.

**Privacy policy URL:** https://github.com/Tanx-1811/breakpointer/blob/main/docs/PRIVACY.md

## Support

- Support URL: https://github.com/Tanx-1811/breakpointer/issues (or a support email, if you prefer).
- Homepage: https://github.com/Tanx-1811/breakpointer
