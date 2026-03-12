// ============================================================
// Pocket Commander v2 — Plan-then-Simulate + Three.js
// Flag Football (腰旗橄榄球) — No equipment, no tackling
// ============================================================

// ── Three.js Scene Setup ────────────────────────────────────
const threeCanvas = document.getElementById('three-canvas');
let scene, camera, renderer, clock;
let fieldGroup, playerMeshes = {}, ballMesh, flagRibbons = [];
let simSpeed = 1;

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1628);
  scene.fog = new THREE.FogExp2(0x0a1628, 0.008);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 500);
  camera.position.set(0, 35, 40);
  camera.lookAt(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  clock = new THREE.Clock();

  // Lighting
  const ambient = new THREE.AmbientLight(0x4466aa, 0.5);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(20, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
  scene.add(sun);

  // Stadium lights
  const spotColors = [0x4fc3f7, 0xf9a825, 0x4fc3f7, 0xf9a825];
  [[-30,25,-20],[30,25,-20],[-30,25,30],[30,25,30]].forEach((pos,i) => {
    const spot = new THREE.PointLight(spotColors[i], 0.4, 80);
    spot.position.set(...pos);
    scene.add(spot);
  });

  buildField();
  buildPlayers();
  buildBall();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function buildField() {
  fieldGroup = new THREE.Group();

  // Ground plane (field)
  const fieldW = 60, fieldL = 90;
  const fieldGeo = new THREE.PlaneGeometry(fieldW, fieldL);
  const fieldMat = new THREE.MeshStandardMaterial({ color: 0x2d6a1e, roughness: 0.9 });
  const fieldMesh = new THREE.Mesh(fieldGeo, fieldMat);
  fieldMesh.rotation.x = -Math.PI/2;
  fieldMesh.receiveShadow = true;
  fieldGroup.add(fieldMesh);

  // Yard lines
  for(let i = -40; i <= 40; i += 5) {
    const isMain = i % 10 === 0;
    const lineGeo = new THREE.PlaneGeometry(fieldW - 4, isMain ? 0.15 : 0.06);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: isMain ? 0.5 : 0.2 });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI/2;
    line.position.set(0, 0.01, i);
    fieldGroup.add(line);

    if(isMain && i !== 0) {
      // Yard number markers (small boxes as placeholder)
      const num = 50 - Math.abs(i);
      // We'll skip text (Three.js text is complex); lines are enough
    }
  }

  // End zones
  const ezGeo = new THREE.PlaneGeometry(fieldW, 10);
  const ezMat1 = new THREE.MeshStandardMaterial({ color: 0x1a4a8b, roughness: 0.8, transparent: true, opacity: 0.6 });
  const ez1 = new THREE.Mesh(ezGeo, ezMat1);
  ez1.rotation.x = -Math.PI/2; ez1.position.set(0, 0.005, -50);
  fieldGroup.add(ez1);

  const ezMat2 = new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.8, transparent: true, opacity: 0.6 });
  const ez2 = new THREE.Mesh(ezGeo, ezMat2);
  ez2.rotation.x = -Math.PI/2; ez2.position.set(0, 0.005, 50);
  fieldGroup.add(ez2);

  // Sidelines
  [[-fieldW/2, 0],[fieldW/2, 0]].forEach(([x]) => {
    const sideGeo = new THREE.PlaneGeometry(0.2, fieldL + 20);
    const sideMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const side = new THREE.Mesh(sideGeo, sideMat);
    side.rotation.x = -Math.PI/2; side.position.set(x, 0.01, 0);
    fieldGroup.add(side);
  });

  // First down marker (will be updated)
  const fdGeo = new THREE.PlaneGeometry(fieldW - 4, 0.2);
  const fdMat = new THREE.MeshBasicMaterial({ color: 0xfdd835, transparent: true, opacity: 0.7 });
  const fdLine = new THREE.Mesh(fdGeo, fdMat);
  fdLine.rotation.x = -Math.PI/2;
  fdLine.position.set(0, 0.02, 0);
  fdLine.name = 'firstDownLine';
  fieldGroup.add(fdLine);

  // Line of scrimmage
  const losGeo = new THREE.PlaneGeometry(fieldW - 4, 0.15);
  const losMat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.5 });
  const losLine = new THREE.Mesh(losGeo, losMat);
  losLine.rotation.x = -Math.PI/2;
  losLine.position.set(0, 0.02, 0);
  losLine.name = 'losLine';
  fieldGroup.add(losLine);

  scene.add(fieldGroup);
}

// Convert yard line (0-100) to Z position on field
function yardToZ(yard) {
  // 0 = our endzone (z=45), 50 = midfield (z=0), 100 = their endzone (z=-45)
  return 45 - (yard / 100) * 90;
}

function createPlayerMesh(color, isQB) {
  const group = new THREE.Group();

  // Body (capsule-like: cylinder + spheres)
  const bodyGeo = new THREE.CylinderGeometry(0.4, 0.35, 1.4, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.2;
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.7 });
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 2.1;
  head.castShadow = true;
  group.add(head);

  // Flag ribbons (腰旗!) - two ribbons hanging from waist
  const ribbonGeo = new THREE.PlaneGeometry(0.15, 0.8);
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: color === 0x4fc3f7 ? 0xf9a825 : 0x4fc3f7,
    side: THREE.DoubleSide, roughness: 0.5
  });
  const ribbon1 = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon1.position.set(0.35, 0.8, 0);
  ribbon1.rotation.z = 0.2;
  group.add(ribbon1);
  const ribbon2 = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon2.position.set(-0.35, 0.8, 0);
  ribbon2.rotation.z = -0.2;
  group.add(ribbon2);

  // Store ribbon refs for animation
  group.userData.ribbons = [ribbon1, ribbon2];
  group.userData.color = color;

  // Window indicator (sphere above head) - only for offense
  if(!isQB) {
    const indGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const indMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const indicator = new THREE.Mesh(indGeo, indMat);
    indicator.position.y = 2.7;
    indicator.name = 'indicator';
    group.add(indicator);
  }

  // QB armband
  if(isQB) {
    const bandGeo = new THREE.BoxGeometry(0.5, 0.3, 0.05);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.set(0.45, 1.5, 0);
    group.add(band);
  }

  return group;
}

function buildPlayers() {
  playerMeshes = {};

  // QB
  const qb = createPlayerMesh(0x1565c0, true);
  qb.name = 'qb';
  scene.add(qb);
  playerMeshes.qb = qb;

  // Receivers (WR1, WR2, WR3) + Center
  ['wr1','wr2','wr3'].forEach((id, i) => {
    const wr = createPlayerMesh(0x4fc3f7, false);
    wr.name = id;
    scene.add(wr);
    playerMeshes[id] = wr;
  });

  const center = createPlayerMesh(0x2196f3, false);
  center.name = 'center';
  scene.add(center);
  playerMeshes.center = center;

  // Defense (5 players)
  for(let i = 0; i < 5; i++) {
    const def = createPlayerMesh(0xe53935, false);
    def.name = 'def'+i;
    scene.add(def);
    playerMeshes['def'+i] = def;
    // Hide indicator for defense
    const ind = def.getObjectByName('indicator');
    if(ind) ind.visible = false;
  }
}

