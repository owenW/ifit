// ============================================================
// Pocket Commander - Playable Prototype
// A QB Training Roguelike Flag Football Game
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// -- Responsive sizing --
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// -- Constants --
const FIELD_GREEN = '#2d5a1e';
const FIELD_LIGHT = '#347a24';
const LINE_WHITE = 'rgba(255,255,255,0.7)';
const ENDZONE_RED = '#8b1a1a';
const ENDZONE_BLUE = '#1a3a8b';
const GOLD = '#f9a825';
const RED = '#e53935';
const GREEN = '#43a047';
const YELLOW = '#fdd835';
const BLUE = '#1e88e5';
const WHITE = '#ffffff';
const DARK = '#1a1a2e';

// -- Audio (Web Audio API synth) --
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, duration, type, vol) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq;
  g.gain.value = vol || 0.15;
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  o.stop(audioCtx.currentTime + duration);
}
function sfxSnap() { playTone(800, 0.08, 'square', 0.2); playTone(400, 0.05, 'square', 0.15); }
function sfxThrow() { playTone(300, 0.15, 'sawtooth', 0.1); playTone(600, 0.1, 'sine', 0.08); }
function sfxCatch() { playTone(1200, 0.1, 'sine', 0.2); playTone(1600, 0.08, 'sine', 0.15); }
function sfxTD() { for(let i=0;i<5;i++) setTimeout(()=>playTone(400+i*200,0.15,'square',0.2), i*80); }
function sfxInt() { playTone(200, 0.3, 'sawtooth', 0.2); playTone(150, 0.4, 'sawtooth', 0.15); }
function sfxSack() { playTone(100, 0.3, 'square', 0.2); }
function sfxWhistle() { playTone(900, 0.08, 'sine', 0.2); playTone(1100, 0.15, 'sine', 0.25); }
function sfxClick() { playTone(1000, 0.05, 'sine', 0.1); }
function sfxCard() { playTone(500, 0.06, 'triangle', 0.12); playTone(700, 0.04, 'triangle', 0.1); }
function sfxBuzz() { playTone(150, 0.2, 'sawtooth', 0.12); }
function sfxSuccess() { playTone(523, 0.1, 'sine', 0.15); setTimeout(()=>playTone(659, 0.1, 'sine', 0.15), 100); setTimeout(()=>playTone(784, 0.15, 'sine', 0.2), 200); }

// -- Game State Machine --
const GamePhase = {
  TITLE: 'title',
  TUTORIAL: 'tutorial',
  SEASON_MAP: 'season_map',
  PRE_GAME: 'pre_game',
  PLAY_SELECT: 'play_select',
  PRE_SNAP: 'pre_snap',
  SNAP_TRANSITION: 'snap_transition',
  EXECUTION: 'execution',
  THROW_ANIM: 'throw_anim',
  RESULT: 'result',
  DRIVE_SUMMARY: 'drive_summary',
  DEFENSE_SELECT: 'defense_select',
  DEFENSE_GUESS: 'defense_guess',
  DEFENSE_PULL_FLAG: 'defense_pull_flag',
  DEFENSE_RESULT: 'defense_result',
  HALFTIME: 'halftime',
  GAME_OVER: 'game_over',
  SHOP: 'shop',
  SEASON_END: 'season_end',
  GAME_WIN: 'game_win',
};

// -- Tactical Cards --
const PLAYS = [
  { id:'slant', name:'Slant', type:'short', desc:'斜切内线', beats:['cover3','zone'], weakTo:['man'], icon:'↗', color:'#4fc3f7',
    routes: [{dx:0.15, dy:-0.3, curve:0},{dx:-0.1, dy:-0.25, curve:0}] },
  { id:'out', name:'Out Route', type:'short', desc:'外切边线', beats:['man'], weakTo:['cover2'], icon:'→', color:'#81c784',
    routes: [{dx:0.25, dy:-0.2, curve:0},{dx:-0.2, dy:-0.15, curve:0}] },
  { id:'curl', name:'Curl', type:'short', desc:'跑出转身', beats:[], weakTo:[], icon:'↩', color:'#aed581',
    routes: [{dx:0.05, dy:-0.35, curve:0},{dx:-0.05, dy:-0.3, curve:0}] },
  { id:'screen', name:'Screen', type:'special', desc:'短传给前方', beats:['blitz'], weakTo:['cover3'], icon:'⟵', color:'#fff176',
    routes: [{dx:-0.05, dy:0.05, curve:0},{dx:0.1, dy:-0.1, curve:0}] },
  { id:'dig', name:'Dig/In', type:'mid', desc:'内切中路', beats:['cover2'], weakTo:['man'], icon:'↙', color:'#7986cb',
    routes: [{dx:0.2, dy:-0.4, curve:0.3},{dx:-0.15, dy:-0.35, curve:-0.2}] },
  { id:'post', name:'Post', type:'mid', desc:'斜切深中', beats:['cover2'], weakTo:['cover3'], icon:'↖', color:'#9575cd',
    routes: [{dx:0.1, dy:-0.5, curve:0.2},{dx:-0.05, dy:-0.45, curve:-0.1}] },
  { id:'corner', name:'Corner', type:'mid', desc:'外切深区', beats:['cover3'], weakTo:['cover2'], icon:'↗', color:'#4dd0e1',
    routes: [{dx:0.3, dy:-0.45, curve:-0.2},{dx:-0.25, dy:-0.4, curve:0.15}] },
  { id:'go', name:'Go/Fly', type:'long', desc:'直线冲刺', beats:['man'], weakTo:['cover2','cover3'], icon:'↑', color:'#ef5350',
    routes: [{dx:0.15, dy:-0.65, curve:0},{dx:-0.1, dy:-0.6, curve:0}] },
  { id:'drag', name:'Drag', type:'mid', desc:'横穿底线', beats:['zone'], weakTo:['man'], icon:'↔', color:'#78909c',
    routes: [{dx:0.3, dy:-0.2, curve:0},{dx:-0.25, dy:-0.25, curve:0}] },
  { id:'playaction', name:'Play Action', type:'special', desc:'假跑真传', beats:['blitz','man'], weakTo:['cover2'], icon:'🎭', color:'#ff8a65',
    routes: [{dx:0.1, dy:-0.45, curve:0.15},{dx:-0.15, dy:-0.4, curve:-0.1}] },
  { id:'qbdraw', name:'QB Draw', type:'run', desc:'QB持球跑', beats:['cover3','cover2'], weakTo:['blitz'], icon:'🏃', color:'#a1887f',
    routes: [{dx:0.1, dy:-0.15, curve:0},{dx:-0.1, dy:-0.2, curve:0}] },
  { id:'deepcross', name:'Deep Cross', type:'long', desc:'深度交叉', beats:['zone','cover3'], weakTo:['man'], icon:'✕', color:'#ce93d8',
    routes: [{dx:-0.2, dy:-0.55, curve:0.3},{dx:0.15, dy:-0.5, curve:-0.25}] },
];

const DEFENSES = [
  { id:'man', name:'Man盯人', desc:'每人贴身盯防', color:'#ef5350', icon:'👤' },
  { id:'cover2', name:'Cover 2', desc:'双安全卫深区', color:'#42a5f5', icon:'2️⃣' },
  { id:'cover3', name:'Cover 3', desc:'三人分区深防', color:'#66bb6a', icon:'3️⃣' },
  { id:'blitz', name:'Blitz突袭', desc:'多人冲向QB', color:'#ffa726', icon:'⚡' },
];

// -- Game State --
let game = null;
function newGame() {
  return {
    phase: GamePhase.TITLE,
    // QB stats
    qb: { name:'Rookie', acc:40, arm:35, read:30, mob:30, xp:0, level:1 },
    // Season
    season: { number:1, gameIndex:0, wins:0, losses:0, games:5, bossUnlocked:false },
    // Current match
    match: {
      playerScore:0, opponentScore:0, quarter:1, timeLeft:300,
      possession:'player', down:1, yardsToGo:10, ballPosition:25,
      driveStart:25, momentum:0, isClutch:false,
      opponentDef: null, opponentAI: { aggression:0.3, adaptRate:0.2, reaction:0.5 },
      playHistory: [],
    },
    // Deck
    deck: [],
    hand: [], // current hand (3-4 cards to pick from)
    allCards: [],
    // Shop / economy
    coins: 0,
    shards: 0,
    // Scout ratings
    scoutRates: {},
    // Selected play & defense
    selectedPlay: null,
    selectedDef: null,
    // Execution state
    exec: {
      timer:0, maxTime:4, pressureBar:0, receivers:[], defPlayers:[],
      windowStates:[], throwTarget:null, throwLine:[], throwResult:null,
      ballPos:null, ballTarget:null, ballFlight:0, qbPos:null,
      qbRunning:false, snapAnim:0,
    },
    // Defense guess
    defGuess: { timer:0, guess:null, actual:null, result:null },
    // Pull flag QTE
    pullFlag: { timer:0, ringSize:1, result:null },
    // Result display
    resultData: { yards:0, grade:'', message:'', type:'' },
    // Animations
    anim: { shakeX:0, shakeY:0, flash:0, flashColor:'', particles:[] },
    // Tutorial progress
    tutStep: 0,
    tutDone: false,
    // Match opponent info
    opponent: { name:'Street Dogs', difficulty:1, style:'balanced' },
    // Season map
    seasonGames: [],
    // UI state
    ui: { hoverBtn:null, scrollY:0, selectedCard:-1, tooltipCard:null },
    // Transition
    transition: { active:false, timer:0, maxTime:0, callback:null, text:'' },
  };
}

game = newGame();

