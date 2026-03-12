// ═══════════════════════════════════════════════════════════
// Pocket Commander v3 — 腰旗橄榄球 (Flag Football)
// Plan-then-Simulate · Three.js 3D · Proper Flag Rules
// ═══════════════════════════════════════════════════════════

// ── Three.js Setup ─────────────────────────────────────────
const cv=document.getElementById('c3d');
let sc,cam,ren,clk,PM={},ball,rushLineMesh,routeMeshes=[];
let SS=1; // sim speed

function initThree(){
  sc=new THREE.Scene();
  sc.background=new THREE.Color(0x071020);
  sc.fog=new THREE.FogExp2(0x071020,0.006);
  cam=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,0.1,600);
  cam.position.set(0,32,42);cam.lookAt(0,0,5);
  ren=new THREE.WebGLRenderer({canvas:cv,antialias:true});
  ren.setSize(innerWidth,innerHeight);ren.setPixelRatio(Math.min(devicePixelRatio,2));
  ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;
  clk=new THREE.Clock();
  // Lights
  sc.add(new THREE.AmbientLight(0x4466aa,0.4));
  const sun=new THREE.DirectionalLight(0xffffff,0.9);
  sun.position.set(15,40,20);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-50;sun.shadow.camera.right=50;
  sun.shadow.camera.top=50;sun.shadow.camera.bottom=-50;
  sc.add(sun);
  // Stadium spots
  [[-28,22,-18,0x4fc3f7],[28,22,-18,0xf9a825],[-28,22,28,0xf9a825],[28,22,28,0x4fc3f7]].forEach(([x,y,z,c])=>{
    const l=new THREE.PointLight(c,0.35,70);l.position.set(x,y,z);sc.add(l);
  });
  buildField();buildPlayers();buildBall();
  addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();ren.setSize(innerWidth,innerHeight)});
}

// ── Field (70yd long × 30yd wide, flag football dimensions) ──
function buildField(){
  const FG=new THREE.Group();
  // Main turf
  const turf=new THREE.Mesh(new THREE.PlaneGeometry(56,82),new THREE.MeshStandardMaterial({color:0x2d6a1e,roughness:0.85}));
  turf.rotation.x=-Math.PI/2;turf.receiveShadow=true;FG.add(turf);
  // Lighter stripes
  for(let i=-35;i<=35;i+=10){
    const s=new THREE.Mesh(new THREE.PlaneGeometry(56,4),new THREE.MeshStandardMaterial({color:0x347a24,roughness:0.85}));
    s.rotation.x=-Math.PI/2;s.position.set(0,0.002,i);FG.add(s);
  }
  // Yard lines every 5 yards
  for(let i=-35;i<=35;i+=5){
    const main=i%10===0;
    const l=new THREE.Mesh(new THREE.PlaneGeometry(main?52:48,main?0.15:0.06),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:main?0.5:0.2}));
    l.rotation.x=-Math.PI/2;l.position.set(0,0.01,i);FG.add(l);
  }
  // End zones
  [[0x1a4a8b,-41],[0x8b1a1a,41]].forEach(([c,z])=>{
    const ez=new THREE.Mesh(new THREE.PlaneGeometry(56,10),new THREE.MeshStandardMaterial({color:c,roughness:0.7,transparent:true,opacity:0.5}));
    ez.rotation.x=-Math.PI/2;ez.position.set(0,0.003,z);FG.add(ez);
  });
  // Sidelines
  [[-28,0],[28,0]].forEach(([x])=>{
    const sl=new THREE.Mesh(new THREE.PlaneGeometry(0.2,82),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.5}));
    sl.rotation.x=-Math.PI/2;sl.position.set(x,0.01,0);FG.add(sl);
  });
  // LOS line (blue)
  const los=new THREE.Mesh(new THREE.PlaneGeometry(52,0.18),new THREE.MeshBasicMaterial({color:0x4fc3f7,transparent:true,opacity:0.6}));
  los.rotation.x=-Math.PI/2;los.position.y=0.02;los.name='los';FG.add(los);
  // First down line (yellow)
  const fd=new THREE.Mesh(new THREE.PlaneGeometry(52,0.18),new THREE.MeshBasicMaterial({color:0xfdd835,transparent:true,opacity:0.6}));
  fd.rotation.x=-Math.PI/2;fd.position.y=0.02;fd.name='fd';FG.add(fd);
  // 7-yard rush line (orange, dashed effect via multiple segments)
  const rg=new THREE.Group();rg.name='rushLine';
  for(let x=-24;x<=24;x+=3){
    const seg=new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.12),new THREE.MeshBasicMaterial({color:0xff8c00,transparent:true,opacity:0.7}));
    seg.rotation.x=-Math.PI/2;seg.position.set(x,0.025,0);rg.add(seg);
  }
  FG.add(rg);rushLineMesh=rg;
  sc.add(FG);
}

function yd2z(yd){return 36-(yd/100)*72;} // 0=own endzone(z=36), 100=opp endzone(z=-36)

// ── Player Models (each unique!) ────────────────────────────
const PLAYER_DEFS={
  qb:{label:'QB',jersey:0x1565c0,skin:0xd4a574,h:1.8,w:0.42,num:'7',hair:0x2c1810,hairStyle:'short'},
  c: {label:'C', jersey:0x1976d2,skin:0x8d5524,h:1.75,w:0.48,num:'52',hair:0x1a1a1a,hairStyle:'buzz'},
  wr1:{label:'WR1',jersey:0x4fc3f7,skin:0xc68642,h:1.82,w:0.38,num:'11',hair:0x2c1810,hairStyle:'long'},
  wr2:{label:'WR2',jersey:0x4fc3f7,skin:0xfce0c4,h:1.7,w:0.36,num:'84',hair:0xd4a017,hairStyle:'medium'},
  wr3:{label:'WR3',jersey:0x29b6f6,skin:0x6b4226,h:1.88,w:0.4,num:'6',hair:0x1a1a1a,hairStyle:'tall'},
  d0:{label:'Rush',jersey:0xe53935,skin:0xd4a574,h:1.85,w:0.5,num:'99',hair:0x1a1a1a,hairStyle:'buzz'},
  d1:{label:'CB1',jersey:0xef5350,skin:0x8d5524,h:1.75,w:0.38,num:'21',hair:0x2c1810,hairStyle:'short'},
  d2:{label:'CB2',jersey:0xef5350,skin:0xfce0c4,h:1.72,w:0.37,num:'24',hair:0xd4a017,hairStyle:'medium'},
  d3:{label:'S1',jersey:0xc62828,skin:0xc68642,h:1.78,w:0.4,num:'32',hair:0x1a1a1a,hairStyle:'long'},
  d4:{label:'S2',jersey:0xc62828,skin:0x6b4226,h:1.8,w:0.42,num:'8',hair:0x2c1810,hairStyle:'tall'},
};

