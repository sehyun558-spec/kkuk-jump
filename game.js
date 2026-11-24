// =====================================================================
//  이 파일이 하는 일: 게임 규칙(점프·착지·점수) + 화면 그리기 + 터치 처리
//  숫자를 바꾸고 싶으면 이 파일 말고 settings.js를 고치세요.
// =====================================================================
(() => {
const SET = SETTINGS;
// ---------- 테스트 모드인지 (주소 끝 ?test=숫자) — 시험용 테마를 보일지 정하려고 맨 먼저 확인 ----------
const TEST = (() => {
  const v = Number(new URLSearchParams(location.search).get('test'));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
})();

// ---------- 테마: 화면에 보이는 것 전부 ----------
// base: '꿈' 이 있는 테마는 꿈 테마를 바탕으로 적은 것만 바꿈. testOnly 테마는 테스트 모드에서만
function mergeDeep(a, b){
  const out = Array.isArray(a) ? a.slice() : Object.assign({}, a);
  for (const k in b){
    const v = b[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && a && typeof a[k] === 'object' && !Array.isArray(a[k]) ? mergeDeep(a[k], v) : v;
  }
  return out;
}
const THEMES = SET.themes
  .map(t => t.base ? mergeDeep(SET.themes.find(x => x.name === t.base) || {}, t) : t)
  .filter(t => !t.testOnly || TEST);
const findTheme = name => THEMES.find(t => t.name === name);
// 가진 테마 목록 (저장됨). 가격 0인 테마는 처음부터 가진 것
let ownedThemes = (() => { try { const a = JSON.parse(Store.get('kkuk_themes') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } })();
const ownsTheme = t => !(t.price > 0) || ownedThemes.includes(t.name);
// 지금 테마에서 꺼내 쓰는 묶음들 (테마를 바꾸면 bindTheme이 다시 채움)
let TH, CU, EF, UI, SKY, PL, DU, SDC, FONT_EN = '', FONT_KO = '';
const J = SET.jump, P = SET.pillar, R = SET.rest, WU = SET.warmup, JD = SET.judge, FX = SET.effects, F = SET.feel;

const stage = document.getElementById('stage');
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const SYS_FONT = '-apple-system,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
function bindTheme(t){
  TH = t; CU = t.cube; EF = t.effects; UI = t.ui; SKY = t.sky; PL = t.pillar; DU = t.dust; SDC = t.stardust;
  // ---------- 글꼴 ----------
  // 영어·숫자 = UI.fontEn (Quicksand), 한글 = UI.fontKo (Pretendard). 못 받아 오면 폰 기본 글꼴로 보임
  FONT_EN = UI.fontEn ? '"' + UI.fontEn + '",' : '';
  FONT_KO = UI.fontKo ? '"' + UI.fontKo + '",' : '';
  if (document.fonts && document.fonts.load){ // 화면에 쓰기 전에 미리 받아 둠 (필요한 굵기만)
    if (UI.fontEn) [UI.weight, UI.weightBig].forEach(w => document.fonts.load(w + ' 40px "' + UI.fontEn + '"', 'BEST 0123456789').catch(() => {}));
    if (UI.fontKo) [UI.koWeight, UI.koWeightStrong].forEach(w => document.fonts.load(w + ' 40px "' + UI.fontKo + '"', '꾹점프탭해서다시하기테마').catch(() => {}));
  }
}
{ // 처음 테마: 테마 칸에서 골라 저장해 둔 것 → 없거나 못 쓰면 useTheme → 목록 첫 번째
  const saved = findTheme(Store.get('kkuk_theme'));
  bindTheme(saved && ownsTheme(saved) ? saved : (findTheme(SET.useTheme) || THEMES[0]));
}
const T = SET.texts;                                   // 화면에 나오는 말 (settings.js의 texts)
const fmt = (tpl, n) => String(tpl).replace('{n}', n); // {n} 자리에 숫자 넣기
const now = () => performance.now();

// 게임 속 위치·크기는 모두 "기준 크기(S)" 단위로 계산하고, 그릴 때만 픽셀로 바꿉니다.
// 그래서 게임 중 폰을 돌려 화면 크기가 바뀌어도 네모와 기둥이 함께 맞춰집니다 (B2).

// ---------- 색 (밝은/어두운 화면) ----------
let darkMode = false;
let bgSnap = true;      // 다크 모드가 바뀌면 배경색을 바로 맞춤 (천천히 넘어가지 않고)
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function pickColors(){
  const t = document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && darkQuery.matches);
  darkMode = dark;
  paintVignette();     // 가장자리 막 색도
  // 버튼·창 글자 색 (style.css의 --text 등을 덮어씀). 바탕(--bg)은 하늘 색을 따라감
  const st = document.documentElement.style;
  const u = dark ? UI.dark : UI.light; // 버튼·창 색 (테마의 ui)
  for (const k of ['text', 'soft', 'pill', 'glass', 'scrim', 'useBg', 'useText']) st.setProperty('--' + k, u[k]);
  st.setProperty('--font', FONT_EN + FONT_KO + SYS_FONT); // 버튼·창 글자도 같은 글꼴
  bgSnap = true; // 하늘을 새 모드 색으로 바로 맞춤
}
pickColors();

// ---------- 하늘 (배경 그라데이션 테마) ----------
// 위에서 아래로 두 파스텔 색이 섞인 하늘. 점수가 오르면 다음 테마로 아주 천천히 넘어감
let skyTop = null, skyBot = null;    // 지금 하늘의 위·아래 색 [빨,초,파]
let bgReturn = false;                // 다시 시작해서 첫 테마로 돌아가는 중인지
let bgCss = '', bgLastCss = '';
let skyGrad = null, skyGradKey = ''; // 그라데이션은 색이 바뀔 때만 새로 만듦 (가볍게)
const hexRgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
const rgbStr = c => 'rgb(' + c.map(Math.round).join(',') + ')';
// 지금 점수에 맞는 테마: every점마다 다음 테마, 마지막 다음엔 처음부터 다시
function skyTheme(){
  const list = darkMode ? SKY.dark : SKY.light;
  const n = SKY.every > 0 ? Math.floor(Math.max(0, score) / SKY.every) : 0;
  return list[n % list.length];
}
function updateBg(dt){
  const th = skyTheme(), tTop = hexRgb(th.top), tBot = hexRgb(th.bottom);
  if (!skyTop || bgSnap){ skyTop = tTop.slice(); skyBot = tBot.slice(); bgSnap = false; }
  else {
    const time = bgReturn ? SKY.resetTime : SKY.fadeTime;
    const k = Math.min(1, dt * 3 / Math.max(0.05, time)); // time초쯤이면 거의 다 넘어감
    let far = 0;
    for (let i = 0; i < 3; i++){
      skyTop[i] += (tTop[i] - skyTop[i]) * k; skyBot[i] += (tBot[i] - skyBot[i]) * k;
      far = Math.max(far, Math.abs(tTop[i] - skyTop[i]), Math.abs(tBot[i] - skyBot[i]));
    }
    if (far < 1) bgReturn = false;
  }
  const mid = [0, 1, 2].map(i => (skyTop[i] + skyBot[i]) / 2);
  bgCss = rgbStr(mid);                                             // 버튼·창 바탕용 (가운데 색)
  const key = rgbStr(skyTop) + rgbStr(skyBot) + H;
  if (key !== skyGradKey){
    skyGradKey = key;
    skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, rgbStr(skyTop));
    skyGrad.addColorStop(1, rgbStr(skyBot));
  }
  if (bgCss !== bgLastCss){ // 색이 바뀔 때만 화면 바깥 바탕·버튼·창 바탕도 바꿈
    bgLastCss = bgCss;
    document.body.style.background = (TH.night || TH.cosmos) // 넓은 화면에서 게임 칸 바깥 바탕 (밤바다·우주는 아래가 어둡게)
      ? 'linear-gradient(' + rgbStr(skyTop) + ',' + rgbStr(skyBot) + ' 62%,' + (TH.night || TH.cosmos).fogColor + ' 85%) fixed'
      : 'linear-gradient(' + rgbStr(skyTop) + ',' + rgbStr(skyBot) + ') fixed';
    document.documentElement.style.setProperty('--bg', bgCss);
  }
}
darkQuery.addEventListener?.('change', pickColors);
new MutationObserver(pickColors).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});

// ---------- 화면 크기 ----------
let W, H, S, GY;
const sidewaysQuery = matchMedia('(orientation: landscape) and (pointer: coarse)');
const isSideways = () => sidewaysQuery.matches; // 폰·태블릿을 가로로 눕혔나
function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // 넓은 컴퓨터 화면에서는 가운데에 폰 너비만큼만 (폰과 같은 느낌)
  W = Math.round(Math.min(innerWidth, innerHeight * SET.screen.maxWidthRatio));
  H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  S = Math.min(W, H * 0.62, SET.screen.maxSize);  // 기준 크기 (픽셀)
  GY = H * SET.screen.groundY;                     // 기둥 윗면 높이 (픽셀)
  if (camFocus !== undefined) camX = camGoal();    // 화면이 바뀌면 카메라 바로 맞춤
  if (isSideways()) cancelCharge();
}
addEventListener('resize', () => { resize(); makeDust(); }); // 화면 크기가 바뀌면 빛 먼지도 다시 뿌림

// ---------- 저장된 기록 ----------
// 이상한 값(숫자가 아닌 값)이 저장돼 있으면 0부터 다시 (B12)
function readNumber(key){
  const v = Number(Store.get(key));
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}
let best  = readNumber('kkuk_best');   // 최고 기록

// ---------- 테스트 모드 ----------
// 주소 끝에 ?test=9 처럼 붙이면: 매 판 9점에서 시작하고, 최고 기록도 9점인 것처럼 동작
//   예) ?test=14 → 15점에서 하늘이 다음 테마로 넘어가는 걸 바로 볼 수 있음
// 테스트 중에는 기록·플레이 횟수를 저장하지 않아서 진짜 기록은 그대로입니다.
if (TEST){
  best = TEST;
  const ver = document.getElementById('ver');
  ver.textContent += ' · 테스트 ' + TEST + '점';
  ver.classList.add('show'); // 버전 표시는 테스트 모드일 때만 보임
}
const save = (key, value) => { if (!TEST) Store.set(key, value); }; // 테스트 중엔 저장 안 함
let plays = readNumber('kkuk_plays');  // 플레이 횟수 (한 판 = 1)

// ---------- 별가루 지갑: 별가루를 더하고 빼는 곳은 여기 한 곳뿐 ----------
// 얻거나 쓰는 즉시 저장 (게임 중에 앱을 꺼도 안 사라짐). 테스트 모드에선 저장 안 하고 임시 개수로 시작.
// 나중에 광고 보상이나 결제로 줄 때도 Wallet.add(개수), 쓸 때는 Wallet.spend(개수)만 부르면 됩니다.
// (지금은 광고·결제 없음)
const SD = SET.stardust;
let stardust = TEST ? SD.testStart : readNumber('kkuk_stardust');
const Wallet = {
  get: () => stardust,
  add(n){
    n = Math.max(0, Math.floor(n)); if (!n) return stardust;
    stardust += n; save('kkuk_stardust', stardust); return stardust;
  },
  spend(n){ // 모자라면 쓰지 않고 false
    n = Math.max(0, Math.floor(n));
    if (stardust < n) return false;
    stardust -= n; save('kkuk_stardust', stardust); return true;
  },
};