function buildBall() {
  const ballGeo = new THREE.SphereGeometry(0.2, 8, 6);
  ballGeo.scale(1, 0.6, 1.5);
  const ballMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.4 });
  ballMesh = new THREE.Mesh(ballGeo, ballMat);
  ballMesh.castShadow = true;
  ballMesh.visible = false;
  scene.add(ballMesh);
}

// ── Game Data: Flag Football Plays & Defenses ───────────────
const PLAYS = [
  { id:'slant', name:'Slant', type:'short', desc:'斜切内线', beats:['cover3','zone'], weakTo:['man'],
    icon:'↗', color:'#4fc3f7',
    routes:[{dx:3,dz:-8,t:1.2},{dx:-2,dz:-7,t:1.0},{dx:5,dz:-5,t:0.8}],
    tip:'LB跟外侧→传内切; LB守中→传外切' },
  { id:'out', name:'Out Route', type:'short', desc:'外切边线', beats:['man'], weakTo:['cover2'],
    icon:'→', color:'#81c784',
    routes:[{dx:10,dz:-6,t:1.1},{dx:-8,dz:-7,t:1.2},{dx:3,dz:-4,t:0.9}],
    tip:'盯人防守时外切可制造分离空间' },
  { id:'curl', name:'Curl', type:'short', desc:'跑出转身接球', beats:[], weakTo:[],
    icon:'↩', color:'#aed581',
    routes:[{dx:2,dz:-10,t:1.3},{dx:-1,dz:-9,t:1.2},{dx:4,dz:-5,t:0.9}],
    tip:'安全的保底选择，适合第三档短距离' },
  { id:'screen', name:'Screen', type:'special', desc:'掩护短传', beats:['blitz'], weakTo:['cover3'],
    icon:'⟵', color:'#fff176',
    routes:[{dx:-2,dz:2,t:0.5},{dx:4,dz:-3,t:0.7},{dx:-5,dz:-4,t:0.8}],
    tip:'对方突袭时的最佳反制，传给前方的接球手' },
  { id:'dig', name:'Dig/In', type:'mid', desc:'内切中路', beats:['cover2'], weakTo:['man'],
    icon:'↙', color:'#7986cb',
    routes:[{dx:8,dz:-14,t:1.6},{dx:-6,dz:-12,t:1.5},{dx:2,dz:-6,t:0.9}],
    tip:'Cover 2中间有空隙，内切可以找到空档' },
  { id:'post', name:'Post', type:'mid', desc:'斜切深中', beats:['cover2'], weakTo:['cover3'],
    icon:'↖', color:'#9575cd',
    routes:[{dx:3,dz:-18,t:1.8},{dx:-2,dz:-15,t:1.6},{dx:5,dz:-7,t:1.0}],
    tip:'两个安全卫之间的空隙是Post路线的目标' },
  { id:'corner', name:'Corner', type:'mid', desc:'外切深区角落', beats:['cover3'], weakTo:['cover2'],
    icon:'↗', color:'#4dd0e1',
    routes:[{dx:14,dz:-16,t:1.8},{dx:-10,dz:-14,t:1.7},{dx:3,dz:-6,t:0.9}],
    tip:'Cover 3的边角是弱点，Corner路线直指那里' },
  { id:'go', name:'Go/Fly', type:'long', desc:'全速直线冲刺', beats:['man'], weakTo:['cover2','cover3'],
    icon:'↑', color:'#ef5350',
    routes:[{dx:5,dz:-25,t:2.2},{dx:-3,dz:-22,t:2.0},{dx:8,dz:-8,t:1.0}],
    tip:'需要速度型接球手，赌对方盯不住一对一' },
  { id:'drag', name:'Drag', type:'short', desc:'横穿浅区', beats:['zone'], weakTo:['man'],
    icon:'↔', color:'#78909c',
    routes:[{dx:12,dz:-4,t:1.0},{dx:-10,dz:-5,t:1.1},{dx:0,dz:-8,t:1.2}],
    tip:'横穿整个场地，在Zone防守的间隙中找空档' },
  { id:'playaction', name:'Play Action', type:'special', desc:'假跑骗防守', beats:['blitz','man'], weakTo:['cover2'],
    icon:'🎭', color:'#ff8a65',
    routes:[{dx:4,dz:-16,t:2.0},{dx:-6,dz:-14,t:1.8},{dx:2,dz:-5,t:0.9}],
    tip:'假装跑动吸引防守注意，再传深远球' },
  { id:'flood', name:'Flood', type:'mid', desc:'三人涌向同侧', beats:['cover3','zone'], weakTo:['man'],
    icon:'🌊', color:'#26c6da',
    routes:[{dx:12,dz:-6,t:1.0},{dx:14,dz:-14,t:1.5},{dx:10,dz:-20,t:1.8}],
    tip:'同侧三层路线让Zone防守顾此失彼' },
  { id:'mesh', name:'Mesh交叉', type:'short', desc:'两人交叉跑位', beats:['man','zone'], weakTo:['blitz'],
    icon:'✕', color:'#ce93d8',
    routes:[{dx:8,dz:-7,t:1.1},{dx:-8,dz:-7,t:1.1},{dx:0,dz:-12,t:1.4}],
    tip:'交叉跑位制造自然的Pick效果，干扰盯人防守' },
];

const DEFENSES = [
  { id:'man', name:'Man盯人', desc:'每人贴身盯一个接球手', icon:'👤', color:'#ef5350',
    positions:[{dx:5,dz:-3},{dx:-5,dz:-3},{dx:8,dz:-3},{dx:0,dz:-8},{dx:0,dz:-15}] },
  { id:'cover2', name:'Cover 2', desc:'两个安全卫分守深区', icon:'2️⃣', color:'#42a5f5',
    positions:[{dx:3,dz:-4},{dx:-3,dz:-4},{dx:0,dz:-7},{dx:10,dz:-18},{dx:-10,dz:-18}] },
  { id:'cover3', name:'Cover 3', desc:'三人分区防守深区', icon:'3️⃣', color:'#66bb6a',
    positions:[{dx:5,dz:-4},{dx:-5,dz:-4},{dx:0,dz:-20},{dx:12,dz:-15},{dx:-12,dz:-15}] },
  { id:'blitz', name:'Blitz突袭', desc:'多人冲向QB抢旗', icon:'⚡', color:'#ffa726',
    positions:[{dx:2,dz:-2},{dx:-2,dz:-2},{dx:5,dz:-1},{dx:-5,dz:-1},{dx:0,dz:-10}] },
];

