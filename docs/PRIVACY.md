# Breakpointer Privacy Policy

_Last updated: 14 October 2026 · Applies to Breakpointer 0.3.0 and later_

Breakpointer is a Chrome extension for previewing websites at several viewport sizes. It is built to work entirely inside your browser.

## The short version

- Breakpointer **does not collect, sell, share or transmit** any personal data or browsing data.
- There is **no account, no server, no analytics and no tracking**.
- Your settings are stored **only in your browser** (`chrome.storage.local`).
- Breakpointer **never stores or sends the content** of the pages you preview. On sites you allowed, a small script inside the previews measures the layout for its tools; what it finds stays in the Breakpointer tab.

## What is stored on your device

| Data                                                                                                                         | Purpose                                 | When                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Viewport list (names, sizes, zoom, visibility, order, light/dark page colours)                                               | Restore your workspace                  | Always                                                                                             |
| Saved viewport groups                                                                                                        | Switch setups quickly                   | When you save a group                                                                              |
| Preferences (theme, language, layout, breakpoint labels and your custom breakpoints, rulers, grid, sync and checks switches) | Restore your preferences                | Always                                                                                             |
| Saved pages (up to 30)                                                                                                       | Quick access to pages you starred       | **Only when you star a page.** Remove them in Settings → Saved pages. Included in exports.         |
| Last previewed address                                                                                                       | Reopen the workspace where you left off | When you preview a page                                                                            |
| Recent addresses (up to 10)                                                                                                  | Quick access                            | **Only if you turn on "Remember recent addresses"** (off by default). Turning it off deletes them. |

This data stays in your Chrome profile. It is removed when you uninstall the extension. You can export it to a JSON file yourself (Settings → Export settings); exports never include recent or last addresses.

## Pages you preview

Previews are ordinary page loads made by your browser, the same as visiting the site in a tab. The websites you preview receive the requests your browser normally sends (including their own cookies).

**On sites you have allowed**, while a Breakpointer workspace is open, Breakpointer runs a small script (packaged with the extension) inside the preview frames to provide synced scrolling and navigation, responsive checks, highlights, the inspector, the page's breakpoints, light/dark page colours, layout outlines, hidden scrollbars and live CSS. Chrome may load it into other frames of allowed sites during that time, but it stops immediately unless it is a preview inside the Breakpointer workspace. In a preview it reads only what these tools need — the page address and title, the scroll position (with the position of the element in view, described by its place in the page structure), whether you just clicked or typed in it (not what or where), the page's mobile viewport tag, the widths used by the page's media queries, and layout measurements such as element sizes, font sizes and spacing, with short descriptions of elements (for example `div.hero > img`) — for an element you pick in the inspector, its layout values too. It never reads form fields or sends page text. To show a page's light or dark styles, it changes the colour-scheme conditions of the page's stylesheets inside that preview only, and restores them when you switch back. This information goes only to the Breakpointer tab and is kept in memory; it is never sent anywhere. Two things can be saved, both only on your device: when you follow a link in a preview and the others follow it, the new address becomes the workspace's address, exactly as if you had typed it (so it is remembered as the last address, and in recent addresses if you turned that on); and a report you export yourself. Addresses that look single-use or secret (sign-in callbacks with `code=` or `token=`, signed links) are never followed or remembered. The styles it adds (outlines, live CSS) affect only the previews and disappear when you turn them off or close the workspace. On sites you haven't allowed, no script runs.

For a site you have allowed, Breakpointer may send one request to check that it can be reached; it sends no cookies, reads nothing from the response and stops the download as soon as the server answers.

When you dismiss the tip about sites that block previews, the site's host name is remembered in memory (Chrome's session storage) so the tip doesn't come back; it is forgotten when Chrome closes.

## Permissions

| Permission                            | Why it is needed                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                             | Save your viewports, groups and preferences on your device.                                                                                                                                                                                                                                     |
| `activeTab`                           | Read the address of the current tab, only when you click the Breakpointer button or use its shortcut or menu, so you can preview that page.                                                                                                                                                     |
| `contextMenus`                        | Add "Preview in Breakpointer" to the right-click menu on pages and links.                                                                                                                                                                                                                       |
| `declarativeNetRequestWithHostAccess` | When you allow Breakpointer on a site, remove that site's frame-blocking headers (`X-Frame-Options`, `Content-Security-Policy`) from preview frames inside the Breakpointer tab, so the site can be shown. It has no effect on sites you haven't allowed, on other tabs, or on normal browsing. |
| `scripting`                           | While a workspace is open, register the small script described above so it can run inside previews of sites you allowed. It is removed when the last workspace closes.                                                                                                                          |
| Site access (optional)                | Requested only when you choose "Allow on this site" or "Allow on all sites", or when you first take a screenshot (Chrome requires access to all sites to capture a tab image). You can review and remove access at any time in Breakpointer → Site access, or in Chrome's extension settings.   |

## Screenshots and the clipboard

Screenshots, the all-viewports image and reports are created in your browser and saved through Chrome's normal download flow. They are not uploaded anywhere. "Copy screenshot" and "Copy selector" put the image or text on your clipboard only when you choose them; Breakpointer never reads the clipboard.

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

Breakpointer **không thu thập, không gửi đi, không chia sẻ** bất kỳ dữ liệu cá nhân hay dữ liệu duyệt web nào. Không có tài khoản, máy chủ, phân tích hay theo dõi. Cài đặt (kể cả trang bạn đánh dấu sao) chỉ được lưu trong trình duyệt của bạn. Breakpointer không lưu và không gửi nội dung các trang bạn xem trước. Trên những trang bạn đã cho phép, khi workspace đang mở, một đoạn script nhỏ chạy bên trong bản xem trước để đồng bộ cuộn/điều hướng, kiểm tra responsive, soi phần tử, đọc breakpoint của trang, hiển thị kiểu sáng/tối, viền bố cục và CSS trực tiếp; nó chỉ đọc địa chỉ, tiêu đề, vị trí cuộn, độ rộng trong media query và số đo bố cục, không đọc ô nhập liệu hay nội dung chữ, và chỉ gửi kết quả cho tab Breakpointer. Ảnh chụp, ảnh ghép và báo cáo được tạo ngay trong trình duyệt; Breakpointer chỉ ghi vào bộ nhớ tạm khi bạn chọn "Chép" và không bao giờ đọc bộ nhớ tạm. Quyền truy cập trang là **tùy chọn**, chỉ được xin khi bạn chủ động bật, và có thể gỡ bất cứ lúc nào. Danh sách địa chỉ gần đây chỉ được lưu khi bạn bật tùy chọn này (mặc định tắt).
