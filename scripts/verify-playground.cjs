'use strict';
const assert=require('node:assert/strict');
const {World,ROUTES}=require('../dist/combat.js');
const {ARENAS,TYPES,sphere}=require('../dist/yard.js');
const {STYLES}=require('../dist/opponent.js');
require('../dist/physics.js');require('../dist/render.js');
const fresh=(random=()=>.4)=>{const events=[],w=new World(e=>events.push(e),random);return {w,events};};
const step=(w,seconds,fps=120)=>{for(let i=0;i<Math.ceil(seconds*fps);i++)w.step(1/fps);};
const bare=w=>{w.yard.props=[];w.yard.pads=[];w.yard.rebuild();};
let checks=0;const test=(name,fn)=>{if(process.argv.includes('--routes-only')&&!name.startsWith('all authored routes'))return;fn();checks++;console.log('PASS '+name);};
test('all arenas provide declared props, clear spawns, and their configured training equipment',()=>{
  const signatures=new Set();for(const id of Object.keys(ARENAS)){const {w}=fresh();assert.ok(w.setArena(id));assert.equal(w.arenaId,id);assert.equal(w.yard.pads.length,ARENAS[id].pads.length);assert.ok(w.yard.props.length>=12);assert.equal(w.yard.props.filter(p=>p.anchored).length,ARENAS[id].bags.length);for(const [type,x,z]of ARENAS[id].props)assert.ok(w.yard.props.some(p=>p.type===type&&p.x===x&&p.z===z));signatures.add(w.yard.props.map(p=>p.type+':'+p.x+':'+p.z).join('|'));
    for(const f of [w.player,w.enemy])for(const c of w.yard.solids)assert.equal(sphere([f.x,.55,f.z],.34,c),null,'clear spawn in '+id);
  }assert.equal(signatures.size,Object.keys(ARENAS).length);
});
test('arena and opponent preferences survive round reset and invalid settings do nothing',()=>{
  const {w}=fresh();w.setArena('rooftop');w.setOpponent('elastic','relaxed');w.hazards=false;w.practiceSpeed=.5;w.setMode('sparring');w.reset(true);
  assert.equal(w.arenaId,'rooftop');assert.equal(w.opponentStyle,'elastic');assert.equal(w.difficulty,'relaxed');assert.equal(w.hazards,false);assert.equal(w.practiceSpeed,.5);assert.equal(w.setArena('missing'),false);assert.equal(w.setOpponent('missing'),false);assert.equal(w.arenaId,'rooftop');
});
test('slow motion scales practice simulation while sparring keeps normal speed',()=>{
  const {w}=fresh();w.practiceSpeed=.5;const at=w.time;step(w,1);assert.ok(Math.abs(w.time-at-.5)<1e-8);w.setMode('sparring');const sparAt=w.time;step(w,.4);assert.ok(Math.abs(w.time-sparAt-.4)<1e-8);
});
test('all four new practice setups remain playable and restore the courtyard',()=>{
  for(const kind of ['spring','divider','bag','balloon']){const {w}=fresh();w.setArena('depot');w.yard.stage(kind);assert.equal(w.arenaId,'courtyard');assert.equal(w.mode,'practice');assert.equal(w.dummy,'passive');assert.ok(w.player.health>0&&w.enemy.health>0);}
});
test('walking onto a pad launches the player and can flow into an aerial attack',()=>{
  const {w,events}=fresh();w.yard.stage('spring');w.input.z=1;step(w,.35);w.input.z=0;assert.ok(events.some(e=>e.type==='springLaunch'&&e.by==='player'));assert.ok(w.player.y>.05);w.attack('S');step(w,.7);assert.ok(events.some(e=>e.type==='attack'&&/air|aerial/i.test(e.move)));
});
test('a pad launches a loose object and respects its mass',()=>{
  const peaks=[];for(const type of ['chair','barrel']){const {w}=fresh(),pad=w.yard.pads[0];w.player.x=0;w.player.z=0;w.enemy.x=1;w.enemy.z=0;const p=w.yard.make(type,pad.x,pad.z);w.yard.props=[p];w.yard.rebuild();step(w,.2);assert.ok(p.y>p.hy+.4);peaks.push(p.vy);}assert.ok(peaks[0]>peaks[1]);
});
test('spring pads also launch the inflated body without breaking balloon control',()=>{
  const {w,events}=fresh();bare(w);w.balloon.toggle();step(w,.5);const f=w.player;w.yard.pads=[{id:'test',x:f.x,z:f.z,radius:.66,flash:0,last:{}}];step(w,.15);assert.ok(f.balloon);assert.ok(f.y>.5);assert.ok(events.some(e=>e.type==='springLaunch'&&e.by==='player'));
});
test('disabled pads cannot launch a body or object',()=>{const {w,events}=fresh(),pad=w.yard.pads[0];w.hazards=false;w.player.x=pad.x;w.player.z=pad.z;const p=w.yard.make('crate',pad.x,pad.z);w.yard.props=[p];w.yard.rebuild();step(w,.5);assert.equal(w.player.y,0);assert.equal(events.some(e=>e.type==='springLaunch'||e.type==='springProp'),false);});
test('spring-launched cargo damages bodies on contact without inventing an attacker',()=>{
  const {w,events}=fresh();bare(w);w.player.x=3;w.player.z=3;w.enemy.x=.75;w.enemy.z=0;w.yard.pads=[{id:'test',x:0,z:0,radius:.66,flash:0,last:{}}];const crate=w.yard.make('crate',0,0);w.yard.props=[crate];w.yard.rebuild();step(w,1);const hit=events.find(e=>e.type==='envHit'&&e.target==='enemy');assert.ok(hit);assert.equal(hit.kind,'prop');assert.equal(hit.by,undefined);assert.ok(w.enemy.health<320);assert.equal(w.totalHits,0);
});
test('a clinched pair stays connected over a pad and launches only after release',()=>{
  const {w,events}=fresh(),pad=w.yard.pads[0];w.player.x=pad.x;w.player.z=pad.z;w.enemy.x=pad.x;w.enemy.z=pad.z-.74;w.face(w.player,w.enemy);w.beginGrip(w.player,w.enemy);step(w,.4);assert.ok(w.grapple);assert.equal(events.some(e=>e.type==='springLaunch'),false);w.releaseGrip();step(w,.1);assert.ok(events.some(e=>e.type==='springLaunch'&&e.by==='player'));
});
test('a spring releases grounded control into an airborne body',()=>{
  const {w}=fresh(),pad=w.yard.pads[0],p=w.player,e=w.enemy;e.x=pad.x;e.z=pad.z;e.down=1;e.visual={height:.24,pitch:1.5,role:'grounded'};w.ground={owner:p,target:e,until:w.time+2,mounted:false,pitch:1.5,yaw:0};step(w,.1);assert.equal(w.ground,null);assert.equal(e.visual,null);assert.ok(e.y>.15);assert.ok(e.tumbling);
});
test('swing bags preserve rope length, swing from impact, and lose energy',()=>{
  const {w}=fresh(),bag=w.yard.props.find(p=>p.anchored);w.yard.damage(bag,20,w.player,{x:4,y:1,z:4});let extent=0,late=0;
  for(let i=0;i<960;i++){w.step(1/120);const d=Math.hypot(bag.x-bag.anchor[0],bag.y-bag.anchor[1],bag.z-bag.anchor[2]);assert.ok(Math.abs(d-bag.rope)<1e-6);extent=Math.max(extent,Math.hypot(bag.x-bag.anchor[0],bag.z-bag.anchor[2]));if(i>840)late=Math.max(late,Math.hypot(bag.vx,bag.vy,bag.vz));}assert.ok(extent>.4);assert.ok(late<3);
});
test('anchored bags cannot be picked up or stretch-equipped',()=>{const {w}=fresh(),bag=w.yard.props.find(p=>p.anchored);w.player.x=bag.x;w.player.z=bag.z+.6;assert.equal(w.yard.pickup(w.player,bag),false);assert.equal(w.yard.pickup(w.player,bag,true),false);assert.notEqual(w.yard.candidate(w.player,5.9),bag);});
test('the bag challenge damages the partner through physical bag contact',()=>{
  const {w,events}=fresh();w.yard.stage('bag');w.attack('S');w.attack('S');w.attack('H');step(w,4);const impacts=events.filter(e=>e.type==='envHit'&&e.propType==='bag'&&e.target==='enemy');assert.ok(impacts.length>=1);assert.ok(impacts.every(e=>e.damage<=28&&e.by==='player'));assert.ok(w.enemy.health<320);
});
test('wood dividers break under pressure and create a new clear path',()=>{
  const {w,events}=fresh();w.yard.stage('divider');const barrier=w.yard.props.find(p=>p.type==='divider');const before=w.yard.solids.length;w.attack('H');w.attack('K');step(w,1.5);assert.ok(barrier.broken);assert.ok(events.some(e=>e.type==='propBreak'&&e.propType==='divider'&&e.by==='player'));assert.ok(w.yard.solids.length<before);assert.ok(w.yard.props.some(p=>p.type==='debris'));
});
test('a knocked body breaks a fixed divider with attributed bonus damage',()=>{
  const {w,events}=fresh();bare(w);const barrier=w.yard.make('divider',0,-1.8);w.yard.props=[barrier];w.yard.rebuild();const e=w.enemy;e.x=0;e.z=-.7;e.vz=-12;e.down=1.2;e.tumbling=true;e.lastAttacker=w.player;e.lastHitAt=w.time;step(w,.45);assert.ok(barrier.broken);assert.ok(events.some(e=>e.type==='envHit'&&e.kind==='barrier'&&e.by==='player'));
});
test('balloon bursts can smash both benches and dividers',()=>{
  for(const type of ['bench','divider']){const {w}=fresh();bare(w);w.enemy.x=4;w.enemy.z=-4;w.player.x=-1.8;w.player.z=0;w.balloon.toggle();step(w,.5);const prop=w.yard.make(type,0,0);w.yard.props=[prop];w.yard.rebuild();w.input.x=1;w.balloon.command(w.player,'P');step(w,.3);assert.ok(prop.broken,type);}
});
test('tyres bounce more than wooden crates and props settle without invalid state',()=>{
  const bounces=[];for(const type of ['tyre','crate']){const {w}=fresh();bare(w);const p=w.yard.make(type,0,0,0,{y:2,sleep:false});w.yard.props=[p];w.yard.rebuild();let bounce=0;for(let i=0;i<360;i++){w.step(1/120);bounce=Math.max(bounce,p.vy);assert.ok([p.x,p.y,p.z,p.vx,p.vy,p.vz].every(Number.isFinite));}bounces.push(bounce);}assert.ok(bounces[0]>bounces[1]*1.6);
});
test('expired debris is removed rather than accumulating forever',()=>{const {w}=fresh();const p=w.yard.make('crate',0,3);w.yard.props.push(p);w.yard.damage(p,50,w.player);assert.ok(w.yard.props.some(p=>p.type==='debris'));step(w,11);assert.equal(w.yard.props.some(p=>p.type==='debris'),false);});
test('footwork practice circles without attacking or damaging the player',()=>{
  const {w,events}=fresh();w.dummy='footwork';const before={x:w.enemy.x,z:w.enemy.z};step(w,2);assert.ok(Math.hypot(w.enemy.x-before.x,w.enemy.z-before.z)>.7);assert.equal(w.player.health,140);assert.equal(events.some(e=>e.type==='enemyAttack'),false);assert.ok(Math.abs(w.enemy.motion.x)>.2);
});
test('boxer and elastic footwork maintain different useful distances',()=>{
  const distances=[];for(const style of ['boxer','elastic']){const {w}=fresh();w.opponentStyle=style;w.dummy='footwork';step(w,3);distances.push(Math.hypot(w.enemy.x-w.player.x,w.enemy.z-w.player.z));}assert.ok(distances[0]<2.2);assert.ok(distances[1]>2.8);assert.ok(distances[1]-distances[0]>1);
});
test('tired opponents retreat and recover instead of attacking with empty stamina',()=>{
  const {w,events}=fresh();w.setMode('sparring');w.enemy.stamina=10;w.enemy.regenAt=w.time+1;const d=Math.hypot(w.enemy.x-w.player.x,w.enemy.z-w.player.z);step(w,.5);assert.equal(w.enemy.intent,'catching breath');assert.ok(Math.hypot(w.enemy.x-w.player.x,w.enemy.z-w.player.z)>d);assert.equal(events.some(e=>e.type==='enemyAttack'),false);
});
test('all partner styles execute their own live combat plans with finite stamina',()=>{
  const moves={};for(const style of Object.keys(STYLES)){const {w,events}=fresh();w.opponentStyle=style;w.setMode('sparring');w.player.health=w.player.maxHealth=10000;step(w,16,60);moves[style]=events.filter(e=>e.type==='enemyAttack').map(e=>e.move);assert.ok(moves[style].length>=5,style);assert.ok(w.enemy.stamina>=0&&w.enemy.stamina<=100);assert.ok(w.player.health<10000,style+' deals contact damage');}
  assert.ok(moves.wrestler.some(n=>/suplex|throw|slam/i.test(n)));assert.ok(moves.kicker.some(n=>/kick|roundhouse/i.test(n)));assert.ok(moves.elastic.some(n=>/elastic|reel|whip/i.test(n)));assert.ok(moves.boxer.some(n=>/hook|cross|jab/i.test(n)));assert.ok(moves.scavenger.some(n=>/Picking up/i.test(n)));
});
test('the scavenger equips and releases actual objects, with attributed projectile hits',()=>{
  const {w,events}=fresh();w.opponentStyle='scavenger';w.setMode('sparring');w.player.health=10000;step(w,20,60);assert.ok(w.opponent.stats.pickups>0);assert.ok(w.opponent.stats.throws>0);assert.ok(events.some(e=>e.type==='propPickup'&&e.by==='enemy'));assert.ok(events.some(e=>e.type==='propThrow'&&e.by==='enemy'));assert.ok(events.some(e=>e.type==='envHit'&&e.by==='enemy'&&e.kind==='prop'));
});
test('defensive sidesteps wait for the visible wind-up and spend stamina',()=>{
  const {w,events}=fresh(()=>.1);w.dummy='footwork';w.difficulty='relentless';w.attack('S');step(w,.1);assert.equal(events.some(e=>e.type==='opponentStep'),false);step(w,.09);assert.ok(events.some(e=>e.type==='opponentStep'));assert.ok(w.enemy.stamina<90);assert.equal(w.enemy.health,320);
});
test('fast jabs can hit before a standard opponent reacts',()=>{const {w,events}=fresh(()=>.1);w.dummy='footwork';w.attack('P');step(w,.15);assert.ok(events.some(e=>e.type==='hit'));assert.equal(events.some(e=>e.type==='opponentStep'),false);});
test('an opponent can read and sidestep an approaching balloon burst',()=>{
  const {w,events}=fresh(()=>.1);w.yard.stage('balloon');w.dummy='footwork';w.difficulty='relentless';w.balloon.toggle();step(w,.5);w.attack('P');step(w,.2);assert.ok(events.some(e=>e.type==='opponentStep'));assert.ok(w.opponent.stats.sidesteps>=1);
});
test('the player can spend stamina resisting a clinch before a throw starts',()=>{
  const {w,events}=fresh();w.infinite=false;w.beginGrip(w.enemy,w.player);assert.ok(w.dodge());assert.equal(w.dodge(),false);step(w,.3);assert.ok(w.dodge());step(w,.3);assert.ok(w.dodge());assert.equal(w.grapple,null);assert.equal(w.player.held,false);assert.equal(w.player.stamina,46);assert.ok(events.some(e=>e.type==='playerEscape'));
});
test('escape cannot cancel a committed throw or spend unavailable stamina',()=>{
  const {w}=fresh();w.infinite=false;w.beginGrip(w.enemy,w.player);w.player.stamina=1;assert.equal(w.dodge(),false);w.player.stamina=100;w.start(w.enemy,w.player,'G');assert.equal(w.grapple.phase,'throw');assert.equal(w.dodge(),false);assert.equal(w.player.stamina,100);
});
test('resisting an enemy reel releases both references safely',()=>{const {w}=fresh();w.infinite=false;w.beginTether(w.enemy,w.player);assert.ok(w.dodge());assert.equal(w.tether,null);assert.equal(w.player.held,false);assert.equal(w.enemy.action,null);assert.equal(w.player.stamina,82);});
test('environmental interruptions cancel paired actions and allow a fresh fight',()=>{
  const {w}=fresh();w.beginGrip(w.enemy,w.player);w.start(w.enemy,w.player,'G');assert.ok(w.enemy.action.move.throwType);w.environmentHit(w.player,{source:w.enemy,damage:10,kind:'prop',dir:[1,0,0],speed:7});assert.equal(w.grapple,null);assert.equal(w.enemy.action,null);assert.equal(w.player.held,false);step(w,2);assert.ok(w.player.health>0);assert.ok(w.attack('P'));
});
test('environmental knockback releases floor control instead of pinning an airborne body',()=>{
  const {w}=fresh();w.player.visual={height:.68,pitch:0,role:'holder',mounted:true};w.enemy.visual={height:.24,pitch:1.5,role:'grounded'};w.ground={owner:w.player,target:w.enemy,until:10,mounted:true};w.environmentHit(w.enemy,{source:w.player,damage:12,kind:'balloon',dir:[0,0,-1],speed:7});w.enemy.vy=4;step(w,.1);assert.equal(w.ground,null);assert.equal(w.enemy.visual,null);assert.ok(w.enemy.y>.1);
});
// The renderer checks below exercise animation and mesh data; they do not compile GPU shaders.
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>({})},{get:(o,k)=>k in o?o[k]:k.toUpperCase()===k?1:()=>({})});
const ctx=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}})},{get:(o,k)=>k in o?o[k]:()=>{}});
const graphics=w=>new CombatRenderer.Renderer({getContext:()=>gl,getBoundingClientRect:()=>({width:800,height:500})},{getContext:()=>ctx},w);
test('static scenery is batched, can be reduced, and releases old arena buffers',()=>{
  const {w}=fresh(),r=graphics(w);r.draw=()=>{};r.frame(1/60);const full=r.scenery.batches.reduce((s,b)=>s+r.meshes[b.name].count,0);assert.ok(r.scenery.batches.length<40);r.setDetail('lean');r.frame(1/60);const lean=r.scenery.batches.reduce((s,b)=>s+r.meshes[b.name].count,0);assert.ok(lean<full*.75);
  for(let i=0;i<12;i++){w.setArena(Object.keys(ARENAS)[i%Object.keys(ARENAS).length]);r.frame(1/60);assert.ok(Object.keys(r.meshes).length<55);}r.setDetail('full');r.frame(1/60);assert.ok(r.scenery.batches.length>15);
});
test('all arena art, new props, enemy footwork, and weapon animations remain finite',()=>{
  for(const arena of Object.keys(ARENAS)){
    const {w}=fresh(),r=graphics(w);w.arenaId=arena;w.opponentStyle='scavenger';w.setMode('sparring');w.player.health=10000;let draws=0;
    r.draw=(kind,m,color,alpha,glow,deform)=>{draws++;assert.ok(r.meshes[kind]?.count>0,kind);assert.ok([...m].every(Number.isFinite));if(deform?.curve)assert.ok(deform.curve.flat().every(Number.isFinite));};w.onEvent=e=>r.notify(e);
    for(let frame=0;frame<900;frame++){if(frame>240){w.input.x=Math.sin(frame*.012)*.5;w.input.z=Math.cos(frame*.01)*.5;if(frame%180===0)w.attack('S');}w.step(1/60);r.frame(1/60);for(const rig of Object.values(r.rigs))for(const point of Object.values(rig.pts))assert.ok(point.every(Number.isFinite));}
    assert.ok(draws>100000);for(const p of w.yard.props)assert.ok([p.x,p.y,p.z,p.vx,p.vy,p.vz].every(Number.isFinite));
  }
});
test('all authored routes connect in each new arena with its actual obstacle layout',()=>{
  for(const arena of Object.keys(ARENAS).filter(id=>id!=='courtyard'&&(!process.argv.some(a=>a.startsWith('--arena='))||id===process.argv.find(a=>a.startsWith('--arena=')).slice(8))))for(const route of ROUTES){const {w,events}=fresh();w.arenaId=arena;w.watch(route.id);step(w,8,60);assert.ok(events.some(e=>e.type==='route'&&e.route.id===route.id),arena+' / '+route.id);}
});
console.log('\n'+checks+' playground and opponent checks passed.');
