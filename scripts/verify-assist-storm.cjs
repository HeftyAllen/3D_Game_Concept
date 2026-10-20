'use strict';
const assert=require('node:assert/strict');
const {World,ROUTES,MOVES}=require('../dist/combat.js');
require('../dist/physics.js');require('../dist/render.js');
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const fresh=()=>{const events=[];return {events,w:new World(e=>events.push(e),()=>.4)};};
const step=(w,s,fps=120)=>{for(let i=0;i<Math.ceil(s*fps);i++)w.step(1/fps);};
const bare=w=>{w.yard.props=[];w.yard.pads=[];w.hazards=false;w.yard.rebuild();};
const request=(w,token='P')=>{assert.ok(w.attack(token));let guard=0;while((w.player.action||w.player.buffer.length)&&guard++<600)w.step(1/120);};
const graphics=w=>{
  let triangles=0;const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>({}),uniformMatrix3fv:(loc,transpose,m)=>assert.ok([...m].every(Number.isFinite)),uniformMatrix4fv:(loc,transpose,m)=>assert.ok([...m].every(Number.isFinite)),drawArrays:(mode,first,count)=>{triangles+=count/3;}},{get:(o,k)=>k in o?o[k]:k.toUpperCase()===k?1:()=>({})});
  const ctx=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}})},{get:(o,k)=>k in o?o[k]:()=>{}}),r=new CombatRenderer.Renderer({getContext:()=>gl,getBoundingClientRect:()=>({width:760,height:460})},{getContext:()=>ctx},w),onEvent=w.onEvent;w.onEvent=e=>{onEvent(e);r.notify(e);};return {r,count:()=>triangles,clear:()=>{triangles=0;}};
};