// -- Initialize deck --
function initDeck() {
  game.deck = ['slant','out','curl','screen','dig','post','go','qbdraw'];
  game.allCards = [...game.deck];
  game.scoutRates = {};
  game.deck.forEach(id => game.scoutRates[id] = 0);
}

function getPlay(id) { return PLAYS.find(p => p.id === id); }
function getDef(id) { return DEFENSES.find(d => d.id === id); }

// -- Season generation --
function generateSeason() {
  const names = ['Street Dogs','Thunder','Iron Wall','Shadow','Blaze','Storm','Wolves','Vipers','Titans','Phantoms'];
  const styles = ['aggressive','balanced','defensive','tricky'];
  game.seasonGames = [];
  for (let i = 0; i < game.season.games; i++) {
    game.seasonGames.push({
      name: names[Math.floor(Math.random()*names.length)],
      difficulty: 1 + i * 0.4 + Math.random()*0.3,
      style: styles[Math.floor(Math.random()*styles.length)],
      completed: false, won: false,
    });
  }
  // Boss
  game.seasonGames.push({
    name: '🏛️ 铁壁教练 Rick Stone',
    difficulty: 3.5,
    style: 'boss',
    completed: false, won: false, isBoss: true,
  });
}

// -- Drawing Helpers --
function W() { return canvas.width; }
function H() { return canvas.height; }
function scale() { return Math.min(W(), H()) / 800; }

function drawRoundRect(x,y,w,h,r,fill,stroke) {
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,[r]);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2*scale(); ctx.stroke(); }
}

function drawText(text, x, y, size, color, align, maxW) {
  ctx.fillStyle = color || WHITE;
  ctx.font = `${Math.round(size*scale())}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  if (maxW) ctx.fillText(text, x, y, maxW);
  else ctx.fillText(text, x, y);
}

function drawBoldText(text, x, y, size, color, align) {
  ctx.fillStyle = color || WHITE;
  ctx.font = `bold ${Math.round(size*scale())}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// -- Button system --
let buttons = [];
function clearButtons() { buttons = []; }
function addButton(x,y,w,h,label,action,style) {
  buttons.push({x,y,w,h,label,action,style:style||{}});
}
function drawButtons() {
  const s = scale();
  buttons.forEach((b,i) => {
    const hover = game.ui.hoverBtn === i;
    const baseColor = b.style.color || GOLD;
    const alpha = hover ? 1 : 0.85;
    ctx.globalAlpha = alpha;
    drawRoundRect(b.x, b.y, b.w, b.h, 8*s, baseColor);
    if (hover) {
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 15*s;
      drawRoundRect(b.x, b.y, b.w, b.h, 8*s, null, WHITE);
      ctx.shadowBlur = 0;
    }
    const textColor = b.style.textColor || DARK;
    drawBoldText(b.label, b.x+b.w/2, b.y+b.h/2, b.style.fontSize||18, textColor);
    ctx.globalAlpha = 1;
  });
}

// -- Particles --
function spawnParticles(x,y,color,count,speed) {
  for(let i=0;i<count;i++){
    game.anim.particles.push({
      x, y, vx:(Math.random()-0.5)*speed, vy:(Math.random()-0.5)*speed,
      life:1, color, size:3+Math.random()*4
    });
  }
}
function updateParticles(dt) {
  game.anim.particles = game.anim.particles.filter(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 50*dt; p.life -= dt*1.5;
    return p.life > 0;
  });
}
function drawParticles() {
  const s = scale();
  game.anim.particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size*s, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}


// -- Field Drawing --
function drawField(fieldY, fieldH, ballYardLine, highlightZone) {
  const s = scale();
  const fw = W() * 0.9;
  const fx = (W()-fw)/2;
  
  // Field background
  ctx.fillStyle = FIELD_GREEN;
  ctx.fillRect(fx, fieldY, fw, fieldH);
  
  // Yard lines
  for(let yd=0; yd<=100; yd+=5) {
    const x = fx + (yd/100)*fw;
    ctx.strokeStyle = yd%10===0 ? LINE_WHITE : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = yd%10===0 ? 2*s : 1*s;
    ctx.beginPath(); ctx.moveTo(x, fieldY); ctx.lineTo(x, fieldY+fieldH); ctx.stroke();
    if(yd%10===0 && yd>0 && yd<100) {
      const num = yd<=50 ? yd : 100-yd;
      drawText(num.toString(), x, fieldY-12*s, 10, 'rgba(255,255,255,0.5)');
    }
  }
  
  // End zones
  ctx.fillStyle = ENDZONE_BLUE + '40';
  ctx.fillRect(fx, fieldY, (0/100)*fw + fw*0.02, fieldH);
  ctx.fillStyle = ENDZONE_RED + '40';
  ctx.fillRect(fx+fw*0.98, fieldY, fw*0.02, fieldH);
  
  // First down line
  if(game.match.possession === 'player') {
    const fdLine = Math.min(100, game.match.ballPosition + game.match.yardsToGo);
    const fdX = fx + (fdLine/100)*fw;
    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = 3*s;
    ctx.setLineDash([6*s, 4*s]);
    ctx.beginPath(); ctx.moveTo(fdX, fieldY); ctx.lineTo(fdX, fieldY+fieldH); ctx.stroke();
    ctx.setLineDash([]);
  }
  
  // Ball position marker
  const ballX = fx + (ballYardLine/100)*fw;
  ctx.fillStyle = GOLD;
  ctx.beginPath(); ctx.arc(ballX, fieldY+fieldH/2, 6*s, 0, Math.PI*2); ctx.fill();
  
  return { fx, fw, fieldY, fieldH };
}

// -- Draw Player Icons --
function drawPlayerIcon(x, y, radius, color, label, isHighlight, windowColor) {
  const s = scale();
  ctx.beginPath();
  ctx.arc(x, y, radius*s, 0, Math.PI*2);
  ctx.fillStyle = color;
  ctx.fill();
  if(isHighlight) {
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3*s;
    ctx.stroke();
  }
  if(windowColor) {
    ctx.beginPath();
    ctx.arc(x, y - radius*s - 8*s, 6*s, 0, Math.PI*2);
    ctx.fillStyle = windowColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5*s;
    ctx.stroke();
  }
  if(label) {
    drawBoldText(label, x, y, 10, WHITE);
  }
}

// -- Title Screen --
function drawTitle() {
  const cx = W()/2, cy = H()/2;
  const s = scale();
  
  // Background
  ctx.fillStyle = DARK;
  ctx.fillRect(0,0,W(),H());
  
  // Animated football field lines in bg
  const t = Date.now()/3000;
  for(let i=0; i<10; i++) {
    ctx.strokeStyle = `rgba(45,90,30,${0.1+Math.sin(t+i*0.5)*0.05})`;
    ctx.lineWidth = 2*s;
    ctx.beginPath();
    ctx.moveTo(0, (i/10)*H());
    ctx.lineTo(W(), (i/10)*H());
    ctx.stroke();
  }
  
  // Title
  drawBoldText('🏈 POCKET', cx, cy - 80*s, 42, GOLD);
  drawBoldText('COMMANDER', cx, cy - 30*s, 48, WHITE);
  drawText('四分卫养成 × Roguelike × 腰旗橄榄球', cx, cy + 20*s, 16, '#aaa');
  
  // Buttons
  clearButtons();
  const bw = 220*s, bh = 50*s;
  addButton(cx-bw/2, cy+70*s, bw, bh, '🎮 开始游戏', () => {
    if(!game.tutDone) {
      game.phase = GamePhase.TUTORIAL;
      game.tutStep = 0;
    } else {
      startNewSeason();
    }
  });
  if(game.tutDone) {
    addButton(cx-bw/2, cy+130*s, bw, bh, '📖 重新教程', () => {
      game.phase = GamePhase.TUTORIAL;
      game.tutStep = 0;
    }, {color:'#455a64'});
  }
  drawButtons();
  
  // Version
  drawText('v0.1 Prototype', cx, H()-30*s, 12, '#555');
}

// -- Tutorial --
const TUTORIAL_STEPS = [
  { title:'欢迎来到 Pocket Commander!', 
    text:'你是一个天赋异禀的四分卫新人。\n在这里，你将学会阅读防守、选择战术、精准传球。\n准备好了吗？',
    btn:'准备好了！' },
  { title:'🏈 认识场地',
    text:'橄榄球场从0码到100码。\n你的目标是把球推进到对方端区（100码线）得分。\n每次进攻有4档机会推进10码获得新的首攻。',
    btn:'明白了' },
  { title:'🛡️ 阅读防守',
    text:'开球前，你需要观察对方的防守阵型：\n\n👤 Man盯人 — 每人贴身盯防\n2️⃣ Cover 2 — 两个安全卫守深区\n3️⃣ Cover 3 — 三人分区防守\n⚡ Blitz — 多人冲向你！',
    btn:'继续' },
  { title:'📋 选择战术',
    text:'每次进攻你要选一张战术卡。\n每种战术有克制关系：\n\n↗ Slant 克制 Zone防守\n→ Out Route 克制 Man盯人\n⟵ Screen 克制 Blitz突袭\n\n选对战术 = 大幅提高成功率！',
    btn:'继续' },
  { title:'🎯 传球！',
    text:'开球后，观察接球手头上的颜色：\n\n🟢 绿色 = 空档！传给他！\n🟡 黄色 = 有风险\n🔴 红色 = 被盯死了\n\n点击绿色的接球手完成传球。\n注意左边的压力条——时间不等人！',
    btn:'继续' },
  { title:'🎮 开始你的第一个赛季！',
    text:'赢得5场常规赛后挑战Boss！\n每场比赛后可以在商店升级战术。\n失败了没关系——每次都会变得更强！\n\n祝你好运，四分卫！',
    btn:'开始赛季！' },
];

