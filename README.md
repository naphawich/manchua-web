# มั่นชัวร์ — เว็บเดโม

เว็บแอปหน้าเดียว ไม่มี build step ไม่มี dependency เปิดไฟล์ `index.html` ก็ทำงานได้เลย

## ไฟล์ในโปรเจกต์

| ไฟล์ | หน้าที่ |
| :-- | :-- |
| `index.html` | โครงหน้า + CSS token ทั้งระบบ (white-label: โบรกเกอร์แก้เฉพาะตัวแปร `--brand-*`) |
| `engine.js` | เครื่องคิดเลข — gap engine, delta engine, แค็ตตาล็อกสินค้า |
| `app.js` | ทุกจอและ state ห้ามคำนวณ % หรือบาทในไฟล์นี้ ให้เรียกจาก `engine.js` เท่านั้น |

## ⚠ ห้ามแก้ index.html ในโฟลเดอร์นี้โดยตรง

ไฟล์ต้นทางอยู่นอกโฟลเดอร์นี้ (รูปแบบ artifact ที่ไม่มี `<!doctype>` / `<head>` / `<body>`)
เวลาจะอัปเดตให้แก้ที่ต้นทางแล้วรัน `python3 build.py` ซึ่งจะห่อโครง HTML เต็ม
พร้อม meta viewport, favicon และ og tag ให้ก่อนคัดลอกมาที่นี่

ถ้าคัดลอก index.html มาตรงๆ เว็บจะขาด meta viewport แล้วบนมือถือจริง
จะแสดงผลเป็นหน้าจอเดสก์ท็อปย่อส่วน

## รันดูในเครื่องก่อน

ต้องเปิดผ่านเซิร์ฟเวอร์ ไม่ใช่ double-click เพราะไฟล์ js โหลดข้ามกันไม่ได้ในโหมด `file://`

```bash
python3 -m http.server 8000
```

แล้วเปิด http://localhost:8000

## ขึ้น GitHub แล้วต่อ Vercel

โฟลเดอร์นี้ init git และ commit แรกไว้ให้แล้ว (branch `main`) เหลือแค่ผูก remote กับ push

### ทางที่ใช้เบราว์เซอร์อย่างเดียว ไม่ต้องลงอะไรเพิ่ม

1. เข้า github.com/new ตั้งชื่อ repo เช่น `manchua-web` จะ public หรือ private ก็ได้
   Vercel ต่อกับ private repo ได้ปกติ **อย่าติ๊ก** Add a README เพราะจะชนกับของที่มีอยู่
2. ในหน้า repo ที่เพิ่งสร้าง กด `uploading an existing file` แล้วลากไฟล์
   `index.html` `app.js` `engine.js` `README.md` เข้าไป กด Commit
3. เข้า vercel.com กด **Add New → Project** เลือก repo นี้
4. ช่อง **Framework Preset** เลือก **Other** เว้น Build Command และ Output Directory ว่างไว้
5. กด **Deploy** รอราวครึ่งนาที จะได้ลิงก์ `ชื่อโปรเจกต์.vercel.app` ส่งให้คนอื่นได้เลย

หลังจากนี้ทุกครั้งที่ commit ขึ้น `main` Vercel จะ deploy ให้เอง

### ทางที่ใช้ terminal (ต้องมี Node กับ gh ก่อน)

```bash
gh repo create manchua-web --private --source=. --push
npx vercel --prod
```

ถ้ายังไม่มี Node กับ gh ติดตั้งด้วย Homebrew ก่อน

```bash
brew install node gh
```

## ก่อนเปิดให้คนนอกใช้จริง

- ข้อมูลสินค้าใน `engine.js` เป็นตัวอย่างสำหรับเดโม ไม่ใช่เบี้ยจริง — ต้องแทนที่ด้วยแค็ตตาล็อกที่ตรวจสอบแล้วก่อนใช้กับลูกค้าจริง
- อัตรา ม.40 ใน `CONFIG.m40` ต้องยืนยันกับสำนักงานประกันสังคม
- ตอนนี้ยังไม่มีฐานข้อมูล ทุกอย่างอยู่ใน memory ปิดแท็บแล้วข้อมูลหาย ซึ่งตรงกับหลัก progressive consent พอดี แต่ถ้าจะเก็บเคสจริงต้องต่อ Supabase และทำ RLS ตามที่ระบุในสเปก
