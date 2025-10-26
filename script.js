/* ==========================
   Stickman Seasons Adventure
   (Updated: fixes for crashes & lives handling)
   ========================== */

/* --- safe DOM getters (so missing elements won't crash script) --- */
function $id(id){ return document.getElementById(id) || null; }

const canvas = $id('gameCanvas');
if (!canvas) {
  console.error('Canvas element with id "gameCanvas" not found. Script cannot run.');
  throw new Error('Canvas not found');
}
const ctx = canvas.getContext('2d', { alpha: false });

const menu = $id('menu');
const startBtn = $id('startBtn');
const soundBtn = $id('soundBtn');
const pauseBtn = $id('pauseBtn');
const menuBtn = $id('menuBtn');
const menuBtnOver = $id('menuBtnOver');
const restartBtn = $id('restartBtn');
const exitBtn2 = $id('exitBtn2');
const scoreDisplay = $id('score');
const levelDisplay = $id('level');
const windLabel = $id('windLabel');
const gameOverScreen = $id('gameOver');
const finalScore = $id('finalScore');
const hud = $id('hud');

let DPR = devicePixelRatio || 1;
function fitCanvas() {
  DPR = devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * DPR);
  canvas.height = Math.floor(window.innerHeight * DPR);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // ✅ ensure full-screen stretch (mobile fix)
  document.body.style.height = window.innerHeight + 'px';
}

window.addEventListener('resize', fitCanvas);
fitCanvas();


/* ==========================
   Sounds
   ========================== */
let soundOn = true;
const scoreSound = new Audio("audio/score.ogg");
const popSound   = new Audio('audio/boom-sound.mp3');
const boomSound  = new Audio('audio/boom-sound.mp3');
scoreSound.volume = 0.2;
popSound.volume = 0.2;
boomSound.volume = 0.2;

const bgMusic = new Audio();
bgMusic.loop = true;
bgMusic.volume = 0.18;
// Additional sound for losing a life
const loseLifeSound = new Audio('audio/boom-sound.mp3');
loseLifeSound.volume = 0.4;
// === Extra Sounds ===
const levelChangeSound = new Audio('audio/level-change.mp3');
levelChangeSound.preload = 'auto';
levelChangeSound.volume = 0.05;

const gameOverSound = new Audio('audio/game-over.mp3');
gameOverSound.preload = 'auto';
gameOverSound.volume = 0.6;

const keyPickupSound = new Audio('audio/key-pickup.mp3');
keyPickupSound.preload = 'auto';
keyPickupSound.volume = 0.5;



/* ==========================
   Game state & levels
   ========================== */
let player, obstacles, particles, weatherParticles, score, baseSpeed, animId, gameRunning=false, paused=false;
let wind = {active:false,dir:0,strength:0,timer:0};
let prevLevelIndex = -1;

let keys = [];
let keysCollected = 0;
const keysNeeded = 1;
const hudKeys = $id('hud-keys');
const hudLives = $id('hud-lives');
const hudWind = $id('hud-wind');
const hudSeason = $id('hud-season');

let gift = null;           // active gift object
let powerupActive = false; // flag for active power-up
let powerupTimer = 0;      // countdown for power-up duration
let shieldActive = false;
let shieldTimer = 0;

const levels = [
  { id:0, name:'Spring Morning', bg:'images/spring.jpg', ambient:'audio/spring-forest.mp3', weather:'petals' },
  { id:1, name:'Summer Noon', bg:'images/spring.jpg', ambient:'audio/beach-waves.mp3', weather:'heat' },
  { id:2, name:'Autumn Evening', bg:'images/spring.jpg', ambient:'audio/calm-wind.mp3', weather:'leaves' },
  { id:3, name:'Winter Night', bg:'images/spring.jpg', ambient:'audio/winter-night.mp3', weather:'snow' },
  { id:4, name:'Rainy Day', bg:'images/spring.jpg', ambient:'audio/rainy-ambience.mp3', weather:'rain' },
  { id:5, name:'Thunderstorm', bg:'images/spring.jpg', ambient:'audio/thunderstorm.mp3', weather:'storm' },
  { id:6, name:'Calm Night', bg:'images/spring.jpg', ambient:'audio/night-forest.mp3', weather:'fireflies', neon:true },
  { id:7, name:'Rainbow Morning', bg:'images/spring.jpg', ambient:'audio/happy-morning.mp3', weather:'sparkles' },
  { id:8, name:'Spring Challenge', bg:'images/desert.jpg', ambient:'audio/spring-forest.mp3', weather:'petals' },
  { id:9, name:'Summer Heatwave', bg:'images/desert.jpg', ambient:'audio/beach-waves.mp3', weather:'heat' },
  { id:10, name:'Autumn Rush', bg:'images/desert.jpg', ambient:'audio/calm-wind.mp3', weather:'leaves' },
  { id:11, name:'Winter Storm', bg:'images/desert.jpg', ambient:'audio/winter-night.mp3', weather:'snow' },
  { id:12, name:'Monsoon Flood', bg:'images/desert.jpg', ambient:'audio/rainy-ambience.mp3', weather:'rain' },
  { id:13, name:'Thunder Fury', bg:'images/desert.jpg', ambient:'audio/thunderstorm.mp3', weather:'storm' },
  { id:14, name:'Neon Twilight', bg:'images/desert.jpg', ambient:'audio/night-forest.mp3', weather:'fireflies', neon:true },
  { id:15, name:'Rainbow Finale', bg:'images/desert.jpg', ambient:'audio/happy-morning.mp3', weather:'sparkles' }
];


let currentLevelNum = 0;
function currentLevelIndex(){ return currentLevelNum; }
function currentLevel(){ return levels[currentLevelNum]; }

function nextLevel() {
  keysCollected = 0;
  keys = [];
  currentLevelNum++;

  // Loop back to first level if last level finished
  if (currentLevelNum >= levels.length) currentLevelNum = 0;

  // 🔊 Play Level Change sound
  if (soundOn) {
    try {
      levelChangeSound.currentTime = 0;
      levelChangeSound.play();
    } catch (e) {
      console.warn('Level change sound error:', e);
    }
  }

  // Change music for the new level
  changeMusicForLevel(currentLevel());

  console.log(`🎉 Level Up! Welcome to ${levels[currentLevelNum].name}`);

  // 🎁 Spawn gift at the start of each new level
  const giftX = (canvas.width / DPR) / 2;
  const giftY = 100;
  gift = new Gift(giftX, giftY);
}
let lives = 3;

// ✅ Preload wind images once at start
const windImgs = {
  calm: new Image(),
  left: new Image(),
  right: new Image()
};

// Correct file paths (use forward slashes)
windImgs.calm.src = "images/UmbrellaButton.svg"; // calm wind
windImgs.left.src = "images/WindButton.svg";     // wind blowing left
windImgs.right.src = "images/WindButton.svg";    // wind blowing right (will flip)


/* ==========================
   Utilities
   ========================== */