function drawTutorial() {
  const cx = W()/2, cy = H()/2, s = scale();
  ctx.fillStyle = DARK;
  ctx.fillRect(0,0,W(),H());
  
  const step = TUTORIAL_STEPS[game.tutStep];
  const pw = Math.min(600*s, W()*0.85), ph = 400*s;
  const px = cx-pw/2, py = cy-ph/2;
  
  drawRoundRect(px, py, pw, ph, 16*s, '#16213e', GOLD);
  
  // Step indicator
  drawText(`${game.tutStep+1} / ${TUTORIAL_STEPS.length}`, cx, py+25*s, 12, '#666');
  
  // Title
  drawBoldText(step.title, cx, py+60*s, 22, GOLD);
  
  // Text (multiline)
  const lines = step.text.split('\n');
  lines.forEach((line, i) => {
    drawText(line, cx, py+110*s + i*28*s, 14, '#ccc');
  });
  
  clearButtons();
  const bw = 180*s, bh = 45*s;
  addButton(cx-bw/2, py+ph-70*s, bw, bh, step.btn, () => {
    sfxClick();
    game.tutStep++;
    if(game.tutStep >= TUTORIAL_STEPS.length) {
      game.tutDone = true;
      startNewSeason();
    }
  });
  drawButtons();
}

// -- Start new season --
function startNewSeason() {
  initDeck();
  generateSeason();
  game.season.gameIndex = 0;
  game.season.wins = 0;
  game.season.losses = 0;
  game.coins = 200;
  game.phase = GamePhase.SEASON_MAP;
}

// -- Season Map --
function drawSeasonMap() {
  const cx = W()/2, cy = H()/2, s = scale();
  ctx.fillStyle = DARK;
  ctx.fillRect(0,0,W(),H());
  
  drawBoldText(`🏈 赛季 ${game.season.number}`, cx, 40*s, 28, GOLD);
  drawText(`${game.qb.name} | Lv.${game.qb.level} | 💰${game.coins}`, cx, 75*s, 14, '#aaa');
  
  // QB Stats bar
  const statY = 100*s;
  const statW = Math.min(500*s, W()*0.8);
  const statX = cx - statW/2;
  ['精准:'+game.qb.acc, '臂力:'+game.qb.arm, '阅读:'+game.qb.read, '机动:'+game.qb.mob].forEach((txt,i) => {
    const bx = statX + (i/4)*statW;
    drawText(txt, bx+statW/8, statY, 12, '#888');
  });
  
  // Game nodes
  clearButtons();
  const nodeW = Math.min(280*s, W()*0.7);
  const nodeH = 55*s;
  const startY = 140*s;
  
  game.seasonGames.forEach((g, i) => {
    const ny = startY + i * (nodeH + 12*s);
    if(ny > H() - 80*s) return;
    
    const isCurrent = i === game.season.gameIndex;
    const isLocked = i > game.season.gameIndex;
    const baseColor = g.completed ? (g.won ? '#2e7d32' : '#b71c1c') : (isCurrent ? GOLD : '#333');
    
    drawRoundRect(cx-nodeW/2, ny, nodeW, nodeH, 8*s, baseColor+(isLocked?'60':''), isCurrent?WHITE:null);
    
    const label = g.isBoss ? g.name : `第${i+1}场: ${g.name}`;
    const statusText = g.completed ? (g.won ? ' ✅' : ' ❌') : (isCurrent ? ' ▶' : ' 🔒');
    drawBoldText(label + statusText, cx, ny+nodeH/2, g.isBoss?14:15, isLocked?'#666':WHITE);
    
    if(isCurrent && !g.completed) {
      addButton(cx-nodeW/2, ny, nodeW, nodeH, '', () => {
        startMatch(g);
      });
    }
  });
  
  drawButtons();
  
  // Record
  drawText(`战绩: ${game.season.wins}W - ${game.season.losses}L`, cx, H()-40*s, 14, '#888');
}

// -- Start Match --
function startMatch(opponent) {
  sfxWhistle();
  game.opponent = opponent;
  game.match = {
    playerScore:0, opponentScore:0, quarter:1, timeLeft:300,
    possession:'player', down:1, yardsToGo:10, ballPosition:25,
    driveStart:25, momentum:0, isClutch:false,
    opponentDef: null,
    opponentAI: {
      aggression: opponent.style==='aggressive'?0.6:opponent.style==='defensive'?0.2:0.4,
      adaptRate: Math.min(0.5, opponent.difficulty * 0.15),
      reaction: Math.max(0.25, 0.6 - opponent.difficulty*0.08),
    },
    playHistory: [],
  };
  game.phase = GamePhase.PLAY_SELECT;
  dealHand();
}

// -- Deal hand of cards --
function dealHand() {
  const available = [...game.deck];
  game.hand = [];
  const count = Math.min(4, available.length);
  for(let i=0; i<count; i++) {
    const idx = Math.floor(Math.random()*available.length);
    game.hand.push(available[idx]);
    available.splice(idx,1);
  }
  game.ui.selectedCard = -1;
}


// -- Choose opponent defense --
function chooseOpponentDefense() {
  const ai = game.match.opponentAI;
  const history = game.match.playHistory;
  
  // Boss special behavior
  if(game.opponent.isBoss) {
    const cycle = ['man','cover2','cover3','blitz'];
    const idx = Math.floor(history.length / 3) % cycle.length;
    // If scored on 3 times in a row, go all blitz
    if(history.length >= 3 && history.slice(-3).every(h=>h.success)) {
      return 'blitz';
    }
    return cycle[idx];
  }
  
  // Normal AI
  let weights = { man:0.25, cover2:0.25, cover3:0.25, blitz:0.25 };
  
  // Aggression bias
  weights.blitz += ai.aggression * 0.3;
  weights.cover3 -= ai.aggression * 0.1;
  
  // Adapt to player tendencies
  if(history.length > 2) {
    const recentPlays = history.slice(-3).map(h=>h.playId);
    const recentTypes = recentPlays.map(id => getPlay(id)?.type);
    if(recentTypes.filter(t=>t==='long').length >= 2) {
      weights.cover2 += 0.3; weights.cover3 += 0.2;
    }
    if(recentTypes.filter(t=>t==='short').length >= 2) {
      weights.man += 0.2; weights.blitz += 0.15;
    }
    if(recentTypes.filter(t=>t==='run'||t==='special').length >= 2) {
      weights.man += 0.15;
    }
  }
  
  // Normalize and pick
  const total = Object.values(weights).reduce((a,b)=>a+b,0);
  let r = Math.random() * total;
  for(const [def, w] of Object.entries(weights)) {
    r -= w;
    if(r <= 0) return def;
  }
  return 'cover2';
}

// -- Play Select Screen --
function drawPlaySelect() {
  const cx = W()/2, cy = H()/2, s = scale();
  ctx.fillStyle = '#0d1b2a';
  ctx.fillRect(0,0,W(),H());
  
  // Scoreboard
  drawScoreboard();
  
  // Down & Distance
  const downText = `${game.match.down}档 & ${game.match.yardsToGo}码 | 球在${game.match.ballPosition}码线`;
  drawBoldText(downText, cx, 80*s, 16, YELLOW);
  
  // Momentum
  if(game.match.momentum > 0) {
    const momText = '🔥'.repeat(Math.min(game.match.momentum, 6));
    drawText(`Momentum: ${momText}`, cx, 105*s, 14, game.match.momentum>=6?GOLD:'#ff8a65');
  }
  
  // Cards
  drawBoldText('选择战术', cx, 135*s, 20, WHITE);
  
  const cardW = Math.min(160*s, (W()-40*s)/4 - 8*s);
  const cardH = cardW * 1.4;
  const totalW = game.hand.length * (cardW + 10*s);
  const startX = cx - totalW/2;
  const cardY = 160*s;
  
  clearButtons();
  
  game.hand.forEach((playId, i) => {
    const play = getPlay(playId);
    if(!play) return;
    const x = startX + i*(cardW+10*s);
    const isSelected = game.ui.selectedCard === i;
    const scoutRate = (game.scoutRates[playId]||0);
    const scoutColor = scoutRate < 20 ? '#42a5f5' : scoutRate < 40 ? WHITE : scoutRate < 60 ? '#ffa726' : RED;
    
    // Card bg
    drawRoundRect(x, cardY, cardW, cardH, 8*s, isSelected?play.color+'40':'#1a2a3a', isSelected?play.color:scoutColor);
    
    // Icon
    drawBoldText(play.icon, x+cardW/2, cardY+30*s, 28, play.color);
    // Name
    drawBoldText(play.name, x+cardW/2, cardY+65*s, 13, WHITE);
    // Type
    drawText(play.desc, x+cardW/2, cardY+85*s, 10, '#aaa');
    // Beats
    if(play.beats.length > 0) {
      drawText('克:'+play.beats.map(b=>getDef(b)?.name||b).join(','), x+cardW/2, cardY+105*s, 8, GREEN, 'center', cardW-10*s);
    }
    if(play.weakTo.length > 0) {
      drawText('弱:'+play.weakTo.map(b=>getDef(b)?.name||b).join(','), x+cardW/2, cardY+120*s, 8, RED, 'center', cardW-10*s);
    }
    // Scout rate
    const scoutLabel = scoutRate<20?'冷门':scoutRate<40?'正常':scoutRate<60?'警戒':'被看穿';
    drawText(`侦察:${scoutLabel}`, x+cardW/2, cardY+cardH-20*s, 9, scoutColor);
    
    addButton(x, cardY, cardW, cardH, '', () => {
      sfxCard();
      game.ui.selectedCard = i;
    });
  });
  
  // Confirm button
  if(game.ui.selectedCard >= 0) {
    const bw = 200*s, bh = 48*s;
    addButton(cx-bw/2, cardY+cardH+20*s, bw, bh, '📣 开球!', () => {
      sfxSnap();
      const playId = game.hand[game.ui.selectedCard];
      game.selectedPlay = getPlay(playId);
      
      // Update scout rate
      const totalPlays = game.match.playHistory.length + 1;
      Object.keys(game.scoutRates).forEach(id => {
        const uses = game.match.playHistory.filter(h=>h.playId===id).length + (id===playId?1:0);
        game.scoutRates[id] = Math.round((uses/totalPlays)*100);
      });
      
      // Choose opponent defense
      game.match.opponentDef = chooseOpponentDefense();
      
      // Setup execution
      setupExecution();
      game.phase = GamePhase.PRE_SNAP;
      game.exec.snapAnim = 0;
    });
  }
  
  drawButtons();
}

