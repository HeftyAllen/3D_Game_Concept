'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {World,MOVES}=require('../dist/combat.js');
const {Ragdoll,BONES,BODIES,targets}=require('../dist/physics.js');
const {envelope}=require('../dist/motion.js');require('../dist/render.js');
const length=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const fixture=()=>{let r;const events=[],w=new World(e=>{events.push(e);r?.notify(e);},()=>.4),gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>({}),uniform3fv:(loc,v)=>assert.ok([...v].every(Number.isFinite))},{get:(o,k)=>k in o?o[k]:k.toUpperCase()===k?1:()=>({})}),ctx=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}})},{get:(o,k)=>k in o?o[k]:()=>{}});
  r=new CombatRenderer.Renderer({getContext:()=>gl,getBoundingClientRect:()=>({width:720,height:460})},{getContext:()=>ctx},w);r.draw=(kind,m,color,alpha,glow,deform)=>{assert.ok([...m,...color].every(Number.isFinite));if(deform?.spine)assert.ok(deform.spine.flat().every(Number.isFinite));};return {w,r,events};};
const step=(w,r,seconds,fps=60)=>{for(let i=0;i<Math.ceil(seconds*fps);i++){w.step(1/fps);r.frame(1/fps);}};
const clear=w=>{w.yard.props=[];w.yard.pillars=[];w.yard.pads=[];w.hazards=false;w.yard.rebuild();};
const fall=(stance,fps=120,impact={id:1,at:0,zone:'head',power:3.8,direction:[1,0,0],side:1})=>{const d=new Ragdoll();for(let i=0;i<=fps*5;i++)d.step(stance,{id:'enemy',ko:true,down:10,y:0,mass:1,impact},i/fps);return d;};