function rand(min,max){ return Math.random()*(max-min)+min; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

/* ==========================
   Game classes
   ========================== */
class Player {
  constructor() {
    this.x = (canvas.width / DPR) / 2;
    this.y = 120;
    this.vx = 0;
    this.vy = 0;
    this.targetVx = 0;
    this.targetVy = 0;
    this.maxSpeed = 10;
    this.radius = 12;
    this.animPhase = 0;
  }

  update() {
    // Smooth acceleration toward target
    this.vx += (this.targetVx - this.vx) * 0.12;
    this.vy += (this.targetVy - this.vy) * 0.12;

    if (wind.active) {
      this.vx += wind.dir * wind.strength * 0.02;
      this.vy += Math.sin(wind.dir * 0.3) * wind.strength * 0.01;
    }

    this.x += this.vx;
    this.y += this.vy;

    // Keep inside screen bounds
    const w = canvas.width / DPR;
    const h = canvas.height / DPR;
    this.x = Math.min(Math.max(this.x, 20), w - 20);
    this.y = Math.min(Math.max(this.y, 40), h - 60);

    this.animPhase += 0.06 + (Math.abs(this.vx) + Math.abs(this.vy)) * 0.02;
  }

  draw() {
    const lvl = currentLevel();
    const glow = lvl && lvl.neon;
    const accent = glow ? "#66f6ff" : "#111";

    ctx.save();
    ctx.translate(this.x, this.y);

    if (glow) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = accent;
    }

    // --- Body tilt depends on movement ---
    const tiltX = this.vx * 0.05; // side tilt
    const tiltY = this.vy * 0.05; // dive angle
    ctx.rotate(tiltX + tiltY * 0.3);

    // --- Head ---
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = accent;
    ctx.arc(0, -this.radius * 1.2, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // --- Body ---
    ctx.beginPath();
    ctx.moveTo(0, -this.radius * 0.2);
    ctx.lineTo(0, this.radius * 1.8);
    ctx.stroke();

    // --- Arms ---
    const armSwing = Math.sin(this.animPhase * 1.2) * 6;
    ctx.beginPath();

    if (this.vy > 0.8) {
      // diving down → arms backward
      ctx.moveTo(0, 0);
      ctx.lineTo(-10, 10);
      ctx.moveTo(0, 0);
      ctx.lineTo(10, 10);
    } else if (this.vy < -0.8) {
      // moving upward → arms flapping up
      ctx.moveTo(0, 0);
      ctx.lineTo(-10, -10 - armSwing);
      ctx.moveTo(0, 0);
      ctx.lineTo(10, -10 - armSwing);
    } else {
      // idle fall → arms slightly out
      ctx.moveTo(0, 0);
      ctx.lineTo(-14, 4);
      ctx.moveTo(0, 0);
      ctx.lineTo(14, 4);
    }
    ctx.stroke();

    // --- Legs ---
    const legSwing = Math.sin(this.animPhase) * 5;
    ctx.beginPath();
    if (this.vy > 0.8) {
      // diving legs tucked backward
      ctx.moveTo(0, this.radius * 1.8);
      ctx.lineTo(-5 - legSwing, this.radius * 2.4);
      ctx.moveTo(0, this.radius * 1.8);
      ctx.lineTo(5 + legSwing, this.radius * 2.4);
    } else {
      // relaxed fall legs
      ctx.moveTo(0, this.radius * 1.8);
      ctx.lineTo(-6 - legSwing, this.radius * 3.2);
      ctx.moveTo(0, this.radius * 1.8);
      ctx.lineTo(6 + legSwing, this.radius * 3.2);
    }
    ctx.stroke();

    ctx.restore();
  }
}

class Gift {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 90; // slightly bigger for visibility
    this.collected = false;
    this.vy = -1.5;
    this.floatPhase = 0;

    // Preload gift image once
    if (!Gift.image) {
      Gift.image = new Image();
      Gift.image.src = "images/gift.png"; // 🖼️ <-- your gift image path
      Gift.imageLoaded = false;
      Gift.image.onload = () => { Gift.imageLoaded = true; };
    }
  }

  update() {
    this.floatPhase += 0.05;
    this.y += Math.sin(this.floatPhase) * 0.4; // floating motion
  }

  draw() {
    if (!Gift.imageLoaded) return; // skip draw until loaded

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ffd54f";

    // Draw image centered on position
    ctx.drawImage(
      Gift.image,
      -this.size / 2,
      -this.size / 2,
      this.size,
      this.size
    );

    ctx.restore();
  }
}

/* ====== Balloon class (image-based) ====== */
class Balloon {
  // 🎈 Filenames for your image balloons
  static filenames = [
    "1 (1).svg","1 (2).svg","1 (3).svg","1 (4).svg","1 (5).svg","1 (14).svg","1 (16).svg",
    "1 (6).svg","1 (8).svg","1 (9).svg","1 (10).svg","1 (11).svg","1 (12).svg","1 (15).svg",
    "1 (13).svg","1 (1).png","1 (2).png","1 (3).png","1 (4).png","1 (5).png"
  ];

  // 🧩 Preload all balloon images once
  static preload() {
    if (Balloon.images) return;
    Balloon.images = [];
    for (let name of Balloon.filenames) {
      const img = new Image();
      img.src = "images/balloon/" + name; // adjust if your folder path differs
      const entry = { img, loaded: false, aspect: 1 };
      img.onload = () => {
        entry.loaded = true;
        entry.aspect = img.width / Math.max(1, img.height);
      };
      Balloon.images.push(entry);
    }
  }

  constructor(x, y) {
    Balloon.preload();

    this.x = x;
    this.y = y;
    this.baseY = y;

    // 🎨 Choose random preloaded image
    this.imgIndex = Math.floor(Math.random() * Balloon.images.length);
    this.imgEntry = Balloon.images[this.imgIndex];

    // 🌌 Depth-based perspective scaling (creates near/far illusion)
    const baseHeight = 34;                  // base size
    this.depth = 1.0 + Math.random() * 0.9; // 0.8–1.4 (far→near)
    this.targetHeight = baseHeight * this.depth;

    // Compute width from image aspect ratio
    const aspect = this.imgEntry.aspect || 1;
    this.drawHeight = this.targetHeight;
    this.drawWidth = this.drawHeight * aspect;

    // Approximate collision radius
    this.radius = Math.max(10, this.drawHeight * 0.45);

    // 💫 Floating & movement properties
    this.type = 'balloon';
    this.passed = false;
    this.swing = rand(0, Math.PI * 2);
    this.swingSpeed = 0.02 + Math.random() * 0.04;
    this.bobSpeed = rand(0.008, 0.02);
    this.bobAmt = rand(10, 18);
    this.remove = false;
  }