function mkPlayer(def,isOff){
  const g=new THREE.Group();
  const s=def.h/1.8; // scale factor
  // Legs
  [[-0.15,0],[0.15,0]].forEach(([lx])=>{
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.12*s,0.1*s,0.7*s,6),new THREE.MeshStandardMaterial({color:isOff?0x222222:0x333333,roughness:0.7}));
    leg.position.set(lx,0.35*s,0);g.add(leg);
  });
  // Body (jersey)
  const body=new THREE.Mesh(new THREE.CylinderGeometry(def.w*0.9,def.w,1.1*s,8),new THREE.MeshStandardMaterial({color:def.jersey,roughness:0.5,metalness:0.05}));
  body.position.y=1.15*s;body.castShadow=true;g.add(body);
  // Arms
  [[-1,0],[1,0]].forEach(([side])=>{
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.08*s,0.07*s,0.6*s,5),new THREE.MeshStandardMaterial({color:def.skin,roughness:0.7}));
    arm.position.set(side*def.w*1.1,1.2*s,0);arm.rotation.z=side*0.3;g.add(arm);
  });
  // Head
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.26*s,8,8),new THREE.MeshStandardMaterial({color:def.skin,roughness:0.6}));
  head.position.y=1.9*s;head.castShadow=true;g.add(head);
  // Hair
  let hairGeo;
  if(def.hairStyle==='tall') hairGeo=new THREE.BoxGeometry(0.35*s,0.25*s,0.3*s);
  else if(def.hairStyle==='long') hairGeo=new THREE.SphereGeometry(0.28*s,6,6);
  else if(def.hairStyle==='medium') hairGeo=new THREE.SphereGeometry(0.22*s,6,4);
  else hairGeo=new THREE.SphereGeometry(0.27*s,6,6);
  const hair=new THREE.Mesh(hairGeo,new THREE.MeshStandardMaterial({color:def.hair,roughness:0.8}));
  hair.position.y=def.hairStyle==='tall'?2.1*s:2.0*s;
  hair.scale.y=def.hairStyle==='buzz'?0.6:def.hairStyle==='short'?0.7:0.85;
  g.add(hair);
  // Jersey number (small box on chest as visual cue)
  const numBadge=new THREE.Mesh(new THREE.PlaneGeometry(0.3*s,0.2*s),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.8}));
  numBadge.position.set(0,1.3*s,def.w*0.91);g.add(numBadge);
  // 腰旗! Flag ribbons on waist (THE key flag football visual)
  const flagColor=isOff?0xf9a825:0x4fc3f7;
  const ribbons=[];
  [-1,1].forEach(side=>{
    const ribbon=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.65*s),new THREE.MeshStandardMaterial({color:flagColor,side:THREE.DoubleSide,roughness:0.4}));
    ribbon.position.set(side*def.w*0.8,0.65*s,0);ribbon.rotation.z=side*0.15;
    g.add(ribbon);ribbons.push(ribbon);
  });
  g.userData={def,ribbons,isOff,label:def.label};
  // Window indicator (only for offensive receivers)
  if(isOff && def.label!=='QB'){
    const ind=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,8),new THREE.MeshBasicMaterial({color:0x666666}));
    ind.position.y=2.3*s;ind.name='ind';ind.visible=false;g.add(ind);
    // Label ring
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.3,0.38,16),new THREE.MeshBasicMaterial({color:0x4fc3f7,transparent:true,opacity:0.5,side:THREE.DoubleSide}));
    ring.position.y=0.02;ring.rotation.x=-Math.PI/2;ring.name='ring';g.add(ring);
  }
  if(!isOff){
    // Defense stance indicator ring
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.3,0.38,16),new THREE.MeshBasicMaterial({color:0xef5350,transparent:true,opacity:0.4,side:THREE.DoubleSide}));
    ring.position.y=0.02;ring.rotation.x=-Math.PI/2;g.add(ring);
  }
  return g;
}

function buildPlayers(){
  Object.entries(PLAYER_DEFS).forEach(([id,def])=>{
    const isOff=!id.startsWith('d');
    const p=mkPlayer(def,isOff);p.name=id;sc.add(p);PM[id]=p;
  });
}

function buildBall(){
  const g=new THREE.SphereGeometry(0.18,8,6);g.scale(1,0.55,1.4);
  ball=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x8B4513,roughness:0.35}));
  ball.castShadow=true;ball.visible=false;sc.add(ball);
}

// ── Flag Football Play Data ─────────────────────────────────
// Routes: dx/dz relative to start, t=time. 4 receivers: C,WR1,WR2,WR3
// In flag football: Center snaps then runs route, 3 WRs run routes
const PLAYS=[
  {id:'quick_slant',name:'Quick Slant',type:'short',desc:'WR斜切内线，快速出球',
   beats:['cover3','zone_2_3'],weakTo:['man_press'],icon:'↗',color:'#4fc3f7',
   routes:[{who:'C',dx:3,dz:-5,t:0.8},{who:'WR1',dx:-4,dz:-8,t:1.0},{who:'WR2',dx:5,dz:-7,t:1.0},{who:'WR3',dx:-2,dz:-4,t:0.7}],
   tip:'Slant路线斜切进内线，利用Zone防守区域间的缝隙。注意：被紧贴盯人(Press)时容易在起步被干扰。',
   teach:'腰旗中最常用的快速出球路线之一。7秒读秒压力下，1-2秒就能出球。'},
  {id:'out_route',name:'Out Route',type:'short',desc:'外接手外切向边线',
   beats:['man_off'],weakTo:['cover2'],icon:'→',color:'#81c784',
   routes:[{who:'C',dx:2,dz:-6,t:0.9},{who:'WR1',dx:12,dz:-7,t:1.1},{who:'WR2',dx:-10,dz:-8,t:1.2},{who:'WR3',dx:6,dz:-3,t:0.6}],
   tip:'Out Route向边线外切，在盯人防守中制造分离。但Cover 2的角卫正好守住边线区域。',
   teach:'外切路线是腰旗基础路线。关键是变向的速度——假装往内侧跑再突然外切。'},
  {id:'curl',name:'Curl/Comeback',type:'short',desc:'跑出后急停回转接球',
   beats:[],weakTo:[],icon:'↩',color:'#aed581',
   routes:[{who:'C',dx:-3,dz:-4,t:0.7},{who:'WR1',dx:3,dz:-10,t:1.3},{who:'WR2',dx:-2,dz:-9,t:1.2},{who:'WR3',dx:5,dz:-5,t:0.8}],
   tip:'Curl是安全的保底选择。跑出7-8码后急停回转面对QB接球。任何防守下都有一定效果。',
   teach:'最稳定的路线。在腰旗7秒读秒中，Curl通常是Check-down（安全阀）选项。'},
  {id:'screen',name:'Screen Pass',type:'short',desc:'快速短传给前方接应',
   beats:['blitz_2','blitz_1'],weakTo:['zone_2_3'],icon:'⟵',color:'#fff176',
   routes:[{who:'C',dx:-1,dz:2,t:0.4},{who:'WR1',dx:-3,dz:1,t:0.5},{who:'WR2',dx:8,dz:-5,t:0.8},{who:'WR3',dx:-6,dz:-3,t:0.6}],
   tip:'Screen Pass是对付冲传的利器！冲传手全速冲向QB，传球到他身后的空间。',
   teach:'腰旗中冲传手冲过来后身后会留下大片空间。Screen就是利用这个空间。'},
  {id:'post',name:'Post',type:'mid',desc:'斜切向球场中央深处',
   beats:['cover2','man_off'],weakTo:['cover3'],icon:'↖',color:'#9575cd',
   routes:[{who:'C',dx:2,dz:-5,t:0.8},{who:'WR1',dx:3,dz:-18,t:1.8},{who:'WR2',dx:-2,dz:-15,t:1.7},{who:'WR3',dx:6,dz:-6,t:0.9}],
   tip:'Post路线切入Cover 2两个安全卫之间的空隙。但Cover 3的中间Safety正好在那。',
   teach:'中深路线，需要QB有足够的臂力和时间（4-5秒）。冲传压力大时风险高。'},
  {id:'corner',name:'Corner',type:'mid',desc:'外切向球场角落深区',
   beats:['cover3'],weakTo:['cover2'],icon:'↗',color:'#4dd0e1',
   routes:[{who:'C',dx:-2,dz:-4,t:0.7},{who:'WR1',dx:14,dz:-16,t:1.8},{who:'WR2',dx:-12,dz:-14,t:1.7},{who:'WR3',dx:4,dz:-7,t:0.9}],
   tip:'Corner路线攻击Cover 3角卫和安全卫之间的空隙。Cover 2角卫正好盯住这个区域。',
   teach:'与Post相反方向——Post攻中间，Corner攻角落。搭配使用让防守左右为难。'},
  {id:'go_fly',name:'Go/Fly',type:'long',desc:'全速直线冲刺深区',
   beats:['man_off'],weakTo:['cover2','cover3'],icon:'↑',color:'#ef5350',
   routes:[{who:'C',dx:1,dz:-6,t:0.8},{who:'WR1',dx:4,dz:-25,t:2.2},{who:'WR2',dx:-3,dz:-22,t:2.0},{who:'WR3',dx:7,dz:-8,t:1.0}],
   tip:'Go Route赌的是速度——你的WR能不能跑过防守人。需要QB强臂力和至少5秒时间。',
   teach:'高风险高回报。在7秒读秒中，Go Route需要5-6秒才能跑到位，留给QB的窗口很小。'},
  {id:'flood',name:'Flood三层涌',type:'mid',desc:'同侧三层路线淹没区域防守',
   beats:['cover3','zone_2_3'],weakTo:['man_press'],icon:'🌊',color:'#26c6da',
   routes:[{who:'C',dx:6,dz:-3,t:0.6},{who:'WR1',dx:12,dz:-8,t:1.1},{who:'WR2',dx:14,dz:-16,t:1.6},{who:'WR3',dx:-4,dz:-5,t:0.8}],
   tip:'Flood在同一侧安排短/中/深三层路线，让该区域的Zone防守人顾此失彼。',
   teach:'腰旗高级战术。三人涌向同侧，防守只有2人覆盖→总有一人空出来。'},
  {id:'mesh',name:'Mesh交叉',type:'short',desc:'两人交叉跑位制造混乱',
   beats:['man_off','man_press'],weakTo:['zone_2_3'],icon:'✕',color:'#ce93d8',
   routes:[{who:'C',dx:0,dz:-6,t:0.8},{who:'WR1',dx:10,dz:-7,t:1.0},{who:'WR2',dx:-10,dz:-7,t:1.0},{who:'WR3',dx:2,dz:-14,t:1.4}],
   tip:'Mesh让两个WR交叉跑过彼此，盯人防守的人会撞在一起（自然Pick）。Zone不受影响。',
   teach:'腰旗核心概念：交叉跑位。两人交叉路径让盯人防守难以跟踪。'},
  {id:'play_action',name:'Play Action假跑',type:'mid',desc:'假装递球跑动，吸引防守后传深',
   beats:['blitz_1','blitz_2'],weakTo:['cover2'],icon:'🎭',color:'#ff8a65',
   routes:[{who:'C',dx:-2,dz:3,t:0.5},{who:'WR1',dx:5,dz:-16,t:1.8},{who:'WR2',dx:-8,dz:-14,t:1.7},{who:'WR3',dx:3,dz:-5,t:0.7}],
   tip:'Play Action假装跑动骗冲传手上当。冲传手犹豫一秒=你多一秒传球时间。',
   teach:'假跑最克制Blitz！冲传手看到跑动会犹豫，给QB额外1-2秒窗口。'},
  {id:'drag_cross',name:'Drag横穿',type:'short',desc:'接球手横穿整个场地',
   beats:['zone_2_3'],weakTo:['man_press'],icon:'↔',color:'#78909c',
   routes:[{who:'C',dx:-5,dz:-3,t:0.6},{who:'WR1',dx:15,dz:-5,t:1.1},{who:'WR2',dx:-12,dz:-4,t:1.0},{who:'WR3',dx:3,dz:-12,t:1.3}],
   tip:'Drag路线横穿球场，穿过Zone防守的各个区域间隙。盯人防守人紧跟不会有空档。',
   teach:'简单但有效的路线。横穿整个场地，总能找到Zone防守交接时的短暂空档。'},
  {id:'trips_overload',name:'Trips Overload',type:'mid',desc:'三人叠在同侧压迫',
   beats:['cover2','zone_2_3'],weakTo:['man_press'],icon:'⚡',color:'#ab47bc',
   routes:[{who:'C',dx:3,dz:-8,t:0.9},{who:'WR1',dx:8,dz:-5,t:0.8},{who:'WR2',dx:10,dz:-12,t:1.3},{who:'WR3',dx:12,dz:-18,t:1.7}],
   tip:'Trips阵型三人排一侧，制造人数优势。Cover 2一侧只有1个角卫+1个安全卫对3人。',
   teach:'腰旗最流行的阵型之一。单侧3人vs防守2人=必然有人空出。'},
];