// -- Scoreboard --
function drawScoreboard() {
  const s = scale();
  const sbW = Math.min(400*s, W()*0.8);
  const sbH = 40*s;
  const sbX = W()/2 - sbW/2;
  const sbY = 10*s;
  
  drawRoundRect(sbX, sbY, sbW, sbH, 6*s, 'rgba(0,0,0,0.6)');
  drawBoldText(`YOU ${game.match.playerScore}`, sbX+sbW*0.25, sbY+sbH/2, 16, GOLD);
  drawBoldText(`-`, W()/2, sbY+sbH/2, 16, '#666');
  drawBoldText(`${game.match.opponentScore} ${game.opponent.name}`, sbX+sbW*0.75, sbY+sbH/2, 14, RED);
  // Quarter
  drawText(`Q${game.match.quarter}`, W()/2, sbY+sbH+12*s, 11, '#888');
}

// -- Setup Execution --
function setupExecution() {
  const play = game.selectedPlay;
  const def = game.match.opponentDef;
  const s = scale();
  const fieldCX = W()/2;
  const fieldCY = H()*0.5;
  
  // QB position
  game.exec.qbPos = { x: fieldCX, y: fieldCY + 80*s };
  game.exec.qbRunning = false;
  game.exec.timer = 0;
  game.exec.pressureBar = 0;
  game.exec.throwTarget = null;
  game.exec.throwLine = [];
  game.exec.throwResult = null;
  game.exec.ballFlight = 0;
  
  // Pocket time based on difficulty and blitz
  game.exec.maxTime = def === 'blitz' ? 2.5 : 4.0;
  game.exec.maxTime -= game.opponent.difficulty * 0.15;
  game.exec.maxTime = Math.max(1.8, game.exec.maxTime);
  
  // Setup receivers with route endpoints
  const routes = play.routes || [{dx:0.15,dy:-0.3},{dx:-0.1,dy:-0.25}];
  game.exec.receivers = routes.map((r, i) => {
    const startX = fieldCX + (i===0 ? 60*s : -60*s);
    const startY = fieldCY + 40*s;
    return {
      startX, startY,
      targetX: fieldCX + r.dx * W() * 0.4,
      targetY: fieldCY + r.dy * H() * 0.5,
      x: startX, y: startY,
      progress: 0,
      windowOpen: 0, // time when window opens
      windowDuration: 0,
      windowState: 'red', // red/yellow/green
      speed: 0.8 + Math.random()*0.3,
      index: i,
    };
  });
  
  // Calculate windows based on defense matchup
  const isBeat = play.beats.includes(def);
  const isWeak = play.weakTo.includes(def);
  
  game.exec.receivers.forEach((rec, i) => {
    const dist = Math.sqrt(Math.pow(rec.targetX-rec.startX,2)+Math.pow(rec.targetY-rec.startY,2));
    const travelTime = (dist / (200*s)) / rec.speed;
    rec.windowOpen = travelTime * 0.7;
    rec.windowDuration = isBeat ? 1.8 : isWeak ? 0.6 : 1.1;
    rec.windowDuration += (game.qb.read / 100) * 0.5;
    // Randomize which receiver gets the better window
    if(i===0 && Math.random() > 0.5) rec.windowDuration *= 1.3;
    else if(i===1) rec.windowDuration *= (isBeat ? 1.2 : 0.8);
  });
  
  // Setup defensive players
  game.exec.defPlayers = [];
  const defPositions = def === 'blitz' 
    ? [{x:-40,y:10},{x:40,y:10},{x:0,y:-20},{x:-20,y:30},{x:20,y:30}]
    : def === 'man'
    ? [{x:60,y:30},{x:-60,y:30},{x:0,y:-30},{x:-30,y:10},{x:30,y:10}]
    : [{x:50,y:-30},{x:-50,y:-30},{x:0,y:-50},{x:-25,y:10},{x:25,y:10}];
    
  defPositions.forEach(dp => {
    game.exec.defPlayers.push({
      x: fieldCX + dp.x*s,
      y: fieldCY + dp.y*s,
      targetX: fieldCX + dp.x*s,
      targetY: fieldCY + dp.y*s,
    });
  });
}

// -- Pre-snap phase --
function drawPreSnap(dt) {
  const cx = W()/2, cy = H()/2, s = scale();
  
  ctx.fillStyle = '#0d1b2a';
  ctx.fillRect(0,0,W(),H());
  drawScoreboard();
  
  // Show defense type hint (based on QB read stat)
  const def = getDef(game.match.opponentDef);
  const readChance = game.qb.read / 100;
  
  const fieldInfo = drawField(H()*0.25, H()*0.45, game.match.ballPosition);
  
  // Show defense formation
  drawBoldText(`防守阵型: ${Math.random() < readChance + 0.3 ? def.icon + ' ' + def.name : '???'}`, cx, H()*0.18, 16, def.color);
  
  // Down info
  drawText(`${game.match.down}档 & ${game.match.yardsToGo}码`, cx, H()*0.22, 12, YELLOW);
  
  // Pre-snap timer
  game.exec.snapAnim += dt;
  const preSnapTime = 3.0;
  const remaining = Math.max(0, preSnapTime - game.exec.snapAnim);
  
  drawBoldText(`阅读防守... ${remaining.toFixed(1)}s`, cx, H()*0.78, 18, remaining < 1 ? RED : YELLOW);
  drawText('观察防守站位，准备开球！', cx, H()*0.83, 12, '#888');
  
  // Draw players on field
  const bx = fieldInfo.fx + (game.match.ballPosition/100)*fieldInfo.fw;
  const by = fieldInfo.fieldY + fieldInfo.fieldH/2;
  
  // Offense
  drawPlayerIcon(bx, by, 8, BLUE, 'QB', true);
  drawPlayerIcon(bx+30*s, by-20*s, 6, '#4fc3f7', 'WR', false);
  drawPlayerIcon(bx-30*s, by-15*s, 6, '#4fc3f7', 'WR', false);
  drawPlayerIcon(bx+10*s, by+10*s, 6, '#81c784', 'C', false);
  
  // Defense
  game.exec.defPlayers.forEach(dp => {
    const dx = bx + (dp.x - W()/2)*0.3;
    const dy = by + (dp.y - H()*0.5)*0.3 - 40*s;
    drawPlayerIcon(dx, dy, 6, RED, '', false);
  });
  
  if(game.exec.snapAnim >= preSnapTime) {
    game.phase = GamePhase.EXECUTION;
    game.exec.timer = 0;
    game.exec.pressureBar = 0;
  }
}


// -- Execution Phase (Core Gameplay!) --
function updateExecution(dt) {
  const s = scale();
  game.exec.timer += dt;
  game.exec.pressureBar = Math.min(1, game.exec.timer / game.exec.maxTime);
  
  // Update receiver positions along routes
  game.exec.receivers.forEach(rec => {
    rec.progress = Math.min(1, game.exec.timer * rec.speed * 0.5);
    rec.x = rec.startX + (rec.targetX - rec.startX) * rec.progress;
    rec.y = rec.startY + (rec.targetY - rec.startY) * rec.progress;
    
    // Window state
    const t = game.exec.timer;
    if(t >= rec.windowOpen && t <= rec.windowOpen + rec.windowDuration) {
      const windowProgress = (t - rec.windowOpen) / rec.windowDuration;
      if(windowProgress < 0.2 || windowProgress > 0.8) rec.windowState = 'yellow';
      else rec.windowState = 'green';
    } else if(t > rec.windowOpen + rec.windowDuration) {
      rec.windowState = 'red';
    } else {
      rec.windowState = 'red';
    }
  });
  
  // Update defense players (chase receivers)
  game.exec.defPlayers.forEach((dp, i) => {
    if(i < game.exec.receivers.length) {
      const rec = game.exec.receivers[i];
      const dx = rec.x - dp.x;
      const dy = rec.y - dp.y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      const speed = 120 * s * (1 - game.match.opponentAI.reaction * 0.3);
      if(dist > 20*s) {
        dp.x += (dx/dist) * speed * dt;
        dp.y += (dy/dist) * speed * dt;
      }
    }
  });
  
  // Sack check
  if(game.exec.pressureBar >= 1 && !game.exec.throwTarget) {
    sfxSack();
    game.anim.shakeX = 10; game.anim.shakeY = 10;
    game.exec.throwResult = 'sack';
    game.resultData = { yards: -7, grade: 'D', message: '被擒杀! -7码', type: 'sack' };
    game.phase = GamePhase.RESULT;
    spawnParticles(game.exec.qbPos.x, game.exec.qbPos.y, RED, 15, 4);
    applyPlayResult();
  }
}