  update(speed) {
    // 🎢 Apply depth-based movement (closer balloons drift faster)
    const effectiveSpeed = speed * this.depth;

    // Upward motion
    this.y -= effectiveSpeed;

    // Gentle side and vertical swing
    this.swing += this.swingSpeed;
    this.x += Math.sin(this.swing) * 0.3;
    this.y += Math.sin(this.swing * 2) * 0.3;

    // 🌬️ Wind effect (if active)
    if (wind.active)
      this.x += wind.dir * wind.strength * (Math.random() * 0.8 + 0.6);

    // Adjust size dynamically if image loaded later
    if (this.imgEntry && this.imgEntry.loaded) {
      const aspect = this.imgEntry.aspect || 1;
      this.drawHeight = this.targetHeight;
      this.drawWidth = this.drawHeight * aspect;
      this.radius = Math.max(8, this.drawHeight * 0.45);
    }

    // Remove if off-screen
    if (this.y < -this.drawHeight * 2) this.remove = true;
  }

  draw() {
    if (!this.imgEntry || !this.imgEntry.loaded) return; // wait for preload

    const img = this.imgEntry.img;
    const w = this.drawWidth;
    const h = this.drawHeight;

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    // Optional: fade far balloons slightly for depth realism
    // ctx.globalAlpha = Math.min(1, this.depth * 0.9 + 0.2);

    // 🖼️ Draw balloon centered horizontally, bottom aligned to Y
    ctx.drawImage(
      img,
      Math.round(this.x - w / 2),
      Math.round(this.y - h),
      Math.round(w),
      Math.round(h)
    );

    ctx.restore();
  }
}


class Platform {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width || 200;  // base width
    this.height = height || 80; // realistic platform thickness
    this.type = 'platform';
    this.remove = false;
    this.passed = false;
    this.phase = Math.random() * Math.PI * 2;

    // Load shared platform image only once
    if (!Platform.image) {
      Platform.image = new Image();
      Platform.image.src = "images/platform.png";
      Platform.imageLoaded = false;
      Platform.image.onload = () => {
        Platform.imageLoaded = true;
        Platform.naturalWidth = Platform.image.width;
        Platform.naturalHeight = Platform.image.height;
        Platform.aspect = Platform.image.width / Platform.image.height;
      };
    }
  }

  update(speed) {
    this.y -= speed * 1.9;
    this.phase += 0.03;
    this.y += Math.sin(this.phase) * 0.3;

    if (wind.active) this.x += wind.dir * wind.strength * 0.8;
    if (this.y < -this.height) this.remove = true;
  }
draw() {
  if (!Platform.imageLoaded) return;
  ctx.save();

  // Reset any leftover effects
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  const img = Platform.image;
  const aspect = Platform.aspect || (img.width / img.height);
  const drawWidth = this.width;
  const drawHeight = this.height || (drawWidth / aspect);
  const drawX = Math.round(this.x - drawWidth / 2);
  const drawY = Math.round(this.y - drawHeight / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(img, 1, 1, img.width - 2, img.height - 2, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}
}
class Bird {
  constructor(){
    this.size = rand(12,28);
    this.x = Math.random() * (canvas.width / DPR);
    this.y = Math.random() * (canvas.height / DPR / 2 + 100);
    this.speed = rand(1,2.5);
    this.direction = Math.random() < 0.5 ? 1 : -1;
    this.vy = rand(-0.5,0.5);
    this.wingFlap = 0; this.wingDir = 1;
    this.color = Bird.randomColor();
  }
  static randomColor(){
    const palette = ['#4B3621','#C0C0C0','#FFFFFF','#A0522D','#B22222','#556B2F'];
    return palette[Math.floor(Math.random()*palette.length)];
  }
  update(){
    this.x += this.speed * this.direction;
    this.y += this.vy;
    this.wingFlap += 0.2 * this.wingDir;
    if (this.wingFlap > Math.PI/6 || this.wingFlap < -Math.PI/6) this.wingDir *= -1;
    if (this.x > canvas.width / DPR + 30) this.x = -30;
    if (this.x < -30) this.x = canvas.width / DPR + 30;
    if (this.y > canvas.height / DPR) this.y = 0;
    if (this.y < 0) this.y = canvas.height / DPR;
  }
  draw(){
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.direction, 1);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size*0.23, this.size*0.15, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.size*0.25, -this.size*0.03, this.size*0.08, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-this.size*0.35, 0);
    ctx.lineTo(-this.size*0.5, -this.size*0.12);
    ctx.lineTo(-this.size*0.5, this.size*0.12);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(-this.size*0.05, 0);
    ctx.rotate(-this.wingFlap);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.quadraticCurveTo(-this.size*0.5, -this.size*0.35, -this.size*0.35, 0);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(-this.size*0.05, 0);
    ctx.rotate(this.wingFlap);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.quadraticCurveTo(this.size*0.5, -this.size*0.35, this.size*0.35, 0);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }
}

let birds = [];
for (let i=0;i<12;i++) birds.push(new Bird());
function drawBirds(){ birds.forEach(b=>{ b.update(); b.draw(); }); }

