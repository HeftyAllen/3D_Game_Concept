'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {World,MOVES,ROUTES}=require('../dist/combat.js');
const {segmentBox}=require('../dist/arsenal.js');require('../dist/physics.js');require('../dist/render.js');require('../dist/fx.js');
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const step=(w,s,fps=120)=>{for(let i=0;i<Math.ceil(s*fps);i++)w.step(1/fps);};
const fresh=(weapon=null)=>{const events=[],w=new World(e=>events.push(e),()=>.4);if(weapon)w.arsenal.stage(weapon);w.enemy.health=w.enemy.maxHealth=10000;w.yard.props=w.yard.props.filter(p=>p.heldBy);w.yard.pillars=[];w.yard.pads=[];w.hazards=false;w.yard.rebuild();events.length=0;return {w,events};};
const perform=(w,token)=>{assert.ok(w.attack(token),token);let frames=0;while((w.player.action||w.player.buffer.length||w.arsenal.bolts.length)&&frames++<600)w.step(1/120);assert.ok(frames<600);};
test('new power routes are unique, readable and all connect at multiple frame rates',()=>{
  const routes=ROUTES.filter(r=>r.id.startsWith('hybrid-'));assert.equal(routes.length,12);assert.equal(new Set(ROUTES.map(r=>r.id)).size,ROUTES.length);
  for(const fps of [30,120])for(const route of routes){const events=[],w=new World(e=>events.push(e),()=>.4);w.watch(route.id);step(w,8,fps);assert.deepEqual(events.filter(e=>e.type==='connect').map(e=>e.move),route.steps.map(id=>MOVES[id].name),route.id+' '+fps);assert.ok(events.some(e=>e.type==='route'&&e.route.id===route.id));}
});
test('all arenas place usable baton, staff and blaster pickups',()=>{
  const {w}=fresh();for(const id of Object.keys(require('../dist/arenas.js').ARENAS)){w.setArena(id);for(const type of ['baton','staff','blaster'])assert.ok(w.yard.props.some(p=>p.type===type&&!p.broken&&!p.heldBy),id+' '+type);}
});
test('baton alternates distinct hits and can mix a kick before a heavy',()=>{
  const {w,events}=fresh('baton');for(const t of ['P','P','K','H'])perform(w,t);const hits=events.filter(e=>e.type==='hit');assert.deepEqual(hits.map(e=>e.move),['Baton diagonal','Baton return','Switch roundhouse','Baton breaker']);assert.ok(w.yard.held(w.player).health>95);
});
test('staff extends melee reach and its rising vault connects into air attacks',()=>{
  const {w,events}=fresh('staff');w.enemy.z=w.player.z-2.7;perform(w,'P');assert.ok(events.some(e=>e.type==='hit'&&e.move==='Staff thrust'));w.enemy.z=w.player.z-1.5;w.player.chain='';w.attack('U');w.attack('P');w.attack('K');step(w,1.8);assert.ok(events.some(e=>e.type==='hit'&&e.move==='Staff rising vault'));assert.ok(events.some(e=>e.type==='hit'&&e.weapon&&e.air));
});
test('elastic baton and staff strikes reach beyond their ordinary attacks',()=>{
  for(const type of ['baton','staff']){const {w,events}=fresh(type);w.enemy.z=w.player.z-4.3;perform(w,'S');assert.ok(events.some(e=>e.type==='hit'&&e.elastic&&e.weapon),type);}
});
test('weapons keep physical throwing and empty-hand follow-ups',()=>{
  const {w,events}=fresh('baton');w.attack('G');step(w,1);assert.equal(w.yard.held(w.player),null);assert.ok(events.some(e=>e.type==='propThrow'));assert.ok(events.some(e=>e.type==='envHit'&&e.kind==='prop'));w.enemy.down=0;w.enemy.stunned=0;w.enemy.x=w.player.x;w.enemy.z=w.player.z-1;perform(w,'P');assert.ok(!w.player.action);assert.equal(events.filter(e=>e.type==='attack').at(-1).move,'Straight cross');
});
test('swept bolt contact catches thin volumes without reporting nearby misses',()=>{
  const box={x:0,y:1,z:0,hx:.01,hy:.5,hz:.01};assert.ok(segmentBox([-5,1,0],[5,1,0],box)>.49);assert.equal(segmentBox([-5,2,0],[5,2,0],box),null);assert.equal(segmentBox([1,1,0],[1,1,2],box),null);
});
test('firing spends one round but damage waits for travelling contact',()=>{
  for(const fps of [30,120]){const {w,events}=fresh('blaster'),gun=w.yard.held(w.player);w.attack('P');step(w,.14,fps);assert.equal(gun.ammo,5);assert.equal(w.enemy.health,10000);assert.ok(w.arsenal.bolts.length);step(w,.4,fps);assert.equal(w.enemy.health,9991);assert.equal(events.filter(e=>e.type==='hit'&&e.ranged).length,1);}
});
test('moving away from an aimed shot avoids damage and combo credit',()=>{
  const {w,events}=fresh('blaster');w.attack('P');step(w,.14);w.enemy.x=3;step(w,.8);assert.equal(w.enemy.health,10000);assert.equal(events.some(e=>e.type==='hit'),false);assert.equal(w.totalHits,0);
});
test('solid cover stops bolts, including cover between the hand and muzzle',()=>{
  for(const offset of [.45,2]){const {w,events}=fresh('blaster');const pane=w.yard.make('glass',0,w.player.z-offset);w.yard.props.push(pane);w.yard.rebuild();perform(w,'P');assert.equal(w.enemy.health,10000);assert.ok(pane.health<18);assert.ok(events.some(e=>e.type==='shotImpact'&&e.cover));}
});
test('destroying glass opens a later shot without passing the breaking shot through',()=>{
  const {w}=fresh('blaster'),pane=w.yard.make('glass',0,0);w.yard.props.push(pane);w.yard.rebuild();perform(w,'P');perform(w,'P');assert.ok(pane.broken);assert.equal(w.enemy.health,10000);perform(w,'P');assert.equal(w.enemy.health,9991);
});
test('first contact intercepts a shot rather than damaging a selected target behind it',()=>{
  const {w,events}=fresh('blaster');w.setMode('group');w.groupBehavior='passive';w.yard.props=w.yard.props.filter(p=>p.type==='blaster');const gun=w.yard.props[0];gun.x=w.player.x;gun.z=w.player.z-.5;w.yard.rebuild();w.yard.pickup(w.player,gun);w.player.x=0;w.player.z=2;w.enemies[0].x=0;w.enemies[0].z=-2;w.enemies[1].x=0;w.enemies[1].z=0;w.enemies[2].x=4;w.enemies[2].z=-3;w.face(w.player,w.enemies[0]);const hp=w.enemies[0].health;perform(w,'P');assert.equal(w.enemies[0].health,hp);assert.ok(events.some(e=>e.type==='shotImpact'&&e.target==='enemy2'));
});
test('an empty blaster neither fires nor spends charge energy',()=>{
  const {w,events}=fresh('blaster'),gun=w.yard.held(w.player);gun.ammo=0;w.infinite=false;assert.equal(w.attack('P'),false);assert.equal(w.attack('S'),false);assert.equal(w.player.windEnergy,100);assert.equal(w.arsenal.bolts.length,0);assert.equal(events.filter(e=>e.type==='gunEmpty').length,2);
});
test('reload takes animation time and refills exactly one six-round magazine',()=>{
  const {w,events}=fresh('blaster'),gun=w.yard.held(w.player);gun.ammo=1;w.attack('J');step(w,.4);assert.equal(gun.ammo,1);step(w,.6);assert.equal(gun.ammo,6);assert.equal(events.filter(e=>e.type==='gunReload').length,1);assert.equal(w.attack('J'),false);
});
test('being hit or dropping the gun interrupts reload without granting ammunition',()=>{
  for(const kind of ['hit','drop']){const {w}=fresh('blaster'),gun=w.yard.held(w.player);gun.ammo=0;w.attack('J');step(w,.3);if(kind==='hit')w.environmentHit(w.player,{source:w.enemy,damage:7,kind:'prop',dir:[1,0,0]});else w.interact();assert.equal(w.player.action,null);step(w,1);assert.equal(gun.ammo,0,kind);}
});
test('charged shots cost two rounds and wind, then physically launch a target',()=>{
  const {w,events}=fresh('blaster'),gun=w.yard.held(w.player);w.infinite=false;w.attack('S');assert.equal(w.player.windEnergy,80);step(w,.27);assert.equal(gun.ammo,4);assert.equal(w.enemy.y,0);step(w,.18);assert.ok(w.enemy.y>0&&w.enemy.vy>0);assert.ok(events.some(e=>e.type==='hit'&&e.move==='Gale-charged shot'));assert.equal(w.enemy.health,9984);
});
test('a lifting shot can chain into a kick and stretching attack',()=>{
  const {w,events}=fresh('blaster');w.enemy.z=w.player.z-1.6;w.attack('S');w.attack('K');w.attack('T');step(w,2);assert.ok(events.filter(e=>e.type==='hit').length>=3);assert.ok(events.some(e=>e.type==='hit'&&e.air&&!e.ranged));
});
test('held guard reduces shot damage and pays stamina',()=>{
  const {w,events}=fresh('blaster');w.dummy='guard';w.enemy.guard=true;w.enemy.guardAt=-10;perform(w,'P');assert.equal(w.enemy.health,9997);assert.ok(w.enemy.stamina<100);assert.ok(events.some(e=>e.type==='shotBlock'));assert.equal(events.filter(e=>e.type==='hit').length,0);
});
test('a timed parry physically reflects one bolt into its original shooter',()=>{
  const {w,events}=fresh('blaster');w.updateAI=()=>{};w.attack('P');step(w,.14);w.enemy.guard=true;w.enemy.guardAt=w.time;step(w,.6);assert.ok(events.some(e=>e.type==='shotParry'));assert.equal(w.enemy.health,10000);assert.ok(w.player.health<140);assert.equal(w.arsenal.bolts.length,0);
});
test('a dodging target can avoid a bolt without a false hit',()=>{
  const {w,events}=fresh('blaster');w.attack('P');step(w,.14);w.enemy.dodge={t:0,x:1,z:0,origin:{x:w.enemy.x,z:w.enemy.z}};step(w,.5);assert.equal(w.enemy.health,10000);assert.equal(events.filter(e=>e.type==='hit').length,0);
});
test('the player can reflect an incoming shot and its parry is counted once',()=>{
  const {w,events}=fresh('blaster'),gun=w.yard.held(w.player);w.yard.release(w.player);gun.x=w.enemy.x;gun.z=w.enemy.z+.4;w.yard.rebuild();assert.ok(w.yard.pickup(w.enemy,gun));w.updateAI=()=>{};w.start(w.enemy,w.player,'P');step(w,.14);w.setGuard(true);step(w,.5);assert.equal(w.player.health,140);assert.ok(w.enemy.health<10000);assert.equal(w.parries,1);assert.equal(events.filter(e=>e.type==='shotParry'&&e.by==='player').length,1);
});
test('one round or insufficient wind cannot produce a free charged shot',()=>{
  const {w}=fresh('blaster'),gun=w.yard.held(w.player);w.infinite=false;gun.ammo=1;assert.equal(w.attack('S'),false);assert.equal(gun.ammo,1);assert.equal(w.player.windEnergy,100);gun.ammo=6;w.player.windEnergy=19;assert.equal(w.attack('S'),false);assert.equal(gun.ammo,6);assert.equal(w.player.windEnergy,19);
});
test('the direct Tempest kick pays wind, launches with mass, and respects cover',()=>{
  const heights=[];for(const mass of [.78,1.65]){const {w}=fresh();w.infinite=false;w.enemy.mass=mass;w.attack('V');assert.equal(w.player.windEnergy,74);step(w,.4);heights.push(w.enemy.y);}assert.ok(heights[0]>heights[1]&&heights[1]>0);
  const {w}=fresh();w.player.x=0;w.player.z=2;w.enemy.x=0;w.enemy.z=-1;w.yard.pillars=[{id:'spiral-cover',x:0,y:1,z:.5,hx:.8,hy:1,hz:.2}];w.yard.rebuild();perform(w,'V');assert.equal(w.enemy.health,10000);
});
test('Easy blaster requests reload automatically and stay bounded during mashing',()=>{
  const {w,events}=fresh('blaster');w.setAssist('easy');w.yard.held(w.player).ammo=1;for(let i=0;i<1200;i++){if(i%12===0)w.attack('P');w.step(1/120);assert.ok(w.player.buffer.length<=2);}assert.ok(events.some(e=>e.type==='gunReload'));assert.ok(events.filter(e=>e.type==='gunShot').length>6);assert.ok(w.yard.held(w.player).ammo>=0);
});
test('Pulse rival starts equipped, shoots, reloads and obeys selected difficulty damage',()=>{
  for(const difficulty of ['beginner','relentless']){const events=[],w=new World(e=>events.push(e),()=>.4);w.setOpponent('gunner',difficulty);w.setMode('sparring');assert.equal(w.yard.held(w.enemy)?.type,'blaster');w.player.health=w.player.maxHealth=10000;step(w,22,60);assert.ok(events.filter(e=>e.type==='gunShot'&&e.by==='enemy').length>6);assert.ok(events.some(e=>e.type==='gunReload'&&e.by==='enemy'));assert.ok(w.player.health<10000);const shot=events.find(e=>e.type==='hurt');assert.ok(shot);assert.equal(shot.damage,difficulty==='beginner'?4:9);}
});
test('gust step cancels a connected strike, preserves its chain and accepts a queued kick',()=>{
  const {w,events}=fresh();w.attack('P');step(w,.12);assert.ok(w.player.action.connected);assert.equal(w.gustStep(1,0),true);assert.equal(w.player.chain,'P');assert.ok(w.attack('K'));assert.equal(w.player.buffer.length,1);step(w,.8);assert.ok(w.player.x>1);assert.ok(events.some(e=>e.type==='hit'&&e.move==='Snap front kick'));assert.ok(events.some(e=>e.type==='gustStep'));
});
test('gust step cannot erase startup, a miss, a grip or reload',()=>{
  const {w}=fresh();w.attack('P');assert.equal(w.gustStep(),false);w.enemy.x=5;step(w,.12);assert.equal(w.gustStep(),false);w.reset();w.beginGrip(w.player,w.enemy);assert.equal(w.gustStep(),false);const gun=fresh('blaster').w;gun.yard.held(gun.player).ammo=0;gun.attack('J');assert.equal(gun.gustStep(),false);
});
test('gust step spends finite wind/stamina, has a cooldown and respects solid walls',()=>{
  const {w}=fresh();w.infinite=false;w.player.x=5.6;w.player.z=1;assert.ok(w.gustStep(1,0));assert.equal(w.player.windEnergy,82);assert.equal(w.player.stamina,92);assert.equal(w.gustStep(1,0),false);step(w,.4);assert.ok(w.player.x<=6.08);assert.equal(w.gustStep(1,0),false);step(w,.3);w.player.windEnergy=17;assert.equal(w.gustStep(1,0),false);
});
test('reset removes active bolts, reload state and gust movement',()=>{
  const {w}=fresh('blaster');w.attack('P');step(w,.14);assert.ok(w.arsenal.bolts.length);w.gustStep(1,0);w.reset();assert.equal(w.arsenal.bolts.length,0);assert.equal(w.player.dodge,null);assert.equal(w.player.action,null);assert.equal(w.yard.props.find(p=>p.type==='blaster').ammo,6);
});
test('sprite effects are bounded, expire, pause and honor the impact toggle',()=>{
  const {w}=fresh(),calls=[],ctx=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}}),drawImage:(...args)=>calls.push(args)},{get:(o,k)=>k in o?o[k]:()=>{}}),r={world:w,ctx,detail:'full',impact:true,eye:[0,5,8],project:p=>[p[0]*20,p[1]*20]},fx=new CombatEffects.CombatFX(r);fx.atlas={};for(let i=0;i<200;i++)fx.add('hit',[0,1,0]);assert.equal(fx.items.length,64);fx.frame(0);assert.equal(fx.items.length,64);assert.equal(calls.length,64);assert.ok(calls.every(a=>a.slice(1).every(Number.isFinite)));r.impact=false;fx.frame(.1);assert.equal(calls.length,64);fx.frame(1);assert.equal(fx.items.length,0);fx.notify({type:'reset'});assert.equal(fx.items.length,0);
});
test('sprite atlas and modules ship in dependency order with valid page controls',()=>{
  const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8');assert.ok(html.indexOf('arsenal.js')<html.indexOf('combat.js'));assert.ok(html.indexOf('fx.js')<html.indexOf('render.js'));assert.ok(fs.readFileSync(require.resolve('../dist/combat-sprites.svg'),'utf8').includes('width="1024"'));for(const id of ['gun-reload','gust-step','weapon-status'])assert.ok(html.includes('id="'+id+'"'));
});
test('new weapons and power rigs remain finite across attacks, reloads, air and drops',()=>{
  const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>({})},{get:(o,k)=>k in o?o[k]:k.toUpperCase()===k?1:()=>({})}),ctx=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}})},{get:(o,k)=>k in o?o[k]:()=>{}});let frames=0;
  for(const type of ['baton','staff','blaster'])for(const detail of ['full','lean']){const {w,events}=fresh(type),r=new CombatRenderer.Renderer({getContext:()=>gl,getBoundingClientRect:()=>({width:760,height:460})},{getContext:()=>ctx},w);r.setDetail(detail);const handler=w.onEvent;w.onEvent=e=>{handler(e);r.notify(e);};r.draw=(kind,m,color,alpha,glow,deform)=>{assert.ok([...m,...color].every(Number.isFinite));if(deform?.curve)assert.ok(deform.curve.flat().every(Number.isFinite));};
    for(let i=0;i<420;i++){if(i%30===0)w.attack(['P','P','K','U','S','H','J'][Math.floor(i/30)%7]);w.step(1/60);r.frame(1/60);frames++;for(const rig of Object.values(r.rigs))assert.ok(Object.values(rig.pts).flat().every(Number.isFinite));assert.ok(r.fx.items.length<=64);}
    assert.ok(events.some(e=>e.type==='hit'));
  }console.log('  '+frames+' weapon animation frames');
});
console.log('\n'+checks+' arsenal, power-flow and effect checks passed. Browser/GPU QA is not covered.');
