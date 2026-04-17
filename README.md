# Cloud Telegram Dashboard

Private dashboard một người dùng, dùng Telegram làm nơi lưu file thật và `data/metadata.json` làm nơi lưu metadata nội bộ. Dashboard hiện có lớp đăng nhập single-user bằng cookie `httpOnly` ký HMAC.

## Mô hình

1. Upload file từ dashboard
2. Server validate file
3. Server gửi file lên Telegram Bot API
4. Telegram trả `file_id`, `message_id`, `chat_id`
5. App lưu metadata vào `data/metadata.json`
6. Khi tải xuống, app dùng metadata để lấy URL tải từ Telegram

## Không còn trong bản này

- Không landing page
- Không login/auth nhiều user
- Không MongoDB
- Không admin dashboard riêng

## Cấu trúc chính

```text
src/
  app/
    api/
      files/
      folders/
      public/
      share/
      system/
    dashboard/
    share/
  components/
  lib/
  server/services/
data/
  metadata.json
```

## Biến môi trường

Tạo `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Biến quan trọng:

- `AUTH_USERNAME`
- `AUTH_PASSWORD` hoặc tốt hơn là `AUTH_PASSWORD_HASH`
- `AUTH_SECRET`
- `SESSION_TTL_HOURS`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_STORAGE_CHAT_ID`
- `MAX_FILE_SIZE`
- `ALLOWED_MIME_TYPES`
- `DEFAULT_STORAGE_QUOTA`
- `PUBLIC_APP_URL`
- `PRIVATE_LINKS_ONLY`

`REDIS_URL` hiện không bắt buộc.

Mặc định app đang để:

```env
DEFAULT_STORAGE_QUOTA=5497558138880
```

Tức là quota logic nội bộ là `5 TB`.

Lưu ý:
- đây là quota do app tự quản lý
- không phải giới hạn tổng chính thức được Telegram công bố cho group/channel
- giới hạn upload từng file vẫn phụ thuộc cách bạn gửi file qua Telegram Bot API hiện tại

## Cấu hình đăng nhập an toàn

Để dùng nhanh:

```env
AUTH_USERNAME=admin
AUTH_PASSWORD=matkhau-rat-dai-va-kho-doan
AUTH_SECRET=mot-secret-rat-dai-va-ngau-nhien
```

Để an toàn hơn trong production, tạo hash trước:

```bash
npm run hash-password -- "matkhau-cua-ban"
```

Lệnh này trả ra chuỗi dạng:

```text
scrypt$<salt>$<hex_hash>
```

Sau đó dùng:

```env
AUTH_USERNAME=admin
AUTH_PASSWORD_HASH=scrypt$...
AUTH_SECRET=mot-secret-rat-dai-va-ngau-nhien
```

Khi đã dùng `AUTH_PASSWORD_HASH`, bạn nên bỏ `AUTH_PASSWORD` khỏi `.env`.

## Tạo bot Telegram

1. Mở Telegram và tìm `@BotFather`
2. Chạy `/newbot`
3. Lấy token
4. Gán token vào `TELEGRAM_BOT_TOKEN`

## Lấy `TELEGRAM_STORAGE_CHAT_ID`

1. Tạo channel hoặc group private
2. Add bot vào đó
3. Gửi một message bất kỳ
4. Mở:

```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
```

5. Tìm `chat.id`

## Chạy local

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`, app sẽ tự chuyển sang `/dashboard`.

## Docker

```bash
docker compose up --build
```

## Route chính

- `GET /api/files`
- `POST /api/files/upload`
- `GET /api/files/:id`
- `PATCH /api/files/:id`
- `DELETE /api/files/:id`
- `GET /api/files/:id/download`
- `GET /api/folders`
- `POST /api/folders`
- `POST /api/share/:id`
- `GET /api/public/:token`
- `GET /api/system/telegram/health`

## Vị trí quan trọng

- `src/server/services/telegram.service.ts`: gọi Telegram Bot API
- `src/server/services/file.service.ts`: mapping metadata với Telegram
- `data/metadata.json`: metadata store local

## Ghi chú

Project này phù hợp khi chỉ một mình bạn dùng dashboard riêng. Nếu sau này cần đa user hoặc public sharing mạnh hơn, lúc đó mới đáng quay lại database thật.
