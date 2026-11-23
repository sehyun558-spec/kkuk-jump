// =====================================================================
//  이 파일이 하는 일: 게임 규칙(점프·착지·점수) + 화면 그리기 + 터치 처리
//  숫자를 바꾸고 싶으면 이 파일 말고 settings.js를 고치세요.
// =====================================================================
(() => {
const SET = SETTINGS;
// ---------- 테마: 화면에 보이는 것 전부 (settings.js의 useTheme으로 고름) ----------
const TH = SET.themes.find(t => t.name === SET.useTheme) || SET.themes[0];
const CU = TH.cube, EF = TH.effects; // 네모 "구름 조각" 모양, 효과 색
const J = SET.jump, P = SET.pillar, R = SET.rest, WU = SET.warmup, JD = SET.judge, FX = SET.effects, F = SET.feel;

const stage = document.getElementById('stage');
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const SYS_FONT = '-apple-system,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
const UI = TH.ui;
// 둥근 글꼴: 다 받아지면 그 글꼴로, 못 받으면 폰 기본 글꼴로 (게임은 그대로 돌아감)
let fontReady = false;
if (UI.font && document.fonts && document.fonts.load){
  document.fonts.load('40px "' + UI.font + '"', '꾹점프0123456789').then(() => {
    fontReady = document.fonts.check('40px "' + UI.font + '"');
  }).catch(() => {});
}
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
  st.setProperty('--font', (UI.font ? '"' + UI.font + '",' : '') + SYS_FONT);
  bgSnap = true; // 하늘을 새 모드 색으로 바로 맞춤
}
pickColors();

// ---------- 하늘 (배경 그라데이션 테마) ----------
// 위에서 아래로 두 파스텔 색이 섞인 하늘. 점수가 오르면 다음 테마로 아주 천천히 넘어감
const SKY = TH.sky;
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
    document.body.style.background = 'linear-gradient(' + rgbStr(skyTop) + ',' + rgbStr(skyBot) + ') fixed';
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
const TEST = (() => {
  const v = Number(new URLSearchParams(location.search).get('test'));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
})();
if (TEST){
  best = TEST;
  const ver = document.getElementById('ver');
  ver.textContent += ' · 테스트 ' + TEST + '점';
  ver.classList.add('show'); // 버전 표시는 테스트 모드일 때만 보임
}
const save = (key, value) => { if (!TEST) Store.set(key, value); }; // 테스트 중엔 저장 안 함
let plays = readNumber('kkuk_plays');  // 플레이 횟수 (한 판 = 1)

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
// big = 큰 글자, faint = 흐리고 작게 (예: "콤보 5 끝")
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
  if (revealUp()){ // 공개 화면: 스페이스바·엔터로 공개, 게임 조작은 막음
    if (e.code === 'Space' || e.code === 'Enter'){ e.preventDefault(); if (!e.repeat) openReveal(); }
    return;
  }
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (!e.repeat) press();
});
addEventListener('keyup', e => { if (e.code === 'Space' && !revealUp()) release(); });

// 앱을 바꾸거나 화면이 꺼지면 힘 모으기 취소, 돌아오면 소리 깨우기
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelCharge(); else Sound.wake();
});
addEventListener('blur', cancelCharge);