function drawExecution() {
  const cx = W()/2, cy = H()/2, s = scale();
  
  // Apply screen shake
  ctx.save();
  if(game.anim.shakeX > 0.5 || game.anim.shakeY > 0.5) {
    ctx.translate(
      (Math.random()-0.5)*game.anim.shakeX*s,
      (Math.random()-0.5)*game.anim.shakeY*s
    );
    game.anim.shakeX *= 0.9;
    game.anim.shakeY *= 0.9;
  }
  
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(0,0,W(),H());
  drawScoreboard();
  
  // Mini field
  const fieldH = H()*0.55;
  const fieldY = H()*0.2;
  const fieldInfo = drawField(fieldY, fieldH, game.match.ballPosition);
  
  // Draw route lines (faded)
  if(game.selectedPlay) {
    game.exec.receivers.forEach(rec => {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2*s;
      ctx.setLineDash([4*s, 4*s]);
      ctx.beginPath();
      ctx.moveTo(rec.startX, rec.startY);
      ctx.lineTo(rec.targetX, rec.targetY);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }
  
  // Draw defensive players
  game.exec.defPlayers.forEach(dp => {
    drawPlayerIcon(dp.x, dp.y, 7, RED, '', false);
  });
  
  // Draw receivers with window indicators
  game.exec.receivers.forEach((rec, i) => {
    const wColor = rec.windowState === 'green' ? GREEN : rec.windowState === 'yellow' ? YELLOW : RED;
    const isClickable = !game.exec.throwTarget;
    drawPlayerIcon(rec.x, rec.y, 9, '#4fc3f7', `R${i+1}`, isClickable, wColor);
    
    // Window glow when green
    if(rec.windowState === 'green') {
      ctx.beginPath();
      ctx.arc(rec.x, rec.y, 16*s, 0, Math.PI*2);
      ctx.strokeStyle = GREEN + '60';
      ctx.lineWidth = 3*s;
      ctx.stroke();
    }
  });
  
  // Draw QB
  const qbGlow = game.match.momentum >= 6 ? GOLD : game.match.momentum >= 4 ? '#ff8a65' : null;
  drawPlayerIcon(game.exec.qbPos.x, game.exec.qbPos.y, 10, BLUE, 'QB', true);
  if(qbGlow) {
    ctx.beginPath();
    ctx.arc(game.exec.qbPos.x, game.exec.qbPos.y, 18*s, 0, Math.PI*2);
    ctx.strokeStyle = qbGlow + '60';
    ctx.lineWidth = 3*s;
    ctx.stroke();
  }
  
  // Pressure bar
  const pbX = 20*s, pbY = H()*0.25, pbW = 20*s, pbH = H()*0.5;
  drawRoundRect(pbX, pbY, pbW, pbH, 4*s, '#1a1a1a', '#333');
  const fillH = game.exec.pressureBar * pbH;
  const pbColor = game.exec.pressureBar < 0.5 ? GREEN : game.exec.pressureBar < 0.8 ? YELLOW : RED;
  ctx.fillStyle = pbColor;
  ctx.fillRect(pbX+2*s, pbY+pbH-fillH, pbW-4*s, fillH);
  drawText('压力', pbX+pbW/2, pbY-15*s, 10, '#aaa');
  
  // Timer
  const timeLeft = Math.max(0, game.exec.maxTime - game.exec.timer);
  drawBoldText(timeLeft.toFixed(1)+'s', pbX+pbW/2, pbY+pbH+20*s, 12, pbColor);
  
  // Instructions
  if(!game.exec.throwTarget) {
    drawText('点击绿色接球手传球!', cx, H()*0.85, 14, game.exec.pressureBar > 0.7 ? RED : WHITE);
  }
  
  // Down info
  drawText(`${game.match.down}档 & ${game.match.yardsToGo} | ${game.selectedPlay?.name || ''}`, cx, H()*0.9, 12, YELLOW);
  
  ctx.restore();
  drawParticles();
}

// -- Handle throw --
function handleThrow(receiverIndex) {
  const rec = game.exec.receivers[receiverIndex];
  if(!rec || game.exec.throwTarget) return;
  
  sfxThrow();
  game.exec.throwTarget = receiverIndex;
  
  // Calculate success
  const window = rec.windowState;
  const play = game.selectedPlay;
  const def = game.match.opponentDef;
  
  // Base rate 70%
  let successRate = 0.7;
  
  // Window modifier
  if(window === 'green') successRate *= 1.3;
  else if(window === 'yellow') successRate *= 0.85;
  else successRate *= 0.3;
  
  // Tactical modifier
  const isBeat = play.beats.includes(def);
  const isWeak = play.weakTo.includes(def);
  if(isBeat) successRate *= 1.2;
  if(isWeak) successRate *= 0.65;
  
  // Scout rate modifier
  const scout = game.scoutRates[play.id] || 0;
  if(scout < 20) successRate *= 1.15;
  else if(scout > 60) successRate *= 0.75;
  else if(scout > 40) successRate *= 0.9;
  
  // QB accuracy
  successRate *= 0.8 + (game.qb.acc/100)*0.4;
  
  // Momentum bonus
  if(game.match.momentum >= 6) successRate *= 1.15;
  else if(game.match.momentum >= 3) successRate *= 1.05;
  
  // Clamp
  successRate = Math.min(0.98, Math.max(0.05, successRate));
  
  // Roll!
  const roll = Math.random();
  const success = roll < successRate;
  const interception = !success && roll > (1 - (1-successRate)*0.3) && window === 'red';
  
  // Calculate yards
  let yards = 0;
  if(success) {
    const routeType = play.type;
    if(routeType === 'short' || routeType === 'special') yards = 3 + Math.floor(Math.random()*8);
    else if(routeType === 'mid') yards = 8 + Math.floor(Math.random()*15);
    else if(routeType === 'long') yards = 15 + Math.floor(Math.random()*30);
    else if(routeType === 'run') yards = 2 + Math.floor(Math.random()*10);
    
    // YAC bonus for green window
    if(window === 'green') yards += Math.floor(Math.random()*5) + 2;
    
    // Check for touchdown
    if(game.match.ballPosition + yards >= 100) yards = 100 - game.match.ballPosition;
  }
  
  // Grade
  let grade = 'C';
  if(success && window === 'green' && isBeat) grade = 'S';
  else if(success && window === 'green') grade = 'A';
  else if(success) grade = 'B';
  else if(interception) grade = 'D';
  
  // Build result
  let message = '';
  let type = '';
  if(interception) {
    message = '被抄截!!! 攻防转换!';
    type = 'interception';
    yards = 0;
  } else if(success) {
    const isTD = game.match.ballPosition + yards >= 100;
    if(isTD) {
      message = `达阵!!! +${yards}码! TOUCHDOWN!`;
      type = 'touchdown';
    } else {
      message = `传球成功! +${yards}码`;
      type = 'complete';
    }
  } else {
    message = '传球未完成';
    type = 'incomplete';
    yards = 0;
  }
  
  game.exec.throwResult = type;
  game.resultData = { yards, grade, message, type };
  
  // Animate ball flight then show result
  game.exec.ballPos = { x: game.exec.qbPos.x, y: game.exec.qbPos.y };
  game.exec.ballTarget = { x: rec.x, y: rec.y };
  game.exec.ballFlight = 0;
  game.phase = GamePhase.THROW_ANIM;
}

// -- Throw Animation --
function updateThrowAnim(dt) {
  game.exec.ballFlight += dt * 2.5;
  if(game.exec.ballFlight >= 1) {
    // Ball arrived
    const type = game.resultData.type;
    if(type === 'touchdown') {
      sfxTD();
      spawnParticles(game.exec.ballTarget.x, game.exec.ballTarget.y, GOLD, 30, 6);
      game.anim.flash = 0.5; game.anim.flashColor = GOLD;
    } else if(type === 'complete') {
      sfxCatch();
      spawnParticles(game.exec.ballTarget.x, game.exec.ballTarget.y, GREEN, 10, 3);
    } else if(type === 'interception') {
      sfxInt();
      spawnParticles(game.exec.ballTarget.x, game.exec.ballTarget.y, RED, 20, 5);
      game.anim.flash = 0.3; game.anim.flashColor = RED;
    } else {
      sfxBuzz();
    }
    
    applyPlayResult();
    game.phase = GamePhase.RESULT;
  }
}

function drawThrowAnim() {
  drawExecution();
  const s = scale();
  
  // Draw flying ball
  const t = game.exec.ballFlight;
  const bx = game.exec.ballPos.x + (game.exec.ballTarget.x - game.exec.ballPos.x) * t;
  const by = game.exec.ballPos.y + (game.exec.ballTarget.y - game.exec.ballPos.y) * t - Math.sin(t*Math.PI)*40*s;
  
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.ellipse(bx, by, 8*s, 5*s, Math.atan2(
    game.exec.ballTarget.y-game.exec.ballPos.y,
    game.exec.ballTarget.x-game.exec.ballPos.x
  ), 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 1*s;
  ctx.stroke();
  
  // Trail
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2*s;
  ctx.beginPath();
  ctx.moveTo(game.exec.ballPos.x, game.exec.ballPos.y);
  ctx.quadraticCurveTo(bx, by-20*s, bx, by);
  ctx.stroke();
}

// -- Apply play result to game state --
function applyPlayResult() {
  const r = game.resultData;
  
  // Record play
  game.match.playHistory.push({
    playId: game.selectedPlay?.id,
    defense: game.match.opponentDef,
    success: r.type === 'complete' || r.type === 'touchdown',
    yards: r.yards,
  });
  
  if(r.type === 'touchdown') {
    game.match.playerScore += 7;
    game.match.momentum = Math.min(6, game.match.momentum + 2);
    // Coins
    game.coins += 50;
    // XP
    game.qb.xp += 30;
  } else if(r.type === 'complete') {
    game.match.ballPosition += r.yards;
    game.match.yardsToGo -= r.yards;
    game.match.momentum = Math.min(6, game.match.momentum + 1);
    game.coins += 10;
    game.qb.xp += 10;
    
    if(game.match.yardsToGo <= 0) {
      // First down!
      game.match.down = 1;
      game.match.yardsToGo = 10;
    } else {
      game.match.down++;
    }
  } else if(r.type === 'incomplete') {
    game.match.down++;
    game.match.momentum = Math.max(0, game.match.momentum - 1);
    game.qb.xp += 3;
  } else if(r.type === 'sack') {
    game.match.ballPosition = Math.max(1, game.match.ballPosition + r.yards);
    game.match.yardsToGo -= r.yards; // yards is negative
    game.match.down++;
    game.match.momentum = 0;
    game.qb.xp += 2;
  } else if(r.type === 'interception') {
    game.match.momentum = 0;
    game.qb.xp += 2;
  }
  
  // Level up check
  if(game.qb.xp >= game.qb.level * 50) {
    game.qb.xp -= game.qb.level * 50;
    game.qb.level++;
    // Random stat boost
    const stats = ['acc','arm','read','mob'];
    const stat = stats[Math.floor(Math.random()*stats.length)];
    game.qb[stat] = Math.min(99, game.qb[stat] + 3 + Math.floor(Math.random()*3));
  }
}


// -- Result Screen --
function drawResult(dt) {
  const cx = W()/2, cy = H()/2, s = scale();
  
  // Flash effect
  if(game.anim.flash > 0) {
    ctx.fillStyle = game.anim.flashColor + Math.round(game.anim.flash*80).toString(16).padStart(2,'0');
    ctx.fillRect(0,0,W(),H());
    game.anim.flash -= dt;
  }
  
  drawExecution();
  drawParticles();
  
  // Result overlay
  const oH = 200*s;
  const oY = cy - oH/2;
  drawRoundRect(cx-200*s, oY, 400*s, oH, 12*s, 'rgba(0,0,0,0.85)', 
    game.resultData.type==='touchdown'?GOLD:game.resultData.type==='interception'?RED:'#666');
  
  // Grade
  const gradeColor = {S:GOLD,A:GREEN,B:'#4fc3f7',C:YELLOW,D:RED}[game.resultData.grade]||WHITE;
  drawBoldText(game.resultData.grade, cx, oY+35*s, 40, gradeColor);
  
  // Message
  drawBoldText(game.resultData.message, cx, oY+85*s, 18, 
    game.resultData.type==='touchdown'?GOLD:
    game.resultData.type==='interception'?RED:
    game.resultData.type==='complete'?GREEN:WHITE);
  
  // Matchup info
  const play = game.selectedPlay;
  const def = getDef(game.match.opponentDef);
  if(play && def) {
    const isBeat = play.beats.includes(game.match.opponentDef);
    const isWeak = play.weakTo.includes(game.match.opponentDef);
    const matchupText = isBeat ? '✅ 战术克制!' : isWeak ? '❌ 被克制!' : '➖ 中性对局';
    const matchupColor = isBeat ? GREEN : isWeak ? RED : '#888';
    drawText(`${play.name} vs ${def.name} — ${matchupText}`, cx, oY+120*s, 12, matchupColor);
  }
  
  // Coins earned
  const coinsText = game.resultData.type==='touchdown' ? '+50💰' : game.resultData.type==='complete' ? '+10💰' : '';
  if(coinsText) drawText(coinsText, cx, oY+145*s, 12, GOLD);
  
  clearButtons();
  addButton(cx-90*s, oY+oH-50*s, 180*s, 40*s, '继续', () => {
    sfxClick();
    advanceGame();
  });
  drawButtons();
}

// -- Advance game after a play --
function advanceGame() {
  const r = game.resultData;
  
  if(r.type === 'touchdown') {
    // After TD, opponent gets ball
    game.match.possession = 'opponent';
    game.match.ballPosition = 25;
    game.match.down = 1;
    game.match.yardsToGo = 10;
    game.phase = GamePhase.DEFENSE_SELECT;
    return;
  }
  
  if(r.type === 'interception') {
    // Opponent gets the ball, simulate their drive
    simulateOpponentDrive();
    return;
  }
  
  // Turnover on downs
  if(game.match.down > 4) {
    game.match.possession = 'opponent';
    game.match.ballPosition = Math.max(25, 100 - game.match.ballPosition);
    game.match.down = 1;
    game.match.yardsToGo = 10;
    game.phase = GamePhase.DEFENSE_SELECT;
    return;
  }
  
  // Quarter check
  game.match.timeLeft -= 30 + Math.floor(Math.random()*20);
  if(game.match.timeLeft <= 0) {
    game.match.quarter++;
    game.match.timeLeft = 300;
    if(game.match.quarter > 4) {
      endMatch();
      return;
    }
    if(game.match.quarter === 3) {
      game.phase = GamePhase.HALFTIME;
      return;
    }
  }
  
  // Clutch check
  if(game.match.quarter >= 4 && game.match.timeLeft < 120) {
    const scoreDiff = Math.abs(game.match.playerScore - game.match.opponentScore);
    if(scoreDiff <= 7) game.match.isClutch = true;
  }
  
  // Continue offense
  game.phase = GamePhase.PLAY_SELECT;
  dealHand();
}

// -- Defense Select --
function drawDefenseSelect() {
  const cx = W()/2, cy = H()/2, s = scale();
  ctx.fillStyle = '#1a0a0a';
  ctx.fillRect(0,0,W(),H());
  drawScoreboard();
  
  drawBoldText('🛡️ 防守回合', cx, 80*s, 24, RED);
  drawText('对手持球进攻! 选择你的防守战术', cx, 110*s, 14, '#aaa');
  
  clearButtons();
  const cardW = Math.min(150*s, (W()-60*s)/4 - 10*s);
  const cardH = 130*s;
  const totalW = DEFENSES.length * (cardW+10*s);
  const startX = cx - totalW/2;
  
  DEFENSES.forEach((def, i) => {
    const x = startX + i*(cardW+10*s);
    const y = cy - cardH/2;
    
    drawRoundRect(x, y, cardW, cardH, 8*s, '#2a1515', def.color);
    drawBoldText(def.icon, x+cardW/2, y+30*s, 28, def.color);
    drawBoldText(def.name, x+cardW/2, y+65*s, 12, WHITE);
    drawText(def.desc, x+cardW/2, y+85*s, 9, '#aaa', 'center', cardW-10*s);
    
    addButton(x, y, cardW, cardH, '', () => {
      sfxCard();
      game.selectedDef = def.id;
      startDefenseGuess();
    });
  });
  
  drawButtons();
}

// -- Defense Guess QTE --
function startDefenseGuess() {
  // Opponent picks a play type
  const types = ['run','short','long'];
  const weights = [0.2, 0.5, 0.3];
  if(game.opponent.style === 'aggressive') { weights[2] = 0.45; weights[1] = 0.35; }
  let r = Math.random();
  let actual = 'short';
  for(let i=0;i<types.length;i++) { r-=weights[i]; if(r<=0){actual=types[i];break;} }
  
  game.defGuess = { timer: 2.0, guess: null, actual, result: null };
  game.phase = GamePhase.DEFENSE_GUESS;
}

function updateDefenseGuess(dt) {
  game.defGuess.timer -= dt;
  if(game.defGuess.timer <= 0 && !game.defGuess.guess) {
    // Timeout - no bonus
    game.defGuess.result = 'timeout';
    resolveDefense();
  }
}

function drawDefenseGuess() {
  const cx = W()/2, cy = H()/2, s = scale();
  ctx.fillStyle = '#1a0a0a';
  ctx.fillRect(0,0,W(),H());
  drawScoreboard();
  
  drawBoldText('⚡ 判断进攻意图!', cx, cy-100*s, 22, YELLOW);
  drawText(`剩余 ${Math.max(0,game.defGuess.timer).toFixed(1)}s`, cx, cy-65*s, 16, 
    game.defGuess.timer < 0.5 ? RED : WHITE);
  
  clearButtons();
  const bw = 120*s, bh = 60*s, gap = 15*s;
  const options = [
    {id:'run', label:'🏃 跑动', color:'#a1887f'},
    {id:'short', label:'📡 短传', color:'#4fc3f7'},
    {id:'long', label:'💣 长传', color:'#ef5350'},
  ];
  
  options.forEach((opt, i) => {
    const x = cx - (options.length*(bw+gap))/2 + i*(bw+gap);
    addButton(x, cy-20*s, bw, bh, opt.label, () => {
      sfxClick();
      game.defGuess.guess = opt.id;
      game.defGuess.result = game.defGuess.guess === game.defGuess.actual ? 'correct' : 'wrong';
      resolveDefense();
    }, {color: opt.color, fontSize: 14});
  });
  
  drawButtons();
}

// -- Resolve Defense --
function resolveDefense() {
  const correct = game.defGuess.result === 'correct';
  
  // Simulate opponent drive with one play
  const opponentPlay = game.defGuess.actual;
  const playerDef = game.selectedDef;
  
  // Check if defense matches
  let successChance = 0.45; // base opponent success
  successChance += game.opponent.difficulty * 0.08;
  
  if(correct) successChance -= 0.2; // bonus for guessing right
  
  // Defense type effectiveness
  if(playerDef === 'blitz' && opponentPlay === 'short') successChance -= 0.1;
  if(playerDef === 'man' && opponentPlay === 'run') successChance += 0.1;
  if(playerDef === 'cover2' && opponentPlay === 'long') successChance -= 0.15;
  if(playerDef === 'cover3' && opponentPlay === 'long') successChance -= 0.1;
  if(playerDef === 'blitz' && opponentPlay === 'long') successChance += 0.15;
  
  successChance = Math.max(0.1, Math.min(0.8, successChance));
  
  const success = Math.random() < successChance;
  let yards = 0;
  let scoredTD = false;
  
  if(success) {
    if(opponentPlay === 'short') yards = 4 + Math.floor(Math.random()*8);
    else if(opponentPlay === 'long') yards = 15 + Math.floor(Math.random()*25);
    else yards = 3 + Math.floor(Math.random()*7);
    
    if(Math.random() < 0.15 + game.opponent.difficulty*0.05) {
      scoredTD = true;
      game.match.opponentScore += 7;
    }
  }
  
  // Pull flag opportunity
  if(success && !scoredTD && Math.random() < 0.4) {
    game.pullFlag = { timer: 0, ringSize: 1, result: null, yards };
    game.phase = GamePhase.DEFENSE_PULL_FLAG;
    return;
  }
  
  // Show defense result
  game.resultData = {
    yards: success ? yards : 0,
    grade: correct ? (success ? 'B' : 'A') : (success ? 'D' : 'C'),
    message: scoredTD ? `对手达阵得分! 😤 ${game.match.opponentScore}分` :
             success ? `对手推进${yards}码` : '防守成功! 对手进攻未果',
    type: scoredTD ? 'opp_td' : success ? 'opp_gain' : 'opp_stop',
  };
  game.phase = GamePhase.DEFENSE_RESULT;
}

// -- Pull Flag QTE --
function updatePullFlag(dt) {
  game.pullFlag.timer += dt * 1.5;
  game.pullFlag.ringSize = Math.max(0, 1 - game.pullFlag.timer);
  if(game.pullFlag.ringSize <= 0 && !game.pullFlag.result) {
    game.pullFlag.result = 'miss';
    finishPullFlag();
  }
}

function drawPullFlag() {
  const cx = W()/2, cy = H()/2, s = scale();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0,0,W(),H());
  
  drawBoldText('🏴 拔旗挑战!', cx, cy-100*s, 24, YELLOW);
  drawText('在圆环最小时点击!', cx, cy-65*s, 14, WHITE);
  
  // Shrinking ring
  const ringR = 80 * game.pullFlag.ringSize * s;
  const targetR = 15 * s;
  
  // Target
  ctx.beginPath();
  ctx.arc(cx, cy, targetR, 0, Math.PI*2);
  ctx.fillStyle = GREEN;
  ctx.fill();
  
  // Ring
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI*2);
  ctx.strokeStyle = ringR < targetR*2 ? GOLD : WHITE;
  ctx.lineWidth = 4*s;
  ctx.stroke();
  
  clearButtons();
  // Clickable area
  addButton(cx-150*s, cy-150*s, 300*s, 300*s, '', () => {
    const accuracy = Math.abs(ringR - targetR);
    if(accuracy < 10*s) {
      game.pullFlag.result = 'perfect';
    } else if(accuracy < 25*s) {
      game.pullFlag.result = 'good';
    } else {
      game.pullFlag.result = 'miss';
    }
    finishPullFlag();
  }, {color:'transparent', textColor:'transparent'});
  drawButtons();
}

function finishPullFlag() {
  const result = game.pullFlag.result;
  let yards = game.pullFlag.yards;
  
  if(result === 'perfect') {
    sfxSuccess();
    yards = Math.max(0, yards - 5);
    game.resultData = { yards, grade:'A', message:`完美拔旗! 限制推进到${yards}码`, type:'opp_gain' };
  } else if(result === 'good') {
    sfxCatch();
    game.resultData = { yards, grade:'B', message:`拔旗成功! 对手推进${yards}码`, type:'opp_gain' };
  } else {
    sfxBuzz();
    yards += 5;
    game.resultData = { yards, grade:'C', message:`拔旗失败! 对手推进${yards}码`, type:'opp_gain' };
  }
  game.phase = GamePhase.DEFENSE_RESULT;
}

// -- Defense Result --
function drawDefenseResult() {
  const cx = W()/2, cy = H()/2, s = scale();
  ctx.fillStyle = '#1a0a0a';
  ctx.fillRect(0,0,W(),H());
  drawScoreboard();
  
  const r = game.resultData;
  const typeColor = r.type==='opp_td'?RED:r.type==='opp_stop'?GREEN:'#ffa726';
  
  drawBoldText(r.message, cx, cy-20*s, 18, typeColor);
  
  // Show guess result
  if(game.defGuess.result === 'correct') {
    drawText('✅ 判断正确! 防守加成!', cx, cy+20*s, 14, GREEN);
  } else if(game.defGuess.result === 'wrong') {
    drawText(`❌ 判断错误 (实际: ${game.defGuess.actual==='run'?'跑动':game.defGuess.actual==='short'?'短传':'长传'})`, cx, cy+20*s, 14, RED);
  }
  
  clearButtons();
  addButton(cx-90*s, cy+60*s, 180*s, 45*s, '继续', () => {
    sfxClick();
    afterDefensePlay();
  });
  drawButtons();
}

function afterDefensePlay() {
  // After opponent possession, ball back to player
  game.match.possession = 'player';
  game.match.ballPosition = 25;
  game.match.down = 1;
  game.match.yardsToGo = 10;
  
  // Advance quarter
  game.match.timeLeft -= 50 + Math.floor(Math.random()*30);
  if(game.match.timeLeft <= 0) {
    game.match.quarter++;
    game.match.timeLeft = 300;
    if(game.match.quarter > 4) {
      endMatch();
      return;
    }
    if(game.match.quarter === 3) {
      game.phase = GamePhase.HALFTIME;
      return;
    }
  }
  
  game.phase = GamePhase.PLAY_SELECT;
  dealHand();
}

// -- Simulate opponent drive (after interception) --
function simulateOpponentDrive() {
  // Quick simulation
  const scoreProbability = 0.3 + game.opponent.difficulty * 0.08;
  if(Math.random() < scoreProbability) {
    game.match.opponentScore += 7;
    game.resultData = {
      yards:0, grade:'D', message:`抄截后对手反击达阵! ${game.match.opponentScore}分`, type:'opp_td'
    };
  } else {
    game.resultData = {
      yards:0, grade:'C', message:'你的防守挡住了对手的反击', type:'opp_stop'
    };
  }
  game.phase = GamePhase.DEFENSE_RESULT;
}

// -- Halftime --
function drawHalftime() {
  const cx = W()/2, cy = H()/2, s = scale();
  ctx.fillStyle = DARK;
  ctx.fillRect(0,0,W(),H());
  
  drawBoldText('📣 中场休息', cx, cy-60*s, 28, GOLD);
  drawBoldText(`${game.match.playerScore} - ${game.match.opponentScore}`, cx, cy-15*s, 36, WHITE);
  
  const lead = game.match.playerScore - game.match.opponentScore;
  const msg = lead > 7 ? '优势明显! 保持节奏!' : lead > 0 ? '领先了! 继续加油!' : 
              lead === 0 ? '平局! 下半场决胜!' : lead > -7 ? '落后了，调整战术!' : '需要大逆转!';
  drawText(msg, cx, cy+25*s, 16, lead>=0?GREEN:RED);
  
  clearButtons();
  addButton(cx-100*s, cy+70*s, 200*s, 45*s, '▶ 下半场', () => {
    sfxWhistle();
    game.phase = GamePhase.PLAY_SELECT;
    dealHand();
  });
  drawButtons();
}

// -- End Match --
function endMatch() {
  const won = game.match.playerScore > game.match.opponentScore;
  game.phase = GamePhase.GAME_OVER;
  
  // Update season
  const gi = game.season.gameIndex;
  if(gi < game.seasonGames.length) {
    game.seasonGames[gi].completed = true;
    game.seasonGames[gi].won = won;
  }
  
  if(won) {
    game.season.wins++;
    game.coins += 100;
    game.shards += 15;
  } else {
    game.season.losses++;
    game.coins += 30;
    game.shards += 5;
  }
}

function drawGameOver() {
  const cx = W()/2, cy = H()/2, s = scale();
  ctx.fillStyle = DARK;
  ctx.fillRect(0,0,W(),H());
  
  const won = game.match.playerScore > game.match.opponentScore;
  const isBossWin = won && game.opponent.isBoss;
  
  if(isBossWin) {
    drawBoldText('🏆 赛季冠军!!!', cx, cy-80*s, 32, GOLD);
    spawnParticles(cx, cy-80*s, GOLD, 5, 3);
  } else if(won) {
    drawBoldText('🎉 胜利!', cx, cy-80*s, 32, GREEN);
  } else {
    drawBoldText('😤 失败...', cx, cy-80*s, 32, RED);
  }
  
  drawBoldText(`${game.match.playerScore} - ${game.match.opponentScore}`, cx, cy-30*s, 40, WHITE);
  drawText(`vs ${game.opponent.name}`, cx, cy+10*s, 16, '#aaa');
  
  // Stats
  const ph = game.match.playHistory;
  const completions = ph.filter(p=>p.success).length;
  const totalYards = ph.reduce((s,p)=>s+p.yards, 0);
  drawText(`传球: ${completions}/${ph.length} | 总码数: ${totalYards}`, cx, cy+45*s, 14, '#888');
  drawText(`💰 +${won?100:30} | 🏆 +${won?15:5}碎片`, cx, cy+70*s, 13, GOLD);
  
  clearButtons();
  const bw = 200*s, bh = 45*s;
  
  if(isBossWin) {
    addButton(cx-bw/2, cy+100*s, bw, bh, '🏆 完成赛季!', () => {
      sfxSuccess();
      game.season.number++;
      startNewSeason();
    });
  } else {
    addButton(cx-bw/2, cy+100*s, bw, bh, won ? '下一场' : '返回赛季', () => {
      sfxClick();
      if(won) {
        game.season.gameIndex++;
        // Check if season is over (too many losses or all games done)
        if(game.season.gameIndex >= game.seasonGames.length) {
          game.phase = GamePhase.SEASON_END;
        } else {
          game.phase = GamePhase.SHOP;
        }
      } else {
        if(game.season.losses >= 3) {
          game.phase = GamePhase.SEASON_END;
        } else {
          game.season.gameIndex++;
          if(game.season.gameIndex >= game.seasonGames.length) {
            game.phase = GamePhase.SEASON_END;
          } else {
            game.phase = GamePhase.SHOP;
          }
        }
      }
    });
  }
  drawButtons();
  drawParticles();
}


// -- Shop --
function drawShop() {
  const cx = W()/2, cy = H()/2, s = scale();
  ctx.fillStyle = '#0a1a2a';
  ctx.fillRect(0,0,W(),H());
  
  drawBoldText('🏪 战术商店', cx, 40*s, 26, GOLD);
  drawText(`💰 ${game.coins} 比赛币`, cx, 70*s, 16, YELLOW);
  
  // Generate shop items (3 random plays not in deck)
  const shopPlays = PLAYS.filter(p => !game.deck.includes(p.id))
    .sort(() => Math.random()-0.5).slice(0, 3);
  
  // Also show upgrade option
  const cardW = Math.min(170*s, (W()-40*s)/3 - 10*s);
  const cardH = 180*s;
  const totalCards = shopPlays.length;
  const totalW = totalCards * (cardW+10*s);
  const startX = cx - totalW/2;
  const cardY = 100*s;
  
  clearButtons();
  
  shopPlays.forEach((play, i) => {
    const x = startX + i*(cardW+10*s);
    const price = play.type==='long'?200:play.type==='mid'?150:100;
    const canAfford = game.coins >= price;
    
    drawRoundRect(x, cardY, cardW, cardH, 8*s, canAfford?'#1a2a3a':'#111', play.color);
    drawBoldText(play.icon, x+cardW/2, cardY+30*s, 28, play.color);
    drawBoldText(play.name, x+cardW/2, cardY+65*s, 14, WHITE);
    drawText(play.desc, x+cardW/2, cardY+85*s, 10, '#aaa');
    drawText(`类型: ${play.type}`, x+cardW/2, cardY+105*s, 10, '#888');
    if(play.beats.length) drawText('克:'+play.beats.join(','), x+cardW/2, cardY+120*s, 8, GREEN, 'center', cardW-10*s);
    drawBoldText(`💰 ${price}`, x+cardW/2, cardY+145*s, 14, canAfford?GOLD:'#666');
    
    if(canAfford) {
      addButton(x, cardY, cardW, cardH, '', () => {
        sfxSuccess();
        game.coins -= price;
        game.deck.push(play.id);
        game.allCards.push(play.id);
        game.scoutRates[play.id] = 0;
        // Refresh shop by re-entering
        game.phase = GamePhase.SHOP;
      });
    }
  });
  
  // Stat boost option
  const boostY = cardY + cardH + 30*s;
  const boostPrice = 80;
  if(game.coins >= boostPrice) {
    drawRoundRect(cx-120*s, boostY, 240*s, 50*s, 8*s, '#1a3a1a', GREEN);
    drawBoldText(`⬆️ 随机属性+3 (💰${boostPrice})`, cx, boostY+25*s, 13, GREEN);
    addButton(cx-120*s, boostY, 240*s, 50*s, '', () => {
      sfxSuccess();
      game.coins -= boostPrice;
      const stats = ['acc','arm','read','mob'];
      const stat = stats[Math.floor(Math.random()*stats.length)];
      game.qb[stat] = Math.min(99, game.qb[stat]+3);
    });
  }
  
  // Continue button
  const btnY = Math.min(boostY + 80*s, H()-60*s);
  addButton(cx-100*s, btnY, 200*s, 45*s, '▶ 继续赛季', () => {
    sfxClick();
    game.phase = GamePhase.SEASON_MAP;
  });
  
  drawButtons();
  
  // Current deck display
  drawText(`当前Deck: ${game.deck.length}张`, cx, H()-25*s, 11, '#666');
}

// -- Season End --
function drawSeasonEnd() {
  const cx = W()/2, cy = H()/2, s = scale();
  ctx.fillStyle = DARK;
  ctx.fillRect(0,0,W(),H());
  
  const totalWins = game.season.wins;
  const champion = game.seasonGames.some(g => g.isBoss && g.won);
  
  if(champion) {
    drawBoldText('🏆 赛季冠军!', cx, cy-80*s, 32, GOLD);
  } else {
    drawBoldText('📊 赛季结束', cx, cy-80*s, 28, WHITE);
  }
  
  drawText(`赛季 ${game.season.number} 总结`, cx, cy-45*s, 16, '#aaa');
  drawBoldText(`战绩: ${game.season.wins}W - ${game.season.losses}L`, cx, cy-10*s, 22, 
    game.season.wins > game.season.losses ? GREEN : RED);
  
  // QB summary
  drawText(`${game.qb.name} Lv.${game.qb.level}`, cx, cy+25*s, 14, GOLD);
  drawText(`精准:${game.qb.acc} 臂力:${game.qb.arm} 阅读:${game.qb.read} 机动:${game.qb.mob}`, cx, cy+50*s, 12, '#888');
  drawText(`🏆 ${game.shards} 传奇碎片`, cx, cy+75*s, 13, '#ce93d8');
  
  clearButtons();
  addButton(cx-110*s, cy+110*s, 220*s, 48*s, '🔄 开始新赛季', () => {
    sfxWhistle();
    game.season.number++;
    // Keep QB stats, reset season
    startNewSeason();
  });
  drawButtons();
}

// -- Input Handling --
let inputPos = { x:0, y:0 };
let inputDown = false;

function getInputPos(e) {
  if(e.touches) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function handleInput(x, y) {
  inputPos = {x, y};
  
  // Check buttons
  for(let i=buttons.length-1; i>=0; i--) {
    const b = buttons[i];
    if(x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h) {
      if(b.action) b.action();
      return true;
    }
  }
  
  // Execution phase - click on receiver
  if(game.phase === GamePhase.EXECUTION && !game.exec.throwTarget) {
    const s = scale();
    for(let i=0; i<game.exec.receivers.length; i++) {
      const rec = game.exec.receivers[i];
      const dx = x - rec.x;
      const dy = y - rec.y;
      if(dx*dx + dy*dy < (25*s)*(25*s)) {
        handleThrow(i);
        return true;
      }
    }
  }
  
  return false;
}

function handleHover(x, y) {
  game.ui.hoverBtn = null;
  for(let i=0; i<buttons.length; i++) {
    const b = buttons[i];
    if(x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h) {
      game.ui.hoverBtn = i;
      break;
    }
  }
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
  e.preventDefault();
  audioCtx.resume();
  handleInput(e.clientX, e.clientY);
});
canvas.addEventListener('mousemove', (e) => {
  handleHover(e.clientX, e.clientY);
});

// Touch events
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  audioCtx.resume();
  const pos = getInputPos(e);
  handleInput(pos.x, pos.y);
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const pos = getInputPos(e);
  handleHover(pos.x, pos.y);
}, { passive: false });