class Key {
  constructor(x,y){
    this.x = x; this.y = y; this.size = 28;
    this.swing = rand(0, Math.PI*2);
    this.swingSpeed = 0.03 + Math.random()*0.02;
  }
  update(speed){ this.y -= speed; this.x += Math.sin(this.swing) * 0.4; this.swing += this.swingSpeed; }
  draw(){
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.font = `${this.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('🗝', 0, 0);
    ctx.restore();
  }
}

/* generic particle */
class Particle {
  constructor(opts){ Object.assign(this, opts); this.life = this.life || 60; this.age = 0; }
  update(){ this.x += (this.vx||0); this.y += (this.vy||0); if (wind.active) this.x += wind.dir * wind.strength * (this.windFactor || 0.5); this.vy += (this.gravity || 0); this.age++; }
  draw(){
    ctx.beginPath();
    if (this.drawType === 'circle'){ ctx.fillStyle = this.color || '#fff'; ctx.arc(this.x, this.y, this.r || 3, 0, Math.PI*2); ctx.fill(); }
    else if (this.drawType === 'line'){ ctx.strokeStyle = this.color || 'rgba(255,255,255,0.6)'; ctx.lineWidth = this.lineWidth || 2; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + (this.vx||0)*-3, this.y + (this.vy||0)*-3); ctx.stroke(); }
    else if (this.drawType === 'rect'){ ctx.fillStyle = this.color || '#c84'; ctx.fillRect(this.x, this.y, this.w || 6, this.h || 3); }
  }
}

/* ==========================
   Explosion / Pop
   ========================== */
let explosionParticles = [];
/* ==========================
   Floating Text Effect (+5)
   ========================== */
let floatingTexts = [];

function spawnFloatingText(x, y, text, color = 'gold') {
  floatingTexts.push({
    x,
    y,
    text,
    color,
    alpha: 1,
    vy: -0.6,       // upward movement speed
    life: 60,        // lifetime in frames (~1 second at 60 FPS)
    age: 0
  });
}

function drawFloatingTexts() {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.age++;
    ft.y += ft.vy * (1 - ft.age / ft.life);  // ease-out upward motion
    ft.alpha = 1 - ft.age / ft.life;

    ctx.save();
    ctx.globalAlpha = ft.alpha;
    ctx.shadowBlur = 10;
    ctx.shadowColor = ft.color;
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();

    if (ft.age >= ft.life) floatingTexts.splice(i, 1);
  }
}

function spawnPop(x,y,color){
  if (soundOn) try{ popSound.currentTime = 0; popSound.play(); } catch(e){}
  // small burst
  for (let i=0;i<24;i++){
    explosionParticles.push(new Particle({
      x,y,
      vx: rand(-3.5,3.5),
      vy: rand(-4,2),
      r: rand(2,5),
      color: color,
      drawType:'circle',
      gravity:0.06,
      life: 40 + Math.floor(rand(0,40)),
      windFactor: rand(0.2,1.0)
    }));
  }
}

function spawnExplosion(x,y){
  if (soundOn) try{ boomSound.currentTime = 0; boomSound.play(); } catch(e){}
  for (let i=0;i<28;i++){
    explosionParticles.push(new Particle({
      x,y,
      vx: rand(-4,4),
      vy: rand(-5,5),
      r: rand(3,8),
      color: ['#ffb86b','#ff5c8a','#ffc857'][Math.floor(Math.random()*3)],
      drawType:'circle',
      gravity:0.08,
      life: 40 + Math.floor(rand(0,60)),
      windFactor: rand(0.2,1.0)
    }));
  }
}

/* ==========================
   Weather systems
   ========================== */
let weatherTimer = 0;
function startWindIfNeeded(){
  const lvl = currentLevel();
  const baseChance = (lvl.weather === 'storm') ? 0.02 : 0.004;
  if (!wind.active && Math.random() < baseChance){
    wind.active = true;
    wind.dir = Math.random() > 0.5 ? 1 : -1;
    wind.strength = rand(0.8,3.0);
    wind.timer = Math.floor(rand(120,380));
    for (let i=0;i<20;i++){
      const y = rand(0, canvas.height/DPR);
      if (!weatherParticles) weatherParticles = [];
      weatherParticles.push(new Particle({
        x: wind.dir > 0 ? -10 - rand(0,80) : (canvas.width/DPR) + rand(0,80),
        y,
        vx: wind.dir * rand(0.6,2.0),
        vy: rand(0.2,1.2),
        r: rand(2,4),
        color: '#eee',
        drawType:'circle',
        life: rand(60,180),
        windFactor: 1.8
      }));
    }
  }
}

function updateWind(){
  if (!wind) return;
  if (wind.active){
    wind.timer--;
    if (windLabel) windLabel.textContent = 'Wind: ' + (wind.dir>0 ? '⟿' : '⬳') + ' ' + wind.strength.toFixed(1);
    if (wind.timer <= 0){
      wind.active = false; wind.timer = 0;
      if (windLabel) windLabel.textContent = 'Wind: Calm';
    }
  }
}

/* spawn weather particles by level (keeps weatherParticles array safe) */
function spawnWeatherParticles(){
  if (!weatherParticles) weatherParticles = [];
  const lvl = currentLevel();
  const w = canvas.width / DPR, h = canvas.height / DPR;
  if (lvl.weather === 'petals'){
    if (Math.random() < 0.08) weatherParticles.push(new Particle({ x: rand(0,w), y: -10, vx: rand(-0.7,0.7), vy: rand(0.6,1.6), r: rand(3,6), color: ['#ffc0cb','#ffd1dc','#ffe9d6'][Math.floor(rand(0,3))], drawType:'circle', gravity:0.01, life:200, windFactor:1.0 }));
  } else if (lvl.weather === 'leaves'){
    if (Math.random() < 0.08) weatherParticles.push(new Particle({ x: rand(0,w), y: -10, vx: rand(-1.2,1.2), vy: rand(0.8,2.0), w:10, h:6, color: ['#d05b23','#ff9f43','#d88c4a'][Math.floor(rand(0,3))], drawType:'rect', gravity:0.02, life:200, windFactor:1.1 }));
  } else if (lvl.weather === 'snow'){
    if (Math.random() < 0.12) weatherParticles.push(new Particle({ x: rand(0,w), y: -10, vx: rand(-0.4,0.4), vy: rand(0.6,1.1), r: rand(1.5,4), color:'rgba(255,255,255,0.95)', drawType:'circle', gravity:0.002, life:240, windFactor:0.9 }));
  } else if (lvl.weather === 'rain' || lvl.weather === 'storm'){
    const chance = (lvl.weather === 'storm') ? 0.35 : 0.18;
    if (Math.random() < chance) weatherParticles.push(new Particle({ x: rand(0,w), y: -10, vx: rand(-0.8,0.8), vy: rand(8,14), lineWidth:2, color:'rgba(180,200,255,0.9)', drawType:'line', life:120, gravity:0.2, windFactor:0.6 }));
  } else if (lvl.weather === 'fireflies'){
    if (Math.random() < 0.08) weatherParticles.push(new Particle({ x: rand(0,w), y: rand(0,h), vx: rand(-0.3,0.3), vy: rand(-0.3,0.3), r: rand(1.5,3.6), color:'rgba(180,255,200,0.95)', drawType:'circle', life:180, windFactor:0.2 }));
  } else if (lvl.weather === 'sparkles'){
    if (Math.random() < 0.12) weatherParticles.push(new Particle({ x: rand(0,w), y: rand(0,h), vx: rand(-0.3,0.3), vy: rand(-0.3,0.3), r: rand(1.2,3.6), color: ['#ffd54f','#ffb86b','#b7ffef'][Math.floor(rand(0,3))], drawType:'circle', life:140, windFactor:0.2 }));
  }
}

/* thunder */
let thunderTimer = 0, lightningFlash = 0;
function maybeThunder(){
  const lvl = currentLevel();
  if (lvl.weather === 'storm' && Math.random() < 0.006){
    thunderTimer = 12 + Math.floor(rand(0,36));
    lightningFlash = 0;
  }
  if (thunderTimer > 0){
    thunderTimer--;
    if (Math.random() < 0.18) lightningFlash = Math.max(lightningFlash, 0.6 + Math.random()*0.7);
  }
}

/* spawn balloon */
function spawnBalloon() {
  const w = canvas.width / DPR;
  const x = 40 + Math.random() * (w - 80);
  const y = (canvas.height / DPR) + 40;
  obstacles.push(new Balloon(x, y));
}

function spawnPlatform() {
  const w = canvas.width / DPR;
  const x = 60 + Math.random() * (w - 120);
  const y = (canvas.height / DPR) + 60;
  const width = 60 + Math.random() * 50;
  const height = 60 + Math.random() * 20;
  obstacles.push(new Platform(x, y, width, height));
}


/* draw explosion particles (generic utility) */
function drawExplosions(){
  for (let i = explosionParticles.length - 1; i >= 0; i--){
    const p = explosionParticles[i];
    p.update();
    p.draw();
    if (p.age++ > p.life) explosionParticles.splice(i,1);
  }
}

/* draw + update weather particles safely */
function drawWeatherParticles(){
  if (!weatherParticles) weatherParticles = [];
  for (let i = weatherParticles.length - 1; i >= 0; i--){
    const wp = weatherParticles[i];
    wp.update();
    if (wp.drawType === 'circle' && wp.color && wp.color.startsWith('rgba') && currentLevel().weather === 'fireflies'){
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = wp.color;
      ctx.fillStyle = wp.color;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, wp.r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    } else {
      wp.draw();
    }
    if (wp.age > wp.life || wp.y > canvas.height / DPR + 200 || wp.x < -200 || wp.x > canvas.width / DPR + 200){
      weatherParticles.splice(i,1);
    }
  }
}

/* timing globals */
let lastTime = 0;
let perfNow = 0;

/* HUD update (safe) */
function updateHUD(){
  if (hudLives) {
    const full = '❤️'.repeat(Math.max(0, Math.min(3, lives)));
    const empty = '🖤'.repeat(Math.max(0, 3 - Math.max(0, Math.min(3, lives))));
    hudLives.textContent = full + empty;
  }
  if (hudSeason){
    const lvl = currentLevel();
    let seasonEmoji = '❔';
    const nameLower = (lvl && lvl.name) ? lvl.name.toLowerCase() : '';
    if (nameLower.includes('spring')) seasonEmoji = '🌸';
    else if (nameLower.includes('summer')) seasonEmoji = '☀️';
    else if (nameLower.includes('autumn') || nameLower.includes('fall')) seasonEmoji = '🍂';
    else if (nameLower.includes('winter')) seasonEmoji = '❄️';
    else if (nameLower.includes('rain')) seasonEmoji = '🌧️';
    else if (nameLower.includes('thunder') || nameLower.includes('storm')) seasonEmoji = '⚡';
    else if (nameLower.includes('calm') || nameLower.includes('night')) seasonEmoji = '✨';
    hudSeason.textContent = `${lvl.name} ${seasonEmoji}`;
    hudSeason.textContent =
      ` Level ${currentLevelIndex() + 1} ${seasonEmoji} ${lvl.name} `;
  }
}

/* background gradient + lightning */
// --- Global background image cache ---
const bgImages = {};

function getBackgroundImage(lvl) {
  if (!lvl || !lvl.bg) return null;

  // Return cached image if already loaded
  if (bgImages[lvl.bg]) return bgImages[lvl.bg];

  // Otherwise, create and start loading
  const img = new Image();
  img.src = lvl.bg;
  bgImages[lvl.bg] = img;
  return img;
}

function updateBackgroundGradient() {
  const lvl = currentLevel();

  if (typeof lvl.bg === 'string' && lvl.bg.match(/\.(jpg|jpeg|png|webp)$/i)) {
    const img = getBackgroundImage(lvl);

    // Only draw if already loaded
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, canvas.width / DPR, canvas.height / DPR);
    } else {
      // fallback color while loading
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);
    }
  } else if (Array.isArray(lvl.bg)) {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, lvl.bg[0]);
    g.addColorStop(1, lvl.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);
  }

  // ⚡ lightning overlay
  if (lightningFlash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + (lightningFlash * 0.22) + ')';
    ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);
    lightningFlash -= 0.08;
    if (lightningFlash < 0) lightningFlash = 0;
  }
}
/* ==========================
   Power-Up System
   ========================== */

// 🎁 Activate 30-second shield when gift is collected
function activatePowerup() {
  shieldActive = true;
  shieldTimer = 1800; // 30 seconds at 60 FPS
  spawnPop(player.x, player.y, '#66ccff'); // visual burst

  // 🔊 Sound feedback
  if (soundOn) {
    try {
      scoreSound.currentTime = 0;
      scoreSound.play();
    } catch (e) {}
  }

  console.log("🛡️ Shield activated for 30 seconds!");
}

// ⏱ Handle shield timer each frame
function handlePowerupTimer() {
  if (shieldActive) {
    shieldTimer--;
    if (shieldTimer <= 0) {
      shieldActive = false;
      spawnPop(player.x, player.y, '#99ccff'); // fade-out burst
      console.log("🛡️ Shield expired!");
    }
  }
}


/* main animation loop */
function animate(ts){
  if (!gameRunning || paused) return;
  animId = requestAnimationFrame(animate);
  if (!lastTime) lastTime = ts;
  const dt = (ts - lastTime) / 1000;
  lastTime = ts;
  perfNow += dt * 1000;






  updateBackgroundGradient();
  const lvl = currentLevel();

  // spawn control
  if (Math.random() < 0.02 + (score/8000)) {
  spawnBalloon();
  // add platform spawns only for higher levels
  if (currentLevelIndex() >= 8 && Math.random() < 0.44) spawnPlatform();
}
  startWindIfNeeded();
  updateWind();

  spawnWeatherParticles();
  maybeThunder();

  // update obstacles (iterate backwards)
 const speed = baseSpeed * (1 + (score / 1800)) * (lvl.id === 5 ? 1.35 : 1);

for (let i = obstacles.length - 1; i >= 0; i--) {
  const ob = obstacles[i];
  if (!ob || typeof ob.update !== "function" || typeof ob.draw !== "function") {
    console.warn("Removed broken obstacle at index", i);
    obstacles.splice(i, 1);
    continue;
  }
  ob.update(speed);
  ob.draw();



    // scoring when passing player
    if (!ob.passed && ob.y < player.y){
      ob.passed = true;
      score++;
      //if (scoreDisplay) scoreDisplay.textContent = 'Score: ' + score;
      if (soundOn) try{ scoreSound.currentTime = 0; scoreSound.play(); } catch(e) {}
      const idx = currentLevelIndex();
      if (idx !== prevLevelIndex){
        prevLevelIndex = idx;
        changeMusicForLevel(currentLevel());
      }
    }

    // collision detection (balloons + platforms)
const dx = Math.abs(player.x - ob.x);
const dy = Math.abs(player.y - ob.y);
let collision = false;
if (ob.type === 'balloon') {
  // Elliptical hitbox — better for hot-air balloon shape
  const halfW = (ob.drawWidth || 40) * 0.7;   // widen the hitbox
  const halfH = (ob.drawHeight || 60) * 0.8;  // extend vertically

  // Elliptical collision equation
  const hit = (dx * dx) / (halfW * halfW) + (dy * dy) / (halfH * halfH);
  collision = hit < 1.2; // <1 = exact edge, >1 means expanded tolerance
}

 else if (ob.type === 'platform') {
  collision = (dx < ob.width / 2 + player.radius) && (dy < ob.height / 2 + player.radius);
}

if (collision) {
  // 💥 If shield is active, absorb the hit instead of losing life
  if (shieldActive) {
    spawnPop(ob.x, ob.y, '#66ccff'); // sparkle effect on impact
    score += 5;
    spawnFloatingText(ob.x, ob.y - 20, '+5', 'gold');
    obstacles.splice(i, 1); // remove the obstacle safely


    // small visual sparkle
    for (let s = 0; s < 10; s++) {
      explosionParticles.push(new Particle({
        x: player.x + rand(-5, 5),
        y: player.y + rand(-5, 5),
        r: rand(2, 4),
        color: '#aaf',
        drawType: 'circle',
        life: 30 + Math.random() * 20
      }));
    }

    // brief flicker visual cue (shield flash)
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(player.x, player.y - 10, player.radius * 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(102, 204, 255, 0.5)';
    ctx.fill();
    ctx.restore();

  } else {
    // ❌ Normal damage logic if shield is NOT active
    spawnPop(ob.x, ob.y - (ob.size ? ob.size * 0.6 : 0), ob.color);
    obstacles.splice(i, 1);
    loseLife(ob.x, ob.y);
    continue;
  }
}

    // removal if off-screen
    if (ob.y < -120 || ob.x < -300 || ob.x > (canvas.width / DPR) + 300){
      obstacles.splice(i,1);
    }
  }

  // ground
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(0, (canvas.height / DPR) - 6, (canvas.width / DPR), 6);

  drawBirds();

 // keys (collect to change level)
for (let i = keys.length - 1; i >= 0; i--) {
  const k = keys[i];
  k.update(baseSpeed * 1.2);
  k.draw();

  const dx = Math.abs(player.x - k.x);
  const dy = Math.abs(player.y - k.y);
  if (dx < 25 && dy < 25) {
    keysCollected++;
    spawnPop(k.x, k.y, '#ffd700');
    if (soundOn) try { scoreSound.currentTime = 0; scoreSound.play(); } catch (e) {}
    keys.splice(i, 1);

    if (keysCollected >= keysNeeded) {
      nextLevel();
    }
    continue;
  }

  if (k.y < -30) keys.splice(i, 1);
}

// Spawn a new key only if none exist on screen
if (keys.length === 0 && Math.random() < 0.004) {
  const x = 40 + Math.random() * (canvas.width / DPR - 80);
  const y = (canvas.height / DPR) + 40;
  keys.push(new Key(x, y));
}

// 🎁 Update & draw gift
if (gift && !gift.collected) {
  gift.update();
  gift.draw();

  // Collision detection with player
  const dx = Math.abs(player.x - gift.x);
  const dy = Math.abs(player.y - gift.y);
  if (dx < 25 && dy < 25) {
    gift.collected = true;
    activatePowerup();
  }
}


// Spawn a new key only if none exist on screen
if (keys.length === 0 && Math.random() < 0.004) {
  const x = 40 + Math.random() * (canvas.width / DPR - 80);
  const y = (canvas.height / DPR) + 40;
  keys.push(new Key(x, y));
}

  // update + draw player
  player.update();
  player.draw();

// 🛡️ Glowing Bubble Shield Effect
if (shieldActive) {
  const elapsed = 900 - shieldTimer; // frames since activation
  const t = performance.now() / 1000;
  const pulse = Math.sin(t * 3) * 3; // subtle breathing motion
  const baseRadius = player.radius * 3.8;
  const radius = baseRadius + pulse;

  // Fade out slightly near the end of duration
  const alpha = shieldTimer < 300 ? shieldTimer / 300 : 1;

  // 🫧 Outer shimmering bubble layer
  const gradient = ctx.createRadialGradient(
    player.x, player.y, radius * 0.3,
    player.x, player.y, radius
  );
  gradient.addColorStop(0, `rgba(255,215,255,${0.25 * alpha})`);
  gradient.addColorStop(0.7, `rgba(200,200,255,${0.18 * alpha})`);
  gradient.addColorStop(1, `rgba(200,215,0,${0.2 * alpha})`);

  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'gold';
  ctx.beginPath();
  ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // 🌀 Shimmering circular spark moving around the bubble
  const sparkAngle = (t * 2) % (Math.PI * 2);
  const sparkX = player.x + Math.cos(sparkAngle) * (radius - 2);
  const sparkY = player.y + Math.sin(sparkAngle) * (radius - 2);

  const sparkleGradient = ctx.createRadialGradient(
    sparkX, sparkY, 0,
    sparkX, sparkY, 12
  );
  sparkleGradient.addColorStop(0.2, `rgba(255,215,0,0.9)`);
  sparkleGradient.addColorStop(0.3, `rgba(255,240,0,0.6)`);
  sparkleGradient.addColorStop(1, `rgba(255,215,0,0)`);

  ctx.fillStyle = sparkleGradient;
  ctx.beginPath();
  ctx.arc(sparkX, sparkY, 12, 0, Math.PI * 6);
  ctx.fill();

  ctx.restore();
}
  // draw weather + explosions
drawWeatherParticles();
drawExplosions();
handlePowerupTimer();
drawFloatingTexts();

  

// HUD
updateHUD();

// 🟢 Only show the circle HUD while game is running and not paused
if (gameRunning && !paused) {
  drawScoreCircleHUD();
}
if (gameRunning && !paused) {
  drawKeyCircleHUD();
}
if (gameRunning && !paused) {
  drawWindHUD();
}



if (levelDisplay)
  levelDisplay.textContent = 'Level: ' + (currentLevelIndex() + 1) + ' — ' + currentLevel().name;
}


// Draw score circle HUD on top-right
function drawScoreCircleHUD() {
  // 📱 Dynamic scaling based on screen width
  const baseWidth = 1920; // design reference (desktop)
  const scale = Math.min(1, window.innerWidth / baseWidth);

  // 🌀 Dynamic radius and position
  const baseRadius = 25;
  const radius = baseRadius * (0.6 + 0.3 * scale); // slightly shrink on small screens

  const x = (canvas.width / DPR) - radius - 15;
  const y = 90 * (0.7 + 0.3 * scale); // move slightly up/down depending on scale

  // 🌈 Progress
  const progress = (score % 700) / 700;
  const lvl = currentLevel();

  ctx.save();
  ctx.shadowBlur = 3 * scale;
  ctx.shadowColor = lvl.neon ? '#66f6ff' : 'rgba(255,255,255,0.3)';

  // 🔵 Outer background ring
  ctx.beginPath();
  ctx.arc(x, y, radius + 1.8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fill();

  // 🔶 Progress arc
  const gradient = ctx.createLinearGradient(x - 20, y - 20, x + 20, y + 20);
  gradient.addColorStop(0, '#00FA9A');
  gradient.addColorStop(1, '#2E8B57');
  ctx.beginPath();
  ctx.arc(x, y, radius -1  * scale, -Math.PI / 2, (Math.PI * 2 * progress) - Math.PI / 2);
  ctx.lineWidth = 8 * scale;
  ctx.strokeStyle = gradient;
  ctx.lineCap = "round";
  ctx.stroke();

  // 🌑 Inner glow
  ctx.beginPath();
  ctx.arc(x, y, radius - 5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.fill();

  // 🔢 Score text
  ctx.fillStyle = lvl.neon ? 'white' : '#cdcbcbf0';
  ctx.font = `bold ${18 * (scale*1.2)}px Arial`; // ✅ dynamic font size
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(score, x, y);

  ctx.restore();
}


// Draw Key Circle HUD below the Score HUD
function drawKeyCircleHUD() {
  // 📱 Dynamic scaling factor based on screen width
  const baseWidth = 1920; // your design width (full PC)
  const scale = Math.min(1, window.innerWidth / baseWidth); // smooth scaling

  // 🟠 Dynamic size and position
  const baseRadius = 25;
  const radius = baseRadius * (0.6 + 0.3 * scale); // shrink slightly on smaller screens
  const x = (canvas.width / DPR) - radius - 15;
  const y = 150 * (0.7 + 0.3 * scale); // adjust Y so it stays aligned on smaller devices

  const lvl = currentLevel();
  ctx.save();

  // --- Circle background
  ctx.beginPath();
  ctx.arc(x, y, radius , 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.9)";
  ctx.fill();

  // --- Glowing border
  const ring = ctx.createLinearGradient(x - 20, y - 20, x + 20, y + 20);
  ring.addColorStop(0, "darkgrey");
  ring.addColorStop(1, "#FFBF00");
  ctx.lineWidth = 8 * scale; // 🧩 dynamic border width
  ctx.strokeStyle = ring;
  ctx.beginPath();
  ctx.arc(x, y, radius + 2 * scale, 0, Math.PI * 2);
  ctx.stroke();

  // --- Key emoji
  ctx.font = `${22 * scale}px Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🗝", x - (12 * scale), y + 1);

  // --- Key count
  ctx.font = `bold ${18 * (scale*1.2)}px Arial`;
  ctx.fillStyle = lvl.neon ? "white" : "#cdcbcbf0";
  ctx.fillText(keysCollected, x + (12 * (scale*1.2)), y + 1);

  ctx.restore();
}

// 🌀 Draw Wind Rectangle HUD (Top-Right Corner) — responsive version
function drawWindHUD() {
  // 📱 Dynamic scaling based on screen width
  const baseWidth = 1920; // your reference design width
  const scale = Math.min(1, window.innerWidth / baseWidth); // never exceed 1

  // 🎯 Dynamic sizes and positioning
  const width = 150 * scale;
  const height = 52 * scale;
  const margin = 12 * scale;
  const radius = 16 * scale;
  const x = (canvas.width / DPR) - width - margin;
  const y = 15 * scale;

  ctx.save();

  // --- Rounded rectangle background
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fill();

  // --- Border glow
  const border = ctx.createLinearGradient(x, y, x + width, y + height);
  border.addColorStop(0, "#999");
  border.addColorStop(1, "#ffcc33");
  ctx.lineWidth = 4 * scale;
  ctx.strokeStyle = border;
  ctx.stroke();

  // --- Choose correct preloaded image
  let img = windImgs.calm;
  if (wind.active) img = windImgs.left;

  // --- Draw image (flip horizontally if wind blows right)
  ctx.save();
  const imgSize = 32 * (scale*1.2);
  const imgXOffset = 12 * scale;
  const imgYOffset = 7 * scale;

  if (wind.active && wind.dir < 0) {
    ctx.translate(x + (imgXOffset + imgSize / 2), y + height / 2);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
  } else {
    ctx.drawImage(img, x + imgXOffset, y + imgYOffset, imgSize, imgSize);
  }
  ctx.restore();

  // --- Draw wind intensity text
  ctx.fillStyle = "gold";
  ctx.font = `bold ${18 * (scale*1.2)}px Arial`; // ✅ dynamic font
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const windText = wind.active ? `${wind.strength.toFixed(1)}` : "Calm";
  ctx.fillText(windText, x + 80 * scale, y + height / 2);

  ctx.restore();
}

/* ---------- loseLife: decrements lives and either respawns or calls endGame ---------- */
function loseLife(x, y) {
  lives--;
  updateHUD();

  // 🔊 Play BOOM sound only if there are still lives left after losing one
  if (soundOn && lives > 0) {
    try {
      loseLifeSound.currentTime = 0;
      loseLifeSound.play();
    } catch (e) {
      console.warn('Lose-life sound error:', e);
    }
  }

  // 💀 If this was the final life, play Game Over sound instead
  if (lives <= 0) {
    if (soundOn) {
      try {
        gameOverSound.currentTime = 0;
        gameOverSound.play();
      } catch (e) {
        console.warn('Game-over sound error:', e);
      }
    }

    // Run the explosion and end-game sequence
    try {
      spawnExplosion(x, y);
    } catch (e) {}

    if (typeof endGame === 'function') {
      endGame(x, y);
    } else {
      gameRunning = false;
      if (gameOverScreen) gameOverScreen.style.display = 'block';
      if (finalScore) finalScore.textContent = 'Your Score: ' + score;
      if (backBtn) backBtn.style.display = 'none';
    }
  } else {
    // Still has lives left — respawn player and clear obstacles
    player = new Player();
    obstacles = [];
    keys = [];
  }
}
/* Level music switching */
function changeMusicForLevel(lvl){
  if (!soundOn) return;
  if (!lvl || !lvl.ambient) return;
  try {
    bgMusic.pause();
    bgMusic.src = lvl.ambient;
    bgMusic.currentTime = 0;
    bgMusic.play().catch(()=>{ /* autoplay may be blocked */ });
  } catch(e){}
}

/* Game control functions */
function resetGame(){
  score = 0;
  baseSpeed = 2.8;
  player = new Player();
  obstacles = [];
  weatherParticles = [];
  explosionParticles = [];
  wind = { active:false, dir:0, strength:0, timer:0 };
  prevLevelIndex = -1;
  lastTime = 0; perfNow = 0;
  keysCollected = 0;
  keys = [];
  currentLevelNum = 0;
  lives = 3;
  updateHUD();
  //if (scoreDisplay) scoreDisplay.textContent = 'Score: 0';
  if (levelDisplay) levelDisplay.textContent = 'Level: 1 — ' + levels[0].name;
}

function startGame(){
  if (menu) menu.style.display = 'none';
  if (gameOverScreen) gameOverScreen.style.display = 'none';
  if (menuBtn) menuBtn.style.display = 'block';
  if (hud) hud.style.display = 'flex';
  resetGame();
  gameRunning = true;
  paused = false;
  prevLevelIndex = -1;
  changeMusicForLevel(currentLevel());
  requestAnimationFrame(animate);
}

/* full endGame (visual explosion then overlay) */
function endGame(x, y) {
  gameRunning = false;
  paused = false;
  cancelAnimationFrame(animId);
  spawnExplosion(x, y);

  let frames = 0;
  let shakeTime = 880; // total frames to shake (~0.3s)
  const shakeIntensity = 10; // pixels of shake

  function showExplosionFrames() {
    frames++;

    // 🔥 Screen shake during first few frames
    if (frames < shakeTime) {
      const shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
      const shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
      ctx.save();
      ctx.translate(shakeX, shakeY);
    }

    updateBackgroundGradient();
    obstacles.forEach(o => o.draw());
    if (weatherParticles) weatherParticles.forEach(wp => wp.draw && wp.draw());
    if (player) player.draw();

    for (let i = explosionParticles.length - 1; i >= 0; i--) {
      const p = explosionParticles[i];
      p.update();
      p.draw();
    }

    // 🔁 Restore after shake translation
    if (frames < shakeTime) ctx.restore();

    if (frames < 18) {
      requestAnimationFrame(showExplosionFrames);
    } else {
      if (finalScore) finalScore.textContent = 'Your Score: ' + score;
      if (gameOverScreen) gameOverScreen.style.display = 'block';
      if (menuBtn) menuBtn.style.display = 'none';

      // 🔊 Play the explosion boom sound
      if (soundOn) {
        try {
          boomSound.currentTime = 0;
          boomSound.play();
        } catch (e) {}
      }
    }
  }

  showExplosionFrames();
}


/* Controls (keyboard + touch) */
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') player.targetVx = -player.maxSpeed;
  if (e.key === 'ArrowRight') player.targetVx = player.maxSpeed;
  if (e.key === 'ArrowUp') player.targetVy = -player.maxSpeed;
  if (e.key === 'ArrowDown') player.targetVy = player.maxSpeed;
});
document.addEventListener('keyup', e => {
  if (['ArrowLeft','ArrowRight'].includes(e.key)) player.targetVx = 0;
  if (['ArrowUp','ArrowDown'].includes(e.key)) player.targetVy = 0;
});