test('Manual remains the default and its three punches are unchanged',()=>{
  const {w,events}=fresh();assert.equal(w.assistMode,'manual');w.attack('P');w.attack('P');w.attack('P');step(w,1.5);assert.deepEqual(events.filter(e=>e.type==='connect').map(e=>e.move),['Lead jab','Straight cross','Lead hook']);
});
test('a single easy tap starts one move and does not autoplay a full string',()=>{
  const {w,events}=fresh();w.setAssist('easy');w.attack('P');step(w,3);assert.equal(events.filter(e=>e.type==='attack').length,1);assert.equal(events.filter(e=>e.type==='connect').length,1);assert.equal(w.player.action,null);
});
test('mashing admits at most two pending assisted moves and drains after release',()=>{
  const {w,events}=fresh();w.setAssist('easy');for(let i=0;i<50;i++)w.attack('P');assert.equal(w.player.buffer.length,2);step(w,3);assert.equal(events.filter(e=>e.type==='attack').length,3);assert.equal(w.player.buffer.length,0);assert.equal(w.player.action,null);
});
test('mixed mashing connects hands, kicks, air, floor attacks and an actual throw',()=>{
  for(const fps of [30,60,120]){
    const {w,events}=fresh();w.setAssist('easy');w.enemy.health=w.enemy.maxHealth=10000;
    for(let i=0;i<fps*16;i++){if(i%Math.max(1,Math.round(fps*.09))===0)w.attack('P');w.step(1/fps);assert.ok(w.player.buffer.length<=2);}
    const names=events.filter(e=>e.type==='connect').map(e=>e.move);assert.ok(names.includes('Lead jab'));assert.ok(names.includes('Switch roundhouse'));assert.ok(names.includes('Rising uppercut'));assert.ok(names.includes('Meteor heel'));assert.ok(names.includes('Ground straight'));assert.ok(events.some(e=>e.type==='throwImpact'));assert.equal(events.filter(e=>e.type==='whiff').length,0);
  }
});
test('an easy request reads air context at execution, after the queued launcher',()=>{
  const {w,events}=fresh();w.setAssist('easy');w.attack('P');w.attack('K');w.attack('P');step(w,1.8);const attacks=events.filter(e=>e.type==='attack');assert.equal(attacks[1].id,'upper');assert.ok(MOVES[attacks[2].id].air);assert.equal(events.filter(e=>e.type==='whiff').length,0);
});
test('easy K sets up flight and L finishes the airborne target',()=>{
  const {w,events}=fresh();w.setAssist('easy');w.attack('K');w.attack('H');step(w,1.6);assert.ok(events.some(e=>e.type==='hit'&&e.move==='Rising uppercut'));assert.ok(events.some(e=>e.type==='hit'&&e.move==='Meteor heel'));
});
test('assisted wind and wrestling produce their own contextual moves',()=>{
  for(const style of ['wind','wrestling']){const {w,events}=fresh();w.setAssist('easy',style);w.enemy.health=w.enemy.maxHealth=10000;for(let i=0;i<1200;i++){if(i%10===0)w.attack('P');w.step(1/120);}if(style==='wind'){assert.ok(events.some(e=>e.type==='windCast'&&e.mode==='cyclone'));assert.ok(events.some(e=>e.type==='windCast'&&e.mode==='downburst'));}else{assert.ok(events.some(e=>e.type==='grip'&&e.grip==='bodylock'));assert.ok(events.some(e=>e.type==='throwImpact'&&e.move==='Scoop body slam'));}assert.equal(events.filter(e=>e.type==='whiff').length,0);}
});
test('a guarding partner prompts a real clinch rather than an unearned hit',()=>{
  const {w,events}=fresh();w.dummy='guard';w.setAssist('easy');step(w,.2);w.attack('P');step(w,.4);assert.ok(w.grapple);assert.ok(events.some(e=>e.type==='clinch'));assert.equal(w.enemy.health,317);
});
test('finite stamina is enforced in easy mode and wind falls back when energy is low',()=>{
  const {w}=fresh();w.setAssist('easy','wind');w.infinite=false;w.player.stamina=1;assert.equal(w.attack('P'),false);assert.equal(w.player.stamina,1);w.player.stamina=100;w.player.windEnergy=0;assert.ok(w.attack('P'));assert.equal(w.player.action.move.wind,undefined);assert.ok(w.player.stamina<100);assert.equal(w.player.windEnergy,0);
});
test('target changes redirect the queued easy request, not the strike in progress',()=>{
  const {w,events}=fresh();w.mode='group';w.groupBehavior='passive';w.reset();bare(w);w.setAssist('easy');w.player.x=0;w.player.z=1;w.enemies[0].x=-.4;w.enemies[0].z=0;w.enemies[1].x=.45;w.enemies[1].z=0;w.enemies[2].x=4;w.enemies[2].z=-4;w.attack('P');w.selectTarget('enemy2');w.attack('P');step(w,1);const hits=events.filter(e=>e.type==='hit');assert.equal(hits[0].target,'enemy');assert.equal(hits[1].target,'enemy2');
});
test('switching to manual clears pending assistance and restores literal inputs',()=>{
  const {w,events}=fresh();w.setAssist('easy');w.attack('P');w.attack('P');assert.equal(w.player.buffer.length,1);w.setAssist('manual');assert.equal(w.player.buffer.length,0);step(w,.4);assert.ok(w.attack('P'));step(w,.5);assert.equal(events.filter(e=>e.type==='attack').at(-1).id,'cross');assert.equal(w.setAssist('invalid'),false);
});
test('watching a manual route works while Easy combos is enabled',()=>{
  const {w,events}=fresh();w.setAssist('easy','wind');w.watch('one-two-hook');step(w,4);assert.deepEqual(events.filter(e=>e.type==='connect').map(e=>e.move),['Lead jab','Straight cross','Lead hook']);assert.equal(w.assistMode,'easy');
});
test('balloon controls retain burst, bounce and belly drop in Easy combos',()=>{
  const {w}=fresh();w.setAssist('easy');w.balloon.toggle();step(w,.5);w.attack('P');assert.ok(w.player.balloon.boostUntil>w.time);w.attack('K');assert.ok(w.player.vy>0);w.attack('H');assert.ok(w.player.balloon.drop);
});
test('vacuum reduces body and loose-prop distance to its captured center',()=>{
  const {w}=fresh();bare(w);w.player.x=0;w.player.z=2;w.enemy.x=0;w.enemy.z=-.5;const crate=w.yard.make('crate',1,-.6);w.yard.props=[crate];w.yard.rebuild();w.attack('N');const aim={...w.player.action.windAim},before=Math.hypot(w.enemy.x-aim.cx,w.enemy.z-aim.cz),propBefore=Math.hypot(crate.x-aim.cx,crate.z-aim.cz);step(w,.5);assert.ok(Math.hypot(w.enemy.x-aim.cx,w.enemy.z-aim.cz)<before-.2);assert.ok(Math.hypot(crate.x-aim.cx,crate.z-aim.cz)<propBefore-.1);
});
test('slipstream traverses a gap gradually and makes contact only near its landing',()=>{
  const {w,events}=fresh();bare(w);w.player.x=0;w.player.z=2;w.enemy.x=0;w.enemy.z=-1;const start=w.player.z;w.attack('D');step(w,.1);assert.ok(w.player.z<start-.2&&w.player.z>0);assert.equal(w.enemy.health,320);step(w,.4);assert.ok(w.enemy.health<320);assert.ok(events.some(e=>e.type==='hit'&&e.move==='Slipstream palm'));assert.ok(w.player.z>-.5);
});
test('a solid pillar stops the dash and prevents a hit through cover',()=>{
  const {w}=fresh();bare(w);w.player.x=0;w.player.z=2;w.enemy.x=0;w.enemy.z=-2;w.yard.pillars=[{id:'dash-stop',x:0,y:1.2,z:0,hx:.8,hy:1.2,hz:.35}];w.yard.rebuild();w.attack('D');step(w,.7);assert.ok(w.player.z>.6);assert.equal(w.enemy.health,320);
});
test('an interrupted dash loses its movement controller and preserves finite velocity',()=>{
  const {w}=fresh();bare(w);w.player.x=0;w.player.z=2;w.enemy.z=-2;w.attack('D');step(w,.1);w.environmentHit(w.player,{source:w.enemy,damage:8,kind:'prop',dir:[1,0,0],speed:5});assert.equal(w.player.action,null);const z=w.player.z;step(w,.5);assert.ok(w.player.z>z-.8);assert.ok([w.player.vx,w.player.vz].every(Number.isFinite));
});
test('a cyclone lasts under a second, deals bounded ticks, and records one connection',()=>{
  const {w,events}=fresh();bare(w);w.attack('Z');step(w,.3);assert.equal(w.wind.fields.length,1);const field=w.wind.fields[0];for(let i=0;i<240;i++){w.step(1/120);assert.ok(w.wind.fields.length<=1);}assert.equal(w.wind.fields.length,0);assert.ok((field.ticks.enemy?.count||0)<=3);assert.equal(events.filter(e=>e.type==='connect').length,1);assert.ok(320-w.enemy.health<=17);assert.equal(events.filter(e=>e.type==='route').length,0);
});
test('cyclones keep a captured location, respect cover and do not stack per caster',()=>{
  const {w}=fresh();bare(w);w.attack('Z');step(w,.3);const field=w.wind.fields[0],origin=[field.cx,field.cz];w.player.action=null;w.start(w.player,w.enemy,'Z');step(w,.3);assert.equal(w.wind.fields.length,1);w.enemy.x=4;w.enemy.z=-4;step(w,.2);assert.ok(Math.hypot(field.cx-origin[0],field.cz-origin[1])<1e-9);w.reset();assert.equal(w.wind.fields.length,0);
});
test('downburst collapses the existing cyclone without leaving its force running',()=>{
  const {w,events}=fresh();bare(w);w.attack('Z');w.attack('H');step(w,1.2);assert.equal(w.wind.fields.length,0);assert.ok(events.some(e=>e.type==='windCast'&&e.mode==='downburst'));assert.ok(w.enemy.down>0);
});
test('cyclone fields cannot hit bodies behind solid cover or disturb a held pair',()=>{
  const {w,events}=fresh();bare(w);w.player.x=0;w.player.z=2;w.enemy.x=0;w.enemy.z=-1;w.yard.pillars=[{id:'storm-cover',x:0,y:1.2,z:0,hx:.8,hy:1.2,hz:.3}];w.yard.rebuild();w.attack('Z');step(w,1.7);assert.equal(w.enemy.health,320);assert.equal(events.filter(e=>e.type==='envHit').length,0);
  w.reset();bare(w);w.attack('Z');step(w,.35);w.player.action=null;w.beginGrip(w.player,w.enemy);const hp=w.enemy.health;step(w,.5);assert.equal(w.enemy.health,hp);assert.ok(w.grapple);
});
test('new direct casts spend energy once and cannot bypass an enemy grip',()=>{
  for(const [token,cost] of [['N',22],['D',24],['Z',32]]){const {w}=fresh();w.infinite=false;w.attack(token);assert.equal(w.player.windEnergy,100-cost);w.reset();w.beginGrip(w.enemy,w.player);assert.equal(w.attack(token),false);assert.equal(w.player.windEnergy,100);}
});
test('exactly overlapping fighters separate without invalid positions',()=>{
  const {w}=fresh();bare(w);w.player.x=w.enemy.x=0;w.player.z=w.enemy.z=0;w.separateFighters();assert.ok(Math.hypot(w.player.x-w.enemy.x,w.player.z-w.enemy.z)>.77);assert.ok(w.fighters().every(f=>[f.x,f.z].every(Number.isFinite)));
});
test('a bystander separates from the whole clinch without offsetting the held pair',()=>{
  const {w}=fresh();w.mode='group';w.groupBehavior='passive';w.reset();bare(w);w.beginGrip(w.player,w.enemy);step(w,.2);const a=w.player,b=w.enemy,c=w.enemies[1];w.enemies[2].x=4;w.enemies[2].z=-4;c.x=a.x+.12;c.z=a.z+.08;const separation=[b.x-a.x,b.z-a.z];w.separateFighters();assert.ok(Math.abs((b.x-a.x)-separation[0])<1e-9);assert.ok(Math.abs((b.z-a.z)-separation[1])<1e-9);assert.ok(Math.hypot(c.x-a.x,c.z-a.z)>.6);
});
test('character heads, torsos and limbs contain more triangles with finite smooth normals',()=>{
  const expected={head:1280,body:1216,limb:624};for(const [kind,old] of Object.entries(expected)){const g=CombatRenderer.geometry(kind);assert.ok(g.p.length/9>old*1.6,kind+' denser');assert.ok([...g.p,...g.n].every(Number.isFinite));}for(const kind of ['glove','shoe']){const g=CombatRenderer.geometry(kind);assert.ok(g.p.length>0&&g.p.length===g.n.length);assert.ok([...g.n].every(Number.isFinite));}
});
test('parallel or missing limb axes still produce an orthonormal joint basis',()=>{
  for(const [right,up] of [[[0,1,0],[0,1,0]],[[0,0,0],[0,0,0]],[[1,0,0],[1,0,0]]]){const m=CombatRenderer.jointBasis(right,up),a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]];for(const v of [a,b,c])assert.ok(Math.abs(Math.hypot(...v)-1)<1e-6);assert.ok(Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))<1e-6);}
});
test('Lean mode reduces actual submitted triangles while preserving the same physical actors',()=>{
  const {w}=fresh();w.mode='group';w.reset();const g=graphics(w);g.r.frame(1/60);const full=g.count();g.clear();g.r.setDetail('lean');g.r.frame(1/60);const lean=g.count();assert.ok(lean<full*.65,{full,lean});assert.equal(Object.keys(g.r.rigs).length,4);console.log('  Full '+Math.round(full)+' / Lean '+Math.round(lean)+' submitted triangles');
});
test('Easy combos remain bounded in live group sparring at Easy and Hard difficulty',()=>{
  for(const difficulty of ['relaxed','relentless'])for(const style of ['mixed','wind','wrestling']){
    const {w}=fresh();w.mode='group';w.groupBehavior='live';w.difficulty=difficulty;w.reset();w.infinite=false;w.setAssist('easy',style);w.player.health=w.player.maxHealth=10000;w.enemies.forEach(e=>e.health=e.maxHealth=10000);
    for(let i=0;i<1200;i++){if(i%9===0)w.attack('P');if(i%180===0)w.attack('Z');if(i%240===0)w.cycleTarget();if(i%360===0)w.dodge(1,0);w.step(1/120);assert.ok(w.wind.fields.length<=1);assert.ok(w.player.buffer.length<=4);for(const f of w.fighters()){assert.ok([f.x,f.y,f.z,f.health,f.stamina,f.windEnergy].every(Number.isFinite));assert.ok(f.stamina>=0&&f.stamina<=100);assert.ok(f.windEnergy>=0&&f.windEnergy<=100);assert.ok(f.health>=0);}}
  }
});
test('assisted combat and storm effects keep group rigs finite across arenas and styles',()=>{
  let frames=0;
  for(const arena of ['courtyard','depot','rooftop'])for(const style of ['mixed','wind','wrestling']){
    const {w}=fresh();w.mode='group';w.groupBehavior='moving';w.arenaId=arena;w.reset();w.setAssist('easy',style);w.enemies.forEach(e=>e.health=e.maxHealth=10000);const {r}=graphics(w);r.draw=(kind,m,color,alpha,glow,deform)=>{assert.ok([...m].every(Number.isFinite));if(deform?.curve)assert.ok(deform.curve.flat().every(Number.isFinite));};
    for(let i=0;i<420;i++){if(i%7===0)w.attack('P');if(i%120===0)w.cycleTarget();w.step(1/60);r.frame(1/60);frames++;for(const f of w.fighters())assert.ok(Object.values(r.rigs[f.id].pts).flat().every(Number.isFinite));}
  }
  console.log('  '+frames+' assisted group animation frames');
});
console.log('\n'+checks+' assistance, storm and character checks passed. Browser/GPU QA is not covered.');