// ── Game State ──────────────────────────────────────────────
let G = {};
function newGame() {
  return {
    phase: 'title', // title|season_map|play_select|simulating|defense_select|def_simulating|result|shop|game_over|season_end
    qb: { acc:40, arm:35, read:30, mob:30, level:1, xp:0 },
    season: { number:1, gameIndex:0, wins:0, losses:0 },
    match: { playerScore:0, oppScore:0, quarter:1, ballPos:25, down:1, ytg:10, possession:'player', momentum:0, history:[] },
    deck: ['slant','out','curl','screen','dig','post','go','mesh'],
    hand: [],
    coins: 200,
    shards: 0,
    scoutRates: {},
    selectedPlay: null,
    readOrder: [0,1,2],
    selectedDef: null,
    opponent: { name:'Street Dogs', difficulty:1, style:'balanced', isBoss:false },
    seasonGames: [],
    sim: { active:false, step:0, steps:[], timer:0 },
  };
}

function getPlay(id) { return PLAYS.find(p=>p.id===id); }
function getDef(id) { return DEFENSES.find(d=>d.id===id); }

// ── UI Helpers ──────────────────────────────────────────────
function showPanel(id) { document.getElementById(id).classList.add('active'); }
function hidePanel(id) { document.getElementById(id).classList.remove('active'); }
function hideAllPanels() {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('sim-log').style.display = 'none';
  document.getElementById('speed-control').style.display = 'none';
}

function updateHUD() {
  const h = document.getElementById('hud');
  if(G.phase === 'title' || G.phase === 'season_map' || G.phase === 'season_end') {
    h.style.display = 'none'; return;
  }
  h.style.display = 'flex';
  h.querySelector('.you').textContent = `YOU ${G.match.playerScore}`;
  h.querySelector('.opp').textContent = `${G.match.oppScore} ${G.opponent.name}`;
  const downNames = ['','1st','2nd','3rd','4th'];
  h.querySelector('.hud-down').textContent = `${downNames[G.match.down]||G.match.down+'th'} & ${G.match.ytg}`;
  h.querySelector('.hud-info').textContent = `Q${G.match.quarter} · 球在${G.match.ballPos}码线`;
}

function showSimLog(text, color) {
  const el = document.getElementById('sim-log');
  el.textContent = text;
  el.style.color = color || '#fff';
  el.style.display = 'block';
}
function hideSimLog() { document.getElementById('sim-log').style.display = 'none'; }

// ── Season Generation ───────────────────────────────────────
function generateSeason() {
  const names = ['Street Dogs','Thunder','Iron Wall','Shadow','Blaze','Storm','Wolves','Vipers','Titans','Phantoms'];
  const styles = ['aggressive','balanced','defensive','tricky'];
  G.seasonGames = [];
  for(let i=0; i<5; i++) {
    G.seasonGames.push({
      name: names[Math.floor(Math.random()*names.length)],
      difficulty: 1 + i*0.5 + Math.random()*0.3,
      style: styles[Math.floor(Math.random()*styles.length)],
      completed:false, won:false
    });
  }
  G.seasonGames.push({
    name:'铁壁教练 Rick', difficulty:3.5, style:'boss', completed:false, won:false, isBoss:true
  });
}

function showSeasonMap() {
  G.phase = 'season_map';
  hideAllPanels();
  updateHUD();
  document.getElementById('season-title').textContent = `🏈 赛季 ${G.season.number}`;
  document.getElementById('season-stats').innerHTML =
    `${G.qb.level}级 QB · 精准${G.qb.acc} 臂力${G.qb.arm} 阅读${G.qb.read} 机动${G.qb.mob}<br>💰${G.coins} · 🏆${G.shards}碎片 · 战绩 ${G.season.wins}W-${G.season.losses}L`;

  const container = document.getElementById('season-games');
  container.innerHTML = '';
  G.seasonGames.forEach((g, i) => {
    const isCurrent = i === G.season.gameIndex;
    const isLocked = i > G.season.gameIndex;
    const div = document.createElement('div');
    div.style.cssText = `padding:12px;margin:6px 0;border-radius:10px;text-align:center;font-weight:bold;
      border:2px solid ${g.completed?(g.won?'#43a047':'#c62828'):(isCurrent?'#f9a825':'#333')};
      background:${g.completed?(g.won?'rgba(67,160,71,0.15)':'rgba(198,40,40,0.15)'):(isCurrent?'rgba(249,168,37,0.1)':'rgba(0,0,0,0.2)')};
      opacity:${isLocked?0.4:1}; cursor:${isCurrent&&!g.completed?'pointer':'default'};
      transition:all 0.2s;`;
    const label = g.isBoss ? `🏛️ BOSS: ${g.name}` : `第${i+1}场: ${g.name}`;
    const status = g.completed ? (g.won ? '✅' : '❌') : (isCurrent ? '▶ 进入比赛' : '🔒');
    div.textContent = `${label}  ${status}`;
    if(isCurrent && !g.completed) {
      div.onmouseenter = () => div.style.borderColor = '#fbc02d';
      div.onmouseleave = () => div.style.borderColor = '#f9a825';
      div.onclick = () => startMatch(g);
    }
    container.appendChild(div);
  });
  showPanel('season-panel');
}

// ── Start Match ─────────────────────────────────────────────
function startMatch(opp) {
  G.opponent = opp;
  G.match = { playerScore:0, oppScore:0, quarter:1, ballPos:25, down:1, ytg:10, possession:'player', momentum:0, history:[] };
  G.scoutRates = {};
  G.deck.forEach(id => G.scoutRates[id] = 0);
  hideAllPanels();
  positionPlayersAtLine(G.match.ballPos);
  setCameraForPlay(G.match.ballPos);
  showPlaySelect();
}

// ── 3D Positioning ──────────────────────────────────────────
function positionPlayersAtLine(yardLine) {
  const z = yardToZ(yardLine);
  // QB behind center
  playerMeshes.qb.position.set(0, 0, z + 5);
  playerMeshes.qb.rotation.y = 0;
  // Center
  playerMeshes.center.position.set(0, 0, z + 2);
  // WRs spread out
  playerMeshes.wr1.position.set(8, 0, z + 2);
  playerMeshes.wr2.position.set(-8, 0, z + 2);
  playerMeshes.wr3.position.set(5, 0, z + 3);
  // Hide indicators
  ['wr1','wr2','wr3'].forEach(id => {
    const ind = playerMeshes[id].getObjectByName('indicator');
    if(ind) ind.material.color.setHex(0x888888);
  });
  // Defense - default spread
  const defZ = z - 3;
  [[3, defZ],[-3, defZ],[8, defZ-2],[-8, defZ-2],[0, defZ-10]].forEach(([x,dz],i) => {
    playerMeshes['def'+i].position.set(x, 0, dz);
  });
  // Update field markers
  const los = fieldGroup.getObjectByName('losLine');
  if(los) los.position.z = z;
  const fd = fieldGroup.getObjectByName('firstDownLine');
  if(fd) fd.position.z = yardToZ(Math.min(100, yardLine + G.match.ytg));
  // Ball hidden
  ballMesh.visible = false;
}