let dragging = false;
function pointerDown(e){
  dragging = true;
  const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
  if (player) player.x = clientX;
}
function pointerMove(e){
  if (!dragging || !player) return;
  const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
  player.x = clientX;
}
function pointerUp(){ dragging = false; }
canvas.addEventListener('mousedown', pointerDown);
canvas.addEventListener('mousemove', pointerMove);
canvas.addEventListener('mouseup', pointerUp);
canvas.addEventListener('touchstart', pointerDown, {passive:true});
canvas.addEventListener('touchmove', pointerMove, {passive:true});
canvas.addEventListener('touchend', pointerUp);

/* UI button wiring (safe) */
/* ==========================
   UI button wiring
   ========================== */
if (startBtn) startBtn.addEventListener('click', startGame);
if (restartBtn) restartBtn.addEventListener('click', startGame);
if (menuBtn) menuBtn.addEventListener('click', () => {
  gameRunning = false;
  paused = false;
  cancelAnimationFrame(animId);
  if (menu) menu.style.display = 'block';
  if (menuBtn) menuBtn.style.display = 'none';
  if (gameOverScreen) gameOverScreen.style.display = 'none';
  if (hud) hud.style.display = 'none';
  if (levelSelect) levelSelect.style.display = 'none';
  try { bgMusic.pause(); } catch (e) {}
});
// Game Over "Menu" button (menuBtnOver)
if (menuBtnOver) menuBtnOver.addEventListener('click', () => {
  gameRunning = false;
  paused = false;
  cancelAnimationFrame(animId);

  // ✅ Force-hide the Game Over tab first
  const over = document.getElementById('gameOver');
  if (over) {
    over.style.display = 'none';
    over.offsetHeight; // 👈 force reflow to apply the style immediately
  }

  // Show main menu after hiding
  if (menu) menu.style.display = 'block';

  // Hide any other UI layers
  if (hud) hud.style.display = 'none';
  if (levelSelect) levelSelect.style.display = 'none';
  if (backBtn) backBtn.style.display = 'none';

  // Pause background music safely
  try { bgMusic.pause(); } catch (e) {}
});




