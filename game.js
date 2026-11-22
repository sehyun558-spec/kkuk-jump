// =====================================================================
//  이 파일이 하는 일: 게임 규칙(점프·착지·점수) + 화면 그리기 + 터치 처리
//  숫자를 바꾸고 싶으면 이 파일 말고 settings.js를 고치세요.
// =====================================================================
(() => {
const SET = SETTINGS;
const J = SET.jump, P = SET.pillar, R = SET.rest, WU = SET.warmup, JD = SET.judge, FX = SET.effects, F = SET.feel;

const stage = document.getElementById('stage');
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const FONT = '-apple-system,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
const now = () => performance.now();

// 게임 속 위치·크기는 모두 "기준 크기(S)" 단위로 계산하고, 그릴 때만 픽셀로 바꿉니다.
// 그래서 게임 중 폰을 돌려 화면 크기가 바뀌어도 네모와 기둥이 함께 맞춰집니다 (B2).

// ---------- 색 (밝은/어두운 화면) ----------
let C, darkMode = false;
let skinsReady = false; // 스킨 버튼이 만들어진 뒤에야 색을 다시 칠함
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function pickColors(){
  const t = document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && darkQuery.matches);
  darkMode = dark;
  C = dark ? SET.colors.dark : SET.colors.light;
  if (skinsReady) paintSkins(); // 다크 모드가 바뀌면 스킨 버튼 색도 바꿈
  // 버튼·안내 글자 색도 같은 색으로 (style.css의 --bg 등을 덮어씀)
  const st = document.documentElement.style;
  st.setProperty('--bg', C.bg); st.setProperty('--ink', C.ink);
  st.setProperty('--sub', C.sub); st.setProperty('--accent', C.accent);
  document.body.style.background = C.bg;
}
pickColors();
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
addEventListener('resize', resize);

// ---------- 저장된 기록 ----------
// 이상한 값(숫자가 아닌 값)이 저장돼 있으면 0부터 다시 (B12)
function readNumber(key){
  const v = Number(Store.get(key));
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}
let best  = readNumber('kkuk_best');   // 최고 기록
let plays = readNumber('kkuk_plays');  // 플레이 횟수 (한 판 = 1)

// ---------- 스킨 (점수 달성 보상) ----------
// 최고 기록이 스킨의 해제 점수 이상이면 열림. 그래서 이미 기록이 높은 사람은 바로 열린 상태.
const SKINS = SET.skins, LOOK = SET.skinLook;
const skinsEl = document.getElementById('skins');
const isUnlocked = sk => best >= sk.unlock;
let skinId = Store.get('kkuk_skin') || SKINS[0].id; // 고른 스킨 (저장됨)
// 예전 50점 금색('gold')을 골랐던 사람: 아직 100점 전이면 같은 자리의 은색으로
if (skinId === 'gold' && best < (SKINS.find(s => s.id === 'gold') || {unlock: 0}).unlock) skinId = 'silver';
// 지금 쓸 스킨: 고른 게 없거나 잠겨 있으면 기본
function currentSkin(){
  const sk = SKINS.find(s => s.id === skinId);
  return sk && isUnlocked(sk) ? sk : (SKINS.find(isUnlocked) || SKINS[0]); // 열린 스킨 중 첫 번째
}
const skinColors = sk => darkMode ? sk.dark : sk.light;

// 아래쪽 가운데 작은 네모 버튼 만들기 (게임 화면 칸 밖이라 눌러도 점프 안 됨)
function buildSkins(){
  skinsEl.innerHTML = '';
  SKINS.forEach(sk => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span class="frame"><span class="chip"><i></i><b></b></span></span><span class="cond"></span>';
    b.addEventListener('click', () => {
      b.blur(); // 스페이스바가 버튼을 다시 누르지 않게
      if (!isUnlocked(sk)) return; // 잠긴 스킨은 못 고름
      skinId = sk.id;
      Store.set('kkuk_skin', skinId);
      paintSkins();
      Sound.tone(660, 0.06, 'triangle', 0.06);
    });
    skinsEl.appendChild(b);
  });
  skinsReady = true;
}
// 버튼 색·테두리·잠김 표시 다시 칠하기
function paintSkins(){
  const sel = currentSkin();
  [...skinsEl.children].forEach((b, i) => {
    const sk = SKINS[i], col = skinColors(sk), open = isUnlocked(sk);
    b.classList.toggle('on', sk === sel);       // 고른 스킨은 테두리
    b.classList.toggle('locked', !open);        // 잠긴 스킨은 흐리게
    b.setAttribute('aria-label', sk.name + ' 스킨' + (open ? '' : ' (잠김, ' + sk.unlock + '점)'));
    b.querySelector('.chip').style.background = col.body;
    const inner = b.querySelector('.chip i');
    inner.style.display = col.inner ? 'block' : 'none';
    if (col.inner) inner.style.background = col.inner;
    b.querySelector('.chip b').style.display = col.shine ? 'block' : 'none'; // 빛줄기
    b.querySelector('.cond').textContent = open ? '' : sk.unlock + '점'; // 조건 작게
  });
}
buildSkins();
paintSkins();

