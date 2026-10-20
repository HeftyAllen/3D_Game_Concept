'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {World}=require('../dist/combat.js');
require('../dist/physics.js');require('../dist/render.js');
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const fresh=()=>{const events=[],w=new World(e=>events.push(e),()=>.4);w.setArena('foundry');events.length=0;return {w,events};};
const step=(w,s,fps=120)=>{for(let i=0;i<Math.ceil(s*fps);i++)w.step(1/fps);};
const empty=w=>{w.yard.props=[];w.yard.pads=[];w.yard.rebuild();w.player.x=0;w.player.z=2;w.enemy.x=0;w.enemy.z=-2;};
const attempt=(id,mode='manual',fps=120)=>{
  const {w,events}=fresh();w.setAssist(mode);w.trials.start(id);let next=0;
  if(id==='glass')for(const token of ['H','H','P','K'])w.attack(token);
  if(id==='cargo')w.attack('W');
  if(id==='rebound'&&mode==='manual'){w.attack('H');w.attack('K');}
  for(let i=0;i<fps*12&&w.trials.run.status==='running';i++){
    if(id==='vent'&&w.enemy.y>.2&&i>=next){w.attack(i%2?'K':'P');next=i+Math.round(fps/6);}
    if(id==='rebound'&&events.some(e=>e.type==='bumperBounce')&&w.enemy.y>.2&&i>=next){w.attack('P');next=i+Math.round(fps*.15);}
    if(id==='glass'&&mode==='easy'&&i%Math.round(fps*.15)===0)w.attack('P');
    if(id==='rebound'&&mode==='easy'&&i%Math.round(fps*.15)===0)w.attack('P');
    w.step(1/fps);
  }
  return {w,events};
};

