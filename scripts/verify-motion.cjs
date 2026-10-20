'use strict';
const assert=require('node:assert/strict');
const {World,ROUTES,MOVES}=require('../dist/combat.js');
const {Ragdoll,BONES,BODIES}=require('../dist/physics.js');
require('../dist/render.js');
// Math-only graphics adapters: this is not a browser or GPU test.
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>({})},{get:(o,k)=>k in o?o[k]:k.toUpperCase()===k?1:()=>({})});
const ctx=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}})},{get:(o,k)=>k in o?o[k]:()=>{}});
const fixture=()=>{
  const events=[];let renderer;
  const world=new World(e=>{events.push(e);renderer?.notify(e);},()=>.4);
  renderer=new CombatRenderer.Renderer({getContext:()=>gl,getBoundingClientRect:()=>({width:640,height:420})},{getContext:()=>ctx},world);
  renderer.impact=false;
  renderer.draw=(kind,m,color,alpha,glow,deform)=>{
    assert.ok([...m].every(Number.isFinite),kind+' finite transform');
    if(deform?.curve){assert.ok(deform.curve.flat().every(Number.isFinite));assert.ok(deform.radius>0);}
  };
  return {world,renderer,events};
};
const selected=process.argv.includes('--throws')?ROUTES.filter(r=>r.steps.some(id=>MOVES[id].throwType)):ROUTES;
let frames=0,elasticFrames=0,maxBoneError=0;
for(let index=0;index<selected.length;index++){
  const route=selected[index],{world:w,renderer:r,events}=fixture();w.watch(route.id);
  for(let frame=0;frame<300;frame++){
    w.step(1/30);r.frame(1/30);frames++;
    for(const id of ['player','enemy']){
      const rig=r.rigs[id];
      for(const point of Object.values(rig.pts))assert.ok(point.every(Number.isFinite),route.id+' joint');
      for(const [key,n] of Object.entries(r.ragdolls[id].nodes))assert.ok(n.p[1]>=BODIES[key][1]-.000001,route.id+' floor penetration '+key);
      for(const [key,limb] of Object.entries(rig.elastic)){
        elasticFrames++;const side=key.startsWith('leg')?key.slice(3):key,base=rig.pts[(key.startsWith('leg')?'hip':'shoulder')+side];
        assert.ok(Math.hypot(...limb.curve[0].map((v,i)=>v-base[i]))<1e-6,route.id+' detached power');
      }
    }
  }
  assert.deepEqual(events.filter(e=>e.type==='connect').map(e=>e.move),route.steps.map(id=>MOVES[id].name),route.id+' with physics');
  assert.ok(events.some(e=>e.type==='route'&&e.route.id===route.id),route.id+' completion');
  if((index+1)%50===0)console.log('PASS '+(index+1)+' integrated combo routes');
}
const {world:w,renderer:r}=fixture(),stance=r.buildRig(w.enemy).pts;
const dolls=[new Ragdoll(),new Ragdoll()];
const refs=dolls.map((_,index)=>Object.fromEntries(Object.entries(stance).map(([k,p])=>[k,[p[0]+index*1.2,p[1],p[2]]])));
for(let frame=0;frame<=600;frame++)for(let index=0;index<2;index++){
  const f={id:index?'enemy':'player',ko:true,down:10,y:0,held:false,visual:null,action:null,tumbling:true,impact:{id:1,zone:'head',power:3.8,direction:[1,0,0],side:1}};
  dolls[index].step(refs[index],f,frame/120);
}
for(const doll of dolls){
  const s=doll.snapshot();assert.equal(s.mode,'fall');assert.ok(s.joints.head[1]<.55,'body settles to floor');assert.ok(s.energy<1,'impact energy dissipates');
  for(const [a,b,length] of BONES){const error=Math.abs(Math.hypot(...s.joints[a].map((v,i)=>v-s.joints[b][i]))-length);maxBoneError=Math.max(maxBoneError,error);assert.ok(error<.055,'bone constraint '+a+' '+b);}
}
for(const key of Object.keys(BODIES))for(const axis of [0,1,2])assert.ok(Math.abs((dolls[1].nodes[key].p[axis]-dolls[0].nodes[key].p[axis])-(axis===0?1.2:0))<1e-6,'same physics on both fighters');
console.log('PASS both fighters fall, settle, and preserve bone lengths');
const drill=fixture();drill.world.dummy='active';drill.world.player.health=1000;
let playerFall=false,playerRecovery=false;
for(let frame=0;frame<720;frame++){drill.world.step(1/60);drill.renderer.frame(1/60);playerFall ||=drill.renderer.ragdolls.player.mode==='fall';playerRecovery ||=drill.renderer.ragdolls.player.recovery<.9;}
assert.ok(playerFall&&playerRecovery,'player fall and physical recovery');
console.log('PASS live player reactions and get-up transition');
console.log(JSON.stringify({routes:selected.length,poseFrames:frames,elasticFrames,maxBoneError}));
console.log('Renderer and physics math passed. Browser visual QA is not covered.');