// ---------- 스킨 창 열기·닫기 ----------
const btnSkin = document.getElementById('btnSkin');
const skinModal = document.getElementById('skinModal');
let skinOpen = false; // 창이 열려 있으면 게임 조작을 모두 막음
function openSkins(){
  if (state !== 'ready' && state !== 'over') return;
  paintSkins(); // 방금 해제된 스킨 반영
  skinModal.hidden = false; skinOpen = true;
}
function closeSkins(){
  skinModal.hidden = true; skinOpen = false;
}
btnSkin.addEventListener('click', () => { btnSkin.blur(); openSkins(); });
skinModal.querySelector('.close').addEventListener('click', closeSkins);
// 창 바깥(반투명 막)을 누르면 닫힘. 창 안을 누른 건 무시
skinModal.addEventListener('click', e => { if (e.target === skinModal) closeSkins(); });
// 창은 게임 칸 위에 덮여 있어서, 창이나 막을 누른 손가락은 게임으로 전달되지 않음
// (그래서 창을 닫으려고 누른 것도 점프로 이어지지 않음)

// ---------- 게임 상태 ----------
// state: 'ready'(첫 화면) / 'idle'(기둥 위 대기) / 'charge'(힘 모으는 중) / 'fly'(점프 중) / 'fall'(떨어지는 중) / 'over'(게임 오버)
let state, pillars, cur, player, camX, camFocus, score, combo, charge, jump;
let shake = 0, parts = [], pops = [], rings = [];
let trail = [];          // 점프 중 잔상 (trail이 있는 스킨)
let ripples = [];        // 착지 파동 고리 (골드 스킨)
const RP = SET.ripple;
let announced = {};      // 이번 판에 "새 스킨 획득!"을 이미 띄운 스킨
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
  score = 0; combo = 0; cur = 0; charge = 0;
  newBest = false; passedBest = false; startBest = best;
  parts = []; pops = []; rings = []; trail = []; ripples = []; announced = {};
  wideIn = randInt(R.everyMin, R.everyMax);
  made = 0;
  pillars = [{x: 0, w: P.firstWidth}];
  fillAhead();
  player = {x: P.firstWidth / 2, y: 0, vy: 0, sq: 1, rot: 0, dir: 1};
  camFocus = player.x; camX = camGoal();
  state = firstGame ? 'ready' : 'idle';
}

