/***************
 * CONSTANTS
 ***************/
const R_TOP_M = 0.6;        // 최상부 발판 및 그 하단(2단) 제외 구간
const OFFSET_4FT_M = 1.2;   // 작업 대상까지 높이에서 4ft(1.2m) 제외
const BAN_WORK_H_M = 3.5;   // 사다리 작업 금지 기준(작업높이)
const HARNESS_H_M = 2.0;    // 안전대 착용 기준(작업높이)
const OUTER_LOGO_FILE_ID = '1FcLL9le3RTQUtQFSwqCqSPcYQK0RiJzp';
const LOGO_FILE_ID = '1t_zA_3qWoyMiW-Bu8iFAxKdJbQb_Dyl7';
const DIAGRAM_FILE_ID = '1LHE2gnbrHfxiiVM_UVAWSzsAWy8PaT3v';
const FALLBACK_LOGO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z8ZkAAAAASUVORK5CYII=';

/***************
 * WEB APP ENTRY
 ***************/
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const t = HtmlService.createTemplateFromFile('index_updated');

  const logo = getLogoData_();
  t.logoMime = logo.mime;
  t.logoBase64 = logo.base64;

  const outer = getLogoDataById_();
  t.outerLogoMime = outer.mime;
  t.outerLogoBase64 = outer.base64;

  const diagram = getDiagramData_();
  t.diagramMime = diagram.mime;
  t.diagramBase64 = diagram.base64;

  t.siteName = params.siteName || '';
  t.taskPlace = params.taskPlace || '';

  return t.evaluate()
    .setTitle('사다리 안전작업 계산기')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getLogoDataById_() {
  try {
    const blob = DriveApp.getFileById(OUTER_LOGO_FILE_ID).getBlob();
    return {
      mime: blob.getContentType() || 'image/png',
      base64: Utilities.base64Encode(blob.getBytes())
    };
  } catch (err) {
    return {
      mime: 'image/png',
      base64: FALLBACK_LOGO_BASE64
    };
  }
}

function getLogoData_() {
  try {
    const blob = DriveApp.getFileById(LOGO_FILE_ID).getBlob();
    return {
      mime: blob.getContentType() || 'image/png',
      base64: Utilities.base64Encode(blob.getBytes())
    };
  } catch (err) {
    return {
      mime: 'image/png',
      base64: FALLBACK_LOGO_BASE64
    };
  }
}

function getDiagramData_() {
  try {
    const blob = DriveApp.getFileById(DIAGRAM_FILE_ID).getBlob();
    return {
      mime: blob.getContentType() || 'image/png',
      base64: Utilities.base64Encode(blob.getBytes())
    };
  } catch (err) {
    return {
      mime: 'image/png',
      base64: FALLBACK_LOGO_BASE64
    };
  }
}

/***************
 * PREVIEW ONLY (NO SAVE)
 ***************/
function previewLadder(input) {
  return evaluateLadderInternal_(input);
}

/***************
 * CORE EVAL
 ***************/
function evaluateLadderInternal_(input) {
  const cleaned = sanitizeInput_(input);
  const T = cleaned.targetHeightM;

  const res = {
    ok: true,
    decision: { allowed: true, status: 'POSSIBLE', reason: '' },
    inputs: {
      siteName: cleaned.siteName,
      taskPlace: cleaned.taskPlace,
      workContent: cleaned.workContent,
      targetHeightM: T
    },
    derived: { workHeightM: null, minTopM: null },
    results: { minAllowedLadderM: null },
    ppe: { helmet: true, harness: false, message: '안전모 착용' },
    legal: [
      '작업 전 사다리 변형 및 파손 여부 점검',
      '최상부 발판 및 그 하단 발판 사용 금지',
      '최대허용하중 초과 금지',
      '2인 1조 작업 실시',
      '3점 지지 준수'
    ],
    ui: {
      severity: 'success',
      summary: '작업 가능'
    }
  };

  if (!isFinite(T) || T <= 0) {
    res.ok = false;
    res.decision = { allowed: false, status: 'ERROR', reason: '작업 대상까지의 높이는 0보다 큰 숫자여야 합니다.' };
    res.ui = {
      severity: 'error',
      summary: '입력값 오류',
      recommendation: '작업 대상 높이를 다시 확인하고 숫자로 입력해 주세요.'
    };
    return res;
  }

  const minTop = round2_(T - OFFSET_4FT_M);
  const H = round2_(minTop - R_TOP_M);

  res.derived.minTopM = minTop;
  res.derived.workHeightM = H;
  res.results.minAllowedLadderM = minTop;

  if (H < 0) {
    res.decision = {
      allowed: true,
      status: 'NO_LADDER',
      reason: '작업 높이가 0m 미만으로 산정되어 사다리가 필요하지 않습니다.'
    };
    res.ui = {
      severity: 'info',
      summary: '사다리 불필요'
    };
    res.results.minAllowedLadderM = '';
    res.legal = [
      '개인보호구 착용',
      '작업구역 환경 점검(바닥상태, 통로 및 장애물)',
      '작업구역과 보행자 동선 분리',
      '올바른 중량물 취급 및 작업자세 준수'
    ];
    res.ppe.message = '안전모/안전대 착용';
    return res;
  }

  if (H >= BAN_WORK_H_M) {
    res.decision = {
      allowed: false,
      status: 'IMPOSSIBLE'
    };
    res.ui = {
      severity: 'danger',
      summary: '사다리 작업 금지: 고소작업대/전문업체 활용'
    };
    res.results.minAllowedLadderM = '';
    res.ppe.harness = true;
    res.ppe.message = '안전모 / 안전대 착용';
    res.legal = [
      '보호구 착용 철저',
      '작업계획 수립 및 검토',
      '추락방지장치 및 안전장치 작동 확인',
      '안전난간 설치 가능 여부 확인',
      '작업구역 구획 및 통제, 유도자 배치 확인'
    ];
    return res;
  }

  if (H >= HARNESS_H_M) {
    res.ppe.harness = true;
    res.ppe.message = '안전모 / 안전대 착용';
  }

  return res;
}

function sanitizeInput_(input) {
  const raw = input || {};

  return {
    siteName: String(raw.siteName || '').trim().slice(0, 80),
    taskPlace: String(raw.taskPlace || '').trim().slice(0, 80),
    workContent: String(raw.workContent || '').trim().slice(0, 120),
    targetHeightM: Number(raw.targetHeightM)
  };
}

function round2_(x) {
  return Number((Math.round(x * 100) / 100).toFixed(2));
}
