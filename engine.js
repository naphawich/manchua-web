/* ==========================================================================
   มั่นชัวร์ — Engine  (config + gap-engine + delta-engine + catalogue)
   --------------------------------------------------------------------------
   นี่คือ "เครื่องคิดเลข" ของทั้งระบบ  UI ห้ามคำนวณ % หรือบาทซ้ำเอง
   ถ้าตัวเลขไม่ตรงกับเอกสารสเปก ให้ถือว่าไฟล์นี้ผิดและแก้ที่นี่ ไม่ใช่ที่หน้าเว็บ

   เมื่อเสียบ engine จริง (types.ts / config.ts / gap-engine.ts / delta-engine.ts /
   catalogue.ts) ให้แทนที่ทั้งไฟล์นี้ โดยคง signature ของ window.MC ไว้
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- config */

  const CONFIG = {
    /* หลอด 1 — เดือนเป้าหมาย */
    tube1: { baseMonths: 3, dependentBonus: 1, volatilityBonus: 1, capMonths: 6 },

    /* ประกันสังคมมาตรา 40 — อัตราตามประกาศ สปส. (ต้องยืนยันก่อนใช้งานจริง) */
    m40: {
      70:  { premium: 70,  daily: 300, dailyCapDays: 30, disabilityMonthly: 500, disabilityMonths: 180, death: 25000, name: 'ทางเลือกที่ 1' },
      100: { premium: 100, daily: 300, dailyCapDays: 30, disabilityMonthly: 500, disabilityMonths: 180, death: 25000, oldAge: true, name: 'ทางเลือกที่ 2' },
      300: { premium: 300, daily: 300, dailyCapDays: 30, disabilityMonthly: 500, disabilityMonths: 180, death: 50000, oldAge: true, childAllowance: 200, name: 'ทางเลือกที่ 3' }
    },

    /* ค่าห้องอ้างอิง รพ.เอกชน ต่อคืน — ใช้ในหลอด 2 โหมดเอกชน */
    hospitalRoomRefBaht: 2618,

    /* เกณฑ์สี */
    status: { redBelow: 40, greenAbove: 70 },

    /* ช่วงงบที่ยังถือว่า "เหมาะสม"
       - ในงบ            : เบี้ยรวม ≤ งบที่ลูกค้ากรอก
       - ใกล้เคียง        : ไม่เกินงบ +10% → ยังเสนอ แต่ต้องบอกส่วนต่างเป็นบาทตรงๆ
       - เกินชัดเจน       : มากกว่านั้น → ไม่เสนอ แต่บันทึกเหตุผลที่ตัดออก
       - เพดานจ่ายไหวจริง : 10% ของรายได้ต่อเดือน (rule of thumb ค่าเบี้ยสุขภาพ)
         ใช้เตือนเมื่อลูกค้ากรอกงบสูงกว่าที่รายได้รองรับ */
    budget: { tolerance: 0.10, incomeCeilingRatio: 0.10 },

    sources: {
      emergencyFund: 'หลักเงินสำรองฉุกเฉิน 3–6 เดือนของค่าใช้จ่ายจำเป็น (แนวปฏิบัติการวางแผนการเงินส่วนบุคคล)',
      m40: 'สำนักงานประกันสังคม — สิทธิประโยชน์ผู้ประกันตนมาตรา 40',
      roomRate: 'ค่าห้องพักผู้ป่วยในเฉลี่ย โรงพยาบาลเอกชน (ค่าอ้างอิงเดโม)',
      ucs: 'สิทธิหลักประกันสุขภาพแห่งชาติ (บัตรทอง) — ครอบคลุมค่ารักษาตามรายการที่กำหนด'
    }
  };

  /* ฉากทัศน์ของหลอด 2 — เหตุการณ์สุขภาพที่ใช้เป็นฐานคำนวณ */
  const SCENARIOS = {
    appendicitis: {
      id: 'appendicitis',
      label: 'ไส้ติ่งอักเสบ ต้องผ่าตัดด่วน',
      short: 'ไส้ติ่งอักเสบ',
      nights: 3,
      recoveryDays: 14,
      privatePackageBaht: 85000,
      outOfPocketBaht: 12000,
      why: 'เป็นเหตุการณ์ที่เกิดกับคนวัยทำงานบ่อยที่สุด และเป็นกรณีที่ต้องจ่ายทันทีโดยไม่มีเวลาเตรียมตัว'
    },
    dengue: {
      id: 'dengue',
      label: 'ไข้เลือดออก ต้องนอนโรงพยาบาล',
      short: 'ไข้เลือดออก',
      nights: 4,
      recoveryDays: 10,
      privatePackageBaht: 45000,
      outOfPocketBaht: 8000,
      why: 'ไม่ต้องผ่าตัด แต่ต้องนอนเฝ้าอาการหลายคืน เป็นฉากทัศน์ที่ค่าห้องเป็นค่าใช้จ่ายหลัก'
    },
    fracture: {
      id: 'fracture',
      label: 'อุบัติเหตุ กระดูกขาหัก ต้องผ่าตัดใส่เหล็ก',
      short: 'ขาหักจากอุบัติเหตุ',
      nights: 4,
      recoveryDays: 45,
      privatePackageBaht: 120000,
      outOfPocketBaht: 18000,
      why: 'ค่ารักษาสูงและพักฟื้นนาน เหมาะกับคนที่ต้องขับขี่หรือทำงานนอกสถานที่เป็นประจำ'
    }
  };

  /* ------------------------------------------------------------- utilities */

  const baht = (n) => Math.round(n).toLocaleString('th-TH');
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const isUnknown = (v) => v === 'unknown' || v === null || v === undefined;

  /* คืนค่า tier ของ ม.40 ที่ผู้ใช้ถืออยู่ (หรือ null) */
  function m40Of(profile) {
    const m = profile.existing && profile.existing.m40;
    if (!m || !m.has) return null;
    const tier = m.tier;
    if (isUnknown(tier)) return CONFIG.m40[70]; // ไม่ทราบทางเลือก → ใช้ค่าต่ำสุดแบบระมัดระวัง
    return CONFIG.m40[tier] || CONFIG.m40[70];
  }

  function monthsTarget(profile) {
    const c = CONFIG.tube1;
    let m = c.baseMonths;
    if (profile.hasDependents) m += c.dependentBonus;
    if (profile.incomeVolatility === 'very_different') m += c.volatilityBonus;
    return Math.min(m, c.capMonths);
  }

  function savingsOf(profile) {
    return isUnknown(profile.liquidSavingsBaht) ? 0 : profile.liquidSavingsBaht;
  }

  function statusOf(pct, unknown) {
    if (unknown) return 'unknown';
    if (pct < CONFIG.status.redBelow) return 'red';
    if (pct <= CONFIG.status.greenAbove) return 'watch';
    return 'ok';
  }

  /* สร้าง layer ของแถบ: ตัดส่วนเกิน 100% ออกและคืน pct ของแต่ละชั้น */
  function buildLayers(raw, needed) {
    const layers = [];
    let used = 0;
    for (const l of raw) {
      if (!l.baht || l.baht <= 0) continue;
      const room = Math.max(0, needed - used);
      const shown = Math.min(l.baht, room);
      used += l.baht;
      layers.push({
        key: l.key, label: l.label, baht: l.baht, source: l.source,
        pct: needed > 0 ? (shown / needed) * 100 : 0
      });
    }
    return layers;
  }

  /* ------------------------------------------------------------ gap-engine */

  function tube1(profile, scen) {
    const E = profile.essentialExpenseE || 0;
    const M = monthsTarget(profile);
    const needed = E * M;

    const m40 = m40Of(profile);
    const hb = profile.existing && profile.existing.hb;
    const hbDaily = hb && hb.has ? hb.dailyBaht : 0;
    const hbUnknown = !!(hb && hb.has && isUnknown(hb.dailyBaht));

    const raw = [
      { key: 'savings', label: 'เงินเก็บที่หยิบใช้ได้', baht: savingsOf(profile), source: 'จากคำตอบข้อ 5' },
      m40 ? { key: 'state', label: `ม.40 ชดเชยขาดรายได้ ${baht(m40.daily)}฿ × ${m40.dailyCapDays} วัน`, baht: m40.daily * m40.dailyCapDays, source: CONFIG.sources.m40 } : null,
      hbDaily && !hbUnknown ? { key: 'always', label: `ชดเชยรายวันที่มีอยู่ ${baht(hbDaily)}฿ × ${scen.nights} คืน`, baht: hbDaily * scen.nights, source: 'จากคำตอบข้อ 6' } : null
    ].filter(Boolean);

    const have = raw.reduce((s, l) => s + l.baht, 0);
    const unknown = isUnknown(profile.liquidSavingsBaht) || hbUnknown;
    const pct = needed > 0 ? clamp((have / needed) * 100, 0, 100) : 0;

    return {
      id: 1,
      title: 'ถ้ารายได้หยุดกะทันหัน',
      plain: 'เดือนที่ทำงานไม่ได้ ค่าใช้จ่ายที่ตัดไม่ได้ยังเดินต่อ',
      neededBaht: needed, haveBaht: have, pct, unknown,
      status: statusOf(pct, unknown),
      layers: buildLayers(raw, needed),
      monthsCovered: E > 0 ? have / E : 0,
      monthsTarget: M,
      overflow: have > needed,
      whatItDoesNotCover: [
        'ม.40 จ่ายชดเชยเฉพาะวันที่นอนโรงพยาบาลหรือแพทย์สั่งหยุด ไม่ใช่ทุกวันที่ขาดรายได้',
        'ไม่มีสิทธิใดชดเชยกรณีงานหาย ลูกค้าหาย หรือถูกยกเลิกสัญญา'
      ],
      formula: `เป้าหมาย = ค่าใช้จ่ายจำเป็น ${baht(E)} × ${M} เดือน = ${baht(needed)} บาท`,
      basis: `${CONFIG.sources.emergencyFund}${profile.hasDependents ? ' + 1 เดือนเพราะมีผู้พึ่งพา' : ''}${profile.incomeVolatility === 'very_different' ? ' + 1 เดือนเพราะรายได้แกว่งมาก' : ''}`
    };
  }

  function tube2(profile, scen, mode) {
    const health = profile.existing && profile.existing.health;
    const hb = profile.existing && profile.existing.hb;
    const healthUnknown = !!(health && health.has && isUnknown(health.perYearBaht));
    const hbUnknown = !!(hb && hb.has && isUnknown(hb.dailyBaht));

    const needed = mode === 'private'
      ? scen.privatePackageBaht + scen.nights * CONFIG.hospitalRoomRefBaht
      : scen.outOfPocketBaht;

    const healthPays = health && health.has && !healthUnknown
      ? Math.min(health.perYearBaht, needed)
      : 0;
    const hbPays = hb && hb.has && !hbUnknown ? hb.dailyBaht * scen.nights : 0;

    const raw = [
      { key: 'savings', label: 'เงินเก็บที่หยิบใช้ได้', baht: savingsOf(profile), source: 'จากคำตอบข้อ 5' },
      healthPays ? { key: 'always', label: 'ประกันสุขภาพที่มีอยู่ จ่ายในเหตุการณ์นี้', baht: healthPays, source: 'จากคำตอบข้อ 6' } : null,
      hbPays ? { key: 'conditional', label: `ชดเชยรายวัน ${baht(hb.dailyBaht)}฿ × ${scen.nights} คืน`, baht: hbPays, source: 'จากคำตอบข้อ 6' } : null
    ].filter(Boolean);

    const have = raw.reduce((s, l) => s + l.baht, 0);
    const unknown = isUnknown(profile.liquidSavingsBaht) || healthUnknown || hbUnknown;
    const pct = needed > 0 ? clamp((have / needed) * 100, 0, 100) : 100;

    return {
      id: 2,
      title: 'ค่าใช้จ่ายตอนเจ็บป่วย',
      plain: `ฉากทัศน์ที่ใช้คำนวณ: ${scen.label} นอนโรงพยาบาล ${scen.nights} คืน`,
      neededBaht: needed, haveBaht: have, pct, unknown,
      status: statusOf(pct, unknown),
      layers: buildLayers(raw, needed),
      mode,
      overflow: have > needed,
      whatItDoesNotCover: mode === 'state'
        ? ['บัตรทองไม่ครอบคลุมค่าเดินทาง ค่าคนเฝ้าไข้ และรายได้ที่หายไประหว่างพักฟื้น',
           'ถ้าต้องการเลือกโรงพยาบาลหรือเวลาผ่าตัดเอง ตัวเลขจะกลับไปเป็นโหมดเอกชนทันที']
        : ['แพ็กเกจเหมาจ่ายมักไม่รวมค่าใช้จ่ายก่อนและหลังนอนโรงพยาบาล',
           'โรคที่เป็นอยู่ก่อนทำประกันมักไม่ได้รับความคุ้มครอง'],
      formula: mode === 'private'
        ? `เป้าหมาย = แพ็กเกจ ${baht(scen.privatePackageBaht)} + ค่าห้อง ${baht(CONFIG.hospitalRoomRefBaht)} × ${scen.nights} คืน = ${baht(needed)} บาท`
        : `เป้าหมาย = ค่าใช้จ่ายนอกใบเสร็จ ${baht(needed)} บาท (ค่ารักษาตามสิทธิบัตรทองนับใกล้ 0)`,
      basis: mode === 'private' ? CONFIG.sources.roomRate : CONFIG.sources.ucs
    };
  }

  function tube3(profile, horizon) {
    const E = profile.essentialExpenseE || 0;
    const months = horizon === 'to60'
      ? Math.max(0, (60 - (profile.age || 35)) * 12)
      : horizon;
    const needed = E * months;

    const m40 = m40Of(profile);
    const pa = profile.existing && profile.existing.pa;
    const paUnknown = !!(pa && pa.has && isUnknown(pa.amountBaht));
    const paAmount = pa && pa.has && !paUnknown ? pa.amountBaht : 0;

    const raw = [
      { key: 'savings', label: 'เงินเก็บที่หยิบใช้ได้', baht: savingsOf(profile), source: 'จากคำตอบข้อ 5' },
      m40 ? { key: 'state', label: `ม.40 ทุพพลภาพ ${baht(m40.disabilityMonthly)}฿ × ${Math.min(months, m40.disabilityMonths)} เดือน`, baht: m40.disabilityMonthly * Math.min(months, m40.disabilityMonths), source: CONFIG.sources.m40 } : null,
      paAmount ? { key: 'conditional', label: 'PA ที่มีอยู่ (จ่ายเฉพาะกรณีอุบัติเหตุ)', baht: paAmount, source: 'จากคำตอบข้อ 6' } : null
    ].filter(Boolean);

    const have = raw.reduce((s, l) => s + l.baht, 0);
    const unknown = isUnknown(profile.liquidSavingsBaht) || paUnknown;
    const pct = needed > 0 ? clamp((have / needed) * 100, 0, 100) : 0;

    return {
      id: 3,
      title: 'ถ้าทำงานไม่ได้ยาว',
      plain: 'กรณีเจ็บหนักหรือทุพพลภาพจนกลับไปทำงานเดิมไม่ได้',
      neededBaht: needed, haveBaht: have, pct, unknown,
      status: statusOf(pct, unknown),
      layers: buildLayers(raw, needed),
      horizon, months,
      monthsCovered: E > 0 ? have / E : 0,
      monthsTarget: months,
      overflow: have > needed,
      whatItDoesNotCover: [
        'PA จ่ายเฉพาะกรณีอุบัติเหตุ ไม่จ่ายกรณีเจ็บป่วยหรือโรคร้ายแรง',
        'ม.40 จ่ายเงินทดแทนทุพพลภาพสูงสุด 15 ปี ไม่ใช่ตลอดชีวิต'
      ],
      formula: `เป้าหมาย = ค่าใช้จ่ายจำเป็น ${baht(E)} × ${months} เดือน = ${baht(needed)} บาท`,
      basis: horizon === 'to60'
        ? `นับจากอายุ ${profile.age} ปี จนถึงอายุ 60 ปี`
        : `กรอบเวลาที่คุณเลือกเอง ${months} เดือน`
    };
  }

  /* กติกาแดงแถบเดียว: ถ้าหลายหลอดแดงพร้อมกัน ให้เหลือแดงเฉพาะ % ต่ำสุด */
  function applySingleRedBarRule(tubes) {
    const reds = tubes.filter(t => t.status === 'red');
    if (reds.length <= 1) return tubes;
    const lowest = reds.reduce((a, b) => (a.pct <= b.pct ? a : b));
    reds.forEach(t => { if (t !== lowest) t.status = 'watch'; });
    return tubes;
  }

  function computeAllTubes(profile, opts) {
    const scen = SCENARIOS[(opts && opts.scenario2) || 'appendicitis'];
    const mode = (opts && opts.mode2) || 'state';
    const horizon = (opts && opts.horizon3) || 12;
    const tubes = [tube1(profile, scen), tube2(profile, scen, mode), tube3(profile, horizon)];
    applySingleRedBarRule(tubes);
    /* ลำดับคงที่เสมอ: รายได้หยุด → ค่ารักษา → ทำงานไม่ได้ยาว
       ไม่เรียงตาม % เพื่อให้ตำแหน่งของแต่ละหลอดอยู่ที่เดิมทุกครั้งที่ค่าเปลี่ยน */
    return tubes;
  }

  /* -------------------------------------------------------------- catalogue
     ⚠ ข้อมูลชุดนี้เป็นค่าตัวอย่างสำหรับเดโม ไม่ใช่เบี้ยจริงของบริษัทใด
     ก่อนใช้งานจริงต้องแทนที่ด้วย catalogue.ts ที่ตรวจสอบแล้ว
  --------------------------------------------------------------------------- */

  const CATALOGUE = [
    {
      id: 'm40_t1', kind: 'state', name: 'ประกันสังคม มาตรา 40 — ทางเลือกที่ 1',
      insurer: 'สำนักงานประกันสังคม', premiumMonthly: 70, premiumMode: 'fixed',
      ageMin: 15, ageMax: 65, occupationClassMax: 4,
      covers: ['ชดเชยขาดรายได้เมื่อนอนโรงพยาบาล 300 บาท/วัน (สูงสุด 30 วัน/ปี)',
               'เงินทดแทนกรณีทุพพลภาพ 500–1,000 บาท/เดือน นานสูงสุด 15 ปี',
               'ค่าทำศพ 25,000 บาท'],
      exclusions: ['ไม่ใช่ประกันสุขภาพ ไม่จ่ายค่ารักษาพยาบาล (ใช้สิทธิบัตรทองควบคู่)',
                   'ชดเชยเฉพาะวันที่เป็นผู้ป่วยในหรือแพทย์สั่งหยุดงาน'],
      waitingNote: 'สิทธิเริ่มคุ้มครองเดือนถัดจากเดือนที่จ่ายเงินสมทบ',
      taxDeductibleMaxBaht: null, deductibleNote: null,
      verifiedDate: '2026-08-01', sourceUrl: 'https://www.sso.go.th',
      fills: (ctx) => ([
        { tubeId: 1, baht: 300 * 30, conditional: false },
        { tubeId: 3, baht: 500 * Math.min(ctx.tube3Months, 180), conditional: false }
      ])
    },
    {
      id: 'm40_t2', kind: 'state', name: 'ประกันสังคม มาตรา 40 — ทางเลือกที่ 2',
      insurer: 'สำนักงานประกันสังคม', premiumMonthly: 100, premiumMode: 'fixed',
      ageMin: 15, ageMax: 65, occupationClassMax: 4,
      covers: ['ทุกอย่างของทางเลือกที่ 1',
               'เพิ่มบำเหน็จชราภาพ สะสมคืนพร้อมผลตอบแทนเมื่ออายุ 60',
               'ค่าทำศพ 25,000 บาท'],
      exclusions: ['ไม่จ่ายค่ารักษาพยาบาล', 'บำเหน็จชราภาพถอนก่อนอายุ 60 ไม่ได้'],
      waitingNote: 'สิทธิเริ่มคุ้มครองเดือนถัดจากเดือนที่จ่ายเงินสมทบ',
      taxDeductibleMaxBaht: null, deductibleNote: null,
      verifiedDate: '2026-08-01', sourceUrl: 'https://www.sso.go.th',
      fills: (ctx) => ([
        { tubeId: 1, baht: 300 * 30, conditional: false },
        { tubeId: 3, baht: 500 * Math.min(ctx.tube3Months, 180), conditional: false }
      ])
    },
    {
      id: 'm40_t3', kind: 'state', name: 'ประกันสังคม มาตรา 40 — ทางเลือกที่ 3',
      insurer: 'สำนักงานประกันสังคม', premiumMonthly: 300, premiumMode: 'fixed',
      ageMin: 15, ageMax: 65, occupationClassMax: 4,
      covers: ['ชดเชยขาดรายได้ 300 บาท/วัน และเงินทดแทนทุพพลภาพ 500–1,000 บาท/เดือน',
               'ค่าทำศพ 50,000 บาท และบำเหน็จชราภาพอัตราสูงสุด',
               'เงินสงเคราะห์บุตร 200 บาท/เดือน/คน (อายุไม่เกิน 6 ปี สูงสุด 2 คน)'],
      exclusions: ['ไม่จ่ายค่ารักษาพยาบาล', 'เงินสงเคราะห์บุตรจ่ายเฉพาะบุตรอายุไม่เกิน 6 ปี'],
      waitingNote: 'สิทธิเริ่มคุ้มครองเดือนถัดจากเดือนที่จ่ายเงินสมทบ',
      taxDeductibleMaxBaht: null, deductibleNote: null,
      verifiedDate: '2026-08-01', sourceUrl: 'https://www.sso.go.th',
      fills: (ctx) => ([
        { tubeId: 1, baht: 300 * 30, conditional: false },
        { tubeId: 3, baht: 500 * Math.min(ctx.tube3Months, 180), conditional: false }
      ])
    },

    {
      id: 'hb500', kind: 'private', name: 'ชดเชยรายวัน 500 บาท/วัน',
      insurer: 'บริษัทประกันตัวอย่าง ก. (ข้อมูลเดโม)', premiumMonthly: 199, premiumMode: 'fixed',
      ageMin: 20, ageMax: 60, occupationClassMax: 3,
      covers: ['จ่ายเงินสด 500 บาท ทุกวันที่นอนโรงพยาบาล สูงสุด 365 วัน',
               'จ่ายเพิ่มเป็น 2 เท่าเมื่อเข้าห้อง ICU',
               'ได้เงินสดโดยตรง ใช้จ่ายอะไรก็ได้ ไม่ต้องยื่นใบเสร็จ'],
      exclusions: ['โรคที่เป็นอยู่ก่อนทำประกัน', 'การนอนโรงพยาบาลเพื่อพักผ่อนหรือตรวจสุขภาพ', 'การตั้งครรภ์และคลอดบุตร'],
      waitingNote: 'รอคอย 30 วันสำหรับการเจ็บป่วยทั่วไป · 120 วันสำหรับโรคที่กำหนด',
      taxDeductibleMaxBaht: 25000, deductibleNote: null,
      verifiedDate: '2026-09-01', sourceUrl: '#demo-data',
      fills: (ctx) => ([
        { tubeId: 1, baht: 500 * 30, conditional: false },
        { tubeId: 2, baht: 500 * ctx.scenario.nights, conditional: false }
      ])
    },
    {
      id: 'health200k', kind: 'private', name: 'สุขภาพเหมาจ่าย 200,000 บาท/ปี',
      insurer: 'บริษัทประกันตัวอย่าง ข. (ข้อมูลเดโม)', premiumMonthly: 392, premiumMode: 'fixed',
      ageMin: 20, ageMax: 65, occupationClassMax: 4,
      covers: ['ค่ารักษาผู้ป่วยในเหมาจ่ายตามจริง สูงสุด 200,000 บาท/ปี',
               'ค่าห้องผู้ป่วยปกติ 2,000 บาท/คืน',
               'ค่าผ่าตัดและค่าแพทย์รวมอยู่ในวงเงินเหมาจ่าย'],
      exclusions: ['โรคที่เป็นอยู่ก่อนทำประกัน', 'การรักษาเพื่อความงามและการลดน้ำหนัก', 'ผู้ป่วยนอก (OPD) ไม่รวมอยู่ในแผนนี้'],
      waitingNote: 'รอคอย 30 วันสำหรับการเจ็บป่วยทั่วไป · 120 วันสำหรับ 8 โรคที่กำหนด เช่น ไส้เลื่อน ต้อกระจก',
      taxDeductibleMaxBaht: 25000, deductibleNote: null,
      verifiedDate: '2026-09-01', sourceUrl: '#demo-data',
      fills: (ctx) => ([{ tubeId: 2, baht: Math.min(200000, ctx.tubeNeeded[2]), conditional: false }])
    },
    {
      id: 'health1m_ded', kind: 'private', name: 'สุขภาพเหมาจ่าย 1,000,000 บาท/ปี',
      insurer: 'บริษัทประกันตัวอย่าง ข. (ข้อมูลเดโม)', premiumMonthly: 690, premiumMode: 'fixed',
      ageMin: 20, ageMax: 65, occupationClassMax: 4,
      covers: ['ค่ารักษาผู้ป่วยในเหมาจ่าย สูงสุด 1,000,000 บาท/ปี',
               'ค่าห้องเดี่ยวมาตรฐานตามจริง',
               'คุ้มครองการรักษาแบบไม่ต้องนอนโรงพยาบาล (Day Case) 22 รายการ'],
      exclusions: ['โรคที่เป็นอยู่ก่อนทำประกัน', 'ต้องรับผิดส่วนแรกเองก่อนทุกครั้ง', 'การรักษาเพื่อความงาม'],
      waitingNote: 'รอคอย 30 วันสำหรับการเจ็บป่วยทั่วไป · 120 วันสำหรับโรคที่กำหนด',
      taxDeductibleMaxBaht: 25000, deductibleNote: 'มีความรับผิดส่วนแรก 30,000 บาท/ปี — เบี้ยถูกลงแลกกับการจ่ายเองส่วนแรก',
      verifiedDate: '2026-09-01', sourceUrl: '#demo-data',
      fills: (ctx) => ([{ tubeId: 2, baht: Math.max(0, ctx.tubeNeeded[2] - 30000), conditional: false }])
    },
    {
      id: 'pa500k', kind: 'private', name: 'อุบัติเหตุส่วนบุคคล (PA) 500,000 บาท',
      insurer: 'บริษัทประกันตัวอย่าง ค. (ข้อมูลเดโม)', premiumMonthly: 150, premiumMode: 'fixed',
      ageMin: 16, ageMax: 65, occupationClassMax: 3,
      covers: ['เสียชีวิตหรือทุพพลภาพถาวรจากอุบัติเหตุ 500,000 บาท',
               'ค่ารักษาพยาบาลจากอุบัติเหตุ 50,000 บาท/ครั้ง',
               'คุ้มครองการขับขี่และโดยสารรถจักรยานยนต์'],
      exclusions: ['ไม่จ่ายกรณีเจ็บป่วยหรือโรคร้ายแรง จ่ายเฉพาะอุบัติเหตุ',
                   'ไม่คุ้มครองขณะแข่งขันความเร็วหรือขณะมึนเมา',
                   'ไม่คุ้มครองการฆ่าตัวตายและการทำร้ายตัวเอง'],
      waitingNote: 'ไม่มีระยะเวลารอคอย คุ้มครองทันทีที่กรมธรรม์มีผล',
      taxDeductibleMaxBaht: null, deductibleNote: null,
      verifiedDate: '2026-09-01', sourceUrl: '#demo-data',
      fills: () => ([{ tubeId: 3, baht: 500000, conditional: true }])
    },
    {
      id: 'ci500k', kind: 'private', name: 'โรคร้ายแรง จ่ายก้อนเดียว 500,000 บาท',
      insurer: 'บริษัทประกันตัวอย่าง ง. (ข้อมูลเดโม)', premiumMonthly: 890, premiumMode: 'fixed',
      ageMin: 20, ageMax: 60, occupationClassMax: 4,
      covers: ['จ่ายเงินก้อน 500,000 บาท ทันทีที่ตรวจพบโรคร้ายแรงตามรายการ 36 โรค',
               'ใช้เงินก้อนนี้ทำอะไรก็ได้ รวมถึงใช้แทนรายได้ที่หายไป',
               'คุ้มครองต่อเนื่องถึงอายุ 85 ปี'],
      exclusions: ['อาการที่ปรากฏภายใน 90 วันแรกไม่ได้รับความคุ้มครอง',
                   'โรคที่เป็นอยู่ก่อนทำประกัน',
                   'จ่ายครั้งเดียวแล้วสัญญาสิ้นสุด'],
      waitingNote: 'รอคอย 90 วันสำหรับโรคร้ายแรงทุกรายการ',
      taxDeductibleMaxBaht: 25000, deductibleNote: null,
      verifiedDate: '2026-09-01', sourceUrl: '#demo-data',
      fills: () => ([{ tubeId: 3, baht: 500000, conditional: true }])
    },
    {
      id: 'hb_lux', kind: 'private', name: 'ชดเชยรายวัน ลักซ์ชัวรี่ (เบี้ยตามอายุ)',
      insurer: 'บริษัทประกันตัวอย่าง ก. (ข้อมูลเดโม)', premiumMonthly: null, premiumMode: 'by_age',
      ageMin: 20, ageMax: 60, occupationClassMax: 2,
      covers: ['ชดเชยรายวันสูงสุด 5,000 บาท/วัน'],
      exclusions: ['โรคที่เป็นอยู่ก่อนทำประกัน'],
      waitingNote: 'รอคอย 30 วัน',
      taxDeductibleMaxBaht: 25000, deductibleNote: null,
      verifiedDate: null, sourceUrl: '#demo-data',
      fills: () => ([{ tubeId: 1, baht: 5000 * 30, conditional: false }])
    }
  ];

  /* ------------------------------------------------------------ delta-engine */

  function rankRecommendations(profile, opts, tubes) {
    const scen = SCENARIOS[(opts && opts.scenario2) || 'appendicitis'];
    const budget = opts && typeof opts.budget === 'number' ? opts.budget : null;
    const tubeById = {}; tubes.forEach(t => { tubeById[t.id] = t; });
    const ctx = {
      scenario: scen,
      tube3Months: tubeById[3].months,
      tubeNeeded: { 1: tubeById[1].neededBaht, 2: tubeById[2].neededBaht, 3: tubeById[3].neededBaht }
    };

    const hasM40 = !!m40Of(profile);
    const filterAudit = [];
    const scored = [];

    for (const p of CATALOGUE) {
      /* กรองสิทธิรัฐที่ถืออยู่แล้ว */
      if (p.kind === 'state' && hasM40) {
        filterAudit.push({ id: p.id, name: p.name, reason: 'ตัดออก เพราะลูกค้าสมัคร ม.40 แล้ว' });
        continue;
      }
      if (profile.age != null && (profile.age < p.ageMin || profile.age > p.ageMax)) {
        filterAudit.push({ id: p.id, name: p.name, reason: `ตัดออก เพราะอายุ ${profile.age} ปี อยู่นอกช่วงรับประกัน ${p.ageMin}–${p.ageMax} ปี` });
        continue;
      }
      if (profile.occupationClass && profile.occupationClass > p.occupationClassMax) {
        filterAudit.push({ id: p.id, name: p.name, reason: `ตัดออก เพราะลักษณะงานอยู่ชั้นอาชีพ ${profile.occupationClass} ซึ่งเกินชั้นที่แผนนี้รับ` });
        continue;
      }
      if (p.premiumMode === 'by_age' || p.premiumMonthly == null) {
        filterAudit.push({ id: p.id, name: p.name, reason: 'ตัดออก เพราะยังไม่มีตารางเบี้ยจริงตามอายุ ระบบไม่เสนอสินค้าที่บอกราคาแน่นอนไม่ได้' });
        continue;
      }
      if (profile.healthFlags && profile.healthFlags.length && p.kind === 'private' && p.id !== 'pa500k') {
        /* ไม่ตัดออก แต่ติดธงให้โบรกเกอร์ตรวจก่อน */
      }

      const deltas = p.fills(ctx).map(d => {
        const t = tubeById[d.tubeId];
        const room = Math.max(0, t.neededBaht - t.haveBaht);
        const effective = Math.min(d.baht, room);
        return {
          tubeId: d.tubeId, tubeTitle: t.title,
          rawBaht: d.baht, baht: effective,
          pctPoints: t.neededBaht > 0 ? (effective / t.neededBaht) * 100 : 0,
          conditional: d.conditional
        };
      }).filter(d => d.baht > 0);

      if (!deltas.length) {
        filterAudit.push({ id: p.id, name: p.name, reason: 'ตัดออก เพราะหลอดที่แผนนี้เติมได้ เต็มอยู่แล้ว' });
        continue;
      }

      const totalPoints = deltas.reduce((s, d) => s + d.pctPoints, 0);
      const ceiling = budget == null ? null : budget * (1 + CONFIG.budget.tolerance);
      const overBudget = budget != null && p.premiumMonthly > budget;
      const wayOver = ceiling != null && p.premiumMonthly > ceiling;

      if (wayOver) {
        filterAudit.push({
          id: p.id, name: p.name,
          reason: `ตัดออก เพราะเบี้ย ${baht(p.premiumMonthly)} บาท เกินงบที่ลูกค้าบอกไว้เกิน 10% (เพดานที่ยังเสนอได้คือ ${baht(ceiling)} บาท)`
        });
        continue;
      }

      scored.push({
        product: p, deltas, totalPoints,
        efficiency: totalPoints / p.premiumMonthly,
        overBudget,
        overBudgetByBaht: overBudget ? p.premiumMonthly - budget : 0,
        reasonNote: `เติม ${deltas.map(d => `หลอด "${d.tubeTitle}" ${baht(d.baht)} บาท (+${d.pctPoints.toFixed(0)} จุด)`).join(' และ ')} ที่เบี้ย ${p.premiumMonthly} บาท/เดือน`
      });
    }

    /* ม.40 มาก่อนเสมอเมื่อยังไม่มี — เลือกทางเลือกที่คุ้มที่สุดในงบ */
    const stateOnes = scored.filter(s => s.product.kind === 'state');
    let statePick = null;
    if (stateOnes.length) {
      const inBudget = stateOnes.filter(s => !s.overBudget);
      statePick = (inBudget.length ? inBudget : stateOnes).sort((a, b) => b.totalPoints - a.totalPoints)[0];
      stateOnes.forEach(s => {
        if (s !== statePick) filterAudit.push({ id: s.product.id, name: s.product.name, reason: 'ไม่แสดงเป็นการ์ดหลัก เพราะเลือกทางเลือก ม.40 ที่คุ้มที่สุดในงบมาแสดงแทน (สลับได้บนการ์ด)' });
      });
    }

    /* มีงบ → เรียงตามความคุ้มค่าต่อเงินที่จ่าย · ไม่บอกงบ → เรียงจากถูกไปแพง */
    const privates = scored
      .filter(s => s.product.kind === 'private')
      .sort((a, b) => budget == null
        ? a.product.premiumMonthly - b.product.premiumMonthly
        : (a.overBudget - b.overBudget) || (b.efficiency - a.efficiency));

    privates.filter(s => s.overBudget).forEach(s => {
      filterAudit.push({ id: s.product.id, name: s.product.name, reason: `ยังเสนอ ทั้งที่เกินงบ ${baht(s.overBudgetByBaht)} บาท/เดือน เพราะอยู่ในช่วงผ่อนปรน 10% — แสดงพร้อมป้ายบอกส่วนต่างตรงๆ ไม่ซ่อนราคา` });
    });

    /* หลอดที่ไม่มีสินค้าเติมได้จริงในงบ */
    const honestNotes = [];
    tubes.forEach(t => {
      if (t.pct >= 100) return;
      const covered = privates.some(s => !s.overBudget && s.deltas.some(d => d.tubeId === t.id)) ||
        (statePick && statePick.deltas.some(d => d.tubeId === t.id));
      if (!covered) {
        honestNotes.push(`ในงบที่คุณบอกไว้ ยังไม่มีแผนไหนที่ปิดช่องว่าง "${t.title}" ได้จริง เราจึงไม่เสนอแผนมาให้เลือก แทนที่จะเสนอแผนที่ช่วยไม่ตรงจุด`);
      }
    });

    const order = [];
    if (statePick) order.push(statePick);
    privates.forEach(s => order.push(s));

    const incomeCeiling = profile.monthlyIncomeBaht
      ? profile.monthlyIncomeBaht * CONFIG.budget.incomeCeilingRatio : null;

    return {
      recommendations: order,
      primary: order.slice(0, statePick ? 3 : 2),
      more: order.slice(statePick ? 3 : 2),
      statePick, filterAudit, honestNotes, hasM40,
      allStateTiers: stateOnes,
      budget,
      budgetCeiling: budget == null ? null : budget * (1 + CONFIG.budget.tolerance),
      incomeCeiling,
      budgetAboveIncomeCeiling: budget != null && incomeCeiling != null && budget > incomeCeiling
    };
  }

  /* ผลของการติ๊กสินค้า: คืน pct ใหม่ของแต่ละหลอด (ใช้ทำ mini-preview ใน S5) */
  function previewWithSelection(tubes, ranking, selectedIds) {
    const add = { 1: 0, 2: 0, 3: 0 };
    ranking.recommendations.forEach(s => {
      if (selectedIds.indexOf(s.product.id) === -1) return;
      s.deltas.forEach(d => { add[d.tubeId] += d.baht; });
    });
    return tubes.map(t => {
      const have = t.haveBaht + add[t.id];
      const pct = t.neededBaht > 0 ? clamp((have / t.neededBaht) * 100, 0, 100) : t.pct;
      return { id: t.id, title: t.title, fromPct: t.pct, toPct: pct, addedBaht: add[t.id] };
    });
  }

  global.MC = {
    CONFIG, SCENARIOS, CATALOGUE,
    computeAllTubes, rankRecommendations, previewWithSelection,
    monthsTarget, m40Of, baht, clamp
  };
})(window);