// ---------- 점수 ----------
function addScore(gain){
  score += gain;
  if (score > best){
    // 게임 중 기록을 넘는 순간 "신기록!" (첫 기록일 땐 안 띄움)
    if (startBest > 0 && !passedBest){
      pop('신기록!', player.x, -F.playerSize * 4.5, true);
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
  return need >= 1 && need <= SET.alert.within ? need + '점만 더!' : '';
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
    // 봐준 착지면 네모를 기둥 끝으로 살짝 당김 (그러면 "아슬아슬!"이 뜸)
    px = player.x = Math.min(Math.max(px, n.x), n.x + n.w);
    const center = n.x + n.w / 2, dist = Math.abs(px - center);
    const edge = Math.min(px - n.x, n.x + n.w - px);
    let gain = 1;
    if (j === cur + 1 && dist <= JD.perfectLine / 2 + JD.perfectMargin){
      // 완벽! — 콤보가 쌓일수록 점수·음·흔들림·조각이 커짐
      combo++; gain = 1 + Math.min(combo, JD.maxBonus);
      player.x = center;
      burst(center, [EF.sparkColor, pillarColor(n)], FX.burstBase + combo * FX.burstPerCombo); // 흰색 + 그 기둥 색
      rings.push({x: center, r: F.playerSize * 0.6, life: 1});
      cubeFlash = 1; // 네모가 한 번 살짝 환하게 빛남
      shake = FX.shakePerfect + Math.min(combo, FX.shakeComboMax) * FX.shakePerCombo;
      Sound.buzz(18);
      Sound.tone(Sound.note(combo), 0.2, 'triangle', 0.12);
      pop(combo > 1 ? '완벽! ×' + combo : '완벽!', center, -F.playerSize * 3.3, true);
    } else {
      // 보통 착지 (기둥을 건너뛴 착지도 1점, 콤보는 끊김)
      // 완벽 콤보가 comboEndMin 이상 쌓였다가 끊기면 "콤보 ○ 끝"을 잠깐 흐리게
      if (combo >= SET.alert.comboEndMin) pop('콤보 ' + combo + ' 끝', px, -F.playerSize * 4.4, false, true);
      combo = 0;
      burst(px, ['rgba(255,255,255,0.85)'], 6);
      Sound.tone(330, 0.07, 'sine', 0.07); Sound.buzz(8);
      if (edge < JD.closeEdge) pop('아슬아슬!', px, -F.playerSize * 3.3, true);
    }
    addScore(gain);
    pop('+' + gain, player.x, -F.playerSize * 2.2, false);
    cur = j;
    fillAhead();
    while (cur > 3){ pillars.shift(); cur--; } // 지나간 기둥 정리
    camFocus = pillars[cur].x + pillars[cur].w / 2;
    state = 'idle'; player.sq = 0.6;
    return;
  }

  // 실패: 가장 가까운 기둥 끝 찾기
  let near = Infinity, np = pillars[cur + 1];
  for (let i = cur + 1; i < pillars.length; i++){
    const p = pillars[i];
    const d = Math.min(Math.abs(px - p.x), Math.abs(px - (p.x + p.w)));
    if (d < near){ near = d; np = p; }
  }
  if (near - JD.edgeForgive < JD.missNear) pop('아깝다!', px, -F.playerSize * 3, true);
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
  for (const p of pops){ p.y -= 0.18 * dt; p.life -= dt * 1.1; }
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
// 글자 쓰기. shadow = true 이면 흰 글자 밑에 옅은 그림자 (어느 하늘에서도 잘 읽히게)
function text(t, x, y, size, col, weight = 800, alpha = 1, shadow = false){
  ctx.globalAlpha = alpha; ctx.fillStyle = col;
  // 둥근 글꼴은 원래 굵어서 굵기를 따로 주지 않음 (억지로 굵히면 뭉개짐)
  ctx.font = fontReady ? size + 'px "' + UI.font + '",' + SYS_FONT : weight + ' ' + size + 'px ' + SYS_FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (shadow){
    ctx.shadowColor = (darkMode ? UI.dark : UI.light).shadow;
    ctx.shadowBlur = Math.max(4, size * 0.18); ctx.shadowOffsetY = Math.max(1, size * 0.03);
  }
  ctx.fillText(t, x, y);
  if (shadow){ ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  ctx.globalAlpha = 1;
}
// ---------- 기둥 ----------
// 색: 지금 하늘 색에서 뽑은 파스텔색 (하늘보다 한 톤 진하게). 기둥마다 색이 조금씩 흘러감
// 입체감: 테두리 없이 윗면 밝은 띠 + 몸통은 아래로 살짝 어두워짐. 아래쪽은 안개 속으로 사라짐
const PL = TH.pillar;
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
  const [bh, bs, bl] = rgbToHsl(mid);
  // 밝은 화면: 하늘보다 진하게 / 다크 모드: 하늘보다 밝게 (차분한 색)
  const baseL = darkMode ? bl + PL.darkLift : bl - PL.darker;
  const baseS = bs + PL.saturate;
  plBase = {bh, baseS, baseL};
  const fogTop = GY + (H - GY) * PL.fogStart, fogBot = GY + (H - GY) * PL.fogEnd;
  pillars.forEach((p, i) => {
    if (p.id === undefined) p.id = pillarSeq++;
    const sx = toX(p.x), w = p.w * S;
    if (sx > W + 50 || sx + w < -50) return;
    const d = i === cur ? dip : 0; // 서 있는 발판만 눌림
    const h = bh + Math.sin(p.id * PL.hueStep) * PL.hueRange; // 기둥마다 색이 조금씩 흘러감
    const top = GY + d;
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
  ctx.fillStyle = skyGrad || bgCss; ctx.fillRect(0, 0, W, H); // 하늘 그라데이션
  drawDust(); // 빛 먼지 (기둥 뒤에서 떠다님)
  ctx.save();
  if (shake > 0.3) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  const dip = state === 'charge' ? (charge / J.maxPower) * F.padDip * S : 0;
  const falling = state === 'fall' || state === 'over';
  if (falling){ drawPlayer(dip); drawPillars(dip); } else { drawPillars(dip); drawPlayer(dip); }

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
  for (const p of pops){
    const size = p.faint ? S * 0.045 : p.big ? S * 0.065 : S * 0.05;
    text(p.text, toX(p.x), toY(p.y), size, '#fff', 800, Math.min(1, p.life * 1.5) * (p.faint ? 0.55 : 1), true);
  }
  ctx.restore();

  // 게임 중 점수: 흰색 큰 숫자 + 옅은 그림자, 아래 작은 글자들도 흰색
  if (state !== 'ready' && state !== 'over'){
    const big = Math.min(S * 0.22, 104);
    let y = H * 0.14;
    text(String(score), W / 2, y, big, '#fff', 800, 1, true);
    y += big * 0.72;
    if (best > 0){ text('최고 ' + best, W / 2, y, 15, '#fff', 600, 0.85, true); y += 22; } // 기록이 없으면 안 보임 (B6)
    if (combo > 1){ text('콤보 ' + combo, W / 2, y, 16, '#fff', 800, 1, true); y += 22; }
    const need = needText();
    if (need) text(need, W / 2, y, 16, '#fff', 800, 0.95, true);
  }

  // 첫 화면: "꾹 점프"가 둥실둥실 천천히 떠 있음
  if (state === 'ready'){
    const bob = Math.sin(now() / (UI.floatTime * 1000) * Math.PI * 2) * UI.floatTitle;
    const ty = H * 0.2 + bob;
    text('꾹 점프', W / 2, ty, Math.min(S * 0.17, 64), '#fff', 900, 1, true);
    text('꾹 눌러서 힘을 모으고, 떼면 점프', W / 2, H * 0.2 + 58, 16, '#fff', 600, 0.9, true);
    text('빛나는 선 위에 착지하면 완벽!', W / 2, H * 0.2 + 84, 16, '#fff', 700, 0.9, true);
    if (best) text('최고 기록 ' + best, W / 2, H * 0.2 + 118, 14, '#fff', 600, 0.75, true);
  }

  // 게임 오버: 뿌연 반투명 막 위에 점수가 떠 있음
  if (state === 'over'){
    const t = Math.min((now() - overAt) / 300, 1);
    ctx.globalAlpha = t; ctx.fillStyle = (darkMode ? UI.dark : UI.light).overVeil; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const cy = H * 0.36;
    text('점수', W / 2, cy - 74, 17, '#fff', 600, 0.85 * t, true);
    text(String(score), W / 2, cy, Math.min(S * 0.28, 128), '#fff', 900, t, true);
    if (newBest) text('최고 기록 달성!', W / 2, cy + 76, 19, '#fff', 800, t, true);
    else if (best > 0){
      const need = needText();
      text('최고 ' + best + (need ? '  ·  ' + need : ''), W / 2, cy + 76, 16, '#fff', 700, 0.85 * t, true);
    }
    // 숨 쉬듯 천천히 밝아졌다 흐려짐
    const breath = 0.5 - 0.5 * Math.cos(now() / (UI.breathTime * 1000) * Math.PI * 2);
    text('탭해서 다시 하기', W / 2, H * 0.72, 18, '#fff', 800, t * (0.35 + 0.6 * breath), true);
  }
}

// ---------- 빛 먼지 ----------
// 동그랗고 흐린 점들이 아주 천천히 위로 떠오름. 다크 모드에서는 별처럼 반짝임
const DU = TH.dust;
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
    m.y -= m.sp * dt; m.ph += dt * 0.6;
    if (m.y < -10){ Object.assign(m, newMote(H + 10)); }
  }
}
function drawDust(){
  const star = darkMode;
  const img = sprite('glow', star ? '235,235,255' : '255,255,255');
  const t = now() / 1000;
  for (const m of dust){
    const x = m.x + Math.sin(m.ph) * DU.sway;
    // 다크 모드: 별처럼 천천히 반짝임
    const tw = star ? 0.55 + 0.45 * Math.sin(t * DU.twinkle + m.ph * 3) : 1;
    const sz = m.size * (star ? 0.8 : 1) * 2.6;               // 번지는 빛 포함 크기
    ctx.globalAlpha = m.a * tw;
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
  update(dt * speed); updateBg(dt); updateDust(dt); draw();
  drawFlash(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