function setCameraForPlay(yardLine) {
  const z = yardToZ(yardLine);
  camera.position.set(0, 28, z + 35);
  camera.lookAt(0, 0, z - 5);
}

function positionDefenseFormation(defId, yardLine) {
  const def = getDef(defId);
  if(!def) return;
  const z = yardToZ(yardLine);
  def.positions.forEach((p, i) => {
    if(playerMeshes['def'+i]) {
      playerMeshes['def'+i].position.set(p.dx, 0, z + p.dz);
    }
  });
}

// ── Play Selection UI ───────────────────────────────────────
function dealHand() {
  const available = [...G.deck];
  G.hand = [];
  for(let i = 0; i < Math.min(4, available.length); i++) {
    const idx = Math.floor(Math.random()*available.length);
    G.hand.push(available[idx]);
    available.splice(idx, 1);
  }
}

function showPlaySelect() {
  G.phase = 'play_select';
  G.selectedPlay = null;
  G.readOrder = [0,1,2];
  dealHand();
  hideAllPanels();
  updateHUD();

  // Opponent picks defense
  const oppDef = chooseOpponentDefense();
  G.match.currentDef = oppDef;
  positionDefenseFormation(oppDef, G.match.ballPos);

  // Show defense hint based on QB read
  const readChance = 0.3 + (G.qb.read / 100) * 0.6;
  const def = getDef(oppDef);
  const hint = Math.random() < readChance
    ? `🔍 侦察: 对方似乎在用 ${def.icon} ${def.name}`
    : '🔍 侦察: 无法确定对方防守阵型';
  document.getElementById('defense-hint').textContent = hint;

  document.getElementById('play-panel-down').textContent =
    `${['','1st','2nd','3rd','4th'][G.match.down]} & ${G.match.ytg} · 球在${G.match.ballPos}码线`;

  // Render cards
  const container = document.getElementById('play-cards');
  container.innerHTML = '';
  G.hand.forEach((playId, i) => {
    const play = getPlay(playId);
    if(!play) return;
    const scout = G.scoutRates[playId] || 0;
    const scoutClass = scout < 20 ? 'scout-cold' : scout < 40 ? 'scout-normal' : scout < 60 ? 'scout-hot' : 'scout-burn';
    const scoutLabel = scout < 20 ? '冷门' : scout < 40 ? '正常' : scout < 60 ? '警戒' : '被看穿';

    const card = document.createElement('div');
    card.className = 'card fade-in';
    card.style.animationDelay = (i*0.05)+'s';
    card.innerHTML = `
      <div class="icon">${play.icon}</div>
      <div class="name">${play.name}</div>
      <div class="desc">${play.desc}</div>
      <div class="tags">
        ${play.beats.map(b=>`<span class="tag beat">克${getDef(b)?.name||b}</span>`).join('')}
        ${play.weakTo.map(b=>`<span class="tag weak">弱${getDef(b)?.name||b}</span>`).join('')}
        <span class="tag ${scoutClass}">侦察:${scoutLabel}</span>
      </div>
      <div style="font-size:10px;color:#666;margin-top:4px">${play.tip}</div>
    `;
    card.onclick = () => selectPlay(i, card);
    container.appendChild(card);
  });

  document.getElementById('snap-btn').style.display = 'none';
  document.getElementById('read-order-section').style.display = 'none';
  showPanel('play-panel');
}

function selectPlay(index, cardEl) {
  G.selectedPlay = G.hand[index];
  document.querySelectorAll('#play-cards .card').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');

  // Show read order configuration
  const play = getPlay(G.selectedPlay);
  const numReceivers = play.routes.length;
  G.readOrder = Array.from({length:numReceivers}, (_,i) => i);

  const section = document.getElementById('read-order-section');
  section.style.display = 'block';
  renderReadOrder(numReceivers);

  document.getElementById('snap-btn').style.display = 'block';

  // Update 3D preview - show route lines
  updateRoutePreview(play);
}

function renderReadOrder(count) {
  const container = document.getElementById('read-order');
  container.innerHTML = '';
  const labels = ['WR1','WR2','WR3'];
  G.readOrder.forEach((ri, i) => {
    if(i > 0) {
      const arrow = document.createElement('span');
      arrow.className = 'read-arrow';
      arrow.textContent = '→';
      container.appendChild(arrow);
    }
    const slot = document.createElement('div');
    slot.className = 'read-slot filled';
    slot.textContent = labels[ri] || ('R'+(ri+1));
    slot.style.color = '#4fc3f7';
    slot.onclick = () => {
      // Cycle: move this receiver to next position
      const idx = G.readOrder.indexOf(ri);
      if(idx < G.readOrder.length-1) {
        [G.readOrder[idx], G.readOrder[idx+1]] = [G.readOrder[idx+1], G.readOrder[idx]];
      } else {
        // Move to front
        G.readOrder.splice(idx, 1);
        G.readOrder.unshift(ri);
      }
      renderReadOrder(count);
    };
    container.appendChild(slot);
  });
}