// (예전 스킨 기능은 없앴습니다. 폰에 저장된 예전 스킨 선택 값은 읽지 않고 그냥 무시합니다.)

// ---------- 게임 상태 ----------
// state: 'ready'(첫 화면) / 'idle'(기둥 위 대기) / 'charge'(힘 모으는 중) / 'fly'(점프 중) / 'fall'(떨어지는 중) / 'over'(게임 오버)
let state, pillars, cur, player, camX, camFocus, score, combo, charge, jump;
let shake = 0, parts = [], pops = [], rings = [];
let trail = [];          // 점프할 때 따라오는 잔상 (구름 조각)
let cubeFlash = 0;       // "완벽!" 때 네모가 환해지는 정도 (1 → 0)
let chargeGlow = 0;      // 꾹 누를 때 둘레 빛이 밝아지는 정도 (0 → 1)
// (꺼 둔 기능) 새 것을 얻었을 때의 연출용 — 지금은 쓰이지 않음
let gotThisGame = [];    // 이번 판에 새로 얻은 것들 (게임 오버 뒤 공개 화면에서 차례로 보여 줌)
let flash = null;        // 화면 테두리 반짝임 {color, t}
let slowT = Infinity;    // 살짝 느려진 뒤 지난 시간 (Infinity = 느려지는 중 아님)
const UF = SET.unlockFx;
let overAt = 0, fallAt = 0, newBest = false, startBest = 0, passedBest = false;
let wideIn = 0;          // 넓은 기둥까지 남은 기둥 수
let made = 0;            // 이번 판에 만든 기둥 수 (처음 몇 개는 쉽게)
let chargeFrom = 'idle'; // 힘 모으기를 취소하면 돌아갈 상태
let firstGame = true;    // 첫 점프 전에만 설명 화면

const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const camGoal = () => camFocus - (W / S) * SET.screen.playerAt;

// 새 기둥 만들기: 처음 몇 개는 쉽게 → 점수가 오를수록 좁고 멀어짐 + 가끔 넓은 기둥
function newPillar(prevRight){
  made++;
  if (made <= WU.pillars){
    // 처음 구간: 넓고, 너비와 거리가 고른 기둥
    const w = WU.width * (1 - WU.widthRandom + Math.random() * 2 * WU.widthRandom);
    return {x: prevRight + WU.gapMin + Math.random() * WU.gapRandom, w, wide: false};
  }
  const lv = Math.min(score / P.hardestScore, 1); // 0(쉬움) ~ 1(가장 어려움)
  let w, wide = false;
  if (score >= R.fromScore && --wideIn <= 0){
    w = R.width; wide = true;
    wideIn = randInt(R.everyMin, R.everyMax);
  } else {
    const base = P.startWidth + (P.endWidth - P.startWidth) * lv;
    w = Math.max(base * (1 - P.widthRandom + Math.random() * 2 * P.widthRandom), P.minWidth);
  }
  const gap = P.gapMin + Math.random() * (P.gapRandomStart + (P.gapRandomEnd - P.gapRandomStart) * lv);
  return {x: prevRight + gap, w, wide};
}
function fillAhead(){
  while (pillars.length - 1 - cur < P.ahead){
    const l = pillars[pillars.length - 1];
    pillars.push(newPillar(l.x + l.w));
  }
}

function reset(){
  score = TEST; combo = 0; cur = 0; charge = 0; // 보통은 0점에서 시작 (테스트 모드면 그 점수에서)
  newBest = false; passedBest = false; startBest = best;
  parts = []; pops = []; rings = []; trail = []; cubeFlash = 0;
  gotThisGame = []; flash = null; slowT = Infinity;
  resetStardustFx();
  wideIn = randInt(R.everyMin, R.everyMax);
  bgReturn = true; // 하늘을 첫 테마로 (resetTime초에 걸쳐)
  made = 0;
  pillars = [{x: 0, w: P.firstWidth}];
  fillAhead();
  player = {x: P.firstWidth / 2, y: 0, vy: 0, sq: 1, rot: 0, dir: 1};
  camFocus = player.x; camX = camGoal();
  state = firstGame ? 'ready' : 'idle';
}

// ---------- 효과 ----------
// 튀는 조각: 한 번에 maxBurst개까지만 (B8, 버벅임 방지)
// cols: 색 목록 (흰색·기둥 색 등을 섞어 씀). 작고 둥글고 부드럽게
function burst(x, cols, n){
  n = Math.min(n, FX.maxBurst);
  for (let i = 0; i < n; i++){
    const a = -Math.PI * Math.random(), v = 0.4 + Math.random() * 1.1;
    const col = cols[i % cols.length];
    parts.push({x, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      s: (0.006 + Math.random() * 0.01) * EF.sparkSize, life: 1, col});
  }
}
// 떠오르는 글자 (y는 기둥 윗면에서 위로 얼마나, 기준 크기 단위)
// big = 큰 글자, faint = 흐리고 작게 아래로 사라짐 (지금은 쓰는 곳 없음)
function pop(text, x, y, big, faint = false){ pops.push({text, x, y, big, faint, life: 1}); }

// ---------- 입력 ----------
function press(){
  Sound.wake(); // 아이폰 소리 깨우기 (B10)
  if (isSideways()) return;
  if (state === 'ready' || state === 'idle'){ chargeFrom = state; state = 'charge'; charge = 0; }
  else if (state === 'over' && now() - overAt > SET.time.restartLock * 1000){ reset(); }
}
function release(){
  if (state !== 'charge') return;
  const d = charge;
  jump = {x0: player.x, d, t: 0, T: J.timeBase + Math.min(d, 1.1) * J.timePerDist, h: J.heightBase + d * J.heightPerDist};
  state = 'fly'; firstGame = false;
  player.sq = F.releaseStretch; // 떼는 순간 "통" 늘어남
  Sound.tone(420 + d * 260, 0.07, 'triangle', 0.06);
}
// 힘 모으기 취소 (점프 안 함): 전화가 오거나 앱을 바꿀 때 (B4)
let activeId = null; // 처음 누른 손가락 번호
function cancelCharge(){
  if (state === 'charge'){ state = chargeFrom; charge = 0; }
  activeId = null;
}

// 게임 화면 칸에서만 게임 조작 (버튼은 이 칸 밖이라 눌러도 점프 안 됨, B9)
stage.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (themeOpen) return;                                   // 테마 칸이 열려 있으면 점프 안 됨
  if (e.pointerType === 'mouse' && e.button !== 0) return; // 마우스 왼쪽 버튼만
  if (state === 'charge' && activeId !== null) return;    // 누르는 중에 다른 손가락은 무시 (B3)
  activeId = e.pointerId;
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  press();
});
stage.addEventListener('pointerup', e => {
  if (e.pointerId !== activeId) return; // 처음 누른 손가락을 뗄 때만 점프 (B3)
  activeId = null;
  release();
});
stage.addEventListener('pointercancel', e => { if (e.pointerId === activeId) cancelCharge(); });
stage.addEventListener('lostpointercapture', e => { if (e.pointerId === activeId) cancelCharge(); });
stage.addEventListener('touchstart', e => e.preventDefault(), {passive: false}); // 확대·길게 누르기 메뉴 막기
addEventListener('contextmenu', e => e.preventDefault());

// 컴퓨터: 스페이스바로도 조작
addEventListener('keydown', e => {
  if (themeOpen){ // 테마 칸이 열려 있으면: Esc로 닫기, 스페이스바는 무시
    if (e.code === 'Escape') closeThemes();
    if (e.code === 'Space') e.preventDefault();
    return;
  }
  if (revealUp()){ // 공개 화면: 스페이스바·엔터로 공개, 게임 조작은 막음
    if (e.code === 'Space' || e.code === 'Enter'){ e.preventDefault(); if (!e.repeat) openReveal(); }
    return;
  }
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (!e.repeat) press();
});
addEventListener('keyup', e => { if (e.code === 'Space' && !revealUp() && !themeOpen) release(); });

// 앱을 바꾸거나 화면이 꺼지면 힘 모으기 취소, 돌아오면 소리 깨우기
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelCharge(); else Sound.wake();
});
addEventListener('blur', cancelCharge);

// ---------- 점수 ----------
function addScore(gain){
  const before = score;
  score += gain;
  // 별가루: 점수가 every의 배수(5, 10, 15…)를 넘을 때마다 1개 (한 번에 여러 배수를 넘으면 넘은 만큼)
  if (SD.every > 0){
    const k = Math.floor(score / SD.every) - Math.floor(before / SD.every);
    if (k > 0) gainStardust(k);
  }
  if (score > best){
    // 게임 중 기록을 넘는 순간 "신기록!" (첫 기록일 땐 안 띄움)
    if (startBest > 0 && !passedBest){
      pop(T.newBestLive, player.x, -F.playerSize * 4.5, true);
      Sound.tone(784, 0.18, 'triangle', 0.08);
    }
    passedBest = true;
    best = score;
    save('kkuk_best', best); // 넘는 순간마다 바로 저장 (B11)
  }
}
// ---------- (꺼 둔 기능) 새 것을 얻었을 때: 게임 중 짧은 신호 ----------
// 지금은 아무 데서도 부르지 않습니다. 나중에 테마를 점수로 열 때, addScore 안에서
//   unlockSignal({name: '바다 테마', color: '#9FD3F2', grade: 1})
// 처럼 부르면: 화면 테두리 반짝임 + 살짝 느려짐 + 진동·효과음, 그리고 게임 오버 뒤 공개 화면이 나옵니다.
// (color = 반짝임·공개 화면 색, grade 2 = 화려하게, shine: true = 빛줄기, onUse = "바로 쓰기"를 눌렀을 때 할 일)
function unlockSignal(item){
  gotThisGame.push(item);
  flash = {color: item.color, t: 0};  // 화면 테두리가 그 색으로 반짝
  slowT = 0;                          // 게임이 살짝 느려졌다 돌아옴
  Sound.buzz(UF.buzz);
  Sound.chime(item.grade || 1);
}
// "○점만 더!": 기록을 깨려면 몇 점 더 필요한지 (동점이 아니라 넘어야 함)
function needText(){
  if (startBest < SET.alert.minBest) return '';
  const need = startBest - score + 1;
  return need >= 1 && need <= SET.alert.within ? fmt(T.need, need) : '';
}

// ---------- 착지 판정 ----------
// 기둥 위에 있나? (몰래 봐주기: 끝에서 edgeForgive만큼 벗어나도 위에 있는 걸로 침)
const onPillar = (px, p) => px >= p.x - JD.edgeForgive && px <= p.x + p.w + JD.edgeForgive;

