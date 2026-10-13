# Breakpointer Privacy Policy

_Last updated: 13 October 2026 · Applies to Breakpointer 0.1.0 and later_

Breakpointer is a Chrome extension for previewing websites at several viewport sizes. It is built to work entirely inside your browser.

## The short version

- Breakpointer **does not collect, sell, share or transmit** any personal data or browsing data.
- There is **no account, no server, no analytics and no tracking**.
- Your settings are stored **only in your browser** (`chrome.storage.local`).
- Breakpointer **never reads, stores or sends the content** of the pages you preview.

## What is stored on your device

| Data                                                             | Purpose                                 | When                                                                                               |
| ---------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Viewport list (names, sizes, zoom, visibility, order)            | Restore your workspace                  | Always                                                                                             |
| Saved viewport groups                                            | Switch setups quickly                   | When you save a group                                                                              |
| Preferences (theme, language, layout, breakpoint labels, rulers) | Restore your preferences                | Always                                                                                             |
| Last previewed address                                           | Reopen the workspace where you left off | When you preview a page                                                                            |
| Recent addresses (up to 10)                                      | Quick access                            | **Only if you turn on "Remember recent addresses"** (off by default). Turning it off deletes them. |

This data stays in your Chrome profile. It is removed when you uninstall the extension. You can export it to a JSON file yourself (Settings → Export settings); exports never include recent or last addresses.

## Pages you preview

Previews are ordinary page loads made by your browser, the same as visiting the site in a tab. The websites you preview receive the requests your browser normally sends (including their own cookies). Breakpointer does not inject scripts into those pages and does not read their content.

For a site you have allowed, Breakpointer may send one request to check that it can be reached; it sends no cookies, reads nothing from the response and stops the download as soon as the server answers.

When you dismiss the tip about sites that block previews, the site's host name is remembered in memory (Chrome's session storage) so the tip doesn't come back; it is forgotten when Chrome closes.

## Permissions

| Permission                            | Why it is needed                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                             | Save your viewports, groups and preferences on your device.                                                                                                                                                                                                                                     |
| `activeTab`                           | Read the address of the current tab, only when you click the Breakpointer button or use its shortcut or menu, so you can preview that page.                                                                                                                                                     |
| `contextMenus`                        | Add "Preview in Breakpointer" to the right-click menu on pages and links.                                                                                                                                                                                                                       |
| `declarativeNetRequestWithHostAccess` | When you allow Breakpointer on a site, remove that site's frame-blocking headers (`X-Frame-Options`, `Content-Security-Policy`) from preview frames inside the Breakpointer tab, so the site can be shown. It has no effect on sites you haven't allowed, on other tabs, or on normal browsing. |
| Site access (optional)                | Requested only when you choose "Allow on this site" or "Allow on all sites", or when you first take a screenshot (Chrome requires access to all sites to capture a tab image). You can review and remove access at any time in Breakpointer → Site access, or in Chrome's extension settings.   |

## Screenshots

Screenshots are created in your browser and saved through Chrome's normal download flow. They are not uploaded anywhere.

## Children

Breakpointer is a developer tool and is not directed at children.

## Changes

If this policy changes, the new version will be published with the extension and the "Last updated" date will change. Material changes will be noted in the changelog.

## Contact

Questions or concerns: open an issue at https://github.com/Tanx-1811/breakpointer/issues or contact the publisher listed on the Chrome Web Store page.

---

## Tóm tắt (Tiếng Việt)

Breakpointer **không thu thập, không gửi đi, không chia sẻ** bất kỳ dữ liệu cá nhân hay dữ liệu duyệt web nào. Không có tài khoản, máy chủ, phân tích hay theo dõi. Cài đặt chỉ được lưu trong trình duyệt của bạn. Breakpointer không đọc, không lưu và không gửi nội dung các trang bạn xem trước. Quyền truy cập trang là **tùy chọn**, chỉ được xin khi bạn chủ động bật, và có thể gỡ bất cứ lúc nào. Danh sách địa chỉ gần đây chỉ được lưu khi bạn bật tùy chọn này (mặc định tắt).
