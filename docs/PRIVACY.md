# Breakpointer Privacy Policy

_Last updated: 16 October 2026 · Applies to Breakpointer 0.4.0 and later_

Breakpointer is a Chrome extension for previewing websites at several viewport sizes. It is built to work entirely inside your browser.

## The short version

- Breakpointer **does not collect, sell, share or transmit** any personal data or browsing data.
- There is **no account, no server, no analytics and no tracking**.
- Your settings are stored **only in your browser** (`chrome.storage.local`), and visual-check baselines in the extension's own database in your browser (IndexedDB).
- Breakpointer **never stores or sends the content** of the pages you preview. On sites you allowed, a small script inside the previews measures the layout for its tools; what it finds stays in the Breakpointer tab.

## What is stored on your device

| Data                                                                                                                         | Purpose                                 | When                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Viewport list (names, sizes, zoom, visibility, order, light/dark page colours)                                               | Restore your workspace                  | Always                                                                                             |
| Saved viewport groups                                                                                                        | Switch setups quickly                   | When you save a group                                                                              |
| Preferences (theme, language, layout, breakpoint labels and your custom breakpoints, rulers, grid, sync and checks switches, the checks you switched off) | Restore your preferences                | Always                                                                                             |
| Saved pages (up to 30)                                                                                                       | Quick access to pages you starred       | **Only when you star a page.** Remove them in Settings → Saved pages. Included in exports.         |
| Side panel size (a preset and its orientation)                                                                               | Show the side panel the same way        | When you change it in the side panel                                                               |
| Saved CSS snippets (up to 20)                                                                                                | Apply CSS you use often again           | **Only when you save a snippet** in Live CSS. Delete them there. Included in exports.              |
| Last previewed address                                                                                                       | Reopen the workspace where you left off | When you preview a page                                                                            |
| Recent addresses (up to 10)                                                                                                  | Quick access                            | **Only if you turn on "Remember recent addresses"** (off by default). Turning it off deletes them. |
| Visual-check baselines: a screenshot of each viewport of a page, with the page's address and the viewport's size and name (up to 400, oldest removed first) | Compare a page with how it looked before | **Only when you save a baseline.** Kept in the extension's IndexedDB, never exported or synced. Delete them in the Visual check or Settings → Backup & reset. |
| Sites you allowed "until Chrome closes" (site patterns)                                                                      | Remove that access when Chrome starts again | **Only when you choose it.** Cleared when Chrome starts and the access is removed.                 |
| The version whose news you last saw                                                                                          | Show what's new once after an update    | After an update, when you open Help                                                                |

This data stays in your Chrome profile. It is removed when you uninstall the extension. You can export it to a JSON file yourself (Settings → Export settings); exports never include recent or last addresses, baselines or site access.

## Pages you preview

Previews are ordinary page loads made by your browser, the same as visiting the site in a tab. The websites you preview receive the requests your browser normally sends (including their own cookies).