// -- Main Game Loop --
let lastTime = 0;

function gameLoop(timestamp) {
  const dt = Math.min(0.1, (timestamp - lastTime) / 1000);
  lastTime = timestamp;
  
  // Clear
  ctx.clearRect(0,0,W(),H());
  
  // Update & draw based on phase
  switch(game.phase) {
    case GamePhase.TITLE:
      drawTitle();
      break;
    case GamePhase.TUTORIAL:
      drawTutorial();
      break;
    case GamePhase.SEASON_MAP:
      drawSeasonMap();
      break;
    case GamePhase.PLAY_SELECT:
      drawPlaySelect();
      break;
    case GamePhase.PRE_SNAP:
      drawPreSnap(dt);
      break;
    case GamePhase.EXECUTION:
      updateExecution(dt);
      drawExecution();
      break;
    case GamePhase.THROW_ANIM:
      updateThrowAnim(dt);
      drawThrowAnim();
      break;
    case GamePhase.RESULT:
      drawResult(dt);
      break;
    case GamePhase.DEFENSE_SELECT:
      drawDefenseSelect();
      break;
    case GamePhase.DEFENSE_GUESS:
      updateDefenseGuess(dt);
      drawDefenseGuess();
      break;
    case GamePhase.DEFENSE_PULL_FLAG:
      updatePullFlag(dt);
      drawPullFlag();
      break;
    case GamePhase.DEFENSE_RESULT:
      drawDefenseResult();
      break;
    case GamePhase.HALFTIME:
      drawHalftime();
      break;
    case GamePhase.GAME_OVER:
      drawGameOver();
      break;
    case GamePhase.SHOP:
      drawShop();
      break;
    case GamePhase.SEASON_END:
      drawSeasonEnd();
      break;
  }
  
  // Global animations
  updateParticles(dt);
  
  requestAnimationFrame(gameLoop);
}

// -- Initialize --
document.getElementById('loading').style.display = 'none';
requestAnimationFrame(gameLoop);