function land(){
  let px = player.x;
  const c = pillars[cur];
  // 거의 안 뛰어서 지금 기둥 위에 그대로
  if (onPillar(px, c)){
    player.x = Math.min(Math.max(px, c.x), c.x + c.w);
    state = 'idle'; player.sq = 0.8; Sound.tone(260, 0.05, 'sine', 0.05); return;
  }

  // 앞 기둥 중 어디에 내렸나 (다음 기둥을 넘어 그 뒤 기둥에 내려도 찾음, B1)
  let j = -1;
  for (let i = cur + 1; i < pillars.length; i++){
    if (onPillar(px, pillars[i])){ j = i; break; }
  }

  if (j > 0){
    const n = pillars[j];
    // 봐준 착지면 네모를 기둥 끝으로 살짝 당김
    px = player.x = Math.min(Math.max(px, n.x), n.x + n.w);
    const center = n.x + n.w / 2, dist = Math.abs(px - center);
    let gain = 1;
    if (j === cur + 1 && dist <= JD.perfectLine / 2 + JD.perfectMargin){
      // 완벽! — 콤보가 쌓일수록 점수·음·흔들림·조각이 커짐
      combo++; gain = 1 + Math.min(combo, JD.maxBonus);
      if (SD.perfectBonus > 0 && combo === SD.perfectBonusAt) gainStardust(SD.perfectBonus); // PERFECT 연속 보너스
      player.x = center;
      burst(center, [EF.sparkColor, pillarColor(n)], FX.burstBase + combo * FX.burstPerCombo); // 흰색 + 그 기둥 색
      rings.push({x: center, r: F.playerSize * 0.6, life: 1});
      cubeFlash = 1; // 네모가 한 번 살짝 환하게 빛남
      shake = FX.shakePerfect + Math.min(combo, FX.shakeComboMax) * FX.shakePerCombo;
      Sound.buzz(18);
      Sound.tone(Sound.note(combo), 0.2, 'triangle', 0.12);
      pop(combo > 1 ? fmt(T.perfectCombo, combo) : T.perfect, center, -F.playerSize * 3.3, true);
    } else {
      // 보통 착지 (기둥을 건너뛴 착지도 1점, 콤보는 끊김)
      combo = 0;
      burst(px, ['rgba(255,255,255,0.85)'], 6);
      Sound.tone(330, 0.07, 'sine', 0.07); Sound.buzz(8);
    }
    addScore(gain);
    if (gain > 1) pop('+' + gain, player.x, -F.playerSize * 2.2, false); // 점수 표시는 PERFECT 때만
    cur = j;
    fillAhead();
    while (cur > 3){ pillars.shift(); cur--; } // 지나간 기둥 정리
    camFocus = pillars[cur].x + pillars[cur].w / 2;
    state = 'idle'; player.sq = 0.6;
    return;
  }

  // 실패: 가장 가까운 기둥 쪽으로 떨어지는 방향 정하기
  let near = Infinity, np = pillars[cur + 1];
  for (let i = cur + 1; i < pillars.length; i++){
    const p = pillars[i];
    const d = Math.min(Math.abs(px - p.x), Math.abs(px - (p.x + p.w)));
    if (d < near){ near = d; np = p; }
  }
  player.dir = px < np.x ? -1 : 1;
  player.vy = 0; state = 'fall'; fallAt = now();
  shake = FX.shakeFail; Sound.buzz([30, 40, 70]);
  Sound.tone(150, 0.35, 'sawtooth', 0.06);
}
function gameOver(){
  state = 'over'; overAt = now();
  plays++; save('kkuk_plays', plays);
  // "최고 기록 달성!"은 기록을 넘었고, 점수가 newBestMin 이상일 때만 (기록 저장은 항상 됨)
  newBest = score > startBest && score >= SET.alert.newBestMin;
  if (newBest) Sound.tone(784, 0.25, 'triangle', 0.1);
  if (gotThisGame.length) startReveal(gotThisGame.slice()); // (꺼 둔 기능) 새로 얻은 게 있으면 공개 화면 먼저
}

// ---------- (꺼 둔 기능) 새 것 공개 화면 ----------
// unlockSignal로 얻은 것이 있을 때만 게임 오버 뒤에 뜹니다. 지금은 쓰이지 않음.
const RV = SET.reveal;
const revealEl = document.getElementById('reveal');
const rvBox = revealEl.querySelector('.box'), rvBig = revealEl.querySelector('.big');
const rvGlow = revealEl.querySelector('.glow'), rvFlash = revealEl.querySelector('.flash');
const rvName = revealEl.querySelector('.name'), rvHint = revealEl.querySelector('.hint');
const rvActions = revealEl.querySelector('.actions');
let rvQueue = [], rvItem = null, rvOpened = false;
const revealUp = () => !revealEl.hidden;