let routeLines = [];
function updateRoutePreview(play) {
  // Remove old route lines
  routeLines.forEach(l => scene.remove(l));
  routeLines = [];

  const z = yardToZ(G.match.ballPos);
  const wrStartPositions = [
    {x:8, z:z+2}, {x:-8, z:z+2}, {x:5, z:z+3}
  ];

  play.routes.forEach((route, i) => {
    if(i >= 3) return;
    const start = wrStartPositions[i];
    const end = {x: start.x + route.dx, z: start.z + route.dz};

    const points = [
      new THREE.Vector3(start.x, 0.3, start.z),
      new THREE.Vector3(end.x, 0.3, end.z),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(play.color),
      transparent: true, opacity: 0.6
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    routeLines.push(line);

    // Arrow head
    const arrowLen = 0.8;
    const dx = end.x - start.x, dz = end.z - start.z;
    const len = Math.sqrt(dx*dx+dz*dz);
    const nx = dx/len, nz = dz/len;
    const arrowPts = [
      new THREE.Vector3(end.x - nx*arrowLen + nz*0.4, 0.3, end.z - nz*arrowLen - nx*0.4),
      new THREE.Vector3(end.x, 0.3, end.z),
      new THREE.Vector3(end.x - nx*arrowLen - nz*0.4, 0.3, end.z - nz*arrowLen + nx*0.4),
    ];
    const arrowGeo = new THREE.BufferGeometry().setFromPoints(arrowPts);
    const arrowLine = new THREE.Line(arrowGeo, mat);
    scene.add(arrowLine);
    routeLines.push(arrowLine);
  });
}

function chooseOpponentDefense() {
  const hist = G.match.history;
  if(G.opponent.isBoss) {
    const cycle = ['man','cover2','cover3','blitz'];
    return cycle[Math.floor(hist.length/3) % cycle.length];
  }
  let weights = {man:1, cover2:1, cover3:1, blitz:0.5};
  if(G.opponent.style==='aggressive') weights.blitz += 1.5;
  if(G.opponent.style==='defensive') { weights.cover2 += 1; weights.cover3 += 1; }
  // Adapt
  if(hist.length >= 2) {
    const recent = hist.slice(-2).map(h=>getPlay(h.playId)?.type);
    if(recent.filter(t=>t==='long').length >= 1) { weights.cover2 += 1; weights.cover3 += 0.8; }
    if(recent.filter(t=>t==='short'||t==='special').length >= 1) { weights.man += 0.5; weights.blitz += 0.5; }
  }
  const total = Object.values(weights).reduce((a,b)=>a+b,0);
  let r = Math.random()*total;
  for(const [k,w] of Object.entries(weights)) { r -= w; if(r<=0) return k; }
  return 'cover2';
}

// ── Simulation Engine (Plan-then-Watch) ─────────────────────
function confirmSnap() {
  if(!G.selectedPlay) return;
  hideAllPanels();

  const play = getPlay(G.selectedPlay);
  const def = G.match.currentDef;
  const isBeat = play.beats.includes(def);
  const isWeak = play.weakTo.includes(def);

  // Update scout rates
  const totalPlays = G.match.history.length + 1;
  G.deck.forEach(id => {
    const uses = G.match.history.filter(h=>h.playId===id).length + (id===G.selectedPlay?1:0);
    G.scoutRates[id] = Math.round((uses/totalPlays)*100);
  });

  // Calculate outcome for each receiver
  const recOutcomes = play.routes.map((route, i) => {
    let openChance = 0.5;
    if(isBeat) openChance += 0.3;
    if(isWeak) openChance -= 0.25;
    openChance += (G.qb.read/100) * 0.15;
    // Scout penalty
    const scout = G.scoutRates[G.selectedPlay] || 0;
    if(scout > 60) openChance -= 0.2;
    else if(scout > 40) openChance -= 0.1;
    else if(scout < 20) openChance += 0.1;
    // Difficulty
    openChance -= G.opponent.difficulty * 0.06;
    openChance = Math.max(0.1, Math.min(0.9, openChance));
    const isOpen = Math.random() < openChance;

    // Yards if caught
    let yards = 0;
    if(route.dz) yards = Math.abs(route.dz) * 0.8 + Math.floor(Math.random()*5);
    if(play.type==='short') yards = Math.min(yards, 12);
    if(play.type==='long') yards = Math.max(yards, 15);
    yards = Math.round(yards);
    // Accuracy affects catch
    const catchChance = isOpen ? (0.6 + G.qb.acc/100*0.35) : (0.15 + G.qb.acc/100*0.1);

    return { index:i, isOpen, catchChance, yards, route };
  });

  // QB reads in order and throws to first open
  let throwTarget = -1;
  let throwResult = 'incomplete';
  let throwYards = 0;
  const readSteps = [];

  // Blitz pressure: might not get to later reads
  const maxReads = def === 'blitz' ? Math.min(2, G.readOrder.length) : G.readOrder.length;

  for(let readIdx = 0; readIdx < maxReads; readIdx++) {
    const ri = G.readOrder[readIdx];
    if(ri >= recOutcomes.length) continue;
    const outcome = recOutcomes[ri];

    readSteps.push({ receiver:ri, isOpen:outcome.isOpen });

    if(outcome.isOpen) {
      throwTarget = ri;
      // Roll catch
      if(Math.random() < outcome.catchChance) {
        throwResult = 'complete';
        throwYards = outcome.yards;
        // Check TD
        if(G.match.ballPos + throwYards >= 100) {
          throwYards = 100 - G.match.ballPos;
          throwResult = 'touchdown';
        }
      } else {
        throwResult = 'incomplete'; // Dropped
      }
      break;
    }
  }

  // If no one open, check down (last receiver) or scramble
  if(throwTarget === -1) {
    // Forced throw or flag pull on QB
    if(def === 'blitz' && G.qb.mob > 40 && Math.random() < 0.4) {
      throwResult = 'scramble';
      throwYards = Math.floor(G.qb.mob/10) + Math.floor(Math.random()*5);
      if(G.match.ballPos + throwYards >= 100) {
        throwYards = 100 - G.match.ballPos;
        throwResult = 'scramble_td';
      }
    } else {
      // Force throw to last read
      const lastRI = G.readOrder[G.readOrder.length-1];
      if(lastRI < recOutcomes.length) {
        throwTarget = lastRI;
        const outcome = recOutcomes[lastRI];
        if(Math.random() < outcome.catchChance * 0.7) {
          throwResult = 'complete';
          throwYards = Math.max(1, Math.floor(outcome.yards * 0.5));
        } else if(Math.random() < 0.3) {
          throwResult = 'interception';
          throwYards = 0;
        } else {
          throwResult = 'incomplete';
        }
      }
    }
  }

  // Build simulation timeline
  const simSteps = [];
  const z = yardToZ(G.match.ballPos);
  const wrStarts = [{x:8,z:z+2},{x:-8,z:z+2},{x:5,z:z+3}];

  // Step 1: Snap
  simSteps.push({ type:'snap', duration:0.6, text:'📣 SNAP!' });

  // Step 2: Routes develop (show each read)
  readSteps.forEach((rs, idx) => {
    const wrId = ['wr1','wr2','wr3'][rs.receiver];
    const route = play.routes[rs.receiver];
    const startPos = wrStarts[rs.receiver];
    simSteps.push({
      type: 'route',
      duration: route.t / simSpeed,
      receiver: rs.receiver,
      wrId,
      startX: startPos.x, startZ: startPos.z,
      endX: startPos.x + route.dx, endZ: startPos.z + route.dz,
      isOpen: rs.isOpen,
      text: `阅读 #${idx+1}: ${wrId.toUpperCase()} ${rs.isOpen?'🟢 空档!':'🔴 被盯住'}`,
    });
  });

  // Step 3: Throw
  if(throwResult === 'scramble' || throwResult === 'scramble_td') {
    simSteps.push({ type:'scramble', duration:1.5, yards:throwYards, text:`🏃 QB持球跑! +${throwYards}码`, isTD: throwResult==='scramble_td' });
  } else if(throwTarget >= 0) {
    const wrId = ['wr1','wr2','wr3'][throwTarget];
    simSteps.push({ type:'throw', duration:0.8, target:throwTarget, wrId, text:`🏈 传球给 ${wrId.toUpperCase()}!` });
    if(throwResult === 'complete' || throwResult === 'touchdown') {
      simSteps.push({ type:'catch', duration:0.5, target:throwTarget, wrId, yards:throwYards,
        text: throwResult==='touchdown' ? `🎉 TOUCHDOWN!!! +${throwYards}码!` : `✅ 接球成功! +${throwYards}码`,
        isTD: throwResult==='touchdown' });
    } else if(throwResult === 'interception') {
      simSteps.push({ type:'interception', duration:1.0, text:'❌ 被抄截!!!' });
    } else {
      simSteps.push({ type:'drop', duration:0.6, text:'⚠️ 传球未完成' });
    }
  }

  // Step 4: Flag pull (if completed, show flag pull moment)
  if(throwResult === 'complete') {
    simSteps.push({ type:'flagpull', duration:0.8, text:'🏴 防守拔旗! 进攻结束' });
  }

  // Store result
  G.sim = {
    active: true, step: 0, steps: simSteps, timer: 0,
    result: throwResult, yards: throwYards, target: throwTarget,
    isBeat, isWeak, def,
  };
  G.phase = 'simulating';
  document.getElementById('speed-control').style.display = 'block';
}

// ── Sim Step Execution (3D animation) ───────────────────────
function updateSimulation(dt) {
  if(!G.sim.active || G.sim.step >= G.sim.steps.length) {
    finishSimulation();
    return;
  }

  const step = G.sim.steps[G.sim.step];
  G.sim.timer += dt * simSpeed;

  // Show log text
  showSimLog(step.text, step.isTD ? '#f9a825' : step.type==='interception' ? '#ef5350' : '#fff');

  const progress = Math.min(1, G.sim.timer / step.duration);

  switch(step.type) {
    case 'snap':
      // Ball appears, center snaps to QB
      ballMesh.visible = true;
      const snapZ = playerMeshes.qb.position.z;
      ballMesh.position.set(0, 1 + Math.sin(progress*Math.PI)*1.5, snapZ + 2 - progress*2);
      if(progress >= 0.5) {
        ballMesh.position.copy(playerMeshes.qb.position);
        ballMesh.position.y = 1.5;
      }
      break;

    case 'route': {
      const wr = playerMeshes[step.wrId];
      if(wr) {
        const ease = progress < 0.5 ? 2*progress*progress : 1-Math.pow(-2*progress+2,2)/2;
        wr.position.x = step.startX + (step.endX - step.startX) * ease;
        wr.position.z = step.startZ + (step.endZ - step.startZ) * ease;
        // Animate ribbons
        wr.userData.ribbons?.forEach((r,ri) => {
          r.rotation.x = Math.sin(progress*10+ri) * 0.3;
          r.rotation.z = (ri===0?0.2:-0.2) + Math.sin(progress*8)*0.15;
        });
        // Update indicator
        const ind = wr.getObjectByName('indicator');
        if(ind) {
          ind.material.color.setHex(step.isOpen ? 0x43a047 : 0xe53935);
          // Pulse
          ind.scale.setScalar(1 + Math.sin(progress*Math.PI*4)*0.3);
        }
      }
      // Defense moves toward receiver
      if(step.receiver < 5) {
        const defMesh = playerMeshes['def'+step.receiver];
        if(defMesh && !step.isOpen) {
          const targetX = step.endX + (Math.random()-0.5)*2;
          const targetZ = step.endZ + 1;
          defMesh.position.x += (targetX - defMesh.position.x) * dt * 2;
          defMesh.position.z += (targetZ - defMesh.position.z) * dt * 2;
        }
      }
      break;
    }

    case 'throw': {
      const wr = playerMeshes[step.wrId];
      if(wr && ballMesh) {
        const qbPos = playerMeshes.qb.position;
        const wrPos = wr.position;
        ballMesh.visible = true;
        const ease = progress;
        ballMesh.position.x = qbPos.x + (wrPos.x - qbPos.x) * ease;
        ballMesh.position.z = qbPos.z + (wrPos.z - qbPos.z) * ease;
        ballMesh.position.y = 1.5 + Math.sin(ease * Math.PI) * 3;
        ballMesh.rotation.x += dt * 15;
      }
      break;
    }

    case 'catch': {
      const wr = playerMeshes[step.wrId];
      if(wr) {
        ballMesh.position.copy(wr.position);
        ballMesh.position.y = 1.5;
        // Receiver runs forward a bit (YAC)
        wr.position.z -= dt * 3;
        ballMesh.position.z = wr.position.z;
        ballMesh.position.y = 1.5;
      }
      break;
    }

    case 'interception': {
      // Ball goes to a defender
      const defMesh = playerMeshes['def0'];
      ballMesh.position.lerp(defMesh.position.clone().add(new THREE.Vector3(0,1.5,0)), dt*3);
      break;
    }

    case 'scramble': {
      const qb = playerMeshes.qb;
      qb.position.z -= dt * 8;
      ballMesh.position.copy(qb.position);
      ballMesh.position.y = 1.5;
      // Ribbons flutter
      qb.userData.ribbons?.forEach((r,ri) => {
        r.rotation.x = Math.sin(progress*12+ri) * 0.5;
      });
      break;
    }

    case 'flagpull': {
      // Defender runs to receiver and "pulls flag"
      if(G.sim.target >= 0) {
        const wrId = ['wr1','wr2','wr3'][G.sim.target];
        const wr = playerMeshes[wrId];
        const def = playerMeshes['def'+ Math.min(G.sim.target, 4)];
        if(wr && def) {
          def.position.lerp(wr.position, dt*5);
          // At end, ribbon drops
          if(progress > 0.7) {
            wr.userData.ribbons?.forEach(r => {
              r.position.y -= dt * 2;
              r.rotation.x = Math.PI/3;
            });
          }
        }
      }
      break;
    }

    case 'drop':
      ballMesh.position.y -= dt * 5;
      if(ballMesh.position.y < 0.2) ballMesh.position.y = 0.2;
      break;
  }

  // Step complete?
  if(G.sim.timer >= step.duration) {
    G.sim.timer = 0;
    G.sim.step++;
  }
}

function finishSimulation() {
  G.sim.active = false;
  document.getElementById('speed-control').style.display = 'none';
  hideSimLog();

  // Apply result
  const r = G.sim.result;
  const yards = G.sim.yards;

  G.match.history.push({ playId: G.selectedPlay, defense: G.sim.def, success: r==='complete'||r==='touchdown'||r==='scramble'||r==='scramble_td', yards });

  let grade = 'C', message = '', detail = '';
  const defName = getDef(G.sim.def)?.name || G.sim.def;
  const playName = getPlay(G.selectedPlay)?.name || '';

  if(r === 'touchdown' || r === 'scramble_td') {
    G.match.playerScore += 7;
    G.match.momentum = Math.min(6, G.match.momentum + 2);
    G.coins += 50; G.qb.xp += 30;
    grade = 'S'; message = `🎉 达阵得分！+${yards}码`;
  } else if(r === 'complete') {
    G.match.ballPos += yards;
    G.match.ytg -= yards;
    G.match.momentum = Math.min(6, G.match.momentum + 1);
    G.coins += 10; G.qb.xp += 10;
    if(G.match.ytg <= 0) { G.match.down = 1; G.match.ytg = 10; }
    else G.match.down++;
    grade = G.sim.isBeat ? 'A' : 'B';
    message = `✅ 传球成功 +${yards}码`;
  } else if(r === 'scramble') {
    G.match.ballPos += yards;
    G.match.ytg -= yards;
    G.coins += 10; G.qb.xp += 8;
    if(G.match.ytg <= 0) { G.match.down = 1; G.match.ytg = 10; }
    else G.match.down++;
    grade = 'B'; message = `🏃 QB跑动 +${yards}码`;
  } else if(r === 'interception') {
    G.match.momentum = 0; G.qb.xp += 2;
    grade = 'D'; message = '❌ 被抄截！攻防转换';
  } else {
    G.match.down++; G.match.momentum = Math.max(0, G.match.momentum-1);
    G.qb.xp += 3;
    grade = 'C'; message = '⚠️ 传球未完成';
  }

  // Matchup info
  detail = `${playName} vs ${defName}`;
  if(G.sim.isBeat) detail += ' — ✅ 战术克制!';
  else if(G.sim.isWeak) detail += ' — ❌ 被克制!';

  // Level up check
  if(G.qb.xp >= G.qb.level * 50) {
    G.qb.xp -= G.qb.level * 50;
    G.qb.level++;
    const stats = ['acc','arm','read','mob'];
    const stat = stats[Math.floor(Math.random()*stats.length)];
    G.qb[stat] = Math.min(99, G.qb[stat] + 2 + Math.floor(Math.random()*3));
    detail += ` | ⬆️ 升级! ${stat}提升!`;
  }

  showResult(grade, message, detail);
}

function setSimSpeed(s) {
  simSpeed = s;
  document.querySelectorAll('#speed-control button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}

// ── Result / Continue / Defense / Shop / Season End ─────────
function showResult(grade, message, detail) {
  G.phase = 'result';
  const gradeColors = {S:'#f9a825',A:'#43a047',B:'#4fc3f7',C:'#fdd835',D:'#ef5350'};
  document.getElementById('result-grade').textContent = grade;
  document.getElementById('result-grade').style.color = gradeColors[grade]||'#fff';
  document.getElementById('result-message').textContent = message;
  document.getElementById('result-message').style.color = grade==='D'?'#ef5350':grade==='S'?'#f9a825':'#fff';
  document.getElementById('result-detail').textContent = detail;
  const scout = G.scoutRates[G.selectedPlay]||0;
  document.getElementById('result-matchup').textContent = `侦察度: ${scout}% | Momentum: ${'🔥'.repeat(G.match.momentum)}`;
  document.getElementById('result-matchup').style.color = scout>50?'#ffa726':'#888';
  showPanel('result-panel');
  updateHUD();
}

function continueAfterResult() {
  hideAllPanels();
  const r = G.sim.result;

  if(r === 'touchdown' || r === 'scramble_td') {
    G.match.possession = 'opponent';
    G.match.ballPos = 25; G.match.down = 1; G.match.ytg = 10;
    showDefenseSelect();
    return;
  }
  if(r === 'interception') {
    simulateOpponentDrive();
    return;
  }
  if(G.match.down > 4) {
    // Turnover on downs
    G.match.possession = 'opponent';
    G.match.ballPos = Math.max(25, 100 - G.match.ballPos);
    G.match.down = 1; G.match.ytg = 10;
    showDefenseSelect();
    return;
  }
  advanceTime();
  if(G.phase !== 'game_over' && G.phase !== 'season_end') {
    positionPlayersAtLine(G.match.ballPos);
    setCameraForPlay(G.match.ballPos);
    showPlaySelect();
  }
}

function advanceTime() {
  G.match.quarter += 0.25; // Each play ~ 1/4 quarter
  if(G.match.quarter > 4.75) {
    endMatch();
  }
}

// ── Defense Turn ────────────────────────────────────────────
function showDefenseSelect() {
  G.phase = 'defense_select';
  G.selectedDef = null;
  hideAllPanels();
  updateHUD();

  const container = document.getElementById('def-cards');
  container.innerHTML = '';
  DEFENSES.forEach(def => {
    const card = document.createElement('div');
    card.className = 'def-card fade-in';
    card.innerHTML = `<div class="icon">${def.icon}</div><div class="name">${def.name}</div><div class="desc">${def.desc}</div>`;
    card.onclick = () => {
      G.selectedDef = def.id;
      container.querySelectorAll('.def-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      document.getElementById('def-confirm-btn').style.display = 'block';
    };
    container.appendChild(card);
  });
  document.getElementById('def-confirm-btn').style.display = 'none';
  showPanel('def-panel');
}

function confirmDefense() {
  hideAllPanels();
  simulateOpponentDrive();
}

function simulateOpponentDrive() {
  G.phase = 'def_simulating';
  // Determine opponent play type
  const oppTypes = ['short','mid','long'];
  const w = G.opponent.style==='aggressive'?[0.2,0.3,0.5]:[0.4,0.35,0.25];
  let r = Math.random(), oppType = 'short';
  for(let i=0;i<3;i++){r-=w[i];if(r<=0){oppType=oppTypes[i];break;}}

  let successChance = 0.4 + G.opponent.difficulty * 0.08;
  // Defense effectiveness
  const def = G.selectedDef || 'cover2';
  if(def==='blitz' && oppType==='short') successChance -= 0.15;
  if(def==='man' && oppType==='mid') successChance -= 0.1;
  if(def==='cover2' && oppType==='long') successChance -= 0.2;
  if(def==='cover3' && oppType==='long') successChance -= 0.15;
  if(def==='blitz' && oppType==='long') successChance += 0.15;
  successChance = Math.max(0.1, Math.min(0.75, successChance));

  const success = Math.random() < successChance;
  let scoredTD = success && Math.random() < (0.15 + G.opponent.difficulty*0.06);

  // Simulate with delay
  showSimLog('🛡️ 对手进攻中...', '#ef5350');

  // Simple 3D: move defense players forward
  const z = yardToZ(G.match.ballPos);
  positionPlayersAtLine(G.match.ballPos);

  // Animate opponent drive (just move some players)
  let elapsed = 0;
  const driveInterval = setInterval(() => {
    elapsed += 0.05;
    // Move random offensive players forward
    ['wr1','wr2','wr3'].forEach(id => {
      playerMeshes[id].position.z -= 0.3 * simSpeed;
    });
    // Defense chases
    for(let i=0;i<5;i++) {
      const d = playerMeshes['def'+i];
      d.position.z -= 0.25 * simSpeed;
    }

    if(elapsed > 2 / simSpeed) {
      clearInterval(driveInterval);
      hideSimLog();

      if(scoredTD) {
        G.match.oppScore += 7;
        showResult('D', `😤 对手达阵得分! 比分 ${G.match.playerScore}-${G.match.oppScore}`,
          `你的防守: ${getDef(def)?.name||def} vs 对手${oppType==='short'?'短传':oppType==='long'?'长传':'中传'}`);
      } else if(success) {
        showResult('B', '🛡️ 对手推进但未得分', `你的防守限制了对手`);
      } else {
        showResult('A', '🛡️ 防守成功! 对手进攻未果!', `${getDef(def)?.name||def} 有效遏制了对手`);
      }
      // Return possession
      G.match.possession = 'player';
      G.match.ballPos = 25; G.match.down = 1; G.match.ytg = 10;
      advanceTime();
    }
  }, 50);
}

// ── End Match ───────────────────────────────────────────────
function endMatch() {
  const won = G.match.playerScore > G.match.oppScore;
  G.phase = 'game_over';
  hideAllPanels();

  const gi = G.season.gameIndex;
  if(gi < G.seasonGames.length) {
    G.seasonGames[gi].completed = true;
    G.seasonGames[gi].won = won;
  }
  if(won) { G.season.wins++; G.coins += 100; G.shards += 15; }
  else { G.season.losses++; G.coins += 30; G.shards += 5; }

  const isBossWin = won && G.opponent.isBoss;
  document.getElementById('go-title').textContent = isBossWin ? '🏆 赛季冠军!!!' : won ? '🎉 胜利!' : '😤 失败...';
  document.getElementById('go-title').style.color = won ? '#f9a825' : '#ef5350';
  document.getElementById('go-score').textContent = `${G.match.playerScore} - ${G.match.oppScore}`;
  document.getElementById('go-score').style.color = '#fff';

  const hist = G.match.history;
  const completions = hist.filter(h=>h.success).length;
  const totalYards = hist.reduce((s,h)=>s+(h.yards||0),0);
  document.getElementById('go-detail').innerHTML =
    `vs ${G.opponent.name}<br>传球: ${completions}/${hist.length} · 总码数: ${totalYards}<br>💰+${won?100:30} · 🏆+${won?15:5}碎片`;

  document.getElementById('go-btn').textContent = isBossWin ? '🏆 完成赛季!' : won ? '下一场' : '继续';
  showPanel('gameover-panel');
  updateHUD();
}

function afterGameOver() {
  hideAllPanels();
  const won = G.seasonGames[G.season.gameIndex]?.won;
  const isBossWin = won && G.opponent.isBoss;

  if(isBossWin) {
    G.season.number++;
    startNewSeason();
    return;
  }

  G.season.gameIndex++;
  if(G.season.losses >= 3 || G.season.gameIndex >= G.seasonGames.length) {
    showSeasonEnd();
    return;
  }
  showShop();
}

// ── Shop ────────────────────────────────────────────────────
function showShop() {
  G.phase = 'shop';
  hideAllPanels();
  document.getElementById('shop-coins').textContent = `💰 ${G.coins} 比赛币`;

  const shopPlays = PLAYS.filter(p => !G.deck.includes(p.id)).sort(()=>Math.random()-0.5).slice(0,3);
  const container = document.getElementById('shop-cards');
  container.innerHTML = '';

  shopPlays.forEach(play => {
    const price = play.type==='long'?200:play.type==='mid'?150:100;
    const canAfford = G.coins >= price;
    const card = document.createElement('div');
    card.className = 'card fade-in';
    card.style.opacity = canAfford ? 1 : 0.4;
    card.innerHTML = `
      <div class="icon">${play.icon}</div>
      <div class="name">${play.name}</div>
      <div class="desc">${play.desc}</div>
      <div class="tags">
        ${play.beats.map(b=>`<span class="tag beat">克${getDef(b)?.name||b}</span>`).join('')}
      </div>
      <div style="color:#f9a825;font-weight:bold;margin-top:6px">💰 ${price}</div>
    `;
    if(canAfford) {
      card.onclick = () => {
        G.coins -= price;
        G.deck.push(play.id);
        G.scoutRates[play.id] = 0;
        showShop(); // Refresh
      };
    }
    container.appendChild(card);
  });

  // Stat boost
  if(G.coins >= 80) {
    const card = document.createElement('div');
    card.className = 'card fade-in';
    card.innerHTML = `<div class="icon">⬆️</div><div class="name">属性提升</div><div class="desc">随机属性+3</div><div style="color:#f9a825;font-weight:bold;margin-top:6px">💰 80</div>`;
    card.onclick = () => {
      G.coins -= 80;
      const stats = ['acc','arm','read','mob'];
      const stat = stats[Math.floor(Math.random()*stats.length)];
      G.qb[stat] = Math.min(99, G.qb[stat]+3);
      showShop();
    };
    container.appendChild(card);
  }

  showPanel('shop-panel');
}

function leaveShop() { hideAllPanels(); showSeasonMap(); }

// ── Season End ──────────────────────────────────────────────
function showSeasonEnd() {
  G.phase = 'season_end';
  hideAllPanels();
  document.getElementById('go-title').textContent = '📊 赛季结束';
  document.getElementById('go-title').style.color = '#fff';
  document.getElementById('go-score').textContent = `${G.season.wins}W - ${G.season.losses}L`;
  document.getElementById('go-detail').innerHTML =
    `Lv.${G.qb.level} QB · 精准${G.qb.acc} 臂力${G.qb.arm} 阅读${G.qb.read} 机动${G.qb.mob}<br>🏆 ${G.shards} 传奇碎片`;
  document.getElementById('go-btn').textContent = '🔄 开始新赛季';
  document.getElementById('go-btn').onclick = () => {
    G.season.number++;
    startNewSeason();
    // Reset onclick
    document.getElementById('go-btn').onclick = afterGameOver;
  };
  showPanel('gameover-panel');
}

function startNewSeason() {
  G.deck = ['slant','out','curl','screen','dig','post','go','mesh'];
  G.season.gameIndex = 0;
  G.season.wins = 0; G.season.losses = 0;
  G.coins = Math.max(200, G.coins);
  generateSeason();
  showSeasonMap();
}

// ── Start Game ──────────────────────────────────────────────
function startGame() {
  document.getElementById('title-screen').style.display = 'none';
  G = newGame();
  startNewSeason();
}

// ── Three.js Animation Loop ────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, clock.getDelta());

  // Simulation update
  if(G.phase === 'simulating' && G.sim.active) {
    updateSimulation(dt);
  }

  // Ambient animations
  // Player idle bobbing
  Object.values(playerMeshes).forEach(pm => {
    if(pm.position) {
      const baseY = 0;
      pm.position.y = baseY + Math.sin(Date.now()*0.003 + pm.position.x) * 0.05;
    }
    // Ribbon flutter
    pm.userData.ribbons?.forEach((r, ri) => {
      if(G.phase !== 'simulating') {
        r.rotation.x = Math.sin(Date.now()*0.004 + ri*2) * 0.1;
      }
    });
  });

  // Camera gentle sway
  if(G.phase !== 'title' && G.phase !== 'season_map' && G.phase !== 'season_end') {
    camera.position.x = Math.sin(Date.now()*0.0005) * 1.5;
  }

  renderer.render(scene, camera);
}

// ── Init ────────────────────────────────────────────────────
G = newGame();
initThree();
animate();