test('character parts are denser and anatomically distinct with finite unit normals',()=>{
  const old={body:2160,head:2240,limb:1216};for(const [kind,n] of Object.entries(old)){const g=CombatRenderer.geometry(kind);assert.ok(g.p.length/9>n*1.9,kind);for(let i=0;i<g.n.length;i+=3)assert.ok(Math.abs(Math.hypot(...g.n.slice(i,i+3))-1)<1e-5,kind+' normal');}
  const signatures=new Set();for(const kind of ['upperarm','forearm','thigh','calf']){const g=CombatRenderer.geometry(kind);assert.ok([...g.p,...g.n].every(Number.isFinite));signatures.add(JSON.stringify([...g.p.slice(0,90)]));}assert.equal(signatures.size,4);
});
test('mesh generation is reused without changing the returned geometry',()=>{
  const before=CombatRenderer.geometry('body'),after=CombatRenderer.geometry('body');assert.equal(before,after);assert.equal(before.p.length,before.n.length);
});
test('strike timing reaches contact exactly then follows through without an abrupt reset',()=>{
  for(const m of [MOVES.jab,MOVES.roundhouse,MOVES.overhand]){assert.equal(envelope(0,m.startup,m.duration),0);assert.equal(envelope(m.startup,m.startup,m.duration),1);assert.equal(envelope(m.duration,m.startup,m.duration),0);assert.ok(envelope(m.startup*.15,m.startup,m.duration)<.01);assert.ok(envelope(m.startup+.02,m.startup,m.duration)>.99);}
});
test('walking plants alternate feet with small drift rather than sliding both continuously',()=>{
  const {w,r}=fixture();clear(w);w.player.x=0;w.player.z=0;w.enemy.x=4;w.enemy.z=-4;w.locked=false;w.player.angle=0;w.input.x=1;let drift=0,samples=0,left=false,right=false,last={};
  for(let i=0;i<180;i++){w.step(1/120);r.frame(1/120);for(const side of ['L','R']){const plant=r.motion.states.player.plants[side],p=r.rigs.player.pts['foot'+side];if(plant){if(side==='L')left=true;else right=true;}if(plant&&last[side]?.at===plant.at){drift+=Math.hypot(p[0]-last[side].p[0],p[2]-last[side].p[2]);samples++;}last[side]=plant?{at:plant.at,p:[...p]}:null;}}
  assert.ok(left&&right&&samples>60);assert.ok(drift/samples<.015);console.log('  '+(drift/samples*1000).toFixed(1)+' mm mean planted-foot drift');
});
test('a kick frees the striking leg while retaining a support foot',()=>{
  const {w,r}=fixture();clear(w);w.attack('K');step(w,r,.19,120);assert.ok(r.rigs.player.planted.includes('footL'));assert.equal(r.rigs.player.planted.includes('footR'),false);assert.ok(r.rigs.player.pts.footR[1]>.20);
});
test('hips, torso and head react differently to head, body and leg impacts',()=>{
  const shapes=[];for(const zone of ['head','body','leg']){const {w,r}=fixture();clear(w);step(w,r,.1,120);w.player.impact={id:1,at:w.time,zone,power:3,direction:[1,0,0],side:1};w.player.stunned=.4;step(w,r,.12,120);const p=r.rigs.player.pts;shapes.push([p.head[0]-p.pelvis[0],p.chest[0]-p.pelvis[0],p.kneeL[1]]);assert.ok(p.head.every(Number.isFinite));}assert.ok(length(shapes[0],shapes[1])>.025);assert.ok(length(shapes[1],shapes[2])>.025);
});
test('heavier fighters receive less linear and angular impulse',()=>{
  const {w,r}=fixture(),goal=targets(r.buildRig(w.player).pts),hit={id:1,at:0,zone:'head',power:3,direction:[0,0,1],side:1},a=new Ragdoll(),b=new Ragdoll();a.seed(goal,0);b.seed(goal,0);a.impulse(hit,1);b.impulse(hit,4);assert.ok(length(a.nodes.head.v,[0,0,0])>length(b.nodes.head.v,[0,0,0])*1.8);assert.ok(Math.hypot(...a.angular)>Math.hypot(...b.angular)*1.8);
});
test('an airborne victim tilts and rolls instead of preserving an upright stick pose',()=>{
  const {w,r}=fixture();clear(w);w.attack('U');step(w,r,.49,120);const d=r.ragdolls.enemy,s=d.snapshot(),up=s.joints.head.map((v,i)=>v-s.joints.pelvis[i]);assert.equal(d.mode,'air');assert.ok(d.airAngle>.12);assert.ok(Math.hypot(up[0],up[2])>.12);assert.ok(w.enemy.y>.1);
});
test('every downed fighter settles with low energy and valid joint lengths',()=>{
  const {w,r}=fixture(),stance=r.buildRig(w.enemy).pts;for(const fps of [30,60,120]){const d=fall(stance,fps),s=d.snapshot();assert.equal(s.mode,'fall');assert.ok(s.joints.head[1]<.55);assert.ok(s.energy<1);assert.equal(s.sleeping,true);for(const [a,b,n] of BONES)assert.ok(Math.abs(length(s.joints[a],s.joints[b])-n)<.055);}
});
test('a new hit wakes a settled body and does not duplicate its impulse',()=>{
  const {w,r}=fixture(),d=fall(r.buildRig(w.enemy).pts),hit={id:2,at:5,zone:'body',power:3,direction:[1,0,0],side:1};assert.ok(d.sleeping);d.impulse(hit);const v=[...d.nodes.chest.v];assert.equal(d.sleeping,false);assert.ok(length(v,[0,0,0])>1);d.impulse(hit);assert.deepEqual(d.nodes.chest.v,v);
});
test('player and enemy use identical physical rules under the same impact',()=>{
  const {w,r}=fixture(),stance=r.buildRig(w.enemy).pts,a=fall(stance),offset=Object.fromEntries(Object.entries(stance).map(([k,p])=>[k,[p[0]+1.2,p[1],p[2]]])),b=fall(offset);for(const k of Object.keys(BODIES))for(const axis of [0,1,2])assert.ok(Math.abs((b.nodes[k].p[axis]-a.nodes[k].p[axis])-(axis===0?1.2:0))<1e-6);
});
test('staged recovery rises from the settled pose and can blend into an attack',()=>{
  const {w,r}=fixture();clear(w);const points=r.buildRig(w.player).pts,d=fall(points),low=d.nodes.pelvis.p[1];d.step(points,{id:'player',x:w.player.x,z:w.player.z,y:0,down:0,ko:false},5.01);assert.ok(d.recovery<.1);assert.ok(d.nodes.pelvis.p[1]<low+.15);for(let i=1;i<=120;i++)d.step(points,{id:'player',x:w.player.x,z:w.player.z,y:0,down:0,ko:false},5.01+i/120);assert.equal(d.recovery,1);assert.ok(d.nodes.pelvis.p[1]>.75);
});
test('mid-limb contacts detect cover even when both endpoint joints are outside',()=>{
  const {w,r}=fixture();clear(w);const d=new Ragdoll();d.seed(targets(r.buildRig(w.player).pts),0);w.yard.pillars=[{id:'thin',x:0,y:1,z:0,hx:.04,hy:.3,hz:.10}];w.yard.rebuild();d.nodes.elbowL.p=[-.205,1,0];d.nodes.handL.p=[.205,1,0];const before=(d.nodes.elbowL.p[0]+d.nodes.handL.p[0])/2;for(let i=0;i<20;i++)d.capsules(w.yard,w.player,new Set(),new Set());const after=(d.nodes.elbowL.p[0]+d.nodes.handL.p[0])/2;assert.ok(Math.abs(after-before)>.04);
});
test('props cannot push a joint beneath the arena floor',()=>{
  const {w}=fixture();clear(w);const table=w.yard.make('table',0,0);w.yard.props=[table];w.yard.rebuild();const point=[0,.09,0];w.yard.collideNode(point,.1,w.player);assert.ok(point[1]>=.09);assert.ok(Math.abs(point[0])>table.hx||Math.abs(point[2])>table.hz);
});
test('falling bodies make physical contact without displacing a controlled throw',()=>{
  const {w,r}=fixture(),goal=targets(r.buildRig(w.player).pts),a=new Ragdoll(),b=new Ragdoll();a.seed(goal,0);b.seed(Object.fromEntries(Object.entries(goal).map(([k,p])=>[k,[p[0]+.26,p[1],p[2]]])),0);a.mode='fall';b.mode='active';a.nodes.chest.v=[3,0,0];assert.equal(a.collideWith(b),true);assert.ok(a.nodes.chest.v[0]<3);b.mode='controlled';assert.equal(a.collideWith(b),false);assert.ok(Object.values(a.nodes).every(n=>n.p.every(Number.isFinite)));
});
test('torso skin receives a curved spine and limbs stay attached during elastic transitions',()=>{
  const {w,r}=fixture();w.watch('hybrid-reach-flight');let elastic=0,curves=0;for(let i=0;i<240;i++){w.step(1/60);r.frame(1/60);for(const rig of Object.values(r.rigs)){assert.equal(rig.bodyDeform.spine.length,4);curves++;for(const [key,v] of Object.entries(rig.elastic)){const leg=key.startsWith('leg'),side=leg?key.slice(3):key;assert.ok(length(v.curve[0],rig.pts[(leg?'hip':'shoulder')+side])<1e-6);elastic++;}}}assert.ok(elastic>5&&curves>100);
});
test('rapid chained poses stay finite and do not jump across the arena',()=>{
  const {w,r}=fixture();clear(w);w.enemy.health=w.enemy.maxHealth=10000;let last=null,lastAction=null,max=0,maxTransition=0;for(let i=0;i<480;i++){if(i%18===0)w.attack(['P','P','K','H'][Math.floor(i/18)%4]);w.step(1/120);r.frame(1/120);const p=r.rigs.player.pts;for(const v of Object.values(p))assert.ok(v.every(Number.isFinite));const action=w.player.action?.id+':'+w.player.action?.chain;if(last){const delta=Math.max(...['head','pelvis','handL','handR'].map(k=>length(last[k],p[k])));max=Math.max(max,delta);if(action!==lastAction)maxTransition=Math.max(maxTransition,delta);}last=JSON.parse(JSON.stringify(p));lastAction=action;}assert.ok(max<.35);assert.ok(maxTransition<.06,'action change snaps a joint');console.log('  '+max.toFixed(3)+' m fastest strike step; '+(maxTransition*100).toFixed(1)+' cm largest action-transition step at 120 fps');
});
test('pair constraints keep throw hands near the held body and release at landing',()=>{
  const {w,r,events}=fixture();w.watch('german-suplex');let contacts=0;for(let i=0;i<300;i++){w.step(1/120);r.frame(1/120);if(w.grapple?.phase==='throw'&&w.player.visual.phase>.2&&w.player.visual.phase<.75){const a=r.rigs.player.pts,b=r.rigs.enemy.pts;assert.ok(Math.min(length(a.handL,b.pelvis),length(a.handR,b.pelvis))<.7);assert.ok(Math.min(a.footL[1],a.footR[1])<.14);contacts++;}}assert.ok(contacts>5);assert.ok(events.some(e=>e.type==='throwImpact'));assert.equal(w.grapple,null);assert.equal(w.enemy.held,false);assert.ok(w.player.recovery);
});
test('reset and balloon transitions discard old foot anchors and pose velocity',()=>{
  const {w,r}=fixture();step(w,r,.2);assert.ok(r.motion.states.player);w.reset();assert.equal(Object.keys(r.motion.states).length,0);step(w,r,.2);w.balloon.toggle();assert.equal(r.motion.states.player,undefined);step(w,r,.5);w.balloon.toggle();step(w,r,.7);assert.ok(Object.values(r.rigs.player.pts).flat().every(Number.isFinite));
});
test('Full detail adds visible geometry while Lean retains the same rig and dynamics',()=>{
  const {w,r}=fixture();w.setMode('group');let count=0;r.draw=(kind,m,color,alpha,glow,deform)=>{if(r.detail==='lean'&&r.drawingActor){if(['round','head','glove','shoe'].includes(kind))kind='sphere';if(['limb','upperarm','forearm','thigh','calf'].includes(kind))kind='cylinder';}count+=CombatRenderer.geometry(kind).p.length/9;};r.frame(1/60);const full=count;count=0;r.setDetail('lean');r.frame(1/60);assert.ok(count<full*.5);assert.equal(Object.keys(r.rigs).length,4);console.log('  '+full+' Full / '+count+' Lean triangles');
});
test('the page ships motion before rendering and retains all six study routes',()=>{
  const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8');assert.ok(html.indexOf('motion.js')<html.indexOf('render.js'));for(const key of ['one-two-hook','triple-kick','german-suplex','body-slam','launch-one-two','impact'])assert.ok(html.includes('data-study="'+key+'"'));
});
console.log('\n'+checks+' character animation and ragdoll checks passed. Browser/GPU QA is not covered.');