// ── 腰旗防守 (5v5: 1-2 rushers + 3-4 DBs) ──────────────────
const DEFENSES=[
  {id:'man_off',name:'盯人(松)',desc:'每人盯一个，保持3码距离',icon:'👤',color:'#ef5350',rush:1,
   pos:[{dx:0,dz:-7,role:'rush'},{dx:8,dz:-4,role:'cb'},{dx:-8,dz:-4,role:'cb'},{dx:5,dz:-10,role:'s'},{dx:-5,dz:-12,role:'s'}],
   explain:'松盯人：防守人离接球手3码站位。优势：不怕被假动作晃开。劣势：接球手起步就有空间。'},
  {id:'man_press',name:'盯人(紧)',desc:'每人紧贴盯防，干扰起步',icon:'👥',color:'#d32f2f',rush:1,
   pos:[{dx:0,dz:-7,role:'rush'},{dx:8,dz:-2,role:'cb'},{dx:-8,dz:-2,role:'cb'},{dx:4,dz:-3,role:'s'},{dx:-4,dz:-10,role:'s'}],
   explain:'紧贴盯人：防守人紧贴接球手站位。优势：干扰接球手起步路线。劣势：一旦被晃开就是大空档。'},
  {id:'cover2',name:'Cover 2',desc:'2人守深区，3人守短区',icon:'2️⃣',color:'#42a5f5',rush:1,
   pos:[{dx:0,dz:-7,role:'rush'},{dx:10,dz:-3,role:'cb'},{dx:-10,dz:-3,role:'cb'},{dx:8,dz:-16,role:'s'},{dx:-8,dz:-16,role:'s'}],
   explain:'Cover 2：两个安全卫各守半边深区。角卫守边线短区。弱点=正中间深区没人管(Post路线克制)。'},
  {id:'cover3',name:'Cover 3',desc:'3人守深区，2人守短区',icon:'3️⃣',color:'#66bb6a',rush:1,
   pos:[{dx:0,dz:-7,role:'rush'},{dx:6,dz:-3,role:'cb'},{dx:-6,dz:-3,role:'cb'},{dx:10,dz:-14,role:'s'},{dx:-10,dz:-14,role:'s'}],
   explain:'Cover 3：三人各守1/3深区（包含一个角卫回撤）。弱点=角落区域(Corner路线克制)。'},
  {id:'zone_2_3',name:'Zone 2-3',desc:'2人盯短区，3人盯深区',icon:'🛡️',color:'#7e57c2',rush:1,
   pos:[{dx:0,dz:-7,role:'rush'},{dx:8,dz:-4,role:'cb'},{dx:-8,dz:-4,role:'cb'},{dx:0,dz:-16,role:'s'},{dx:10,dz:-12,role:'s'}],
   explain:'Zone 2-3：区域联防，每人负责一块区域而非盯人。弱点=区域交接处有空档(Slant/Drag克制)。'},
  {id:'blitz_1',name:'单人冲传',desc:'1个冲传手从7码线冲向QB',icon:'⚡',color:'#ffa726',rush:1,
   pos:[{dx:0,dz:-7,role:'rush'},{dx:8,dz:-3,role:'cb'},{dx:-8,dz:-3,role:'cb'},{dx:4,dz:-12,role:'s'},{dx:-4,dz:-12,role:'s'}],
   explain:'标准单人冲传：1人从7码线直冲QB。QB有约3-4秒传球时间。留4人覆盖接球手。'},
  {id:'blitz_2',name:'双人冲传',desc:'2个冲传手同时冲向QB！',icon:'⚡⚡',color:'#ff7043',rush:2,
   pos:[{dx:3,dz:-7,role:'rush'},{dx:-3,dz:-7,role:'rush'},{dx:10,dz:-3,role:'cb'},{dx:-10,dz:-3,role:'cb'},{dx:0,dz:-14,role:'s'}],
   explain:'双人冲传：2人同时从7码线冲QB！QB只有2-3秒！但只有3人覆盖4个接球手→必有人空出。'},
];

// ── Game State ──────────────────────────────────────────────
let G={};
function newG(){return{
  ph:'title',qb:{acc:40,arm:35,read:30,mob:30,lv:1,xp:0},
  sn:{n:1,gi:0,w:0,l:0},
  mt:{ps:0,os:0,q:1,bp:25,dn:1,ytg:20,pos:'p',mom:0,hist:[],def:null},
  dk:['quick_slant','out_route','curl','screen','post','mesh','go_fly','flood'],
  hand:[],coins:200,shards:0,sr:{},sp:null,ro:[0,1,2,3],sd:null,
  opp:{name:'',diff:1,style:'balanced',isBoss:false},sg:[],
  sim:{on:false,step:0,steps:[],t:0,res:null,yds:0,tgt:-1,beat:false,weak:false,def:'',cov:[]},
};}
function gP(id){return PLAYS.find(p=>p.id===id);}
function gD(id){return DEFENSES.find(d=>d.id===id);}

// ── UI Helpers ──────────────────────────────────────────────
const $=id=>document.getElementById(id);
function showP(id){$(id).classList.add('on');}
function hideP(id){$(id).classList.remove('on');}
function hideAll(){['pp','dp','rp','sp','mp','gp'].forEach(hideP);$('slog').style.display='none';$('spd').style.display='none';}
function updHUD(){
  const h=$('hud');
  if(G.ph==='title'||G.ph==='season_map'||G.ph==='season_end'){h.style.display='none';return;}
  h.style.display='flex';
  h.querySelector('.y').textContent=`YOU ${G.mt.ps}`;
  h.querySelector('.o').textContent=`${G.mt.os} ${G.opp.name}`;
  const dn=['','1st','2nd','3rd','4th'];
  h.querySelector('.hd').textContent=`${dn[G.mt.dn]||G.mt.dn+'th'} & ${G.mt.ytg}`;
  h.querySelector('.hi').textContent=`Q${Math.ceil(G.mt.q)} · ${G.mt.bp}码线`;
}
function slog(t,c,d){const e=$('slog');e.innerHTML=t+(d?`<div class="detail">${d}</div>`:'');e.style.color=c||'#fff';e.style.display='block';}

