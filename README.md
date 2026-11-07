# web-check-quota

เว็บแดชบอร์ดส่วนตัวสำหรับเช็คโควต้า เวลา Reset และสั่ง Wake-up บัญชี **Antigravity IDE**, **Codex (OpenAI)** และ **Claude (Anthropic)** ออกแบบมาเพื่อรันบน **Vercel + NeonDB PostgreSQL** โดยเฉพาะ

## การรันในเครื่อง (Local Development)

```bash
npm install
npm run db:init
npm run dev
```

## การนำไป Deploy ขึ้น Vercel

1. เข้าหน้าเว็บ Vercel กด **Add New -> Project** แล้วเลือก Repository `TontunHi/web-check-quota`
2. ในหัวข้อ **Environment Variables** ให้เพิ่มตัวแปรจากไฟล์ `.env.local`:
   - `DATABASE_URL` = Connection string ของ NeonDB
   - `ADMIN_PASSWORD` = รหัสผ่านสำหรับเข้าหน้าเว็บของคุณเอง
   - `APP_SECRET` = ข้อความสุ่มยาวอย่างน้อย 32 ตัวอักษร (ใช้เข้ารหัส Token ด้วย AES-256-GCM ในฐานข้อมูล)
   - `CRON_SECRET` = (ตัวเลือก) รหัสลับสำหรับให้ Cron ภายนอกเรียก `POST /api/cron/wakeup` พร้อม Header `Authorization: Bearer <CRON_SECRET>`
   - `GOOGLE_CLIENT_ID` = OAuth Client ID สำหรับเชื่อมต่อบัญชี Antigravity
   - `GOOGLE_CLIENT_SECRET` = OAuth Client Secret สำหรับเชื่อมต่อบัญชี Antigravity
3. กด **Deploy** ได้ทันที
