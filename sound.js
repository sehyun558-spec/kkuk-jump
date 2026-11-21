// =====================================================================
//  이 파일이 하는 일: 효과음 + 진동 + 소리·진동 켜기/끄기 기억
//  소리 파일 없이, 브라우저가 직접 "삐" 소리를 만들어 냅니다.
// =====================================================================

// ---------- 저장 (이 폰의 이 브라우저에만 저장됨) ----------
// 시크릿 모드 등에서 저장이 막혀도 게임이 멈추지 않게 try로 감쌉니다.
const Store = {
  get(key){ try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, value){ try { localStorage.setItem(key, String(value)); } catch (e) {} },
};

const Sound = (() => {
  // 아이폰(사파리)은 웹사이트 진동을 지원하지 않습니다. 안드로이드만 됩니다.
  const canVibrate = typeof navigator.vibrate === 'function';

  let soundOn = Store.get('kkuk_sound') !== '0';  // 처음엔 켜짐
  let vibeOn  = Store.get('kkuk_vibe')  !== '0';

  let ac = null; // 소리 만드는 장치 (AudioContext: 브라우저 안의 작은 신디사이저)

  function make(){
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { return new AC(); } catch (e) { return null; }
  }

  // 실제로 소리 하나 내기 (켜기/끄기 설정과 상관없이)
  function blip(freq, dur, type, vol){
    try {
      if (!ac) ac = make();
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + dur + 0.02);
    } catch (e) {}
  }

  // 소리 깨우기: 화면을 누를 때마다, 게임으로 돌아올 때 부릅니다.
  // 아이폰은 게임 중 전화·알람이 울리면 소리 장치가 "멈춤(interrupted)" 상태가 되어
  // 새로고침 전까지 소리가 안 났습니다(B10). 여기서 다시 켜거나, 안 되면 새로 만듭니다.
  function wake(){
    try {
      if (ac && (ac.state === 'interrupted' || ac.state === 'closed')){
        try { ac.close().catch(() => {}); } catch (e) {}
        ac = null;
      }
      if (!ac) ac = make();
      if (!ac) return;
      if (ac.state !== 'running'){
        const a = ac;
        a.resume().catch(() => { if (ac === a) ac = null; }); // 실패하면 다음에 새로 만듦
      }
      // 아이폰은 손가락이 닿은 순간 소리를 한 번 내야 소리가 풀립니다 (안 들리는 크기)
      blip(1, 0.01, 'sine', 0.0001);
    } catch (e) {}
  }

  // 효과음 (소리가 꺼져 있으면 아무것도 안 함)
  function tone(freq, dur = 0.12, type = 'sine', vol = 0.12){
    if (!soundOn) return;
    blip(freq, dur, type, vol * SETTINGS.effects.volume);
  }

  // "완벽!" 콤보가 오를수록 음이 올라감 (도레미솔라 → 한 옥타브 위 …)
  const SCALE = [0, 2, 4, 7, 9];
  function note(n){
    const i = Math.min(n - 1, 14);
    return 523 * Math.pow(2, (SCALE[i % 5] + 12 * Math.floor(i / 5)) / 12);
  }

  // 진동 (꺼져 있거나 지원 안 하는 폰이면 아무것도 안 함)
  function buzz(pattern){
    if (!vibeOn || !canVibrate) return;
    try { navigator.vibrate(pattern); } catch (e) {}
  }

  // ---------- 오른쪽 위 소리·진동 버튼 ----------
  const btnSound = document.getElementById('btnSound');
  const btnVibe  = document.getElementById('btnVibe');

  function paint(){
    btnSound.textContent = soundOn ? '소리 켜짐' : '소리 꺼짐';
    btnSound.classList.toggle('off', !soundOn);
    btnSound.setAttribute('aria-pressed', String(soundOn));
    btnVibe.textContent = vibeOn ? '진동 켜짐' : '진동 꺼짐';
    btnVibe.classList.toggle('off', !vibeOn);
    btnVibe.setAttribute('aria-pressed', String(vibeOn));
  }

  // 아이폰처럼 진동이 안 되는 폰에서는 진동 버튼을 숨깁니다
  if (!canVibrate) btnVibe.hidden = true;

  btnSound.addEventListener('click', () => {
    soundOn = !soundOn;
    Store.set('kkuk_sound', soundOn ? 1 : 0);
    paint();
    if (soundOn){ wake(); tone(660, 0.08, 'triangle', 0.08); } // 켜졌다는 확인음
    btnSound.blur(); // 스페이스바가 버튼을 다시 누르지 않게
  });

  btnVibe.addEventListener('click', () => {
    vibeOn = !vibeOn;
    Store.set('kkuk_vibe', vibeOn ? 1 : 0);
    paint();
    if (vibeOn) buzz(20); // 켜졌다는 확인 진동
    btnVibe.blur();
  });

  paint();

  return { wake, tone, note, buzz };
})();