// ── Season ──────────────────────────────────────────────────
function genSeason(){
  const nm=['Street Dogs','Thunder','Vipers','Blaze','Storm','Wolves','Shadow','Titans','Phantoms','Hawks'];
  const st=['aggressive','balanced','defensive','tricky'];
  G.sg=[];
  for(let i=0;i<5;i++) G.sg.push({name:nm[~~(Math.random()*nm.length)],diff:1+i*0.5+Math.random()*0.3,style:st[~~(Math.random()*st.length)],done:false,won:false});
  G.sg.push({name:'🏛️ 铁壁教练 Rick',diff:3.5,style:'boss',done:false,won:false,isBoss:true});
}

function showMap(){
  G.ph='season_map';hideAll();updHUD();
  let h=`<h2>🏈 赛季 ${G.sn.n}</h2>`;
  h+=`<div style="text-align:center;font-size:12px;color:#888;margin-bottom:10px">`;
  h+=`Lv.${G.qb.lv} QB · 精准${G.qb.acc} 臂力${G.qb.arm} 阅读${G.qb.read} 机动${G.qb.mob} · 💰${G.coins}</div>`;
  h+=`<div style="text-align:center;font-size:13px;color:#aaa;margin-bottom:12px">战绩 ${G.sn.w}W-${G.sn.l}L</div>`;
  G.sg.forEach((g,i)=>{
    const cur=i===G.sn.gi,lk=i>G.sn.gi;
    const bc=g.done?(g.won?'rgba(67,160,71,.15)':'rgba(198,40,40,.15)'):(cur?'rgba(249,168,37,.1)':'rgba(0,0,0,.2)');
    const brc=g.done?(g.won?'#43a047':'#c62828'):(cur?'#f9a825':'#333');
    h+=`<div style="padding:12px;margin:5px 0;border-radius:10px;text-align:center;font-weight:bold;border:2px solid ${brc};background:${bc};opacity:${lk?0.35:1};cursor:${cur&&!g.done?'pointer':'default'}" `;
    if(cur&&!g.done) h+=`onclick="startMatch(${i})"`;
    h+=`>${g.isBoss?'🏛️ BOSS: ':'第'+(i+1)+'场: '}${g.name} ${g.done?(g.won?'✅':'❌'):(cur?'▶ 进入':'🔒')}</div>`;
  });
  $('mp').innerHTML=h;showP('mp');
}

// ── Start Match ─────────────────────────────────────────────
function startMatch(idx){
  const g=G.sg[idx];G.opp={name:g.name,diff:g.diff,style:g.style,isBoss:g.isBoss||false};
  G.mt={ps:0,os:0,q:1,bp:25,dn:1,ytg:20,pos:'p',mom:0,hist:[],def:null};
  // Flag football: 4 downs to reach midfield, then 4 downs to score
  G.sr={};G.dk.forEach(id=>G.sr[id]=0);
  hideAll();posLine(G.mt.bp);setCam(G.mt.bp);showPS();
}

// ── 3D Position ─────────────────────────────────────────────
function posLine(yd){
  const z=yd2z(yd);
  PM.qb.position.set(0,0,z+5);
  PM.c.position.set(0,0,z+2);
  PM.wr1.position.set(10,0,z+2);PM.wr2.position.set(-10,0,z+2);PM.wr3.position.set(6,0,z+3.5);
  // Defense default
  [['d0',0,z-7],['d1',8,z-3],['d2',-8,z-3],['d3',5,z-12],['d4',-5,z-12]].forEach(([id,x,dz])=>PM[id].position.set(x,0,dz));
  // Indicators off
  ['c','wr1','wr2','wr3'].forEach(id=>{const ind=PM[id].getObjectByName('ind');if(ind)ind.visible=false;});
  // Update lines
  const los=sc.getObjectByName('los');if(los)los.position.z=z;
  const fd=sc.getObjectByName('fd');if(fd)fd.position.z=yd2z(Math.min(100,yd+G.mt.ytg));
  // Rush line at 7 yards behind LOS
  if(rushLineMesh) rushLineMesh.position.z=z-7*(72/100);
  ball.visible=false;
}

function posDef(defId,yd){
  const d=gD(defId);if(!d)return;const z=yd2z(yd);
  d.pos.forEach((p,i)=>{if(PM['d'+i])PM['d'+i].position.set(p.dx,0,z+p.dz);});
}

function setCam(yd){const z=yd2z(yd);cam.position.set(0,30,z+38);cam.lookAt(0,0,z-5);}

// ── Route Visualization ─────────────────────────────────────
function clearRoutes(){routeMeshes.forEach(m=>sc.remove(m));routeMeshes=[];}

function showRoutes(play,yd){
  clearRoutes();
  const z=yd2z(yd);
  const starts={C:{x:0,z:z+2},WR1:{x:10,z:z+2},WR2:{x:-10,z:z+2},WR3:{x:6,z:z+3.5}};
  const colors={C:0x2196f3,WR1:0x4fc3f7,WR2:0x81c784,WR3:0x29b6f6};

  play.routes.forEach((r,i)=>{
    const s=starts[r.who];if(!s)return;
    const ex=s.x+r.dx,ez=s.z+r.dz;

    // Thick glowing tube for route
    const pts=[new THREE.Vector3(s.x,0.15,s.z)];
    // Add midpoint for curve
    const mx=(s.x+ex)/2,mz=(s.z+ez)/2;
    pts.push(new THREE.Vector3(mx,0.15,mz));
    pts.push(new THREE.Vector3(ex,0.15,ez));
    const curve=new THREE.CatmullRomCurve3(pts);
    const tubeGeo=new THREE.TubeGeometry(curve,16,0.15,6,false);
    const tubeMat=new THREE.MeshBasicMaterial({color:colors[r.who]||0x4fc3f7,transparent:true,opacity:0.7});
    const tube=new THREE.Mesh(tubeGeo,tubeMat);
    sc.add(tube);routeMeshes.push(tube);

    // Outer glow tube
    const glowGeo=new THREE.TubeGeometry(curve,16,0.3,6,false);
    const glowMat=new THREE.MeshBasicMaterial({color:colors[r.who]||0x4fc3f7,transparent:true,opacity:0.15});
    const glow=new THREE.Mesh(glowGeo,glowMat);
    sc.add(glow);routeMeshes.push(glow);

    // Arrowhead at end
    const dx2=ex-mx,dz2=ez-mz,len=Math.sqrt(dx2*dx2+dz2*dz2);
    const nx=dx2/len,nz=dz2/len;
    const ah=0.8;
    const arrowPts=[
      new THREE.Vector3(ex-nx*ah+nz*0.5,0.2,ez-nz*ah-nx*0.5),
      new THREE.Vector3(ex,0.2,ez),
      new THREE.Vector3(ex-nx*ah-nz*0.5,0.2,ez-nz*ah+nx*0.5),
    ];
    const arrowGeo=new THREE.BufferGeometry().setFromPoints(arrowPts);
    const arrowMat=new THREE.LineBasicMaterial({color:colors[r.who]||0x4fc3f7,linewidth:2});
    const arrow=new THREE.Line(arrowGeo,arrowMat);sc.add(arrow);routeMeshes.push(arrow);

    // Label disc at endpoint
    const discGeo=new THREE.CircleGeometry(0.6,12);
    const discMat=new THREE.MeshBasicMaterial({color:colors[r.who]||0x4fc3f7,transparent:true,opacity:0.5,side:THREE.DoubleSide});
    const disc=new THREE.Mesh(discGeo,discMat);
    disc.rotation.x=-Math.PI/2;disc.position.set(ex,0.05,ez);
    sc.add(disc);routeMeshes.push(disc);
  });
}

// ── Play Selection UI ───────────────────────────────────────
function dealHand(){
  const av=[...G.dk];G.hand=[];
  for(let i=0;i<Math.min(4,av.length);i++){const j=~~(Math.random()*av.length);G.hand.push(av[j]);av.splice(j,1);}
}

