'use strict';
const assert=require('node:assert/strict');
const {World,ROUTES,MOVES}=require('../dist/combat.js');
const {LEVELS,VARIANTS}=require('../dist/opponent.js');
require('../dist/physics.js');require('../dist/render.js');
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const fresh=(random=()=>.4)=>{const events=[];return {events,w:new World(e=>events.push(e),random)};};
const step=(w,seconds,fps=120)=>{for(let i=0;i<Math.ceil(seconds*fps);i++)w.step(1/fps);};
const bare=w=>{w.yard.props=[];w.yard.pads=[];w.hazards=false;w.yard.rebuild();};
const group=(behavior='passive',mix='mixed')=>{const x=fresh();x.w.mode='group';x.w.groupBehavior=behavior;x.w.groupMix=mix;x.w.reset();bare(x.w);return x;};
const graphics=w=>{const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>({})},{get:(o,k)=>k in o?o[k]:k.toUpperCase()===k?1:()=>({})});const ctx=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}})},{get:(o,k)=>k in o?o[k]:()=>{}});const r=new CombatRenderer.Renderer({getContext:()=>gl,getBoundingClientRect:()=>({width:760,height:460})},{getContext:()=>ctx},w);r.draw=(kind,m,color,alpha,glow,deform)=>{assert.ok([...m].every(Number.isFinite),kind+' transform');if(deform?.curve)assert.ok(deform.curve.flat().every(Number.isFinite));};const onEvent=w.onEvent;w.onEvent=e=>{onEvent(e);r.notify(e);};return r;};

