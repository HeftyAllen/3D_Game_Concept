'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {World,MOVES,ROUTES}=require('../dist/combat.js');require('../dist/physics.js');require('../dist/render.js');
const Contact=require('../dist/contact.js'),Wrestling=require('../dist/wrestling.js'),{ActionCamera,actionPoints}=require('../dist/camera.js');
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const fixture=(width=720,height=460)=>{let r;const events=[],w=new World(e=>{events.push(e);r?.notify(e);},()=>.4),gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>({})},{get:(o,k)=>k in o?o[k]:k.toUpperCase()===k?1:()=>({})}),ctx=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}})},{get:(o,k)=>k in o?o[k]:()=>{}});r=new CombatRenderer.Renderer({getContext:()=>gl,getBoundingClientRect:()=>({width,height})},{getContext:()=>ctx},w);r.draw=()=>{};r.environment=()=>{};r.impact=false;return {w,r,events};};
const clear=w=>{w.yard.props=[];w.yard.pillars=[];w.yard.pads=[];w.hazards=false;w.yard.rebuild();};
const ndc=(p,eye,at,aspect,fov)=>{const unit=a=>a.map(v=>v/(Math.hypot(...a)||1)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),back=unit(eye.map((v,i)=>v-at[i])),right=unit(cross([0,1,0],back)),up=cross(back,right),d=p.map((v,i)=>v-eye[i]),z=-dot(d,back),tan=Math.tan(fov/2);return [dot(d,right)/(z*tan*aspect),dot(d,up)/(z*tan),z];};
const insideRendered=(r,points)=>{for(const p of points){const screen=r.project(p);assert.ok(screen,'rendered depth');assert.ok(screen[0]>r.width*.065&&screen[0]<r.width*.935,'rendered horizontal');assert.ok(screen[1]>r.height*.16&&screen[1]<r.height*.91,'rendered vertical');}};
const inside=(points,c,aspect)=>{for(const p of points){const [x,y,z]=ndc(p,c.eye,c.at,aspect,c.fov);assert.ok(z>.08,'near plane');assert.ok(Math.abs(x)<.87,'horizontal frame '+x);assert.ok(y<.68&&y>-.82,'vertical frame '+y);}};