**On sites you have allowed**, while a Breakpointer workspace is open, Breakpointer runs a small script (packaged with the extension) inside the preview frames to provide synced scrolling and navigation, responsive checks, highlights, the inspector, the page's breakpoints, light/dark page colours, reduced-motion styles, paused animations, the layout stress tests, layout outlines, hidden scrollbars, live CSS and a design overlay that follows the page's scroll. Chrome may load it into other frames of allowed sites during that time, but it stops immediately unless it is a preview inside the Breakpointer workspace. In a preview it reads only what these tools need — the page address and title, the HTTP status the page was served with (to point out a preview the site refused), the scroll position (with the position of the element in view, described by its place in the page structure), whether you just clicked or typed in it (not what or where), the page's mobile viewport tag, the widths used by the page's media queries, and layout measurements such as element sizes, font sizes and spacing, with short descriptions of elements (for example `div.hero > img`) — for an element you pick in the inspector, its layout values too. For the audit, the width scanner and the newer checks it also measures: how the page loaded (the number of files and how many bytes the browser reports for them, the pixel sizes of images, the largest contentful paint and layout shifts, the number of elements and web fonts), the font size, line height, weight and font family of the first heading, paragraph, link, button and field of each kind, the colours of text and of what is behind it, where lines of text are cut off by their box, and the columns and rows of grid containers. It never reads form fields or sends page text. To show a page's light or dark styles (or its reduced-motion styles), it changes those conditions of the page's stylesheets inside that preview only, and restores them when you switch back. The stress tests change the page itself, inside that preview only: "Longer text" replaces its visible text and placeholders with a pseudo-translation, and "Right to left" changes its text direction; the original text and direction are kept in the preview and put back when you switch them off. Nothing they change is read out, saved or sent. This information goes only to the Breakpointer tab and is kept in memory; it is never sent anywhere. Two things can be saved, both only on your device: when you follow a link in a preview and the others follow it, the new address becomes the workspace's address, exactly as if you had typed it (so it is remembered as the last address, and in recent addresses if you turned that on); and a report you export yourself. Addresses that look single-use or secret (sign-in callbacks with `code=` or `token=`, signed links) are never followed or remembered. The styles it adds (outlines, live CSS) affect only the previews and disappear when you turn them off or close the workspace. On sites you haven't allowed, no script runs.

When you compare two addresses, the second one is loaded in previews exactly like the first (the same rules apply to it) and is forgotten when you stop comparing or close the workspace. The width scanner loads the page once more, in its own preview, while its dialog is open; what it finds is kept in memory for the session. A workspace link you copy contains the page's address and your viewports' sizes and names; it goes only where you paste it.

For a site you have allowed, Breakpointer may send one request to check that it can be reached; it sends no cookies, reads nothing from the response and stops the download as soon as the server answers.

When you dismiss the tip about sites that block previews, the site's host name is remembered in memory (Chrome's session storage) so the tip doesn't come back; it is forgotten when Chrome closes.

## Permissions

| Permission                            | Why it is needed                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                             | Save your viewports, groups and preferences on your device.                                                                                                                                                                                                                                                                                                                                       |
| `activeTab`                           | Read the address of the current tab, only when you click the Breakpointer button or use its shortcut or menu, so you can preview that page.                                                                                                                                                                                                                                                       |
| `contextMenus`                        | Add "Preview in Breakpointer" to the right-click menu on pages and links.                                                                                                                                                                                                                                                                                                                         |
| `declarativeNetRequestWithHostAccess` | When you allow Breakpointer on a site, remove that site's frame-blocking headers (`X-Frame-Options`, `Content-Security-Policy`) from preview frames inside the Breakpointer tab, and tell the site those requests are for a page (`Sec-Fetch-Dest: document`) rather than a frame, so the site can be shown. It has no effect on sites you haven't allowed, on other tabs, or on normal browsing. |
| `sidePanel`                           | Show Breakpointer in Chrome's side panel, with the page you're browsing at a phone (or other) size. The panel reads the active tab's address only where Breakpointer may (sites you allowed, or right after you click Breakpointer), to show that page.                                                                                                                                           |
| `scripting`                           | While a workspace is open, register the small script described above so it can run inside previews of sites you allowed. It is removed when the last workspace closes.                                                                                                                                                                                                                            |
| Site access (optional)                | Requested only when you choose "Allow on this site" or "Allow on all sites", or when you first take a screenshot (Chrome requires access to all sites to capture a tab image). You can review and remove access at any time in Breakpointer → Site access, or in Chrome's extension settings.                                                                                                     |

## Screenshots, the clipboard and your images

Screenshots, the all-viewports image, element captures and reports are created in your browser and saved through Chrome's normal download flow. They are not uploaded anywhere. Visual-check baselines are compared in your browser and stay in it (see above). "Copy screenshot", "Copy selector", "Copy table", "Copy as Markdown", "Copy workspace link" and "Copy the page address" put the image or text on your clipboard only when you choose them; Breakpointer never reads the clipboard.