function startReveal(list){
  rvQueue = list;
  revealEl.style.setProperty('--size', RV.size + 'px');
  revealEl.hidden = false;
  revealEl.animate([{opacity: 0}, {opacity: 1}], {duration: 220, easing: 'ease-out'});
  nextReveal();
}
// 다음 스킨 보여 주기 (2개를 얻었으면 하나씩 차례로). 다 보면 점수 화면으로
function nextReveal(){
  rvItem = rvQueue.shift() || null;
  if (!rvItem){ revealEl.hidden = true; return; }
  rvOpened = false;
  rvBig.style.background = darkMode ? RV.silhouetteDark : RV.silhouetteLight; // 회색 실루엣
  rvBig.querySelector('b').style.display = 'none';
  rvName.innerHTML = '&nbsp;';
  rvHint.hidden = false; rvActions.hidden = true;
  rvBox.animate([{transform: 'scale(.85)', opacity: 0}, {transform: 'scale(1)', opacity: 1}],
    {duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)'});
}
// 탭하면 번쩍 하면서 진짜 색 공개
function openReveal(){
  if (!rvItem || rvOpened) return;
  rvOpened = true;
  const col = {body: rvItem.color, shine: rvItem.shine}, grade = rvItem.grade || 1;
  rvBig.style.background = col.body;
  rvBig.querySelector('b').style.display = col.shine ? 'block' : 'none';
  rvFlash.animate([{opacity: 0.95}, {opacity: 0}], {duration: RV.flashTime * 1000, easing: 'ease-out'});
  rvBox.animate([{transform: 'scale(1.14)'}, {transform: 'scale(1)'}], {duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)'});
  // 빛이 퍼짐: 등급 1은 은은하게, 등급 2는 크고 진하게
  const big2 = grade >= 2;
  rvGlow.style.background = 'radial-gradient(circle, ' + col.body + ' 0%, transparent 68%)';
  rvGlow.animate([
    {transform: 'scale(.6)', opacity: big2 ? RV.glow2Alpha : RV.glow1Alpha},
    {transform: 'scale(' + (big2 ? RV.glow2 : RV.glow1) + ')', opacity: 0},
  ], {duration: RV.glowTime * 1000, easing: 'ease-out'});
  if (big2) burstPieces(col.body);
  rvName.textContent = rvItem.name;
  rvHint.hidden = true; rvActions.hidden = false;
  Sound.fanfare(grade);
  Sound.buzz(big2 ? [30, 40, 30, 40, 80] : [30, 50, 40]);
}
// 등급 2: 작은 네모 조각들이 사방으로 튀었다가 사라짐
function burstPieces(color){
  for (let i = 0; i < RV.pieces; i++){
    const el = document.createElement('span');
    el.className = 'piece'; el.style.background = color;
    rvBox.appendChild(el);
    const a = (i / RV.pieces) * Math.PI * 2 + Math.random() * 0.4;
    const d = RV.pieceDist * (0.55 + Math.random() * 0.45);
    const x = Math.cos(a) * d, y = Math.sin(a) * d, r = (Math.random() - 0.5) * 360;
    el.animate([
      {transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1},
      {transform: 'translate(' + x + 'px,' + y + 'px) rotate(' + r + 'deg) scale(.4)', opacity: 0},
    ], {duration: RV.pieceTime * 1000 * (0.7 + Math.random() * 0.3), easing: 'cubic-bezier(.15,.7,.3,1)'})
      .onfinish = () => el.remove();
  }
}
// 화면 아무 데나 탭: 공개 / 버튼: 바로 쓰기·닫기
revealEl.addEventListener('click', () => openReveal());
revealEl.querySelector('.use').addEventListener('click', e => {
  e.stopPropagation();
  if (rvItem.onUse) rvItem.onUse(); // "바로 쓰기": 얻은 것을 바로 적용
  nextReveal();
});
revealEl.querySelector('.skip').addEventListener('click', e => { e.stopPropagation(); nextReveal(); });

// ---------- 움직임 계산 (1초에 60번쯤) ----------
function update(dt){
  if (state === 'charge') charge = Math.min(charge + dt * J.chargeSpeed, J.maxPower);
  // 찌그러짐: 힘이 찰수록 납작
  const target = state === 'charge' ? 1 - (charge / J.maxPower) * F.squash : 1;
  player.sq += (target - player.sq) * Math.min(1, dt * (state === 'charge' ? 30 : 12));

  if (state === 'fly'){
    jump.t += dt;
    const k = Math.min(jump.t / jump.T, 1);
    player.x = jump.x0 + jump.d * k;
    player.y = -4 * jump.h * k * (1 - k);              // 포물선
    player.rot = jump.d > 0.05 ? k * Math.PI * 2 : 0;  // 한 바퀴 회전
    // 잔상 기록 (점프하는 동안만)
    if (CU.trailCount > 0){
      trail.push({x: player.x, y: player.y, rot: player.rot, sq: player.sq, life: 1});
      if (trail.length > CU.trailCount) trail.shift();
    }
    if (k >= 1){ player.y = 0; player.rot = 0; land(); }
  }
  for (const t of trail) t.life -= dt * CU.trailFade; // 잔상은 금방 사라짐
  trail = trail.filter(t => t.life > 0);
  cubeFlash = Math.max(0, cubeFlash - dt / CU.perfectFlashTime);
  // 꾹 누를수록 둘레 빛이 밝고 커짐, 떼면 원래대로
  const cg = state === 'charge' ? charge / J.maxPower : 0;
  chargeGlow += (cg - chargeGlow) * Math.min(1, dt * (state === 'charge' ? 20 : 8));
  if (state === 'fall'){
    player.vy += dt * 7;
    player.y += player.vy * dt;
    player.x += player.dir * dt * 0.15;
    player.rot += player.dir * dt * 5;
    if (now() - fallAt > SET.time.fall * 1000) gameOver();
  }

  camX += (camGoal() - camX) * Math.min(1, dt * 6);
  shake *= Math.pow(0.002, dt);

  for (const p of parts){ p.vy += 3 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.6; }
  parts = parts.filter(p => p.life > 0);
  for (const p of pops){ p.y += (p.faint ? 0.1 : -0.18) * dt; p.life -= dt * 1.1; } // 보통은 위로, 흐린 글자는 아래로
  pops = pops.filter(p => p.life > 0);
  for (const r of rings){ r.r += 0.5 * dt; r.life -= dt * 2.2; }
  rings = rings.filter(r => r.life > 0);
}

// ---------- 그리기 ----------
const toX = x => (x - camX) * S;  // 게임 위치 → 화면 픽셀
const toY = y => GY + y * S;

function rrect(x, y, w, h, r){
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// 글자 쓰기: 한 줄을 한글 덩어리와 영어·숫자 덩어리로 나눠 각자 글꼴로 이어서 씀
//   (그래서 "BEST 31 · 1점만 더!"처럼 섞인 줄도 크기와 높이가 맞게 나옴)
// shadow = true → 흰 글자 밑에 옅은 그림자 / track → 글자 사이 간격 (안 주면 영어 대문자만 UI.track)
const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
const NEUTRAL = /[\s.,!?·~…:()\-]/; // 띄어쓰기·문장부호는 앞 글자와 같은 글꼴로
function splitRuns(t){
  const out = []; let ko = null, buf = '';
  for (const ch of String(t)){
    const k = NEUTRAL.test(ch) && ko !== null ? ko : HANGUL.test(ch);
    if (ko === null || k === ko){ buf += ch; if (ko === null) ko = k; }
    else { out.push({s: buf, ko}); buf = ch; ko = k; }
  }
  if (buf) out.push({s: buf, ko});
  return out;
}
function text(t, x, y, size, col, weight = UI.weight, alpha = 1, shadow = false, track = null, left = false){
  ctx.globalAlpha = alpha; ctx.fillStyle = col;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const parts = splitRuns(t).map(r => {
    const font = r.ko ? (weight >= 700 ? UI.koWeightStrong : UI.koWeight) + ' ' + (size * UI.koScale).toFixed(1) + 'px ' + FONT_KO + SYS_FONT // 한글: 보통 500, 강조 600
                      : weight + ' ' + size + 'px ' + FONT_EN + SYS_FONT;
    ctx.font = font;
    const sp = r.ko ? 0 : (track !== null ? track : (/[A-Z]/.test(r.s) ? UI.track : 0)) * size;
    let w = 0;
    if (sp) for (const ch of r.s) w += ctx.measureText(ch).width + sp;
    else w = ctx.measureText(r.s).width;
    return {r, font, sp, w};
  });
  const last = parts[parts.length - 1];
  const total = parts.reduce((a, p) => a + p.w, 0) - (last && last.sp ? last.sp : 0);
  let cx = left ? x : x - total / 2; // left = true 이면 x에서 오른쪽으로
  const base = y + size * 0.36; // y = 글자 가운데 높이
  if (shadow){
    ctx.shadowColor = (darkMode ? UI.dark : UI.light).shadow;
    ctx.shadowBlur = Math.max(4, size * 0.18); ctx.shadowOffsetY = Math.max(1, size * 0.03);
  }
  for (const p of parts){
    ctx.font = p.font;
    const yy = base + (p.r.ko ? size * UI.koShiftY : 0);
    if (p.sp){ for (const ch of p.r.s){ ctx.fillText(ch, cx, yy); cx += ctx.measureText(ch).width + p.sp; } }
    else { ctx.fillText(p.r.s, cx, yy); cx += p.w; }
  }
  if (shadow){ ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  ctx.globalAlpha = 1;
}
// ---------- 기둥 ----------
// 색: 지금 하늘 색에서 뽑은 파스텔색 (하늘보다 한 톤 진하게). 기둥마다 색이 조금씩 흘러감
// 입체감: 테두리 없이 윗면 밝은 띠 + 몸통은 아래로 살짝 어두워짐. 아래쪽은 안개 속으로 사라짐
let pillarSeq = 0; // 기둥마다 붙는 번호 (색이 흘러가는 순서)
// 색 바꾸기 도우미: [빨,초,파] ↔ [색상(0~360), 진하기(0~1), 밝기(0~1)]
function rgbToHsl([r, g, b]){
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl(h, s, l, a = 1){
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  return 'hsla(' + h.toFixed(1) + ',' + (s * 100).toFixed(1) + '%,' + (l * 100).toFixed(1) + '%,' + a + ')';
}
let plBase = null; // 이번 화면의 기둥 기본 색 (조각 색에도 씀)
// 기둥 하나의 색 (그 기둥 번호에 맞게 흘러간 색)
function pillarColor(p, a = 1){
  if (!plBase || p.id === undefined) return 'rgba(255,255,255,' + a + ')';
  return hsl(plBase.bh + Math.sin(p.id * PL.hueStep) * PL.hueRange, plBase.baseS, plBase.baseL, a);
}
function drawPillars(dip){
  const mid = [0, 1, 2].map(i => (skyTop[i] + skyBot[i]) / 2);
  const fixedCol = !!(TH.night || TH.cosmos); // 밤바다·우주: 기둥 색을 하늘에서 뽑지 않고 정해 둔 색으로
  const [bh, bs, bl] = fixedCol ? rgbToHsl(hexRgb(PL.color)) : rgbToHsl(mid);
  // 밝은 화면: 하늘보다 진하게 / 다크 모드: 하늘보다 밝게 (차분한 색)
  const baseL = fixedCol ? bl : darkMode ? bl + PL.darkLift : bl - PL.darker;
  const baseS = fixedCol ? bs : bs + PL.saturate;
  plBase = {bh, baseS, baseL};
  const fogTop = GY + (H - GY) * PL.fogStart, fogBot = GY + (H - GY) * PL.fogEnd;
  pillars.forEach((p, i) => {
    if (p.id === undefined) p.id = pillarSeq++;
    const sx = toX(p.x), w = p.w * S;
    if (sx > W + 50 || sx + w < -50) return;
    const d = i === cur ? dip : 0; // 서 있는 발판만 눌림
    const h = bh + Math.sin(p.id * PL.hueStep) * PL.hueRange; // 기둥마다 색이 조금씩 흘러감
    const top = GY + d;
    if (fixedCol) drawNightPillar(sx, w, top, h, baseS, baseL); // 밤바다: 어두운 남색 / 우주: 남보라 기둥
    else {
    // 몸통: 위는 기둥 색 → 아래로 살짝 어두워지면서 안개 속으로 투명해짐
    const g = ctx.createLinearGradient(0, top, 0, fogBot);
    const fogK = Math.max(0, Math.min(1, (fogTop - top) / Math.max(1, fogBot - top)));
    g.addColorStop(0, hsl(h, baseS, baseL));
    g.addColorStop(fogK, hsl(h, baseS, baseL - PL.shade * fogK, 1));
    g.addColorStop(1, hsl(h, baseS, baseL - PL.shade, 0));
    ctx.fillStyle = g;
    ctx.fillRect(sx, top, w, fogBot - top);
    // 윗면: 얇고 밝은 띠
    ctx.fillStyle = hsl(h, baseS * 0.8, baseL + PL.topLight);
    ctx.fillRect(sx, top, w, Math.max(2, S * PL.topBand));
    }
    // "완벽!" 기준선: 은은하게 빛나는 흰 선 (살짝 번지는 빛 + 가운데 선)
    if (i > cur || state === 'ready'){
      const lw = JD.perfectLine * S, cx = sx + w / 2, lh = Math.max(2, S * 0.006);
      const gw = lw * 1.6, gh = Math.max(6, S * 0.03);
      const glow = ctx.createRadialGradient(cx, top, 0, cx, top, gw);
      const lc = hexRgb(PL.lineColor || '#FFFFFF').join(',');
      glow.addColorStop(0, 'rgba(' + lc + ',' + PL.lineGlow + ')');
      glow.addColorStop(1, 'rgba(' + lc + ',0)');
      ctx.save(); ctx.translate(cx, top); ctx.scale(1, gh / gw); ctx.translate(-cx, -top);
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, top, gw, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(' + lc + ',0.95)';
      ctx.fillRect(cx - lw / 2, top, lw, lh);
    }
  });
}
// ---------- 네모: "구름 조각" ----------
// 몸통은 위 흰색 → 아래 연보라 그라데이션, 왼쪽 위에 동그랗게 번진 흰 반짝임.
// 테두리 선 없이, 둘레 흰 빛 + 아래쪽 연보라 + 윤곽 그늘 + 바닥 그림자로 모양을 또렷하게.
// 찌그러짐(sq)·회전(rot)은 게임 그대로 따라감
function drawCube(sx, groundY, rot, sq, c, alpha, whiten){
  const s = F.playerSize * S, w = s * (1 + (1 - sq) * 0.55), h = s * sq, r = s * 0.2;
  ctx.save();
  ctx.translate(sx, groundY - h / 2);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, c.top); g.addColorStop(1, c.bottom);
  ctx.fillStyle = g;
  rrect(-w / 2, -h / 2, w, h, r); ctx.fill();
  ctx.clip(); // 아래 반짝임·환해짐이 네모 밖으로 안 나가게
  if (CU.sparkleSize > 0 && CU.sparkleAlpha > 0){
    const ss = s * CU.sparkleSize;
    ctx.globalAlpha = alpha * CU.sparkleAlpha;
    ctx.drawImage(sprite('glow', '#FFFFFF'), -w / 2 + w * 0.3 - ss / 2, -h / 2 + h * 0.28 - ss / 2, ss, ss);
  }
  if (whiten > 0){ // "완벽!" 때 한 번 환해짐
    ctx.globalAlpha = alpha * whiten;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
}
function drawPlayer(dip){
  const c = darkMode ? CU.dark : CU.light;
  const onGround = state === 'charge' || state === 'idle';
  const sy = GY + (onGround ? dip : 0) + player.y * S;
  const falling = state === 'fall' || state === 'over';
  // 떨어질 때: 아래로 내려갈수록 투명해져 안개 속으로 빠져듦
  const alpha = falling ? Math.max(0, 1 - Math.max(0, player.y) / CU.fallFade) : 1;
  if (alpha <= 0) return;
  const s = F.playerSize * S, sx = toX(player.x), cy = sy - s * player.sq / 2;
  // 바닥 그림자: 기둥 윗면에 부드럽게. 높이 뜰수록 작고 흐려짐 (기둥 위에 있을 때만)
  if (!falling){
    const under = pillars.find(q => player.x >= q.x && player.x <= q.x + q.w);
    if (under){
      const k = Math.min(1, Math.max(0, -player.y) / CU.shadowFade);
      const sw = s * CU.shadowSize * (1 - 0.55 * k), sh = sw * 0.3;
      const gy = GY + (pillars.indexOf(under) === cur ? dip : 0);
      ctx.globalAlpha = CU.shadowAlpha * (1 - k);
      ctx.drawImage(sprite('shadow', c.shadow), sx - sw / 2, gy - sh / 2, sw, sh);
    }
  }
  // 둘레 빛: 꾹 누를수록 밝고 커짐, "완벽!" 때도 잠깐 밝아짐
  const boost = chargeGlow + cubeFlash * 0.6;
  const gs = s * CU.glowSize * (1 + CU.chargeGrow * chargeGlow);
  ctx.globalAlpha = Math.min(1, (darkMode ? CU.glowAlphaDark : CU.glowAlpha) * (1 + CU.chargeGlow * boost)) * alpha;
  ctx.drawImage(sprite('glow', c.glow), sx - gs / 2, cy - gs / 2, gs, gs);
  // 윤곽 그늘: 테두리 선 대신 둘레를 아주 살짝 어둡게 감싸 밝은 하늘에서도 모양이 보이게
  if (CU.outlineAlpha > 0){
    const os = s * CU.outlineSize;
    ctx.globalAlpha = CU.outlineAlpha * alpha;
    ctx.drawImage(sprite('shadow', c.outline), sx - os / 2, cy - os / 2 + s * 0.06, os, os);
  }
  // 잔상: 연보라빛으로 아주 흐리게, 오래된 것일수록 더 흐리게
  trail.forEach((t, i) => {
    const a = CU.trailAlpha * t.life * (i + 1) / trail.length * alpha;
    drawCube(toX(t.x), GY + t.y * S, t.rot, t.sq, {top: c.trail, bottom: c.trail}, a, 0);
  });
  ctx.globalAlpha = 1;
  drawCube(sx, sy, player.rot, player.sq, c, alpha, cubeFlash * CU.perfectFlash);
}
// 번지는 동그라미 그림을 한 번만 그려 두고 다시 씀 (폰에서 가볍게)
const spriteCache = {};
function sprite(kind, color){
  const key = kind + color;
  if (spriteCache[key]) return spriteCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  const rgb = color.charAt(0) === '#' ? hexRgb(color).join(',') : color;
  if (kind === 'shadow'){ g.addColorStop(0, 'rgba(' + rgb + ',1)'); g.addColorStop(0.5, 'rgba(' + rgb + ',0.5)'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); }
  else { g.addColorStop(0, 'rgba(' + rgb + ',0.9)'); g.addColorStop(0.35, 'rgba(' + rgb + ',0.45)'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); }
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (spriteCache[key] = c);
}
function draw(){
  if (TH.night) drawNightBack(); // 밤바다: 하늘·별·달·수평선·바다·달빛 길
  else if (TH.cosmos) drawCosmosBack(); // 우주: 남색→보라 바탕·성운·행성·별·별똥별
  else { ctx.fillStyle = skyGrad || bgCss; ctx.fillRect(0, 0, W, H); } // 하늘 그라데이션
  drawDust(); // 빛 먼지 (기둥 뒤에서 떠다님)
  ctx.save();
  if (shake > 0.3) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  const dip = state === 'charge' ? (charge / J.maxPower) * F.padDip * S : 0;
  const falling = state === 'fall' || state === 'over';
  if (falling){ drawPlayer(dip); drawPillars(dip); } else { drawPillars(dip); drawPlayer(dip); }
  if (TH.night || TH.cosmos) drawNightFog(); // 밤바다·우주: 아래쪽 어둠 (기둥과 떨어진 네모가 함께 사라짐)

  for (const r of rings){
    ctx.globalAlpha = Math.max(r.life, 0) * 0.85; ctx.strokeStyle = EF.ringColor; ctx.lineWidth = 1.5; // 착지 고리
    ctx.beginPath(); ctx.ellipse(toX(r.x), GY, r.r * S, r.r * S * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of parts){
    const sz = p.s * S;
    ctx.globalAlpha = Math.max(p.life, 0); ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.y), Math.max(1, sz / 2), 0, Math.PI * 2); ctx.fill(); // 작고 둥근 조각
  }
  ctx.globalAlpha = 1;
  // 떠오르는 글자: 흰색에 옅은 그림자 (어느 하늘에서도 잘 읽히게)
  const drawPop = p => {
    const size = p.faint ? S * 0.045 : p.big ? S * 0.065 : S * 0.05;
    text(p.text, toX(p.x), toY(p.y), size, '#fff', p.big ? UI.weightBig : UI.weight, Math.min(1, p.life * 1.5) * (p.faint ? 0.55 : 1), true);
  };
  for (const p of pops) if (!HANGUL.test(p.text)) drawPop(p); // 영어 글자는 화면과 함께 흔들림
  ctx.restore();
  for (const p of pops) if (HANGUL.test(p.text)) drawPop(p);  // 한국어 글자는 흔들리지 않게
  drawStarFx();  // 별가루: 모여서 별이 되어 왼쪽 위로 날아감

  // 게임 중 점수: 흰색 큰 숫자(Quicksand 굵게) + 옅은 그림자, 아래 BEST·COMBO
  const Z = UI.size;
  const SM = UI.smallText || '#fff'; // 작은 글자 색 (꿈은 흰색, 밤바다는 연한 회청색)
  if (state !== 'ready' && state !== 'over'){
    const big = Math.min(S * 0.22, Z.score);
    let y = H * 0.14;
    text(String(score), W / 2, y, big, '#fff', UI.weightBig, 1, true);
    y += big * 0.7;
    if (best > 0){ text(fmt(T.best, best), W / 2, y, Z.small, SM, UI.weight, 0.85, true); y += Z.small * 1.5; } // 기록이 없으면 안 보임 (B6)
    if (combo > 1){ text(fmt(T.combo, combo), W / 2, y, Z.small, SM, UI.weightBig, 1, true); y += Z.small * 1.5; }
    const need = needText();
    if (need) text(need, W / 2, y, Z.small + 1, SM, UI.weight, 0.95, true);
  }

  // 첫 화면: "꾹 점프"가 둥실둥실 천천히 떠 있고, 아래에 작은 "KKUK JUMP"
  if (state === 'ready'){
    const bob = Math.sin(now() / (UI.floatTime * 1000) * Math.PI * 2) * UI.floatTitle;
    const ts = Math.min(S * 0.17, Z.title), ty = H * 0.2 + bob;
    text(T.title, W / 2, ty, ts, '#fff', UI.weightBig, 1, true); // 한글 강조 굵기
    text(T.titleEn, W / 2, ty + ts * 0.72, Z.titleEn, SM, UI.weight, 0.7, true, UI.titleEnTrack);
    const gy = H * 0.2 + ts * 0.72 + 44;
    text(T.guide1, W / 2, gy, Z.guide, SM, 400, 0.9, true);
    text(T.guide2, W / 2, gy + Z.guide * 1.6, Z.guide, SM, 400, 0.9, true);
    if (best) text(fmt(T.titleBest, best), W / 2, gy + Z.guide * 1.6 + 34, Z.small, SM, UI.weight, 0.75, true);
  }

  // 게임 오버: 뿌연 반투명 막 위에 점수가 떠 있음
  if (state === 'over'){
    const t = Math.min((now() - overAt) / 300, 1);
    ctx.globalAlpha = t; ctx.fillStyle = (darkMode ? UI.dark : UI.light).overVeil; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const cy = H * 0.36;
    text(T.score, W / 2, cy - 76, Z.label, SM, UI.weight, 0.85 * t, true);
    text(String(score), W / 2, cy, Math.min(S * 0.28, Z.scoreOver), '#fff', UI.weightBig, t, true);
    if (newBest) text(T.newBest, W / 2, cy + 78, Z.label + 2, '#fff', UI.weightBig, t, true);
    else if (best > 0){
      const need = needText();
      text(fmt(T.overBest, best) + (need ? '  ·  ' + need : ''), W / 2, cy + 78, Z.label, SM, UI.weight, 0.85 * t, true);
    }
    text(T.retry, W / 2, H * 0.72, Z.retry, SM, 400, t * 0.9, true); // 한국어: 깜빡임 없이 차분하게
  }
  drawStardustHud(); // 왼쪽 위 "✦ 숫자" (게임 오버 막보다 위에)
}

// ---------- 별가루 얻는 연출 ----------
// 빛 먼지 몇 개가 네모 쪽으로 모여 작은 별이 되고 → 왼쪽 위로 날아감 → 도착하면 숫자가 1 올라감
let gameStardust = 0;                          // 이번 판에 얻은 개수
let shownStardust = stardust;                  // 왼쪽 위에 보이는 숫자 (별이 도착할 때 올라감)
let starFx = [];                               // 날아가는 별들
let hudT = 0, hudPulse = 0;                    // 게임 중 숫자가 보이는 남은 시간 / 도착할 때 톡 커지는 정도
function resetStardustFx(){
  for (const f of starFx) releaseMotes(f);
  starFx = []; gameStardust = 0; shownStardust = stardust; hudT = 0; hudPulse = 0;
}
function gainStardust(n){
  Wallet.add(n);                               // 얻는 즉시 저장
  gameStardust += n;
  const wait = starFx.length ? Math.max(0, -starFx[starFx.length - 1].t) + SD.gap : 0;
  for (let i = 0; i < n; i++) starFx.push({t: -(wait + i * SD.gap)}); // 여러 개면 조금씩 시간 차
}
const hudPos = () => ({x: 18, y: 30});         // 왼쪽 위 별 아이콘 자리 (화면 픽셀)
const cubeCenter = () => ({x: toX(player.x), y: GY + player.y * S - F.playerSize * S * player.sq / 2});
function releaseMotes(f){
  if (!f.motes) return;
  for (const o of f.motes){ o.m.held = false; Object.assign(o.m, newMote(H + 10)); }
  f.motes = null;
}
function updateStarFx(dt){
  for (const f of starFx){
    f.t += dt;
    if (f.t < 0) continue;
    if (!f.started){ // 시작: 네모와 가까운 빛 먼지를 골라 끌어옴
      f.started = true;
      const c = cubeCenter(); f.cx = c.x; f.cy = c.y;
      f.motes = dust.filter(m => !m.held)
        .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))
        .slice(0, SD.gatherCount).map(m => { m.held = true; return {m, x: m.x, y: m.y}; });
    }
    const g = f.t / SD.gatherTime;
    if (g < 1 && f.motes){
      const e = g * g * (3 - 2 * g);
      for (const o of f.motes){ o.m.x = o.x + (f.cx - o.x) * e; o.m.y = o.y + (f.cy - o.y) * e; }
    } else if (!f.formed){ // 별이 됨: 맑고 짧은 소리 + 아주 짧은 진동, 왼쪽 위 숫자 나타남
      f.formed = true; releaseMotes(f);
      Sound.tone(1976, 0.12, 'sine', 0.06);
      Sound.buzz(6);
      hudT = SD.flyTime + SD.showTime;
    }
    if (f.formed && !f.done && f.t >= SD.gatherTime + SD.flyTime){ // 도착: 숫자 1 올라감
      f.done = true; shownStardust = Math.min(stardust, shownStardust + 1); hudPulse = 1;
    }
  }
  starFx = starFx.filter(f => !f.done);
  if (hudT > 0) hudT -= dt;
  hudPulse = Math.max(0, hudPulse - dt * 4);
}
// 네 갈래 별 ✦ (가운데가 오목한 반짝이 별). 그림 파일 없이 선으로 그림
function starPath(x, y, r){
  const k = r * 0.18; // 가운데 오목한 정도
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.closePath();
}
function drawStar(x, y, r, alpha){
  const c = darkMode ? SDC.dark : SDC.light, gs = r * SDC.glowSize;
  ctx.globalAlpha = alpha * SDC.glowAlpha;
  ctx.drawImage(sprite('glow', c.glow), x - gs / 2, y - gs / 2, gs, gs);
  ctx.globalAlpha = alpha; ctx.fillStyle = c.star;
  starPath(x, y, r); ctx.fill();
  ctx.globalAlpha = 1;
}
function drawStarFx(){
  const hp = hudPos();
  for (const f of starFx){
    if (!f.started) continue;
    const g = f.t / SD.gatherTime;
    if (g < 1){ // 모여드는 끝 무렵 별이 생겨남
      if (g > 0.55) drawStar(f.cx, f.cy, SD.starSize * (g - 0.55) / 0.45, (g - 0.55) / 0.45);
      continue;
    }
    const k = Math.min(1, (f.t - SD.gatherTime) / SD.flyTime), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const x = f.cx + (hp.x - f.cx) * e, y = f.cy + (hp.y - f.cy) * e - Math.sin(k * Math.PI) * 40; // 살짝 위로 휘며 날아감
    drawStar(x, y, SD.starSize * (1 - 0.35 * k), 1);
  }
}
// 왼쪽 위 "✦ 숫자": 첫 화면·게임 오버에선 늘 보이고, 게임 중엔 얻는 순간만 잠깐
function drawStardustHud(){
  let a;
  if (state === 'ready') a = 1;
  else if (state === 'over') a = Math.min((now() - overAt) / 300, 1);
  else a = Math.max(0, Math.min(1, hudT / 0.3, (SD.flyTime + SD.showTime - hudT) / 0.2));
  if (a <= 0.01) return;
  const hp = hudPos(), r = SD.iconSize * (1 + hudPulse * 0.35);
  drawStar(hp.x, hp.y, r, a);
  text(String(shownStardust), hp.x + SD.iconSize + 8, hp.y, SD.textSize * (1 + hudPulse * 0.12), '#fff', UI.weightBig, a, true, 0, true);
  if (state === 'over' && gameStardust > 0){ // 게임 오버: 이번 판에 얻은 개수
    ctx.font = UI.weightBig + ' ' + SD.textSize + 'px ' + FONT_EN + SYS_FONT;
    const w = ctx.measureText(String(shownStardust)).width;
    text(fmt(T.stardustGain, gameStardust), hp.x + SD.iconSize + 14 + w, hp.y, SD.textSize - 3, '#fff', UI.weight, a * 0.7, true, 0, true);
  }
}

// =====================================================================
//  밤바다 그리기 (테마에 night 묶음이 있을 때만 쓰임. 꿈 테마는 이 부분을 지나가지 않음)
//  뒤에서 앞으로: 하늘·별·달·수평선·바다(그림 한 장) → 달빛 길 → 기둥·네모 → 밤안개
// =====================================================================
const nightRgba = (hex, a) => 'rgba(' + hexRgb(hex).join(',') + ',' + a + ')';
// 별 자리: 정해진 순서로 나오는 "가짜 무작위"라서 늘 같은 자리 (게임의 무작위 순서는 건드리지 않음)
// 달 둘레와 가운데 글자(제목·점수·설명) 자리는 비워 두고, 남은 곳에서 n개를 고름
function nightStars(n, w, h, top, mx, my, mr){
  let s = 20240611;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const out = [];
  for (let i = 0; i < 400 && out.length < n; i++){
    const x = (0.04 + r() * 0.92) * w, y = 12 + r() * Math.max(10, top - 12), ph = r() * 6.28;
    if (Math.hypot(x - mx, y - my) < mr * 3.5) continue;                                     // 달 둘레
    if (w > 200 && Math.abs(x - w / 2) < w * 0.3 && y > h * 0.08 && y < h * 0.46) continue; // 글자 자리
    if (w > 200 && y < 70) continue;                                                         // 맨 위 버튼·별가루 숫자 줄
    out.push({x, y, ph});
  }
  return out;
}
// 하늘·바다·수평선·별·달무리·달을 한 번에 그림 (게임 화면 바탕과 테마 카드 그림이 같이 씀)
// c = 그릴 곳, w·h = 크기, top·bot = 하늘 위·아래 색, gy = 기둥 윗면 높이, s = 기준 크기, mx·my·mr = 달 자리·반지름
function paintNight(c, N, w, h, top, bot, gy, s, mx, my, mr, skipTwinkle){
  const hy = gy + s * N.horizon, fe = gy + (h - gy) * N.fogEnd, hs = Math.max(2, s * N.horizonSize);
  // 하늘: 위 짙은 남색 → 수평선 쪽 청록빛 남색
  let g = c.createLinearGradient(0, 0, 0, hy);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  c.fillStyle = g; c.fillRect(0, 0, w, hy + 1);
  // 바다: 수평선 아래로 갈수록 어두워짐 → 안개 높이부터 거의 검정
  const botRgb = bot.charAt(0) === '#' ? hexRgb(bot) : bot.match(/[\d.]+/g).map(Number); // '#색' 이나 'rgb(…)' 둘 다
  const seaTop = rgbStr(hexRgb(N.seaTop).map((v, i) => v + (botRgb[i] - v) * N.seaMix));
  g = c.createLinearGradient(0, hy, 0, h);
  g.addColorStop(0, seaTop); g.addColorStop(Math.max(0.01, Math.min(1, (fe - hy) / (h - hy))), N.seaBottom); g.addColorStop(1, N.seaBottom);
  c.fillStyle = g; c.fillRect(0, hy, w, h - hy);
  // 수평선: 딱딱한 선 대신 하늘과 바다가 부드럽게 섞이는 옅은 빛 띠
  g = c.createLinearGradient(0, hy - hs, 0, hy + hs);
  g.addColorStop(0, nightRgba(N.horizonColor, 0)); g.addColorStop(0.5, nightRgba(N.horizonColor, N.horizonGlow)); g.addColorStop(1, nightRgba(N.horizonColor, 0));
  c.fillStyle = g; c.fillRect(0, hy - hs, w, hs * 2);
  // 별: 하늘에만 드문드문 (반짝이는 별은 게임 화면에서 따로 그림). 달 둘레는 비움
  c.fillStyle = N.starColor;
  nightStars(N.stars, w, h, w > 200 ? hy - hs - 50 : hy - 12, mx, my, mr).forEach((st, i) => { // (작은 카드 그림은 수평선 바로 위까지)
    if (skipTwinkle && i < N.twinkle) return;
    c.globalAlpha = N.starAlpha * (0.6 + 0.4 * ((i * 37) % 10) / 10);
    c.beginPath(); c.arc(st.x, st.y, N.starSize * (w < 200 ? 0.7 : 1), 0, Math.PI * 2); c.fill();
  });
  c.globalAlpha = 1;
  // 달무리 2겹 (아주 옅게)
  for (const hl of N.halos){
    const hr = mr * hl.size;
    g = c.createRadialGradient(mx, my, mr, mx, my, hr);
    g.addColorStop(0, nightRgba(N.haloColor, hl.alpha)); g.addColorStop(1, nightRgba(N.haloColor, 0));
    c.fillStyle = g; c.fillRect(mx - hr, my - hr, hr * 2, hr * 2);
  }
  // 달: 가장자리가 또렷한 크림색 원 + 아주 옅은 얼룩 3개
  c.fillStyle = N.moonColor; c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();
  if (N.moonSpots > 0){
    c.save(); c.clip(); c.fillStyle = 'rgba(120,100,60,' + N.moonSpots + ')';
    for (const [dx, dy, rr] of [[-0.32, -0.18, 0.24], [0.28, 0.12, 0.2], [-0.06, 0.42, 0.15]]){
      c.beginPath(); c.arc(mx + dx * mr, my + dy * mr, rr * mr, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}
// 달빛 길: 수평선에서 아래로 이어지는 하나의 부드러운 빛 띠 (가로로 흐린 얇은 빛을 위에서 아래로 촘촘히 쌓음)
// 아래로 갈수록 조금 넓어지고 흐려짐. (x, hy) = 띠 맨 위 가운데, len = 길이, wid = 너비
function paintNightPath(c, N, x, hy, len, wid){
  const img = sprite('glow', N.pathColor), step = len > 200 ? 1 : 0.5;
  for (let y = 0; y < len; y += step){
    const f = y / len, w = wid * (0.45 + 0.55 * f);
    c.globalAlpha = Math.min(1, f * 30) * Math.pow(1 - f, 1.5) * 0.18 * step;
    c.drawImage(img, x - w / 2, hy + y - 4, w, 8);
  }
  c.globalAlpha = 1;
}

// ---------- 게임 화면: 움직이지 않는 바탕은 미리 그려 두고 다시 씀 ----------
let nightBg = null, nightBgKey = '', nightBgAt = -1e9, nightPath = null, nightPathKey = '';
let nightMoon = {x: 0, y: 0, r: 0}, nightTwinkle = [];
const nightDpr = () => Math.min(window.devicePixelRatio || 1, 2);
function nightMoonPlace(){ // 달 자리: 오른쪽 위 버튼 바로 아래 (어떤 화면 크기에서도 버튼·제목·점수와 안 겹치게)
  const N = TH.night, r = N.moonSize * S;
  const ui = document.getElementById('ui').getBoundingClientRect();
  nightMoon = {x: W - N.moonRight - r, y: Math.max(0, ui.bottom) + N.moonBelow + r, r};
}
function drawNightBack(){
  const N = TH.night, dpr = nightDpr(), t = now();
  const size = W + 'x' + H + 'x' + dpr + TH.name;
  const key = rgbStr(skyTop) + rgbStr(skyBot) + size;
  // 하늘 색이 천천히 바뀌는 동안에는 가끔만 다시 그림 (화면 크기가 바뀌면 바로)
  if (!nightBg || (key !== nightBgKey && (!nightBgKey.endsWith(size) || t - nightBgAt > N.redraw * 1000))){
    if (!nightBg) nightBg = document.createElement('canvas');
    nightBg.width = Math.round(W * dpr); nightBg.height = Math.round(H * dpr);
    const c = nightBg.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    nightMoonPlace();
    paintNight(c, N, W, H, rgbStr(skyTop), rgbStr(skyBot), GY, S, nightMoon.x, nightMoon.y, nightMoon.r, true);
    const hz = GY + S * N.horizon - Math.max(2, S * N.horizonSize) - 50;
    nightTwinkle = nightStars(N.stars, W, H, hz, nightMoon.x, nightMoon.y, nightMoon.r).slice(0, N.twinkle); // 반짝이는 별 자리
    nightBgKey = key; nightBgAt = t;
  }
  ctx.drawImage(nightBg, 0, 0, W, H);
  // 달빛 길: 화면 크기가 바뀔 때만 새로 그려 두고, 매 순간 아주 천천히 살짝 일렁이게 붙임
  const hy = GY + S * N.horizon, len = Math.max(10, GY + (H - GY) * N.fogEnd - hy), wid = N.pathWidth * S;
  if (!nightPath || nightPathKey !== size){
    if (!nightPath) nightPath = document.createElement('canvas');
    nightPath.width = Math.round(wid * 1.4 * dpr); nightPath.height = Math.round(len * dpr);
    const c = nightPath.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintNightPath(c, N, wid * 0.7, 0, len, wid);
    nightPathKey = size;
  }
  const ph = t / 1000 / N.pathTime * Math.PI * 2;
  ctx.globalAlpha = N.pathAlpha * (0.9 + 0.1 * Math.sin(ph * 1.3));
  ctx.drawImage(nightPath, nightMoon.x - wid * 0.7 + Math.sin(ph) * N.pathSway, hy, wid * 1.4, len);
  // 반짝이는 별 몇 개: 아주 천천히 밝아졌다 흐려짐
  ctx.fillStyle = N.starColor;
  for (const st of nightTwinkle){
    ctx.globalAlpha = N.starAlpha * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t / 1000 / N.twinkleTime * Math.PI * 2 + st.ph)));
    ctx.beginPath(); ctx.arc(st.x, st.y, N.starSize, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// 기둥 하나 (밤바다): 어두운 남색, 왼쪽(달 반대쪽) 옆면에 아주 옅은 그늘, 윗면 가장자리에 얇은 달빛 띠
// 아래쪽은 화면 끝까지 내려가고, 위에 덮는 밤안개가 감춤 → 끝선이 안 보임
function drawNightPillar(sx, w, top, hue, S0, L0){
  ctx.fillStyle = hsl(hue, S0, L0); ctx.fillRect(sx, top, w, H - top + 40);
  if (PL.shade > 0){
    const g = ctx.createLinearGradient(sx, 0, sx + w * 0.45, 0);
    g.addColorStop(0, 'rgba(0,0,0,' + PL.shade + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(sx, top, w * 0.45, H - top + 40);
  }
  ctx.globalAlpha = PL.topAlpha; ctx.fillStyle = PL.topColor;
  ctx.fillRect(sx, top, w, Math.max(1, S * PL.topBand));
  ctx.globalAlpha = 1;
}
// 밤안개: 화면 아래쪽을 짙은 밤 색으로 부드럽게 덮어 기둥과 바다(와 떨어진 네모)가 함께 사라지게
function drawNightFog(){
  const N = TH.night || TH.cosmos, a = GY + (H - GY) * N.fogStart, b = GY + (H - GY) * N.fogEnd;
  const g = ctx.createLinearGradient(0, a, 0, b);
  g.addColorStop(0, nightRgba(N.fogColor, 0)); g.addColorStop(0.55, nightRgba(N.fogColor, 0.7)); g.addColorStop(1, nightRgba(N.fogColor, 1));
  ctx.fillStyle = g; ctx.fillRect(-40, a, W + 80, b - a);
  ctx.fillStyle = N.fogColor; ctx.fillRect(-40, b - 0.5, W + 80, H - b + 60);
}
// 테마 카드 미리보기 (밤바다): 게임 화면을 작게 줄인 모습
function drawNightPreview(c, w, h, t, sk){
  const N = t.night, gy = h * 0.6, s = 60, mr = 6;
  paintNight(c, N, w, h, sk.top, sk.bottom, gy, s, w * 0.8, h * 0.2, mr, false);
  const hy = gy + s * N.horizon, fe = gy + (h - gy) * N.fogEnd;
  c.globalAlpha = N.pathAlpha; paintNightPath(c, N, w * 0.8, hy, fe - hy, 12); c.globalAlpha = 1;
  const p = t.pillar, [bh, bs, bl] = rgbToHsl(hexRgb(p.color));
  [[14, 34, 0], [70, 30, 1]].forEach(([x, pw, id]) => {
    c.fillStyle = hsl(bh + Math.sin(id * p.hueStep) * p.hueRange, bs, bl); c.fillRect(x, gy, pw, h - gy);
    c.globalAlpha = p.topAlpha; c.fillStyle = p.topColor; c.fillRect(x, gy, pw, 1); c.globalAlpha = 1;
  });
  const g = c.createLinearGradient(0, gy + (h - gy) * N.fogStart, 0, fe);
  g.addColorStop(0, nightRgba(N.fogColor, 0)); g.addColorStop(1, nightRgba(N.fogColor, 1));
  c.fillStyle = g; c.fillRect(0, gy + (h - gy) * N.fogStart, w, h);
}

// =====================================================================
//  우주 그리기 (테마에 cosmos 묶음이 있을 때만 쓰임. 꿈·밤바다는 이 부분을 지나가지 않음)
//  기둥·네모·글자는 다른 테마와 같은 모양이고, 여기서는 배경만 그림:
//  남색→보라 바탕·흐린 성운·작은 점 별·얇은 선 행성(그림 한 장) → 반짝이는 별 몇 개 → 가끔 별똥별
// =====================================================================
const cosRgba = (hex, a) => 'rgba(' + hexRgb(hex).join(',') + ',' + a + ')';
function cosRand(seed){ let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const cosR = cosRand(4242); // 별똥별 자리·간격용 (게임의 무작위 순서는 건드리지 않음)
// 행성 자리: 오른쪽 위 버튼 바로 아래 (밤바다의 달 자리와 같은 방식)
function cosPlanet(C, w, s, uiBottom){
  const r = C.planetSize * s, rr = r * C.ringSize;
  return {x: w - C.planetRight - rr, y: uiBottom + C.planetBelow + r, r, rr};
}
// 바탕 그림: 그라데이션 + 아주 흐린 성운 + 작은 점 별(반짝이는 별은 빼고) + 얇은 선 행성
function paintCosmos(c, t, w, h, s, uiBottom, gy, small){
  const C = t.cosmos, sk = t.sky.light[0];
  let g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, sk.top); g.addColorStop(1, sk.bottom);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (const n of C.nebulae){
    const x = n.x * w, y = n.y * h, r = n.r * s;
    g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, cosRgba(n.color, C.nebulaAlpha)); g.addColorStop(1, cosRgba(n.color, 0));
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const P = small ? {x: w * 0.76, y: h * 0.24, r: 6, rr: 6 * C.ringSize} : cosPlanet(C, w, s, uiBottom);
  if (!small){
    c.fillStyle = '#FFFFFF';
    nightStars(C.stars, w, h, gy - s * 0.35, P.x, P.y, P.rr * 0.5).forEach((st, i) => {
      if (i < C.twinkle) return;
      c.globalAlpha = C.starAlpha * (0.5 + 0.5 * ((i * 37) % 10) / 10);
      c.beginPath(); c.arc(st.x, st.y, C.starSize, 0, Math.PI * 2); c.fill();
    });
    c.globalAlpha = 1;
  }
  // 행성: 얇은 선 원 + 고리 (고리 뒤쪽 반은 원에 가려짐)
  c.lineWidth = small ? 1 : C.lineWidth; c.strokeStyle = cosRgba(C.lineColor, C.lineAlpha);
  const ring = back => {
    c.save(); c.translate(P.x, P.y); c.rotate(C.ringTilt); c.scale(1, 0.3);
    c.beginPath(); c.arc(0, 0, P.rr, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI); c.restore(); c.stroke();
  };
  ring(true);
  c.fillStyle = sk.top; c.beginPath(); c.arc(P.x, P.y, P.r, 0, Math.PI * 2); c.fill(); c.stroke();
  ring(false);
  return P;
}

// ---------- 게임 화면 ----------
let cosBg = null, cosBgKey = '', cosTw = [], cosLastT = 0, cosMeteor = null, cosNextMeteor = 0;
function drawCosmosBack(){
  const C = TH.cosmos, dpr = nightDpr(), t = now(), dt = Math.min(0.1, (t - cosLastT) / 1000); cosLastT = t;
  const size = W + 'x' + H + 'x' + dpr;
  if (!cosBg || cosBgKey !== size){ // 화면 크기가 바뀔 때만 새로 그림
    if (!cosBg) cosBg = document.createElement('canvas');
    cosBg.width = Math.round(W * dpr); cosBg.height = Math.round(H * dpr);
    const c = cosBg.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ub = Math.max(0, document.getElementById('ui').getBoundingClientRect().bottom);
    const P = paintCosmos(c, TH, W, H, S, ub, GY, false);
    cosTw = nightStars(C.stars, W, H, GY - S * 0.35, P.x, P.y, P.rr * 0.5).slice(0, C.twinkle);
    cosBgKey = size;
  }
  ctx.drawImage(cosBg, 0, 0, W, H);
  // 반짝이는 별 몇 개
  ctx.fillStyle = '#FFFFFF';
  for (const st of cosTw){
    ctx.globalAlpha = C.starAlpha * (0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t / 1000 / C.twinkleTime * Math.PI * 2 + st.ph)));
    ctx.beginPath(); ctx.arc(st.x, st.y, C.starSize, 0, Math.PI * 2); ctx.fill();
  }
  // 별똥별: 10~20초에 한 번, 얇은 선이 대각선으로 지나감
  if (!cosNextMeteor) cosNextMeteor = t + (C.meteorMin + cosR() * (C.meteorMax - C.meteorMin)) * 1000;
  if (!cosMeteor && t > cosNextMeteor){
    cosMeteor = {t: 0, x: W * (0.4 + cosR() * 0.5), y: H * (0.05 + cosR() * 0.25)};
    cosNextMeteor = t + (C.meteorMin + cosR() * (C.meteorMax - C.meteorMin)) * 1000;
  }
  if (cosMeteor){
    cosMeteor.t += dt;
    const k = cosMeteor.t / C.meteorTime;
    if (k >= 1) cosMeteor = null;
    else {
      const d = S * 0.8 * k, len = C.meteorLength * S, hx = cosMeteor.x - d * 0.82, hy = cosMeteor.y + d * 0.57;
      const g = ctx.createLinearGradient(hx, hy, hx + len * 0.82, hy - len * 0.57);
      g.addColorStop(0, 'rgba(255,255,255,' + C.meteorAlpha * Math.sin(Math.PI * k) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + len * 0.82, hy - len * 0.57); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
// 테마 카드 미리보기 (우주): 배경·성운·선 행성, 기둥 둘(아래는 어둠), 흰 네모 — 밤바다 카드와 같은 구성
function drawCosmosPreview(c, w, h, t){
  const C = t.cosmos, gy = h * 0.6;
  paintCosmos(c, t, w, h, 70, 0, gy, true);
  const r = cosRand(5); c.fillStyle = '#FFFFFF';
  for (let i = 0; i < 10; i++){ c.globalAlpha = 0.3 + r() * 0.4; c.fillRect(r() * w * 0.6, r() * h * 0.5, 1, 1); }
  c.globalAlpha = 1;
  const p = t.pillar, [bh, bs, bl] = rgbToHsl(hexRgb(p.color));
  [[14, 34, 0], [70, 30, 1]].forEach(([x, pw, id]) => {
    c.fillStyle = hsl(bh + Math.sin(id * p.hueStep) * p.hueRange, bs, bl); c.fillRect(x, gy, pw, h - gy);
    c.globalAlpha = p.topAlpha; c.fillStyle = p.topColor; c.fillRect(x, gy, pw, 1); c.globalAlpha = 1;
  });
  const g = c.createLinearGradient(0, gy + (h - gy) * C.fogStart, 0, gy + (h - gy) * C.fogEnd);
  g.addColorStop(0, cosRgba(C.fogColor, 0)); g.addColorStop(1, cosRgba(C.fogColor, 1));
  c.fillStyle = g; c.fillRect(0, gy + (h - gy) * C.fogStart, w, h);
}

// ---------- 빛 먼지 ----------
// 동그랗고 흐린 점들이 아주 천천히 위로 떠오름. 다크 모드에서는 별처럼 반짝임
let dust = [];
function makeDust(){
  dust = [];
  for (let i = 0; i < DU.count; i++) dust.push(newMote(Math.random() * H));
}
function newMote(y){
  const r = Math.random();
  return {
    x: Math.random() * W, y,
    size: DU.sizeMin + (DU.sizeMax - DU.sizeMin) * r * r,     // 작은 점이 더 많게
    a: DU.alphaMin + (DU.alphaMax - DU.alphaMin) * Math.random(),
    sp: DU.speed * (0.5 + Math.random()),                      // 점마다 속도가 조금씩 다름
    ph: Math.random() * Math.PI * 2,                           // 좌우로 흔들리는 박자
  };
}
function updateDust(dt){
  if (dust.length !== DU.count) makeDust();
  for (const m of dust){
    if (m.held) continue; // 별가루가 되려고 모여드는 중인 먼지는 따로 움직임
    m.y -= m.sp * dt; m.ph += dt * 0.6;
    if (m.y < -10){ Object.assign(m, newMote(H + 10)); }
  }
}
function drawDust(){
  const star = darkMode;
  const img = sprite('glow', star ? '235,235,255' : '255,255,255');
  const t = now() / 1000;
  for (const m of dust){
    const x = m.held ? m.x : m.x + Math.sin(m.ph) * DU.sway;
    // 다크 모드: 별처럼 천천히 반짝임
    const tw = star ? 0.55 + 0.45 * Math.sin(t * DU.twinkle + m.ph * 3) : 1;
    const sz = m.size * (star ? 0.8 : 1) * 2.6;               // 번지는 빛 포함 크기
    ctx.globalAlpha = Math.min(1, m.a * tw * (m.held ? 1.8 : 1)); // 모여드는 먼지는 조금 더 밝게
    ctx.drawImage(img, x - sz / 2, m.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
}

// ---------- 가장자리 (꿈꾸는 듯 살짝 뿌옇게) ----------
// 게임 화면 위에 고정된 얇은 막으로 깔아 둠 → 매 순간 다시 그리지 않아서 폰에서 가벼움
function paintVignette(){
  const VG = TH.vignette;
  const el = document.getElementById('vignette');
  const col = darkMode ? VG.dark : VG.light;
  if (!el) return;
  if (!col || VG.size <= 0){ el.style.background = 'none'; return; }
  const clear = col.replace(/[\d.]+\)$/, '0)');
  el.style.background = 'radial-gradient(ellipse at center, ' + clear + ' ' + Math.round((1 - VG.size) * 100) + '%, ' + col + ' 100%)';
}

// (꺼 둔 기능) 화면 테두리 반짝임: 얻은 것의 색으로 한 번 반짝이고 사라짐
function drawFlash(dt){
  if (!flash) return;
  flash.t += dt;
  const k = flash.t / UF.flashTime;
  if (k >= 1){ flash = null; return; }
  const a = UF.flashAlpha * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85); // 빠르게 켜졌다 천천히 꺼짐
  ctx.save();
  ctx.strokeStyle = flash.color;
  ctx.globalAlpha = a * 0.25;                                        // 바깥 은은한 빛
  ctx.lineWidth = UF.flashWidth * 5; ctx.strokeRect(0, 0, W, H);
  ctx.globalAlpha = a;                                               // 안쪽 선명한 테두리
  ctx.lineWidth = UF.flashWidth * 2; ctx.strokeRect(0, 0, W, H);
  ctx.restore();
}

// ---------- 테마 선택 칸 ----------
// 첫 화면·게임 오버 화면에서만 "테마" 버튼이 보임. 누르면 유리 창에 테마 카드가 나란히.
// 가진 테마: 누르면 바로 바뀜 / 안 가진 테마: 한 번 누르면 "✦ 100으로 열까요?", 한 번 더 누르면 삼
const btnTheme = document.getElementById('btnTheme');
const themeModal = document.getElementById('themeModal');
const themeList = document.getElementById('themeList');
const themeStars = document.getElementById('themeStars');
let themeOpen = false;  // 창이 열려 있으면 게임 조작을 모두 막음
let askName = null;     // "○으로 열까요?"를 묻는 중인 테마
let needName = null;    // "○개 더 필요해요"를 보여 주는 테마
const STAR_SVG = '<svg class="star" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-9Q1.6-1.6 9 0Q1.6 1.6 0 9Q-1.6 1.6-9 0Q-1.6-1.6 0-9Z"/></svg>';
document.getElementById('themeTitle').textContent = T.themeTitle;

function applyTheme(t){ // 테마 바꾸기: 하늘·기둥·네모·글자·빛 먼지까지 바로 적용, 고른 것 저장
  bindTheme(t);
  save('kkuk_theme', t.name);
  pickColors(); makeDust();
}
function openThemes(){
  if (state !== 'ready' && state !== 'over') return;
  askName = needName = null;
  renderThemes();
  themeModal.hidden = false; themeOpen = true;
}
function closeThemes(){ themeModal.hidden = true; themeOpen = false; askName = needName = null; }

// 카드 미리보기: 그 테마의 하늘 색, 기둥 두 개, 네모
function drawPreview(cnv, t){
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = 120, h = 84;
  cnv.width = w * dpr; cnv.height = h * dpr;
  const c = cnv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sk = (darkMode ? t.sky.dark : t.sky.light)[0];
  if (t.night){ drawNightPreview(c, w, h, t, sk); drawPreviewCube(c, t, h * 0.6); return; } // 밤바다는 따로
  if (t.cosmos){ drawCosmosPreview(c, w, h, t); drawPreviewCube(c, t, h * 0.6); return; } // 우주도 따로
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, sk.top); g.addColorStop(1, sk.bottom);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  const mid = [0, 1, 2].map(i => (hexRgb(sk.top)[i] + hexRgb(sk.bottom)[i]) / 2);
  const [bh, bs, bl] = rgbToHsl(mid), p = t.pillar;
  const L = darkMode ? bl + p.darkLift : bl - p.darker, Sa = bs + p.saturate, gy = h * 0.62;
  [[14, 34, 0], [70, 30, 1]].forEach(([x, pw, id]) => {
    const hue = bh + Math.sin(id * p.hueStep) * p.hueRange;
    const pg = c.createLinearGradient(0, gy, 0, h);
    pg.addColorStop(0, hsl(hue, Sa, L)); pg.addColorStop(1, hsl(hue, Sa, L - p.shade, 0));
    c.fillStyle = pg; c.fillRect(x, gy, pw, h - gy);
    c.fillStyle = hsl(hue, Sa * 0.8, L + p.topLight); c.fillRect(x, gy, pw, 2);
  });
  drawPreviewCube(c, t, gy);
}
function drawPreviewCube(c, t, gy){ // 카드 미리보기의 네모
  const cc = darkMode ? t.cube.dark : t.cube.light, s = 15, cx = 31 - s / 2, cy = gy - s;
  const cg = c.createLinearGradient(0, cy, 0, cy + s); cg.addColorStop(0, cc.top); cg.addColorStop(1, cc.bottom);
  c.fillStyle = cg;
  c.beginPath(); c.moveTo(cx + 3, cy); c.arcTo(cx + s, cy, cx + s, cy + s, 3); c.arcTo(cx + s, cy + s, cx, cy + s, 3);
  c.arcTo(cx, cy + s, cx, cy, 3); c.arcTo(cx, cy, cx + s, cy, 3); c.fill();
}
function renderThemes(){
  themeStars.innerHTML = STAR_SVG + '<b>' + Wallet.get() + '</b>';   // 창 위쪽: 내 별가루
  themeList.innerHTML = '';
  for (const t of THEMES){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tcard';
    const using = t === TH, owned = ownsTheme(t);
    let st;
    if (using) st = T.themeInUse;
    else if (owned) st = T.themeUse;
    else if (needName === t.name) st = STAR_SVG + fmt(T.themeNeed, t.price - Wallet.get());
    else if (askName === t.name) st = STAR_SVG + fmt(T.themeAsk, t.price);
    else st = STAR_SVG + t.price;
    b.classList.toggle('on', using);
    b.classList.toggle('ask', askName === t.name || needName === t.name);
    b.innerHTML = '<canvas></canvas><span class="tname"></span><span class="tstate">' + st + '</span>';
    b.querySelector('.tname').textContent = t.name;
    drawPreview(b.querySelector('canvas'), t);
    b.addEventListener('click', () => { b.blur(); pickTheme(t); });
    themeList.appendChild(b);
  }
}
function pickTheme(t){
  if (t === TH) return;
  if (ownsTheme(t)){                        // 가진 테마: 바로 바꿈
    askName = needName = null; applyTheme(t);
    Sound.tone(880, 0.06, 'triangle', 0.06);
  } else if (Wallet.get() < t.price){       // 별가루 모자람: 사지 않고 알려 줌
    askName = null; needName = t.name;
    Sound.tone(260, 0.08, 'sine', 0.05);
  } else if (askName !== t.name){           // 처음 누름: "○으로 열까요?" (실수로 사는 것 방지)
    askName = t.name; needName = null;
    Sound.tone(660, 0.05, 'triangle', 0.05);
  } else {                                  // 한 번 더 누름: 사고 바로 적용
    if (Wallet.spend(t.price)){
      ownedThemes.push(t.name); save('kkuk_themes', JSON.stringify(ownedThemes));
      shownStardust = Wallet.get();
      askName = needName = null; applyTheme(t);
      Sound.chime(1); Sound.buzz(12);
    }
  }
  renderThemes();
}
btnTheme.addEventListener('click', () => { btnTheme.blur(); openThemes(); });
themeModal.querySelector('.close').addEventListener('click', closeThemes);
themeModal.addEventListener('click', e => { if (e.target === themeModal) closeThemes(); }); // 창 바깥을 누르면 닫힘
// 창은 게임 칸 위에 덮여 있어서, 창이나 바깥 막을 누른 손가락은 게임으로 전달되지 않음 (닫으려고 누른 것도 점프 안 됨)

// ---------- 시작 ----------
resize();
reset();
let last = now();
function loop(t){
  const dt = Math.min((t - last) / 1000, 1 / 30); last = t;
  // (꺼 둔 기능) 새 것을 얻은 순간 살짝 느려졌다가 원래 속도로 (slowScale → 1)
  let speed = 1;
  if (slowT < UF.slowTime){
    const k = slowT / UF.slowTime;
    speed = UF.slowScale + (1 - UF.slowScale) * k * k;
    slowT += dt;
  }
  update(dt * speed); updateBg(dt); updateDust(dt); updateStarFx(dt); draw();
  drawFlash(dt);
  // "테마" 버튼은 첫 화면·게임 오버 화면에서만 보임
  const showThemeBtn = state === 'ready' || state === 'over';
  if (btnTheme.hidden === showThemeBtn){
    btnTheme.hidden = !showThemeBtn;
    if (!showThemeBtn) closeThemes();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