function showPS(){
  G.ph='play_select';G.sp=null;G.ro=[0,1,2,3];dealHand();hideAll();updHUD();
  // AI picks defense
  G.mt.def=pickDef();posDef(G.mt.def,G.mt.bp);
  const def=gD(G.mt.def);
  const readPct=0.3+(G.qb.read/100)*0.6;
  const hint=Math.random()<readPct?`🔍 侦察: 对方在用 ${def.icon} ${def.name}`:'🔍 侦察: 无法确定防守阵型';

  // Number of rushers
  const rushInfo=def.rush===2?'⚡⚡ 对方派出2个冲传手！你只有约2-3秒传球时间！':'⚡ 对方1个冲传手从7码线冲传，你有约3-4秒时间';

  let h=`<h2>📋 选择进攻战术</h2>`;
  h+=`<div style="text-align:center;font-size:14px;color:#fdd835;font-weight:bold;margin-bottom:4px">${['','1st','2nd','3rd','4th'][G.mt.dn]} & ${G.mt.ytg} · 球在${G.mt.bp}码线</div>`;
  h+=`<div style="text-align:center;font-size:12px;color:#888;margin-bottom:6px">${hint}</div>`;
  h+=`<div class="rush-info">${rushInfo}</div>`;
  // No-run zone warning
  if(G.mt.bp>=95||Math.abs(G.mt.bp-50)<5) h+=`<div class="rush-info" style="background:rgba(239,83,80,.1);border-color:rgba(239,83,80,.3);color:#ef5350">⚠️ 禁跑区！此位置不允许跑动进攻</div>`;

  h+=`<div class="cg" id="pcs">`;
  G.hand.forEach((pid,i)=>{
    const p=gP(pid);if(!p)return;
    const sc=G.sr[pid]||0;
    const scC=sc<20?'sc':sc<40?'sh':sc>=60?'sb':'sh';
    const scL=sc<20?'冷门':sc<40?'正常':sc>=60?'暴露':'警戒';
    h+=`<div class="cd fi" style="animation-delay:${i*0.04}s" onclick="selPlay(${i})">`;
    h+=`<div class="ic">${p.icon}</div><div class="nm">${p.name}</div><div class="ds">${p.desc}</div>`;
    h+=`<div style="margin-top:4px">${p.beats.map(b=>`<span class="tg bt">克${gD(b)?.name||b}</span>`).join('')}${p.weakTo.map(b=>`<span class="tg wk">弱${gD(b)?.name||b}</span>`).join('')}</div>`;
    h+=`<div style="margin-top:3px"><span class="tg ${scC}">侦察:${scL}</span></div>`;
    h+=`<div style="font-size:10px;color:#666;margin-top:4px;text-align:left">${p.tip}</div>`;
    h+=`</div>`;
  });
  h+=`</div>`;
  h+=`<div class="ss" id="ros" style="display:none"><h3>📖 设置阅读顺序（QB按此顺序查看接球手）</h3><div class="ro" id="robox"></div><p style="font-size:10px;color:#555;margin-top:3px">点击可调换顺序。QB会传给第一个出现空档的接球手。${def.rush>=2?'⚠️ 双冲传！QB可能来不及看完所有接球手！':''}</p></div>`;
  h+=`<button class="btn btn-p btn-b" id="snapb" style="display:none" onclick="doSnap()">📣 确认战术 · 开球！</button>`;
  $('pp').innerHTML=h;showP('pp');
}

function selPlay(i){
  G.sp=G.hand[i];
  document.querySelectorAll('#pcs .cd').forEach((c,j)=>{c.classList.toggle('sel',j===i);});
  const play=gP(G.sp);
  // Show route preview
  showRoutes(play,G.mt.bp);
  // Setup read order based on routes
  G.ro=play.routes.map((_,idx)=>idx);
  $('ros').style.display='block';
  renderRO(play);
  $('snapb').style.display='block';
}

function renderRO(play){
  let h='';
  G.ro.forEach((ri,i)=>{
    if(i>0) h+=`<span class="ra">→</span>`;
    const r=play.routes[ri];
    h+=`<div class="rs fl" onclick="cycleRO(${ri})" title="点击移到后面">${r?.who||'?'}</div>`;
  });
  $('robox').innerHTML=h;
}

function cycleRO(ri){
  const idx=G.ro.indexOf(ri);
  if(idx<G.ro.length-1){[G.ro[idx],G.ro[idx+1]]=[G.ro[idx+1],G.ro[idx]];}
  else{G.ro.splice(idx,1);G.ro.unshift(ri);}
  renderRO(gP(G.sp));
}

function pickDef(){
  const h=G.mt.hist;
  if(G.opp.isBoss){const c=['man_off','cover2','cover3','blitz_2'];return c[~~(h.length/3)%c.length];}
  let w={man_off:1,man_press:0.6,cover2:1,cover3:1,zone_2_3:0.8,blitz_1:0.7,blitz_2:0.3};
  if(G.opp.style==='aggressive'){w.blitz_2+=1.2;w.man_press+=0.8;}
  if(G.opp.style==='defensive'){w.cover2+=1;w.cover3+=1;w.zone_2_3+=0.8;}
  if(G.opp.style==='tricky'){w.man_press+=0.5;w.zone_2_3+=0.7;w.blitz_2+=0.5;}
  if(h.length>=2){
    const rt=h.slice(-2).map(x=>gP(x.pid)?.type);
    if(rt.filter(t=>t==='long').length>=1){w.cover2+=1;w.cover3+=0.8;}
    if(rt.filter(t=>t==='short').length>=2){w.blitz_2+=0.8;w.man_press+=0.6;}
  }
  const tot=Object.values(w).reduce((a,b)=>a+b,0);
  let r=Math.random()*tot;
  for(const[k,v]of Object.entries(w)){r-=v;if(r<=0)return k;}
  return'cover2';
}