**Real windows** and the **floating preview** are ordinary browser windows showing the same address; nothing is read from them (capturing them takes screenshots only when you ask). A **full-page screenshot** scrolls the preview and hides its fixed elements for a moment while capturing, then puts both back. **Image size** and **tab order** labels are drawn inside the preview; nothing about the page is sent anywhere.

An image you lay over a preview (design overlay) is read from your computer into the Breakpointer tab and shown there only; it is not uploaded or stored, and it is released when you remove it or close the workspace. The contrast checker's eyedropper is Chrome's own: it gives Breakpointer only the colour of the one pixel you pick. Vision simulations and measuring are drawn over the previews and don't read the pages.

## History

Each address you preview becomes an entry in the Breakpointer tab's own back/forward history, like pages in any tab, so the back and forward buttons work. Nothing else is recorded.

## Children

Breakpointer is a developer tool and is not directed at children.

## Changes

If this policy changes, the new version will be published with the extension and the "Last updated" date will change. Material changes will be noted in the changelog.

## Contact

Questions or concerns: open an issue at https://github.com/Tanx-1811/breakpointer/issues or contact the publisher listed on the Chrome Web Store page.

---

## Tóm tắt (Tiếng Việt)

Breakpointer **không thu thập, không gửi đi, không chia sẻ** bất kỳ dữ liệu cá nhân hay dữ liệu duyệt web nào. Không có tài khoản, máy chủ, phân tích hay theo dõi. Cài đặt (kể cả trang bạn đánh dấu sao) chỉ được lưu trong trình duyệt của bạn. Breakpointer không lưu và không gửi nội dung các trang bạn xem trước. Trên những trang bạn đã cho phép, khi workspace đang mở, một đoạn script nhỏ chạy bên trong bản xem trước để đồng bộ cuộn/điều hướng, kiểm tra responsive, soi phần tử, đọc breakpoint của trang, hiển thị kiểu sáng/tối và giảm chuyển động, tạm dừng hiệu ứng động, thử độ bền bố cục, viền bố cục và CSS trực tiếp; nó chỉ đọc địa chỉ, tiêu đề, vị trí cuộn, độ rộng trong media query và số đo bố cục, không đọc ô nhập liệu hay nội dung chữ, và chỉ gửi kết quả cho tab Breakpointer. Khi thử độ bền bố cục (chữ dài hơn, phải sang trái), nội dung trang chỉ bị đổi bên trong bản xem trước và được trả lại khi tắt. Ảnh thiết kế bạn phủ lên bản xem trước chỉ nằm trong tab Breakpointer, không được tải lên hay lưu lại. Ảnh chụp, ảnh ghép và báo cáo được tạo ngay trong trình duyệt; Breakpointer chỉ ghi vào bộ nhớ tạm khi bạn chọn "Chép" và không bao giờ đọc bộ nhớ tạm. Quyền truy cập trang là **tùy chọn**, chỉ được xin khi bạn chủ động bật, và có thể gỡ bất cứ lúc nào. Danh sách địa chỉ gần đây chỉ được lưu khi bạn bật tùy chọn này (mặc định tắt). Bảng rà soát, quét chiều rộng và các kiểm tra mới chỉ đọc số đo (số tệp và dung lượng trang, kích thước ảnh, thời điểm hiển thị, độ xê dịch bố cục, cỡ chữ, màu chữ và màu nền, chỗ chữ bị cắt) và chỉ gửi cho tab Breakpointer. Ảnh mốc của tính năng kiểm tra hình ảnh chỉ được lưu khi bạn bấm lưu, nằm trong cơ sở dữ liệu của tiện ích ngay trong trình duyệt (IndexedDB), không có trong tệp xuất và xóa được trong Cài đặt. Quyền "đến khi đóng Chrome" được gỡ khi Chrome khởi động lại.
