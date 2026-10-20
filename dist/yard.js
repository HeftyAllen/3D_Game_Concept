/* Courtyard collision and prop simulation. No rendering or DOM dependencies. */
(function(root){
  'use strict';
  const Gadgets=(root.CombatGadgets||(typeof require==='function'?require('./gadgets.js'):null)).Gadgets;
  const {ARENAS}=root.CombatArenas||(typeof require==='function'?require('./arenas.js'):null);
  const C=(v,a,b)=>Math.max(a,Math.min(b,v)),len=(x,z)=>Math.hypot(x,z),ease=t=>{t=C(t,0,1);return t*t*(3-2*t);};
  const mSafeReach=(a,e,d)=>.65+e*(a?.move.powerThrow?C(d-1.60,0,1.10):C(d-.85,0,3.95));
  const TYPES={chair:{name:'Chair',hx:.34,hy:.52,hz:.34,mass:5,health:36,color:[.58,.37,.20]},crate:{name:'Crate',hx:.40,hy:.40,hz:.40,mass:9,health:26,color:[.58,.44,.27]},barrel:{name:'Barrel',hx:.36,hy:.48,hz:.36,mass:13,health:Infinity,color:[.27,.40,.37]},table:{name:'Table',hx:.93,hy:.44,hz:.58,mass:0,health:36,color:[.57,.40,.25]},
    bench:{name:'Bench',hx:1.08,hy:.35,hz:.30,mass:0,health:42,color:[.57,.40,.25]},divider:{name:'Wood divider',hx:.92,hy:.58,hz:.11,mass:0,health:30,color:[.56,.43,.28]},cone:{name:'Traffic cone',hx:.22,hy:.36,hz:.22,mass:1.4,health:16,color:[.88,.45,.20]},tyre:{name:'Tyre',hx:.36,hy:.09,hz:.36,mass:4,health:Infinity,color:[.10,.15,.14],bounce:.60},bag:{name:'Swing bag',hx:.27,hy:.51,hz:.27,mass:8,health:Infinity,color:[.56,.31,.24],anchored:true},debris:{name:'Wood',hx:.25,hy:.045,hz:.10,mass:.6,health:Infinity,color:[.54,.36,.22]}};
  Object.assign(TYPES,{cart:{name:'Cargo cart',hx:.69,hy:.34,hz:.45,mass:18,health:76,color:[.32,.43,.43],carry:false,wheeled:true},glass:{name:'Glass screen',hx:.83,hy:.86,hz:.07,mass:0,health:18,color:[.56,.81,.79]},bumper:{name:'Rebound pad',hx:.87,hy:.48,hz:.19,mass:0,health:Infinity,color:[.34,.63,.65],restitution:.9}});
  Object.assign(TYPES,{baton:{name:'Training baton',hx:.07,hy:.07,hz:.47,mass:2.4,health:110,color:[.32,.48,.43],gear:true},staff:{name:'Training staff',hx:.075,hy:.075,hz:.86,mass:3.8,health:130,color:[.60,.46,.29],gear:true},blaster:{name:'Pulse blaster',hx:.13,hy:.13,hz:.28,mass:2.8,health:100,color:[.35,.47,.52],gear:true,ammo:6,capacity:6}});
  Object.assign(TYPES,{car:{name:'Parked coupe',hx:.94,hy:.85,hz:1.85,mass:0,health:220,color:[.21,.46,.49],cover:true},barrier:{name:'Concrete barrier',hx:1.13,hy:.71,hz:.27,mass:0,health:150,color:[.58,.59,.53],cover:true},planter:{name:'Stone planter',hx:.78,hy:.67,hz:.50,mass:0,health:110,color:[.48,.53,.43],cover:true},earthwall:{name:'Earth wall',hx:1.08,hy:.72,hz:.25,mass:0,health:90,color:[.52,.36,.22],cover:true}});
  Object.assign(TYPES,{earthplatform:{name:'Earth terrace',hx:1.02,hy:.54,hz:1.02,mass:0,health:110,color:[.49,.43,.32]},earthridge:{name:'Earth ridge',hx:.31,hy:.20,hz:.27,mass:0,health:40,color:[.53,.44,.31]}});
  function rotation(p){const y=p.angle||0,x=p.rx||0,z=p.rz||0,cy=Math.cos(y),sy=Math.sin(y),cx=Math.cos(x),sx=Math.sin(x),cz=Math.cos(z),sz=Math.sin(z);return [cy*cz+sy*sx*sz,cx*sz,-sy*cz+cy*sx*sz,-cy*sz+sy*sx*cz,cx*cz,sy*sz+cy*sx*cz,sy*cx,-sx,cy*cx];}
  function extents(p){const r=rotation(p);return [0,1,2].map(i=>Math.abs(r[i])*p.hx+Math.abs(r[3+i])*p.hy+Math.abs(r[6+i])*p.hz);}
  // Returns the separating displacement for a sphere against a solid volume.
  function sphere(point,r,c){
    const lo=[c.x-c.hx,c.y-c.hy,c.z-c.hz],hi=[c.x+c.hx,c.y+c.hy,c.z+c.hz];
    let q=point.map((v,i)=>C(v,lo[i],hi[i]));
    if(c.cylinder){const dx=point[0]-c.x,dz=point[2]-c.z,d=len(dx,dz);if(d>c.hx){q[0]=c.x+dx/d*c.hx;q[2]=c.z+dz/d*c.hx;}else{q[0]=point[0];q[2]=point[2];}}
    const delta=point.map((v,i)=>v-q[i]),d=Math.hypot(...delta);if(d>=r)return null;
    if(d>.00001)return {n:delta.map(v=>v/d),depth:r-d};
    if(c.cylinder){const dx=point[0]-c.x,dz=point[2]-c.z,d=len(dx,dz),side=c.hx-d,top=hi[1]-point[1],bottom=point[1]-lo[1];if(side<Math.min(top,bottom))return {n:d>.001?[dx/d,0,dz/d]:[1,0,0],depth:side+r};}
    let depth=Infinity,n=[1,0,0];for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const v=sign<0?point[axis]-lo[axis]:hi[axis]-point[axis];if(v<depth){depth=v;n=[0,0,0];n[axis]=sign;}}
    return {n,depth:depth+r};
  }
  class Yard{
    constructor(world){this.world=world;this.reset();}
    reset(){
      this.layout=ARENAS[this.world.arenaId]||ARENAS.courtyard;
      this.serial=0;this.stats={broken:0,wallHits:0,propHits:0,stretchGets:0,springLaunches:0,bagHits:0};this.previous={};this.retrieve=null;
      this.walls=[{id:'north',x:0,y:.63,z:-5.95,hx:6.65,hy:.63,hz:.25},{id:'south',x:0,y:.63,z:5.95,hx:6.65,hy:.63,hz:.25},{id:'west',x:-6.45,y:.63,z:0,hx:.25,hy:.63,hz:5.70},{id:'east',x:6.45,y:.63,z:0,hx:.25,hy:.63,hz:5.70}];
      this.pillars=this.layout.pillars.map(([x,z],i)=>({id:'pillar-'+i,x,y:1.12,z,hx:.40,hy:1.12,hz:.40,cylinder:true}));
      this.pads=this.layout.pads.map(([x,z],i)=>({id:'spring-'+i,x,z,radius:.66,flash:0,last:{}}));
      this.props=[];
      for(const [type,x,z,angle] of this.layout.props)this.props.push(this.make(type,x,z,angle));
      for(const [x,z] of this.layout.bags)this.props.push(this.make('bag',x,z,0,{anchor:[x,3.2,z],rope:1.5,y:1.7,sleep:false}));
      for(const [type,x,z] of [['baton',1.6,4.1],['staff',-1.7,3.6],['blaster',0,-4.1]])this.props.push(this.make(type,x,z));
      this.gadgets=new Gadgets(this.world,this);this.rebuild();
    }
    make(type,x,z,angle=0,extra={}){const t=TYPES[type];return {id:'prop-'+(++this.serial),type,...t,x,y:t.hy,z,angle,rx:0,rz:0,vx:0,vy:0,vz:0,wx:0,wy:0,wz:0,sleep:type!=='debris',settle:0,heldBy:null,pulledBy:null,broken:false,owner:null,armedUntil:0,hits:{},...extra};}
    held(f){return this.props.find(p=>p.heldBy===f.id&&!p.broken)||null;}
    bounds(p){const e=extents(p);return {id:p.id,x:p.x,y:p.y,z:p.z,hx:e[0],hy:e[1],hz:e[2],prop:p};}
    colliders(p){if(p.type!=='car')return [this.bounds(p)];
      const part=(id,x,y,z,hx,hy,hz,cover=false)=>{const c=Math.cos(p.angle),s=Math.sin(p.angle);return {id:p.id+id,x:p.x+x*c+z*s,y,z:p.z+z*c-x*s,hx:Math.abs(c)*hx+Math.abs(s)*hz,hy,hz:Math.abs(s)*hx+Math.abs(c)*hz,prop:p,cover};};
      return [part('-body',0,.57,0,.94,.55,1.85),part('-cabin',0,1.10,-.12,.94,.60,.84,true)];
    }
    rebuild(){this.solids=[...this.walls,...this.pillars,...(this.gadgets?.colliders()||[]),...this.props.filter(p=>!p.broken&&!p.heldBy&&!p.pulledBy&&p.type!=='debris').flatMap(p=>this.colliders(p))];}
    bendAround(f,p){
      const other=this.world.targetFor(f),dx=p.x-f.x,dz=p.z-f.z,d2=dx*dx+dz*dz,t=((other.x-f.x)*dx+(other.z-f.z)*dz)/(d2||1),d=Math.sqrt(d2)||1;
      if(t<.12||t>.88||len(other.x-f.x-dx*t,other.z-f.z-dz*t)>.78)return [0,0];
      const side=(other.x-f.x)*(-dz/d)+(other.z-f.z)*(dx/d)>0?-1:1;return [-dz/d*side*1.15,dx/d*side*1.15];
    }
    clearPath(f,p){
      const bend=this.bendAround(f,p);
      for(let i=1;i<14;i++){const t=i/14,arc=Math.sin(t*Math.PI),point=[f.x+(p.x-f.x)*t+bend[0]*arc,1.4+(p.y-1.4)*t+arc*.65,f.z+(p.z-f.z)*t+bend[1]*arc];for(const c of this.solids){if(c.prop===p)continue;if(sphere(point,.13,c))return false;}}
      return true;
    }
    lineBlocked(f,target,height=1.35,ignore=null){
      for(let i=1;i<15;i++){const t=i/15,point=[f.x+(target.x-f.x)*t,f.y+height+(target.y-f.y)*t,f.z+(target.z-f.z)*t];for(const c of this.solids){if(c.prop===ignore||c.prop?.type==='debris')continue;if(sphere(point,.10,c))return true;}}return false;
    }
    candidate(f,reach=1.7){
      return this.props.filter(p=>p.mass>0&&p.carry!==false&&!p.anchored&&p.type!=='debris'&&!p.broken&&!p.heldBy&&!p.pulledBy&&p.y<1.2&&len(p.x-f.x,p.z-f.z)<=reach).map(p=>({p,d:len(p.x-f.x,p.z-f.z)})).filter(({p,d})=>reach<2||(Math.sin(f.angle)*(p.x-f.x)+Math.cos(f.angle)*(p.z-f.z))/Math.max(.01,d)>.12).sort((a,b)=>a.d-b.d).find(({p})=>this.clearPath(f,p))?.p||null;
    }
    pickup(f,p,elastic=false){
      if(!p||p.carry===false||p.anchored||p.broken||p.heldBy||p.pulledBy||len(p.x-f.x,p.z-f.z)>(elastic?5.9:1.8))return false;
      if(!this.clearPath(f,p))return false;
      if(elastic){p.pulledBy=f.id;this.retrieve={owner:f,prop:p,at:this.world.time,from:[p.x,p.y,p.z],bend:this.bendAround(f,p),duration:.34};this.world.emit('propReel',{prop:p.name});}
      else{p.heldBy=f.id;this.world.emit('propPickup',{prop:p.name,by:f.id});}
      p.vx=p.vy=p.vz=p.wx=p.wy=p.wz=0;p.sleep=false;p.settle=0;p.owner=null;p.armedUntil=0;p.springArmed=false;p.machineArmed=false;this.rebuild();return true;
    }
    release(f,throwing=false,power=false){
      const p=this.held(f);if(!p)return false;p.heldBy=null;p.owner=throwing?f.id:null;p.thrownAt=this.world.time;p.armedUntil=throwing?this.world.time+3:0;p.springArmed=false;p.machineArmed=false;
      if(f.propSocket?.id===p.id){p.x=f.propSocket.x;p.y=f.propSocket.y;p.z=f.propSocket.z;}
      p.sleep=false;p.settle=0;
      const speed=throwing?(power?13:10)*Math.sqrt(5/p.mass):1.2;
      const other=this.world.targetFor(f),d=len(other.x-p.x,other.z-p.z)||1,aim=throwing&&(this.world.locked||f.id!=='player')?[(other.x-p.x)/d,(other.z-p.z)/d]:[Math.sin(f.angle),Math.cos(f.angle)];
      p.vx=aim[0]*speed+f.vx*.2;p.vz=aim[1]*speed+f.vz*.2;p.vy=throwing?(power?2.5:2.8):.1;
      p.wx=throwing?5:.3;p.wy=throwing?3:0;p.wz=throwing?2:0;
      this.world.emit(throwing?'propThrow':'propDrop',{prop:p.name,power,by:f.id});this.rebuild();return true;
    }
    onHurt(f){if(this.held(f))this.release(f);if(this.retrieve?.owner===f){this.retrieve.prop.pulledBy=null;this.retrieve=null;this.rebuild();}}
    resolveAction(f,a){
      const p=this.props.find(p=>p.id===a.propId);
      if(a.move.propPickup)return this.pickup(f,p)?'world':'miss';
      if(a.move.propFetch)return this.pickup(f,p,true)?'world':'miss';
      if(a.move.propThrow)return this.release(f,true,!!a.move.powerThrow)?'world':'miss';
      return 'miss';
    }
    damage(p,amount,source,impulse={x:0,y:0,z:0}){
      if(p.broken)return;
      if(p.anchored&&amount>0&&source){this.stats.bagHits++;this.world.emit('bagHit',{by:source.id,prop:p.name});}
      if(p.mass){p.sleep=false;p.settle=0;p.vx+=impulse.x;p.vy+=impulse.y;p.vz+=impulse.z;p.wx+=impulse.z*.9;p.wz-=impulse.x*.9;p.wy+=amount*.06;}
      if(source&&!p.heldBy&&p.mass&&p.type!=='debris'&&Math.hypot(p.vx,p.vy,p.vz)>3){p.owner=source.id;p.armedUntil=this.world.time+2;p.thrownAt=this.world.time;}
      if(impulse.x||impulse.y||impulse.z){this.world.spark(p.x,p.y,p.z,'hit',5);this.world.emit('propImpact',{prop:p.name,by:source?.id});}
      p.health-=amount;
      if(p.health>0)return;
      p.broken=true;p.heldBy=p.pulledBy=null;if(this.retrieve?.prop===p)this.retrieve=null;
      const count=p.type==='glass'?10:p.type==='table'||p.type==='cart'?8:5;
      for(let i=0;i<count;i++){const a=i/count*Math.PI*2,part=this.make('debris',p.x+Math.cos(a)*.20,p.z+Math.sin(a)*.20,a,{y:Math.max(.18,p.y),vx:Math.cos(a)*(1+i%3)+impulse.x*.25,vz:Math.sin(a)*(1+i%3)+impulse.z*.25,vy:1.5+(i%3)*.55,wx:2+i,wz:3-i*.2,life:p.type==='glass'?4:10,color:p.type==='glass'?[.56,.81,.79]:p.color});this.props.push(part);}
      this.stats.broken++;this.world.spark(p.x,p.y,p.z,'hit',15);this.world.emit('propBreak',{prop:p.name,propType:p?.type||null,by:source?.id,x:p.x,z:p.z});this.rebuild();
    }
    strikeProps(f,m,target,dry=false){
      if(m.damage<=0||m.grab||m.throwType||m.pickup||m.mount||m.propThrow)return false;
      const maxRange=Math.min(m.range,len(target.x-f.x,target.z-f.z)+.6),dir=[Math.sin(f.angle),Math.cos(f.angle)];
      const hits=this.props.filter(p=>!p.broken&&!p.heldBy&&!p.pulledBy&&p.type!=='debris'&&p.id!==f.elementSupport?.id&&p.y+p.hy>f.y+.1).map(p=>({p,dx:p.x-f.x,dz:p.z-f.z,d:len(p.x-f.x,p.z-f.z)})).filter(({p,dx,dz,d})=>d<maxRange+Math.max(p.hx,p.hz)&&d>.15&&(dx*dir[0]+dz*dir[1])/d>(m.weapon?.65:.83)&&Math.abs(dx*dir[1]-dz*dir[0])<Math.max(p.hx,p.hz)+(m.weapon?.5:.22)&&!this.lineBlocked(f,{x:p.x,y:0,z:p.z},Math.min(1.45,p.y+p.hy*.6),p)).sort((a,b)=>a.d-b.d).slice(0,m.weapon?2:1);
      if(dry)return hits[0]?.p||null;
      for(const {p} of hits)this.damage(p,m.damage*(p.type==='crate'?.85:1.15),f,{x:dir[0]*m.damage/Math.max(2,p.mass)*1.3,y:m.launch?3:.8,z:dir[1]*m.damage/Math.max(2,p.mass)*1.3});
      return hits.length>0;
    }
    wear(f){const p=this.held(f);if(p)this.damage(p,p.gear?2:8,f);}
    movePair(f,x,z){
      const g=this.world.grapple||(this.world.ground?.mounted?this.world.ground:null);if(g&&(g.owner===f||g.target===f)){g.owner.x+=x;g.owner.z+=z;g.target.x+=x;g.target.z+=z;if(g.motion){g.motion.x+=x;g.motion.z+=z;}}
      else{f.x+=x;f.z+=z;}
    }
    resolveFighter(f,dt){
      if(f.balloon){this.previous[f.id]={x:f.x,z:f.z,h:f.y+f.balloon.radius};return;}
      const w=this.world,old=this.previous[f.id]||{x:f.x,z:f.z,h:f.visual?.height??f.y+1},h=f.visual?.height??f.y+1;
      const vx=(f.x-old.x)/Math.max(dt,.001),vz=(f.z-old.z)/Math.max(dt,.001),fallSpeed=(old.h-h)/Math.max(dt,.001);
      for(const p of this.props){
        if(p.mass||p.broken||!Number.isFinite(p.health))continue;
        const bounds=this.bounds(p);
        if(Math.abs(f.x-p.x)<bounds.hx+.32&&Math.abs(f.z-p.z)<bounds.hz+.32&&h<p.hy*2+.32&&fallSpeed>1.5&&(f.tumbling||f.down>0||f.visual?.pair)){
          this.damage(p,60,f.lastAttacker||null,{x:vx*.3,y:.5,z:vz*.3});
          w.environmentHit(f,{source:f.lastAttacker,damage:12,kind:p.type==='table'?'table':'barrier',dir:[vx||0,0,vz||1],speed:Math.max(3,fallSpeed),preserve:!!f.held,propType:p?.type||null});
        }
      }
      const body=()=>f.visual?.pair?[0,.55,.99].map((height,i)=>{const pitch=f.visual.pitch||0,forward=Math.sin(pitch)*height;return {p:[f.x+Math.sin(f.angle)*forward,f.visual.height+Math.cos(pitch)*height,f.z+Math.cos(f.angle)*forward],r:i===0?.25:i===1?.25:.20};}):[{p:[f.x,f.y+.48,f.z],r:.34},{p:[f.x,f.y+1.35,f.z],r:.25}];
      for(const c of this.solids){
        const p=c.prop;if(p?.broken||p?.heldBy===f.id||p?.pulledBy)continue;
        const parts=body();if(!parts.some(b=>Math.abs(b.p[0]-c.x)<c.hx+b.r&&Math.abs(b.p[1]-c.y)<c.hy+b.r&&Math.abs(b.p[2]-c.z)<c.hz+b.r))continue;
        const hit=parts.map(b=>sphere(b.p,b.r,c)).find(Boolean);if(!hit||Math.abs(hit.n[1])>.8)continue;
        const speed=Math.max(0,-vx*hit.n[0]-vz*hit.n[2]),dynamic=p?.mass>0;
        const part=dynamic?.20:1;this.movePair(f,hit.n[0]*hit.depth*part,hit.n[2]*hit.depth*part);
        if(dynamic){p.sleep=false;p.settle=0;p.x-=hit.n[0]*hit.depth*.8;p.z-=hit.n[2]*hit.depth*.8;p.vx-=hit.n[0]*Math.min(7,speed)*.85;p.vz-=hit.n[2]*Math.min(7,speed)*.85;p.wx+=hit.n[2]*speed*.3;p.wz-=hit.n[0]*speed*.3;}
        else{
          const velocity=f.vx*hit.n[0]+f.vz*hit.n[2],restitution=p?.type==='bumper'&&w.hazards?.9:.3;if(velocity<0){f.vx-=hit.n[0]*velocity*(1+restitution);f.vz-=hit.n[2]*velocity*(1+restitution);}
          if(p?.type==='bumper'&&w.hazards&&speed>2.4&&!f.held&&w.grapple?.owner!==f&&w.time-(f.bumperAt??-10)>.9&&(f.tumbling||f.lastAttacker&&w.time-(f.lastHitAt??-10)<2)){f.bumperAt=w.time;const source=w.time-(f.lastHitAt??-10)<2?f.lastAttacker:null;w.environmentHit(f,{source,damage:6,kind:'bumper',dir:hit.n,speed});f.vx=hit.n[0]*Math.min(6,speed*.9);f.vz=hit.n[2]*Math.min(6,speed*.9);f.vy=4.2/Math.sqrt(f.mass||1);f.y=Math.max(.04,f.y);f.down=0;f.visual=null;f.recovery=null;f.tumbling=true;w.emit('bumperBounce',{by:source?.id,target:f.id,x:p.x,z:p.z});}
          if(p&&!p.mass&&Number.isFinite(p.health)&&speed>2.5&&f.lastAttacker&&w.time-(f.lastHitAt??-10)<1.6){this.damage(p,Math.min(60,speed*13),f.lastAttacker,{x:vx*.3,y:.5,z:vz*.3});if(p.broken)w.environmentHit(f,{source:f.lastAttacker,damage:12,kind:p.type==='table'?'table':'barrier',dir:hit.n,speed,preserve:!!f.held,propType:p?.type||null});}
          if(!p&&speed>1.2&&w.time-(f.wallAt??-10)>.75&&((f.lastAttacker&&w.time-(f.lastHitAt??-10)<1.6)||f.tumbling)){
            f.wallAt=w.time;this.stats.wallHits++;
            w.environmentHit(f,{source:f.lastAttacker,damage:Math.round(C(speed*1.5,3,12)),kind:'wall',dir:hit.n,speed,preserve:!!f.held,propType:p?.type||null});
          }
        }
      }
      this.movePair(f,C(f.x,-6.08,6.08)-f.x,C(f.z,-5.58,5.58)-f.z);
      this.previous[f.id]={x:f.x,z:f.z,h};
    }
    collideNode(point,r,f){
      if(f.balloon)return;
      for(const c of this.solids){if(c.prop?.heldBy===f.id||c.prop?.broken||Math.abs(point[0]-c.x)>c.hx+r||Math.abs(point[1]-c.y)>c.hy+r||Math.abs(point[2]-c.z)>c.hz+r)continue;const hit=sphere(point,r,c);if(hit){if(point[1]+hit.n[1]*hit.depth<r){const dx=c.hx+r-Math.abs(point[0]-c.x),dz=c.hz+r-Math.abs(point[2]-c.z);if(dx<dz){hit.n=[point[0]>=c.x?1:-1,0,0];hit.depth=dx;}else{hit.n=[0,0,point[2]>=c.z?1:-1];hit.depth=dz;}}for(let i=0;i<3;i++)point[i]+=hit.n[i]*hit.depth;}}
    }
    steer(f,target,desired=null){
      const dx=target.x-f.x,dz=target.z-f.z,d=len(dx,dz)||1,base=desired?Math.atan2(desired[0],desired[1]):Math.atan2(dx,dz);
      let best=null;
      for(const turn of [0,.48,-.48,.92,-.92,1.48,-1.48,2.25,-2.25,Math.PI]){
        const x=Math.sin(base+turn),z=Math.cos(base+turn);let cost=Math.abs(turn)*.38;
        for(const reach of [.32,.65,1.05]){
          const point=[f.x+x*reach,f.y+.55,f.z+z*reach];
          if(Math.abs(point[0])>5.72||Math.abs(point[2])>5.22)cost+=4*reach;
          for(const c of this.solids){if(c.prop?.mass&&!c.prop.anchored||c.prop?.broken)continue;if(sphere(point,.39,c)||sphere([point[0],f.y+1.35,point[2]],.30,c))cost+=6*reach;}
        }
        if(!best||cost<best.cost)best={x,z,cost};
      }
      return best.cost>10?[0,0]:[best.x,best.z];
    }
    constrainBag(p){
      if(!p.anchor)return;
      const delta=[p.x-p.anchor[0],p.y-p.anchor[1],p.z-p.anchor[2]],distance=Math.hypot(...delta)||1,n=delta.map(v=>v/distance);
      [p.x,p.y,p.z]=p.anchor.map((v,i)=>v+n[i]*p.rope);
      const radial=p.vx*n[0]+p.vy*n[1]+p.vz*n[2];p.vx-=n[0]*radial;p.vy-=n[1]*radial;p.vz-=n[2]*radial;
      p.rx=Math.atan2(p.z-p.anchor[2],p.anchor[1]-p.y);p.rz=-Math.atan2(p.x-p.anchor[0],p.anchor[1]-p.y);p.wx=p.wz=0;p.sleep=false;
    }
    springs(dt){
      const w=this.world;
      for(const pad of this.pads){
        pad.flash=Math.max(0,pad.flash-dt*2.5);if(!w.hazards)continue;
        for(const f of w.fighters()){
          if(f.ko||f.held||w.grapple?.owner===f||w.tether?.owner===f||f.y>.10||f.vy>1||len(f.x-pad.x,f.z-pad.z)>pad.radius+.12||w.time-(pad.last[f.id]??-10)<.8)continue;
          pad.last[f.id]=w.time;pad.flash=1;
          if(w.ground?.target===f){w.standBlend(w.ground.owner);w.ground.owner.visual=null;w.ground=null;f.visual=null;f.down=f.stunned=0;}
          f.y=.04;f.vy=f.balloon?8.6:7.6;if(f.down>0){f.down=0;f.tumbling=true;f.visual=null;}
          if(f.balloon)f.balloon.squashV-=3.5;
          this.stats.springLaunches++;w.emit('springLaunch',{by:f.id,x:pad.x,z:pad.z});
        }
        for(const p of this.props){
          if(p.broken||p.heldBy||p.pulledBy||p.anchored||!p.mass||p.type==='debris'||p.y>extents(p)[1]+.12||p.vy>1||len(p.x-pad.x,p.z-pad.z)>pad.radius||w.time-(pad.last[p.id]??-10)<.9)continue;
          pad.last[p.id]=w.time;pad.flash=1;p.sleep=false;p.settle=0;p.vy=6.5*Math.sqrt(5/Math.max(4,p.mass));p.wx+=1.5;p.wz+=1;
          p.owner=w.time-(p.thrownAt??-10)<2?p.owner:null;p.thrownAt=w.time;p.springArmed=true;p.armedUntil=w.time+2.5;
          w.emit('springProp',{prop:p.name,x:pad.x,z:pad.z});
        }
      }
    }
    step(dt){
      const w=this.world,r=this.retrieve;
      this.gadgets.step(dt);this.springs(dt);
      if(r){if(!r.owner.action?.move.propFetch||r.owner.ko||r.owner.stunned>.1){r.prop.pulledBy=null;this.retrieve=null;}
        else{const t=ease((w.time-r.at)/r.duration),f=r.owner,p=r.prop,goal=[f.x+Math.sin(f.angle)*.65,1.40+f.y,f.z+Math.cos(f.angle)*.65],arc=Math.sin(t*Math.PI);[p.x,p.y,p.z]=r.from.map((v,i)=>v+(goal[i]-v)*t+arc*(i===1?.4:r.bend[i===0?0:1]));if(t>=1){p.pulledBy=null;p.heldBy=f.id;this.retrieve=null;this.stats.stretchGets++;w.emit('propPickup',{prop:p.name,elastic:true,by:f.id});}}
      }
      const count=Math.max(1,Math.ceil(dt/(1/120))),h=dt/count;
      for(let k=0;k<count;k++){
        for(const p of this.props){
          if(p.broken)continue;
          if(p.life!==undefined){p.life-=h;if(p.life<=0){p.broken=true;continue;}}
          if(p.heldBy){
            const f=w.getFighter(p.heldBy);if(!f||f.ko){p.heldBy=null;p.sleep=false;continue;}
            const a=f.action,e=a?.move.elasticProp?ease(a.t/a.move.startup):0,other=w.targetFor(f);
            const distance=len(other.x-f.x,other.z-f.z);
            let reach=mSafeReach(a,e,distance);
            for(let d=.65;d<reach;d+=.15)if([...this.walls,...this.pillars].some(c=>sphere([f.x+Math.sin(f.angle)*d,f.y+1.4,f.z+Math.cos(f.angle)*d],.35,c))){reach=Math.max(.65,d-.15);break;}
            const state=a?a.id+':'+a.chain:'idle';if(p.lastAction!==state&&f.propSocket?.id===p.id){p.x=f.propSocket.x;p.y=f.propSocket.y;p.z=f.propSocket.z;}p.lastAction=state;
            const blend=1-Math.exp(-24*h);p.x+=(f.x+Math.sin(f.angle)*reach+Math.cos(f.angle)*.23-p.x)*blend;p.z+=(f.z+Math.cos(f.angle)*reach-Math.sin(f.angle)*.23-p.z)*blend;p.y+=(f.y+1.40-p.y)*blend;
            const pose=a?.move.pose,swing=a?.move.weapon&&!['staffThrust','staffLift','gunButt'].includes(pose),sign=pose==='batonBack'||pose==='weaponBack'?-1:1;
            p.angle=f.angle+(swing?Math.sin(C(a.t/a.move.duration,0,1)*Math.PI)*(p.type==='staff'?1.25:2.1)*sign:0);p.rx=p.type==='baton'?-.75:p.type==='blaster'?0:-.15;p.rz=p.gear?0:.1;continue;
          }
          if(p.pulledBy||!p.mass||p.sleep)continue;
          const before=[p.x,p.y,p.z];p.vy-=12*h;p.x+=p.vx*h;p.y+=p.vy*h;p.z+=p.vz*h;p.angle+=p.wy*h;p.rx+=p.wx*h;p.rz+=p.wz*h;
          const drag=Math.exp(-(p.anchored?.40:p.wheeled?.35:1.1)*h);p.vx*=drag;p.vz*=drag;p.wx*=Math.exp(-2*h);p.wy*=Math.exp(-2*h);p.wz*=Math.exp(-2*h);
          this.constrainBag(p);
          const e=extents(p);if(p.y<e[1]){p.y=e[1];p.vy=p.vy<-.7?-p.vy*(p.bounce||.20):0;const friction=Math.exp(-(p.wheeled?1.2:p.type==='tyre'?2.6:6)*h);p.vx*=friction;p.vz*=friction;p.wx*=friction;p.wy*=friction;p.wz*=friction;}
          const structures=[...this.walls,...this.pillars,...this.gadgets.colliders(),...this.props.filter(q=>!q.mass&&!q.broken&&q!==p).flatMap(q=>this.colliders(q))];
          for(const c of structures){const hit=sphere([p.x,p.y,p.z],Math.max(p.hx,p.hz)*.8,c);if(hit){
            const speed=Math.hypot(p.vx,p.vy,p.vz);if(c.prop&&p.owner&&speed>3){this.damage(c.prop,12+speed*Math.sqrt(p.mass)*2,w.getFighter(p.owner),{x:p.vx*.3,y:1,z:p.vz*.3});if(c.prop.broken)continue;}
            p.x+=hit.n[0]*hit.depth;p.y+=hit.n[1]*hit.depth;p.z+=hit.n[2]*hit.depth;const v=p.vx*hit.n[0]+p.vy*hit.n[1]+p.vz*hit.n[2];if(v<0){const bounce=1+(c.prop?.restitution||.3);p.vx-=hit.n[0]*v*bounce;p.vy-=hit.n[1]*v*bounce;p.vz-=hit.n[2]*v*bounce;}
          }}
          p.x=C(p.x,-6,6);p.z=C(p.z,-5.5,5.5);
          if(!p.anchored&&Math.hypot(p.vx,p.vy,p.vz,p.wx,p.wy,p.wz)<.18&&p.y<=extents(p)[1]+.01){p.settle+=h;if(p.settle>.5){p.sleep=true;p.vx=p.vy=p.vz=p.wx=p.wy=p.wz=0;}}else p.settle=0;
          if((p.owner||p.springArmed||p.machineArmed)&&w.time<p.armedUntil){
            const speed=Math.hypot(p.vx,p.vy,p.vz);
            if(speed>3)for(const f of w.fighters()){
              if(f.ko||f.dodge&&f.dodge.t<.24||(f.id===p.owner&&w.time-p.thrownAt<.35)||w.time-(p.hits[f.id]??-10)<.7)continue;
              const segment=[p.x-before[0],p.y-before[1],p.z-before[2]],center=[f.x,f.y+(f.down>0?.35:1.2),f.z],dot=segment.reduce((s,v,i)=>s+v*(center[i]-before[i]),0),length=segment.reduce((s,v)=>s+v*v,0),t=C(dot/(length||1),0,1),point=before.map((v,i)=>v+segment[i]*t);
              const box={x:point[0],y:point[1],z:point[2],hx:e[0],hy:e[1],hz:e[2]},contact=f.balloon?sphere([f.x,f.y+f.balloon.radius,f.z],f.balloon.radius,box):[f.down>0?.35:.65,f.down>0?.35:1.45].some(y=>sphere([f.x,f.y+y,f.z],.34,box));
              if(contact){p.hits[f.id]=w.time;this.stats.propHits++;const dir=len(p.vx,p.vz)>.2?[p.vx,0,p.vz]:[f.x-p.x,0,f.z-p.z];w.environmentHit(f,{source:w.getFighter(p.owner),damage:Math.round(C(speed*Math.sqrt(p.mass)*.85,7,28)),kind:'prop',dir,speed,propType:p?.type||null});if(p.springArmed&&p.vy>2){f.y=Math.max(.03,f.y);f.vy=Math.max(f.vy,p.vy*.45);f.tumbling=true;}this.damage(p,12+speed*1.7,w.getFighter(p.owner));p.vx*=-.25;p.vz*=-.25;p.vy=1;p.armedUntil=0;p.springArmed=false;p.machineArmed=false;break;}
            }
          }
        }
        const live=this.props.filter(p=>!p.broken&&!p.heldBy&&!p.pulledBy&&p.mass&&p.type!=='debris');
        for(let a=0;a<live.length;a++)for(let b=a+1;b<live.length;b++){const p=live[a],q=live[b];if(p.sleep&&q.sleep)continue;const dx=q.x-p.x,dz=q.z-p.z,d=len(dx,dz),reach=Math.max(p.hx,p.hz)+Math.max(q.hx,q.hz);if(d<reach&&d>.001&&Math.abs(p.y-q.y)<p.hy+q.hy){p.sleep=q.sleep=false;const x=dx/d,z=dz/d,wa=1/p.mass,wb=1/q.mass,gap=reach-d;p.x-=x*gap*wa/(wa+wb);p.z-=z*gap*wa/(wa+wb);q.x+=x*gap*wb/(wa+wb);q.z+=z*gap*wb/(wa+wb);const v=(q.vx-p.vx)*x+(q.vz-p.vz)*z;if(v<0){const impulse=-v*1.2/(wa+wb);p.vx-=x*impulse*wa;p.vz-=z*impulse*wa;q.vx+=x*impulse*wb;q.vz+=z*impulse*wb;}}}
        for(const p of live)if(p.anchored)this.constrainBag(p);
      }
      this.props=this.props.filter(p=>!p.broken||!['debris','earthwall','earthplatform','earthridge'].includes(p.type));
      this.rebuild();for(const f of w.fighters())this.resolveFighter(f,dt);this.rebuild();
    }
    stage(kind){
      const w=this.world;w.mode='practice';w.dummy='passive';w.infinite=true;w.arenaId='courtyard';w.reset();const p=w.player,e=w.enemy;
      if(kind==='table'){p.x=2.8;p.z=-.63;e.x=2.8;e.z=-1.40;const chair=this.props.find(p=>p.type==='chair');chair.x=4.2;chair.z=-1.1;}
      if(kind==='wall'){p.x=-.3;p.z=-3.85;e.x=-.3;e.z=-5.12;}
      if(kind==='chair'){p.x=-2.8;p.z=1.15;e.x=-1.2;e.z=.05;}
      if(kind==='stretch'){p.x=-2;p.z=.8;e.x=.1;e.z=-.4;const chair=this.props.find(p=>p.type==='chair');chair.x=1.3;chair.z=-1.4;}
      if(kind==='balloon'){p.x=0;p.z=3.25;e.x=0;e.z=-.2;const chair=this.props.find(p=>p.type==='chair');chair.x=1.6;chair.z=-.9;const crate=this.props.find(p=>p.type==='crate');crate.x=-1.6;crate.z=-1.5;}
      if(kind==='spring'){const pad=this.pads[0];p.x=pad.x+.2;p.z=pad.z-1.2;e.x=pad.x;e.z=pad.z;w.hazards=true;}
      if(kind==='divider'){const barrier=this.props.find(p=>p.type==='divider');barrier.x=.2;barrier.z=-2.1;barrier.angle=0;p.x=.2;p.z=-.1;e.x=.2;e.z=-1.25;}
      if(kind==='bag'){const bag=this.props.find(p=>p.anchored);bag.anchor=[0,3.2,-1.35];bag.x=0;bag.y=1.7;bag.z=-1.35;p.x=0;p.z=.15;e.x=0;e.z=-2.6;}
      w.face(p,e);w.face(e,p);this.previous={};this.rebuild();w.emit('yardDrill',{kind});
    }
    snapshot(){return {arena:this.world.arenaId||'courtyard',stats:{...this.stats},held:this.held(this.world.player)?.name||null,retrieving:this.retrieve?.prop.id||null,pads:this.pads.map(p=>({x:p.x,z:p.z,active:!!this.world.hazards})),machinery:this.gadgets.snapshot(),props:this.props.filter(p=>!p.broken).map(p=>({id:p.id,type:p.type,x:p.x,y:p.y,z:p.z,heldBy:p.heldBy}))};}
  }
  const API={Yard,TYPES,rotation,extents,sphere,ARENAS};root.CombatYard=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