// ---------- 효과 ----------
// 튀는 조각: 한 번에 maxBurst개까지만 (B8, 버벅임 방지)
function burst(x, col, n){
  n = Math.min(n, FX.maxBurst);
  for (let i = 0; i < n; i++){
    const a = -Math.PI * Math.random(), v = 0.4 + Math.random() * 1.1;
    parts.push({x, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 0.008 + Math.random() * 0.012, life: 1, col});
  }
}
// 떠오르는 글자 (y는 기둥 윗면에서 위로 얼마나, 기준 크기 단위)
function pop(text, x, y, col, big){ pops.push({text, x, y, col, big, life: 1}); }

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
  if (skinOpen) return;                                    // 스킨 창이 열려 있으면 점프 안 됨
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
  if (skinOpen){ // 스킨 창이 열려 있으면: Esc로 닫기, 스페이스바는 무시
    if (e.code === 'Escape') closeSkins();
    if (e.code === 'Space') e.preventDefault();
    return;
  }
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (!e.repeat) press();
});
addEventListener('keyup', e => { if (e.code === 'Space' && !skinOpen) release(); });

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
      pop('신기록!', player.x, -F.playerSize * 4.5, C.accent, true);
      Sound.tone(784, 0.18, 'triangle', 0.08);
    }
    passedBest = true;
    best = score;
    Store.set('kkuk_best', best); // 넘는 순간마다 바로 저장 (B11)
  }
  // 처음으로 스킨 해제 점수를 넘는 순간 "새 스킨 획득!"
  for (const sk of SKINS){
    if (sk.unlock > 0 && startBest < sk.unlock && score >= sk.unlock && !announced[sk.id]){
      announced[sk.id] = true;
      pop('새 스킨 획득!', player.x, -F.playerSize * 5.7, C.accent, true);
      Sound.tone(988, 0.2, 'triangle', 0.08);
    }
  }
}
// "○점만 더!": 기록을 깨려면 몇 점 더 필요한지 (동점이 아니라 넘어야 함)
function needText(){
  if (startBest < SET.alert.minBest) return '';
  const need = startBest - score + 1;
  return need >= 1 && need <= SET.alert.within ? need + '점만 더!' : '';
}

// ---------- 착지 판정 ----------
// 착지 파동: 발밑에서 얇은 고리가 옆으로 퍼지며 사라짐 (ripple 색이 있는 스킨만 = 골드)
function addRipple(x, perfect){
  const color = skinColors(currentSkin()).ripple;
  if (!color) return;
  for (let i = 0; i < RP.count; i++){
    ripples.push({x, t: -i * RP.delay, perfect, color}); // 두 번째 고리는 조금 늦게 시작
  }
}

// 기둥 위에 있나? (몰래 봐주기: 끝에서 edgeForgive만큼 벗어나도 위에 있는 걸로 침)
const onPillar = (px, p) => px >= p.x - JD.edgeForgive && px <= p.x + p.w + JD.edgeForgive;

