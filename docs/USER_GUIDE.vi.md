# Hướng dẫn sử dụng Breakpointer

[English version](USER_GUIDE.md) · [Quyền riêng tư](PRIVACY.md) · [Kế hoạch sản phẩm](PLAN.md) · [Cách bản xem trước hoạt động](ARCHITECTURE.md#adr-001-how-a-page-is-rendered-at-a-viewport-size)

Breakpointer là tiện ích Chrome hiển thị một trang web ở nhiều kích thước viewport thật, đặt cạnh nhau, để bạn thấy — và xác định chính xác đến từng pixel — chỗ bố cục bị vỡ. Mỗi bản xem trước có một viewport dàn trang thật đúng kích thước bạn chọn: media query, container query và `window.innerWidth` phản hồi y như trong một cửa sổ trình duyệt cùng kích thước, còn thu phóng chỉ thay đổi tỉ lệ hình ảnh cho vừa màn hình. Breakpointer chỉ thay đổi viewport. Nó không giả lập user agent, mật độ điểm ảnh, cảm ứng hay nhân trình duyệt của thiết bị — những thứ đó vẫn là của Chrome bạn đang dùng.

Hướng dẫn này áp dụng cho Breakpointer 0.11. Tính năng có nhãn **Mới ở 0.11** ra mắt cùng phiên bản đó; tính năng có nhãn **(Pro)** thuộc [Breakpointer Pro](#breakpointer-pro); mọi thứ còn lại đều miễn phí.

## Mục lục

1. [Bắt đầu](#getting-started) — cài đặt, mở trang, quyền truy cập trang, màn hình chào, vừa dùng vừa học
2. [Vùng làm việc](#the-workspace) — viewport, kích thước có sẵn, nhóm, đổi kích thước, thu phóng, bố cục, chế độ tập trung, thanh bên, thanh trạng thái, breakpoint, dự án
3. [Tìm lỗi bố cục](#finding-layout-problems) — đồng bộ, kiểm tra, điểm, rà soát, quét chiều rộng, soi phần tử, Elements (HTML & CSS, Mới ở 0.13), đo, lớp phủ, so sánh A/B
4. [Mô phỏng và thử độ bền](#simulations-and-stress-tests) — thị lực, tùy chọn của trang, kiểu cho màn hình cảm ứng, chữ dài hơn, phải sang trái
5. [Kiểm thử thủ công](#manual-testing) — checklist kiểm thử, ghi chú và báo cáo lỗi
6. [Cả website và lỗi hồi quy](#whole-sites-and-regressions) — Kiểm tra nhiều trang, Kiểm tra hình ảnh
7. [Ảnh chụp, báo cáo và chia sẻ](#screenshots-reports-and-sharing) — chụp ảnh, chú thích ảnh chụp (Mới ở 0.12), ảnh trình diễn, báo cáo HTML, trình chiếu, tự cuộn, huy hiệu và lịch sử điểm, cửa sổ thật, xem trước nổi, thanh bên Chrome
8. [Bộ công cụ CSS](#css-toolkit) — Fluid type, đơn vị, breakpoint thành code, màu, tỉ lệ khung (Mới ở 0.11); Grid, mã ảnh, thử media query (Mới ở 0.12)
9. [Cài đặt](#settings)
10. [Breakpointer Pro](#breakpointer-pro)
11. [Phím tắt](#keyboard-shortcuts)
12. [Quyền riêng tư và quyền truy cập](#privacy-and-permissions)
13. [Xử lý sự cố và câu hỏi thường gặp](#troubleshooting-and-faq)

---

<a id="getting-started"></a>

## 1. Bắt đầu

### Cài đặt

1. Mở **[Breakpointer trên Chrome Web Store](https://chromewebstore.google.com/detail/naoadcallefanlcneemohjepkficejjh)** và bấm **Thêm vào Chrome**. Breakpointer miễn phí và cần Chrome 116 trở lên.
2. Ghim tiện ích: bấm biểu tượng mảnh ghép của Chrome rồi bấm ghim cạnh Breakpointer để nút của nó luôn nằm trên thanh công cụ.

Lưu ý: trên store có một tiện ích khác cũng tên “Breakpointer”. Hãy tìm đúng tên đầy đủ **Breakpointer — Kiểm tra giao diện responsive** (tiếng Anh: Breakpointer — Responsive Viewport Tester).

Không quyền nào hiện cảnh báo khi cài. Breakpointer chỉ xin quyền truy cập một trang khi bạn cần (xem [Quyền truy cập trang](#site-access)).

### Mở một trang

Chọn cách gần nhất với chỗ bạn đang đứng:

| Bạn đang ở đâu                 | Làm gì                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Trên trang cần kiểm tra        | Bấm nút Breakpointer (hoặc nhấn `Alt+Shift+V`) và chọn **Xem trước trang này**.                                                  |
| Bất kỳ đâu trong Chrome        | Nhấn `Alt+Shift+P` để xem trước tab hiện tại.                                                                                    |
| Trên một trang hoặc liên kết   | Chuột phải → **Xem trước trang này bằng Breakpointer** hoặc **Xem trước liên kết bằng Breakpointer**.                            |
| Trên thanh địa chỉ của Chrome  | Gõ `bpt`, dấu cách, rồi địa chỉ, và nhấn Enter.                                                                                  |
| Đang ở vùng làm việc           | Gõ hoặc dán địa chỉ vào thanh địa chỉ của vùng làm việc (nhấn `/` để nhảy tới) rồi nhấn Enter, hoặc bấm **Thử với example.com**. |
| Trong popup trên thanh công cụ | Gõ địa chỉ ở **Xem trước địa chỉ khác**, hoặc bấm một trang trong **Trang đã lưu** hay **Gần đây**.                              |

Popup còn cho bạn chọn trang sẽ mở với bộ **Viewport** nào — **Vùng làm việc hiện tại** hoặc một nhóm — và có **Mở vùng làm việc**, **Xem trước ở thanh bên** cùng **Phím tắt** đang dùng.

Chỉ xem trước được trang `http://` và `https://`. Chrome không cho tiện ích hiển thị trang `chrome://` hay Chrome Web Store. Với server dev chạy trên máy, hãy ghi cả cổng (ví dụ `localhost:5173`). Địa chỉ có tên đăng nhập hoặc mật khẩu (`user:pass@`) sẽ bị từ chối.

Bạn có thể đổi `Alt+Shift+V` và `Alt+Shift+P` tại `chrome://extensions/shortcuts` (hoặc **Cài đặt → Quyền riêng tư & truy cập → Tùy chỉnh phím tắt Chrome**).

<a id="site-access"></a>

### Quyền truy cập trang: vì sao Breakpointer hỏi

Nhiều trang yêu cầu trình duyệt không hiển thị chúng bên trong trang khác. Bản xem trước của những trang đó sẽ trống hoặc báo “refused to connect”. Breakpointer vẫn chạy mà không cần quyền gì với các trang cho phép nhúng, nhưng phần lớn công cụ của nó chạy một đoạn script nhỏ bên trong bản xem trước, và việc đó cần bạn cho phép trên trang ấy.

**Quyền truy cập trang mở khóa:** xem trước các trang chặn nhúng, cuộn và điều hướng đồng bộ, kiểm tra responsive, rà soát, quét chiều rộng, soi phần tử, breakpoint của chính trang, CSS trực tiếp, tùy chọn của trang và thử độ bền bố cục, ghi chú cuộn theo trang, và Kiểm tra nhiều trang. Mô phỏng thị lực, đo khoảng cách, phủ ảnh thiết kế và lưới cột chạy được trên mọi trang.

Để cho phép một trang:

1. Bấm **Cho phép trên _trang_** trong gợi ý phía trên bản xem trước bị chặn — hoặc bấm nút khiên trên thanh trên cùng (**Quyền truy cập trang**), hoặc phần quyền truy cập trên thanh trạng thái.
2. Chọn thời hạn:
   - **Cho phép trên _trang_** — đến khi bạn gỡ.
   - **Đến khi đóng Chrome** — quyền bị gỡ khi Chrome khởi động lại. Sau đó bạn có thể bấm **Giữ lại** trong Quyền truy cập trang.
   - **Cho phép trên mọi trang** — mọi trang web, kèm chụp ảnh (Chrome chỉ cho tiện ích chụp tab khi có quyền trên mọi trang).
3. Xác nhận hộp thoại của Chrome.

Quyền áp dụng cho cả tên miền đăng ký (`example.com` bao gồm `www.example.com` và `shop.example.com`). Bạn có thể xem lại hoặc gỡ quyền bất cứ lúc nào trong **Quyền truy cập trang** (danh sách **Các trang đã cho phép**) hoặc **Cài đặt → Quyền riêng tư & truy cập → Quản lý quyền truy cập trang**.

Khi trang chặn xem trước, gợi ý còn có **Mở trong tab mới** và **Không hiện lại**. Bật lại gợi ý trong **Cài đặt → Vùng làm việc → Gợi ý cho trang bị chặn**.

### Màn hình chào

Khi chưa mở trang nào, vùng làm việc hiện màn hình chào:

- **Thử với example.com** mở một trang mẫu.
- **Xem hướng dẫn nhanh** đi một lượt qua các nút chính (không bao giờ tự chạy).
- **Hướng dẫn** mở Trợ giúp ở danh sách hướng dẫn.
- **Mở lại** liệt kê các trang đã lưu (★) và gần đây, nếu có.
- Nhắc nhanh: `/` để nhập địa chỉ, `Ctrl/⌘ + K` để tìm mọi lệnh.

Lần đầu dùng, Breakpointer có sẵn ba viewport — **Điện thoại** 375 × 667, **Máy tính bảng** 768 × 1024 và **Laptop** 1366 × 768 — và tự thu phóng cho vừa màn hình khi trang đầu tiên hiện ra.

<a id="learn"></a>

### Vừa dùng vừa học

**Trung tâm trợ giúp** (`?`, hoặc nút **?** trên thanh trên cùng) có bốn mục — **Bắt đầu**, **Phím tắt**, **Có gì mới** và **Hỗ trợ** (góp ý, đánh giá, chia sẻ và, từ 0.11, liên kết tới **Hướng dẫn sử dụng** này) — cùng ô tìm kiếm hướng dẫn và phím tắt. Sau mỗi lần cập nhật, nó mở ở **Có gì mới**, và nút Trợ giúp có một chấm nhỏ cho đến khi bạn mở. Chrome tự cài bản cập nhật mà không báo gì, nên Breakpointer tự báo: biểu tượng trên thanh công cụ hiện **MỚI**, popup ghi phiên bản mới kèm nút **Xem có gì mới**, và workspace hiện một thông báo một lần.

**Danh sách bắt đầu.** Tám việc nên làm thử một lần, tự đánh dấu khi bạn làm xong: xem trước một trang, thêm hoặc đổi kích thước một viewport, soi một phần tử ở mọi kích thước, mở bảng rà soát, quét mọi chiều rộng, ghim một ghi chú lên bản xem trước, chụp màn hình và thử chế độ “Đây là gì?”. Mỗi việc có nút **Chỉ cho tôi**. Thanh trạng thái hiện **Bắt đầu 3/8** cho đến khi bạn làm xong hoặc chọn **Ẩn khỏi thanh trạng thái**. Mở danh sách từ Trợ giúp → **Bắt đầu**, từ thanh trạng thái, hoặc lệnh “Danh sách bắt đầu” trong bảng lệnh. Chỉ lưu việc nào đã xong, trên thiết bị này.

**Hướng dẫn.** Các bước đi kèm, mỗi thẻ chỉ vào đúng nút đang nói tới. Một bước có thể mở thứ nó giải thích (bảng rà soát, bảng soi, ghi chú, checklist kiểm thử) và bước cuối có thể bắt đầu luôn việc đó (**Quét ngay**, **Mở Kiểm tra nhiều trang**…). Mở từ Trợ giúp → **Bắt đầu** → **Hướng dẫn**, từ màn hình chào, từ chế độ “Đây là gì?”, hoặc gõ “Hướng dẫn” trong bảng lệnh.

| Hướng dẫn                         | Nội dung                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| Làm quen không gian làm việc      | Các nút chính, trong một lượt ngắn (tour)                                                 |
| Tìm chỗ bố cục bị vỡ              | Chọn kích thước, kéo giữa chúng và quét mọi chiều rộng                                    |
| Rà soát trang ở mọi kích thước    | Vấn đề, hiệu năng, kiểu chữ và hơn nữa, đặt cạnh nhau                                     |
| Tìm khoảng hở giữa các breakpoint | Các media query của trang và những chiều rộng lọt giữa chúng                              |
| So một phần tử ở mọi kích thước   | Kích thước, kiểu chữ và khoảng cách trong mọi bản xem trước                               |
| Báo lỗi bằng ghi chú              | Ghim chỗ sai và chép báo cáo lỗi soạn sẵn                                                 |
| Chạy danh sách kiểm tra QA        | Đánh dấu các mục kiểm tra thủ công ở mọi kích thước                                       |
| Phát hiện thay đổi hình ảnh       | Lưu ảnh gốc, sửa trang, xem cái gì đã dịch chuyển                                         |
| Kiểm tra cả trang web             | Nhiều trang ở mọi kích thước, trong một bảng                                              |
| Chia sẻ ảnh chụp                  | Ảnh vùng làm việc, ảnh trình diễn và chế độ trình chiếu                                   |
| Fluid type với Bộ công cụ CSS     | **Mới ở 0.11** — `clamp()`, đơn vị và breakpoint thành code, theo kích thước bạn đang xem |
| Thử kiểu cho màn hình cảm ứng     | **Mới ở 0.11** — menu và nút bấm trang hiển thị trên điện thoại, máy tính bảng            |
| Chữ dễ đọc ở mọi kích thước       | **Mới ở 0.11** — độ dài dòng, chữ nhỏ, phóng to và giãn chữ                               |
| Trình chiếu bản demo responsive   | **Mới ở 0.11** — bản xem trước toàn màn hình, tự cuộn                                     |
| Chú thích ảnh chụp                | **Mới ở 0.12** — mũi tên, khung, bước đánh số — và che thông tin riêng tư                 |
| Đưa ảnh responsive lên trang      | **Mới ở 0.12** — đúng kích thước, định dạng hiện đại và tải lười                          |
| Theo dõi điểm của trang           | **Mới ở 0.12** — xem điểm responsive tăng lên qua từng ngày                               |
| Đọc HTML và CSS của trang         | **Mới ở 0.13** — cây thẻ, CSS của từng phần tử và bản tổng quan                           |

Trong tài liệu này, dòng “Trong ứng dụng:” cho biết hướng dẫn nào đi qua cùng việc đó.

**Chế độ “Đây là gì?”** (`H`, Trợ giúp → **Bật**, hoặc bảng lệnh). Trỏ vào bất kỳ nút nào — hoặc di chuyển tiêu điểm bàn phím tới nó — để xem nó làm gì và phím tắt của nó. Bấm vào sẽ giữ thẻ mở thay vì kích hoạt nút, và **Chỉ cho tôi cách dùng** mở hướng dẫn tương ứng nếu có. Nhấn `Esc` hoặc **Xong** để thoát.

**Bảng lệnh** (`Ctrl/⌘ + K`, hoặc `K`, hoặc **Tìm…** trên thanh trên cùng). Mọi thao tác, kích thước có sẵn, nhóm, trang đã lưu hay gần đây, dự án, hướng dẫn và cài đặt trong một ô tìm kiếm. Gõ vài chữ rồi nhấn Enter; gõ một địa chỉ để xem trước nó. Bảng lệnh tìm được lệnh tiếng Việt không dấu và cả tên tiếng Anh.

---

<a id="the-workspace"></a>

## 2. Vùng làm việc

Vùng làm việc là tab Breakpointer. Từ trên xuống dưới:

- **Thanh trên cùng** — quay lại và tới, **Tải lại tất cả bản xem trước** (kèm menu tùy chọn tải lại), thanh địa chỉ với nút ★, **Mở trang trong tab mới**, **Mở thành cửa sổ thật**, **Xem trước nổi**, **Nâng cấp Pro** (ở gói miễn phí), **Tìm…**, menu **Chụp ảnh**, **Trình chiếu**, **Quyền truy cập trang**, nút đổi giao diện sáng/tối, **Cài đặt** và **Trợ giúp & phím tắt**.
- **Thanh vùng làm việc** — nút **Thanh bên viewport**, **Dự án**, **Nhóm**, một chip cho mỗi viewport, **Thêm viewport**, rồi **Breakpoint**, **Thước đo**, **Lưới**, **Đồng bộ**, **Soi**, **Rà soát**, **Đo**, **Ghi chú**, **Mô phỏng** và **Công cụ**. Khi cửa sổ hẹp hơn 1500 px, các nút bật/tắt này chỉ giữ biểu tượng, nhãn chuyển vào chú thích.
- **Bản xem trước** — một thẻ cho mỗi viewport đang hiện.
- **Thanh thu phóng** — nổi ở cạnh dưới: `−`, mức thu phóng, `+`, **Vừa màn hình** và bố cục.
- **Thanh trạng thái** — dọc cạnh dưới (xem [Thanh trạng thái và bản đồ thu nhỏ](#status-bar)).

### Thẻ bản xem trước

Mỗi thẻ là một viewport. Phần đầu thẻ có:

- **tên** — bấm để đổi tên viewport;
- **kích thước** — bấm vào chiều rộng hoặc chiều cao, gõ số từ 200 đến 3840 rồi nhấn Enter;
- mức **thu phóng** riêng của thẻ;
- **nhãn breakpoint** (khi bật nhãn breakpoint), nhãn **sáng/tối** khi thẻ hiện màu khác của trang, và nhãn **HTTP** khi trang trả lỗi;
- huy hiệu kiểm tra responsive (**✓** hoặc **⚠ n**);
- các nút **xoay** (dọc ↔ ngang), **tải lại**, **chụp ảnh**, **thao tác khác** (⋯) và **xóa** (có Hoàn tác).

Menu ⋯ gồm **Tập trung vào viewport này**, **Nhân bản**, **Chụp toàn trang**, **Chép ảnh chụp**, **Mở trong tab mới**, **Mở cửa sổ đúng kích thước này**, **Phủ ảnh thiết kế…**, **Chế độ màu của trang** (**Theo trình duyệt**, **Sáng**, **Tối**), **Chuyển sang trái**, **Chuyển sang phải** và **Ẩn**.

### Thêm viewport

1. Bấm **Thêm viewport** (hoặc nhấn `A`).
2. Tìm trong **Kích thước có sẵn** theo tên hoặc kích thước (“768”), hoặc lọc theo **Loại thiết bị**: điện thoại, máy gập, máy tính bảng, laptop, máy bàn. Mỗi kích thước có hình tỉ lệ khung; kích thước đã có trong vùng làm việc được đánh dấu **Đã có trong vùng làm việc**.
3. Bấm một kích thước — hoặc, ở **Kích thước tùy chỉnh**, nhập **Rộng**, **Cao** (200–3840 pixel CSS) và **Tên (không bắt buộc)**, dùng **Đổi chiều rộng và chiều cao** nếu cần, rồi bấm **Thêm viewport tùy chỉnh**.

Bạn có tối đa 8 viewport, tính cả viewport đang ẩn. 30 kích thước có sẵn trải từ điện thoại mini (320 × 568) đến màn 4K (3840 × 2160), đặt tên theo nhóm kích thước — phần gợi ý có nêu một thiết bị cùng cỡ, nhưng bản xem trước chỉ mang kích thước đó.

### Nhóm

Nhóm là một bộ viewport đã lưu, áp dụng bằng một cú bấm (`G`, hoặc **Nhóm** trên thanh vùng làm việc).

- Nhóm **Có sẵn**: Kích thước phổ biến nhất (360 × 800 đến 1920 × 1080), Responsive cơ bản, Kiểm thử điện thoại, Máy tính bảng, Laptop & máy bàn, Breakpoint Tailwind, Breakpoint Bootstrap và Reflow WCAG (phóng to 200–400%) — 320 × 256, 640 × 512 và 1280 × 1024, tức màn 1280 × 1024 ở mức 400%, 200% và 100%.
- **Lưu bố cục hiện tại thành nhóm…** lưu các viewport của bạn (kích thước, tên, màu trang) dưới một cái tên — tối đa 20 nhóm.
- **Quản lý nhóm…** để áp dụng (**Dùng**), đổi tên, cập nhật (**Thay bằng các viewport hiện tại**) hoặc xóa nhóm. Áp dụng hay xóa đều hoàn tác được.

### Thay đổi viewport

- **Hiện hoặc ẩn** — bấm vào chip của nó. Bản xem trước bị ẩn không tải trang.
- **Đổi thứ tự** — kéo chip, dùng **Chuyển sang trái / Chuyển sang phải** trong menu thẻ, hoặc nhấn `Alt + ←` / `Alt + →` khi chip đang có tiêu điểm.
- **Kéo để đổi kích thước** — kéo cạnh phải, cạnh dưới hoặc góc của thẻ và xem trang dàn lại trực tiếp. Cạnh tự bắt dính vào breakpoint đang dùng, có đường gióng và số đo kích thước, breakpoint hiện ngay. Giữ `Shift` để đi từng bước 10 px, `Alt` để tắt bắt dính. Tay nắm cũng dùng được bằng bàn phím (phím mũi tên, `Shift` cho 10 px).
- **Xoay tất cả** (Công cụ → **Sắp xếp**) — mọi viewport đang hiện cùng lúc, có Hoàn tác.
- **Sắp theo chiều rộng** (Công cụ → **Sắp xếp**) — từ hẹp đến rộng.
- **Nhân bản**, **Ẩn** và **xóa** từ thẻ.

Trong ứng dụng: **Tìm chỗ bố cục bị vỡ**.

### Thu phóng, Vừa màn hình và bố cục

Thu phóng chỉ đổi độ lớn hiển thị của bản xem trước, không bao giờ đổi kích thước trang dùng để dàn trang.

- **Vừa màn hình** (`F`) — mức thu phóng chung lớn nhất để mọi bản xem trước đang hiện vừa trong cửa sổ.
- `+` / `−` thu phóng tất cả; `0` về 100%; `Ctrl/⌘` + lăn chuột (hoặc chụm hai ngón trên trackpad) thu phóng mọi viewport, kể cả khi con trỏ nằm trên bản xem trước.
- Mỗi thẻ còn có mức thu phóng riêng.
- **Di chuyển**: giữ `Space` và kéo vùng làm việc.
- **Bố cục** (`L` để chuyển vòng): **Xuống dòng** (thẻ tự xuống hàng), **Một hàng** (một hàng cuộn ngang) và **Xếp dọc** (một cột ở giữa cuộn xuống; Vừa màn hình sẽ khớp thẻ rộng nhất với chiều ngang).

### Chế độ tập trung

Chỉ hiện một viewport, vừa khít màn hình: bấm đúp vào đầu thẻ hoặc chip của nó, chọn **Tập trung vào viewport này** trong menu thẻ, nhấn `1`–`8` cho viewport ở vị trí đó, hoặc `[` / `]` cho viewport trước hay sau. Nhấn lại cùng số đó, **Hiện tất cả**, hoặc `Esc` để đưa các viewport khác trở lại — chúng không phải tải lại.

<a id="sidebar"></a>

### Thanh bên viewport

Danh sách mọi viewport kèm bản đồ cho thấy mỗi viewport nằm ở đâu giữa các breakpoint (`\`, nút thanh bên ở đầu thanh vùng làm việc, thanh trạng thái, bảng lệnh, hoặc **Cài đặt → Giao diện → Thanh bên viewport**). Mặc định tắt.

- Mỗi hàng cho biết kích thước, breakpoint và các loại vấn đề của viewport. Bấm một hàng để tới bản xem trước (tự hiện nếu đang ẩn), bấm đúp để xem riêng nó, dùng biểu tượng con mắt để ẩn/hiện, kéo hoặc nhấn `Alt + ↑` / `Alt + ↓` để đổi thứ tự.
- **Bản đồ breakpoint** đặt các viewport của bạn cạnh breakpoint đang dùng. Chọn một bộ breakpoint trên thanh công cụ để thấy mỗi viewport nằm ở phía nào của từng breakpoint.
- Thẻ **Trang** cho biết tiêu đề trang, mã HTTP, quyền truy cập trang (có nút **Cho phép** khi chưa có quyền) và **Điểm responsive** — bấm vào để mở bảng rà soát.

Khi thanh bên đang mở trên cửa sổ rộng, nó thay chỗ các chip viewport trên thanh công cụ.

<a id="status-bar"></a>

### Thanh trạng thái và bản đồ thu nhỏ

**Thanh trạng thái** (mặc định bật) tóm tắt vùng làm việc, và phần lớn các mục trên đó là lối tắt: số bản xem trước đang hiện và đang ẩn, lỗi HTTP của trang, quyền truy cập trang (mở Quyền truy cập trang), đồng bộ (bật/tắt), số loại vấn đề (mở bảng rà soát), bộ breakpoint, khoảng chiều rộng, mức thu phóng (bấm để vừa màn hình), bố cục, thanh bên, bản đồ thu nhỏ và **Bắt đầu n/8**.

**Bản đồ thu nhỏ** (mặc định bật) hiện ra khi vùng làm việc cuộn: toàn cảnh mọi bản xem trước theo màu nhóm kích thước, kèm phần đang nằm trên màn hình. Bấm hoặc kéo trên bản đồ để cuộn tới đó.

Bật/tắt cả hai trong **Cài đặt → Giao diện → Bảng phụ** hoặc bảng lệnh.

<a id="breakpoints"></a>

### Nhãn breakpoint, thước đo và lưới

**Breakpoint** (thanh vùng làm việc) gắn nhãn cho mỗi thẻ theo breakpoint mà chiều rộng của nó rơi vào, quyết định chỗ bắt dính khi kéo đổi kích thước, và cung cấp dữ liệu cho bản đồ breakpoint, biểu đồ quét chiều rộng và **Thử mép breakpoint**. Bạn chọn:

- bộ breakpoint của một framework — Tailwind, Bootstrap, Material UI, Chakra UI, Ant Design, Bulma hoặc Foundation;
- **Tùy chỉnh** — danh sách của riêng bạn, sửa ở **Cài đặt → Vùng làm việc → Breakpoint tùy chỉnh** (mỗi breakpoint gồm tên và chiều rộng tối thiểu, tối đa 8);
- **Trang này (n)** — các chiều rộng dùng trong media query của chính trang (trên trang bạn cho phép). Nếu CSS của trang nằm ở tên miền khác thì không đọc được, nên chưa biết breakpoint của trang. Nút **Dùng của trang này** trong Cài đặt chép chúng vào danh sách tùy chỉnh;
- **Không nhãn**.

**Thử mép breakpoint** (Công cụ → **Sắp xếp**) thay các viewport bằng những viewport nằm ở hai phía của mỗi breakpoint đang dùng — ví dụ 767 và 768 — vừa khít màn hình, có Hoàn tác (dùng bộ của Tailwind khi chưa chọn nhãn nào).

**Thước đo** (`M`) — thước pixel dọc theo mỗi bản xem trước, có đánh dấu breakpoint.

**Lưới** — lưới cột phủ lên mọi bản xem trước: tự động 4 / 8 / 12 cột theo chiều rộng hoặc số cột cố định, kèm khoảng cách cột, lề và lưới baseline (tùy chọn) cách mỗi 4–24 px, chỉnh trong **Cài đặt → Công cụ xem trước → Lưới cột**.

### Màu sáng và tối của trang

Cho bất kỳ bản xem trước nào hiện kiểu sáng hoặc tối của trang (`prefers-color-scheme`), bất kể trình duyệt của bạn đang ưu tiên gì: menu ⋯ của thẻ → **Chế độ màu của trang** → **Sáng** hoặc **Tối** (trên trang bạn cho phép). Muốn so sáng và tối cạnh nhau, hãy **Nhân bản** một viewport rồi đặt mỗi bản một chế độ. Lựa chọn được lưu cùng viewport và trong nhóm đã lưu. Muốn đổi mọi bản xem trước cùng lúc, dùng **Mô phỏng → Màu trang của mọi bản xem trước**.

### Thanh địa chỉ, trang và tải lại

- **★** lưu trang (tối đa 30 trang đã lưu). Trang đã lưu được gợi ý đầu tiên trên thanh địa chỉ, có trong popup và màn hình chào, và được quản lý ở **Cài đặt → Trang đã lưu**.
- **Địa chỉ gần đây** chỉ được lưu khi bạn bật **Cài đặt → Vùng làm việc → Ghi nhớ địa chỉ gần đây** (mặc định tắt, 10 địa chỉ gần nhất, chỉ trên thiết bị này).
- **Quay lại / tới** giữa các trang đã xem trước: hai nút mũi tên, `Alt + ←` / `Alt + →`, hoặc nút quay lại/tới trên chuột.
- **Tải lại tất cả bản xem trước** (`R`) đưa mỗi bản xem trước về đúng vị trí đang cuộn. Menu bên cạnh có **Tự động tải lại** — **Tắt** hoặc **Mỗi** 5, 10, 30 hay 60 **giây** — tiện khi vừa sửa trang vừa theo dõi; nó tạm dừng khi có hộp thoại đang mở hoặc tab bị ẩn.

### Dự án

Dự án lưu toàn bộ thiết lập của một website — trang, các viewport (cả đang hiện lẫn đang ẩn), nhãn breakpoint, lưới cột, CSS trực tiếp và địa chỉ đang so sánh — rồi mở lại chỉ bằng một cú bấm.

1. Mở trang và thiết lập mọi thứ.
2. **Dự án** (thanh vùng làm việc) → **Lưu thành dự án…**, đặt tên rồi lưu. Lưu trùng tên sẽ cập nhật dự án đó.
3. Lần sau, chọn nó trong **Dự án** (hoặc lệnh “Mở dự án …” trong bảng lệnh). Mở dự án có thể hoàn tác.

**Quản lý dự án…** để mở, đổi tên, cập nhật (**Cập nhật bằng thiết lập hiện tại**) hoặc xóa dự án. Dự án được đưa vào tệp khi bạn xuất cài đặt. Gói miễn phí giữ một dự án; **Không giới hạn dự án (Pro)** giữ tới 50.

### Liên kết workspace

**Công cụ → Chép liên kết workspace** chép một liên kết mở trang này với các viewport của bạn — kích thước, tên và màu trang — cho bất kỳ ai có Breakpointer. Mở liên kết sẽ thay các viewport hiện có, và có Hoàn tác.

---

<a id="finding-layout-problems"></a>

## 3. Tìm lỗi bố cục

Phần lớn công cụ trong chương này chạy bên trong bản xem trước, nên cần [quyền truy cập](#site-access) trên trang. Khi chưa có quyền, menu Công cụ, bảng rà soát và bảng soi sẽ có nút **Cho phép _trang_…**.

### Cuộn và điều hướng đồng bộ

Khi **Đồng bộ** bật (mặc định), cuộn một bản xem trước sẽ cuộn các bản khác tới **cùng nội dung** — không phải cùng phần trăm trang — và bấm liên kết, gửi biểu mẫu hay đổi route của ứng dụng một trang trong một bản xem trước sẽ mở trang đó ở tất cả; thanh địa chỉ cũng đi theo. Bật/tắt riêng từng thứ trong **Công cụ → Cuộn đồng bộ / Điều hướng đồng bộ** hoặc **Cài đặt → Công cụ xem trước**.

Chuyển hướng do trang tự thực hiện (ví dụ sang bản di động), liên kết `#anchor` trong trang và liên kết dùng một lần như callback đăng nhập sẽ không được đi theo: bản xem trước đó hiện **↩ Đã chuyển trang · Quay lại**.

**Đồng bộ nhấp & gõ phím (Pro)** (Công cụ hoặc Cài đặt, mặc định tắt): mở menu, chuyển tab hay điền biểu mẫu ở một bản xem trước, mọi bản xem trước của cùng trang đều làm theo. Liên kết sang trang khác vẫn dùng điều hướng đồng bộ. Biểu mẫu không bao giờ được gửi ở các bản xem trước còn lại, và mật khẩu, mã dùng một lần, thông tin thanh toán và tệp không bao giờ được chép.

<a id="checks"></a>

### Kiểm tra responsive

Khi **Công cụ → Kiểm tra responsive** bật (mặc định), mỗi thẻ kiểm tra trang ở kích thước của chính nó và hiện **✓** hoặc **⚠ n** ở đầu thẻ. Bấm vào huy hiệu để xem từng vấn đề với các phần tử liên quan (ví dụ `div.hero > img`) và **Đánh dấu** chúng trên trang. Tắt bất kỳ mục nào trong **Cài đặt → Công cụ xem trước → Các mục kiểm tra**.

| Mục kiểm tra                                       | Phát hiện gì                                                                                                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nội dung rộng hơn màn hình                         | Trang bị cuộn ngang; liệt kê các phần tử ngoài cùng gây ra và tràn bao nhiêu.                                                                                                                                              |
| Thiếu thẻ viewport cho di động                     | Không có `<meta name="viewport" content="width=device-width, initial-scale=1">`, nên điện thoại dàn trang rộng khoảng 980 px rồi thu nhỏ lại.                                                                              |
| Chữ nhỏ hơn 12px                                   | Khó đọc trên điện thoại và máy tính bảng.                                                                                                                                                                                  |
| Vùng chạm nhỏ hơn 24×24px                          | Khó chạm mà không trúng phần tử bên cạnh (WCAG 2.5.8).                                                                                                                                                                     |
| Chữ bị khung cắt mất                               | Một phần dòng chữ bị che bởi khung ẩn phần tràn — thường do chiều rộng hoặc chiều cao cố định. Dấu ba chấm, giới hạn số dòng, lớp mờ dần, slide carousel và chữ chuyển động được bỏ qua.                                   |
| Chữ có độ tương phản thấp                          | Dưới mức WCAG AA — 4,5:1, hoặc 3:1 với chữ lớn — ở những chỗ biết được màu phía sau chữ (nền đơn sắc, mọi không gian màu CSS). Chữ nằm trên ảnh, gradient hay nội dung khác được bỏ qua thay vì đoán.                      |
| Ảnh hiển thị lớn hơn kích thước thật               | Bị kéo giãn vượt số điểm ảnh của tệp, nên trông mờ.                                                                                                                                                                        |
| Phần tử cố định che nhiều màn hình                 | Phần tử cố định hoặc dính (sticky) che hơn một phần ba màn hình điện thoại hay máy tính bảng (tường cookie, header quá cao).                                                                                               |
| Bố cục bị xê dịch khi tải                          | Cumulative layout shift trên 0,1, kèm các phần tử bị dịch chuyển. Hãy chừa sẵn chỗ cho ảnh, nội dung nhúng và phần tải sau.                                                                                                |
| Dòng chữ quá dài — **Mới ở 0.11**                  | Đoạn văn có dòng dài quá khoảng 100 ký tự (50 với tiếng Trung, Nhật, Hàn) đọc rất mệt trên màn hình rộng; WCAG 1.4.8 khuyên tối đa 80.                                                                                     |
| Ô nhập khiến iPhone tự phóng to — **Mới ở 0.14**   | Ở bề rộng điện thoại (tới 600 px), ô nhập có chữ nhỏ hơn 16 px: Safari trên iPhone tự phóng to trang khi ô đó được chọn. Dùng 16 px (`1rem`) trở lên cho ô nhập ở cỡ điện thoại.                                           |
| Thứ tự trên màn hình khác HTML — **Mới ở 0.14**    | Các mục flex hay grid bị CSS đổi chỗ (`order`, hướng đảo ngược, đặt vị trí trong grid), nên tiêu điểm bàn phím và trình đọc màn hình nhảy lung tung (WCAG 1.3.2, 2.4.3). Thường do bố cục chỉ đổi thứ tự ở một breakpoint. |
| Ảnh thiếu văn bản thay thế (alt) **(Pro)**         | Trình đọc màn hình không mô tả được (WCAG 1.1.1). Ảnh trang trí cần `alt=""` để trống.                                                                                                                                     |
| Nút và liên kết không có tên **(Pro)**             | Trình đọc màn hình chỉ đọc “nút” hoặc “liên kết” — thường là nút menu chỉ có biểu tượng, chỉ hiện trên điện thoại (WCAG 4.1.2).                                                                                            |
| Trường nhập không có nhãn **(Pro)**                | Người dùng không biết cần nhập gì (WCAG 1.3.1).                                                                                                                                                                            |
| Tiêu điểm bàn phím rơi vào phần tử bị ẩn **(Pro)** | Phím Tab đi tới phần tử nằm ngoài màn hình hoặc đang ẩn, như menu off-canvas đã đóng hay phần tử nhận tiêu điểm nằm trong `aria-hidden` (WCAG 2.4.7).                                                                      |
| Trang không khai báo ngôn ngữ **(Pro)**            | `<html>` không có `lang`, nên trình đọc màn hình có thể dùng sai giọng đọc (WCAG 3.1.1).                                                                                                                                   |

Các mục này cũng chạy trong bảng rà soát, quét chiều rộng và Kiểm tra nhiều trang, và được tính vào [điểm responsive](#score). Ở gói miễn phí, các mục kiểm tra trợ năng không chạy; bảng rà soát có nhắc tới chúng.

Với dòng chữ quá dài, hãy giới hạn đoạn văn khoảng `70ch` bằng `max-width`, và để [Bộ công cụ CSS](#fluid-type) viết một `clamp()` giúp chữ tăng mượt giữa viewport nhỏ nhất và lớn nhất của bạn.

Trong ứng dụng: **Chữ dễ đọc ở mọi kích thước** (Mới ở 0.11).

<a id="score"></a>

### Điểm responsive

Một con số từ 0 đến 100 cho trang ở các kích thước đã kiểm tra, kèm xếp loại — **A** (từ 90), **B** (75), **C** (60), **D** (40) hoặc **F** — và **Những lỗi bị trừ nhiều điểm nhất**. Mỗi loại vấn đề bị trừ điểm tùy mức nghiêm trọng và số kích thước gặp phải. Điểm nằm ở đầu tab Vấn đề của bảng rà soát, trong thẻ Trang của thanh bên, trong báo cáo HTML và là một cột của Kiểm tra nhiều trang.

<a id="audit"></a>

### Bảng rà soát

Mọi vấn đề của mọi bản xem trước trong một bảng, cộng thêm hiệu năng, kiểu chữ, hình ảnh, màu sắc, thẻ meta và media query của trang — tất cả đặt cạnh nhau giữa các bản xem trước.

Mở bằng `E`, nút **Rà soát** (có số loại vấn đề tìm thấy), thanh trạng thái hoặc bảng lệnh. Phần đầu bảng có **Đo lại**, **Chép dạng Markdown** (tab hiện tại, dạng bảng để dán vào ticket), **Xuất** (Pro) và nút đóng. Bảng rà soát chạy bên trong bản xem trước của trang bạn cho phép.

Trong ứng dụng: **Rà soát trang ở mọi kích thước**.

**Vấn đề.** Thẻ điểm responsive, rồi từng loại vấn đề cùng các bản xem trước gặp phải (**Ở 2/3**). Chọn một loại để xem phần tử, **Đánh dấu trong _viewport_** hoặc **Đi tới _viewport_**. Từ 0.11, thẻ điểm còn tạo được [huy hiệu điểm](#score-badge), và từ 0.12 có [lịch sử điểm](#score-history) của trang.

**Hiệu năng.** Thanh biểu đồ cho mỗi bản xem trước: **Dung lượng trang** (số byte tải về), **Số yêu cầu**, **Điểm ảnh của ảnh** (so với lượng màn hình cần — ảnh responsive tải ít hơn trên màn hình nhỏ), **Thời gian hiển thị nội dung lớn nhất** (tốt: dưới 2,5 giây), **Xê dịch bố cục** (tốt: dưới 0,1), **Chiều cao trang**, **Phần tử** và **Web font**. Dung lượng tính theo số liệu trình duyệt báo: tệp từ site khác không chia sẻ thông tin thời gian, và tệp lấy từ bộ nhớ đệm, không được tính. Khi đặt **ngân sách hiệu năng (Pro)** trong Cài đặt, mỗi giới hạn được hiện ra và bản xem trước vượt giới hạn được đánh dấu, có tóm tắt ở đầu tab.

**Kiểu chữ.** Cỡ chữ, chiều cao dòng và độ đậm của heading, đoạn văn, liên kết, nút và trường nhập đầu tiên mỗi loại trong từng bản xem trước, đánh dấu những gì thay đổi giữa các kích thước.

**Hình ảnh.** Mọi ảnh mà bản xem trước hiển thị (từ 24 px trở lên), ở từng viewport: chiều rộng hiển thị, chiều rộng của tệp và lượng màn hình cần (chiều rộng hiển thị × tỉ lệ điểm ảnh), được đánh dấu **Quá lớn**, **Quá nhỏ** hoặc **Vừa**, ảnh lãng phí nhất đứng đầu. Với mỗi ảnh có gợi ý `sizes` khớp với các viewport đang xem (dùng `vw` khi ảnh co giãn theo viewport, px khi ảnh ngừng lớn) và các chiều rộng `srcset` cho màn hình 1× và 2× — bấm **Sao chép srcset và sizes**. Thêm viewport để có gợi ý chi tiết hơn.

**Gợi ý ảnh** (Mới ở 0.12) hiện dưới một ảnh khi ngoài kích thước còn điều có thể tốt hơn, và phần tóm tắt của tab đếm chúng:

- tệp JPEG, PNG hoặc GIF hiển thị rộng hơn 160 px — **AVIF hoặc WebP thường nhỏ hơn 30–50%** với cùng chất lượng;
- **tải lười nhưng nằm ngay màn hình đầu** ở một kích thước nào đó — hãy tải ngay (thêm `fetchpriority="high"` nếu là ảnh chính);
- **nằm dưới màn hình đầu ở mọi kích thước** nhưng tải ngay — thêm `loading="lazy"`;
- **thiếu thuộc tính `width` và `height`** — trang bị xô lệch khi ảnh tải; hãy thêm vào (kích thước tệp là đủ).

Để viết mã cho một ảnh mới, dùng công cụ [Ảnh](#toolkit-images) trong Bộ công cụ CSS. Trong ứng dụng: **Đưa ảnh responsive lên trang**.

**Màu sắc.** Các màu trang dùng cho **Chữ**, **Nền** và **Viền** trên các bản xem trước, dạng ô màu kèm số phần tử dùng mỗi màu — **Sao chép thành biến CSS** hoặc chép thành bảng Markdown.

**Meta.** Chọn **Bản xem trước để đọc**, rồi xem **Kết quả tìm kiếm** và **Xem trước liên kết** gần đúng (kèm ảnh chia sẻ và kích thước của nó), các **Thẻ** được kiểm tra — độ dài tiêu đề và mô tả, tiêu đề và ảnh chia sẻ, thẻ X, địa chỉ chuẩn (canonical), ngôn ngữ, viewport (và có chặn phóng to không), robots (`noindex`) và biểu tượng, mỗi mục **Ổn**, **Nên xem**, **Cần sửa** hoặc **Lưu ý** — cùng dàn ý **Heading**, có đánh dấu chỗ nhảy cấp, thiếu hoặc thừa `H1` và heading bị ẩn ở kích thước đó. Mỗi công cụ tìm kiếm và ứng dụng hiển thị liên kết theo cách riêng; hãy coi phần xem trước là gần đúng.

**Media query.** Mọi media query và container query trong CSS của chính trang, số quy tắc của mỗi query và các bản xem trước mà nó áp dụng (✓ / –). **Query được hiển thị**: **Chiều rộng** hoặc **Mọi điều kiện**. Những chỗ có thể sai được liệt kê trong **Breakpoint có thể bị sai**:

- **khoảng hở** — `(max-width: 599px)` và `(min-width: 601px)` bỏ trống 600 px, không query nào áp dụng;
- **chồng lấn** — cả hai phía cùng áp dụng ở một chiều rộng.

Bấm **Thêm viewport 600 px** để xem chiều rộng có vấn đề. Container query (—) tùy vào khung chứa, không phải viewport. CSS từ site khác không đọc được, nên query của chúng không có trong danh sách.

Trong ứng dụng: **Tìm khoảng hở giữa các breakpoint**.

<a id="scan"></a>

### Quét mọi chiều rộng

Thay vì đoán chiều rộng, hãy để Breakpointer đổi kích thước trang từng chiều rộng một và tìm chính xác chiều rộng đầu tiên và cuối cùng của mỗi vấn đề, đến từng pixel.

1. Nhấn `W`, hoặc **Công cụ → Quét mọi chiều rộng…**.
2. Đặt **Từ** và **Đến** (mặc định 320–1920 px), **Chiều cao**, và **Bước** của lượt quét đầu: **Nhanh · 32px**, **Vừa · 16px** hoặc **Kỹ · 8px**.
3. Bấm **Quét**. Trang được tải trong một bản xem trước riêng và kiểm tra ở từng bước; ở đâu vấn đề thay đổi giữa hai chiều rộng, khoảng cách được chia đôi liên tục cho tới khi tìm ra mép.
4. Đọc biểu đồ: các khoảng của từng vấn đề, chiều cao trang, breakpoint của trang và viewport của bạn. Rê chuột hoặc kéo thanh trượt để xem chiều rộng bất kỳ.
5. Bấm vào một khoảng để nhảy tới chiều rộng nặng nhất của nó, rồi bấm **Thêm viewport rộng \_chiều rộng_px** để giữ lại. **Chép dạng Markdown** hoặc **Xuất** (Pro) kết quả.

Mỗi lần quét kiểm tra tối đa 600 chiều rộng. Nếu bạn dừng — hoặc chạm giới hạn — kết quả cho biết đã quét tới đâu và mép chính xác đến mức nào. Lượt quét tạm chờ khi tab bị ẩn. Lần quét gần nhất của trang được đưa vào báo cáo HTML.

Trong ứng dụng: **Tìm chỗ bố cục bị vỡ**.

<a id="inspector"></a>

### Soi phần tử

So một phần tử ở mọi kích thước.

1. Nhấn `I`, bấm **Soi**, hoặc **Công cụ → Soi phần tử**.
2. Bấm vào một phần tử ở bất kỳ bản xem trước nào. Trong lúc chọn, rê chuột sẽ hiện margin (màu cam) và padding (màu xanh lá).
3. Bảng soi liệt kê **Kích thước**, **Display**, **Font**, **Margin**, **Padding**, **Bố cục** (flex/grid) và **Position** ở từng viewport, đặt cạnh nhau, tô sáng những gì thay đổi giữa các kích thước. Phần tử được viền trong mọi bản xem trước; nó có thể **Bị ẩn ở kích thước này** hoặc **Không có trên trang**.

Sau đó:

- **Chép selector**, hoặc **Chép bảng** — bảng so sánh dạng Markdown, sẵn cho ticket hay pull request.
- **Chụp ở mọi kích thước** — phần tử được cắt ra từ mọi bản xem trước, đặt cạnh nhau cùng tỉ lệ, trong một ảnh.
- **Khoảng cách đến…** — chọn phần tử thứ hai để xem khoảng cách giữa hai phần tử theo chiều ngang và chiều dọc ở từng viewport (hoặc phần tử này nằm trong phần tử kia bao xa, hoặc **Chồng lên nhau**). Khoảng cách được đo lại khi kích thước đổi và được thêm vào bảng khi chép. Bấm **Bỏ đo khoảng cách** để dừng.
- **Đến _viewport_** cuộn tới bản xem trước đó; **Bỏ chọn** để quên phần tử.

Phần tử đang soi được đưa vào báo cáo HTML. Trong ứng dụng: **So một phần tử ở mọi kích thước**.

<a id="elements"></a>

### Elements (HTML & CSS) — Mới ở 0.13

Mọi thẻ của trang và CSS của từng thẻ, như công cụ nhà phát triển (F12) của trình duyệt — nhưng cho bản xem trước bạn chọn, ở đúng kích thước của nó.

1. Nhấn `J`, hoặc **Công cụ → Elements (HTML & CSS)**, hoặc “Elements” trong bảng lệnh. Bảng mở ở bên cạnh (thay chỗ soi phần tử, rà soát hoặc checklist kiểm thử).
2. Chọn **Bản xem trước** cần đọc khi có nhiều bản — cùng một trang ở 375 px và 1440 px có thể có style khác nhau.
3. Duyệt cây: bấm mũi tên, hoặc dùng `↑` `↓` để di chuyển, `→` để mở, `←` để đóng, `Enter` để chọn. Thẻ in nghiêng có biểu tượng mắt gạch không hiển thị ở kích thước đó. Hoặc bấm nút **Chọn** trên đầu bảng rồi bấm một phần tử trong bất kỳ bản xem trước nào: cây mở tới phần tử đó và chuyển sang bản xem trước đó.
4. Phần tử đang chọn được viền trong bản xem trước. Xem chi tiết:
   - **Styles** — `element.style` (thuộc tính `style`), rồi mọi quy tắc khớp, quy tắc thắng ở trên, kèm `@media`, `@supports`, `@container` hoặc `@layer` bao quanh và tệp nguồn. Khai báo thua quy tắc khác được gạch ngang; rê chuột lên selector để xem độ ưu tiên (specificity). Quy tắc nằm trong media query chỉ hiện ở bản xem trước mà query đó áp dụng.
   - **Computed** — giá trị cuối cùng của từng thuộc tính; các thuộc tính bố cục trước, **Hiện tất cả** cho phần còn lại, và ô lọc.
   - **Box** — margin, border, padding và kích thước nội dung.
   - **Tổng quan** — HTML và CSS của trang trong nháy mắt (xem bên dưới).
5. **Chép CSS** chép các quy tắc dạng văn bản; **Thử trong CSS trực tiếp** mở [CSS trực tiếp](#live-css) với một quy tắc cho phần tử này, để đổi nó ở mọi bản xem trước cùng lúc; **So sánh ở mọi kích thước** mở [soi phần tử](#inspector) với cùng phần tử.

**Tổng quan** rà soát trang: **Số phần tử** và **Độ sâu lớn nhất** (được đánh dấu khi vượt 1.500 và 32, ngưỡng của Lighthouse), **id bị trùng**, **Thẻ lỗi thời** (`center`, `font`, `marquee`…), **Ảnh thiếu alt**, **Style inline** và **Khai báo !important**, cùng các thẻ dùng nhiều nhất và các stylesheet. **Chép dạng Markdown** để dán vào ticket.

Lưu ý: Elements chạy trong bản xem trước của các trang bạn cho phép. Stylesheet từ trang khác không cho phép đọc thì không đọc được (bảng có báo số lượng), nên quy tắc của chúng không được liệt kê. Quy tắc `@container` có áp dụng hay không thì không biết được từ bên ngoài: chúng được liệt kê kèm điều kiện. Trong ứng dụng: **Đọc HTML và CSS của trang**.

### Đo khoảng cách

Nhấn `X` (hoặc **Đo**), rồi kéo trên bất kỳ bản xem trước nào để đo một vùng theo pixel CSS, ở mức thu phóng nào cũng được, kèm khoảng cách tới mép trái và mép trên. Giữ `Shift` để đo đường thẳng. Chạy được trên mọi trang. `Esc` hoặc **Xong** để thoát.

<a id="colour-contrast-checker"></a>

### Kiểm tra độ tương phản màu

1. Nhấn `C`, hoặc **Công cụ → Độ tương phản màu…**.
2. Đặt màu **Chữ** và **Nền**: gõ mã hex hoặc `rgb()`, dùng ô màu, hoặc **Lấy màu trên màn hình** bằng ống hút màu (từ bất kỳ bản xem trước nào). **Đổi chỗ hai màu** chỉ bằng một cú bấm.
3. Đọc **Tỉ lệ tương phản** và các mức theo WCAG 2.2: **AA · chữ thường** (4,5:1), **AA · chữ lớn** (3:1), **AAA · chữ thường** (7:1), **AAA · chữ lớn** (4,5:1) và **Biểu tượng và đường viền** (3:1), mỗi mức **Đạt** hoặc **Không đạt**, kèm mẫu chữ 16 px và 24 px.

Chữ lớn là từ 24 px, hoặc 18,66 px khi in đậm. Màu chữ trong suốt được trộn với màu nền trước khi tính. Nếu trình duyệt không có ống hút màu, hãy nhập màu bằng tay.

### Lớp phủ bên trong bản xem trước

Trong **Công cụ → Bên trong bản xem trước** (trên trang bạn cho phép, trừ lưới cột):

- **Viền bố cục** (`O`) — viền quanh mọi phần tử, để thấy các khối và chỗ tràn.
- **Bố cục grid & flex** — cột và hàng của mỗi grid container, hướng của mỗi flex container.
- **Kích thước ảnh** — nhãn trên mỗi ảnh với kích thước hiển thị, kích thước tệp và mật độ; đỏ: bị kéo giãn, cam: lớn hơn nhiều so với cần (“SVG” với ảnh vector).
- **Thứ tự Tab** — đánh số phần tử theo thứ tự bàn phím; cam: `tabindex` dương.
- **Ẩn thanh cuộn** — như trên điện thoại và máy tính bảng.
- **Ẩn banner cookie (Pro)** — ẩn banner xin đồng ý cookie của hơn 25 công cụ phổ biến (OneTrust, Cookiebot, Didomi, Usercentrics…) để ảnh chụp và kết quả kiểm tra gọn gàng. Không chấp nhận hay từ chối gì cả; tắt đi là banner trở lại.
- **Lưới cột** — xem [Nhãn breakpoint, thước đo và lưới](#breakpoints).

<a id="live-css"></a>

### CSS trực tiếp

Thử một chỉnh sửa trên mọi bản xem trước cùng lúc.

1. **Công cụ → CSS trực tiếp…**.
2. Gõ CSS, ví dụ `.hero h1 { font-size: clamp(2rem, 6vw, 4rem); }`.
3. **Áp dụng cho bản xem trước** (`Ctrl/⌘ + Enter`). **Gỡ bỏ** để bỏ đi.

CSS trực tiếp chỉ tồn tại trong phiên làm việc và không bao giờ thay đổi trang thật. Ở **Đoạn CSS đã lưu**, **Lưu thành đoạn mẫu** giữ lại CSS hay dùng (tối đa 20) — **Sửa** đưa đoạn đó vào ô soạn thảo, **Áp dụng** áp dụng ngay; lệnh “Áp dụng đoạn CSS …” trong bảng lệnh cũng vậy. Đoạn CSS được đưa vào tệp xuất; CSS trực tiếp được lưu cùng dự án.

### Phủ ảnh thiết kế

Đặt bản mockup lên trên một bản xem trước để so từng pixel.

1. Menu ⋯ của thẻ → **Phủ ảnh thiết kế…** rồi chọn ảnh.
2. Chỉnh **Độ mờ của ảnh phủ**; bật **Hiện chỗ khác nhau** để dùng chế độ hòa trộn difference.
3. **Ẩn ảnh phủ** / **Hiện ảnh phủ**, hoặc **Gỡ ảnh phủ** (cũng có trong menu thẻ).

Trên trang bạn cho phép, ảnh phủ cuộn theo trang. Ảnh không bao giờ rời khỏi trình duyệt của bạn.

<a id="compare"></a>

### So sánh hai địa chỉ

Cho mỗi viewport thêm bản xem trước thứ hai, **B**, cạnh bản thường, **A** — staging cạnh bản chính thức, hoặc bản thiết kế lại cạnh trang đang chạy.

1. **Công cụ → So sánh với địa chỉ khác…**.
2. Nhập **Địa chỉ để so sánh** và chọn **B hiển thị gì**:
   - **Cùng trang trên một site khác** — B hiện cùng đường dẫn trên site đó và đi theo A sang trang khác (bấm liên kết trong B cũng kéo A theo);
   - **Một địa chỉ cố định** — B luôn hiện đúng địa chỉ đó.
3. Bấm **So sánh**.

Dải thông báo có **Đổi chỗ A và B**, **Đổi…** và **Dừng so sánh**. Ảnh chụp, ảnh gộp mọi viewport, báo cáo và bảng soi đều ghi rõ phía B. So sánh làm số bản xem trước tăng gấp đôi: hãy ẩn bớt viewport nếu vùng làm việc bị chậm. Địa chỉ so sánh được lưu cùng dự án.

---

<a id="simulations-and-stress-tests"></a>

## 4. Mô phỏng và thử độ bền

Menu **Mô phỏng** (thanh vùng làm việc) thay đổi cách bản xem trước hiển thị hoặc điều trang được yêu cầu làm — không bao giờ đổi thiết bị. Mô phỏng thị lực chạy trên mọi trang; tùy chọn của trang và thử độ bền bố cục chạy trên trang bạn cho phép và được hoàn nguyên khi tắt.

### Thị lực

**Thị lực bình thường**, **Không thấy đỏ (protanopia)**, **Không thấy xanh lục (deuteranopia)**, **Không thấy xanh lam (tritanopia)**, **Không thấy màu (achromatopsia)** và **Nhìn mờ** — mô phỏng gần đúng, phủ lên mọi bản xem trước. `Esc` để tắt. Cũng có trong bảng lệnh (“Thị lực: …”).

### Màu trang của mọi bản xem trước

**Theo trình duyệt**, **Sáng** hoặc **Tối** cho mọi bản xem trước cùng lúc (`prefers-color-scheme`), có Hoàn tác. Màu riêng cho từng viewport nằm trong menu của mỗi thẻ.

### Tùy chọn của trang

- **Ưu tiên giảm chuyển động** — kiểu `prefers-reduced-motion` của trang.
- **Ưu tiên tương phản cao** — kiểu `prefers-contrast: more`.
- **Kiểu in** — trang như khi in (`@media print`), ở mỗi chiều rộng.
- **Tạm dừng hiệu ứng động** — đóng băng animation và transition CSS để chụp ảnh ổn định.
- **Kiểu cho màn hình cảm ứng** — **Mới ở 0.11**. Bản xem trước dùng CSS dành cho màn hình cảm ứng của trang — `(hover: none)` và `(pointer: coarse)` — nên bạn thấy, chẳng hạn, menu mở khi chạm thay vì khi rê chuột, hay nút điều khiển lớn hơn cho dễ chạm. Hãy để ý menu, nút hay chú thích chỉ hiện khi rê chuột: trên màn hình cảm ứng, người dùng không có cách nào mở được chúng. Chỉ hai media feature CSS này thay đổi: không có sự kiện chạm nào được gửi, và đây không phải giả lập thiết bị. Mẹo: thêm “Menu dùng được khi không có rê chuột” vào [Checklist kiểm thử](#qa-checklist) và đánh dấu ở mọi kích thước.

Trong ứng dụng: **Thử kiểu cho màn hình cảm ứng** (Mới ở 0.11).

### Thử độ bền bố cục

- **Chữ dài hơn** — giả lập bản dịch: dài hơn khoảng 40%, có dấu, trong [ngoặc vuông], để tìm bố cục vỡ khi dịch sang ngôn ngữ khác.
- **Phải sang trái** — dàn trang như tiếng Ả Rập hoặc tiếng Do Thái.
- **Giãn chữ (WCAG)** — chiều cao dòng 1,5, khoảng cách đoạn 2, khoảng cách ký tự 0,12em, khoảng cách từ 0,16em (WCAG 1.4.12): nội dung không được bị cắt.
- **Chữ phóng to 200%** — mọi cỡ chữ tăng gấp đôi, như phóng to riêng chữ (WCAG 1.4.4): không chỗ nào được bị cắt hay chồng lên nhau.

Chạy [kiểm tra responsive](#checks) hoặc [quét chiều rộng](#scan) khi đang bật một phép thử để tìm chỗ vỡ, rồi tắt đi — trang trở lại như cũ.

---

<a id="manual-testing"></a>

## 5. Kiểm thử thủ công

<a id="qa-checklist"></a>

### Checklist kiểm thử

Có những thứ chỉ người mới kiểm tra được — menu có mở không, biểu mẫu có gửi được không? Checklist kiểm thử theo dõi chúng cho từng viewport.

1. Nhấn `Q`, hoặc **Công cụ → Checklist kiểm thử**, hoặc bảng lệnh. Một bảng mở ra với mỗi hàng là một mục kiểm tra, mỗi cột là một viewport đang hiện.
2. Thử từng mục ở từng bản xem trước, rồi bấm vào ô tương ứng: **Đạt** → **Không đạt** → **Bỏ qua** → **Chưa kiểm**. Phím mũi tên để đi giữa các ô; **Đi tới _viewport_** cuộn tới bản xem trước đó.
3. **Chép dạng Markdown** — bảng kết quả với các mục không đạt đứng đầu, sẵn cho ticket.

Tám mục mặc định: menu điều hướng mở, đóng được và mọi liên kết đều hoạt động; không có gì bị cắt mất hay phải cuộn ngang; chữ đọc được mà không cần phóng to; hình ảnh sắc nét, không bị kéo giãn; nút và liên kết dễ bấm; biểu mẫu điền và gửi được; video, bản đồ và nội dung nhúng vừa màn hình; cửa sổ bật lên và menu vừa màn hình, đóng được.

Sửa một mục, xóa (có Hoàn tác) hoặc gõ mục mới vào **Thêm mục kiểm tra…** — tối đa 40. Menu ⋯ có **Xóa kết quả** và **Khôi phục các mục kiểm tra mặc định**. Danh sách mục kiểm tra được giữ lại (và có trong tệp xuất cài đặt); kết quả chỉ giữ trong phiên làm việc.

Trong ứng dụng: **Chạy danh sách kiểm tra QA**.

<a id="notes"></a>

### Ghi chú và báo cáo lỗi

Ghim chỗ sai lên bản xem trước và chép một báo cáo lỗi soạn sẵn.

1. Nhấn `N`, hoặc bấm **Ghi chú**.
2. Bấm vào chỗ có vấn đề trên một bản xem trước: một ghim có số hiện ra. Gõ vấn đề (“Chỗ này có vấn đề gì?”) rồi bấm **Xong**. **Xóa** để bỏ một ghi chú, có Hoàn tác.
3. Trên thanh ghi chú, **Chép báo cáo lỗi** chép Markdown gồm trang, trình duyệt, và kích thước, breakpoint, ghi chú của từng viewport — sẵn để dán vào công cụ quản lý lỗi. Nút máy ảnh (**Lưu các bản xem trước kèm ghi chú thành một ảnh**) lưu mọi bản xem trước cùng ghi chú vào một ảnh có nhãn.

Trên trang bạn cho phép, ghi chú cuộn theo trang. Ghi chú hiện trong ảnh chụp. **Công cụ → Chép báo cáo lỗi** và **Xóa ghi chú** dùng được cả khi chế độ ghi chú đang tắt. Tối đa 50 ghi chú mỗi phiên; ghi chú chỉ tồn tại trong phiên làm việc, không bao giờ được lưu hay gửi đi.

Trong ứng dụng: **Báo lỗi bằng ghi chú**.

---

<a id="whole-sites-and-regressions"></a>

## 6. Cả website và lỗi hồi quy

<a id="check-pages"></a>

### Kiểm tra nhiều trang

Kiểm tra cả một danh sách trang ở mọi viewport trong một lần chạy, và xem trang nào vỡ ở kích thước nào.

1. Nhấn `B`, hoặc **Công cụ → Kiểm tra nhiều trang…**.
2. Điền **Các trang, mỗi dòng một địa chỉ** — gõ hoặc dán địa chỉ, hoặc dùng **Thêm trang**: **Liên kết trong trang này** (các trang khác cùng site được liên kết từ trang đang xem trước), **Từ sitemap** (lấy từ `robots.txt` hoặc `/sitemap.xml`) hoặc **Trang đã lưu**. **Xóa hết** để làm trống danh sách. Tối đa 50 trang mỗi lần chạy.
3. Trang được kiểm tra ở kích thước của mọi viewport đang hiện (**Ở mọi viewport**). Hãy hiện những kích thước bạn cần trước.
4. Bấm **Bắt đầu kiểm tra**. Mỗi trang được tải trong một bản xem trước riêng và chạy cùng các mục kiểm tra như trên thẻ.
5. Đọc bảng — trang × kích thước: **✓** không có vấn đề, một con số = số loại vấn đề (chọn để xem vấn đề và phần tử), **✗** không phản hồi, **—** chưa kiểm tra — và điểm của mỗi trang. Trang không kiểm tra được sẽ ghi lý do: lỗi HTTP như 404, site chưa cho phép Breakpointer, hoặc trang không tải xong kịp. Trang bị chuyển hướng hiện **Đã chuyển tới …**.
6. **Mở** một trang trong vùng làm việc từ hàng của nó, **Chép dạng Markdown**, **Tải báo cáo** (HTML), hoặc **Xuất** (Pro).

Nếu trong danh sách có site chưa được cho phép, **Cho phép các trang web này…** xin quyền cho tất cả trong một lần. Liên kết thực hiện hành động thay vì hiển thị nội dung (đăng xuất, xóa, liên kết đăng nhập dùng một lần) và tệp tải về được bỏ qua.

Trong ứng dụng: **Kiểm tra cả trang web**.

<a id="visual-check"></a>

### Kiểm tra hình ảnh

Lưu ảnh mốc của mọi viewport, rồi so sánh sau — sau khi deploy, đổi CSS hoặc so với staging — để thấy phần nào xê dịch, đến từng pixel.

1. Nhấn `V`, hoặc **Công cụ → Kiểm tra hình ảnh…**.
2. **Lưu ảnh mốc** chụp mọi viewport đang hiện.
3. Sửa trang (hoặc chờ một lần deploy), tải lại, rồi mở lại Kiểm tra hình ảnh.
4. **So với ảnh mốc**. Mỗi viewport hiện **Không thay đổi** hoặc mức thay đổi và số vùng thay đổi, được đóng khung màu hồng tím.
5. **Xem** một viewport và chọn **Hiển thị**: **Cạnh nhau**, **Thanh trượt** hoặc **Khác biệt**.
6. **Chấp nhận** một ảnh chụp làm ảnh mốc mới khi thay đổi là có chủ ý, hoặc **Lưu ảnh mốc mới** cho tất cả.

Để kết quả chính xác, hãy so sánh ở cùng kích thước cửa sổ và mức thu phóng. Ảnh mốc chỉ nằm trong trình duyệt này (tối đa 400, ảnh cũ nhất bị xóa trước), không bao giờ được xuất, và có thể xóa ngay tại đây (**Xóa ảnh mốc của trang này**) hoặc trong **Cài đặt → Sao lưu & đặt lại → Ảnh mốc**. Việc chụp cần quyền trên mọi trang, như các [ảnh chụp](#screenshots) khác.

Trong ứng dụng: **Phát hiện thay đổi hình ảnh**.

---

<a id="screenshots-reports-and-sharing"></a>

## 7. Ảnh chụp, báo cáo và chia sẻ

<a id="screenshots"></a>

### Chụp ảnh

Chrome chỉ cho tiện ích chụp nội dung trên màn hình khi có quyền trên mọi trang. Lần đầu bạn chụp, Breakpointer sẽ giải thích điều này — **Cho phép và chụp** để cấp quyền (bạn có thể gỡ sau trong Quyền truy cập trang).

Từ menu **Chụp ảnh** trên thanh trên cùng:

- **Chụp vùng làm việc đang hiển thị** (`S`) — ảnh PNG đúng như trên màn hình.
- **Mọi viewport trong một ảnh** — các bản xem trước đang hiện đặt cạnh nhau, kèm tên và kích thước, dưới tiêu đề trang, sẵn cho ticket.
- **Chép vùng làm việc đang hiển thị** — để dán vào ticket hoặc tin nhắn.
- **Chú thích ảnh chụp…** — mọi bản xem trước trong một ảnh, mở ra để vẽ (Mới ở 0.12, xem bên dưới).
- **Ảnh trình diễn…** — xem bên dưới.

Từ một thẻ: nút máy ảnh lưu bản xem trước đó; ⋯ → **Chép ảnh chụp** chép nó; ⋯ → **Chụp toàn trang** chụp toàn bộ trang của bản xem trước đó thành một ảnh PNG dài, từng màn hình một, header cố định và thanh cookie chỉ hiện một lần (trang rất dài dừng sau 30 màn hình).

Ghi chú hiện trong ảnh chụp. Muốn ảnh sạch, hãy thử **Ẩn banner cookie** (Pro) và **Tạm dừng hiệu ứng động**.

<a id="annotate"></a>

### Chú thích ảnh chụp — Mới ở 0.12

Chỉ ra chỗ sai — và che những gì riêng tư — trước khi chia sẻ ảnh chụp.

1. **Chụp ảnh → Chú thích ảnh chụp…** (hoặc “Chú thích ảnh chụp” trong bảng lệnh). Mọi bản xem trước đang hiện được chụp vào một ảnh có nhãn, giống **Mọi viewport trong một ảnh**, rồi mở trong trình chỉnh sửa.
2. Chọn một công cụ trong **Công cụ vẽ**:
   - **Mũi tên** và **Khung** — kéo trên ảnh; giữ `Shift` để nét nghiêng 45° và khung vuông.
   - **Bút** và **Bút dạ quang** — vẽ tự do; bút dạ quang to và trong suốt.
   - **Chữ** — bấm vào chỗ đặt nhãn, gõ nội dung, nhấn `Enter` (`Esc` để hủy).
   - **Bước đánh số** — mỗi lần bấm đặt số tiếp theo (1, 2, 3…), khớp với danh sách các bước trong ticket.
   - **Che (làm mờ điểm ảnh)** — kéo lên tên, email, giá tiền hay bất cứ gì riêng tư: vùng đó bị làm mờ điểm ảnh trong ảnh được lưu.
   - **Chọn và di chuyển** — bấm một nét để chọn, kéo để di chuyển nét hoặc các điểm điều khiển, `Delete` để xóa.
3. Chọn **Màu** (đỏ, cam, vàng, xanh lá, xanh dương, đen, trắng) và **Độ dày nét** (**Mảnh**, **Vừa**, **Dày**); khi đang chọn một nét, chúng đổi nét đó.
4. **Hoàn tác** và **Làm lại** (`Ctrl/⌘ + Z`, `Shift + Ctrl/⌘ + Z`), hoặc **Xóa mọi nét**.
5. **Lưu PNG** (độ phân giải đầy đủ) hoặc **Chép ảnh**.

Ảnh và các nét vẽ chỉ nằm trong tab Breakpointer cho tới khi bạn lưu hoặc chép. Trong ứng dụng: **Chú thích ảnh chụp**.

### Ảnh trình diễn

Trang của bạn ở nhiều kích thước trong khung thiết bị đơn giản trên nền đẹp — cho portfolio, khách hàng hoặc bài đăng.

1. **Chụp ảnh → Ảnh trình diễn…** (hoặc bảng lệnh).
2. Chọn tối đa bốn **Viewport**, **Khung** (**Thiết bị**, **Cửa sổ** hoặc **Không**), **Nền** (**Chàm**, **Sáng**, **Tối** hoặc **Trong suốt**), **Tỉ lệ** (**16:9**, **4:3** hoặc **Vuông**) và **Tiêu đề** (tùy chọn). **Ghi nguồn Breakpointer** thêm một dòng nhỏ “Made with Breakpointer”; tắt đi nếu muốn.
3. **Tải PNG** (vẽ ở gấp đôi kích thước hoặc theo mật độ màn hình của bạn) hoặc **Chép ảnh**. **Chụp lại** sau khi trang thay đổi.

Khung chỉ để trang trí: bản xem trước hiển thị trang ở các kích thước viewport này, không phải trên thiết bị thật.

Trong ứng dụng: **Chia sẻ ảnh chụp**.

### Báo cáo HTML

**Công cụ → Xuất báo cáo…** lưu một tệp HTML độc lập: ảnh chụp và kết quả kiểm tra của mọi viewport đang hiện, điểm responsive, thông số trang của từng bản xem trước, lần quét chiều rộng gần nhất của trang và phần tử đang soi. Báo cáo được tạo ngay trong trình duyệt; không có gì được tải lên. Với **Thương hiệu riêng trên báo cáo (Pro)**, báo cáo ghi “Thực hiện bởi …” kèm tên, website và logo của bạn.

<a id="score-badge"></a>

### Huy hiệu điểm — Mới ở 0.11

Khoe điểm responsive của trang bằng một huy hiệu — “responsive | 92 A” — trong README, pull request hay báo cáo gửi khách hàng.

1. Mở bảng rà soát (`E`) ở tab **Vấn đề**.
2. Trên thẻ điểm responsive, bấm **Chép huy hiệu** (SVG được đưa vào bộ nhớ tạm: dán vào một tệp hoặc README) hoặc **Tải huy hiệu (SVG)**.

<a id="score-history"></a>

### Lịch sử điểm — Mới ở 0.12

Xem điểm responsive của trang tăng lên khi bạn sửa lỗi.

- Mỗi lần mọi bản xem trước của một trang đã kiểm tra xong, điểm được lưu cho ngày đó (điểm cuối cùng trong ngày) — chỉ trên thiết bị này, dưới một mã tạo từ địa chỉ trang, không bao giờ lưu chính địa chỉ; 30 ngày cho tối đa 200 trang.
- Từ ngày thứ hai, thẻ điểm trong Rà soát hiện một biểu đồ nhỏ và mức thay đổi so với ngày đầu tiên được lưu — ví dụ **+12 so với 2 thg 11 · 5 ngày** — màu xanh khi điểm tăng.
- Nút thùng rác trên thẻ xóa toàn bộ lịch sử (có **Hoàn tác**). Lịch sử không nằm trong tệp xuất cài đặt.

Trong ứng dụng: **Theo dõi điểm của trang**.

### Chế độ trình chiếu

Chỉ còn các bản xem trước, toàn màn hình khi Chrome cho phép — để chia sẻ màn hình hoặc demo cho khách hàng.

1. Nhấn `D`, bấm **Trình chiếu** trên thanh trên cùng, hoặc lệnh “Chế độ trình chiếu” trong bảng lệnh.
2. Một thanh nhỏ có bố cục, **Vừa màn hình**, **Tự cuộn** (Mới ở 0.11) và **Thoát**.
3. `Esc` hoặc **Thoát** để rời chế độ này.

### Tự cuộn — Mới ở 0.11

Mọi bản xem trước tự cuộn chậm từ trên xuống dưới, cùng lúc — dành cho demo và quay màn hình.

- Ở chế độ trình chiếu, bấm **Tự cuộn** trên thanh (20 giây để cuộn hết trang); trong lúc chạy, nút đổi thành **Dừng**.
- Hoặc trong bảng lệnh, chọn “Tự cuộn mọi bản xem trước” với 10, 20 hoặc 40 giây, và “Dừng tự cuộn” để dừng.

Tự cuộn một bản xem trước sẽ dừng việc tự cuộn tại chỗ đó.

Trong ứng dụng: **Trình chiếu bản demo responsive** (Mới ở 0.11).

### Cửa sổ thật

Mở mỗi viewport đang hiện thành một cửa sổ Chrome riêng có vùng nội dung đúng kích thước, xếp cạnh nhau: **Mở thành cửa sổ thật** trên thanh trên cùng hoặc trong menu Công cụ. Đó là các trang bình thường, nên đăng nhập, kiểm tra chống bot và trang từ chối hiển thị trong khung đều hoạt động. Chúng đi theo địa chỉ bạn xem trước trong vùng làm việc; dải thông báo có **Hiện các cửa sổ**, **Chụp các cửa sổ** (mọi cửa sổ trong một ảnh) và **Đóng các cửa sổ**. Chrome có thể giới hạn cửa sổ theo kích thước màn hình; Breakpointer sẽ báo khi điều đó xảy ra.

Với một bản xem trước, dùng menu ⋯ của thẻ → **Mở cửa sổ đúng kích thước này** (hoặc **Mở trong tab mới**).

### Xem trước nổi

Một cửa sổ nhỏ luôn nằm trên cùng, hiện trang ở một kích thước viewport — đặt bản xem trước cỡ điện thoại cạnh trình soạn code. Nhấn `P`, hoặc **Xem trước nổi** trên thanh trên cùng hay trong Công cụ. Nó đi theo địa chỉ của vùng làm việc; thanh công cụ của nó cho đổi **Viewport**, tải lại, hoặc **Quay về vùng làm việc**. Tính năng cần Document Picture-in-Picture của Chrome; nếu trình duyệt không hỗ trợ, Breakpointer sẽ báo.

### Thanh bên Chrome

Xem trước trang đang mở trong thanh bên (side panel) của Chrome, ở cỡ điện thoại (hoặc bất kỳ kích thước có sẵn nào): **Xem trước ở thanh bên** trong popup, hoặc chuột phải vào trang hay liên kết → **Xem trước trang này ở thanh bên** / **Xem trước liên kết ở thanh bên**. Chọn **Kích thước**, **Xoay**, gõ địa chỉ, hoặc bật **Đi theo tab hiện tại** (trên trang bạn đã cho phép). **Mở trong vùng làm việc** đưa trang sang vùng làm việc đầy đủ. Thanh bên nhớ kích thước bạn chọn.

### Xuất dữ liệu (Pro)

**Xuất** trong Kiểm tra nhiều trang, Quét mọi chiều rộng và bảng rà soát lưu **CSV cho bảng tính** (mỗi hàng là một trang, kích thước và vấn đề — hoặc một khoảng vấn đề, hoặc một bản xem trước) hoặc **JSON cho script** (toàn bộ kết quả, kể cả thẻ meta, hình ảnh và màu sắc của bảng rà soát).

---

<a id="css-toolkit"></a>

## 8. Bộ công cụ CSS — Mới ở 0.11

Kích thước co giãn, đơn vị, breakpoint, màu và tỉ lệ — tính sẵn theo các kích thước bạn đang xem. Mỗi công cụ hiện kết quả ở từng viewport đang hiện, để bạn thấy các con số có ý nghĩa gì trên chính trang của mình, và nút **Chép** đưa CSS vào bộ nhớ tạm.

Mở bằng `U`, **Công cụ → Bộ công cụ CSS**, hoặc lệnh “Bộ công cụ CSS: …” trong bảng lệnh (mở thẳng tab đó). Có tám tab: **Fluid type**, **Đơn vị**, **Breakpoint**, **Màu**, **Tỉ lệ khung** và, mới ở 0.12, **Grid**, **Ảnh** và **Query**. Hãy hiện một viewport để xem giá trị ở kích thước của nó.

Trong ứng dụng: **Fluid type với Bộ công cụ CSS**.

<a id="fluid-type"></a>

### Fluid type

Biến một cỡ cho viewport nhỏ nhất và một cỡ cho viewport lớn nhất thành một `clamp()` CSS tăng mượt ở khoảng giữa.

1. Ở **Tạo gì**, chọn **Một kích thước**.
2. Đặt **Viewport nhỏ nhất** và **Viewport lớn nhất** — hoặc bấm **Dùng chiều rộng các bản xem trước** để lấy theo bản xem trước hẹp nhất và rộng nhất.
3. Đặt **Cỡ ở viewport nhỏ nhất** và **Cỡ ở viewport lớn nhất**, chọn **Viết kích thước bằng** px hoặc rem (kèm **Cỡ chữ gốc**, mặc định 16) và **Thuộc tính** CSS (mặc định `font-size`).
4. Đọc khai báo — ví dụ `font-size: clamp(…);` — và cỡ chữ nó cho ra **Ở các viewport của bạn**. Bấm **Chép**.

Dưới viewport nhỏ nhất, cỡ chữ giữ ở mức nhỏ nhất; trên viewport lớn nhất, giữ ở mức lớn nhất. Phần `rem` trong giá trị giữa giúp chữ vẫn phóng to được. Nếu cỡ lớn nhất gấp hơn 2,5 lần cỡ nhỏ nhất, bộ công cụ cảnh báo rằng khi phóng to 200%, chữ có thể không lớn gấp đôi (WCAG 1.4.4).

**Thang cỡ chữ.** Chọn **Thang cỡ chữ** ở **Tạo gì** để có cả một bộ cỡ chữ: **Chữ thân bài ở nhỏ nhất** và **Chữ thân bài ở lớn nhất**, **Tỉ lệ thang ở nhỏ nhất** và **Tỉ lệ thang ở lớn nhất** (Quãng 2 thứ, Quãng 2 trưởng, Quãng 3 thứ, Quãng 3 trưởng, Quãng 4 đúng, Quãng 4 tăng, Quãng 5 đúng hoặc Tỉ lệ vàng), cùng **Số bậc nhỏ hơn thân bài** và **Số bậc lớn hơn thân bài** (tối đa 8 mỗi chiều). Bậc 0 là chữ thân bài; mỗi bậc lên nhân thêm một lần tỉ lệ thang. Mỗi bậc thành một `clamp()`, hiện ở từng viewport, và cả thang được chép thành biến CSS (custom properties) — dùng như `font-size: var(--step-2)`.

Mẹo: dán kết quả vào [CSS trực tiếp](#live-css) để thử trên trang ở mọi kích thước trước khi sửa code.

### Đơn vị

Gõ một **Giá trị** — số kèm đơn vị nếu muốn (`24px`, `1.5rem`, `4vw`) — hoặc chọn **Đơn vị**, rồi đặt **Cỡ chữ gốc** và **Cỡ chữ phần tử cha**. Một bảng cho thấy giá trị đó ở mọi đơn vị — `px`, `rem`, `em`, `pt`, `vw`, `vh`, `vmin` và `vmax` — ở từng viewport, đánh dấu những đơn vị thay đổi theo viewport; **Chép dạng Markdown** để chép bảng. `vw`, `vh`, `vmin` và `vmax` được tính theo kích thước của từng viewport; `em` dùng cỡ chữ phần tử cha; 1pt bằng 4/3 px. Tiện khi bản thiết kế ghi px còn CSS của bạn dùng rem.

### Breakpoint

Các breakpoint đang dùng — của một framework, của riêng bạn hoặc của chính trang (chọn ở **Breakpoint**; bộ đang chọn trên thanh công cụ được ghi **đang dùng**) — được viết thành code. Chọn **Viết dưới dạng**:

- **CSS · mobile first (min-width)**, **CSS · desktop first (max-width)** hoặc **CSS · cú pháp khoảng (range)**;
- **Map và mixin Sass**;
- **Tailwind CSS v4 (@theme)** hoặc **Tailwind CSS v3 (config)**;
- **CSS @custom-media**;
- **JavaScript** — breakpoint dạng object, kèm chuỗi media query cho `window.matchMedia`.

Chọn **Đơn vị trong query** (px hoặc em) rồi **Chép**. Giá trị `em` tính theo 16 px, vì trình duyệt hiểu `em` trong media query như vậy; query `max-width` dừng sớm 0,02 px để không chiều rộng nào thuộc hai khoảng. Breakpoint của chính trang được đọc từ CSS của nó khi bản xem trước của một trang đã cho phép tải xong.

### Màu

Gõ một **Màu** — `#4f46e5`, `rgb(79 70 229)`, `hsl(243 75% 59%)`, `oklch(51% 0.23 277)` hoặc tên màu — **Chọn một màu**, hoặc **Hút màu trên màn hình** bằng ống hút màu (từ bất kỳ bản xem trước nào). Danh sách **Định dạng** cho thấy màu đó ở dạng HEX, RGB, HSL và OKLCH: **Chép** từng dạng, hoặc **Chép mọi định dạng**. Độ tương phản khi làm màu chữ **Trên nền trắng** và **Trên nền đen** được xếp **Đạt AA**, **Chỉ đạt AA cho chữ lớn** hoặc **Không đạt AA**. **Màu gần đây** giữ các màu bạn đã chọn trong phiên làm việc. Muốn kiểm tra đầy đủ chữ trên nền, hãy dùng [kiểm tra độ tương phản màu](#colour-contrast-checker) (`C`).

### Tỉ lệ khung

Nhập **Rộng** và **Cao** — hoặc chọn một trong các **Tỉ lệ phổ biến** (1:1, 4:3, 16:9, 21:9, 9:16…), hoặc **Lấy từ một viewport…** — để có **Tỉ lệ** tối giản (và tỉ lệ phổ biến mà nó **Gần với**, ví dụ 1366 × 768 ≈ 16:9) cùng CSS: khai báo `aspect-ratio` kèm phương án dự phòng bằng `padding-top`. Đặt **Độ rộng khối** theo phần trăm viewport (mặc định 100%) để xem **Độ rộng khối** và **Chiều cao khối** **Ở các viewport của bạn**, kèm ghi chú khi khối **Cao hơn viewport**.

### Grid — Mới ở 0.12

`repeat(auto-fit, minmax(…, 1fr))` tạo ra bao nhiêu cột ở từng viewport của bạn — biết trước khi viết.

1. Đặt **Cột hẹp nhất**, **Khoảng cách**, **Lề hai bên** của khung chứa, tùy chọn **Rộng tối đa (tùy chọn)** và **Số cột tối đa (tùy chọn)**, cùng **Số mục** trong grid.
2. Chọn **Kiểu lặp**: **auto-fit** (các mục giãn ra lấp đầy hàng) hoặc **auto-fill** (cột trống vẫn giữ chỗ).
3. Xem **Ở các viewport của bạn**: **Số cột**, **Độ rộng mỗi mục**, **Số hàng** và một bản **Xem nhanh**; độ rộng màu hổ phách nghĩa là khung chứa hẹp hơn một cột (`min(100%, …)` trong CSS giữ cho nó không tràn).
4. **Chép** CSS — không cần media query.

<a id="toolkit-images"></a>

### Ảnh — Mới ở 0.12

Mã ảnh responsive theo cách ảnh được bố trí.

1. Ở **Ảnh được đặt**, chọn **Rộng bằng viewport**, **Trong một cột nội dung** (kèm lề hai bên và độ rộng tối đa), **Một phần của viewport** (theo vw) hoặc **Cùng độ rộng ở mọi nơi**.
2. Đặt **Tỉ lệ** của ảnh (rộng và cao, ví dụ 16 và 9), **Tên tệp** với `{w}` ở chỗ độ rộng (`photo-{w}.jpg`) và **Văn bản thay thế**.
3. Bật **Dưới màn hình đầu** để tải lười (tắt thì ảnh chính có `fetchpriority="high"`), và **AVIF và WebP** để có `<picture>` ưu tiên định dạng nhỏ hơn.
4. Bảng cho thấy ảnh **Hiển thị ở** độ rộng nào và **Tệp cho màn hình 2×** ở từng viewport; **Chép** mã — `sizes`, các độ rộng `srcset` mà viewport của bạn cần ở 1× và 2×, cùng `width` và `height` để trang không bị xô lệch khi tải.

### Query — Mới ở 0.12

Thử một media query với các viewport của bạn: gõ vào **Media query** — hoặc bấm một **Ví dụ** — và xem **Áp dụng ở 2 trên 3 viewport**, mỗi viewport được đánh dấu **Áp dụng**, **Không áp dụng** hoặc **Tùy trình duyệt** (với hover, pointer hay độ phân giải, những thứ tùy thiết bị). Chiều rộng, chiều cao, hướng màn hình và tỉ lệ khung được tính theo từng viewport (em và rem theo 16 px), hỗ trợ min-/max- hoặc cú pháp khoảng, `and`, `or`, `not`, danh sách và loại media; `prefers-color-scheme` theo màu trang của từng bản xem trước. Query không đọc được sẽ được báo.

---

<a id="settings"></a>

## 9. Cài đặt

Mở **Cài đặt** bằng nút bánh răng trên thanh trên cùng. Các mục nằm ở cột bên trái; thay đổi được lưu ngay, trên thiết bị này.

| Mục                           | Nội dung                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Giao diện**                 | **Chủ đề** (Theo hệ thống, Sáng, Tối; `T` chuyển sáng ↔ tối). **Màu nhấn**: Chàm, Xanh dương, Tím, Xanh ngọc, Hồng, Than chì — dễ đọc ở cả hai giao diện. **Nền vùng làm việc** phía sau bản xem trước: Chấm, Lưới, Trơn. **Bố cục**: Xuống dòng, Một hàng, Xếp dọc. **Bảng phụ**: Thanh bên viewport, Thanh trạng thái, Bản đồ thu nhỏ. **Ngôn ngữ**: Theo Chrome, hoặc một trong mười ngôn ngữ. |
| **Vùng làm việc**             | **Nhãn breakpoint**; **Breakpoint tùy chỉnh** (Tên, Từ (px), **Thêm breakpoint**, **Dùng của trang này**); **Hiện thước đo**; **Gợi ý cho trang bị chặn**; **Ghi nhớ địa chỉ gần đây** và **Xóa địa chỉ gần đây**.                                                                                                                                                                                |
| **Công cụ xem trước**         | **Cuộn đồng bộ**, **Điều hướng đồng bộ**, **Đồng bộ nhấp & gõ phím** (Pro); **Kiểm tra responsive** và **Các mục kiểm tra** (bật/tắt từng mục); **Lưới cột** (Số cột: Tự động (4 · 8 · 12) hoặc 4–16, Khoảng cách cột, Lề hai bên, Đường baseline); **Ngân sách hiệu năng** (Pro): Dung lượng tải (kB), Số yêu cầu, LCP (ms), CLS — để trống là không giới hạn.                                   |
| **Thương hiệu của bạn** (Pro) | **Tên**, **Website**, **Logo** (PNG, JPEG hoặc WebP tối đa 150 KB) và **Nhắc đến Breakpointer** — hiển thị trên báo cáo, báo cáo Kiểm tra nhiều trang và hình ảnh thay cho Breakpointer.                                                                                                                                                                                                          |
| **Trang đã lưu**              | Các trang đã gắn sao: **Mở** hoặc bỏ lưu.                                                                                                                                                                                                                                                                                                                                                         |
| **Sao lưu & đặt lại**         | **Xuất cài đặt** / **Nhập cài đặt** (JSON); **Ảnh mốc** (xóa theo trang hoặc **Xóa mọi ảnh mốc**); **Đặt lại vùng làm việc** (khôi phục viewport mặc định, giữ nguyên các nhóm đã lưu).                                                                                                                                                                                                           |
| **Gói**                       | Gói miễn phí, dùng thử Pro hoặc giấy phép: **Dùng thử Pro miễn phí 7 ngày**, **Mua Pro**, ô **Khóa giấy phép** với nút **Kích hoạt**, giấy phép cấp cho ai và đến khi nào, **Gỡ giấy phép**, và **Pro có gì**.                                                                                                                                                                                    |
| **Quyền riêng tư & truy cập** | **Quản lý quyền truy cập trang**, **Tùy chỉnh phím tắt Chrome** và số phiên bản.                                                                                                                                                                                                                                                                                                                  |

Mười ngôn ngữ gồm English, Tiếng Việt, Español, Português (Brasil), Français, Deutsch, 日本語, Bahasa Indonesia, 简体中文 và Русский, áp dụng cho giao diện, menu của Chrome và trang giới thiệu trên store.

**Xuất và nhập.** Tệp xuất chứa viewport, nhóm, tùy chọn, trang đã lưu, đoạn CSS, dự án, mục kiểm tra QA, ngân sách và thương hiệu — để cả nhóm dùng chung một thiết lập. Tệp xuất không bao giờ chứa địa chỉ gần đây hay địa chỉ cuối cùng, ảnh mốc, quyền truy cập trang, khóa giấy phép hay ngày bắt đầu dùng thử. Nhập cài đặt chỉ thay những gì có trong tệp, và có thể hoàn tác.

---

<a id="breakpointer-pro"></a>

## 10. Breakpointer Pro

Mọi thứ Breakpointer làm được trước khi có Pro đều miễn phí và sẽ luôn miễn phí. Pro thêm công cụ cho người kiểm thử website chuyên nghiệp:

| Tính năng Pro                  | Làm gì                                                                                                                     | Ở đâu                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Kiểm tra trợ năng              | Ảnh thiếu alt, nút và liên kết không có tên, trường nhập không có nhãn, tiêu điểm rơi vào phần tử ẩn, trang thiếu ngôn ngữ | Thẻ, rà soát, quét chiều rộng, Kiểm tra nhiều trang         |
| Đồng bộ nhấp & gõ phím         | Thao tác nhấp và gõ ở một bản xem trước được lặp lại ở mọi bản xem trước của trang                                         | Công cụ, Cài đặt → Công cụ xem trước                        |
| Ẩn banner cookie               | Ẩn banner xin đồng ý của hơn 25 công cụ phổ biến (không chấp nhận gì)                                                      | Công cụ                                                     |
| Không giới hạn dự án           | Tối đa 50 dự án thay vì một                                                                                                | Dự án                                                       |
| Ngân sách hiệu năng            | Giới hạn dung lượng trang, số yêu cầu, LCP và CLS; đánh dấu bản xem trước vượt giới hạn                                    | Cài đặt → Công cụ xem trước; tab Hiệu năng của bảng rà soát |
| Thương hiệu riêng trên báo cáo | Tên, website và logo của bạn trên báo cáo và hình ảnh gửi đi                                                               | Cài đặt → Thương hiệu của bạn                               |
| Xuất CSV & JSON                | Kết quả Kiểm tra nhiều trang, quét chiều rộng và rà soát cho bảng tính và script                                           | **Xuất** ở ba nơi đó                                        |

Ở gói miễn phí, tính năng Pro được gắn nhãn **Pro**; chọn vào sẽ hiện những gì Pro mang lại.

**Dùng thử miễn phí.** Bảy ngày với mọi tính năng Pro, mỗi lần cài đặt được một lần — không cần thẻ, không cần tài khoản. Bắt đầu từ nút **Nâng cấp Pro** trên thanh trên cùng (trong thời gian dùng thử, nút đếm ngược số ngày còn lại) hoặc **Cài đặt → Gói → Dùng thử Pro miễn phí 7 ngày**.

**Mua và kích hoạt.**

1. Bấm **Nâng cấp Pro** trên thanh trên cùng, rồi **Mua Pro** trong hộp thoại: trang mua mở trong thẻ mới. (Nếu hộp thoại báo giấy phép sắp được mở bán, bạn vẫn có thể bắt đầu dùng thử.)
2. Chép khóa giấy phép trong email mua hàng.
3. **Cài đặt → Gói** (hoặc lệnh “Nhập khóa giấy phép” trong bảng lệnh) → dán vào **Khóa giấy phép** → **Kích hoạt**.
4. Cài đặt → Gói cho biết giấy phép cấp cho ai và có hiệu lực đến khi nào (hoặc **Không hết hạn**). **Gỡ giấy phép** xóa khóa khỏi trình duyệt này, có Hoàn tác.

Khóa được kiểm tra ngay trong trình duyệt bằng một khóa công khai có sẵn trong Breakpointer — không tài khoản, không máy chủ, không gửi gì đi.

---

<a id="keyboard-shortcuts"></a>

## 11. Phím tắt

Phím tắt một phím chạy trong vùng làm việc, không chạy khi bạn đang gõ vào ô nhập hoặc khi có hộp thoại hay menu đang mở. Chúng cũng tạm dừng khi bạn đang thao tác trong một bản xem trước: bấm vào nền vùng làm việc để dùng lại. Phím tắt theo vị trí phím vật lý, nên vẫn chạy khi bật bộ gõ tiếng Việt (Telex/VNI) hay dùng bàn phím khác kiểu.

| Phím                   | Tác dụng                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Ctrl/⌘ + K` hoặc `K`  | Bảng lệnh                                                                                                                        |
| `/`                    | Chuyển đến thanh địa chỉ                                                                                                         |
| `R`                    | Tải lại tất cả bản xem trước                                                                                                     |
| `A`                    | Thêm viewport                                                                                                                    |
| `G`                    | Nhóm                                                                                                                             |
| `F`                    | Thu phóng vừa màn hình                                                                                                           |
| `+` / `−`              | Phóng to / thu nhỏ                                                                                                               |
| `0`                    | Thu phóng 100%                                                                                                                   |
| `L`                    | Đổi bố cục (xuống dòng → một hàng → xếp dọc)                                                                                     |
| `\`                    | Hiện hoặc ẩn thanh bên viewport                                                                                                  |
| `M`                    | Thước đo                                                                                                                         |
| `I`                    | Soi phần tử                                                                                                                      |
| `E`                    | Rà soát                                                                                                                          |
| `W`                    | Quét mọi chiều rộng                                                                                                              |
| `B`                    | Kiểm tra nhiều trang                                                                                                             |
| `V`                    | Kiểm tra hình ảnh                                                                                                                |
| `Q`                    | Checklist kiểm thử                                                                                                               |
| `U`                    | Bộ công cụ CSS — **Mới ở 0.11**                                                                                                  |
| `J`                    | Elements: HTML và CSS — **Mới ở 0.13**                                                                                           |
| `X`                    | Đo khoảng cách                                                                                                                   |
| `N`                    | Ghi chú                                                                                                                          |
| `C`                    | Độ tương phản màu                                                                                                                |
| `O`                    | Viền bố cục                                                                                                                      |
| `P`                    | Xem trước nổi                                                                                                                    |
| `D`                    | Chế độ trình chiếu                                                                                                               |
| `H`                    | Chế độ “Đây là gì?”                                                                                                              |
| `S`                    | Chụp vùng làm việc đang hiển thị                                                                                                 |
| `T`                    | Đổi giao diện sáng/tối                                                                                                           |
| `[` / `]`              | Tập trung vào viewport trước / sau                                                                                               |
| `1` … `8`              | Tập trung vào viewport đó (nhấn lại: hiện tất cả)                                                                                |
| `Esc`                  | Thoát trình chiếu, chọn phần tử, đo, ghi chú, chế độ tập trung, bảng soi, mô phỏng thị lực, bảng rà soát hoặc checklist kiểm thử |
| `Alt + ←` / `Alt + →`  | Trang trước / trang sau (khi chip đang có tiêu điểm: di chuyển chip)                                                             |
| `?`                    | Trợ giúp                                                                                                                         |
| `Space` + kéo          | Di chuyển vùng làm việc                                                                                                          |
| `Ctrl/⌘` + lăn chuột   | Thu phóng mọi viewport                                                                                                           |
| Kéo cạnh bản xem trước | Đổi kích thước (`Shift`: bước 10 px, `Alt`: không bắt dính)                                                                      |
| `Alt + ↑` / `Alt + ↓`  | Đổi thứ tự viewport trong thanh bên                                                                                              |
| `Ctrl/⌘ + Enter`       | Áp dụng CSS trực tiếp (trong hộp thoại CSS trực tiếp)                                                                            |
| Phím mũi tên           | Đi giữa các ô của checklist kiểm thử; đổi kích thước khi cạnh bản xem trước có tiêu điểm                                         |

**Ở bất kỳ đâu trong Chrome:**

| Phím             | Tác dụng                                   |
| ---------------- | ------------------------------------------ |
| `Alt+Shift+V`    | Mở Breakpointer (popup)                    |
| `Alt+Shift+P`    | Xem trước trang hiện tại                   |
| `bpt` + dấu cách | Từ khóa trên thanh địa chỉ: rồi gõ địa chỉ |

Đổi phím tắt của Chrome tại `chrome://extensions/shortcuts`.

---

<a id="privacy-and-permissions"></a>

## 12. Quyền riêng tư và quyền truy cập

- Không tài khoản, không máy chủ, không thống kê, không theo dõi. Breakpointer không thu thập và không gửi gì đi đâu cả.
- Cài đặt nằm trong trình duyệt của bạn (`chrome.storage.local`); ảnh mốc nằm trong cơ sở dữ liệu riêng của tiện ích (IndexedDB); lịch sử điểm (từ 0.12) được lưu trên thiết bị này dưới một mã tạo từ địa chỉ mỗi trang, không bao giờ lưu chính địa chỉ.
- Bản xem trước là những lần tải trang bình thường do trình duyệt của bạn thực hiện, như khi bạn mở trang trong một tab.
- Trên trang bạn đã cho phép, một đoạn script nhỏ đóng gói sẵn trong Breakpointer chạy bên trong bản xem trước khi vùng làm việc đang mở, để đo bố cục cho các công cụ. Nó không bao giờ gửi nội dung chữ của trang; những gì nó đo được chỉ nằm trong tab Breakpointer.
- Breakpointer Pro không thêm quyền và không gửi yêu cầu nào: khóa giấy phép được kiểm tra ngay trong trình duyệt.

| Quyền                                 | Dùng để                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `storage`                             | Lưu viewport, nhóm và tùy chọn của bạn trên máy                                                    |
| `activeTab`                           | Đọc địa chỉ của tab hiện tại khi bạn gọi Breakpointer                                              |
| `contextMenus`                        | Mục “Xem trước bằng Breakpointer” trên trang và liên kết                                           |
| `declarativeNetRequestWithHostAccess` | Cho bản xem trước của trang **bạn đã cho phép** bỏ qua việc chặn nhúng, chỉ bên trong Breakpointer |
| `scripting`                           | Chạy script của chính Breakpointer trong bản xem trước của trang **bạn đã cho phép**               |
| `sidePanel`                           | Bản xem trước trong thanh bên của Chrome                                                           |
| Quyền truy cập trang (tùy chọn)       | Chỉ xin khi đang dùng, theo từng trang hoặc cho mọi trang — không bao giờ xin lúc cài              |

Đọc đầy đủ [chính sách quyền riêng tư](PRIVACY.md) (tiếng Anh).

---

<a id="troubleshooting-and-faq"></a>

## 13. Xử lý sự cố và câu hỏi thường gặp

**Bản xem trước trống hoặc báo “refused to connect”.**
Trang đó yêu cầu trình duyệt không hiển thị nó bên trong trang khác. Bấm **Cho phép trên _trang_** trong gợi ý (hoặc **Đến khi đóng Chrome**), rồi tải lại. Nếu vẫn không hiện, dùng menu ⋯ của thẻ → **Mở cửa sổ đúng kích thước này**, hoặc **Mở thành cửa sổ thật**.

**Thẻ hiện HTTP 403 (hoặc mã khác).**
Trang trả lỗi cho bản xem trước đó: một số trang từ chối hiển thị trong khung, kiểm tra chống bot hoặc cần bạn đăng nhập trong một tab trước. Đăng nhập trong tab bình thường rồi tải lại — hoặc mở viewport trong cửa sổ đúng kích thước.

**Công cụ ghi “chạy trên các trang bạn cho phép”, hoặc bảng rà soát, bảng soi hay kiểm tra không hiện gì.**
Các công cụ đó chạy bên trong bản xem trước và cần [quyền truy cập trang](#site-access). Dùng **Cho phép _trang_…** trong menu Công cụ, bảng rà soát hoặc bảng soi, hoặc trên thanh trạng thái. Mô phỏng thị lực, đo khoảng cách, phủ ảnh thiết kế và lưới cột không cần quyền này.

**Chụp ảnh đòi quyền trên mọi trang.**
Chrome chỉ cho tiện ích chụp ảnh tab khi có quyền trên mọi trang. Cấp một lần bằng **Cho phép và chụp**; bạn có thể gỡ sau trong Quyền truy cập trang. Kiểm tra hình ảnh và ảnh trình diễn cũng cần quyền này.

**Tôi đã đăng nhập trang web, nhưng bản xem trước thì không.**
Khi có quyền truy cập trang, cookie và bộ nhớ của trang được đưa vào bản xem trước, nên trạng thái đăng nhập thường giữ nguyên. Một số luồng đăng nhập, banner cookie và kiểm tra chống bot vẫn có thể hoạt động khác khi ở trong khung. Hãy dùng **Mở thành cửa sổ thật** — đó là các trang bình thường.

**Vì sao Breakpointer không giả lập thiết bị?**
Breakpointer thay đổi kích thước viewport, thứ mà CSS responsive phản hồi theo. User agent, mật độ điểm ảnh, cảm ứng và nhân trình duyệt vẫn là của Chrome bạn đang dùng. Tên thiết bị trong danh sách kích thước và khung của ảnh trình diễn chỉ mô tả kích thước, không phải thiết bị. **Kiểu cho màn hình cảm ứng** (Mới ở 0.11) chỉ đổi hai media feature `hover` và `pointer`. Với lỗi riêng của từng trình duyệt, hãy thử trên trình duyệt hoặc thiết bị thật.

**Không biết được breakpoint của trang.**
CSS của trang nằm ở tên miền khác và không đọc được. Hãy dùng bộ breakpoint của một framework hoặc breakpoint của riêng bạn.

**Phím tắt không chạy.**
Có lẽ một bản xem trước đang có tiêu điểm (bạn vừa bấm vào bên trong nó). Bấm vào nền vùng làm việc. Phím tắt cũng tạm dừng khi bạn đang gõ vào ô nhập hoặc có hộp thoại đang mở.

**Trang trên máy (localhost) không tải.**
Hãy ghi cả cổng của server dev, ví dụ `localhost:5173`. Chỉ địa chỉ `http://` và `https://` dùng được.

**Vùng làm việc bị chậm.**
Mỗi bản xem trước đang hiện là một lần tải trang đầy đủ. Ẩn bớt viewport không cần (bản xem trước bị ẩn không tải trang), dừng so sánh hai địa chỉ, hoặc tắt tự động tải lại.

**Quét chiều rộng dừng sớm.**
Mỗi lượt quét kiểm tra tối đa 600 chiều rộng và tạm chờ khi tab bị ẩn. Hãy thu hẹp khoảng hoặc tăng bước; kết quả cho biết mép chính xác đến mức nào.

**Kiểm tra hình ảnh báo thay đổi mà tôi không làm.**
Hãy so sánh ở cùng kích thước cửa sổ và mức thu phóng; viewport chụp ở kích thước khác sẽ hiện việc co giãn thành thay đổi nhỏ. Tạm dừng hiệu ứng động và ẩn banner cookie (Pro) để ảnh chụp ổn định hơn.

**Xem trước nổi hoặc ống hút màu không mở.**
Cả hai dựa vào tính năng của Chrome bản mới. Nếu trình duyệt của bạn không có, Breakpointer sẽ báo; khi đó hãy nhập màu bằng tay thay vì lấy màu.

**Làm sao chuyển thiết lập sang máy khác hoặc chia sẻ với nhóm?**
**Cài đặt → Sao lưu & đặt lại → Xuất cài đặt**, rồi **Nhập cài đặt** ở máy kia. Nếu chỉ cần một trang và các viewport của nó, một **liên kết workspace** là đủ.

**Báo lỗi hoặc báo trang không hiển thị ở đâu?**
**Trợ giúp → Hỗ trợ → Gửi góp ý** mở các biểu mẫu issue trên GitHub. Tài liệu này là mục **Trợ giúp → Hỗ trợ → Hướng dẫn sử dụng** (từ 0.11); nó mở trên GitHub, bằng tiếng Việt khi Breakpointer đang dùng tiếng Việt.
