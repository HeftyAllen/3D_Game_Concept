/* Active ragdolls: animation drives intent; joint constraints, impulses,
   gravity, self contacts, and floor friction supply secondary motion. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mid=(a,b)=>a.map((v,i)=>(v+b[i])*.5);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const BODIES={pelvis:[2.7,.17],torso:[1.8,.19],chest:[2,.20],neck:[.45,.085],head:[.85,.18],
    hipL:[.6,.11],hipR:[.6,.11],shoulderL:[.5,.12],shoulderR:[.5,.12],
    elbowL:[.35,.08],elbowR:[.35,.08],handL:[.22,.105],handR:[.22,.105],
    kneeL:[.65,.10],kneeR:[.65,.10],footL:[.4,.08],footR:[.4,.08]};
  const BONES=[['pelvis','hipL',.15],['pelvis','hipR',.15],['hipL','hipR',.30],
    ['pelvis','torso',.35],['torso','chest',.17],['chest','neck',.27],['neck','head',.20],
    ['chest','shoulderL',.35],['chest','shoulderR',.35],['shoulderL','shoulderR',.68],
    ['shoulderL','elbowL',.41],['elbowL','handL',.41],['shoulderR','elbowR',.41],['elbowR','handR',.41],
    ['hipL','kneeL',.49],['kneeL','footL',.49],['hipR','kneeR',.49],['kneeR','footR',.49]];
  const LIMITS=[['pelvis','chest',.39,.54],['chest','head',.39,.49],
    ['hipL','shoulderR',.62,.88],['hipR','shoulderL',.62,.88],
    ['shoulderL','handL',.17,.80],['shoulderR','handR',.17,.80],
    ['hipL','footL',.19,.96],['hipR','footR',.19,.96]];
  const SELF=[['handL','chest'],['handR','chest'],['handL','pelvis'],['handR','pelvis'],['elbowL','chest'],['elbowR','chest'],['handL','head'],['handR','head'],['kneeL','kneeR'],['footL','footR'],['handL','kneeR'],['handR','kneeL'],['elbowL','elbowR'],['head','pelvis'],['head','kneeL'],['head','kneeR']];
  function targets(points){
    const result=Object.fromEntries(Object.entries(points).map(([k,p])=>[k,p.slice()]));
    result.pelvis=mid(points.hipL,points.hipR);
    const shoulder=mid(points.shoulderL,points.shoulderR),up=sub(points.head,shoulder),length=Math.hypot(...up)||1;
    result.chest=shoulder.map((v,i)=>v-up[i]/length*.08);
    result.neck=points.head.map((v,i)=>v-up[i]/length*.20);
    return result;
  }
  class Ragdoll{
    constructor(){this.nodes={};this.mode='active';this.lastTime=null;this.impactId=0;this.recovery=1;this.contactCount=0;this.sleepTime=0;this.sleeping=false;this.airAngle=0;this.airRoll=0;this.airAge=0;this.angular=[0,0];this.lastRoot=null;this.recoveryFrom=null;this.lastImpact=null;}
    seed(goal,time){
      for(const [key,[mass,radius]] of Object.entries(BODIES))this.nodes[key]={p:goal[key].slice(),v:[0,0,0],inv:1/mass,radius};
      this.lastTime=time;
    }
    impulse(hit,mass=1){
      if(!hit||hit.id===this.impactId)return;
      this.impactId=hit.id;
      this.lastImpact=hit;this.sleeping=false;this.sleepTime=0;
      const force=1/Math.sqrt(mass||1),profile=hit.profile||(hit.zone==='leg'?'leg':hit.zone==='body'?'body':'tap');this.angular=[(hit.launch?2.8:hit.slam?4.4:profile==='leg'?.9:profile==='body'?1.8:1.4)*hit.power*.65*force,hit.side*hit.power*(profile==='heavy'?.52:.38)*force];
      const primary=hit.zone==='leg'?['kneeL','kneeR','hipL','hipR']:hit.zone==='body'?['torso','chest','pelvis']:hit.zone==='floor'?['pelvis','torso','chest']:['head','neck','chest'];
      for(const [key,n] of Object.entries(this.nodes)){
        const region=primary.includes(key)?1:key.startsWith('hand')||key.startsWith('elbow')?.38:.18,weight=hit.point?Math.max(.12,Math.exp(-dot(sub(n.p,hit.point),sub(n.p,hit.point))/.22))*.8+region*.2:region;
        for(const axis of [0,2])n.v[axis]+=hit.direction[axis]*hit.power*weight*force;
        n.v[1]+=(hit.launch?hit.power*.72:hit.slam?-hit.power*.55:profile==='leg'?-hit.power*.25:profile==='body'?-hit.power*.08:.12)*weight*force;
        if(key==='head'||key==='chest'){n.v[0]+=hit.direction[2]*hit.side*hit.power*.24*force;n.v[2]-=hit.direction[0]*hit.side*hit.power*.24*force;}
      }
    }
    contact(aKey,bKey,pins,elastic){
      if(elastic.has(aKey)||elastic.has(bKey))return;const a=this.nodes[aKey],b=this.nodes[bKey],d=sub(b.p,a.p),length=Math.hypot(...d),radius=(a.radius+b.radius)*1.07;
      if(length<radius&&length>1e-5){const wa=pins.has(aKey)?0:a.inv,wb=pins.has(bKey)?0:b.inv,sum=wa+wb||1;for(let i=0;i<3;i++){const push=d[i]/length*(radius-length)*.7;a.p[i]-=push*wa/sum;b.p[i]+=push*wb/sum;}}
    }
    knees(pins,elastic){
      const right=unit(sub(this.nodes.hipR.p,this.nodes.hipL.p)),up=unit(sub(this.nodes.chest.p,this.nodes.pelvis.p)),forward=unit(cross(right,up));
      for(const side of ['L','R']){const key='knee'+side;if(elastic.has(key)||pins.has(key))continue;const a=this.nodes['hip'+side].p,b=this.nodes[key].p,c=this.nodes['foot'+side].p,axis=unit(sub(c,a)),t=clamp(dot(sub(b,a),axis),.05,.9),line=a.map((v,i)=>v+axis[i]*t),projection=dot(forward,axis),bend=unit(forward.map((v,i)=>v-axis[i]*projection)),distance=dot(sub(b,line),bend);
        if(distance<.012&&(b[1]>this.nodes[key].radius+.035||bend[1]>.2))for(let i=0;i<3;i++)b[i]+=bend[i]*(.012-distance)*.4;
      }
    }
    capsules(environment,f,pins,elastic){
      if(!environment)return;
      for(const [aKey,bKey] of BONES){if(elastic.has(aKey)||elastic.has(bKey))continue;const a=this.nodes[aKey],b=this.nodes[bKey],p=mid(a.p,b.p),before=p.slice(),radius=Math.min(a.radius,b.radius)*.8;environment.collideNode(p,radius,f);const shift=sub(p,before);if(dot(shift,shift)<1e-10)continue;
        const wa=pins.has(aKey)?0:a.inv,wb=pins.has(bKey)?0:b.inv,sum=wa+wb||1;for(let i=0;i<3;i++){a.p[i]+=shift[i]*wa/sum;b.p[i]+=shift[i]*wb/sum;}
      }
    }
    collideWith(other){
      if(this.mode==='controlled'||other.mode==='controlled'||!['air','fall'].includes(this.mode)&&!['air','fall'].includes(other.mode))return false;
      const keys=['pelvis','chest','head','elbowL','elbowR','kneeL','kneeR','footL','footR'];let touched=false;
      for(const aKey of keys)for(const bKey of keys){const a=this.nodes[aKey],b=other.nodes[bKey];if(!a||!b||this.elastic?.has(aKey)||other.elastic?.has(bKey))continue;const d=sub(b.p,a.p),length=Math.hypot(...d),radius=a.radius+b.radius;if(length>=radius||length<1e-5)continue;
        const normal=d.map(v=>v/length),wa=this.pins?.has(aKey)?0:a.inv*(this.mode==='active'?.08:1),wb=other.pins?.has(bKey)?0:b.inv*(other.mode==='active'?.08:1),sum=wa+wb;if(!sum)continue;const push=Math.min(.07,radius-length)*.75,velocity=dot(sub(b.v,a.v),normal),impulse=velocity<0?-velocity*1.08/sum:0;
        for(let i=0;i<3;i++){a.p[i]-=normal[i]*push*wa/sum;b.p[i]+=normal[i]*push*wb/sum;a.v[i]-=normal[i]*impulse*wa;b.v[i]+=normal[i]*impulse*wb;}touched=true;
      }
      if(touched)for(const doll of [this,other]){doll.sleeping=false;doll.sleepTime=0;for(let iteration=0;iteration<7;iteration++)for(const [a,b,length] of BONES)doll.solve(a,b,length*.98,length*1.02,.85,doll.pins||new Set(),doll.elastic||new Set());for(const n of Object.values(doll.nodes))n.p[1]=Math.max(n.radius+(doll.floor||0),n.p[1]);}
      return touched;
    }
    positions(){return Object.fromEntries(Object.entries(this.nodes).map(([key,n])=>[key,n.p.slice()]));}
    airborneGoal(goal,f,dt){
      this.airAge+=dt;this.airAngle=clamp(this.airAngle+this.angular[0]*dt,-1.10,1.10);this.airRoll=clamp(this.airRoll+this.angular[1]*dt,-.6,.6);this.angular=this.angular.map(v=>v*Math.exp(-1.4*dt));
      const pelvis=goal.pelvis,hit=this.lastImpact,direction=hit?.direction||[Math.sin(f.angle||0),0,Math.cos(f.angle||0)],side=unit([direction[2],0,-direction[0]]),pitch=this.airAngle,roll=this.airRoll;
      const loosen=1-Math.exp(-10*this.airAge);
      for(const hand of ['L','R']){const sign=hand==='L'?-1:1,shoulder=goal['shoulder'+hand],hip=goal['hip'+hand];for(const [joint,sideways,down,forward] of [['elbow',.20,-.28,-.12],['hand',.28,-.50,-.30]]){const key=joint+hand,desired=shoulder.map((v,i)=>v+side[i]*sign*sideways+direction[i]*forward+(i===1?down:0));goal[key]=goal[key].map((v,i)=>v+(desired[i]-v)*loosen);}for(const [joint,down,forward] of [['knee',-.30,.24],['foot',-.69,-.06]]){const key=joint+hand,desired=hip.map((v,i)=>v+direction[i]*forward+(i===1?down:0));goal[key]=goal[key].map((v,i)=>v+(desired[i]-v)*loosen);}}
      for(const [key,p] of Object.entries(goal)){if(key==='pelvis')continue;let d=sub(p,pelvis),s=dot(side,d),forward=dot(direction,d),y=d[1],newY=y*Math.cos(pitch)-forward*Math.sin(pitch),newZ=y*Math.sin(pitch)+forward*Math.cos(pitch),newX=s*Math.cos(roll)-newY*Math.sin(roll);newY=s*Math.sin(roll)+newY*Math.cos(roll);goal[key]=pelvis.map((v,i)=>v+side[i]*newX+direction[i]*newZ+(i===1?newY:0));}
    }
    solve(aKey,bKey,min,max,strength,pins,elastic){
      if(elastic.has(aKey)||elastic.has(bKey))return;
      const a=this.nodes[aKey],b=this.nodes[bKey],delta=sub(b.p,a.p),length=Math.hypot(...delta);
      if(length<1e-7)return;
      const desired=clamp(length,min,max),error=(length-desired)/length*strength;
      const wa=pins.has(aKey)?0:a.inv,wb=pins.has(bKey)?0:b.inv,sum=wa+wb;if(!sum)return;
      for(let i=0;i<3;i++){a.p[i]+=delta[i]*error*wa/sum;b.p[i]-=delta[i]*error*wb/sum;}
    }
    step(points,f,time,elasticCurves={},environment=null,support=null){
      const goal=targets(points);if(this.lastTime===null)this.seed(goal,time);
      const elapsed=clamp(time-this.lastTime,0,.05);this.lastTime=time;this.impulse(f.impact,f.mass);
      const floor=f.elementSupport?.top||0;this.floor=floor;const mounted=!!f.visual?.mountPinned;if(mounted)goal.pelvis=[f.x,Math.min(.24+floor,goal.pelvis[1]),f.z];if(mounted!==this.mountPinned){this.mountPinned=mounted;this.sleeping=false;this.sleepTime=0;}
      const releasedThrow=!!f.visual?.pair&&f.visual.phase>=.98&&f.down>0;
      const controlled=(f.held&&!releasedThrow)||f.visual?.role==='holder'||f.visual?.pair==='pickup';
      const fallen=!controlled&&(f.ko||f.down>0)&&f.y-floor<.15&&f.visual?.role!=='recovering';
      const airborne=!controlled&&!f.action&&f.tumbling&&f.y>=.15;
      const next=fallen?'fall':airborne?'air':controlled?'controlled':'active';
      if(next!==this.mode){
        if(this.mode==='fall'&&next!=='fall'){this.recovery=0;this.recoveryFrom=Object.fromEntries(Object.entries(this.nodes).map(([k,n])=>[k,n.p.slice()]));}
        if(next==='air'){this.airAngle=0;this.airRoll=0;this.airAge=0;}
        if(next!=='fall'){this.sleeping=false;this.sleepTime=0;}this.mode=next;
      }
      if(this.mode==='air')this.airborneGoal(goal,f,elapsed);
      if(this.mode==='fall'&&this.lastRoot&&Number.isFinite(f.x)){const dx=clamp(f.x-this.lastRoot[0],-.5,.5),dz=clamp(f.z-this.lastRoot[1],-.5,.5);if(Math.hypot(dx,dz)>.002)this.sleeping=false;for(const n of Object.values(this.nodes)){n.p[0]+=dx;n.p[2]+=dz;}}
      if(this.mode==='fall'&&this.sleeping){if(Number.isFinite(f.x))this.lastRoot=[this.nodes.pelvis.p[0],this.nodes.pelvis.p[2]];return this.positions();}
      const count=Math.max(1,Math.ceil(elapsed/(1/120))),h=elapsed/count;
      const elastic=new Set();
      for(const key of Object.keys(elasticCurves)){const leg=key.startsWith('leg'),side=leg?key.slice(3):key;elastic.add((leg?'knee':'elbow')+side);elastic.add((leg?'foot':'hand')+side);}
      for(let step=0;step<count&&h>0;step++){
        this.recovery=Math.min(1,this.recovery+h/(f.action?.20:.72));
        const pins=new Set();
        if(this.mode==='air'||this.mode==='fall'&&f.visual?.mountPinned)pins.add('pelvis');
        if(this.mode==='active'&&this.recovery>.95&&(f.y<.08||f.elementSupport)&&!f.down){for(const key of support||['footL','footR'])pins.add(key);}
        if(this.mode==='controlled'){for(const key of ['pelvis','torso','chest','hipL','hipR','shoulderL','shoulderR'])pins.add(key);if(f.visual?.role==='holder'&&f.visual.pair)for(const key of support||[])pins.add(key);}
        for(const key of elastic)pins.add(key);
        this.pins=pins;this.elastic=elastic;
        const before={},fall=this.mode==='fall',air=this.mode==='air',rate=fall?0:air?14:this.mode==='controlled'?120:f.action?90:58;
        const impactAge=this.lastImpact?Math.max(0,time-(this.lastImpact.at??-10)):10,hit=this.lastImpact,profile=root.CombatFlow?.PROFILES[hit?.profile||(hit?.zone==='leg'?'leg':hit?.zone==='body'?'body':'tap')],reaction=Math.exp(-impactAge*(profile?2.7/profile.duration:7));
        for(const [key,n] of Object.entries(this.nodes)){
          before[key]=n.p.slice();n.floor=false;
          if(pins.has(key)){n.p=goal[key].slice();continue;}
          if(this.sleeping&&fall)continue;
          const damping=Math.exp(-(fall?.85:air?2.3:12)*h);
          n.v[1]-=(fall||air?9.8:1.2)*h;
          for(let i=0;i<3;i++){n.v[i]*=damping;n.p[i]+=n.v[i]*h;}
          const region=key==='head'||key==='neck'?'head':key.startsWith('knee')||key.startsWith('hip')?'leg':'body',sensitive=region===this.lastImpact?.zone,weight=key==='pelvis'?1.65:key==='head'?.64:key.startsWith('hand')?1.1:1;
          const soften=fall||air||this.mode==='controlled'?1:1-reaction*(sensitive?(profile?.loose||.78):.24),drive=(1-Math.exp(-rate*weight*soften*h));
          const recovery=this.recoveryFrom&&this.recovery<1?smooth(key.startsWith('hand')?clamp((this.recovery-.15)/.85,0,1):this.recovery):1;
          const desired=recovery<1?goal[key].map((v,i)=>this.recoveryFrom[key][i]+(v-this.recoveryFrom[key][i])*recovery):goal[key];
          for(let i=0;i<3;i++)n.p[i]+=(desired[i]-n.p[i])*drive;
        }
        for(let iteration=0;iteration<11;iteration++){
          for(const [a,b,length] of BONES)this.solve(a,b,length*.98,length*1.02,.82,pins,elastic);
          for(const [a,b,min,max] of LIMITS)this.solve(a,b,min,max,.5,pins,elastic);
          this.knees(pins,elastic);for(const [a,b] of SELF)this.contact(a,b,pins,elastic);
          if(iteration%4===2)this.capsules(environment,f,pins,elastic);
          for(const [key,n] of Object.entries(this.nodes)){
            if(n.p[1]<n.radius+floor){n.p[1]=n.radius+floor;n.floor=true;}
            if(environment)environment.collideNode(n.p,n.radius,f);
            const radius=Math.hypot(n.p[0],n.p[2]);if(radius>7){n.p[0]*=7/radius;n.p[2]*=7/radius;}
            if(pins.has(key)){n.p=goal[key].map((v,i)=>i===1?Math.max(n.radius+floor,v):v);if(environment&&!elastic.has(key))environment.collideNode(n.p,n.radius,f);}n.p[1]=Math.max(n.radius+floor,n.p[1]);
          }
        }
        this.contactCount=0;
        for(const [key,n] of Object.entries(this.nodes)){
          const incomingY=n.v[1];n.v=n.p.map((v,i)=>clamp((v-before[key][i])/h,-16,16));
          if(n.floor&&!pins.has(key)){this.contactCount++;const grip=Math.exp(-(key.startsWith('foot')?25:19)*h);n.v[0]*=grip;n.v[2]*=grip;n.v[1]=incomingY<-1.8?-incomingY*.10:0;}
          if(pins.has(key))n.v=[0,0,0];
        }
        if(fall){if(this.contactCount>=4&&this.nodes.chest.p[1]-floor<.55){const settle=Math.exp(-14*h);for(const n of Object.values(this.nodes))n.v=n.v.map(v=>v*settle);}const energy=Object.values(this.nodes).reduce((s,n)=>s+dot(n.v,n.v)/n.inv*.5,0);this.sleepTime=energy<.25&&this.contactCount>=3?this.sleepTime+h:0;if(this.sleepTime>.4){this.sleeping=true;for(const n of Object.values(this.nodes))n.v=[0,0,0];}}
      }
      this.lastRoot=Number.isFinite(f.x)?this.mode==='fall'?[this.nodes.pelvis.p[0],this.nodes.pelvis.p[2]]:[f.x,f.z]:null;
      return this.positions();
    }
    snapshot(){return {mode:this.mode,contacts:this.contactCount,sleeping:this.sleeping,recovery:this.recovery,airAngle:this.airAngle,energy:Object.values(this.nodes).reduce((s,n)=>s+n.v.reduce((q,v)=>q+v*v,0)/n.inv*.5,0),joints:Object.fromEntries(Object.entries(this.nodes).map(([k,n])=>[k,n.p.slice()]))};}
  }
  const API={Ragdoll,BONES,LIMITS,BODIES,targets,SELF};root.CombatPhysics=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