// ── Simulation Engine ───────────────────────────────────────
function doSnap(){
  if(!G.sp)return;hideAll();
  const play=gP(G.sp),def=G.mt.def,dd=gD(def);
  const isBeat=play.beats.includes(def),isWeak=play.weakTo.includes(def);

  // Scout rate update
  const tp=G.mt.hist.length+1;
  G.dk.forEach(id=>{const u=G.mt.hist.filter(x=>x.pid===id).length+(id===G.sp?1:0);G.sr[id]=Math.round(u/tp*100);});

  // Rush time: how many reads QB can make
  const rushers=dd.rush||1;
  const rushTime=rushers>=2?2.5:4.0;
  const maxReads=rushers>=2?Math.min(3,G.ro.length):G.ro.length;

  // Calculate each receiver's coverage outcome with detailed explanation
  const cov=play.routes.map((route,i)=>{
    let openPct=0.5;
    if(isBeat) openPct+=0.28;
    if(isWeak) openPct-=0.22;
    openPct+=(G.qb.read/100)*0.15;
    const sc=G.sr[G.sp]||0;
    if(sc>60)openPct-=0.18;else if(sc>40)openPct-=0.08;else if(sc<20)openPct+=0.1;
    openPct-=G.opp.diff*0.05;
    // Route time factor: longer routes harder to get open but if open = bigger play
    if(route.t>1.5) openPct-=0.08; // long routes slightly harder
    openPct=Math.max(0.08,Math.min(0.92,openPct));
    const isOpen=Math.random()<openPct;

    // Yards calculation
    let yds=Math.abs(route.dz)*0.7+~~(Math.random()*4);
    if(play.type==='short')yds=Math.min(yds,10);
    if(play.type==='long')yds=Math.max(yds,14);
    yds=Math.round(yds);

    // Catch probability
    const catchPct=isOpen?(0.6+G.qb.acc/100*0.35):(0.12+G.qb.acc/100*0.08);

    // Build detailed coverage explanation
    let reason='';
    if(isOpen){
      if(isBeat) reason=`${route.who} 跑的${play.name}路线正好克制${dd.name}！防守人来不及覆盖这个区域。`;
      else if(dd.id.startsWith('man')&&route.t<1.0) reason=`${route.who} 快速出手，盯人防守还没反应过来就已经有了空档。`;
      else if(dd.id.includes('zone')&&Math.abs(route.dx)>8) reason=`${route.who} 跑到了Zone防守两个区域的交接处，形成了短暂空档。`;
      else reason=`${route.who} 通过路线跑位成功甩开了防守人，出现空档。`;
    }else{
      if(isWeak) reason=`${route.who} 的路线正好被${dd.name}克制。${dd.id==='cover2'?'角卫正好在边线短区等着。':dd.id.includes('man')?'防守人紧紧跟住了每一步。':'防守覆盖了路线终点。'}`;
      else if(dd.id.startsWith('man')) reason=`${route.who} 被防守人一对一紧盯，没能制造足够的分离空间。`;
      else if(rushers>=2&&route.t>1.5) reason=`${route.who} 路线需要${route.t.toFixed(1)}秒才能跑到位，但双冲传只给了QB${rushTime}秒！来不及了。`;
      else reason=`${route.who} 的路线终点正好在防守人的覆盖范围内。`;
    }

    return{i,who:route.who,isOpen,catchPct,yds,route,reason,openPct};
  });

  // QB reads in order → throws to first open
  let tgt=-1,res='incomplete',yds=0;
  const readSteps=[];

  for(let ri=0;ri<maxReads;ri++){
    const idx=G.ro[ri];if(idx>=cov.length)continue;
    const c=cov[idx];
    readSteps.push({ri:idx,who:c.who,isOpen:c.isOpen,reason:c.reason});
    if(c.isOpen){
      tgt=idx;
      if(Math.random()<c.catchPct){res='complete';yds=c.yds;if(G.mt.bp+yds>=100){yds=100-G.mt.bp;res='touchdown';}}
      else res='drop';
      break;
    }
  }

  // No one open
  if(tgt===-1){
    if(rushers>=2&&G.qb.mob>40&&Math.random()<0.35){
      res='scramble';yds=~~(G.qb.mob/12)+~~(Math.random()*4);
      // No-run zone check
      if(G.mt.bp>=95||Math.abs(G.mt.bp-50)<5){res='flag_pull';yds=0;}
      else if(G.mt.bp+yds>=100){yds=100-G.mt.bp;res='scramble_td';}
    }else{
      // Forced throw to last read
      const last=G.ro[G.ro.length-1];
      if(last<cov.length){
        tgt=last;
        if(Math.random()<cov[last].catchPct*0.6){res='complete';yds=Math.max(1,~~(cov[last].yds*0.5));}
        else if(Math.random()<0.25){res='interception';yds=0;}
        else res='incomplete';
      }
    }
  }

  // Build sim timeline
  const steps=[];const z=yd2z(G.mt.bp);
  const starts={C:{x:0,z:z+2},WR1:{x:10,z:z+2},WR2:{x:-10,z:z+2},WR3:{x:6,z:z+3.5}};
  const wrMap={C:'c',WR1:'wr1',WR2:'wr2',WR3:'wr3'};

  // Snap
  steps.push({type:'snap',dur:0.5,txt:'📣 开球！Center将球传给QB',dtl:'腰旗橄榄球：Center开球后也可以跑路线接球'});

  // Rush animation
  steps.push({type:'rush',dur:0.6,txt:`${dd.icon} 冲传手从7码线冲向QB！`,dtl:`${dd.name}：${dd.explain}`,rushers});

  // Each read
  readSteps.forEach((rs,idx)=>{
    const route=play.routes[rs.ri];
    const s=starts[rs.who],wmid=wrMap[rs.who];
    steps.push({
      type:'route',dur:Math.max(0.8,route.t*0.7),
      ri:rs.ri,who:rs.who,wm:wmid,
      sx:s.x,sz:s.z,ex:s.x+route.dx,ez:s.z+route.dz,
      isOpen:rs.isOpen,
      txt:`阅读 #${idx+1}：${rs.who} ${rs.isOpen?'🟢 空档!':'🔴 被覆盖'}`,
      dtl:rs.reason,
    });
  });

  // Throw/scramble
  if(res==='scramble'||res==='scramble_td'){
    steps.push({type:'scramble',dur:1.2,yds,txt:`🏃 QB持球跑动！+${yds}码`,dtl:'所有防守人都可以追过来拔旗！',td:res==='scramble_td'});
    steps.push({type:'flagpull',dur:0.6,txt:'🏴 防守拔下了QB的腰旗!',dtl:'进攻结束。拔旗=腰旗橄榄球中的"擒抱"'});
  }else if(res==='flag_pull'){
    steps.push({type:'flag_pull_qb',dur:0.8,txt:'🏴 QB在禁跑区试图跑动——被拔旗!',dtl:'⚠️ 禁跑区不允许跑动进攻，此档损失'});
  }else if(tgt>=0){
    const who=cov[tgt].who,wm=wrMap[who];
    steps.push({type:'throw',dur:0.7,tgt,who,wm,txt:`🏈 QB传球给 ${who}!`,dtl:`QB${G.qb.arm>60?'强力':''}传球飞向${who}的位置`});
    if(res==='complete'||res==='touchdown'){
      steps.push({type:'catch',dur:0.5,tgt,who,wm,yds,txt:res==='touchdown'?`🎉 TOUCHDOWN!! +${yds}码 达阵!!!`:`✅ ${who}接球成功! +${yds}码`,dtl:res==='touchdown'?'冲入端区得分！腰旗橄榄球达阵=6分':'接球后继续向前推进',td:res==='touchdown'});
      if(res==='complete') steps.push({type:'flagpull',dur:0.6,who,wm,txt:`🏴 防守拔下${who}的腰旗!`,dtl:'接球手被拔旗，进攻结束于此处'});
    }else if(res==='interception'){
      steps.push({type:'int',dur:0.8,txt:'❌ 被抄截!!! 防守球员截住了球!',dtl:'强行传给被盯住的接球手——防守人提前阅读到了路线'});
    }else if(res==='drop'){
      steps.push({type:'drop',dur:0.5,txt:`⚠️ ${who}没能接住球!`,dtl:'球到了但接球手没能牢牢抓住——传球未完成'});
    }else{
      steps.push({type:'inc',dur:0.5,txt:'⚠️ 传球未完成',dtl:'球飞向了被覆盖的区域——无人能接住'});
    }
  }

  G.sim={on:true,step:0,steps,t:0,res,yds,tgt,beat:isBeat,weak:isWeak,def,cov};
  G.ph='sim';$('spd').style.display='block';updHUD();
}

// ── Sim Update (3D animation) ───────────────────────────────
function updSim(dt){
  if(!G.sim.on||G.sim.step>=G.sim.steps.length){finSim();return;}
  const s=G.sim.steps[G.sim.step];
  G.sim.t+=dt*SS;
  const p=Math.min(1,G.sim.t/s.dur);
  slog(s.txt,s.td?'#f9a825':s.type==='int'?'#ef5350':'#fff',s.dtl);

  const ease=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;

  switch(s.type){
    case'snap':
      ball.visible=true;
      const qbZ=PM.qb.position.z;
      ball.position.set(0,1+Math.sin(p*Math.PI)*1,qbZ+2-p*3);
      if(p>0.5){ball.position.copy(PM.qb.position);ball.position.y=1.5;}
      break;
    case'rush':
      // Move rushers toward QB
      for(let i=0;i<(s.rushers||1);i++){
        const d=PM['d'+i];if(!d)continue;
        d.position.z+=(PM.qb.position.z-d.position.z)*dt*SS*2.5;
        d.position.x+=(PM.qb.position.x-d.position.x)*dt*SS*1.5;
        d.userData.ribbons?.forEach((r,ri)=>{r.rotation.x=Math.sin(p*12+ri)*0.4;});
      }
      break;
    case'route':{
      const wr=PM[s.wm];if(!wr)break;
      wr.position.x=s.sx+(s.ex-s.sx)*ease;
      wr.position.z=s.sz+(s.ez-s.sz)*ease;
      wr.userData.ribbons?.forEach((r,ri)=>{r.rotation.x=Math.sin(p*10+ri)*0.3;});
      // Show indicator
      const ind=wr.getObjectByName('ind');
      if(ind){ind.visible=true;ind.material.color.setHex(s.isOpen?0x43a047:0xe53935);ind.scale.setScalar(1+Math.sin(p*Math.PI*4)*0.3);}
      // Defense follows if covering
      if(!s.isOpen&&PM['d'+(s.ri+1)]){
        const d=PM['d'+(s.ri+1)];
        d.position.x+=(s.ex-d.position.x)*dt*SS*2;
        d.position.z+=(s.ez-d.position.z)*dt*SS*2;
      }
      break;}
    case'throw':{
      const wr=PM[s.wm];if(!wr)break;
      const qp=PM.qb.position;
      ball.visible=true;
      ball.position.x=qp.x+(wr.position.x-qp.x)*ease;
      ball.position.z=qp.z+(wr.position.z-qp.z)*ease;
      ball.position.y=1.5+Math.sin(ease*Math.PI)*3;
      ball.rotation.x+=dt*15;
      break;}
    case'catch':{
      const wr=PM[s.wm];if(!wr)break;
      ball.position.copy(wr.position);ball.position.y=1.5;
      wr.position.z-=dt*SS*3;ball.position.z=wr.position.z;
      break;}
    case'flagpull':{
      if(s.wm){
        const wr=PM[s.wm],d=PM.d1;
        if(wr&&d){d.position.lerp(wr.position,dt*SS*4);
          if(p>0.6)wr.userData.ribbons?.forEach(r=>{r.position.y-=dt*2;r.rotation.x=1;});}
      }else{
        // QB flag pull
        const d=PM.d0;d.position.lerp(PM.qb.position,dt*SS*4);
        if(p>0.6)PM.qb.userData.ribbons?.forEach(r=>{r.position.y-=dt*2;r.rotation.x=1;});
      }
      break;}
    case'scramble':
      PM.qb.position.z-=dt*SS*8;ball.position.copy(PM.qb.position);ball.position.y=1.5;
      PM.qb.userData.ribbons?.forEach((r,ri)=>{r.rotation.x=Math.sin(p*14+ri)*0.5;});
      break;
    case'int':
      ball.position.lerp(PM.d3.position.clone().add(new THREE.Vector3(0,1.5,0)),dt*SS*3);
      break;
    case'drop':case'inc':case'flag_pull_qb':
      ball.position.y-=dt*SS*4;if(ball.position.y<0.2)ball.position.y=0.2;
      break;
  }
  if(G.sim.t>=s.dur){G.sim.t=0;G.sim.step++;}
}

