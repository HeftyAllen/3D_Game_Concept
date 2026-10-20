'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {World, ROUTES, MOVES} = require('../dist/combat.js');
const advance = (w, seconds, fps = 120) => { for(let i=0;i<Math.ceil(seconds*fps);i++)w.step(1/fps); };
const fresh = () => { const events=[];return {events,w:new World(e=>events.push(e),()=>.4)}; };
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
check('every authored combo connects at 30, 60 and 120 fps',()=>{
  for(const fps of [30,60,120])for(const r of ROUTES){
    const {w,events}=fresh();w.watch(r.id);let finishedAt=null;for(let frame=0;frame<12*fps;frame++){w.step(1/fps);if(!w.demo&&!w.player.action){finishedAt??=w.time;if(w.time-finishedAt>.55)break;}else finishedAt=null;}
    const connections=events.filter(e=>e.type==='connect');
    assert.deepEqual(connections.map(h=>h.move),r.steps.map(id=>MOVES[id].name),r.id+' at '+fps+' fps');
    assert.ok(events.some(e=>e.type==='route'&&e.route.id===r.id),r.id);
    assert.equal(events.filter(e=>e.type==='whiff').length,0,r.id);
  }
});
check('two rapid buffered inputs produce a real three-hit string',()=>{
  const {w,events}=fresh();w.attack('P');advance(w,.04);w.attack('P');advance(w,.04);w.attack('P');advance(w,1);
  assert.deepEqual(events.filter(e=>e.type==='hit').map(h=>h.move),['Lead jab','Straight cross','Lead hook']);
});
check('missed openers cannot falsely complete a combo',()=>{
  const {w,events}=fresh();w.enemy.z=-5;w.attack('P');advance(w,.35);w.enemy.x=w.player.x;w.enemy.z=w.player.z-1.1;w.attack('P');advance(w,.35);w.attack('P');advance(w,.7);
  assert.ok(events.some(e=>e.type==='whiff'));assert.equal(events.some(e=>e.type==='route'),false);
});
check('four follow-ups queue honestly and the fifth reports a full buffer',()=>{
  const {w,events}=fresh();assert.ok(w.attack('P'));for(let i=0;i<4;i++)assert.ok(w.attack('P'));
  assert.equal(w.attack('K'),false);assert.equal(w.player.buffer.length,4);assert.ok(events.some(e=>e.type==='bufferFull'));
  advance(w,2);assert.deepEqual(events.filter(e=>e.type==='hit').map(e=>e.move),['Lead jab','Straight cross','Lead hook','Rapid straight','Shovel hook']);
});
check('an input during hit recovery executes when control returns',()=>{
  const {w,events}=fresh();w.start(w.enemy,w.player,'P');advance(w,.15);assert.ok(w.player.stunned>0);
  assert.ok(w.attack('K'));advance(w,1);assert.ok(events.some(e=>e.type==='attack'&&e.token==='K'));assert.equal(w.player.buffer.length,0);
});
check('unlisted mixed inputs keep using contextual follow-ups',()=>{
  const {w,events}=fresh();w.enemy.health=w.enemy.maxHealth=1000;const sequence='PPPPPPKSTPUKSPTRPK';let index=0;
  for(let frame=0;frame<2400;frame++){
    if(index<sequence.length&&(!w.player.action||w.player.action.t>=w.player.action.move.cancel)&&w.player.buffer.length<2){assert.ok(w.attack(sequence[index++]));}
    w.step(1/120);
  }
  assert.equal(index,sequence.length);assert.equal(events.filter(e=>e.type==='whiff').length,0);
  assert.equal(events.filter(e=>e.type==='connect').length,sequence.length);
});
check('aerial reel descends continuously into a standing clinch',()=>{
  const {w}=fresh();w.attack('U');advance(w,.38);assert.ok(w.enemy.y>.3);w.attack('R');advance(w,.26);
  assert.ok(w.tether?.air);const height=w.enemy.y;advance(w,.10);assert.ok(w.enemy.y<height&&w.enemy.y>0);
  advance(w,.4);assert.equal(w.tether,null);assert.equal(w.grapple.phase,'clinch');assert.equal(w.player.y,0);assert.equal(w.enemy.y,0);
});
check('clinch shove releases both bodies and continues into standing strikes',()=>{
  const {w,events}=fresh();w.watch('flow-shove-to-boxing');advance(w,8);
  assert.ok(events.some(e=>e.type==='release'&&e.reason==='shove'));assert.equal(w.enemy.held,false);
  assert.ok(events.some(e=>e.type==='route'&&e.route.id==='flow-shove-to-boxing'));
});
check('impact drill knocks down the player and resets a practice defeat',()=>{
  const {w,events}=fresh();w.dummy='active';w.player.health=10;advance(w,6);
  assert.ok(events.some(e=>e.type==='defeat'));assert.ok(events.some(e=>e.type==='ready'));assert.equal(w.over,false);
});
check('perfect parry negates damage and enables a heavy counter',()=>{
  const {w,events}=fresh();w.start(w.enemy,w.player,'H');advance(w,.14);w.setGuard(true);advance(w,.16);
  assert.equal(w.player.health,140);assert.ok(events.some(e=>e.type==='parry'));assert.ok(w.enemy.stunned>.3);
  w.attack('H');advance(w,.25);assert.ok(events.some(e=>e.type==='hit'&&e.move==='Parry counter'));
});
check('held guard blocks damage and spends stamina',()=>{
  const {w,events}=fresh();w.setGuard(true);advance(w,.4);w.start(w.enemy,w.player,'P');advance(w,.25);
  assert.equal(w.player.health,140);assert.ok(w.player.stamina<100);assert.ok(events.some(e=>e.type==='block'));
});
check('heavy finish breaks guard and blocked steps are not scored',()=>{
  const {w,events}=fresh();w.dummy='guard';advance(w,.2);w.attack('P');advance(w,.33);w.attack('P');advance(w,.35);w.attack('H');advance(w,.65);
  assert.ok(events.some(e=>e.type==='guardBreak'));assert.equal(w.enemy.health,w.enemy.maxHealth-22);assert.equal(events.some(e=>e.type==='route'),false);
});
check('clinch bypasses guard and throw knocks down',()=>{
  const {w}=fresh();w.dummy='guard';advance(w,.2);w.attack('G');advance(w,.45);w.attack('G');advance(w,.9);
  assert.equal(w.enemy.health,w.enemy.maxHealth-33);assert.ok(w.enemy.down>0);
});
check('dodging a threatening strike creates a counter opening',()=>{
  const {w,events}=fresh();w.start(w.enemy,w.player,'H');w.dodge();advance(w,.32);
  assert.equal(w.player.health,140);assert.ok(events.some(e=>e.type==='evade'));assert.ok(w.player.counterUntil>w.time);
});
check('sparring has an active opponent and enforces stamina',()=>{
  const {w,events}=fresh();w.setMode('sparring');w.player.stamina=2;assert.equal(w.attack('H'),false);
  advance(w,1.65);assert.ok(w.player.stamina>2);assert.ok(events.some(e=>e.type==='enemyAttack'));assert.ok(w.player.health<140);
});
check('training knockouts automatically reset the opponent',()=>{
  const {w,events}=fresh();w.enemy.health=5;w.attack('P');advance(w,2.7);
  assert.ok(events.some(e=>e.type==='ko'));assert.ok(!w.enemy.ko);assert.equal(w.enemy.health,w.enemy.maxHealth);
});
check('player defeat and arena reset restore the playable state',()=>{
  const {w,events}=fresh();w.player.health=5;w.start(w.enemy,w.player,'P');advance(w,.3);
  assert.ok(w.over);assert.ok(events.some(e=>e.type==='defeat'));w.reset();assert.ok(!w.over);assert.equal(w.player.health,w.player.maxHealth);
});
check('long sparring simulation keeps positions and health finite',()=>{
  const w=new World(()=>{},()=>.4);w.setMode('sparring');
  for(let i=0;i<7200;i++){if(i%25===0)w.attack(i%50?'K':'P');if(i%80===0)w.dodge(1,0);if(w.over)w.reset();w.step(1/120);
    for(const f of [w.player,w.enemy]){assert.ok([f.x,f.y,f.z,f.health,f.stamina].every(Number.isFinite));assert.ok(f.y>=0);assert.ok(f.health>=0);assert.ok(f.stamina>=0&&f.stamina<=100);}
  }
});
check('clinch maintains its connection while the owner moves',()=>{
  const {w}=fresh();w.attack('G');advance(w,.6);assert.ok(w.enemy.held);assert.equal(w.grapple.phase,'clinch');
  const x=w.player.x;w.input={x:1,z:0};advance(w,1);assert.ok(w.player.x>x+.5);
  assert.ok(Math.hypot(w.enemy.x-w.player.x,w.enemy.z-w.player.z)<.9);assert.equal(w.enemy.action,null);
  w.dodge(1,0);assert.equal(w.grapple,null);assert.equal(w.enemy.held,false);
});
check('grip switches open actual body-lock and rear-control moves',()=>{
  const {w,events}=fresh();w.attack('G');advance(w,.5);w.attack('C');advance(w,.5);assert.equal(w.grapple.grip,'bodylock');
  w.attack('C');advance(w,.55);assert.equal(w.grapple.grip,'rear');w.attack('U');advance(w,.7);
  assert.equal(w.player.action.id,'germansuplex');assert.ok(w.enemy.visual.pitch<-.4);
  assert.equal(events.some(e=>e.type==='throwImpact'),false);advance(w,.65);assert.ok(events.some(e=>e.type==='throwImpact'));
});
check('throw damage waits for landing and releases the held opponent',()=>{
  const {w,events}=fresh();w.attack('G');advance(w,.45);const health=w.enemy.health;w.attack('G');advance(w,.55);
  assert.equal(w.enemy.health,health);assert.equal(w.grapple.phase,'throw');assert.ok(w.enemy.held);
  advance(w,.6);assert.equal(w.enemy.health,health-30);assert.equal(w.enemy.held,false);assert.ok(w.ground);
  assert.equal(events.filter(e=>e.type==='throwImpact').length,1);
});
check('early buffered attacks survive a long throw and hit on the floor',()=>{
  const {w,events}=fresh();w.attack('G');advance(w,.03);w.attack('G');advance(w,.03);w.attack('P');advance(w,1.8);
  assert.deepEqual(events.filter(e=>e.type==='hit').map(e=>e.move),['Clinch entry','Hip throw','Ground straight']);
});
check('a missed grab creates no phantom grip or throw',()=>{
  const {w,events}=fresh();w.enemy.z=-5;w.attack('G');advance(w,.45);assert.equal(w.grapple,null);assert.equal(w.enemy.held,false);
  w.attack('G');advance(w,1.4);assert.equal(events.some(e=>e.type==='throwStart'),false);assert.equal(w.enemy.health,w.enemy.maxHealth);
});
check('wrestling permits floor follow-ups, pickup and a second throw',()=>{
  const {w,events}=fresh();w.watch('regrip-throw');advance(w,7);
  assert.equal(events.filter(e=>e.type==='throwImpact').length,2);assert.ok(events.some(e=>e.type==='connect'&&e.move==='Stand-up clinch'));
});
check('mount has working follow-ups and can be released',()=>{
  const {w,events}=fresh();w.watch('slam-mount');advance(w,5);
  assert.ok(events.some(e=>e.type==='ground'&&e.mounted));assert.ok(events.some(e=>e.type==='hit'&&e.move==='Ground hammer fist'));
  w.dodge(1,0);assert.equal(w.ground,null);assert.equal(w.enemy.held,false);
});
check('sparring opponent escapes an idle grip and can re-engage',()=>{
  const {w,events}=fresh();w.setMode('sparring');w.attack('G');advance(w,5.5);
  assert.ok(events.some(e=>e.type==='gripEscape'));assert.equal(w.grapple,null);assert.equal(w.enemy.held,false);assert.ok(events.some(e=>e.type==='enemyAttack'));
});
check('an idle grounded opponent recovers instead of remaining stuck',()=>{
  const {w}=fresh();w.watch('hip-throw');advance(w,5);assert.equal(w.enemy.down,0);assert.equal(w.enemy.visual,null);assert.equal(w.enemy.held,false);
});
check('elastic punch hits from beyond ordinary punch range',()=>{
  const {w,events}=fresh();w.enemy.x=w.player.x;w.enemy.z=w.player.z-4;
  w.attack('P');advance(w,.4);assert.equal(w.enemy.health,w.enemy.maxHealth);
  w.attack('S');advance(w,.65);assert.ok(events.some(e=>e.type==='hit'&&e.move==='Elastic straight'));
});
check('reel-in moves gradually into a real connected clinch',()=>{
  const {w}=fresh();w.enemy.x=w.player.x;w.enemy.z=w.player.z-4;w.attack('R');advance(w,.30);
  assert.ok(w.tether);const d0=Math.hypot(w.enemy.x-w.player.x,w.enemy.z-w.player.z);
  assert.ok(d0>2);advance(w,.20);const d1=Math.hypot(w.enemy.x-w.player.x,w.enemy.z-w.player.z);
  assert.ok(d1<d0&&d1>.74);advance(w,.30);assert.equal(w.tether,null);assert.equal(w.grapple.phase,'clinch');assert.ok(w.enemy.held);
});
check('out-of-range reel-in creates no tether or phantom grab',()=>{
  const {w}=fresh();w.enemy.x=w.player.x;w.enemy.z=w.player.z-6;w.attack('R');advance(w,.9);
  assert.equal(w.tether,null);assert.equal(w.grapple,null);assert.equal(w.enemy.held,false);assert.equal(w.enemy.health,w.enemy.maxHealth);
});
check('reel-in can be cancelled without leaving the target held',()=>{
  const {w}=fresh();w.enemy.x=w.player.x;w.enemy.z=w.player.z-4;w.attack('R');advance(w,.30);w.dodge(1,0);
  assert.equal(w.tether,null);assert.equal(w.enemy.held,false);
});
check('stretch controls are valid in every grip and on the floor',()=>{
  for(const token of ['S','T','R'])for(const grip of ['front','bodylock','rear']){
    const {w}=fresh();w.beginGrip(w.player,w.enemy,grip);assert.ok(w.attack(token));advance(w,2);
    assert.ok([w.player.x,w.player.y,w.enemy.x,w.enemy.y].every(Number.isFinite));
  }
});
check('lift paths have continuous speed across intermediate poses',()=>{
  const {PAIRS,pairSample}=require('../dist/combat.js'),epsilon=.00001;
  for(const [kind,frames] of Object.entries(PAIRS))for(const node of frames.slice(1,-1)){
    const before=pairSample(kind,node[0]-epsilon),at=pairSample(kind,node[0]),after=pairSample(kind,node[0]+epsilon);
    for(const index of [1,2,3,4,6,7,8,9]){const left=(at[index]-before[index])/epsilon,right=(after[index]-at[index])/epsilon;assert.ok(Math.abs(left-right)<.04,kind+' velocity discontinuity');}
  }
});
check('HTML ids and static asset references are valid',()=>{
  const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
  for(const m of html.matchAll(/(?:src|href)="(\w+\.(?:js|css))(?:\?[^\"]*)?"/g))assert.ok(fs.existsSync(__dirname+'/../dist/'+m[1]));
});
console.log('\n'+passed+' checks passed. Browser visual QA is not covered by this suite.');