if (pauseBtn)
  pauseBtn.addEventListener('click', () => {
    if (!gameRunning) return;
    if (paused) resumeGame();
    else pauseGame();
  });

if (soundBtn)
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    if (soundBtn)
      soundBtn.textContent = 'Sound: ' + (soundOn ? 'ON' : 'OFF');
    if (soundOn) {
      changeMusicForLevel(currentLevel());
      bgMusic.play().catch(() => {});
    } else try { bgMusic.pause(); } catch (e) {}
  });

if (exitBtn2) exitBtn2.addEventListener('click', () => { window.close(); });

function pauseGame() {
  if (!gameRunning) return;
  paused = true;
  cancelAnimationFrame(animId);
  if (pauseBtn) pauseBtn.textContent = 'Resume';
  try { bgMusic.pause(); } catch (e) {}
}

function resumeGame() {
  if (!gameRunning) return;
  paused = false;
  if (pauseBtn) pauseBtn.textContent = 'Pause';
  if (soundOn) changeMusicForLevel(currentLevel());
  requestAnimationFrame(animate);
}

/* ==========================
   Level Select System
   ========================== */
const levelBtn = document.getElementById('levelBtn');
const levelSelect = document.getElementById('levelSelect');
const levelGrid = document.getElementById('levelGrid');
const closeLevelBtn = document.getElementById('closeLevelBtn');
if (levelSelect) levelSelect.style.display = 'none';