function setSS(v){SS=v;document.querySelectorAll('#spd button').forEach(b=>b.classList.toggle('a',parseFloat(b.textContent)===v));}

// ── Finish Sim → Result ─────────────────────────────────────
function finSim(){
  G.sim.on=false;$('spd').style.display='none';$('slog').style.display='none';
  clearRoutes();
  const r=G.sim.res,yds=G.sim.yds;
  G.mt.hist.push({pid:G.sp,def:G.sim.def,ok:r==='complete'||r==='touchdown'||r==='scramble'||r==='scramble_td',yds});

  let grade='C',msg='',dtl='',matchup='';
  const dn=gD(G.sim.def)?.name||G.sim.def,pn=gP(G.sp)?.name||'';
  matchup=`${pn} vs ${dn}`;
  if(G.sim.beat)matchup+=' — ✅ 战术克制!';else if(G.sim.weak)matchup+=' — ❌ 被克制!';

  if(r==='touchdown'||r==='scramble_td'){
    G.mt.ps+=6;G.mt.mom=Math.min(6,G.mt.mom+2);G.coins+=50;G.qb.xp+=30;
    grade='S';msg=`🎉 达阵得分！+${yds}码！`;dtl='腰旗橄榄球达阵=6分（无附加分踢球）';
  }else if(r==='complete'){
    G.mt.bp+=yds;G.mt.ytg-=yds;G.mt.mom=Math.min(6,G.mt.mom+1);G.coins+=10;G.qb.xp+=10;
    if(G.mt.ytg<=0){
      if(G.mt.bp>=50&&G.mt.dn<=4){G.mt.dn=1;G.mt.ytg=G.mt.bp<50?50-G.mt.bp:100-G.mt.bp;G.mt.ytg=Math.min(20,100-G.mt.bp);}
      else{G.mt.dn=1;G.mt.ytg=20;}
    }else G.mt.dn++;
    grade=G.sim.beat?'A':'B';msg=`✅ 接球成功 +${yds}码`;
  }else if(r==='scramble'){
    G.mt.bp+=yds;G.mt.ytg-=yds;G.coins+=8;G.qb.xp+=8;
    if(G.mt.ytg<=0){G.mt.dn=1;G.mt.ytg=Math.min(20,100-G.mt.bp);}else G.mt.dn++;
    grade='B';msg=`🏃 QB跑动 +${yds}码`;
  }else if(r==='interception'){
    G.mt.mom=0;G.qb.xp+=2;grade='D';msg='❌ 被抄截！攻防转换！';
  }else{
    G.mt.dn++;G.mt.mom=Math.max(0,G.mt.mom-1);G.qb.xp+=3;
    grade='C';msg=r==='drop'?'⚠️ 接球失败，传球未完成':'⚠️ 传球未完成';
  }

  // Coverage breakdown
  let covHtml='<h3>📊 本档覆盖详情</h3>';
  G.sim.cov.forEach((c,i)=>{
    covHtml+=`<div class="coverage-detail"><span class="${c.isOpen?'open':'covered'}">${c.isOpen?'🟢':'🔴'} ${c.who}</span>: ${c.reason}</div>`;
  });

  // Level up
  if(G.qb.xp>=G.qb.lv*50){
    G.qb.xp-=G.qb.lv*50;G.qb.lv++;
    const stats=['acc','arm','read','mob'];const st=stats[~~(Math.random()*stats.length)];
    G.qb[st]=Math.min(99,G.qb[st]+2+~~(Math.random()*3));
    dtl+=` | ⬆️ 升级！${st}提升`;
  }

  // Show result
  const gc={S:'#f9a825',A:'#43a047',B:'#4fc3f7',C:'#fdd835',D:'#ef5350'};
  let h=`<div style="font-size:48px;font-weight:bold;color:${gc[grade]||'#fff'};margin:8px 0">${grade}</div>`;
  h+=`<div style="font-size:18px;font-weight:bold;color:${grade==='D'?'#ef5350':grade==='S'?'#f9a825':'#fff'};margin:6px 0">${msg}</div>`;
  h+=`<div style="font-size:12px;color:#888;margin:4px 0">${matchup}</div>`;
  h+=`<div style="font-size:12px;color:${(G.sr[G.sp]||0)>50?'#ffa726':'#888'};margin:4px 0">侦察度: ${G.sr[G.sp]||0}% · Momentum: ${'🔥'.repeat(G.mt.mom)}</div>`;
  if(dtl)h+=`<div style="font-size:12px;color:#aaa;margin:4px 0">${dtl}</div>`;
  h+=covHtml;
  h+=`<button class="btn btn-p btn-b" onclick="contRes()">继续</button>`;
  $('rp').innerHTML=h;G.ph='result';showP('rp');updHUD();
}

// ── Continue After Result ───────────────────────────────────
function contRes(){
  hideAll();const r=G.sim.res;
  if(r==='touchdown'||r==='scramble_td'){
    G.mt.pos='o';G.mt.bp=25;G.mt.dn=1;G.mt.ytg=20;showDS();return;
  }
  if(r==='interception'){simOppDrive();return;}
  if(G.mt.dn>4){G.mt.pos='o';G.mt.bp=Math.max(25,100-G.mt.bp);G.mt.dn=1;G.mt.ytg=20;showDS();return;}
  advQ();
  if(G.ph!=='game_over'&&G.ph!=='season_end'){posLine(G.mt.bp);setCam(G.mt.bp);showPS();}
}

function advQ(){G.mt.q+=0.25;if(G.mt.q>4.75)endMatch();}

// ── Defense Turn ────────────────────────────────────────────
function showDS(){
  G.ph='def_sel';G.sd=null;hideAll();updHUD();
  let h=`<h2>🛡️ 防守回合</h2><p style="text-align:center;font-size:12px;color:#888;margin-bottom:10px">对手持球进攻。选择你的防守阵型。</p>`;
  h+=`<div class="rush-info">⚡ 你需要指派1-2个冲传手从7码线冲传！</div>`;
  h+=`<div class="dg">`;
  DEFENSES.forEach(d=>{
    h+=`<div class="dc" onclick="selDef('${d.id}',this)"><div class="ic">${d.icon}</div><div class="nm">${d.name}</div><div class="ds">${d.desc}</div><div style="font-size:10px;color:#666;margin-top:4px">冲传手:${d.rush}人</div></div>`;
  });
  h+=`</div><button class="btn btn-p btn-b" id="dcb" style="display:none" onclick="confDef()">确认防守</button>`;
  $('dp').innerHTML=h;showP('dp');
}
function selDef(id,el){
  G.sd=id;document.querySelectorAll('.dc').forEach(c=>c.classList.remove('sel'));el.classList.add('sel');
  $('dcb').style.display='block';
}
function confDef(){hideAll();simOppDrive();}