test('Foundry starts with working lanes, vents, switches and a clear combo center',()=>{
  const {w}=fresh(),g=w.yard.gadgets;assert.equal(g.belts.length,2);assert.equal(g.vents.length,2);assert.equal(g.panels.length,2);
  assert.ok(w.yard.props.some(p=>p.type==='cart'));assert.ok(w.yard.props.some(p=>p.type==='glass'));assert.ok(w.yard.props.some(p=>p.type==='bumper'));
  assert.ok(!w.yard.props.some(p=>Math.abs(p.x)<1.3&&Math.abs(p.z)<1.3));
});
test('switches require proximity, recover between uses and cycle reverse/off/forward',()=>{
  const {w,events}=fresh(),g=w.yard.gadgets;assert.equal(w.useArena(),false);w.player.x=g.panels[0].x-.7;w.player.z=g.panels[0].z;
  assert.equal(w.useArena(),true);assert.equal(g.power,-1);assert.equal(w.useArena(),false);w.time+=.5;assert.equal(w.useArena(),true);assert.equal(g.power,0);w.time+=.5;w.useArena();assert.equal(g.power,1);
  assert.equal(events.filter(e=>e.type==='machineSwitch').length,3);assert.ok(events.filter(e=>e.type==='controlInput').every(e=>e.key==='Y'));
});
test('an active move or balloon form cannot operate a switch',()=>{
  const {w}=fresh(),g=w.yard.gadgets;w.player.x=g.panels[0].x-.7;w.player.z=g.panels[0].z;w.attack('P');assert.equal(w.useArena(),false);w.player.action=null;w.balloon.toggle();assert.equal(w.useArena(),false);assert.equal(g.power,1);
});
test('switch posts are physical cover and old arenas have no invisible machinery',()=>{
  const {w}=fresh(),g=w.yard.gadgets,p=g.panels[0];assert.ok(w.yard.solids.some(c=>c.id===p.id));
  w.player.x=p.x;w.player.z=p.z+.1;w.yard.resolveFighter(w.player,1/60);assert.ok(Math.hypot(w.player.x-p.x,w.player.z-p.z)>.35);
  for(const id of ['courtyard','depot','rooftop']){w.setArena(id);assert.equal(w.yard.gadgets.belts.length,0);assert.equal(w.yard.gadgets.panels.length,0);assert.equal(w.useArena(),false);}
});
test('conveyors move cargo in either direction and stop when power or hazards are off',()=>{
  const {w}=fresh();empty(w);const g=w.yard.gadgets,b=g.belts[0],p=w.yard.make('cart',b.x,b.z);w.yard.props=[p];
  g.step(.1);assert.ok(p.vz<-3);g.power=-1;g.step(.2);assert.ok(p.vz>3);g.power=0;p.vz=0;g.step(.2);assert.equal(p.vz,0);g.power=1;w.hazards=false;g.step(.2);assert.equal(p.vz,0);
});
test('conveyors carry grounded fighters while airborne fighters remain free',()=>{
  const {w}=fresh();empty(w);const g=w.yard.gadgets,b=g.belts[0];w.player.x=b.x;w.player.z=b.z;const z=w.player.z;g.step(.1);assert.ok(w.player.z<z-.1);w.player.y=1;const air=w.player.z;g.step(.1);assert.equal(w.player.z,air);
});
test('conveyors carry a clinch as a pair and leave committed throws alone',()=>{
  const {w}=fresh();empty(w);const g=w.yard.gadgets,b=g.belts[0];w.player.x=b.x;w.player.z=b.z;w.enemy.x=b.x;w.enemy.z=b.z-.7;w.beginGrip(w.player,w.enemy);
  const offset=[w.enemy.x-w.player.x,w.enemy.z-w.player.z],before=w.player.z;g.step(.1);assert.ok(w.player.z<before);assert.deepEqual([w.enemy.x-w.player.x,w.enemy.z-w.player.z],offset);
  w.grapple.phase='throw';const at=w.player.z;g.step(.1);assert.equal(w.player.z,at);
});
test('machinery never takes control of held, retrieved or anchored objects',()=>{
  const {w}=fresh();empty(w);const g=w.yard.gadgets,b=g.belts[0];
  w.yard.props=['heldBy','pulledBy','anchored'].map((key,i)=>w.yard.make('crate',b.x,b.z,0,{[key]:key==='anchored'?true:'player'}));g.step(.2);for(const p of w.yard.props)assert.equal(Math.hypot(p.vx,p.vy,p.vz),0);
});
test('unclaimed conveyor cargo can hit an opponent without granting player credit',()=>{
  const {w,events}=fresh();w.trials.start('cargo');step(w,2);assert.ok(events.some(e=>e.type==='envHit'&&e.kind==='prop'&&e.target==='enemy'));assert.equal(events.some(e=>e.type==='envHit'&&e.by==='player'),false);assert.equal(w.trials.run.status,'running');assert.equal(w.totalHits,0);
});
test('using a switch credits recently driven cargo only to its operator',()=>{
  const {w}=fresh();empty(w);const g=w.yard.gadgets,b=g.belts[0],p=w.yard.make('cart',b.x,b.z);w.yard.props=[p];w.player.x=g.panels[0].x-.7;w.player.z=g.panels[0].z;w.useArena();g.step(.2);assert.equal(p.owner,'player');
  w.time+=4;const neutral=w.yard.make('crate',b.x,b.z);w.yard.props=[neutral];g.step(.2);assert.equal(neutral.owner,null);
});
test('vents warn before launching, cool down per body, and launch heavier bodies lower',()=>{
  const {w,events}=fresh();empty(w);const g=w.yard.gadgets,v=g.vents[0];v.offset=v.period-.4;w.time=0;w.player.x=v.x;w.player.z=v.z;w.enemy.x=v.x;w.enemy.z=v.z+.1;w.enemy.mass=2;
  assert.equal(g.phase(v),'warning');g.step(.1);assert.equal(w.player.vy,0);w.time=.5;g.step(.1);assert.ok(w.player.vy>w.enemy.vy&&w.enemy.vy>4);assert.equal(events.filter(e=>e.type==='ventLaunch').length,2);
  w.player.y=0;w.player.vy=0;g.step(.1);assert.equal(w.player.vy,0);assert.equal(events.filter(e=>e.type==='ventLaunch').length,2);
});
test('vents lift cargo and balloon form through their physical velocities',()=>{
  const {w,events}=fresh();empty(w);const g=w.yard.gadgets,v=g.vents[0];v.offset=-w.time;w.player.x=v.x;w.player.z=v.z;w.balloon.toggle();
  const p=w.yard.make('barrel',v.x+.3,v.z+.3);w.yard.props=[p];g.step(.1);assert.ok(w.player.vy>7);assert.ok(p.vy>4);assert.ok(p.machineArmed);assert.ok(events.some(e=>e.type==='ventProp'));assert.ok(events.some(e=>e.type==='ventLaunch'));
});
test('vents cannot split a held pair and disabled vents do not launch anyone',()=>{
  const {w,events}=fresh();empty(w);const g=w.yard.gadgets,v=g.vents[0];v.offset=-w.time;w.player.x=v.x;w.player.z=v.z;w.enemy.x=v.x+.2;w.enemy.z=v.z+.2;w.beginGrip(w.player,w.enemy);g.step(.1);assert.equal(w.player.vy,0);assert.equal(w.enemy.vy,0);
  w.releaseGrip();w.hazards=false;g.step(.1);assert.equal(events.filter(e=>e.type==='ventLaunch').length,0);assert.ok(g.snapshot().vents.every(v=>v.phase==='off'));
});
test('cargo carts roll but cannot be equipped by either side',()=>{
  const {w}=fresh();empty(w);const cart=w.yard.make('cart',0,1);w.yard.props=[cart];w.yard.rebuild();assert.equal(w.yard.candidate(w.player,2),null);assert.equal(w.yard.pickup(w.player,cart),false);assert.equal(w.yard.pickup(w.enemy,cart,true),false);
  cart.sleep=false;cart.vx=3;step(w,.4);assert.ok(cart.x>.6);assert.ok(cart.vx>1);
});
test('glass blocks strikes until a physical break removes it from cover',()=>{
  const {w,events}=fresh();w.trials.start('glass');w.attack('P');step(w,.3);assert.equal(w.enemy.health,600);assert.ok(!events.some(e=>e.type==='hit'));assert.equal(w.trials.run.broken,false);
  w.attack('H');step(w,.7);assert.ok(events.some(e=>e.type==='propBreak'&&e.propType==='glass'&&e.by==='player'));assert.equal(w.yard.lineBlocked(w.player,w.enemy),false);assert.equal(w.yard.props.filter(p=>p.type==='debris'&&!p.broken).length,10);step(w,5);assert.equal(w.yard.props.filter(p=>p.type==='debris').length,0);
});
test('rebound pads lift both fighters only after an actual fast impact',()=>{
  for(const targetId of ['player','enemy']){const {w,events}=fresh();empty(w);const f=w[targetId],source=targetId==='player'?w.enemy:w.player;w.yard.props=[w.yard.make('bumper',0,0)];w.yard.rebuild();f.x=0;f.z=.4;f.vz=-5;f.lastAttacker=source;f.lastHitAt=w.time;w.yard.previous[f.id]={x:0,z:.6,h:1};w.yard.resolveFighter(f,1/60);
    assert.ok(f.vy>3);assert.ok(f.vz>0);assert.ok(f.tumbling);assert.ok(events.some(e=>e.type==='bumperBounce'&&e.target===targetId&&e.by===source.id));}
});
test('ordinary walking or disabling hazards cannot trigger a powered rebound',()=>{
  for(const hazards of [true,false]){const {w,events}=fresh();empty(w);w.hazards=hazards;w.yard.props=[w.yard.make('bumper',0,0)];w.yard.rebuild();w.player.x=0;w.player.z=.4;w.player.vz=-1;w.yard.previous.player={x:0,z:.41,h:1};w.yard.resolveFighter(w.player,1/60);assert.equal(events.some(e=>e.type==='bumperBounce'),false);assert.equal(w.player.vy,0);}
});
test('reset restores glass, cargo, switch direction and machinery cooldowns',()=>{
  const {w}=fresh(),g=w.yard.gadgets;w.yard.damage(w.yard.props.find(p=>p.type==='glass'),50,w.player);g.power=0;g.vents[0].last.player=w.time;w.reset();assert.equal(w.yard.gadgets.power,1);assert.ok(w.yard.props.some(p=>p.type==='glass'&&!p.broken));assert.equal(w.yard.gadgets.vents[0].last.player,undefined);
});
test('Easy K reports the pressed key separately from the wind move it chooses',()=>{
  const {w,events}=fresh();empty(w);w.setAssist('easy');w.attack('K');const input=events.find(e=>e.type==='controlInput'),attack=events.find(e=>e.type==='attack');assert.equal(input.key,'K');assert.equal(attack.token,'W');assert.equal(attack.requestedToken,'K');assert.equal(attack.assisted,true);step(w,.4);const cast=events.find(e=>e.type==='windCast');assert.equal(cast.requestedToken,'K');assert.equal(cast.assisted,true);
});
test('buffered manual taps appear once in pressed-key order without later duplicates',()=>{
  const {w,events}=fresh();w.attack('K');w.attack('H');w.attack('P');assert.deepEqual(events.filter(e=>e.type==='controlInput').map(e=>e.key),['K','L','J']);step(w,2);assert.equal(events.filter(e=>e.type==='controlInput').length,3);assert.equal(events.filter(e=>e.type==='attack').length,3);
});
test('direct powers and object requests retain their own labels while Watch emits no pressed keys',()=>{
  const {w,events}=fresh();w.attack('N');w.interact('fetch');assert.deepEqual(events.filter(e=>e.type==='controlInput').map(e=>e.key),['PULL','B']);events.length=0;w.watch('one-two-hook');step(w,3);assert.equal(events.filter(e=>e.type==='controlInput').length,0);
});
test('every trial completes through real contacts in Manual at 30 and 120 fps',()=>{
  for(const fps of [30,120])for(const id of ['glass','cargo','vent','rebound']){const {w,events}=attempt(id,'manual',fps);assert.equal(w.trials.run.status,'complete',id+' at '+fps);assert.ok(events.some(e=>e.type==='trialFinish'&&e.status==='complete'));assert.ok(w.trials.best[id+':manual']>0);}
});
test('Easy combos can complete all four environment trials',()=>{
  for(const id of ['glass','cargo','vent','rebound']){const {w}=attempt(id,'easy');assert.equal(w.trials.run.status,'complete',id);assert.ok(w.trials.best[id+':easy:mixed']>0);}
});
test('starting a trial consistently restores its arena, partner and practice rules',()=>{
  const {w}=fresh();w.setMode('group');w.practiceSpeed=.5;w.hazards=false;w.trials.start('glass');assert.equal(w.mode,'practice');assert.equal(w.dummy,'passive');assert.equal(w.enemies.length,1);assert.equal(w.enemy.health,600);assert.equal(w.practiceSpeed,1);assert.equal(w.hazards,true);assert.equal(w.infinite,true);assert.equal(w.trials.run.status,'running');
});
test('trial objectives ignore unrelated breaks, unowned hits and grounded follow-ups',()=>{
  const {w}=fresh();w.trials.start('glass');w.yard.damage(w.yard.props.find(p=>p.type==='crate'),100,w.player);assert.equal(w.trials.run.broken,false);w.trials.start('vent');w.emit('ventLaunch',{by:'enemy'});assert.equal(w.trials.run.launched,false);w.emit('ventLaunch',{by:'player'});w.emit('hit',{air:false,damage:5});assert.equal(w.trials.run.air,0);w.player.y=1;w.time+=3.1;w.emit('hit',{air:true,damage:5});assert.equal(w.trials.run.air,0);
});
test('trial clocks use simulation time and timeouts never create a best time',()=>{
  const {w,events}=fresh();w.trials.start('cargo');w.freeze=1;step(w,.5);assert.equal(w.trials.run.elapsed,0);w.freeze=0;w.time+=60.1;w.trials.step();assert.equal(w.trials.run.status,'timeout');assert.equal(w.trials.best['cargo:manual'],undefined);assert.equal(events.filter(e=>e.type==='trialFinish').length,1);w.trials.step();assert.equal(events.filter(e=>e.type==='trialFinish').length,1);
});
test('knockouts fail unfinished trials without automatic scene reset',()=>{
  const {w}=fresh();w.trials.start('vent');w.knockout(w.enemy);assert.equal(w.trials.run.status,'failed');assert.equal(w.respawn,0);step(w,3);assert.equal(w.trials.run.status,'failed');assert.equal(w.enemy.ko,true);
});
test('retry resets progress while cancel and mode changes release the trial',()=>{
  const {w}=attempt('glass');const best=w.trials.best['glass:manual'];w.trials.start('glass');assert.equal(w.trials.run.status,'running');assert.equal(w.trials.run.broken,false);assert.equal(w.trials.best['glass:manual'],best);assert.equal(w.trials.cancel(),true);assert.equal(w.trials.snapshot(),null);w.trials.start('vent');w.setAssist('easy','wind');assert.equal(w.trials.snapshot(),null);w.trials.start('rebound');w.setArena('depot');assert.equal(w.trials.snapshot(),null);
});
test('best times persist only for valid trials and separate control styles',()=>{
  const {w}=fresh();w.trials.load({'glass:manual':3,'cargo:easy:wind':5,'glass:easy:mixed':4,'glass:easy:wrestling':6,'glass:easy:bad':2,'unknown:manual':2,'vent:manual':-2,'rebound:manual':61});assert.equal(Object.keys(w.trials.best).length,4);w.trials.start('glass');assert.equal(w.trials.snapshot().best,3);w.trials.cancel();w.setAssist('easy','mixed');w.trials.start('glass');assert.equal(w.trials.snapshot().best,4);
});
test('completed trials keep a faster record when replayed more slowly',()=>{
  const {w}=attempt('cargo');const best=w.trials.best['cargo:manual'];w.trials.start('cargo');w.time+=3;w.trials.onEvent({type:'envHit',by:'player',target:'enemy',kind:'prop',propType:'cart'});assert.equal(w.trials.best['cargo:manual'],best);assert.equal(w.trials.run.newBest,false);
});
test('visible conveyor treads travel in the same direction as their cargo',()=>{
  const {w}=fresh(),gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>({})},{get:(o,k)=>k in o?o[k]:k.toUpperCase()===k?1:()=>({})}),ctx=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}})},{get:(o,k)=>k in o?o[k]:()=>{}}),r=new CombatRenderer.Renderer({getContext:()=>gl,getBoundingClientRect:()=>({width:760,height:460})},{getContext:()=>ctx},w);r.draw=()=>{};
  const treads=()=>{const positions=[];r.shape=(kind,p,size)=>{if(kind==='cube'&&size[1]===.014)positions.push(p);};r.scenery.draw();return positions;};
  for(const power of [1,-1]){w.yard.gadgets.power=power;w.time=.1;const before=treads();w.time=.2;const after=treads();for(const [index,belt] of w.yard.gadgets.belts.entries()){const delta=after[index*9+4][2]-before[index*9+4][2];assert.ok(delta*belt.dz*power>0);}}
});
test('Foundry group combat, machines and render transforms remain finite in Full and Lean',()=>{
  const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>({})},{get:(o,k)=>k in o?o[k]:k.toUpperCase()===k?1:()=>({})}),ctx=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}})},{get:(o,k)=>k in o?o[k]:()=>{}});let frames=0;
  for(const detail of ['full','lean'])for(const style of ['mixed','wind','wrestling']){const {w}=fresh();w.setMode('group');w.groupBehavior='live';w.setAssist('easy',style);w.player.health=w.player.maxHealth=10000;w.enemies.forEach(e=>e.health=e.maxHealth=10000);const r=new CombatRenderer.Renderer({getContext:()=>gl,getBoundingClientRect:()=>({width:760,height:460})},{getContext:()=>ctx},w);r.setDetail(detail);const handler=w.onEvent;w.onEvent=e=>{handler(e);r.notify(e);};r.draw=(kind,m)=>assert.ok([...m].every(Number.isFinite),kind);
    for(let i=0;i<360;i++){if(i%8===0)w.attack('P');if(i%120===0)w.cycleTarget();w.step(1/60);r.frame(1/60);frames++;for(const f of w.fighters())assert.ok([f.x,f.y,f.z,f.health,f.stamina].every(Number.isFinite));for(const p of w.yard.props)assert.ok([p.x,p.y,p.z,p.vx,p.vy,p.vz].every(Number.isFinite));}
  }console.log('  '+frames+' Foundry group animation frames');
});
test('the published page references every module in dependency order without duplicate IDs',()=>{
  const base=path.join(__dirname,'../dist'),html=fs.readFileSync(path.join(base,'index.html'),'utf8'),scripts=[...html.matchAll(/<script[^>]*src="([^"?]+)[^"]*"/g)].map(m=>m[1]);for(const file of scripts)assert.ok(fs.existsSync(path.join(base,file)),file);for(const [a,b] of [['gadgets.js','yard.js'],['trials.js','combat.js'],['combat.js','app.js']])assert.ok(scripts.indexOf(a)<scripts.indexOf(b));const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
});
console.log('\n'+checks+' Foundry, trial and input checks passed. Browser/GPU QA is not covered.');