if (levelBtn && levelSelect && levelGrid && closeLevelBtn) {

  function buildLevelGrid() {
    levelGrid.innerHTML = '';
    levels.forEach((lvl, index) => {
      const btn = document.createElement('button');
      btn.textContent = index + 1;
      btn.title = lvl.name;
      btn.addEventListener('click', () => {
        startSelectedLevel(index);
      });
      levelGrid.appendChild(btn);
    });
  }

  levelBtn.addEventListener('click', () => {
    buildLevelGrid();
    levelSelect.style.display = 'flex';
  });

  closeLevelBtn.addEventListener('click', () => {
    levelSelect.style.display = 'none';
  });

  function startSelectedLevel(index) {
    // ✅ set the chosen level and then reset game *without overriding it*
    currentLevelNum = index;
    keysCollected = 0;
    keys = [];
    levelSelect.style.display = 'none';
    menu.style.display = 'none';
    menuBtn.style.display = 'block';
    if (hud) hud.style.display = 'flex';
    gameRunning = true;
    paused = false;
    prevLevelIndex = -1;

    // reset game but keep selected level	
    resetGame();
    currentLevelNum = index; // ensure it stays
    changeMusicForLevel(currentLevel());
    requestAnimationFrame(animate);
  }
}

/* ==========================
   Init
   ========================== */
resetGame();
if (scoreDisplay) scoreDisplay.textContent = 'Score: 0';
if (levelDisplay) levelDisplay.textContent = 'Level: 1 — ' + levels[0].name;
if (windLabel) windLabel.textContent = 'Wind: Calm';
keys = [];
keysCollected = 0;

/* allow starting with Space */
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && menu && menu.style.display !== 'none') {
    e.preventDefault();
    startGame();
  }
});
