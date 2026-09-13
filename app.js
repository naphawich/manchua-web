/* ==========================================================================
   มั่นชัวร์ — เว็บเดโม
   ทุกตัวเลขบนจอมาจาก window.MC (engine.js) เท่านั้น ไฟล์นี้ไม่คำนวณเอง
   จอ: S1 หน้าแรก · S2 ฉันเป็นใคร · S3 คำถาม 8 ข้อ
       S4 ความเสี่ยง + ประกันที่เหมาะ (จอเดียว เลื่อนลง)
       S5 ยืนยันซื้อเอง · S6 เลือกโบรกเกอร์ · S7 Broker Co-Pilot
   ========================================================================== */
(function () {
  'use strict';

  const MC = window.MC;
  const B = MC.baht;
  const view = document.getElementById('view');
  const topbar = document.getElementById('topbar');
  const footbar = document.getElementById('footbar');
  const modal = document.getElementById('modal');

  const GROUP_MEDIAN_E = 15000;

  const S = {
    screen: 's1',
    caseId: null,
    profile: {
      age: null, occupationClass: null, occupationLabel: '',
      monthlyIncomeBaht: null, essentialExpenseE: null, liquidSavingsBaht: null,
      hasDependents: null, dependentsCount: 0, kidsUnder6: 0,
      incomeVolatility: null, healthFlags: [], debtBaht: 0,
      existing: {
        none: false,
        m40: { has: false, tier: null },
        health: { has: false, perYearBaht: null },
        hb: { has: false, dailyBaht: null },
        pa: { has: false, amountBaht: null },
        life: { has: false, amountBaht: null }
      }
    },
    scenario2: 'appendicitis', mode2: 'state', horizon3: 12,
    qi: 0, consentCoverage: null, estimatedE: false, skipped: {},
    budget: null, selected: [],
    tubes: null, ranking: null, tubesAnimated: false,
    brokerId: null, readExclusions: false, orderNo: null,
    booking: { nickname: '', lineId: '', slot: null, slotLabel: '', consent: false },
    audit: [], auditKeys: {}
  };

  /* ------------------------------------------------------------- helpers */

  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TICK = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6.2 4.7 9 10 3.2" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHEV = '<svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M11 3.5 5.5 9l5.5 5.5" stroke="#0C1B3A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const STATUS_TEXT = { red: 'ต้องรีบปิด', watch: 'ควรดูแล', ok: 'คุ้มครองแล้ว', unknown: 'ยังสรุปไม่ได้' };
  const STATUS_FACE = { red: '🙁', watch: '😐', ok: '🙂', unknown: '🤔' };
  const SEG_LABEL = { savings: 'เงินเก็บของคุณ', state: 'สิทธิรัฐ (ม.40)', always: 'ประกันที่จ่ายทุกกรณี', conditional: 'ประกันที่จ่ายบางเงื่อนไข' };

  /* ความเสี่ยงที่ตามมาในแต่ละระดับ — อ้างอิงข้อมูลภายนอก ไม่ใช่ความเห็นของระบบ */
  const RISK_NOTES = {
    red: {
      head: 'ระดับนี้เสี่ยงอะไรเพิ่มอีก',
      lines: [
        'เงินที่มีรองรับได้ไม่ถึงครึ่งของเป้าหมาย ถ้าเหตุเกิดเดือนหน้า ทางออกที่เหลือมักเป็นการหยิบยืมหรือกู้ระยะสั้น',
        'งานวิจัยหนี้ครัวเรือนไทยพบว่า กลุ่มอาชีพอิสระและเจ้าของกิจการพึ่งสินเชื่อนอกระบบมากกว่ากลุ่มอื่น ซึ่งดอกเบี้ยสูงและผิดนัดง่ายกว่า',
        'เงินกู้ฉุกเฉินที่ต่ออายุแต่ละรอบจะทบเงินต้นเพิ่ม ทำให้ยอดเล็กๆ กลายเป็นหนี้ที่จัดการไม่ได้ภายในไม่กี่สัปดาห์'
      ]
    },
    watch: {
      head: 'ระดับนี้เสี่ยงอะไรเพิ่มอีก',
      lines: [
        'พอรับเหตุการณ์เดียวได้ แต่ถ้าเกิดซ้ำในปีเดียวกัน หรือพักฟื้นนานกว่าที่คิด จะตกลงมาที่ระดับต้องรีบปิดทันที',
        'ช่วงนี้คนส่วนใหญ่แก้ด้วยการเลื่อนเป้าหมายอื่นออกไปก่อน เช่น หยุดเก็บเงินก้อนหรือเลื่อนการลงทุนในงานตัวเอง',
        'เงินสำรองที่ต่ำกว่า 3 เดือนถือเป็นจุดที่เริ่มเสี่ยงเข้าสู่วงจรหนี้เรื้อรังเมื่อเจอเหตุไม่คาดฝัน'
      ]
    },
    ok: {
      head: 'ระดับนี้ยังเหลือความเสี่ยงอะไร',
      lines: [
        'คุณอยู่ในกลุ่มที่เตรียมตัวดีกว่าค่าเฉลี่ย ผู้บริโภคไทยมากกว่า 70% มีเงินสำรองไม่ถึง 3 เดือน',
        'ที่ยังเหลือคือเหตุการณ์ใหญ่ผิดปกติ เช่น รักษาต่อเนื่องหลายเดือนหรือกลับไปทำงานเดิมไม่ได้',
        'จุดที่ควรระวังคือการเอาเงินก้อนนี้ไปใช้กับเรื่องอื่นจนเหลือไม่ถึงเป้าหมายโดยไม่รู้ตัว'
      ]
    },
    unknown: {
      head: 'ทำไมยังสรุปไม่ได้',
      lines: [
        'มีคำตอบที่คุณบอกว่าไม่แน่ใจ เราเลือกที่จะไม่เดาตัวเลขแทนคุณ เพราะการเดาสูงไปทำให้ประมาท และเดาต่ำไปทำให้ซื้อเกินจำเป็น',
        'ถ้าตอบเพิ่มอีกข้อเดียว แถบนี้จะกลายเป็นตัวเลขจริงทันที'
      ]
    }
  };

  const SOURCES = [
    { t: 'สำนักงานประกันสังคม — สิทธิผู้ประกันตนมาตรา 40', u: 'https://www.sso.go.th' },
    { t: 'Nation Thailand — คนไทยรายได้ต่ำกว่า 30,000 บาท แทบไม่มีเงินสำรองฉุกเฉิน', u: 'https://www.nationthailand.com/business/economy/40039000' },
    { t: 'Credit Segmentation and Household Vulnerability in Thailand (MDPI, 2025)', u: 'https://www.mdpi.com/1911-8074/18/11/632' }
  ];

  function audit(key, text, detail) {
    if (S.auditKeys[key]) return;
    S.auditKeys[key] = true;
    S.audit.push({ key, text, detail: detail || '', at: new Date() });
  }
  const hhmm = (d) => d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  function ensureCaseId() {
    if (!S.caseId) {
      S.caseId = 'MC-' + Math.random().toString(36).slice(2, 7).toUpperCase();
      audit('case', 'สร้างรหัสเคสแบบไม่ระบุตัวตน ' + S.caseId, 'ยังไม่มีชื่อ เบอร์ หรือ LINE ของลูกค้าในระบบ ณ จุดนี้');
    }
  }

  /* หลอดที่ช่องว่างมากที่สุด — ใช้เลือกข้อความและจับคู่โบรกเกอร์
     แยกออกมาเพราะลำดับที่แสดงผลคงที่แล้ว ไม่ได้เรียงตามความเสี่ยง */
  const worstTube = () => S.tubes.slice().sort((a, b) => a.pct - b.pct)[0];

  function recompute() {
    const p = S.profile;
    if (p.essentialExpenseE == null && S.skipped.expense) {
      p.essentialExpenseE = GROUP_MEDIAN_E;
      S.estimatedE = true;
    }
    S.tubes = MC.computeAllTubes(p, { scenario2: S.scenario2, mode2: S.mode2, horizon3: S.horizon3 });
    S.ranking = MC.rankRecommendations(p, { scenario2: S.scenario2, budget: S.budget }, S.tubes);
    return S.tubes;
  }

  function go(screen) {
    S.screen = screen;
    render();
    window.scrollTo(0, 0);
    view.classList.remove('fadein'); void view.offsetWidth; view.classList.add('fadein');
  }

  function backTop(target, label) {
    return `<button class="iconbtn" data-act="go" data-s="${target}" aria-label="ย้อนกลับ">${CHEV}</button>
      <div class="tbslot"><span class="eyebrow">${esc(label)}</span></div>`;
  }

  /* ==========================================================================
     S3 — ชุดคำถาม (แกน 8 ข้อ เลขต่อเนื่อง + คำถามกิ่ง)
     ========================================================================== */

  const Q = {
    age: {
      id: 'age', core: true,
      title: 'ตอนนี้อายุเท่าไหร่',
      sub: 'ใช้ตรวจว่าคุณสมัครแผนไหนได้บ้าง',
      options: [
        { label: '18–25 ปี', value: 22 }, { label: '26–35 ปี', value: 30 },
        { label: '36–45 ปี', value: 40 }, { label: '46–55 ปี', value: 50 },
        { label: '56–60 ปี', value: 58 }, { label: '61–65 ปี', value: 63 },
        { label: 'มากกว่า 65 ปี', value: 68 }
      ],
      get: () => S.profile.age, set: (v) => { S.profile.age = v; }
    },
    income: {
      id: 'income', core: true,
      title: 'เดือนปกติมีรายได้ประมาณเท่าไหร่',
      sub: 'ใช้ตรวจความสมเหตุสมผลของคำตอบข้อถัดไป ไม่ได้เอาไปตั้งเป้าหมายของแถบ',
      options: [
        { label: 'ไม่เกิน 15,000 บาท', value: 12000 }, { label: '15,000–30,000 บาท', value: 22500 },
        { label: '30,000–50,000 บาท', value: 40000 }, { label: '50,000–80,000 บาท', value: 65000 },
        { label: 'มากกว่า 80,000 บาท', value: 95000 }
      ],
      get: () => S.profile.monthlyIncomeBaht, set: (v) => { S.profile.monthlyIncomeBaht = v; }
    },
    expense: {
      id: 'expense', core: true,
      title: 'เดือนหนึ่งมีค่าใช้จ่ายที่ตัดไม่ได้เท่าไหร่',
      sub: 'เช่น ค่าเช่า ค่าผ่อน ค่ากิน ค่าเดินทาง ตอบคร่าวๆ ได้เลย',
      note: 'ข้อนี้เป็นตัวตั้งของทุกแถบ',
      options: [
        { label: 'ไม่เกิน 8,000 บาท', value: 7000 }, { label: '8,000–15,000 บาท', value: 11500 },
        { label: '15,000–25,000 บาท', value: 20000 }, { label: '25,000–40,000 บาท', value: 32500 },
        { label: 'มากกว่า 40,000 บาท', value: 48000 }
      ],
      get: () => S.profile.essentialExpenseE, set: (v) => { S.profile.essentialExpenseE = v; S.estimatedE = false; }
    },
    savings: {
      id: 'savings', core: true,
      title: 'มีเงินเก็บที่หยิบใช้ได้ทันทีเท่าไหร่',
      sub: 'นับเฉพาะเงินที่ถอนได้เลยวันนี้',
      options: [
        { label: 'ไม่ถึง 10,000 บาท', value: 5000 }, { label: '10,000–30,000 บาท', value: 20000 },
        { label: '30,000–80,000 บาท', value: 55000 }, { label: '80,000–200,000 บาท', value: 140000 },
        { label: 'มากกว่า 200,000 บาท', value: 260000 }, { label: 'ไม่แน่ใจ', value: 'unknown' }
      ],
      get: () => S.profile.liquidSavingsBaht, set: (v) => { S.profile.liquidSavingsBaht = v; }
    },
    coverage: { id: 'coverage', core: true, custom: 'coverage', title: 'ตอนนี้มีอะไรคุ้มครองอยู่บ้าง' },
    m40tier: {
      id: 'm40tier', branch: true,
      title: 'ม.40 ที่จ่ายอยู่ เป็นทางเลือกไหน',
      sub: 'ถ้าจำไม่ได้ ข้ามได้ เราจะใช้ทางเลือกที่ให้สิทธิน้อยที่สุดไว้ก่อน',
      options: [
        { label: 'ทางเลือกที่ 1 — 70 บาท/เดือน', value: 70 },
        { label: 'ทางเลือกที่ 2 — 100 บาท/เดือน', value: 100 },
        { label: 'ทางเลือกที่ 3 — 300 บาท/เดือน', value: 300 },
        { label: 'จำไม่ได้', value: 'unknown' }
      ],
      get: () => S.profile.existing.m40.tier, set: (v) => { S.profile.existing.m40.tier = v; }
    },
    debt: {
      id: 'debt', branch: true,
      title: 'ตอนนี้มีภาระผ่อนอะไรอยู่ไหม',
      sub: 'ยอดผ่อนจะถูกบวกเข้าไปในค่าใช้จ่ายที่ตัดไม่ได้',
      options: [
        { label: 'ไม่มีภาระผ่อน', value: 0 },
        { label: 'ไม่เกิน 5,000 บาท/เดือน', value: 3500 },
        { label: '5,000–15,000 บาท/เดือน', value: 10000 },
        { label: 'มากกว่า 15,000 บาท/เดือน', value: 20000 }
      ],
      get: () => S.profile.debtBaht,
      set: (v) => {
        S.profile.essentialExpenseE = (S.profile.essentialExpenseE || 0) - (S.profile.debtBaht || 0) + v;
        S.profile.debtBaht = v;
      }
    },
    dependents: {
      id: 'dependents', core: true,
      title: 'มีใครที่คุณช่วยดูแลค่าใช้จ่ายไหม',
      sub: 'ถ้ามี เป้าหมายเงินสำรองจะขยับขึ้นอีก 1 เดือน',
      options: [
        { label: 'ไม่มี ดูแลตัวเองคนเดียว', value: 0 },
        { label: 'มี 1 คน', value: 1 },
        { label: 'มี 2 คนขึ้นไป', value: 2 }
      ],
      get: () => S.profile.dependentsCount,
      set: (v) => { S.profile.dependentsCount = v; S.profile.hasDependents = v >= 1; }
    },
    kids: {
      id: 'kids', branch: true,
      title: 'มีลูกอายุต่ำกว่า 6 ขวบไหม',
      sub: 'ม.40 ทางเลือกที่ 3 มีเงินสงเคราะห์บุตร 200 บาท/เดือน/คน',
      options: [{ label: 'ไม่มี', value: 0 }, { label: 'มี 1 คน', value: 1 }, { label: 'มี 2 คนขึ้นไป', value: 2 }],
      get: () => S.profile.kidsUnder6, set: (v) => { S.profile.kidsUnder6 = v; }
    },
    volatility: {
      id: 'volatility', core: true,
      title: 'รายได้แต่ละเดือนต่างกันมากไหม',
      sub: 'รายได้ที่แกว่งแรงต้องการเงินสำรองมากกว่า',
      options: [
        { label: 'ใกล้เคียงกันทุกเดือน', value: 'similar' },
        { label: 'ต่างกันบ้าง', value: 'somewhat_different' },
        { label: 'ต่างกันมาก', value: 'very_different', hint: 'บางเดือนแทบไม่มีรายได้เข้า' }
      ],
      get: () => S.profile.incomeVolatility, set: (v) => { S.profile.incomeVolatility = v; }
    },
    health: {
      id: 'health', branch: true, multi: true,
      title: 'มีเรื่องสุขภาพที่อยากให้คำนึงถึงไหม',
      sub: 'ใช้คัดเฉพาะแผนที่คุณสมัครผ่านจริง ข้ามได้',
      options: [
        { label: 'มีโรคประจำตัวที่รักษาต่อเนื่อง', value: 'chronic' },
        { label: 'เคยผ่าตัดหรือนอนโรงพยาบาลใน 5 ปี', value: 'surgery' },
        { label: 'สูบบุหรี่เป็นประจำ', value: 'smoking' },
        { label: 'ไม่มีเรื่องไหนตรงกับฉัน', value: 'none' }
      ],
      get: () => S.profile.healthFlags, set: (v) => { S.profile.healthFlags = v; }
    },
    budget: {
      id: 'budget', core: true,
      title: 'เดือนหนึ่งจ่ายค่าเบี้ยไหวเท่าไหร่',
      sub: 'ข้อสุดท้าย เราจะเสนอเฉพาะแผนที่อยู่ในงบนี้ บวกได้ไม่เกิน 10%',
      options: [
        { label: 'ไม่เกิน 200 บาท/เดือน', value: 200 },
        { label: '200–400 บาท/เดือน', value: 400 },
        { label: '400–700 บาท/เดือน', value: 700 },
        { label: '700–1,200 บาท/เดือน', value: 1200 },
        { label: 'มากกว่า 1,200 บาท/เดือน', value: 2000 }
      ],
      get: () => S.budget, set: (v) => { S.budget = v; }
    }
  };

  function questionList() {
    const p = S.profile, L = [Q.age, Q.income, Q.expense, Q.savings];
    if (S.consentCoverage !== 'skip') {
      L.push(Q.coverage);
      if (p.existing.m40.has) L.push(Q.m40tier);
      if (p.existing.none) L.push(Q.debt);
    }
    L.push(Q.dependents);
    if (p.hasDependents) L.push(Q.kids);
    L.push(Q.volatility);
    if (S.consentCoverage === 'yes' && p.incomeVolatility) L.push(Q.health);
    L.push(Q.budget);
    return L;
  }

  const coverageOptions = [
    { key: 'm40', label: 'ประกันสังคม มาตรา 40', hint: 'สิทธิของรัฐสำหรับคนทำงานอิสระ' },
    { key: 'health', label: 'ประกันสุขภาพ', hint: 'วงเงินค่ารักษาต่อปี', field: 'perYearBaht', amounts: [{ l: 'ไม่เกิน 100,000 บาท/ปี', v: 80000 }, { l: '100,000–500,000 บาท/ปี', v: 300000 }, { l: 'มากกว่า 500,000 บาท/ปี', v: 700000 }, { l: 'ไม่แน่ใจวงเงิน', v: 'unknown' }] },
    { key: 'hb', label: 'ประกันชดเชยรายวัน', hint: 'ได้เงินสดต่อวันที่นอนโรงพยาบาล', field: 'dailyBaht', amounts: [{ l: '500 บาท/วัน', v: 500 }, { l: '1,000 บาท/วัน', v: 1000 }, { l: '2,000 บาท/วันขึ้นไป', v: 2000 }, { l: 'ไม่แน่ใจวงเงิน', v: 'unknown' }] },
    { key: 'pa', label: 'ประกันอุบัติเหตุ (PA)', hint: 'จ่ายเฉพาะกรณีอุบัติเหตุ', field: 'amountBaht', amounts: [{ l: 'ไม่เกิน 100,000 บาท', v: 100000 }, { l: '100,000–500,000 บาท', v: 300000 }, { l: 'มากกว่า 500,000 บาท', v: 700000 }, { l: 'ไม่แน่ใจวงเงิน', v: 'unknown' }] },
    { key: 'life', label: 'ประกันชีวิต', hint: 'ทุนประกันที่จ่ายให้คนข้างหลัง', field: 'amountBaht', amounts: [{ l: 'ไม่เกิน 500,000 บาท', v: 400000 }, { l: '500,000–2,000,000 บาท', v: 1200000 }, { l: 'มากกว่า 2,000,000 บาท', v: 2500000 }, { l: 'ไม่แน่ใจวงเงิน', v: 'unknown' }] }
  ];

  /* ==========================================================================
     S1 — หน้าแรก
     ========================================================================== */

  /* โลโก้มั่นชัวร์ — วาดเป็นเวกเตอร์ตามอาร์ตเวิร์กที่ทีมส่งมา
     โล่ไล่สีฟ้า หน้ายิ้มขยิบตา วงโคจรพาดหน้า-หลัง และประกายมุมขวาบน
     สีในนี้เป็นสีของโลโก้เอง ไม่ผูกกับ token ของ UI */
  const LOGO = `<svg width="150" height="124" viewBox="0 0 150 124" fill="none" role="img" aria-label="โลโก้มั่นชัวร์">
    <defs>
      <linearGradient id="mcShield" x1="28" y1="14" x2="98" y2="100" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#53A8FF"/>
        <stop offset=".48" stop-color="#2470E8"/>
        <stop offset="1" stop-color="#10358F"/>
      </linearGradient>
    </defs>

    <g transform="rotate(-20 62 68)">
      <ellipse cx="62" cy="68" rx="58" ry="19" fill="none" stroke="#4DA3FF" stroke-width="8"/>
    </g>

    <path d="M62 14 96 27a3 3 0 0 1 2 3v29c0 25-16 43-36 51-20-8-36-26-36-51V30a3 3 0 0 1 2-3L62 14Z" fill="url(#mcShield)"/>
    <path d="M62 27 85 36v21c0 17-9 29-23 35-14-6-23-18-23-35V36l23-9Z" fill="#FFFFFF"/>

    <circle cx="54" cy="51" r="4.2" fill="#1B2C6B"/>
    <path d="M73 47.6l-6.5 3.4 6.5 3.4" fill="none" stroke="#1B2C6B" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M53 62q9 8 18 0" fill="none" stroke="#1B2C6B" stroke-width="4" stroke-linecap="round"/>

    <g transform="rotate(-20 62 68)">
      <path d="M4 68A58 19 0 0 0 62 87" fill="none" stroke="#4DA3FF" stroke-width="8" stroke-linecap="round"/>
    </g>

    <g stroke="#2F86F6" stroke-width="5.5" stroke-linecap="round">
      <path d="M105 21l8-12"/>
      <path d="M116 31l13-7"/>
      <path d="M121 43l14-3"/>
    </g>
  </svg>`;

  function s1() {
    const trust = [
      ['ไม่ใช่ตัวแทนขาย', 'คำนวณช่องว่างให้ก่อน ไม่ซื้อก็จบตรงนั้น'],
      ['แนะนำสิทธิรัฐก่อนเสมอ', 'ถ้ายังไม่มี ม.40 เราขึ้นให้เป็นข้อแรก ทั้งที่ไม่ได้ค่าคอมมิชชัน'],
      ['ไม่มีการติดตาม', 'ไม่ต้องกรอกชื่อหรือเบอร์เพื่อดูผล ไม่มีสายโทรเข้าโดยไม่ได้นัด']
    ];
    const icons = [
      '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2.5 3.5 5v5c0 3.6 2.7 6.6 6.5 7.5 3.8-.9 6.5-3.9 6.5-7.5V5L10 2.5Z" stroke="#1450C8" stroke-width="1.5" stroke-linejoin="round"/></svg>',
      '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2.6 12.3 7l4.9.7-3.6 3.4.9 4.9-4.5-2.4-4.5 2.4.9-4.9L2.8 7.7 7.7 7 10 2.6Z" stroke="#A97828" stroke-width="1.5" stroke-linejoin="round"/></svg>',
      '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 10.5 7.5 15 17 5.5" stroke="#3E7D4C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    ];
    return {
      top: '',
      body: `<div class="stack g16" style="margin-block:auto;padding-block:12px">
        <div class="hero">
          ${LOGO}
          <div class="wordmark">มั่น<em>ชัวร์</em></div>
          <p>เช็คให้พอดี เพื่อให้ชีวิตที่มั่นชัวร์</p>
        </div>
        <div class="card" style="padding:2px 14px">
          ${trust.map((t, i) => `<div class="trust">${icons[i]}<div><b>${esc(t[0])}</b><span>${esc(t[1])}</span></div></div>`).join('')}
        </div>
        <p class="tiny" style="text-align:center">ข้อมูลสินค้าในเดโมเป็นตัวอย่างเพื่อสาธิตระบบ ยังไม่ใช่เบี้ยจริงของบริษัทใด</p>
      </div>`,
      foot: `<button class="btn btn-primary" data-act="go" data-s="s2">เริ่มเช็คช่องว่างของฉัน</button>
        <p class="tiny" style="text-align:center;margin-top:8px">ไม่ต้องกรอกชื่อหรือเบอร์โทร</p>`
    };
  }

  /* ==========================================================================
     S2 — ฉันเป็นใคร
     ========================================================================== */

  const PERSONAS = [
    { c: 1, label: 'รับงานอิสระ / ฟรีแลนซ์', desc: 'ทำงานจากที่ตั้ง ส่งงานเป็นชิ้น' },
    { c: 2, label: 'พบลูกค้าบ่อยนอกออฟฟิศ', desc: 'เดินทางประจำ แต่ไม่ได้ขับขี่เป็นงานหลัก' },
    { c: 3, label: 'ขับขี่ / ส่งของ / ภาคสนาม', desc: 'อยู่บนถนนหรือหน้างานเกือบทุกวัน' },
    { c: 4, label: 'อื่นๆ', desc: 'เราจะใช้เกณฑ์ที่ระมัดระวังที่สุดไว้ก่อน' }
  ];

  function s2() {
    const sel = S.profile.occupationClass;
    return {
      top: backTop('s1', 'ก่อนเริ่มคำถาม'),
      body: `<div class="stack g16" style="padding-top:8px">
        <div class="stack g6">
          <h1 class="h-screen" style="margin:0">ก่อนอื่น เราอยากรู้จักชีวิตคุณ ไม่ใช่ขายสินค้าให้คุณ</h1>
          <p class="lede">คำตอบข้อนี้ใช้แทนคำถามเรื่องลักษณะงานไปเลย คุณจะไม่ถูกถามซ้ำ</p>
        </div>
        <div class="stack g8">
          ${PERSONAS.map(p => `<button class="persona ${sel === p.c ? 'sel' : ''}" data-act="persona" data-c="${p.c}">
            <b>${esc(p.label)}</b><span>${esc(p.desc)}</span></button>`).join('')}
        </div>
        <p class="tiny">ใช้คัดว่าคุณสมัครแผนไหนได้ และจับคู่โบรกเกอร์ที่ดูแลคนกลุ่มเดียวกับคุณ ไม่ได้ใช้คำนวณช่องว่าง</p>
      </div>`,
      foot: sel
        ? `<button class="btn btn-primary" data-act="start-q">เริ่มตอบคำถาม 8 ข้อ</button>
           <p class="tiny" style="text-align:center;margin-top:8px">ใช้เวลา 3 นาที · กลับมาแก้คำตอบได้ตลอด</p>`
        : `<button class="btn btn-primary" disabled>เลือกลักษณะงานก่อน</button>`
    };
  }

  /* ==========================================================================
     S3 — คำถาม
     ========================================================================== */

  function s3() {
    const list = questionList();
    S.qi = Math.min(S.qi, list.length - 1);
    const q = list[S.qi];
    /* เลขข้อต่อเนื่อง: นับจากคำถามแกนในลิสต์ปัจจุบัน ไม่ข้ามเลข */
    const coreNo = list.slice(0, S.qi + 1).filter(x => x.core).length;
    const coreTotal = list.filter(x => x.core).length;
    const dots = Array.from({ length: coreTotal }, (_, i) =>
      `<i class="${i < coreNo ? 'on' : ''}"></i>`).join('');

    let bodyInner, canNext;
    if (q.custom === 'coverage') { bodyInner = coverageBody(); canNext = coverageDone(); }
    else if (q.multi) { bodyInner = multiBody(q); canNext = (q.get() || []).length > 0; }
    else { bodyInner = singleBody(q); canNext = q.get() !== null && q.get() !== undefined; }

    return {
      top: `<button class="iconbtn" data-act="q-back" aria-label="ย้อนกลับไปแก้คำตอบก่อนหน้า">${CHEV}</button>
        <div class="tbslot"><div class="dots">${dots}</div>
        <div class="tiny" style="margin-top:4px">${q.core ? `คำถามที่ ${coreNo} จาก ${coreTotal}` : 'คำถามเพิ่มเติมจากคำตอบของคุณ'}</div></div>`,
      body: `<div class="stack g16" style="padding-top:12px">
        <div class="stack g6">
          <h1 class="h-screen" style="margin:0">${esc(q.title)}</h1>
          ${q.sub ? `<p class="lede">${esc(q.sub)}</p>` : ''}
          ${q.note ? `<span class="pill pill-info" style="align-self:flex-start">${esc(q.note)}</span>` : ''}
        </div>
        ${bodyInner}
      </div>`,
      foot: `<button class="btn btn-primary" data-act="q-next" ${canNext ? '' : 'disabled'}>${S.qi === list.length - 1 ? 'ดูผลของฉัน' : 'ถัดไป'}</button>
        <button class="btn-text" data-act="q-skip">ยังไม่อยากตอบข้อนี้</button>`
    };
  }

  function singleBody(q) {
    const cur = q.get();
    return `<div class="stack g8">${q.options.map(o => `
      <button class="choice round ${cur === o.value ? 'sel' : ''}" data-act="q-pick" data-v="${esc(String(o.value))}">
        <span class="row"><span class="tick">${TICK}</span>
        <span style="flex:1">${esc(o.label)}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</span></span>
      </button>`).join('')}</div>`;
  }

  function multiBody(q) {
    const cur = q.get() || [];
    return `<div class="stack g8">${q.options.map(o => `
      <button class="choice ${cur.indexOf(o.value) > -1 ? 'sel' : ''}" data-act="q-multi" data-v="${esc(o.value)}">
        <span class="row"><span class="tick">${TICK}</span><span style="flex:1">${esc(o.label)}</span></span>
      </button>`).join('')}</div>`;
  }

  function coverageBody() {
    const ex = S.profile.existing;
    return `<div class="stack g8">
      ${coverageOptions.map(o => {
        const on = ex[o.key].has;
        const amt = o.field ? ex[o.key][o.field] : null;
        return `<div>
          <button class="choice ${on ? 'sel' : ''}" data-act="cov" data-k="${o.key}">
            <span class="row"><span class="tick">${TICK}</span>
            <span style="flex:1">${esc(o.label)}<small>${esc(o.hint)}</small></span></span>
          </button>
          ${on && o.amounts ? `<div class="stack g6" style="padding:8px 0 4px 13px;border-inline-start:2px solid var(--brand-100);margin:2px 0 6px 12px">
            <div class="tiny">วงเงินประมาณเท่าไหร่</div>
            ${o.amounts.map(a => `<button class="choice round ${amt === a.v ? 'sel' : ''}" style="padding:8px 12px;min-height:42px" data-act="cov-amt" data-k="${o.key}" data-f="${o.field}" data-v="${esc(String(a.v))}">
              <span class="row"><span class="tick" style="width:18px;height:18px">${TICK}</span><span style="flex:1;font-size:.87rem">${esc(a.l)}</span></span></button>`).join('')}
          </div>` : ''}
        </div>`;
      }).join('')}
      <button class="choice ${ex.none ? 'sel' : ''}" data-act="cov" data-k="none">
        <span class="row"><span class="tick">${TICK}</span><span style="flex:1">ไม่มีเลยสักอย่าง</span></span>
      </button>
      <p class="tiny">ถ้าไม่แน่ใจวงเงิน เลือก "ไม่แน่ใจ" ได้ เราจะไม่เดาตัวเลขแทนคุณ</p>
    </div>`;
  }

  function coverageDone() {
    const ex = S.profile.existing;
    if (ex.none) return true;
    const picked = coverageOptions.filter(o => ex[o.key].has);
    if (!picked.length) return false;
    return picked.every(o => !o.field || ex[o.key][o.field] !== null);
  }

  function openConsentSheet() {
    modal.innerHTML = `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true">
      <div class="grab"></div>
      <div class="stack g16" style="padding-bottom:6px">
        <div class="stack g6">
          <span class="pill pill-info" style="align-self:flex-start">ขอความยินยอมก่อนถามต่อ</span>
          <h2 class="h-screen" style="margin:0">ต่อจากนี้จะถามเรื่องความคุ้มครองและสุขภาพ</h2>
          <p class="lede">ข้ามได้ทุกข้อ ลบได้ทุกเมื่อ และตอนนี้ระบบยังไม่รู้ชื่อหรือเบอร์ของคุณเลย</p>
        </div>
        <div class="stack g8">
          <button class="btn btn-primary" data-act="consent" data-v="yes">ยินยอมและตอบต่อ</button>
          <button class="btn btn-ghost" data-act="consent" data-v="skip">ข้ามส่วนนี้</button>
        </div>
      </div>
    </div></div>`;
  }

  /* ==========================================================================
     S4 — ความเสี่ยง + ประกันที่เหมาะกับคุณ (จอเดียว เลื่อนลง)
     ========================================================================== */

  function trackHtml(tube, opts) {
    opts = opts || {};
    const segs = tube.layers.map(l =>
      `<span class="seg seg-${l.key}" style="width:${opts.zero ? 0 : l.pct.toFixed(2)}%" data-w="${l.pct.toFixed(2)}"></span>`).join('');
    /* ชั้นสีเขียว = ส่วนที่จะเพิ่มขึ้นถ้าเลือกแผน อัปเดตสดโดยไม่ re-render */
    const add = opts.add ? `<span class="seg seg-add" data-add="${tube.id}" style="width:0%"></span>` : '';
    return `<span class="track t-${tube.status === 'unknown' ? 'unk' : tube.status}">${segs}${add}</span>`;
  }

  function tubeRow(tube) {
    const st = tube.status;
    return `<button class="trow" data-act="why" data-t="${tube.id}">
      <span class="face" role="img" aria-label="${STATUS_TEXT[st]}">${STATUS_FACE[st]}</span>
      <span class="trow-main">
        <span class="trow-top">
          <b>${esc(tube.title)}</b>
          <span class="pill pill-${st}">${STATUS_TEXT[st]}</span>
        </span>
        ${trackHtml(tube, { zero: !S.tubesAnimated, add: true })}
      </span>
    </button>`;
  }

  function s4() {
    const tubes = S.tubes;
    const r = S.ranking;
    const worst = worstTube();
    const best = tubes.slice().sort((a, b) => b.pct - a.pct)[0];
    const anyRed = tubes.some(t => t.status === 'red');

    const headline = anyRed
      ? `${best.status === 'ok' ? `เรื่อง${esc(best.title.replace(/^ถ้า/, ''))}คุณดูแลไว้ดีแล้ว ` : ''}จุดที่ยังเปราะที่สุดคือ${esc(worst.title)}`
      : 'ภาพรวมคุณแน่นแล้ว มีอีกสองจุดที่ดูแลเพิ่มได้';

    const cards = r.primary;
    const preview = MC.previewWithSelection(tubes, r, S.selected);
    const totalPremium = r.recommendations
      .filter(s => S.selected.indexOf(s.product.id) > -1)
      .reduce((a, s) => a + s.product.premiumMonthly, 0);
    const overTotal = S.budget != null && totalPremium > S.budget;

    const criteria = S.budget == null
      ? 'คุณไม่ได้บอกงบ เราจึงเรียงจากถูกไปแพง ไม่ตัดแผนไหนออกเพราะราคา'
      : `อยู่ในงบ ${B(S.budget)} บาท บวกได้ไม่เกิน 10% คือไม่เกิน ${B(r.budgetCeiling)} บาท แผนที่แพงกว่านี้ถูกตัดออกแล้ว`;

    return {
      top: `<button class="iconbtn" data-act="go" data-s="s3" aria-label="กลับไปแก้คำตอบ">${CHEV}</button>
        <div class="tbslot"><span class="eyebrow">ภาพความคุ้มครองของคุณ</span></div>
        <button class="iconbtn" data-act="erase" aria-label="ลบข้อมูลทั้งหมด">
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M3.5 5h11M7 5V3.5h4V5M5 5l.7 9.5h6.6L13 5" stroke="#4A5670" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>`,
      body: `<div class="stack g16" style="padding-top:8px">
        <div class="stack g4">
          <h1 class="h-screen" style="margin:0">${headline}</h1>
          <p class="tiny">สามด้านที่ระบบดูให้ · เคส ${esc(S.caseId)} · ยังไม่มีชื่อหรือเบอร์ของคุณในระบบ</p>
        </div>

        <div class="tubesticky">
          ${tubes.map(tubeRow).join('')}
          <div class="tiny stickyhint" id="stickyhint">แตะแถบเพื่อดูที่มาและความเสี่ยงที่ตามมา</div>
        </div>

        ${S.estimatedE ? `<div class="banner warn">ตัวเลขเป็นประมาณการจากค่าเฉลี่ยกลุ่ม เพราะคุณข้ามคำถามค่าใช้จ่าย
          <button class="btn-text" style="width:auto;padding:0;display:inline" data-act="back-to-q" data-q="expense">ตอบเพิ่มเพื่อความแม่นยำ</button></div>` : ''}

        <div class="seclabel"><span class="eyebrow">ประกันที่เหมาะกับคุณ</span></div>
        <p class="lede" style="margin-top:-6px">${esc(criteria)} เรียงตามช่องว่างที่ปิดได้ต่อเงินที่จ่าย ไม่ได้เรียงตามค่าคอมมิชชัน</p>

        ${r.budgetAboveIncomeCeiling ? `<div class="banner warn">งบที่คุณบอกสูงกว่า 10% ของรายได้ต่อเดือน ซึ่งเป็นเพดานที่นักวางแผนการเงินแนะนำสำหรับค่าเบี้ย ลองเริ่มจากแผนที่ถูกที่สุดก่อนก็ได้</div>` : ''}
        ${r.honestNotes.map(n => `<div class="banner warn">${esc(n)}</div>`).join('')}

        ${cards.length ? `<div class="stack g12">${cards.map(c => productCard(c, preview)).join('')}</div>`
          : `<div class="banner warn">ในอายุและงบที่คุณบอกมา ยังไม่มีแผนไหนที่เราเสนอได้ตรงไปตรงมา เราเลือกที่จะไม่เสนออะไรเลย ดีกว่าเสนอแผนที่ช่วยไม่ตรงจุด ลองกดขอข้อมูลเพิ่มจากโบรกเกอร์ได้</div>`}

        ${r.more.length || r.filterAudit.length ? `<button class="btn btn-ghost btn-sm" style="width:100%" data-act="show-more">ดูแผนอื่นและเหตุผลที่ระบบตัดออก</button>` : ''}

        <div class="card" id="sumBox" style="background:${overTotal ? 'var(--watch-bg)' : 'var(--sunk)'};border-color:${overTotal ? '#E6D2A8' : 'var(--hair)'}">
          <div class="kv" style="padding-top:0"><span>เบี้ยรวมที่เลือกไว้</span><b class="mono" id="sumPremium">${B(totalPremium)} ฿/เดือน</b></div>
          <div class="kv"><span>งบที่คุณบอกไว้</span><b class="mono">${S.budget == null ? 'ไม่ระบุ' : B(S.budget) + ' ฿/เดือน'}</b></div>
          <p class="small" id="sumOver" style="margin-top:8px;color:var(--watch);${overTotal ? '' : 'display:none'}">${overTotal ? `<b>เกินงบ ${B(totalPremium - S.budget)} บาท</b> เราไม่ซ่อนตัวเลขนี้` : ''}</p>
        </div>

        <p class="tiny">ข้อมูลแผนเป็นตัวอย่างสำหรับเดโม ยังไม่ใช่เบี้ยจริงของบริษัทประกันใด</p>
      </div>`,
      foot: `<div class="two">
          <button class="btn btn-ghost" data-act="go-broker">ขอข้อมูลเพิ่ม</button>
          <button class="btn btn-primary" data-act="go-buy" ${S.selected.length ? '' : 'disabled'}>ยืนยันแผนนี้</button>
        </div>
        <p class="tiny" id="footHint" style="text-align:center;margin-top:8px">${S.selected.length ? 'ยืนยันเพื่อดูขั้นตอนสมัครด้วยตัวเอง หรือขอข้อมูลเพิ่มจากโบรกเกอร์' : 'เลือกแผนก่อนจึงจะยืนยันได้ หรือขอข้อมูลเพิ่มจากโบรกเกอร์ได้เลย'}</p>`,
      after: () => {
        /* ตรึงแถบให้พอดีใต้แถบบนจริง ความสูงเปลี่ยนตามเนื้อหาได้ */
        const st = view.querySelector('.tubesticky');
        if (st) st.style.top = topbar.offsetHeight + 'px';
        animateTubes();
        updateSelection();
      }
    };
  }

  function animateTubes() {
    if (S.tubesAnimated) return;
    S.tubesAnimated = true;
    const segs = view.querySelectorAll('.seg[data-w]');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      segs.forEach(s => { s.style.width = s.dataset.w + '%'; });
      return;
    }
    requestAnimationFrame(() => segs.forEach(s => { s.style.width = s.dataset.w + '%'; }));
  }

  /* อัปเดตผลของการเลือกแผนแบบสด: แถบสีเขียวบนบล็อกที่ค้างอยู่ด้านบนจะยืด/หด
     ไม่ re-render ทั้งจอ เพื่อให้ transition ของความกว้างทำงานจริง */
  function updateSelection() {
    const r = S.ranking;
    if (!r) return;
    const preview = MC.previewWithSelection(S.tubes, r, S.selected);

    preview.forEach(pv => {
      const delta = Math.max(0, pv.toPct - pv.fromPct);
      const row = view.querySelector(`.trow[data-t="${pv.id}"]`);
      if (!row) return;

      const seg = row.querySelector('.seg-add');
      if (seg) seg.style.width = delta.toFixed(2) + '%';

      /* อิโมจิ ป้ายข้อความ และสีราง ขยับตามสถานะใหม่ที่ engine คำนวณให้ */
      const face = row.querySelector('.face');
      if (face) {
        face.textContent = STATUS_FACE[pv.status];
        face.setAttribute('aria-label', STATUS_TEXT[pv.status]);
      }
      const pill = row.querySelector('.pill');
      if (pill) {
        pill.className = 'pill pill-' + pv.status;
        pill.textContent = STATUS_TEXT[pv.status];
      }
      const track = row.querySelector('.track');
      if (track) {
        track.className = 'track t-' + (pv.status === 'unknown' ? 'unk' : pv.status);
      }
    });

    view.querySelectorAll('.prod[data-pid]').forEach(el => {
      const on = S.selected.indexOf(el.dataset.pid) > -1;
      el.classList.toggle('sel', on);
      const btn = el.querySelector('[data-act="toggle-prod"]');
      if (btn) {
        btn.textContent = on ? 'เอาออก' : 'เลือกแผนนี้';
        btn.className = 'btn ' + (on ? 'btn-ghost' : 'btn-primary') + ' btn-sm';
        btn.style.width = '100%';
      }
    });

    const total = r.recommendations
      .filter(x => S.selected.indexOf(x.product.id) > -1)
      .reduce((a, x) => a + x.product.premiumMonthly, 0);
    const over = S.budget != null && total > S.budget;
    const sum = view.querySelector('#sumPremium');
    if (sum) sum.textContent = B(total) + ' ฿/เดือน';
    const box = view.querySelector('#sumBox');
    if (box) {
      box.style.background = over ? 'var(--watch-bg)' : 'var(--sunk)';
      box.style.borderColor = over ? '#E6D2A8' : 'var(--hair)';
    }
    const ov = view.querySelector('#sumOver');
    if (ov) {
      ov.innerHTML = over ? `<b>เกินงบ ${B(total - S.budget)} บาท</b> เราไม่ซ่อนตัวเลขนี้` : '';
      ov.style.display = over ? '' : 'none';
    }

    const hint = view.querySelector('#stickyhint');
    if (hint) hint.textContent = S.selected.length
      ? 'นี่คือภาพหลังซื้อแผนที่เลือก สีเขียวคือส่วนที่เพิ่มขึ้น · แตะแถบเพื่อดูที่มา'
      : 'แตะแถบเพื่อดูที่มาและความเสี่ยงที่ตามมา';

    const buy = footbar.querySelector('[data-act="go-buy"]');
    if (buy) buy.disabled = !S.selected.length;
    const fh = footbar.querySelector('#footHint');
    if (fh) fh.textContent = S.selected.length
      ? 'ยืนยันเพื่อดูขั้นตอนสมัครด้วยตัวเอง หรือขอข้อมูลเพิ่มจากโบรกเกอร์'
      : 'เลือกแผนก่อนจึงจะยืนยันได้ หรือขอข้อมูลเพิ่มจากโบรกเกอร์ได้เลย';
  }

  function productCard(s, preview) {
    const p = s.product;
    const on = S.selected.indexOf(p.id) > -1;
    const gold = p.kind === 'state';

    const tierSwitch = gold && S.ranking.allStateTiers.length > 1
      ? `<div class="toggle" style="margin-top:10px">${S.ranking.allStateTiers.map(t =>
        `<button data-act="pick-tier" data-id="${t.product.id}" class="${t.product.id === p.id ? 'on' : ''}">${t.product.premiumMonthly} ฿</button>`).join('')}</div>` : '';

    /* บอกแค่ว่าช่วยปิดหลอดไหน ส่วนการขยับจริงไปเกิดบนแถบที่ค้างอยู่ด้านบน */
    const fills = s.deltas.map(d => esc(d.tubeTitle)).join(' · ');

    return `<article class="prod ${on ? 'sel' : ''} ${s.overBudget ? 'over' : ''}" data-pid="${p.id}" style="${gold ? 'border-color:var(--gold-600);border-width:1.5px' : ''}">
      <div class="prod-body">
        <div class="stack g8">
          ${gold ? '<span class="pill pill-gold" style="align-self:flex-start">สิทธิรัฐ · เราไม่ได้ค่าคอมมิชชัน</span>' : ''}
          ${s.overBudget ? `<span class="pill pill-watch" style="align-self:flex-start">เกินงบ ${B(s.overBudgetByBaht)} บาท ยังอยู่ในช่วงผ่อนปรน 10%</span>` : ''}
          <div>
            <h3>${esc(p.name)}</h3>
            <div class="insurer">${esc(p.insurer)}</div>
          </div>
          <div class="priceline"><span class="amt mono">${B(p.premiumMonthly)}</span><span class="per">บาท/เดือน</span>
            ${s.deltas.some(d => d.conditional)
              ? '<span class="pill pill-watch" style="margin-inline-start:auto">จ่ายบางเงื่อนไข</span>'
              : '<span class="pill pill-ok" style="margin-inline-start:auto">จ่ายทุกกรณี</span>'}
          </div>
          <ul class="covers">${p.covers.slice(0, 3).map(c => `<li>${esc(c)}</li>`).join('')}</ul>
          <div class="exbox">
            <h5>สิ่งที่ยังไม่คุ้มครอง</h5>
            <ul>${p.exclusions.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>
          <div class="metarow"><span>รอคอย: ${esc(p.waitingNote)}</span></div>
          ${p.deductibleNote ? `<div class="metarow"><span>${esc(p.deductibleNote)}</span></div>` : ''}
          <div class="metarow">
            <span>ตรวจสอบล่าสุด ${p.verifiedDate ? esc(p.verifiedDate) : 'ยังไม่ยืนยัน'}</span>
            ${p.sourceUrl && p.sourceUrl.indexOf('http') === 0 ? `<a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">แหล่งที่มา</a>` : '<span>ข้อมูลตัวอย่างสำหรับเดโม</span>'}
          </div>
          ${tierSwitch}
        </div>
      </div>
      <div class="deltabox">
        <div class="tiny" style="margin-bottom:9px">ช่วยปิด: ${fills}</div>
        <button class="btn ${on ? 'btn-ghost' : 'btn-primary'} btn-sm" style="width:100%" data-act="toggle-prod" data-id="${p.id}">
          ${on ? 'เอาออก' : 'เลือกแผนนี้'}
        </button>
      </div>
    </article>`;
  }

  /* ------------------------------------------------------- sheet เพิ่มเติม */

  function openWhy(tubeId) {
    const t = S.tubes.find(x => x.id === tubeId);
    const scen = MC.SCENARIOS[S.scenario2];
    const notes = RISK_NOTES[t.status];

    const have = t.layers.length
      ? t.layers.map(l => `<div class="kv"><span>${esc(l.label)}</span><b class="mono">${B(l.baht)} ฿</b></div>`).join('')
      : '<p class="small">ตอนนี้ยังไม่มีอะไรรองรับความเสี่ยงนี้เลย</p>';

    const extra = t.id === 2
      ? `<div class="toggle" style="margin-top:10px">
          <button data-act="mode2" data-v="state" class="${S.mode2 === 'state' ? 'on' : ''}">ใช้สิทธิรัฐ</button>
          <button data-act="mode2" data-v="private" class="${S.mode2 === 'private' ? 'on' : ''}">รักษาเอกชน</button></div>`
      : t.id === 3
      ? `<div class="toggle" style="margin-top:10px">
          <button data-act="h3" data-v="12" class="${S.horizon3 === 12 ? 'on' : ''}">12 เดือน</button>
          <button data-act="h3" data-v="24" class="${S.horizon3 === 24 ? 'on' : ''}">24 เดือน</button>
          <button data-act="h3" data-v="to60" class="${S.horizon3 === 'to60' ? 'on' : ''}">ถึงอายุ 60</button></div>`
      : '';

    modal.innerHTML = `<div class="scrim" data-act="close-modal"><div class="sheet" role="dialog" aria-modal="true" aria-label="ข้อมูลเพิ่มเติม">
      <div class="grab"></div>
      <div class="stack g16" style="padding-bottom:6px">
        <div>
          <div style="display:flex;align-items:center;gap:9px">
            <h2 class="h-screen" style="margin:0;flex:1">${esc(t.title)}</h2>
            <span class="face">${STATUS_FACE[t.status]}</span>
          </div>
          <span class="pill pill-${t.status}" style="margin-top:6px;display:inline-flex">${STATUS_TEXT[t.status]}</span>
        </div>

        <div class="srcblock">
          <div class="lab">${esc(notes.head)}</div>
          <ul class="covers" style="margin-top:7px">${notes.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
        </div>

        <div class="srcblock">
          <div class="lab">ตอนนี้คุณมีอะไรอยู่</div>
          <div style="margin-top:5px">${have}
            <div class="kv"><span><b>รวม</b></span><b class="mono">${t.unknown ? 'สรุปไม่ได้' : B(t.haveBaht) + ' ฿'}</b></div>
          </div>
        </div>

        <div class="srcblock">
          <div class="lab">สิ่งที่สิทธิเหล่านั้นไม่ครอบคลุม</div>
          <ul class="covers" style="margin-top:7px">${t.whatItDoesNotCover.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>

        <div class="srcblock">
          <div class="lab">ตัวเลขนี้มาจากไหน</div>
          <div class="formula" style="margin-top:6px">${esc(t.formula)}</div>
          <p class="tiny" style="margin-top:7px">${esc(t.basis)}</p>
          ${t.id === 2 ? `<p class="tiny" style="margin-top:3px">ฉากทัศน์: ${esc(scen.label)} นอน ${scen.nights} คืน พักฟื้นราว ${scen.recoveryDays} วัน</p>` : ''}
          ${extra}
        </div>

        <div class="srcblock">
          <div class="lab">แหล่งอ้างอิง</div>
          <div class="stack g4" style="margin-top:6px">
            ${SOURCES.map(s => `<a class="tiny" href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a>`).join('')}
          </div>
        </div>

        <button class="btn btn-ghost" data-act="close-modal">ปิด</button>
      </div>
    </div></div>`;
    audit('why' + tubeId, 'ลูกค้าเปิดดูข้อมูลเพิ่มเติมของ "' + t.title + '"', 'ระบบแสดงความเสี่ยงที่ตามมาในระดับนี้ สูตรคำนวณ และแหล่งอ้างอิง');
  }

  function openMore() {
    const r = S.ranking;
    modal.innerHTML = `<div class="scrim" data-act="close-modal"><div class="sheet" role="dialog" aria-modal="true">
      <div class="grab"></div>
      <div class="stack g16" style="padding-bottom:6px">
        <div><span class="eyebrow">ความโปร่งใสของการจัดอันดับ</span>
          <h2 class="h-screen" style="margin-top:4px">แผนอื่นและเหตุผลที่ตัดออก</h2></div>
        ${r.more.length ? `<div class="stack g8">
          ${r.more.map(s => `<div class="card"><b class="small">${esc(s.product.name)}</b>
            <div class="tiny" style="margin-top:3px">${B(s.product.premiumMonthly)} บาท/เดือน · ${esc(s.reasonNote)}</div></div>`).join('')}</div>` : ''}
        <div class="stack g6">
          <div class="tiny">สิ่งที่ระบบตัดออก และเหตุผล</div>
          ${r.filterAudit.map(f => `<div class="kv"><span><b>${esc(f.name)}</b><br><span class="tiny">${esc(f.reason)}</span></span></div>`).join('')}
        </div>
        <button class="btn btn-ghost" data-act="close-modal">ปิด</button>
      </div>
    </div></div>`;
  }

  /* ==========================================================================
     S5 — ยืนยันแผนและสมัครเอง
     ========================================================================== */

  function s5() {
    const picked = S.ranking.recommendations.filter(s => S.selected.indexOf(s.product.id) > -1);
    const total = picked.reduce((a, s) => a + s.product.premiumMonthly, 0);
    const hasState = picked.some(s => s.product.kind === 'state');
    const hasPrivate = picked.some(s => s.product.kind === 'private');

    return {
      top: backTop('s4', 'ยืนยันแผนที่เลือก'),
      body: `<div class="stack g16" style="padding-top:8px">
        <div class="stack g6">
          <h1 class="h-screen" style="margin:0">คุณเลือกไว้ ${picked.length} แผน รวม ${B(total)} บาท/เดือน</h1>
          <p class="lede">ดูขั้นตอนของแต่ละแผนก่อนตัดสินใจ ยังไม่มีการตัดเงินใดๆ ในขั้นนี้</p>
        </div>

        <div class="stack g8">
          ${picked.map(s => `<div class="card" style="${s.product.kind === 'state' ? 'border-color:var(--gold-600);background:var(--gold-100)' : ''}">
            <div style="display:flex;gap:9px;align-items:baseline">
              <b class="small" style="flex:1">${esc(s.product.name)}</b>
              <span class="mono small">${B(s.product.premiumMonthly)} ฿/ด.</span>
            </div>
            <p class="tiny" style="margin-top:5px">${esc(s.product.insurer)}</p>
          </div>`).join('')}
        </div>

        <div class="seclabel"><span class="eyebrow">จากนี้จะเกิดอะไรขึ้น</span></div>
        <div class="card" style="padding:2px 14px">
          ${hasState ? `<div class="trust"><div><b>ม.40 สมัครเองได้เลย</b><span>สมัครที่สำนักงานประกันสังคม เซเว่นอีเลฟเว่น ธนาคาร หรือเว็บ สปส. เราไม่ได้ค่าคอมมิชชันจากสิทธินี้</span></div></div>` : ''}
          ${hasPrivate ? `<div class="trust"><div><b>ประกันเอกชนต้องมีตัวแทนที่มีใบอนุญาตตรวจสอบ</b><span>ระบบนี้ไม่มีปุ่มปิดการขายอัตโนมัติ เราจะส่งใบคำขอให้ตัวแทนตรวจก่อนกรมธรรม์มีผลเสมอ</span></div></div>` : ''}
          <div class="trust"><div><b>เปลี่ยนใจได้</b><span>กรมธรรม์ประกันสุขภาพมีสิทธิยกเลิกในช่วงพิจารณา และคุณกลับมาแก้คำตอบที่หน้าก่อนได้ตลอด</span></div></div>
        </div>

        ${hasState ? `<a class="btn btn-ghost" href="https://www.sso.go.th" target="_blank" rel="noopener">เปิดเว็บประกันสังคมเพื่อสมัคร ม.40</a>` : ''}

        <button class="choice ${S.readExclusions ? 'sel' : ''}" data-act="read-excl">
          <span class="row"><span class="tick">${TICK}</span>
          <span style="flex:1">อ่านสิ่งที่ยังไม่คุ้มครองของแผนที่เลือกแล้ว<small>โดยเฉพาะระยะเวลารอคอยและโรคที่เป็นมาก่อน</small></span></span>
        </button>
      </div>`,
      foot: `<div class="two">
          <button class="btn btn-ghost" data-act="go" data-s="s4">กลับไปแก้</button>
          <button class="btn btn-primary" data-act="buy" ${S.readExclusions ? '' : 'disabled'}>ซื้อสินค้า</button>
        </div>
        <button class="btn-text" data-act="go-broker">ยังไม่แน่ใจ ขอปรึกษาโบรกเกอร์ก่อน</button>`
    };
  }

  /* จอหลังกดซื้อ — ไม่มีการตัดเงินในเดโม และไม่มีปุ่มปิดการขายอัตโนมัติ */
  function s5done() {
    const picked = S.ranking.recommendations.filter(x => S.selected.indexOf(x.product.id) > -1);
    const total = picked.reduce((a, x) => a + x.product.premiumMonthly, 0);
    const hasState = picked.some(x => x.product.kind === 'state');
    const hasPrivate = picked.some(x => x.product.kind === 'private');

    const steps = [
      hasPrivate ? ['ตัวแทนที่มีใบอนุญาตตรวจใบคำขอ', 'ภายใน 2 ชั่วโมงทำการ ตรวจว่าคุณสมัครแผนนี้ได้จริงก่อนเดินเรื่องต่อ'] : null,
      hasPrivate ? ['ยืนยันข้อมูลสุขภาพและวิธีชำระเบี้ย', 'คุยผ่าน LINE ตามช่องทางที่คุณสะดวก ไม่มีการตัดเงินก่อนคุณยืนยัน'] : null,
      hasPrivate ? ['กรมธรรม์มีผลหลังชำระเบี้ยงวดแรก', 'ยังมีสิทธิยกเลิกในช่วงพิจารณา (free look) ได้เงินคืนตามเงื่อนไข'] : null,
      hasState ? ['ม.40 คุณสมัครเองได้ทันที', 'ที่สำนักงานประกันสังคม เซเว่นอีเลฟเว่น ธนาคาร หรือเว็บ สปส. เราไม่ได้ค่าคอมมิชชันจากสิทธินี้'] : null
    ].filter(Boolean);

    return {
      top: '',
      body: `<div class="stack g16" style="padding-top:18px">
        <div class="stack g6">
          <span class="pill pill-ok" style="align-self:flex-start">รับคำขอแล้ว</span>
          <h1 class="h-screen" style="margin:0">รับคำขอซื้อของคุณแล้ว เลขที่ ${esc(S.orderNo)}</h1>
          <p class="lede">รวม ${B(total)} บาท/เดือน · ยังไม่มีการตัดเงินในขั้นนี้</p>
        </div>

        <div class="card">
          ${picked.map((x, i) => `<div class="kv" ${i === 0 ? 'style="padding-top:0"' : ''}>
            <span>${esc(x.product.name)}</span><b class="mono">${B(x.product.premiumMonthly)} ฿/ด.</b></div>`).join('')}
        </div>

        <div class="seclabel"><span class="eyebrow">ลำดับขั้นจากนี้</span></div>
        <div class="timeline">
          ${steps.map((st, i) => `<div class="tl"><time>ขั้นที่ ${i + 1}</time>
            <p class="small"><b>${esc(st[0])}</b></p><em>${esc(st[1])}</em></div>`).join('')}
        </div>

        ${hasState ? `<a class="btn btn-ghost" href="https://www.sso.go.th" target="_blank" rel="noopener">เปิดเว็บประกันสังคมเพื่อสมัคร ม.40</a>` : ''}

        <div class="banner"><b>ส่วนนี้สำหรับทีมเท่านั้น</b><br>ในระบบจริงลูกค้าจบที่จอนี้ ปุ่มล่างพาไปดูจอฝั่งโบรกเกอร์ที่ได้รับเคสนี้</div>
      </div>`,
      foot: `<div class="two">
          <button class="btn btn-ghost" data-act="go" data-s="s4">ดูผลของฉันอีกครั้ง</button>
          <button class="btn btn-primary" data-act="go" data-s="s7">เปิดจอโบรกเกอร์ (S7)</button>
        </div>`
    };
  }

  /* ==========================================================================
     S6 — เลือกโบรกเกอร์
     ========================================================================== */

  const BROKERS = [
    { id: 'bell', name: 'คุณเบล', initials: 'บล', licence: 'ใบอนุญาตนายหน้า ว.6404xxxxx', focus: 'ฟรีแลนซ์และครีเอเตอร์', cases: 120, replyMin: 12, classes: [1, 2], strength: 1 },
    { id: 'nan', name: 'คุณแนน', initials: 'นน', licence: 'ใบอนุญาตนายหน้า ว.6501xxxxx', focus: 'ไรเดอร์และงานภาคสนาม', cases: 86, replyMin: 25, classes: [3, 4], strength: 3 },
    { id: 'oat', name: 'คุณโอ๊ต', initials: 'อต', licence: 'ใบอนุญาตนายหน้า ว.6312xxxxx', focus: 'ประกันสุขภาพและโรคร้ายแรง', cases: 210, replyMin: 40, classes: [1, 2, 3, 4], strength: 2 }
  ];

  /* น้ำหนักจับคู่: ความเชี่ยวชาญ 40 · ผลลัพธ์ 25 · เวลาตรงกัน 20 · ตอบไว 15
     ไม่มีค่าคอมมิชชันในสมการนี้ */
  function matchScore(b) {
    const worst = worstTube().id;
    const occFit = b.classes.indexOf(S.profile.occupationClass) > -1 ? 1 : 0.5;
    const tubeFit = b.strength === worst ? 1 : 0.7;
    const expertise = 40 * (occFit * 0.6 + tubeFit * 0.4);
    const outcome = 25 * Math.min(1, b.cases / 200);
    const timing = 20;
    const speed = 15 * Math.max(0, 1 - b.replyMin / 60);
    return Math.round(expertise + outcome + timing + speed);
  }

  function rankedBrokers() {
    return BROKERS.map(b => Object.assign({ score: matchScore(b) }, b)).sort((a, b) => b.score - a.score);
  }

  function timeSlots() {
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const now = new Date();
    const mk = (add, h) => {
      const d = new Date(now); d.setDate(d.getDate() + add); d.setHours(h, 0, 0, 0);
      const name = add === 0 ? 'วันนี้' : add === 1 ? 'พรุ่งนี้' : 'วัน' + days[d.getDay()];
      return { id: add + '-' + h, day: name, time: (h < 10 ? '0' + h : h) + ':00', label: name + ' ' + h + ':00' };
    };
    return [mk(0, 19), mk(1, 12), mk(1, 20), mk(2, 10), mk(2, 19)];
  }

  function s6() {
    const list = rankedBrokers();
    if (!S.brokerId) S.brokerId = list[0].id;
    const chosen = list.find(b => b.id === S.brokerId);
    const slots = timeSlots();
    const bk = S.booking;
    const ready = chosen && bk.slot && bk.nickname.trim() && bk.lineId.trim() && bk.consent;

    return {
      top: backTop('s4', 'ขอข้อมูลเพิ่มจากโบรกเกอร์'),
      body: `<div class="stack g16" style="padding-top:8px">
        <div class="banner plain" style="border-inline-start-color:var(--ok);background:var(--ok-bg)">
          <b>ไม่ซื้อก็จบ ไม่มีการติดตาม</b> คุยผ่าน LINE ไม่มีโทรศัพท์ ยกเลิกนัดได้ทุกเมื่อ</div>

        <div class="stack g8">
          <h2 class="h-sec">เลือกคนที่คุณอยากคุยด้วย</h2>
          <p class="tiny" style="margin-top:-4px">เรียงตามความเหมาะกับเคสของคุณ คิดจากความเชี่ยวชาญ 40% ผลลัพธ์ 25% เวลาตรงกัน 20% ตอบไว 15% ไม่มีค่าคอมมิชชันในสมการ</p>
          ${list.map(b => `<button class="brokercard ${b.id === S.brokerId ? 'sel' : ''}" data-act="broker" data-id="${b.id}">
            <span class="top">
              <span class="avatar sm">${esc(b.initials)}</span>
              <span style="flex:1;min-width:0">
                <b>${esc(b.name)}</b>
                <span class="role">${esc(b.focus)} · ดูแลมาแล้ว ${b.cases} เคส</span>
                <span class="role">ตอบเฉลี่ยใน ${b.replyMin} นาที · ${esc(b.licence)}</span>
              </span>
            </span>
          </button>`).join('')}
        </div>

        <div class="stack g8">
          <h2 class="h-sec">${esc(chosen.name)}จะทักไปตอนไหนดี</h2>
          <div class="slots">
            ${slots.map(s => `<button class="slot ${bk.slot === s.id ? 'sel' : ''}" data-act="slot" data-id="${s.id}" data-label="${esc(s.label)}">
              <b>${esc(s.day)}</b><span>${esc(s.time)}</span></button>`).join('')}
            <button class="slot ${bk.slot === 'now' ? 'sel' : ''}" data-act="slot" data-id="now" data-label="ภายใน 2 ชั่วโมง">
              <b>ให้ทักเลย</b><span>ภายใน 2 ชม.</span></button>
          </div>
        </div>

        <div class="stack g12">
          <div>
            <h2 class="h-sec">ขอข้อมูลติดต่อครั้งแรกของทั้งระบบ</h2>
            <p class="tiny" style="margin-top:3px">ขอแค่ชื่อเล่นกับ LINE ID ไม่ขอเบอร์โทรและไม่ขออีเมล</p>
          </div>
          <div class="field">
            <label for="nick">ชื่อเล่น</label>
            <input id="nick" data-field="nickname" value="${esc(bk.nickname)}" placeholder="เรียกคุณว่าอะไรดี" autocomplete="off">
          </div>
          <div class="field">
            <label for="line">LINE ID</label>
            <input id="line" data-field="lineId" value="${esc(bk.lineId)}" placeholder="เช่น mynameishere" autocomplete="off">
          </div>
          <button class="choice ${bk.consent ? 'sel' : ''}" data-act="book-consent">
            <span class="row"><span class="tick">${TICK}</span>
            <span style="flex:1">ยินยอมให้ส่งสรุปเคสให้${esc(chosen.name)}<small>ส่งเฉพาะตัวเลขช่องว่าง งบ และแผนที่สนใจ</small></span></span>
          </button>
        </div>
      </div>`,
      foot: `<button class="btn btn-primary" data-act="confirm-book" ${ready ? '' : 'disabled'}>ยืนยันนัดคุย</button>
        ${!ready ? '<p class="tiny" style="text-align:center;margin-top:8px">เลือกเวลา กรอกชื่อเล่นกับ LINE ID และติ๊กยินยอม</p>' : ''}`
    };
  }

  function s6done() {
    const b = S.booking;
    const broker = BROKERS.find(x => x.id === S.brokerId);
    return {
      top: '',
      body: `<div class="stack g16" style="padding-top:18px">
        <div class="stack g6">
          <span class="pill pill-ok" style="align-self:flex-start">นัดเรียบร้อย</span>
          <h1 class="h-screen" style="margin:0">${esc(broker.name)}จะทักหาคุณ ${esc(b.slotLabel)}</h1>
          <p class="lede">ทักผ่าน LINE ID ${esc(b.lineId)} และจะเรียกคุณว่า ${esc(b.nickname)} สรุปเคสถูกส่งให้แล้ว คุณไม่ต้องเล่าเรื่องเดิมซ้ำ</p>
        </div>
        <div class="card">
          <div class="kv" style="padding-top:0"><span>รหัสเคส</span><b class="mono">${esc(S.caseId)}</b></div>
          <div class="kv"><span>แผนที่เลือกไว้คุยต่อ</span><b>${S.selected.length ? S.selected.length + ' แผน' : 'ยังไม่เลือก'}</b></div>
          <div class="kv"><span>ถ้าไม่รับเคสใน 2 ชั่วโมง</span><b>ส่งต่อคนถัดไปอัตโนมัติ</b></div>
        </div>
        <div class="stack g8">
          <button class="btn btn-ghost" data-act="noop">เพิ่มลงปฏิทิน</button>
          <button class="btn-text" data-act="cancel-book">ยกเลิกนัดนี้</button>
        </div>
        <div class="banner"><b>ส่วนนี้สำหรับทีมเท่านั้น</b><br>ในระบบจริงลูกค้าจบที่จอนี้ ปุ่มล่างพาไปดูจอฝั่งโบรกเกอร์</div>
      </div>`,
      foot: `<button class="btn btn-primary" data-act="go" data-s="s7">เปิดจอฝั่งโบรกเกอร์ (S7)</button>`
    };
  }

  /* ==========================================================================
     S7 — Broker Co-Pilot
     ========================================================================== */

  function s7() {
    const p = S.profile, b = S.booking, r = S.ranking;
    const broker = BROKERS.find(x => x.id === S.brokerId) || BROKERS[0];
    const grey = S.tubes.filter(t => t.unknown);
    const picked = r.recommendations.filter(s => S.selected.indexOf(s.product.id) > -1);

    const checklist = [
      ['อายุ', p.age ? p.age + ' ปี' : null],
      ['ลักษณะงาน / ชั้นอาชีพ', p.occupationLabel ? `${p.occupationLabel} (ชั้น ${p.occupationClass})` : null],
      ['รายได้เฉลี่ยต่อเดือน', p.monthlyIncomeBaht ? B(p.monthlyIncomeBaht) + ' บาท' : null],
      ['ค่าใช้จ่ายจำเป็น (E)', p.essentialExpenseE ? B(p.essentialExpenseE) + ' บาท' + (S.estimatedE ? ' — ประมาณการจากกลุ่ม' : '') : null],
      ['เงินเก็บใช้ได้ทันที', p.liquidSavingsBaht === 'unknown' ? 'ลูกค้าตอบว่าไม่แน่ใจ — ต้องถามเพิ่ม' : p.liquidSavingsBaht ? B(p.liquidSavingsBaht) + ' บาท' : null],
      ['ผู้พึ่งพา', p.hasDependents === null ? null : (p.hasDependents ? `มี ${p.dependentsCount} คน` + (p.kidsUnder6 ? ` · ลูกต่ำกว่า 6 ขวบ ${p.kidsUnder6} คน` : '') : 'ไม่มี')],
      ['ความแกว่งของรายได้', { similar: 'ใกล้เคียงกันทุกเดือน', somewhat_different: 'ต่างกันบ้าง', very_different: 'ต่างกันมาก' }[p.incomeVolatility] || null],
      ['ความคุ้มครองเดิม', existingSummary()],
      ['สถานะ ม.40', p.existing.m40.has ? `มีแล้ว — ${p.existing.m40.tier === 'unknown' ? 'จำทางเลือกไม่ได้' : 'จ่าย ' + p.existing.m40.tier + ' บาท'}` : 'ยังไม่มี — ระบบขึ้นให้เป็นข้อแรก'],
      ['ผลช่องว่างทั้ง 3 หลอด', S.tubes.map(t => `${t.title} ${t.unknown ? 'สรุปไม่ได้' : Math.round(t.pct) + '%'}`).join(' · ')],
      ['งบต่อเดือน', S.budget ? B(S.budget) + ' บาท (เพดานที่เสนอได้ ' + B(r.budgetCeiling) + ')' : 'ลูกค้าเลือกไม่บอกงบ'],
      ['สินค้าที่แนะนำและเหตุผล', r.recommendations.length + ' แผน · ตัดออก ' + r.filterAudit.length + ' รายการพร้อมเหตุผล']
    ];

    const checklistDone = checklist.filter(c => !!c[1]).length;
    const checklistWarn = checklist.filter(c => c[1] && /ไม่แน่ใจ|ประมาณการ|ไม่ระบุ|ไม่บอก/.test(c[1])).length;

    const openers = [
      p.existing.m40.has
        ? `สวัสดีครับคุณ${esc(b.nickname)} เห็นว่าคุณสมัคร ม.40 ไว้แล้ว ถือว่าคิดมาก่อนคนส่วนใหญ่เลยครับ วันนี้ผมอยากคุยเรื่องช่องว่างที่ ม.40 ยังไม่ครอบคลุม คือค่ารักษาพยาบาลครับ`
        : `สวัสดีครับคุณ${esc(b.nickname)} ผมเห็นผลที่ระบบคำนวณแล้ว อย่างแรกเลยคือ ม.40 ที่ขึ้นเป็นข้อแรก เดือนละ ${r.statePick ? r.statePick.product.premiumMonthly : 70} บาท อันนั้นคุณสมัครเองได้เลยครับ ผมไม่ได้ค่าคอมจากมัน`,
      grey.length
        ? `ขอเช็คเรื่องเดียวก่อนครับ ที่ระบบขึ้นว่า "${esc(grey[0].title)}" ยังสรุปไม่ได้ เพราะคุณตอบว่าไม่แน่ใจ พอนึกออกไหมครับว่าประมาณเท่าไหร่`
        : `จากที่คุณตอบมา ค่าใช้จ่ายที่ตัดไม่ได้เดือนละ ${B(p.essentialExpenseE)} บาท ถ้าหยุดงานกะทันหัน เงินเก็บจะยืนได้ราว ${S.tubes.find(t => t.id === 1).monthsCovered.toFixed(1)} เดือนครับ`
    ];

    const faqs = [
      ['ทำไมต้องซื้อเพิ่ม ในเมื่อมี ม.40 แล้ว', 'ม.40 ชดเชยการขาดรายได้ 300 บาทต่อวันที่นอนโรงพยาบาล แต่ไม่จ่ายค่ารักษา ถ้าอยากเลือกโรงพยาบาลเอง ต้องมีอีกชั้นมารับ ให้ลูกค้ากดสลับโหมดในหลอดที่ 2 ดูด้วยกัน'],
      ['ทำไมราคาถูกกว่าที่เคยได้ยิน', 'เพราะระบบเสนอเฉพาะแผนที่ปิดช่องว่างที่คำนวณได้ ไม่ได้ขายแผนใหญ่ที่สุด'],
      ['เคลมไม่ได้แล้วจะทำยังไง', 'ข้อยกเว้นถูกกางให้เห็นตั้งแต่ก่อนเลือกแล้ว เปิดอ่านซ้ำพร้อมกัน โดยเฉพาะระยะเวลารอคอยและโรคที่เป็นมาก่อน']
    ];

    return {
      top: `<div class="brandmark"><div class="lockup" style="background:var(--brand-900)">CP</div>
        <div><b>Broker Co-Pilot</b><small>เคส ${esc(S.caseId)} · ${esc(b.nickname || 'ลูกค้า')}</small></div></div>
        <button class="iconbtn" data-act="go" data-s="s6done" aria-label="กลับ">${CHEV}</button>`,
      body: `<div class="stack g16" style="padding-top:8px">

        <div class="card" style="background:var(--brand-900);border-color:var(--brand-900);color:#fff">
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <div style="flex:1;min-width:120px">
              <div class="tiny" style="color:#9DB0D6">ลูกค้า · เวลานัด</div>
              <b>${esc(b.nickname || '—')} · ${esc(b.slotLabel || '—')}</b>
            </div>
            <div style="text-align:end">
              <div class="tiny" style="color:#9DB0D6">เหลือเวลารับเคส</div>
              <b class="mono">01:47:22</b>
            </div>
          </div>
          <button class="btn btn-sm" style="background:#fff;color:var(--brand-900);margin-top:11px;width:100%" data-act="noop">รับเคสนี้</button>
        </div>

        ${grey.length ? `<div class="banner warn"><b>ต้องถามเพิ่มเป็นอย่างแรก</b><br>
          ${grey.map(t => esc(t.title)).join(' · ')} — ลูกค้าตอบว่าไม่แน่ใจ ระบบไม่เดาตัวเลขให้</div>` : ''}

        <div class="seclabel"><span class="eyebrow">AI Customer Brief</span></div>

        <div class="card">
          <h3 class="h-sec">ตัวเลขสำคัญ</h3>
          <div class="grid2" style="margin-top:10px">
            <div class="stat"><div class="k">ลักษณะงาน</div><div class="v" style="font-size:.87rem">${esc(p.occupationLabel)}</div></div>
            <div class="stat"><div class="k">อายุ</div><div class="v mono">${p.age} ปี</div></div>
            <div class="stat"><div class="k">รายได้/เดือน</div><div class="v mono">${B(p.monthlyIncomeBaht)}</div></div>
            <div class="stat"><div class="k">ค่าใช้จ่ายจำเป็น</div><div class="v mono">${B(p.essentialExpenseE)}</div></div>
            <div class="stat"><div class="k">เงินเก็บใช้ได้ทันที</div><div class="v mono">${p.liquidSavingsBaht === 'unknown' ? 'ไม่แน่ใจ' : B(p.liquidSavingsBaht)}</div></div>
            <div class="stat"><div class="k">งบ/เดือน</div><div class="v mono">${S.budget ? B(S.budget) : 'ไม่ระบุ'}</div></div>
          </div>
          <p class="tiny" style="margin-top:8px">เป้าหมายเงินสำรอง ${MC.monthsTarget(p)} เดือน · ความแกว่งรายได้ ${{ similar: 'ใกล้เคียง', somewhat_different: 'ต่างบ้าง', very_different: 'ต่างมาก' }[p.incomeVolatility] || '—'}</p>
        </div>

        <div class="card">
          <h3 class="h-sec">ช่องว่างที่ระบบคำนวณได้</h3>
          <div class="stack g12" style="margin-top:10px">
            ${S.tubes.map(t => `<div>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="small" style="flex:1">${esc(t.title)}</span>
                <span class="pill pill-${t.status}">${STATUS_TEXT[t.status]}</span>
                <b class="mono small">${t.unknown ? '—' : Math.round(t.pct) + '%'}</b>
              </div>
              ${trackHtml(t)}
              <div class="tiny" style="margin-top:4px">มี ${t.unknown ? '?' : B(t.haveBaht)} จากที่ควรมี ${B(t.neededBaht)} บาท</div>
            </div>`).join('')}
          </div>
          <p class="tiny" style="margin-top:10px">ฉากทัศน์: ${esc(MC.SCENARIOS[S.scenario2].label)} · โหมด${S.mode2 === 'state' ? 'สิทธิรัฐ' : 'เอกชน'} · หลอด 3 ${S.horizon3 === 'to60' ? 'ถึงอายุ 60' : S.horizon3 + ' เดือน'}</p>
        </div>

        <details class="acc">
          <summary>สิ่งที่ลูกค้าเห็นไปแล้ว <span class="cnt">3</span></summary>
          <div class="accbody">
            <ul class="covers">
              <li>${p.existing.m40.has ? 'เห็นว่าใช้สิทธิ ม.40 อยู่แล้ว ระบบไม่เสนอซ้ำ' : 'เห็น ม.40 เป็นข้อแรก พร้อมป้ายว่าเราไม่ได้ค่าคอมมิชชัน'}</li>
              <li>เห็นกล่องข้อยกเว้นของทุกแผน กางไว้ตั้งแต่แรก</li>
              <li>${picked.length ? 'เลือกไว้ ' + picked.map(s => esc(s.product.name)).join(', ') : 'ยังไม่เลือกแผน ขอคุยก่อน'}</li>
            </ul>
          </div>
        </details>

        <details class="acc">
          <summary>ข้อมูลที่เก็บมาแล้ว <span class="cnt">${checklistDone}/12</span></summary>
          <div class="accbody">
            <p class="tiny">หลักฐานว่าข้ามขั้นสัมภาษณ์ได้ทั้งขั้น${checklistWarn ? ` · มี ${checklistWarn} ข้อที่ต้องถามย้ำ` : ''}</p>
            <ul class="checklist" style="margin-top:6px">
              ${checklist.map((c, i) => {
                const ok = !!c[1];
                const warn = ok && /ไม่แน่ใจ|ประมาณการ|ไม่ระบุ|ไม่บอก/.test(c[1]);
                return `<li><span class="n ${warn ? 'warn' : ''}">${ok ? (warn ? '!' : '✓') : '–'}</span>
                  <span><b>${i + 1}. ${esc(c[0])}</b><span>${esc(c[1] || 'ลูกค้าข้ามข้อนี้')}</span></span></li>`;
              }).join('')}
            </ul>
          </div>
        </details>

        <div class="seclabel"><span class="eyebrow">Co-Pilot · ช่วยเปิดบทสนทนา ไม่ได้ตัดสินใจแทน</span></div>

        <details class="acc" open>
          <summary>ประโยคเปิดที่แนะนำ <span class="cnt">${openers.length}</span></summary>
          <div class="accbody">
            <div class="stack g8">
              ${openers.map(o => `<div class="banner plain" style="font-size:.84rem">${o}</div>`).join('')}
            </div>
          </div>
        </details>

        <details class="acc">
          <summary>คำถามที่ลูกค้าน่าจะถาม <span class="cnt">${faqs.length}</span></summary>
          <div class="accbody">
            <div class="stack g12">
              ${faqs.map(f => `<div><b class="small">${esc(f[0])}</b><p class="tiny" style="margin-top:2px">${esc(f[1])}</p></div>`).join('')}
            </div>
          </div>
        </details>

        <details class="acc">
          <summary>Audit Trail <span class="cnt">${S.audit.length} รายการ</span></summary>
          <div class="accbody">
            <p class="tiny" style="margin-bottom:10px">ทุกคำแนะนำที่ระบบให้ พร้อมเหตุผล · บันทึกนี้แก้ไขไม่ได้</p>
            <div class="timeline">
              ${S.audit.map(a => `<div class="tl"><time>${hhmm(a.at)}</time>
                <p class="small">${esc(a.text)}</p>${a.detail ? `<em>${esc(a.detail)}</em>` : ''}</div>`).join('')}
            </div>
            <button class="btn btn-ghost btn-sm" style="margin-top:11px;width:100%" data-act="noop">ส่งออกเป็น PDF</button>
          </div>
        </details>

        <div class="banner warn">ระบบนี้ไม่มีปุ่มปิดการขายอัตโนมัติ ทุกการปิดการขายทำโดยตัวแทนที่มีใบอนุญาต</div>
      </div>`,
      foot: `<button class="btn btn-primary" data-act="noop">เปิดแชท LINE กับลูกค้า</button>`
    };
  }

  function existingSummary() {
    const ex = S.profile.existing;
    if (ex.none) return 'ไม่มีความคุ้มครองใดเลย';
    const out = [];
    if (ex.m40.has) out.push('ม.40');
    if (ex.health.has) out.push('ประกันสุขภาพ ' + (ex.health.perYearBaht === 'unknown' ? '(ไม่แน่ใจวงเงิน)' : B(ex.health.perYearBaht) + '/ปี'));
    if (ex.hb.has) out.push('ชดเชยรายวัน ' + (ex.hb.dailyBaht === 'unknown' ? '(ไม่แน่ใจวงเงิน)' : B(ex.hb.dailyBaht) + '/วัน'));
    if (ex.pa.has) out.push('PA ' + (ex.pa.amountBaht === 'unknown' ? '(ไม่แน่ใจวงเงิน)' : B(ex.pa.amountBaht)));
    if (ex.life.has) out.push('ประกันชีวิต ' + (ex.life.amountBaht === 'unknown' ? '(ไม่แน่ใจวงเงิน)' : B(ex.life.amountBaht)));
    return out.length ? out.join(' · ') : null;
  }

  /* ==========================================================================
     render + events
     ========================================================================== */

  const SCREENS = { s1, s2, s3, s4, s5, s5done, s6, s6done, s7 };

  function render() {
    const r = SCREENS[S.screen]();
    topbar.innerHTML = r.top || '';
    topbar.classList.toggle('lined', S.screen === 's3' || S.screen === 's7');
    view.innerHTML = r.body;
    footbar.innerHTML = r.foot || '';
    if (r.after) r.after();
  }

  const closeModal = () => { modal.innerHTML = ''; };

  function logRankingAudit() {
    const r = S.ranking;
    if (r.statePick) {
      audit('rank-state', 'ระบบจัด "' + r.statePick.product.name + '" เป็นข้อแรก',
        'เพราะเป็นสิทธิของรัฐที่ลูกค้ายังไม่ได้ใช้ และเราไม่ได้ค่าคอมมิชชันจากสิทธินี้');
    } else {
      audit('rank-state', 'ระบบไม่เสนอ ม.40 เพราะลูกค้าสมัครไว้แล้ว', 'นับสิทธินี้เข้าไปในหลอดให้ลูกค้าเห็นแทน');
    }
    if (S.budget != null) {
      audit('budget', 'ลูกค้าบอกงบ ' + B(S.budget) + ' บาท/เดือน',
        'ระบบเสนอได้ถึง ' + B(r.budgetCeiling) + ' บาท (งบ +10%) แผนที่แพงกว่านี้ถูกตัดออกพร้อมเหตุผล');
    } else {
      audit('budget', 'ลูกค้าเลือกไม่บอกงบ', 'ระบบไม่ใช้เพดานราคา แต่เรียงจากถูกไปแพงแทน');
    }
    r.filterAudit.slice(0, 6).forEach((f, i) => audit('filter-' + f.id + i, 'ตัดออก: ' + f.name, f.reason));
    r.honestNotes.forEach((n, i) => audit('honest-' + i, 'แจ้งลูกค้าตรงๆ', n));
    audit('excl', 'แสดงกล่องสิ่งที่ยังไม่คุ้มครองของทุกแผนแบบกางไว้',
      'ครอบคลุมระยะเวลารอคอย โรคที่เป็นมาก่อน และความรับผิดส่วนแรก');
  }

  function finishQuestions() {
    ensureCaseId();
    recompute();
    S.tubesAnimated = false;
    const t = S.tubes;
    audit('compute', 'ระบบคำนวณช่องว่างครบ 3 หลอด',
      t.map(x => `${x.title} ${x.unknown ? 'สรุปไม่ได้' : Math.round(x.pct) + '%'}`).join(' · '));
    if (!t.some(x => x.status === 'red'))
      audit('nored', 'ไม่มีหลอดไหนอยู่ระดับต้องรีบปิด', 'ระบบจึงไม่สร้างแถบแดงขึ้นมา และไม่ใช้ภาษาที่ขู่ลูกค้า');
    logRankingAudit();
    go('s4');
  }

  document.addEventListener('click', function (e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const a = t.dataset.act;
    const list = questionList();
    const q = list[S.qi];

    switch (a) {
      case 'noop': return;
      case 'go': return go(t.dataset.s);
      case 'close-modal':
        if (t.classList.contains('scrim') && e.target.closest('.sheet')) return;
        return closeModal();

      case 'persona': {
        const c = Number(t.dataset.c);
        S.profile.occupationClass = c;
        S.profile.occupationLabel = PERSONAS.find(x => x.c === c).label;
        audit('persona', 'ลูกค้าเลือกลักษณะงาน: ' + S.profile.occupationLabel, 'ใช้คัดสินค้าตามชั้นอาชีพ ไม่ได้ใช้คำนวณช่องว่าง');
        return render();
      }
      case 'start-q': S.qi = 0; return go('s3');

      case 'q-pick': {
        let v = t.dataset.v;
        if (['unknown', 'similar', 'somewhat_different', 'very_different'].indexOf(v) === -1) v = Number(v);
        q.set(v);
        delete S.skipped[q.id];
        return render();
      }
      case 'q-multi': {
        const v = t.dataset.v;
        let cur = (q.get() || []).slice();
        if (v === 'none') cur = cur.indexOf('none') > -1 ? [] : ['none'];
        else {
          cur = cur.filter(x => x !== 'none');
          cur = cur.indexOf(v) > -1 ? cur.filter(x => x !== v) : cur.concat([v]);
        }
        q.set(cur);
        return render();
      }
      case 'cov': {
        const k = t.dataset.k, ex = S.profile.existing;
        if (k === 'none') {
          ex.none = !ex.none;
          if (ex.none) coverageOptions.forEach(o => { ex[o.key].has = false; if (o.field) ex[o.key][o.field] = null; });
        } else {
          ex.none = false;
          ex[k].has = !ex[k].has;
          if (!ex[k].has) {
            const o = coverageOptions.find(x => x.key === k);
            if (o.field) ex[k][o.field] = null;
            if (k === 'm40') ex.m40.tier = null;
          }
        }
        return render();
      }
      case 'cov-amt': {
        const v = t.dataset.v;
        S.profile.existing[t.dataset.k][t.dataset.f] = v === 'unknown' ? 'unknown' : Number(v);
        return render();
      }
      case 'q-next': {
        if (q.id === 'savings' && S.consentCoverage === null) return openConsentSheet();
        if (S.qi >= list.length - 1) return finishQuestions();
        S.qi++;
        return render();
      }
      case 'q-skip': {
        S.skipped[q.id] = true;
        if (q.id === 'expense') S.estimatedE = true;
        if (q.id === 'savings') { S.profile.liquidSavingsBaht = 'unknown'; if (S.consentCoverage === null) return openConsentSheet(); }
        if (q.id === 'dependents') { S.profile.hasDependents = false; S.profile.dependentsCount = 0; }
        if (q.id === 'volatility') S.profile.incomeVolatility = 'somewhat_different';
        if (q.id === 'age') S.profile.age = 35;
        if (q.id === 'income') S.profile.monthlyIncomeBaht = 25000;
        if (q.id === 'budget') S.budget = null;
        audit('skip-' + q.id, 'ลูกค้าข้ามคำถาม: ' + q.title, 'ระบบไม่เดาคำตอบ แต่ใช้ค่ากลางของกลุ่มและติดป้ายประมาณการ');
        const l2 = questionList();
        if (S.qi >= l2.length - 1) return finishQuestions();
        S.qi++;
        return render();
      }
      case 'q-back': {
        if (S.qi === 0) return go('s2');
        S.qi--;
        return render();
      }
      case 'consent': {
        S.consentCoverage = t.dataset.v;
        closeModal();
        audit('consent', 'ขอความยินยอมก่อนถามเรื่องความคุ้มครองและสุขภาพ — ลูกค้าเลือก "' + (S.consentCoverage === 'yes' ? 'ยินยอมและตอบต่อ' : 'ข้ามส่วนนี้') + '"', 'PDPA progressive consent · ณ จุดนี้ระบบยังไม่มีตัวตนจริงของลูกค้า');
        const l3 = questionList();
        if (S.qi >= l3.length - 1) return finishQuestions();
        S.qi++;
        return render();
      }
      case 'back-to-q': {
        const idx = questionList().findIndex(x => x.id === t.dataset.q);
        if (idx > -1) { S.qi = idx; S.tubesAnimated = false; return go('s3'); }
        return;
      }

      case 'mode2':
        S.mode2 = t.dataset.v; S.tubesAnimated = false; recompute(); closeModal();
        audit('mode2-' + S.mode2, 'ลูกค้าสลับหลอดค่ารักษาเป็นโหมด' + (S.mode2 === 'state' ? 'ใช้สิทธิรัฐ' : 'รักษาเอกชน'), 'ตัวเลขเป้าหมายของหลอด 2 เปลี่ยนตามโหมด');
        return render();
      case 'h3':
        S.horizon3 = t.dataset.v === 'to60' ? 'to60' : Number(t.dataset.v);
        S.tubesAnimated = false; recompute(); closeModal();
        return render();
      case 'why': return openWhy(Number(t.dataset.t));
      case 'show-more': return openMore();
      case 'erase': if (confirm('ลบข้อมูลทั้งหมดและเริ่มใหม่')) location.reload(); return;

      case 'toggle-prod': {
        const id = t.dataset.id;
        const i = S.selected.indexOf(id);
        if (i > -1) S.selected.splice(i, 1); else S.selected.push(id);
        if (i === -1) {
          const prod = MC.CATALOGUE.find(x => x.id === id);
          audit('sel-' + id, 'ลูกค้าเลือกแผน "' + prod.name + '"', 'แถบด้านบนขยับให้เห็นทันทีว่าเพิ่มขึ้นเท่าไหร่');
        }
        return updateSelection();
      }
      case 'pick-tier': {
        const id = t.dataset.id;
        const tier = S.ranking.allStateTiers.find(x => x.product.id === id);
        if (!tier) return;
        /* ต้องสลับในทุกรายการ ไม่ใช่แค่การ์ดที่แสดงอยู่
           เพราะการคำนวณแถบ เบี้ยรวม และจอถัดไป อ่านจาก recommendations */
        const swap = (arr) => arr.map(x => (x.product.kind === 'state' ? tier : x));
        const wasSelected = S.selected.some(x => x.indexOf('m40') === 0);
        S.ranking.recommendations = swap(S.ranking.recommendations);
        S.ranking.primary = swap(S.ranking.primary);
        S.ranking.more = swap(S.ranking.more);
        S.ranking.statePick = tier;
        /* ถ้าเลือก ม.40 ไว้อยู่แล้ว ให้ยังเลือกอยู่ แต่เปลี่ยนเป็นทางเลือกใหม่ */
        S.selected = S.selected.filter(x => x.indexOf('m40') !== 0);
        if (wasSelected) S.selected.push(id);
        return render();
      }
      case 'go-buy': return go('s5');
      case 'read-excl': S.readExclusions = !S.readExclusions; return render();
      case 'buy': {
        S.orderNo = S.caseId + '-01';
        const picked = S.ranking.recommendations.filter(x => S.selected.indexOf(x.product.id) > -1);
        audit('buy', 'ลูกค้ากดซื้อ ' + picked.length + ' แผน เลขที่คำขอ ' + S.orderNo,
          'ติ๊กยืนยันว่าอ่านข้อยกเว้นแล้วก่อนกดซื้อ · ระบบไม่ปิดการขายเอง ส่งใบคำขอให้ตัวแทนที่มีใบอนุญาตตรวจก่อนเสมอ');
        return go('s5done');
      }
      case 'go-broker': return go('s6');

      case 'broker': S.brokerId = t.dataset.id; return render();
      case 'slot': S.booking.slot = t.dataset.id; S.booking.slotLabel = t.dataset.label; return render();
      case 'book-consent': S.booking.consent = !S.booking.consent; return render();
      case 'confirm-book': {
        const br = BROKERS.find(x => x.id === S.brokerId);
        audit('book', 'ลูกค้าเลือก' + br.name + ' และนัดคุย ' + S.booking.slotLabel,
          'คะแนนจับคู่ ' + matchScore(br) + ' จากความเชี่ยวชาญ 40% ผลลัพธ์ 25% เวลาตรงกัน 20% ตอบไว 15% — ไม่มีค่าคอมมิชชันในสมการ · ถ้าไม่รับเคสใน 2 ชม. ส่งต่ออัตโนมัติ');
        audit('pdpa', 'ลูกค้าให้ชื่อเล่นและ LINE ID เป็นครั้งแรกของทั้งระบบ พร้อมยินยอมส่งสรุปเคส', 'ก่อนหน้านี้เคสทำงานแบบไม่ระบุตัวตนทั้งหมด');
        return go('s6done');
      }
      case 'cancel-book':
        if (confirm('ยกเลิกนัดนี้')) { S.booking.slot = null; S.booking.consent = false; go('s6'); }
        return;
    }
  });

  document.addEventListener('input', function (e) {
    const f = e.target.dataset && e.target.dataset.field;
    if (!f) return;
    S.booking[f] = e.target.value;
    const btn = footbar.querySelector('[data-act="confirm-book"]');
    const b = S.booking;
    if (btn) btn.disabled = !(b.slot && b.nickname.trim() && b.lineId.trim() && b.consent);
  });

  render();
})();