function simOppDrive(){
  G.ph='def_sim';
  const types=['short','mid','long'];
  const w=G.opp.style==='aggressive'?[0.2,0.3,0.5]:[0.4,0.35,0.25];
  let r=Math.random(),ot='short';for(let i=0;i<3;i++){r-=w[i];if(r<=0){ot=types[i];break;}}

  let suc=0.4+G.opp.diff*0.08;
  const def=G.sd||'cover2',dd=gD(def);
  if(def.includes('blitz')&&ot==='short')suc-=0.15;
  if(def.includes('man')&&ot==='mid')suc-=0.1;
  if(def==='cover2'&&ot==='long')suc-=0.2;
  if(def==='cover3'&&ot==='long')suc-=0.15;
  if(def.includes('blitz')&&ot==='long')suc+=0.15;
  suc=Math.max(0.1,Math.min(0.75,suc));
  const ok=Math.random()<suc;
  const td=ok&&Math.random()<(0.12+G.opp.diff*0.05);

  slog('🛡️ 对手进攻中...','#ef5350','你的防守：'+dd?.name);
  posLine(G.mt.bp);
  let el=0;
  const iv=setInterval(()=>{
    el+=0.05;
    ['wr1','wr2','wr3'].forEach(id=>{PM[id].position.z-=0.3*SS;});
    for(let i=0;i<5;i++)PM['d'+i].position.z-=0.25*SS;
    if(el>2/SS){
      clearInterval(iv);$('slog').style.display='none';
      if(td){
        G.mt.os+=6;
        showSimResult('D',`😤 对手达阵! 比分 ${G.mt.ps}-${G.mt.os}`,`你的防守:${dd?.name} vs 对手${ot==='short'?'快传':ot==='long'?'长传':'中传'}`,`${dd?.explain||''}`);
      }else if(ok){
        showSimResult('B','🛡️ 对手推进但未得分',`你的防守限制了对手`,dd?.explain||'');
      }else{
        showSimResult('A','🛡️ 防守成功!',`${dd?.name}有效遏制了对手进攻!`,dd?.explain||'');
      }
      G.mt.pos='p';G.mt.bp=25;G.mt.dn=1;G.mt.ytg=20;advQ();
    }
  },50);
}

function showSimResult(grade,msg,dtl,explain){
  const gc={S:'#f9a825',A:'#43a047',B:'#4fc3f7',C:'#fdd835',D:'#ef5350'};
  let h=`<div style="font-size:42px;font-weight:bold;color:${gc[grade]};margin:8px 0">${grade}</div>`;
  h+=`<div style="font-size:17px;font-weight:bold;margin:6px 0">${msg}</div>`;
  h+=`<div style="font-size:12px;color:#888;margin:4px 0">${dtl}</div>`;
  if(explain)h+=`<div class="coverage-detail" style="margin-top:8px">${explain}</div>`;
  h+=`<button class="btn btn-p btn-b" onclick="contDef()">继续</button>`;
  $('rp').innerHTML=h;G.ph='result';showP('rp');updHUD();
}
function contDef(){
  hideAll();
  if(G.ph==='game_over')return;
  posLine(G.mt.bp);setCam(G.mt.bp);showPS();
}

// ── End Match / Shop / Season ───────────────────────────────
function endMatch(){
  const won=G.mt.ps>G.mt.os;G.ph='game_over';hideAll();
  const gi=G.sn.gi;if(gi<G.sg.length){G.sg[gi].done=true;G.sg[gi].won=won;}
  if(won){G.sn.w++;G.coins+=100;G.shards+=15;}else{G.sn.l++;G.coins+=30;G.shards+=5;}
  const isBW=won&&G.opp.isBoss;
  const hist=G.mt.hist,comp=hist.filter(h=>h.ok).length,tyds=hist.reduce((s,h)=>s+(h.yds||0),0);
  let h=`<div style="font-size:26px;font-weight:bold;color:${won?'#f9a825':'#ef5350'};margin-bottom:6px">${isBW?'🏆 赛季冠军!!!':won?'🎉 胜利!':'😤 失败...'}</div>`;
  h+=`<div style="font-size:34px;font-weight:bold;margin:8px 0">${G.mt.ps} - ${G.mt.os}</div>`;
  h+=`<div style="font-size:13px;color:#888">vs ${G.opp.name}<br>传球:${comp}/${hist.length} · 码数:${tyds}<br>💰+${won?100:30} · 🏆+${won?15:5}碎片</div>`;
  h+=`<button class="btn btn-p btn-b" onclick="aftGO()">${isBW?'🏆 完成赛季!':won?'下一场':'继续'}</button>`;
  $('gp').innerHTML=h;showP('gp');updHUD();
}
function aftGO(){
  hideAll();
  const won=G.sg[G.sn.gi]?.won,isBW=won&&G.opp.isBoss;
  if(isBW){G.sn.n++;newSeason();return;}
  G.sn.gi++;
  if(G.sn.l>=3||G.sn.gi>=G.sg.length){showSE();return;}
  showShop();
}
function showShop(){
  G.ph='shop';hideAll();
  const avail=PLAYS.filter(p=>!G.dk.includes(p.id)).sort(()=>Math.random()-0.5).slice(0,3);
  let h=`<h2>🏪 战术商店</h2><div style="text-align:center;font-size:15px;color:#f9a825;margin-bottom:10px">💰 ${G.coins}</div>`;
  h+=`<div class="cg">`;
  avail.forEach(p=>{
    const pr=p.type==='long'?200:p.type==='mid'?150:100;
    const ca=G.coins>=pr;
    h+=`<div class="cd fi" style="opacity:${ca?1:0.4}" ${ca?`onclick="buyCard('${p.id}',${pr})"`:''}><div class="ic">${p.icon}</div><div class="nm">${p.name}</div><div class="ds">${p.desc}</div><div style="color:#f9a825;font-weight:bold;margin-top:5px">💰${pr}</div></div>`;
  });
  if(G.coins>=80) h+=`<div class="cd fi" onclick="buyStat()"><div class="ic">⬆️</div><div class="nm">属性+3</div><div class="ds">随机提升一项</div><div style="color:#f9a825;font-weight:bold;margin-top:5px">💰80</div></div>`;
  h+=`</div><button class="btn btn-s btn-b" onclick="leaveShop()">▶ 继续赛季</button>`;
  $('sp').innerHTML=h;showP('sp');
}
function buyCard(id,pr){G.coins-=pr;G.dk.push(id);G.sr[id]=0;showShop();}
function buyStat(){G.coins-=80;const s=['acc','arm','read','mob'][~~(Math.random()*4)];G.qb[s]=Math.min(99,G.qb[s]+3);showShop();}
function leaveShop(){hideAll();showMap();}
function showSE(){
  G.ph='season_end';hideAll();
  let h=`<div style="font-size:24px;font-weight:bold;margin-bottom:6px">📊 赛季结束</div>`;
  h+=`<div style="font-size:28px;font-weight:bold;margin:8px 0">${G.sn.w}W - ${G.sn.l}L</div>`;
  h+=`<div style="font-size:12px;color:#888">Lv.${G.qb.lv} · 精准${G.qb.acc} 臂力${G.qb.arm} 阅读${G.qb.read} 机动${G.qb.mob}<br>🏆 ${G.shards}碎片</div>`;
  h+=`<button class="btn btn-p btn-b" onclick="G.sn.n++;newSeason()">🔄 开始新赛季</button>`;
  $('gp').innerHTML=h;showP('gp');
}
function newSeason(){
  G.dk=['quick_slant','out_route','curl','screen','post','mesh','go_fly','flood'];
  G.sn.gi=0;G.sn.w=0;G.sn.l=0;G.coins=Math.max(200,G.coins);genSeason();showMap();
}
function startGame(){$('ttl').style.display='none';G=newG();genSeason();showMap();}

// ── Three.js Loop ───────────────────────────────────────────
function anim(){
  requestAnimationFrame(anim);const dt=Math.min(0.1,clk.getDelta());
  if(G.ph==='sim'&&G.sim.on)updSim(dt);
  // Idle bob + ribbon flutter
  Object.values(PM).forEach(pm=>{
    pm.position.y=Math.sin(Date.now()*0.003+pm.position.x)*0.04;
    pm.userData.ribbons?.forEach((r,ri)=>{if(G.ph!=='sim')r.rotation.x=Math.sin(Date.now()*0.004+ri*2)*0.08;});
  });
  if(G.ph!=='title'&&G.ph!=='season_map'&&G.ph!=='season_end')cam.position.x=Math.sin(Date.now()*0.0004)*1.2;
  ren.render(sc,cam);
}
G=newG();initThree();anim();