function land(){
  let px = player.x;
  const c = pillars[cur];
  // 거의 안 뛰어서 지금 기둥 위에 그대로
  if (onPillar(px, c)){
    player.x = Math.min(Math.max(px, c.x), c.x + c.w);
    addRipple(player.x, false);
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
      burst(center, C.accent, FX.burstBase + combo * FX.burstPerCombo);
      rings.push({x: center, r: F.playerSize * 0.6, life: 1});
      shake = FX.shakePerfect + Math.min(combo, FX.shakeComboMax) * FX.shakePerCombo;
      Sound.buzz(18);
      Sound.tone(Sound.note(combo), 0.2, 'triangle', 0.12);
      pop(combo > 1 ? '완벽! ×' + combo : '완벽!', center, -F.playerSize * 3.3, C.accent, true);
    } else {
      // 보통 착지 (기둥을 건너뛴 착지도 1점, 콤보는 끊김)
      combo = 0;
      burst(px, C.sub, 6);
      Sound.tone(330, 0.07, 'sine', 0.07); Sound.buzz(8);
      if (edge < JD.closeEdge) pop('아슬아슬!', px, -F.playerSize * 3.3, C.ink, true);
    }
    addRipple(player.x, gain > 1); // gain > 1 이면 "완벽!" 착지
    addScore(gain);
    pop('+' + gain, player.x, -F.playerSize * 2.2, gain > 1 ? C.accent : C.ink, false);
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
  if (near - JD.edgeForgive < JD.missNear) pop('아깝다!', px, -F.playerSize * 3, C.accent, true);
  player.dir = px < np.x ? -1 : 1;
  player.vy = 0; state = 'fall'; fallAt = now();
  shake = FX.shakeFail; Sound.buzz([30, 40, 70]);
  Sound.tone(150, 0.35, 'sawtooth', 0.06);
}
function gameOver(){
  state = 'over'; overAt = now();
  plays++; Store.set('kkuk_plays', plays);
  newBest = score > startBest;
  if (newBest) Sound.tone(784, 0.25, 'triangle', 0.1);
}

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
    // 잔상 기록 (잔상 색이 있는 스킨만, 점프하는 동안만)
    if (skinColors(currentSkin()).trail && LOOK.trailCount > 0){
      trail.push({x: player.x, y: player.y, rot: player.rot, sq: player.sq, life: 1});
      if (trail.length > LOOK.trailCount) trail.shift();
    }
    if (k >= 1){ player.y = 0; player.rot = 0; land(); }
  }
  for (const t of trail) t.life -= dt * LOOK.trailFade; // 잔상은 금방 사라짐
  trail = trail.filter(t => t.life > 0);
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
  for (const r of ripples) r.t += dt;
  ripples = ripples.filter(r => r.t < RP.time);
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
function text(t, x, y, size, col, weight = 800, alpha = 1){
  ctx.globalAlpha = alpha; ctx.fillStyle = col;
  ctx.font = weight + ' ' + size + 'px ' + FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t, x, y); ctx.globalAlpha = 1;
}
function drawPillars(dip){
  pillars.forEach((p, i) => {
    const sx = toX(p.x), w = p.w * S;
    if (sx > W + 50 || sx + w < -50) return;
    const d = i === cur ? dip : 0; // 서 있는 발판만 눌림
    ctx.fillStyle = C.ink;
    ctx.fillRect(sx, GY + d, w, H - GY + 20);
    if (i > cur || state === 'ready'){ // 빨간 선
      const lw = JD.perfectLine * S;
      ctx.fillStyle = C.accent;
      ctx.fillRect(sx + w / 2 - lw / 2, GY + d, lw, Math.max(3, S * 0.008));
    }
  });
}
// 네모 하나 그리기 (찌그러짐 sq·회전 rot 그대로). inner가 있으면 가운데 작은 네모도
// 네모 하나 그리기 (찌그러짐 sq·회전 rot 그대로 따라감)
// look.body = 색, look.inner = 가운데 작은 네모 색, look.shine = 왼쪽 위 빛줄기
function drawSquare(sx, groundY, rot, sq, look, alpha){
  const s = F.playerSize * S, w = s * (1 + (1 - sq) * 0.55), h = s * sq;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(sx, groundY - h / 2);
  ctx.rotate(rot);
  ctx.fillStyle = look.body;
  rrect(-w / 2, -h / 2, w, h, s * 0.2); ctx.fill();
  if (look.inner){
    const iw = w * LOOK.innerSize, ih = h * LOOK.innerSize;
    ctx.fillStyle = look.inner;
    rrect(-iw / 2, -ih / 2, iw, ih, s * LOOK.innerRound); ctx.fill();
  }
  if (look.shine){
    // 왼쪽 위 얇은 흰 대각선 빛줄기: 가운데가 가장 밝고 양 끝은 흐려짐. 네모 밖으로 안 나가게 잘라냄
    rrect(-w / 2, -h / 2, w, h, s * 0.2); ctx.clip();
    const x1 = -w / 2 + w * 0.1, y1 = -h / 2 + h * 0.42, x2 = -w / 2 + w * 0.42, y2 = -h / 2 + h * 0.1;
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = alpha * LOOK.shineAlpha;
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, s * LOOK.shineWidth); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.restore();
}
function drawPlayer(dip){
  // 네모 색은 고른 스킨을 따라감 (빨간 선·"완벽!" 같은 다른 빨간색은 그대로)
  const col = skinColors(currentSkin());
  // 잔상: 오래된 것일수록 흐리게, 네모 뒤에
  if (col.trail){
    trail.forEach((t, i) => {
      const a = LOOK.trailAlpha * t.life * (i + 1) / trail.length;
      drawSquare(toX(t.x), GY + t.y * S, t.rot, t.sq, {body: col.trail}, a);
    });
  }
  const sy = GY + (state === 'charge' || state === 'idle' ? dip : 0) + player.y * S;
  drawSquare(toX(player.x), sy, player.rot, player.sq, col, 1);
}
function draw(){
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (shake > 0.3) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  const dip = state === 'charge' ? (charge / J.maxPower) * F.padDip * S : 0;
  const falling = state === 'fall' || state === 'over';
  if (falling){ drawPlayer(dip); drawPillars(dip); } else { drawPillars(dip); drawPlayer(dip); }

  for (const r of rings){
    ctx.globalAlpha = Math.max(r.life, 0); ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(toX(r.x), GY, r.r * S, r.r * S * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // 골드 착지 파동: 처음엔 빠르게 퍼지다 느려지고, 퍼질수록 흐려짐
  for (const r of ripples){
    if (r.t < 0) continue; // 아직 시작 전 (두 번째 고리)
    const k = r.t / RP.time, ease = 1 - Math.pow(1 - k, 3);
    const start = F.playerSize * 0.6, end = r.perfect ? RP.perfectSize : RP.size;
    const rad = (start + (end - start) * ease) * S;
    ctx.globalAlpha = (r.perfect ? RP.perfectAlpha : RP.alpha) * (1 - k);
    ctx.strokeStyle = r.color; ctx.lineWidth = RP.line * (r.perfect ? 1.5 : 1);
    ctx.beginPath(); ctx.ellipse(toX(r.x), GY, rad, rad * RP.flat, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of parts){
    const sz = p.s * S;
    ctx.globalAlpha = Math.max(p.life, 0); ctx.fillStyle = p.col;
    ctx.fillRect(toX(p.x) - sz / 2, toY(p.y) - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  for (const p of pops) text(p.text, toX(p.x), toY(p.y), p.big ? S * 0.065 : S * 0.05, p.col, 800, Math.min(1, p.life * 1.5));
  ctx.restore();

  // 게임 중 점수
  if (state !== 'ready' && state !== 'over'){
    const big = Math.min(S * 0.2, 96);
    let y = H * 0.14;
    text(String(score), W / 2, y, big, C.ink, 800);
    y += big * 0.72;
    if (best > 0){ text('최고 ' + best, W / 2, y, 14, C.sub, 600); y += 22; } // 기록이 없으면 안 보임 (B6)
    if (combo > 1){ text('콤보 ' + combo, W / 2, y, 15, C.accent, 800); y += 22; }
    const need = needText();
    if (need) text(need, W / 2, y, 15, C.accent, 800);
  }

  // 첫 화면 설명
  if (state === 'ready'){
    text('꾹 점프', W / 2, H * 0.2, Math.min(S * 0.15, 56), C.ink, 900);
    text('꾹 눌러서 힘을 모으고, 떼면 점프', W / 2, H * 0.2 + 52, 16, C.sub, 600);
    text('빨간 선 위에 착지하면 완벽!', W / 2, H * 0.2 + 78, 16, C.accent, 700);
    if (best) text('최고 기록 ' + best, W / 2, H * 0.2 + 112, 14, C.sub, 600);
  }

  // 게임 오버 화면
  if (state === 'over'){
    const t = Math.min((now() - overAt) / 250, 1);
    ctx.globalAlpha = t; ctx.fillStyle = C.veil; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const cy = H * 0.36;
    text('점수', W / 2, cy - 70, 16, C.sub, 600, t);
    text(String(score), W / 2, cy, Math.min(S * 0.26, 120), C.ink, 900, t);
    if (newBest) text('최고 기록 달성!', W / 2, cy + 72, 18, C.accent, 800, t);
    else if (best > 0){
      const need = needText();
      text('최고 ' + best + (need ? '  ·  ' + need : ''), W / 2, cy + 72, 16, C.sub, 700, t);
    }
    const blink = 0.55 + 0.45 * Math.sin(now() / 260);
    text('탭해서 다시 하기', W / 2, H * 0.72, 18, C.ink, 800, t * blink);
  }
}

// ---------- 시작 ----------
resize();
reset();
let last = now();
function loop(t){
  const dt = Math.min((t - last) / 1000, 1 / 30); last = t;
  update(dt); draw();
  // "스킨" 버튼은 첫 화면·게임 오버 화면에서만 보임
  const showSkinBtn = state === 'ready' || state === 'over';
  if (btnSkin.hidden === showSkinBtn){
    btnSkin.hidden = !showSkinBtn;
    if (!showSkinBtn) closeSkins();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
