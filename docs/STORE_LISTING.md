# Chrome Web Store listing

Copy-ready text and the answers the store asks for. Assets live in `brand/` (see `brand/README.md`).

## Basics

| Field                      | Value                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Name (from manifest)       | Breakpointer — Responsive Viewport Tester                                                |
| Category                   | Developer Tools                                                                          |
| Languages                  | English (default), Vietnamese                                                            |
| Store icon                 | `brand/store/store-icon-128.png`                                                         |
| Small promo tile (440×280) | `brand/store/promo-small-440x280.png` · VI: `promo-small-440x280-vi.png`                 |
| Marquee (1400×560)         | `brand/store/promo-marquee-1400x560.png` · VI: `promo-marquee-1400x560-vi.png`           |
| Screenshots (1280×800)     | `brand/store/screenshots/en/1-workspace.png` … `5-settings.png` · VI: `screenshots/vi/…` |

## Short description (≤ 132 characters)

- **EN:** Preview websites at multiple viewport sizes and check responsive layouts directly in Chrome.
- **VI:** Xem trước website ở nhiều kích thước viewport và kiểm tra bố cục responsive ngay trong Chrome.

## Detailed description — English

Find where your layout breaks — at every screen size, at once.

Breakpointer shows any website at several viewport sizes side by side, right in Chrome. Each preview gets a real layout width and height, so media queries and responsive layouts behave exactly as they would in a window that size.

**Preview fast**
• Click the toolbar button and choose “Preview this page”, right-click any page or link, press Alt+Shift+P, or type “bpt” and a URL in the address bar.
• 15 common sizes for phones, tablets, laptops and desktops, plus any custom size.
• Rotate, resize, rename, reorder, duplicate, hide and reload each viewport.
• Zoom each preview or press Fit to see everything on one screen.

**Check responsive layouts**
• Breakpoint labels for Tailwind and Bootstrap show which breakpoint each viewport is in.
• Pixel rulers on every preview.
• Screenshots of a single preview or the whole workspace.
• Open any preview in a real window of the exact size.

**Work your way**
• Save viewport groups like “Checkout QA” and switch in one click; six built-in groups included.
• Export and import your setup to share it with your team.
• Light and dark themes, keyboard shortcuts, English and Vietnamese.

**Private by design**
• No account, no analytics, no server. Settings stay in your browser.
• No access to your sites at install. Some sites block being shown inside other pages; you can allow Breakpointer on those sites (or all sites) when you need to, and remove access anytime.

**Good to know**
Breakpointer changes the viewport size; it doesn’t emulate a device’s user agent, pixel density, touch input or browser engine. Sign-in state and third-party cookies can behave differently inside previews.

## Detailed description — Tiếng Việt

Tìm chỗ bố cục bị vỡ — ở mọi kích thước màn hình, cùng lúc.

Breakpointer hiển thị bất kỳ website nào ở nhiều kích thước viewport đặt cạnh nhau, ngay trong Chrome. Mỗi bản xem trước có chiều rộng và chiều cao dàn trang thật, nên media query và bố cục responsive hoạt động đúng như trong một cửa sổ cùng kích thước.

**Xem trước thật nhanh**
• Bấm nút trên thanh công cụ và chọn “Xem trước trang này”, chuột phải vào trang hoặc liên kết, nhấn Alt+Shift+P, hoặc gõ “bpt” và URL trên thanh địa chỉ.
• 15 kích thước phổ biến cho điện thoại, máy tính bảng, laptop và máy bàn, cùng kích thước tùy chỉnh.
• Xoay, đổi kích thước, đổi tên, sắp xếp, nhân bản, ẩn và tải lại từng viewport.
• Thu phóng từng bản xem trước hoặc bấm “Vừa màn hình” để thấy tất cả trên một màn hình.

**Kiểm tra bố cục responsive**
• Nhãn breakpoint Tailwind và Bootstrap cho biết mỗi viewport đang ở breakpoint nào.
• Thước đo pixel trên mỗi bản xem trước.
• Chụp ảnh một bản xem trước hoặc cả vùng làm việc.
• Mở bất kỳ bản xem trước nào trong một cửa sổ thật đúng kích thước.

**Làm việc theo cách của bạn**
• Lưu nhóm viewport như “Kiểm thử thanh toán” và chuyển đổi chỉ với một cú bấm; có sẵn sáu nhóm.
• Xuất và nhập cấu hình để chia sẻ với nhóm của bạn.
• Giao diện sáng và tối, phím tắt, tiếng Anh và tiếng Việt.

**Tôn trọng quyền riêng tư**
• Không tài khoản, không theo dõi, không máy chủ. Cài đặt chỉ nằm trong trình duyệt của bạn.
• Không truy cập trang web nào khi cài đặt. Một số trang chặn hiển thị bên trong trang khác; bạn có thể cho phép Breakpointer trên những trang đó (hoặc mọi trang) khi cần, và gỡ quyền bất cứ lúc nào.

**Lưu ý**
Breakpointer thay đổi kích thước viewport; không giả lập user agent, mật độ điểm ảnh, cảm ứng hay nhân trình duyệt của thiết bị. Trạng thái đăng nhập và cookie bên thứ ba có thể hoạt động khác trong bản xem trước.

## Privacy practices tab

**Single purpose:** Preview web pages at multiple viewport sizes side by side to check responsive layouts.

**Permission justifications**

| Permission                               | Justification                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage`                                | Saves the user's viewport sizes, saved groups and preferences locally so the workspace is restored next time.                                                                                                                                                                                                                  |
| `activeTab`                              | When the user clicks the toolbar button, uses the keyboard shortcut or the context menu, reads the current tab's URL so that page can be previewed. No access otherwise.                                                                                                                                                       |
| `contextMenus`                           | Adds “Preview this page/link in Breakpointer” to the right-click menu.                                                                                                                                                                                                                                                         |
| `declarativeNetRequestWithHostAccess`    | Many sites send X-Frame-Options or CSP frame-ancestors, which prevents showing them in the preview frames. For sites the user explicitly allows, a session rule removes these headers only for sub-frame requests in the Breakpointer tab. It does nothing without user-granted host access and never affects normal browsing. |
| Optional host permissions (`<all_urls>`) | Requested at runtime only when the user clicks “Allow on this site” (only that site is requested) or “Allow on all sites”, or when they first take a screenshot (`chrome.tabs.captureVisibleTab` requires `<all_urls>`). Users can revoke access in the extension.                                                             |

**Remote code:** No. All code is packaged with the extension.

**Data usage:** The extension does not collect or transmit any user data. (Check: none of the data categories apply.) Certify: not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.

**Privacy policy URL:** https://github.com/Tanx-1811/breakpointer/blob/main/docs/PRIVACY.md

## Support

- Support URL: https://github.com/Tanx-1811/breakpointer/issues (or a support email, if you prefer).
- Homepage: https://github.com/Tanx-1811/breakpointer