test('Easy is the default; four levels scale real contact damage and reaction time',()=>{
  assert.equal(new World().difficulty,'relaxed');const damages=[],reactions=[];
  for(const difficulty of Object.keys(LEVELS)){
    const {w}=fresh();w.mode='sparring';w.difficulty=difficulty;w.reset();bare(w);w.enemy.x=w.player.x;w.enemy.z=w.player.z-1.2;w.face(w.enemy,w.player);w.start(w.enemy,w.player,'H');const startup=w.enemy.action.move.startup;step(w,startup+.10,120);damages.push(140-w.player.health);reactions.push(w.opponent.level().reaction);
  }
  assert.ok(damages.every((v,i)=>!i||v>damages[i-1]));assert.ok(reactions.every((v,i)=>!i||v<reactions[i-1]));assert.equal(damages[0],7);assert.equal(damages[3],17);
});
test('Gentle prevents grabs and limits every chosen plan to two attacks',()=>{
  const {w}=fresh();w.mode='sparring';w.difficulty='beginner';w.reset();for(const style of ['balanced','wrestler','elastic']){w.opponentStyle=style;for(let i=0;i<12;i++){w.opponent.choosePlan(1.5);assert.ok(w.opponent.state.plan.length<=2);assert.ok(!/[GR]/.test(w.opponent.state.plan.join('')));}}
  assert.equal(w.start(w.enemy,w.player,'G'),false);assert.equal(w.start(w.enemy,w.player,'R'),false);
});
test('Easy cannot add ground attacks and round health never ramps up',()=>{
  const {w}=fresh();w.setMode('sparring');const hp=w.enemy.maxHealth;w.round=12;w.reset(true);assert.equal(w.enemy.maxHealth,hp);w.player.down=1;w.player.y=0;assert.equal(w.start(w.enemy,w.player,'P'),false);
});
test('group configuration spawns independent opponents and validates changes',()=>{
  const {w}=group();assert.equal(w.enemies.length,3);assert.deepEqual(w.enemies.map(e=>e.variant),['runner','bruiser','grappler']);assert.equal(new Set(w.fighters().map(e=>e.id)).size,4);assert.ok(w.setGroup(2,'reach','moving'));assert.equal(w.enemies.length,2);assert.ok(w.enemies.every(e=>e.style==='elastic'));assert.equal(w.setGroup(9,'mixed','live'),false);assert.equal(w.enemies.length,2);
});
test('every variant changes mass, health, silhouette and its fighting style',()=>{
  for(const mix of ['runner','bruiser','grappler','reach']){const {w}=group('passive',mix),e=w.enemy,v=VARIANTS[mix];assert.equal(e.mass,v.mass);assert.equal(e.maxHealth,Math.round(210*v.health));assert.equal(e.bulk,v.bulk);assert.equal(w.opponent.style().name,require('../dist/opponent.js').STYLES[v.style].name);}
});
test('passive and moving groups never attack; moving targets actually move',()=>{
  for(const behavior of ['passive','moving']){const {w,events}=group(behavior),before=w.enemies.map(e=>[e.x,e.z]);step(w,10,60);assert.equal(events.some(e=>e.type==='enemyAttack'),false);assert.equal(w.player.health,140);if(behavior==='moving')assert.ok(w.enemies.every((e,i)=>Math.hypot(e.x-before[i][0],e.z-before[i][1])>.3));}
});
test('live groups never overlap attacks, alternate turns and allow recovery',()=>{
  const {w,events}=group('live');w.difficulty='standard';w.infinite=false;w.player.health=10000;const owners=new Set();
  for(let i=0;i<3600;i++){w.step(1/120);const active=w.enemies.filter(e=>e.action&&!e.action.move.propPickup);assert.ok(active.length<=1,'two simultaneous attackers');if(w.attackOwner)owners.add(w.attackOwner);if(w.player.down>.1&&!w.grapple)assert.ok(!w.enemies.some(e=>e.action&&!e.action.move.ground&&e.action.t<.05));}
  assert.ok(events.some(e=>e.type==='enemyAttack'));assert.ok(owners.size>=2);assert.ok(w.player.health<10000);
});
test('switching targets pins the current strike and sends the queued move to the next',()=>{
  const {w,events}=group();w.player.x=0;w.player.z=1;w.enemy.x=-.4;w.enemy.z=0;const first=w.enemy,next=w.enemies[1];next.x=.45;next.z=0;w.enemies[2].x=4;w.enemies[2].z=-4;w.attack('P');assert.ok(w.selectTarget(next.id));w.attack('K');step(w,1.2);const hits=events.filter(e=>e.type==='hit');assert.equal(hits[0].target,first.id);assert.equal(hits[1].target,next.id);assert.ok(first.health<first.maxHealth&&next.health<next.maxHealth);
});
test('target switching cannot pull a clinch apart; releasing restores selection',()=>{
  const {w}=group();w.beginGrip(w.player,w.enemy);assert.equal(w.cycleTarget(),false);assert.equal(w.grapple.target,w.enemy);w.releaseGrip();assert.ok(w.cycleTarget());assert.equal(w.enemy,w.enemies[1]);
});
test('escaping another group enemy clears the actual captor plan',()=>{
  const {w}=group('live');const owner=w.enemies[2];w.beginGrip(owner,w.player);assert.equal(w.enemy,owner);w.controllers[owner.id].state.plan=['K','G'];for(let i=0;i<3;i++){w.player.escapeAt=-10;w.escapeHold();}assert.equal(w.grapple,null);assert.equal(w.player.held,false);assert.deepEqual(w.controllers[owner.id].state.plan,[]);
});
test('bystanders stop attacking when another pair enters a clinch',()=>{
  const {w}=group('live');const bystander=w.enemies[1];w.start(bystander,w.player,'P');w.controllers[bystander.id].state.plan=['K'];w.beginGrip(w.player,w.enemy);w.controllers[bystander.id].update(1/60);assert.equal(bystander.action,null);assert.equal(bystander.buffer.length,0);assert.equal(w.controllers[bystander.id].state.plan.length,0);
});
test('one enemy knockout preserves the group; only clearing all resets the wave',()=>{
  const {w,events}=group();const first=w.enemy;first.health=0;w.knockout(first);assert.equal(w.respawn,0);assert.ok(w.targetFor(w.player,false)!==first);step(w,.2);assert.equal(w.enemies[0],first);for(const e of w.enemies.filter(e=>!e.ko)){e.health=0;w.knockout(e);}assert.ok(w.respawn>0);step(w,2.5);assert.equal(w.round,2);assert.ok(w.enemies.every(e=>!e.ko));assert.ok(events.some(e=>e.type==='enemyKO'));
});
test('a launched enemy can physically knock into another enemy',()=>{
  const {w,events}=group();const [a,b]=w.enemies;a.x=0;a.z=0;a.y=0;a.tumbling=true;a.vx=7;a.vz=0;a.lastAttacker=w.player;b.x=.6;b.z=0;b.y=0;w.separateFighters();assert.ok(b.health<b.maxHealth);assert.ok(events.some(e=>e.type==='envHit'&&e.kind==='body'&&e.target===b.id&&e.by==='player'));
});
test('balloon belly drops hit every nearby group target with mass-dependent lift',()=>{
  const {w}=group();w.player.x=0;w.player.z=1;w.enemies.forEach((e,i)=>{e.x=(i-1)*.9;e.z=0;});w.balloon.toggle();step(w,.5);w.balloon.slam(w.player,8);assert.ok(w.enemies.every(e=>e.health<e.maxHealth));assert.ok(w.enemies[0].vy>w.enemies[1].vy);
});
test('wind lab stages all three targets, a prop and a connected multi-target updraft',()=>{
  const {w,events}=fresh();w.wind.stage();w.attack('W');w.attack('W');w.attack('P');w.attack('K');step(w,.27);assert.equal(w.player.connections.filter(c=>c.id==='gale').length,1);step(w,2.1);const casts=events.filter(e=>e.type==='windCast');assert.equal(casts[0].hits,3);assert.equal(casts[1].hits,3);assert.ok(casts[0].props>=1);assert.ok(events.some(e=>e.type==='route'&&e.route.id==='wind-lift-mix'));
});
test('a gale misses enemies behind the caster and cannot home after aim is captured',()=>{
  const {w,events}=group();w.player.x=0;w.player.z=2;w.enemy.x=0;w.enemy.z=0;w.selectTarget(w.enemy.id);w.attack('W');const hp=w.enemy.health;w.enemy.x=3;w.enemy.z=3;w.enemies.slice(1).forEach(e=>{e.x=4;e.z=4;});step(w,.35);assert.equal(w.enemies[0].health,hp);assert.equal(events.filter(e=>e.type==='hit').length,0);
});
test('solid cover blocks wind damage and prop impulses',()=>{
  const {w}=fresh();bare(w);w.player.x=0;w.player.z=2;w.enemy.x=0;w.enemy.z=-2;const blocker={id:'wind-cover',x:0,y:1.2,z:0,hx:.8,hy:1.2,hz:.3};w.yard.pillars=[blocker];const prop=w.yard.make('crate',0,-1);w.yard.props=[prop];w.yard.rebuild();const hp=w.enemy.health;w.attack('W');step(w,.3);assert.equal(w.enemy.health,hp);assert.equal(prop.vx,0);assert.equal(prop.vz,0);
});
test('runners lift higher and travel farther than bruisers under the same gust',()=>{
  const results=[];for(const mix of ['runner','bruiser']){const {w}=group('passive',mix);w.player.x=0;w.player.z=2;w.enemy.x=0;w.enemy.z=0;w.enemies.slice(1).forEach(e=>{e.x=4;e.z=-4;});w.attack('W');step(w,.24);const push=Math.abs(w.enemy.vz);w.attack('W');step(w,.44);results.push({push,vy:w.enemy.vy});}assert.ok(results[0].push>results[1].push*1.7);assert.ok(results[0].vy>results[1].vy);
});
test('updraft leaves opponents available for an aerial reel into a throw',()=>{
  const {w,events}=fresh();w.attack('W');w.attack('W');w.attack('R');w.attack('G');step(w,4);assert.ok(events.some(e=>e.type==='clinch'&&e.by==='player'));assert.ok(events.some(e=>e.type==='throwImpact'));assert.equal(w.enemy.held,false);
});
test('wind pays once, fails honestly when depleted, and replenishes between casts',()=>{
  const {w,events}=fresh();w.infinite=false;w.player.windEnergy=10;const stamina=w.player.stamina;assert.equal(w.attack('W'),false);assert.equal(w.player.stamina,stamina);assert.ok(events.some(e=>e.type==='windEmpty'));w.player.windEnergy=50;assert.ok(w.attack('W'));assert.equal(w.player.windEnergy,32);step(w,2);assert.ok(w.player.windEnergy>45);w.reset();assert.equal(w.player.windEnergy,100);assert.equal(w.wind.waves.length,0);
});
test('wind cancels the owned hold cleanly and balloon unrolls into wind',()=>{
  const {w,events}=fresh();w.beginGrip(w.player,w.enemy);w.attack('W');assert.equal(w.grapple,null);assert.equal(w.enemy.held,false);step(w,1);w.balloon.toggle();step(w,.5);w.attack('W');step(w,.65);assert.equal(w.player.balloon,null);assert.ok(events.filter(e=>e.type==='attack'&&e.token==='W').length>=2);
});
test('wind wakes loose props and preserves a swinging bag rope',()=>{
  const {w}=fresh();bare(w);w.player.x=0;w.player.z=2;w.enemy.x=4;w.enemy.z=-4;const crate=w.yard.make('crate',0,.4),bag=w.yard.make('bag',.9,-1,0,{anchor:[.9,2.75,-1],rope:1.5,anchored:true,y:1.25});w.yard.props=[crate,bag];w.yard.rebuild();w.locked=false;w.player.angle=Math.PI;w.attack('W');step(w,.3);assert.ok(Math.hypot(crate.vx,crate.vy,crate.vz)>1);assert.equal(crate.owner,'player');for(let i=0;i<240;i++){w.step(1/120);assert.ok(Math.abs(Math.hypot(bag.x-bag.anchor[0],bag.y-bag.anchor[1],bag.z-bag.anchor[2])-bag.rope)<1e-6);}
});
test('downburst slams airborne targets without inventing extra combo connections',()=>{
  const {w,events}=fresh();w.attack('W');w.attack('H');step(w,1.3);assert.ok(events.some(e=>e.type==='windCast'&&e.mode==='downburst'));assert.equal(events.filter(e=>e.type==='connect').length,2);assert.ok(events.some(e=>e.type==='route'&&e.route.id==='wind-downburst'));assert.ok(w.enemy.down>0);
});
test('wind branches remain available after an unlisted mixed opener',()=>{
  const {w,events}=fresh();w.attack('K');w.attack('W');w.attack('H');step(w,2);assert.ok(events.some(e=>e.type==='windCast'&&e.mode==='downburst'));assert.equal(events.filter(e=>e.type==='connect').length,3);
});
test('Easy releases a clinch after its attack allowance instead of extending forever',()=>{
  const {w}=fresh();w.mode='sparring';w.difficulty='relaxed';w.reset();w.beginGrip(w.enemy,w.player);w.opponent.state.stringHits=3;w.enemy.action=null;w.opponent.update(1/60);assert.equal(w.grapple,null);assert.equal(w.player.held,false);assert.equal(w.enemy.action,null);
});
test('group animation, reset and physical contacts stay finite in all three arenas',()=>{
  let frames=0;
  for(const arena of ['courtyard','depot','rooftop'])for(const mix of ['mixed','reach']){
    const {w}=group('live',mix);w.arenaId=arena;w.difficulty='relentless';w.reset();w.player.health=10000;const r=graphics(w);let impacts=0;
    for(let i=0;i<900;i++){if(i%90===0)w.cycleTarget();if(i%30===0)w.attack(['W','W','P','K','R','G'][Math.floor(i/30)%6]);if(i%240===0)w.dodge(1,0);w.step(1/60);r.frame(1/60);frames++;for(const f of w.fighters()){assert.ok([f.x,f.y,f.z,f.health,f.stamina].every(Number.isFinite));assert.ok(Object.values(r.rigs[f.id].pts).flat().every(Number.isFinite));}impacts+=w.enemies.filter(e=>e.hurt>0).length;}
    w.reset();r.notify({type:'reset'});r.frame(1/60);assert.equal(Object.keys(r.ragdolls).length,4);assert.ok(impacts>0);
  }
  console.log('  '+frames+' integrated group animation frames');
});
console.log('\n'+checks+' group, difficulty and wind checks passed. Browser visual QA is not covered.');
