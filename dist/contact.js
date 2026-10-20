/* Geometric combat contacts. Sweeps follow the animated skeleton, never a root-distance hit box. */
(function(root){
  'use strict';
  const Physics=root.CombatPhysics||(typeof require==='function'?require('./physics.js'):null);
  const Rig=root.CombatRig||(typeof require==='function'?require('./rig.js'):null);
  const {V,C,bezier}=Rig,lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),length=a=>Math.hypot(...a),add=(a,b)=>a.map((v,i)=>v+b[i]);
  function closest(a,b,c,d){
    const u=V.sub(b,a),v=V.sub(d,c),w=V.sub(a,c),A=V.dot(u,u),B=V.dot(u,v),D=V.dot(v,v),E=V.dot(u,w),F=V.dot(v,w);let s=0,t=0;
    if(A<1e-10&&D<1e-10)return {a:a.slice(),b:c.slice(),distance:length(w)};
    if(A<1e-10)t=C(F/D,0,1);else if(D<1e-10)s=C(-E/A,0,1);else{const det=A*D-B*B;s=det>1e-10?C((B*F-E*D)/det,0,1):0;t=(B*s+F)/D;if(t<0){t=0;s=C(-E/A,0,1);}else if(t>1){t=1;s=C((B-E)/A,0,1);}}
    const p=lerp(a,b,s),q=lerp(c,d,t);return {a:p,b:q,distance:length(V.sub(p,q))};
  }
  function overlap(a,b){const c=closest(a.a,a.b,b.a,b.b),r=a.r+b.r;if(c.distance>r)return null;const normal=c.distance>1e-7?V.unit(V.sub(c.b,c.a)):[0,0,1];return {point:c.b.map((v,i)=>v-normal[i]*b.r),normal,depth:r-c.distance,joint:b.joint,zone:b.zone};}
  function segmentBox(a,b,c,r=0){let lo=0,hi=1;for(let i=0;i<3;i++){const k=['x','y','z'][i],h=c[['hx','hy','hz'][i]]+r,d=b[i]-a[i],min=c[k]-h,max=c[k]+h;if(Math.abs(d)<1e-8){if(a[i]<min||a[i]>max)return null;continue;}let x=(min-a[i])/d,y=(max-a[i])/d;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)return null;}return lo;}
  // Swept sphere versus the same capsules used by fists, feet and the visible rig.
  function projectile(world,f,from,to,r=.045){
    const rig=world.contacts?.poses[f.id]||world.contacts?.sample(f);if(!rig)return null;
    let first=null;const delta=V.sub(to,from),dd=V.dot(delta,delta);
    for(const capsule of body(rig,f)){const near=closest(from,to,capsule.a,capsule.b),radius=capsule.r+r;if(near.distance>radius)continue;
      const inside=p=>closest(p,p,capsule.a,capsule.b).distance<=radius;
      let lo=0,hi=dd>1e-10?C(V.dot(V.sub(near.a,from),delta)/dd,0,1):0;
      if(!inside(from)){for(let i=0;i<20;i++){const t=(lo+hi)/2;if(inside(lerp(from,to,t)))hi=t;else lo=t;}}
      else hi=0;if(first===null||hi<first)first=hi;
    }return first;
  }
  function muzzle(world,f,reach=.1){
    const rig=world.contacts?.poses[f.id]||world.contacts?.sample(f,null,false),hand=rig?.pts.handR||[f.x,f.y+1.48,f.z],shoulder=rig?.pts.shoulderR||[f.x,f.y+1.48,f.z],origin=hand.map((v,i)=>v+(i===0?Math.sin(f.angle):i===2?Math.cos(f.angle):0)*reach);
    // A hand clipping a wall cannot spawn a projectile on the far side.
    let t=1;for(const c of world.yard.solids){const hit=segmentBox(shoulder,origin,c,.045);if(hit!==null)t=Math.min(t,Math.max(0,hit-.01));}
    return lerp(shoulder,origin,t);
  }
  function descriptor(m){const v=m.pose,leg=m.limb?m.limb.startsWith('leg'):/kick|knee|stomp|oblique|sweep|slam|airspin/i.test(v)&&!m.throwType,side=m.limb==='L'||m.limb==='legL'||/jab|hook|ridge|leadupper|airlift|shovel|backfist|leadkick|kneelead/.test(v)?'L':'R',kind=/knee/i.test(v)?'knee':v==='elbow'||v==='groundelbow'?'elbow':leg?'foot':'hand';return {side,kind,joint:kind+side};}
  function zone(m){return m.zone||(m.capture?'body':/lowkick|oblique|sweep/.test(m.pose)?'leg':/body|knee|roundhouse|frontkick|sidekick|shovel/.test(m.pose)?'body':m.ground?'floor':'head');}
  function geometric(m){return !m.wind&&!m.lightning&&!m.element&&!m.ranged&&!m.reload&&!m.propPickup&&!m.propFetch&&!m.propThrow&&!m.throwType&&!m.pickup&&!m.mount&&!m.pull&&!m.grip&&!m.release;}
  function body(rig,f){
    const p=rig.pts,b=f.bulk||1,result=[],mid=(a,b)=>lerp(a,b,.5),pelvis=p.pelvis||mid(p.hipL,p.hipR),shoulders=mid(p.shoulderL,p.shoulderR),neck=p.neck||lerp(shoulders,p.head,.40);
    const put=(a,b,r,joint,zone)=>result.push({a:a.slice(),b:b.slice(),r,joint,zone});
    if(f.balloon){const center=[f.x,f.y+(f.balloon.radius||.9),f.z];put(center,center,f.balloon.radius||.9,'balloon','body');return result;}
    put(p.head,p.head,.19*b,'head','head');put(neck,p.head,.087*b,'neck','head');put(pelvis,p.torso,.19*b,'pelvis','body');put(p.torso,shoulders,.23*b,'chest','body');put(p.shoulderL,p.shoulderR,.115*b,'shoulders','body');
    for(const side of ['L','R']){put(p['shoulder'+side],p['elbow'+side],.092*b,'upperarm'+side,'body');put(p['elbow'+side],p['hand'+side],.076*b,'forearm'+side,'body');put(p['hand'+side],p['hand'+side],.115*b,'hand'+side,'body');put(p['hip'+side],p['knee'+side],.105*b,'thigh'+side,'leg');put(p['knee'+side],p['foot'+side],.078*b,'calf'+side,'leg');put(p['foot'+side],p['foot'+side],.12*b,'foot'+side,'leg');}
    return result;
  }
  function weaponFrame(f,rig,p){
    const a=f.action,m=a?.move,hand=rig.pts.handR,goal=a?.contactAim?.targetPoint,phase=a?C(a.t/m.startup,0,1):0,active=m?.weapon;
    let axis=active&&goal?V.unit(V.sub(goal,hand)):[Math.sin(f.angle),.25,Math.cos(f.angle)];
    if(active){const heavy=/Heavy/.test(m.pose),thrust=m.pose==='staffThrust'||m.pose==='gunButt',sign=/Back/.test(m.pose)?-1:1,arc=thrust?0:(phase<1?(1-phase)*-1.35:(a.t-m.startup)*7)*sign;
      if(heavy){const pitch=(1-phase)*1.5;axis=V.unit([axis[0]*Math.cos(pitch),Math.sin(pitch)+axis[1]*Math.cos(pitch),axis[2]*Math.cos(pitch)]);}else{const x=axis[0],z=axis[2];axis=[x*Math.cos(arc)+z*Math.sin(arc),axis[1],z*Math.cos(arc)-x*Math.sin(arc)];}}
    const right=V.unit(V.cross([0,1,0],axis)),up=V.unit(V.cross(axis,right)),rot=[...right,...up,...axis],center=hand.map((v,i)=>v+right[i]*(p.hx+.04)+up[i]*.04);
    return {rot,center,a:center.map((v,i)=>v-axis[i]*p.hz),b:center.map((v,i)=>v+axis[i]*p.hz)};
  }
  function weapons(world,f,rig){const p=world.yard.held(f);if(!p)return [];const frame=weaponFrame(f,rig,p);return [{a:frame.a,b:frame.b,r:Math.max(.06,Math.min(p.hx,p.hy)),joint:'weapon',zone:'weapon',prop:p}];}
  function attacks(world,f,rig,a){const m=a.move,d=descriptor(m),pts=rig.pts;if(m.weapon)return weapons(world,f,rig);
    const shape=(point,end,r,joint)=>({a:point,b:end,r,joint,zone:zone(m)});
    const keys=m.capture||m.limb==='both'?['L','R']:[d.side],result=[];
    for(const side of keys){const key=d.kind+side,tip=pts[key];if(!tip)continue;const elastic=rig.elastic[m.limb?.startsWith('leg')?'leg'+side:side];
      if(elastic){let from=bezier(elastic.curve,.72);for(let i=1;i<=6;i++){const to=bezier(elastic.curve,.72+.28*i/6);result.push(shape(from,to,i===6?.13:elastic.radius,key));from=to;}}
      else if(d.kind==='foot'){const forward=[Math.sin(f.angle)*.14,0,Math.cos(f.angle)*.14];result.push(shape(tip,add(tip,forward),.115,key));}
      else result.push(shape(tip,tip,d.kind==='knee'?.13:d.kind==='elbow'?.11:.13,key));
    }return result;
  }
  class Contacts{
    constructor(world){this.world=world;this.poseWorld=Object.create(world);this.rig=new Rig.Humanoid(this.poseWorld,{pure:true});this.before={};this.serial=0;this.last=[];this.dolls=Object.fromEntries(world.fighters().map(f=>[f.id,new Physics.Ragdoll()]));this.performance=new Rig.Humanoid(world,{ragdolls:this.dolls});this.poses={};this.poseTime=-1;this.physical={};}
    onEvent(e){if(e.type==='balloonInflate'||e.type==='balloonExit'){delete this.performance.motion.states.player;delete this.performance.footMemory.player;delete this.performance.elasticMemory.player;}if(e.type==='landingRecovery'){const d=this.dolls[e.by];if(d&&Object.keys(d.nodes).length){d.recoveryFrom=d.positions();d.recovery=.65;d.mode='active';d.sleeping=false;d.sleepTime=0;}if(this.performance.motion.states[e.by])this.performance.motion.states[e.by].plants={};}}
    snapshot(f){return {...f,action:f.action?{...f.action}:null,visual:f.visual?{...f.visual}:null,dodge:f.dodge?{...f.dodge}:null};}
    sync(){
      const w=this.world,actors=w.fighters(),h=this.performance;h.rigs=Object.fromEntries(actors.map(f=>[f.id,h.buildRig(f)]));
      for(const f of actors)h.connectArms(f,h.rigs[f.id],w.targetFor(f));
      for(const f of actors){const rig=h.rigs[f.id];h.stretchLimbs(f,rig,w.targetFor(f));h.objectArms(f,rig);h.motion.plant(f,rig,Rig.solveLeg);h.weaponGrip(f,rig);}
      this.physical={};
      for(const f of actors){const rig=h.rigs[f.id],doll=this.dolls[f.id]??=new Physics.Ragdoll();if(f.balloon){doll.balloon=true;continue;}if(doll.balloon){this.dolls[f.id]=new Physics.Ragdoll();this.dolls[f.id].seed(Physics.targets(rig.pts),w.time);delete doll.balloon;}
        const d=this.dolls[f.id],dynamic=f.held||f.visual||f.down>0||f.ko||f.tumbling||f.stunned>0&&w.time-(f.impact?.at??-10)<.55||d.mode!=='active'||d.recovery<1;
        if(dynamic){rig.pts=d.step(rig.pts,f,w.time,rig.elastic,w.yard,rig.planted);if(d.mode==='fall'&&!f.held){f.x=rig.pts.pelvis[0];f.z=rig.pts.pelvis[2];}this.physical[f.id]=true;}
        else{const goal=Physics.targets(rig.pts),floor=f.elementSupport?.top||0;for(const [key,p]of Object.entries(goal))p[1]=Math.max(Physics.BODIES[key][1]+floor,p[1]);d.seed(goal,w.time);d.floor=floor;rig.pts=d.positions();}
        for(const [key,limb] of Object.entries(rig.elastic)){const leg=key.startsWith('leg'),side=leg?key.slice(3):key,base=rig.pts[(leg?'hip':'shoulder')+side],shift=V.sub(base,limb.curve[0]);limb.curve[0]=base;limb.curve[1]=add(limb.curve[1],shift);rig.pts[(leg?'foot':'hand')+side]=limb.fold?limb.fold[3]:limb.curve[3];rig.pts[(leg?'knee':'elbow')+side]=limb.fold?limb.curve[3]:bezier(limb.curve,.46);}
      }
      const touched=new Set();for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){const a=actors[i],b=actors[j];if(a.balloon||b.balloon||a.held||b.held||w.grapple||w.ground||a.action&&geometric(a.action.move)||b.action&&geometric(b.action.move)||(!this.physical[a.id]&&!this.physical[b.id])||Math.hypot(a.x-b.x,a.z-b.z)>2.5)continue;if(this.dolls[a.id].collideWith(this.dolls[b.id])){touched.add(a.id);touched.add(b.id);}}
      for(const f of actors)if(touched.has(f.id)){h.rigs[f.id].pts=this.dolls[f.id].positions();if(this.dolls[f.id].mode==='fall'){f.x=h.rigs[f.id].pts.pelvis[0];f.z=h.rigs[f.id].pts.pelvis[2];this.dolls[f.id].lastRoot=[f.x,f.z];}}
      for(const f of actors){h.connectArms(f,h.rigs[f.id],w.targetFor(f));h.attackAim(f,h.rigs[f.id]);h.weaponGrip(f,h.rigs[f.id]);for(const [key,limb]of Object.entries(h.rigs[f.id].elastic)){const leg=key.startsWith('leg'),side=leg?key.slice(3):key,end=h.rigs[f.id].pts[(leg?'foot':'hand')+side],curve=limb.fold||limb.curve,shift=V.sub(end,curve[3]);curve[3]=end;curve[2]=add(curve[2],shift);}h.rememberContactPose(f,h.rigs[f.id]);const item=w.yard.held(f);if(item){const frame=weaponFrame(f,h.rigs[f.id],item);f.propSocket={id:item.id,x:frame.center[0],y:frame.center[1],z:frame.center[2]};}}
      this.poses=h.rigs;this.poseTime=w.time;
    }
    begin(){this.beforePoses=this.poses;this.before=Object.fromEntries(this.world.fighters().map(f=>[f.id,this.snapshot(f)]));}
    sample(f,t=null,usePhysics=true){const q=this.snapshot(f);if(t!==null&&q.action)q.action={...q.action,t};this.poseWorld.time=this.world.time;this.rig.elasticMemory={};this.rig.footMemory={};const rig=this.rig.buildRig(q);this.rig.rigs[q.id]=rig;const other=this.world.targetFor(q);if(other){const target=this.rig.buildRig(other);this.rig.rigs[other.id]=target;if(q.action?.move.elastic)this.rig.stretchLimbs(q,rig,other);if(q.visual)this.rig.connectArms(q,rig,other);}
      if(usePhysics&&this.physical[f.id]&&this.poses[f.id]&&!f.action){const cached=this.poses[f.id].pts,origin=cached.pelvis||[f.x,f.y,f.z],real=this.world.getFighter(f.id),shift=[f.x-real.x,f.y-real.y,f.z-real.z];rig.pts=Object.fromEntries(Object.entries(cached).map(([key,p])=>[key,add(p,shift)]));}
      return rig;}
    predict(target,seconds,z,desc){
      const original=this.dolls[target.id];if(!original||!Object.keys(original.nodes).length||!(this.world.airHeight(target)>.1||target.down>0||target.tumbling))return null;
      const doll=Object.assign(new Physics.Ragdoll(),JSON.parse(JSON.stringify(original))),q=this.snapshot(target),world=Object.create(this.world);q.action=null;world.time=this.world.time;
      const motion=new (root.CombatMotion.Motion)(world);motion.states=JSON.parse(JSON.stringify(this.performance.motion.states));
      const sampler=new Rig.Humanoid(world,{motion,ragdolls:{[q.id]:doll}});let points=doll.positions(),remaining=seconds;
      while(remaining>1e-6){const dt=Math.min(1/120,remaining);remaining-=dt;world.time+=dt;q.x+=q.vx*dt;q.z+=q.vz*dt;q.vx*=Math.exp(-8*dt);q.vz*=Math.exp(-8*dt);
        if((q.y>0||q.vy>0)&&!q.elementSupport){q.vy-=10.5*dt;q.y=Math.max(0,q.y+q.vy*dt);if(q.y===0)q.vy=0;}
        if(q.recovery){const r=q.recovery,t=C((world.time-r.at)/(r.duration||.36),0,1),e=t*t*(3-2*t);q.visual={height:r.height+(q.y+1-r.height)*e,pitch:r.pitch*(1-e),role:'recovering'};if(t===1){q.visual=null;q.recovery=null;}}
        const rig=sampler.buildRig(q);points=doll.step(rig.pts,q,world.time,{},world.yard);if(doll.mode==='fall'){q.x=points.pelvis[0];q.z=points.pelvis[2];}
      }
      if(z==='leg')return lerp(points['hip'+desc.side],points['knee'+desc.side],.78);if(z==='body')return desc.kind==='knee'?lerp(points.pelvis,points.torso,.65):points.torso.slice();if(z==='floor')return points.torso.slice();if(this.world.airHeight(target)>.1||target.tumbling)return lerp(points.chest,points.torso,.25);return points.head.map((v,i)=>v+(i===1?-.065:0));
    }
    prepare(f,target,a){
      const m=a.move;if(!geometric(m))return;const desc=descriptor(m),z=zone(m),r=this.sample(m.air&&this.world.airHeight(target)>.1?{...target,visual:null,recovery:null,down:0}:target,null,!(m.air&&this.dolls[target.id]?.mode==='fall')),pts=r.pts,prop=a.aimProp&&this.world.yard.props.find(p=>p.id===a.aimProp);
      let point=prop?[prop.x,prop.y+prop.hy*.45,prop.z]:m.ground?pts.torso.slice():z==='leg'?['L','R'].map(side=>lerp(pts['hip'+side],pts['knee'+side],.78)).sort((a,b)=>Math.hypot(a[0]-f.x,a[2]-f.z)-Math.hypot(b[0]-f.x,b[2]-f.z))[0]:z==='body'?(desc.kind==='knee'?lerp(lerp(pts.hipL,pts.hipR,.5),pts.torso,.65):pts.torso.slice()):pts.head.map((v,i)=>v+(i===1?-.065:0));
      const predicted=!prop&&!target.held?this.predict(target,m.startup,z,desc):null;if(predicted)point=predicted;
      // A high strike stays high instead of aiming down into a duck at commit time.
      if(!prop&&z==='head'&&target.mobility?.crouch>.05&&!target.tumbling&&this.world.airHeight(target)<.12)point[1]=Math.max(point[1],target.y+1.89);
      const h=m.startup,decay=(1-Math.exp(-8*h))/8;if(!predicted&&!prop&&!target.held){point[0]+=(target.vx||0)*decay;point[2]+=(target.vz||0)*decay;if(this.world.airHeight(target)>0||target.vy>0)point[1]+=Math.max(-target.y,(target.vy||0)*h-5.25*h*h);}
      if(!this.world.locked&&f.id==='player'){const forward=Math.max(.80,Math.sin(f.angle)*(point[0]-f.x)+Math.cos(f.angle)*(point[2]-f.z));point[0]=f.x+Math.sin(f.angle)*forward;point[2]=f.z+Math.cos(f.angle)*forward;}
      const targetPoint=point.slice(),item=this.world.yard.held(f);if(m.weapon&&item){const dir=V.unit(V.sub(point,[f.x,f.y+1.5,f.z]));point=point.map((v,i)=>v-dir[i]*item.hz*.85);desc.kind='hand';desc.side='R';desc.joint='handR';}
      a.contactAim={...desc,point,targetPoint,zone:z,anchor:m.heldStrike?point.map((v,i)=>v-[target.x,target.y,target.z][i]):null};a.contactStart=Math.max(.01,m.pose==='upkick'?m.startup*.52:m.startup-.018);a.traceStart=m.startup*.50;a.contactEnd=Math.min(m.cancel-.005,m.startup+.065);a.contactChecked=0;if(m.ground&&this.world.airHeight(f)>.12)a.airTrack={from:f.y,to:target.elementSupport?.top||0,landing:true};if(m.air&&!m.elastic&&(!f.mobility?.voluntary||this.world.airHeight(target)>.18)){a.airTrack={from:f.y,to:Math.max(.06,point[1]-(desc.kind==='foot'?1.20:desc.kind==='knee'?1.22:1.59))};}
    }
    interpolate(before,after,u){
      if(!before)return after;const pts=Object.fromEntries(Object.entries(after.pts).map(([key,p])=>[key,before.pts[key]?lerp(before.pts[key],p,u):p.slice()])),elastic={};
      for(const [key,limb] of Object.entries(after.elastic)){const old=before.elastic[key],leg=key.startsWith('leg'),side=leg?key.slice(3):key,base=before.pts[(leg?'hip':'shoulder')+side],end=before.pts[(leg?'foot':'hand')+side],curve=old?.curve||[base,lerp(base,end,.25),lerp(base,end,.73),end];elastic[key]={...limb,curve:limb.curve.map((p,i)=>lerp(curve[i],p,u))};}
      return {...after,pts,elastic};
    }
    probe(f,target,a){
      const fromT=Math.max(a.contactChecked||0,a.traceStart),toT=Math.min(a.t,a.contactEnd);if(toT<fromT)return null;a.contactChecked=toT;
      const previous=this.before[f.id],oldTarget=this.before[target.id]||target,dt=Math.max(1e-7,a.t-(previous?.action?.id===a.id?previous.action.t:0));
      const stateAt=(source,old,time)=>{const q=this.snapshot(source),u=C(1-(a.t-time)/dt,0,1);if(old)for(const k of ['x','y','z'])q[k]=old[k]+(source[k]-old[k])*u;return q;};
      let oldShapes=null,oldBodies=null,oldTime=fromT;
      const frames=Math.max(1,Math.ceil((toT-fromT)/.008));
      for(let frame=0;frame<=frames;frame++){
        const time=fromT+(toT-fromT)*frame/frames,q=stateAt(f,previous,time);q.action={...a,t:time};const victim=stateAt(target,oldTarget,time),fraction=C(1-(a.t-time)/dt,0,1),rig=this.poses[f.id]?this.interpolate(this.beforePoses?.[f.id],this.poses[f.id],fraction):this.sample(q,time),targetRig=this.poses[target.id]?this.interpolate(this.beforePoses?.[target.id],this.poses[target.id],fraction):this.sample(victim),shapes=attacks(this.world,q,rig,q.action),bodies=body(targetRig,victim);
        const toward=V.dot([Math.sin(target.angle),0,Math.cos(target.angle)],V.sub([f.x,0,f.z],[target.x,0,target.z]));
        const guards=target.guard&&!target.action&&toward>0?bodies.filter(b=>/forearm|hand/.test(b.joint)).map(b=>({...b,guard:true,r:b.r+.025})):[],clash=target.action?.move.weapon&&Math.abs(target.action.t-target.action.move.startup)<.11?weapons(this.world,victim,targetRig).map(b=>({...b,clash:true})):[];
        const delta=oldShapes?Math.max(...shapes.map((s,i)=>Math.max(length(V.sub(s.a,oldShapes[i]?.a||s.a)),length(V.sub(s.b,oldShapes[i]?.b||s.b)))),...bodies.map((b,i)=>length(V.sub(b.a,oldBodies[i]?.a||b.a)))):0,steps=Math.max(1,Math.ceil(delta/.045));
        for(let step=oldShapes?1:0;step<=steps;step++){
          const u=step/steps,at=oldTime+(time-oldTime)*u,attack=shapes.map((s,i)=>oldShapes?.[i]?{...s,a:lerp(oldShapes[i].a,s.a,u),b:lerp(oldShapes[i].b,s.b,u)}:s),defense=bodies.map((b,i)=>oldBodies?.[i]?{...b,a:lerp(oldBodies[i].a,b.a,u),b:lerp(oldBodies[i].b,b.b,u)}:b);
          for(const s of attack){
            // Cover intercepts a limb along its real path. Empty space in a body never counts.
            for(const c of this.world.yard.solids){if(c.prop?.heldBy||c.prop?.pulledBy||c.prop?.broken||c.prop?.type==='debris')continue;const t=segmentBox(s.a,s.b,c,s.r);if(t!==null){const point=lerp(s.a,s.b,t);return {kind:'world',point,normal:V.unit(V.sub(point,[c.x,c.y,c.z])),prop:c.prop||null,at,joint:s.joint};}}
            if(at+1e-7>=a.contactStart){
              const desc=descriptor(a.move),side=desc.side,elastic=rig.elastic[a.move.limb?.startsWith('leg')?'leg'+side:side],limb=[];
              if(elastic){for(let i=0;i<12;i++)limb.push([bezier(elastic.curve,i/12),bezier(elastic.curve,(i+1)/12),elastic.radius]);}
              else{const leg=desc.kind==='foot'||desc.kind==='knee',base=rig.pts[(leg?'hip':'shoulder')+side],bend=rig.pts[(leg?'knee':'elbow')+side],end=rig.pts[(leg?'foot':'hand')+side];limb.push([base,bend,.06],[bend,end,.06]);}
              for(const [start,end,radius] of limb)for(const c of this.world.yard.solids){if(c.prop?.heldBy||c.prop?.pulledBy||c.prop?.broken||c.prop?.type==='debris')continue;const t=segmentBox(start,end,c,radius);if(t!==null)return {kind:'world',point:lerp(start,end,t),normal:V.unit(V.sub(start,end)),prop:c.prop||null,at,joint:s.joint};}
            }
            for(const b of clash){const hit=overlap(s,b);if(hit)return {...hit,kind:'clash',at,prop:b.prop};}
            for(const b of guards){const hit=overlap(s,b);if(hit)return {...hit,kind:'guard',at};}
            if(at+1e-7>=a.contactStart)for(const b of defense){const hit=overlap(s,b);if(hit)return {...hit,kind:'body',at};}
          }
        }
        oldShapes=shapes;oldBodies=bodies;oldTime=time;
      }return null;
    }
    resolve(){for(const f of this.world.fighters()){const a=f.action;if(!a||a.hit||!geometric(a.move)||a.t<a.traceStart)continue;const target=this.world.targetFor(f),contact=this.probe(f,target,a);if(contact){a.contact=contact;a.hit=true;a.result=this.world.strike(f,target,a);this.last.push({id:++this.serial,by:f.id,target:target.id,...contact,time:this.world.time});this.last=this.last.slice(-12);}else if(a.t>=a.contactEnd){a.hit=true;a.result='miss';this.world.emit('whiff',{by:f.id,move:a.move.name});if(target.dodge&&!target.dodge.rewarded){target.dodge.rewarded=true;target.counterUntil=this.world.time+.9;if(target.id==='player')this.world.emit('evade');}else if(target.mobility?.crouch>.6&&zone(a.move)==='head'&&Math.hypot(f.x-target.x,f.z-target.z)<a.move.range+.3&&this.world.time-(target.mobility.duckRewardAt??-10)>.5){target.mobility.duckRewardAt=this.world.time;target.counterUntil=this.world.time+.65;this.world.emit('duckEvade',{by:target.id});}}
        if(a.hit&&a.result!=='hit'&&a.result!=='projectile'){f.connections=[];f.landedChain='';}
      }}
  }
  root.CombatContact={Contacts,closest,overlap,segmentBox,body,descriptor,zone,geometric,attacks,weaponFrame,projectile,muzzle};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatContact;
})(typeof window!=='undefined'?window:globalThis);