test('all throw types use distinct, persistent left/right attachments',()=>{
  for(const grip of ['front','bodylock','rear'])for(const type of ['hip','shoulder','doubleleg','bodyslam','belly','vertical','german','back','return']){const spec=Wrestling.grips(type,grip);assert.notDeepEqual(spec.L,spec.R);for(const q of [.1,.4,.7])assert.deepEqual(Wrestling.grips(type,grip),spec);}
  assert.equal(Wrestling.release('hip',.7),1);assert.equal(Wrestling.release('hip',.98),0);assert.equal(Wrestling.release('pickup',1),1);
});
test('every physical throw stays connected, keeps torso volume, and lands once',()=>{
  const seen=new Set();let sampled=0,maxGap=0;
  for(const route of ROUTES){const type=route.steps.map(id=>MOVES[id].throwType).find(x=>x&&!seen.has(x));if(!type)continue;seen.add(type);const {w,r,events}=fixture();w.watch(route.id);clear(w);let contacts=0;
    for(let i=0;i<210;i++){w.step(1/60);r.frame(1/60);const g=w.grapple;if(g?.phase==='throw'&&g.type===type&&g.owner.visual.phase>.18&&g.owner.visual.phase<.74){const a=r.rigs[g.owner.id],b=r.rigs[g.target.id];if(type!=='elastic'){for(const side of ['L','R']){assert.ok(a.gripGoals[side]);const gap=distance(a.pts['hand'+side],a.gripGoals[side]);maxGap=Math.max(maxGap,gap);assert.ok(gap<.075,type+' detached '+side+' '+gap);}const [p,q]=Wrestling.segmentPair(a.pts.pelvis,a.pts.chest,b.pts.pelvis,b.pts.chest);assert.ok(distance(p,q)>.315,type+' torso overlap');}contacts++;sampled++;}
      for(const rig of Object.values(r.rigs))for(const p of Object.values(rig.pts))assert.ok(p.every(Number.isFinite));
    }assert.ok(contacts>10,type+' sampled');assert.equal(events.filter(e=>e.type==='throwImpact').length,1,type+' impact');assert.equal(w.grapple,null);assert.equal(w.enemy.held,false);
  }assert.equal(seen.size,11);console.log('  '+sampled+' loaded poses; maximum grip gap '+(maxGap*100).toFixed(1)+' cm');
});
test('enemy-owned throws use their actual partner at different world orientations',()=>{
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){const {w,r,events}=fixture();clear(w);w.enemy.x=1.5;w.enemy.z=.5;w.enemy.angle=yaw;w.player.x=w.enemy.x+Math.sin(yaw)*.6;w.player.z=w.enemy.z+Math.cos(yaw)*.6;w.player.angle=yaw;w.beginGrip(w.enemy,w.player,'rear');w.enemy.chain='GCC';w.enemy.chainUntil=w.time+2;assert.ok(w.start(w.enemy,w.player,'U'));let loaded=0;
    for(let i=0;i<85;i++){w.step(1/60);r.frame(1/60);if(w.grapple?.phase==='throw'&&w.enemy.visual.phase>.22&&w.enemy.visual.phase<.7){const a=r.rigs.enemy;for(const side of ['L','R'])assert.ok(distance(a.pts['hand'+side],a.gripGoals[side])<.075);loaded++;}}
    assert.ok(loaded>8);assert.ok(events.some(e=>e.type==='throwImpact'&&e.target==='player'));
  }
});
test('the sweep frees the reaping foot and retains the other support',()=>{
  const {w,r}=fixture();w.watch('clinch-sweep');clear(w);let samples=0;for(let i=0;i<65;i++){w.step(1/60);r.frame(1/60);if(w.player.visual?.pair==='sweep'&&w.player.visual.phase>.25&&w.player.visual.phase<.65){assert.deepEqual(r.rigs.player.planted,['footR']);samples++;}}assert.ok(samples>5);
});
test('mounts stay centered and ground strikes meet the physical body surface',()=>{
  const {w,r,events}=fixture();w.watch('slam-mount');clear(w);let hits=0,start=null,maxDrift=0;const sampled=new Set();
  for(let i=0;i<340;i++){w.step(1/60);r.frame(1/60);if(w.ground?.mounted&&!w.grapple){const a=w.ground.owner,b=w.ground.target;if(!start)start=[b.x,b.z];maxDrift=Math.max(maxDrift,Math.hypot(b.x-start[0],b.z-start[1]));assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.22,'mount pushed apart');const action=a.action;if(action?.move.ground&&action.connected&&!sampled.has(action.id+action.chain)){const contacts=events.filter(e=>e.type==='connect'&&e.id===action.id&&e.ground);assert.ok(contacts.length,'ground strike has an actual contact');const hit=contacts.at(-1),shapes=Contact.attacks(w,a,r.rigs[a.id],action);assert.ok(hit.contact?.point,'surface point recorded');assert.ok(shapes.some(shape=>Contact.closest(shape.a,shape.b,hit.contact.point,hit.contact.point).distance<shape.r+.12),'striking joint misses recorded surface');sampled.add(action.id+action.chain);hits++;}}}
  assert.ok(hits>=3);assert.ok(maxDrift<.3,'mount drifts across floor '+maxDrift);assert.ok(events.some(e=>e.type==='route'&&e.route.id==='slam-mount'));
});
test('moving a mounted pair against cover preserves its relative placement',()=>{
  const {w}=fixture();w.ground={owner:w.player,target:w.enemy,mounted:true};const before=[w.enemy.x-w.player.x,w.enemy.z-w.player.z];w.yard.movePair(w.player,.6,-.4);assert.deepEqual([w.enemy.x-w.player.x,w.enemy.z-w.player.z],before);w.separateFighters();assert.ok(Math.abs((w.enemy.x-w.player.x)-before[0])<1e-8);
});
test('a rotating throw uses its real body height when it meets Foundry cover',()=>{
  const {w,events}=fixture();w.arenaId='foundry';w.watch('reel-belly');for(let i=0;i<480;i++)w.step(1/60);assert.ok(events.some(e=>e.type==='route'&&e.route.id==='reel-belly'));assert.ok(events.some(e=>e.type==='envHit'&&e.propType==='glass'));
});
test('camera fits both fighters through high juggles at wide, square and portrait sizes',()=>{
  for(const aspect of [.52,.8,1,1.6,2.4])for(const yaw of [0,.43,Math.PI/2,Math.PI,-1.2]){const camera=new ActionCamera();for(let i=0;i<180;i++){const t=i/30,h=Math.max(0,Math.sin(t*1.8))*11,points=[[-1,0,1],[-1,2.3,1],[2,h,-1],[2,h+2.4,-1],[3.1,h+1.1,-2]];const c=camera.update(points,{dt:1/30,aspect,yaw,zoom:5.5,air:h,shake:.24,time:t});inside(points,c,aspect);}}
});
test('a sudden launch and immediate orbit or resize cannot outrun the framing',()=>{
  const camera=new ActionCamera();camera.update([[0,0,0],[0,2,0]],{dt:1/60});const points=[[-4,0,2],[3,14,-3],[3,16,-3]];
  for(const aspect of [2.2,.5,1.3])for(const yaw of [Math.PI,.1,-2])inside(points,camera.update(points,{dt:1/120,aspect,yaw,zoom:5.5,air:14}),aspect);
});
test('zoom returns gradually after landing and reset discards the previous target',()=>{
  const camera=new ActionCamera(),high=[[0,0,0],[1,14,0]],low=[[0,0,0],[1,2.2,0]];const a=camera.update(high,{zoom:5.5,aspect:1}),b=camera.update(low,{zoom:5.5,aspect:1,dt:1/60});assert.ok(b.distance<a.distance&&b.distance>a.distance*.9);for(let i=0;i<240;i++)camera.update(low,{zoom:5.5,aspect:1,dt:1/60});assert.ok(camera.distance<a.distance*.7);camera.reset();assert.equal(camera.at,null);const c=camera.update([[20,1,20],[21,2,21]],{});assert.ok(c.at[0]>20&&c.at[2]>20);
});
test('actual rendered juggles, elastic reaches and group enemies remain inside the frame',()=>{
  const {w,r}=fixture(360,620);for(const id of ['launch-one-two','hybrid-reach-flight','vertical-suplex']){w.watch(id);clear(w);r.zoom=5.5;for(let i=0;i<170;i++){w.step(1/60);r.frame(1/60);inside(actionPoints(w.fighters(),r.rigs),r.cameraFrame,r.width/r.height);insideRendered(r,actionPoints(w.fighters(),r.rigs));}}
  w.setMode('group');clear(w);for(const [i,f] of w.fighters().entries()){f.x=(i%2?1:-1)*4;f.z=i<2?-3:3;}w.enemy.y=8;w.enemy.vy=5;w.enemy.tumbling=true;r.yaw=2.4;r.frame(1/60);inside(actionPoints(w.fighters(),r.rigs),r.cameraFrame,r.width/r.height);insideRendered(r,actionPoints(w.fighters(),r.rigs));
});
test('manual tilt stays bounded and preserves the full air frame',()=>{
  const points=[[-3,0,0],[2,10,2],[2,12,2]],camera=new ActionCamera();for(const tilt of [-.18,.24])for(let i=0;i<90;i++){const c=camera.update(points,{dt:1/60,tilt,air:10,aspect:.6,yaw:1.2,zoom:5.5});assert.ok(c.elevation>=.27&&c.elevation<=.78);inside(points,c,.6);}
});
test('camera and wrestling scripts ship in dependency order',()=>{
  const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8');assert.ok(html.indexOf('wrestling.js')<html.indexOf('combat.js'));assert.ok(html.indexOf('camera.js')<html.indexOf('render.js'));assert.ok(html.includes('AUTO FRAME'));
});
console.log('\n'+checks+' wrestling alignment and camera checks passed. Browser/GPU QA is not covered.');
