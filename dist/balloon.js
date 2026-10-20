/* Elastic balloon form: a rolling body with its own continuous contact solver. */
(function(root){
  'use strict';
  const {sphere,extents}=root.CombatYard||(typeof require==='function'?require('./yard.js'):null);
  const C=(v,a,b)=>Math.max(a,Math.min(b,v)),L=(x,z)=>Math.hypot(x,z),ease=t=>{t=C(t,0,1);return t*t*(3-2*t);};
  function roll(q,dx,dz,r){
    const d=L(dx,dz);if(d<1e-8)return q;
    const s=Math.sin(d/r*.5),a=[dz/d*s,0,-dx/d*s,Math.cos(d/r*.5)];
    const n=[a[3]*q[0]+a[0]*q[3]+a[1]*q[2]-a[2]*q[1],a[3]*q[1]-a[0]*q[2]+a[1]*q[3]+a[2]*q[0],a[3]*q[2]+a[0]*q[1]-a[1]*q[0]+a[2]*q[3],a[3]*q[3]-a[0]*q[0]-a[1]*q[1]-a[2]*q[2]],len=Math.hypot(...n);
    return n.map(v=>v/len);
  }
  class Balloon{
    constructor(world){this.world=world;}
    toggle(){
      const w=this.world,f=w.player;
      if(w.run?.blocked()||w.over||f.ko||f.held||f.down>0||f.stunned>0||f.dodge)return false;
      if(f.balloon)return this.exit(f);
      if(w.grapple?.phase&&w.grapple.phase!=='clinch'){w.emit('yardNotice',{text:'Finish the throw before inflating.'});return false;}
      if(f.action&&(!f.action.hit||f.action.t<f.action.move.cancel)){
        if(f.buffer.length>=4){w.emit('bufferFull');return false;}
        f.buffer.push({token:'O',until:w.time+Math.max(.9,f.action.move.cancel-f.action.t+.5)});w.emit('input',{token:'O',buffered:true});return true;
      }
      if(!this.spend(f,12))return false;
      if(w.demo){w.demo=null;w.emit('demoEnd');}
      if(w.grapple)w.releaseGrip('inflate');
      if(w.tether){w.tether.target.held=false;w.tether=null;}
      if(w.ground){w.ground.target.visual=null;w.ground=null;}
      w.yard.onHurt(f);f.action=null;f.guard=false;f.visual=null;f.recovery=null;f.chain='';f.connections=[];
      f.balloon={phase:'inflating',amount:0,radius:.34,pressure:100,facing:f.angle,quat:[0,0,0,1],squash:0,squashV:0,braking:false,boostUntil:0,burstAt:-10,hopAt:-10,drop:null,hits:{},props:{},walls:{},after:[]};
      f.vx*=.55;f.vz*=.55;w.emit('balloonInflate');return true;
    }
    spend(f,cost){
      const w=this.world,free=w.freePlayer();
      if(!free&&f.stamina<cost){w.emit('tired');return false;}
      if(!free)f.stamina-=cost;f.regenAt=w.time+.8;return true;
    }
    exit(f,token){
      const b=f.balloon;if(!b)return false;
      if(token&&token!=='C'&&token!=='O'&&b.after.length<4)b.after.push(token);
      if(b.phase!=='deflating'){b.phase='deflating';b.drop=null;b.boostUntil=0;b.braking=false;b.exitFrom=b.amount;this.world.emit('balloonDeflate',{follow:token||null});}
      return true;
    }
    command(f,token){
      const b=f.balloon,w=this.world;if(!b||f.ko)return false;
      if(b.phase==='deflating')return this.exit(f,token);
      if(b.amount<.92){if(f.buffer.length>=4){w.emit('bufferFull');return false;}f.buffer.push({token,until:w.time+1.4});return true;}
      if(token==='E')return w.flow.chargeBalloon(f);
      if(token==='K')return this.hop(f);
      if(token==='H')return this.drop(f);
      if(token!=='P')return this.exit(f,token);
      if(w.time-b.burstAt<.85)return false;
      const burstCost=26*Math.pow(.9,w.perk('balloon'));
      if(b.pressure<burstCost){w.emit('yardNotice',{text:'Let the balloon refill a little before another burst.'});return false;}
      if(!this.spend(f,10))return false;
      const input=w.input,n=L(input.x,input.z),speed=L(f.vx,f.vz),dir=n>.1?[input.x/n,input.z/n]:speed>1?[f.vx/speed,f.vz/speed]:[Math.sin(f.angle),Math.cos(f.angle)];
      f.vx=dir[0]*9.8;f.vz=dir[1]*9.8;b.boostUntil=w.time+.42;b.burstAt=w.time;b.pressure-=burstCost;b.squashV-=2;
      w.emit('balloonBurst');return true;
    }
    hop(f=this.world.player){
      const b=f.balloon,w=this.world;if(!b||b.phase==='deflating')return false;
      if(b.amount<.92)return this.command(f,'K');
      if(f.y>.06||w.time-b.hopAt<.3||b.drop)return false;
      if(!this.spend(f,6))return false;
      f.vy=5.5;f.y=.015;b.hopAt=w.time;b.squashV-=3;w.emit('balloonHop');return true;
    }
    drop(f){
      const b=f.balloon,w=this.world;if(b.drop||w.time-(b.dropAt??-10)<.75||b.pressure<18)return false;
      if(!this.spend(f,12))return false;
      b.pressure-=18;b.dropAt=w.time;b.drop={at:w.time,diving:f.y>.65};
      f.vx*=.65;f.vz*=.65;f.vy=b.drop.diving?-10:7.0;f.y=Math.max(.01,f.y);w.emit('balloonDrop');return true;
    }
    absorb(f,source,move){
      const w=this.world,b=f.balloon,damage=Math.max(move.damage?1:0,Math.round(move.damage*.65));
      f.health=Math.max(0,f.health-damage);f.hurt=.22;b.pressure=Math.max(0,b.pressure-(move.damage*.8+(move.grab?7:0)));b.squashV+=2;
      const push=move.grab?1.2:2.2+move.damage*.08;f.vx+=Math.sin(source.angle)*push;f.vz+=Math.cos(source.angle)*push;
      if(move.launch){f.vy=Math.max(f.vy,4.5);f.y=Math.max(.02,f.y);}
      w.spark(f.x,f.y+b.radius,f.z,'hit',9);w.shake=Math.max(w.shake,.10);w.freeze=Math.max(w.freeze,.025);
      if(damage)w.emit('hurt',{damage,balloon:true});else w.emit('balloonDeflect');
      if(b.pressure<5)this.exit(f);
      if(f.health<=0){this.exit(f);w.knockout(f);}return 'hit';
    }
    impact(f,normal,speed,key){
      const b=f.balloon,w=this.world;b.squashV+=Math.min(4.2,speed*.5);b.impactNormal=normal;
      if(speed>2&&w.time-(b.walls[key]??-10)>.20){b.walls[key]=w.time;w.emit('balloonRicochet',{x:f.x,z:f.z,speed});}
    }
    hitEnemy(f,other,h){
      const b=f.balloon,w=this.world;if(other.ko||other.held||other.dodge&&other.dodge.t<.24)return;
      const center=[f.x,f.y+b.radius,f.z],r=b.radius;
      const samples=other.down>0&&other.y<.15?[.28,.48]:[.50,1.15,1.70];
      let contact=false;for(const y of samples)if(Math.hypot(other.x-center[0],other.y+y-center[1],other.z-center[2])<r+.32){contact=true;break;}
      if(!contact)return;
      const dx=other.x-f.x,dz=other.z-f.z,d=L(dx,dz),nx=d>.001?dx/d:Math.sin(f.angle),nz=d>.001?dz/d:Math.cos(f.angle),closing=(f.vx-other.vx)*nx+(f.vz-other.vz)*nz,speed=L(f.vx,f.vz);
      const reach=r+.34,gap=Math.max(0,reach-d);f.x-=nx*gap*.18;f.z-=nz*gap*.18;other.x+=nx*gap*.82;other.z+=nz*gap*.82;
      if(closing<2.3||speed<2.6||b.amount<.9||b.phase==='deflating'||w.time-(b.hits[other.id]??-10)<.85)return;
      // A standing guard can brace against a slow roll; a burst bowls through it.
      if(other.guard&&speed<5.2){other.stamina=Math.max(0,other.stamina-12);f.vx-=nx*closing*1.6;f.vz-=nz*closing*1.6;this.impact(f,[-nx,0,-nz],speed,'guard');b.hits[other.id]=w.time;w.emit('block',{by:other.id,move:'Balloon roll'});return;}
      b.hits[other.id]=w.time;b.pressure=Math.max(0,b.pressure-7);
      w.environmentHit(other,{source:f,damage:Math.round(C(6+speed*1.7,10,24)),kind:'balloon',dir:[nx,0,nz],speed});
      w.flow.balloonHit(f,other);
      other.vx=nx*(3+speed*.46)/(other.mass||1);other.vz=nz*(3+speed*.46)/(other.mass||1);other.vy=Math.max(other.vy,(2.5+speed*.12)/Math.sqrt(other.mass||1));other.y=Math.max(.03,other.y);other.tumbling=true;
      f.vx-=nx*closing*1.18;f.vz-=nz*closing*1.18;f.vy=Math.max(f.vy,Math.min(2,speed*.2));
      this.impact(f,[-nx,0,-nz],speed,'enemy');w.emit('balloonBowl',{speed});
    }
    contacts(f,h){
      const w=this.world,yard=w.yard,b=f.balloon,r=b.radius;
      for(const c of yard.solids){
        const p=c.prop;if(p?.broken||p?.heldBy||p?.pulledBy||p?.type==='debris')continue;
        if(Math.abs(f.x-c.x)>c.hx+r||Math.abs(f.z-c.z)>c.hz+r||Math.abs(f.y+r-c.y)>c.hy+r)continue;
        const hit=sphere([f.x,f.y+r,f.z],r,c);if(!hit)continue;
        const n=hit.n,dynamic=p?.mass>0,relative=(f.vx-(p?.vx||0))*n[0]+(f.vy-(p?.vy||0))*n[1]+(f.vz-(p?.vz||0))*n[2],speed=Math.max(0,-relative);
        if(p&&!p.mass&&Number.isFinite(p.health)&&speed>3&&w.time-(b.props[p.id]??-10)>.5){b.props[p.id]=w.time;yard.damage(p,45,f,{x:f.vx*.6,y:3,z:f.vz*.6});if(p.broken){this.impact(f,n,speed,p.id);continue;}}
        const mass=11,share=dynamic?p.mass/(mass+p.mass):1;
        f.x+=n[0]*hit.depth*share;f.y=Math.max(0,f.y+n[1]*hit.depth*share);f.z+=n[2]*hit.depth*share;
        if(dynamic){p.x-=n[0]*hit.depth*(1-share);p.y-=n[1]*hit.depth*(1-share);p.z-=n[2]*hit.depth*(1-share);p.sleep=false;p.settle=0;}
        if(relative<0){
          const restitution=b.braking?.16:p?.restitution||.64,impulse=-(1+restitution)*relative/(1/mass+(dynamic?1/p.mass:0));
          f.vx+=n[0]*impulse/mass;f.vy+=n[1]*impulse/mass;f.vz+=n[2]*impulse/mass;
          if(dynamic){p.vx-=n[0]*impulse/p.mass;p.vy-=n[1]*impulse/p.mass;p.vz-=n[2]*impulse/p.mass;p.wx-=n[2]*speed*.8;p.wz+=n[0]*speed*.8;
            if(speed>2.7&&w.time-(b.props[p.id]??-10)>.55){b.props[p.id]=w.time;yard.damage(p,C(speed*3.8,6,38),f);p.owner=f.id;p.thrownAt=w.time;p.armedUntil=w.time+1.2;p.vy=Math.max(p.vy,1.6);}
          }
          this.impact(f,n,speed,c.id);
        }
      }
      // Keep high bounces within the playable courtyard, including above low walls.
      for(const [axis,limit] of [['x',6.20-r],['z',5.70-r]])if(Math.abs(f[axis])>limit){const sign=Math.sign(f[axis]),velocity='v'+axis;f[axis]=sign*limit;if(f[velocity]*sign>0){const speed=Math.abs(f[velocity]);f[velocity]*=b.braking?-.18:-.64;this.impact(f,axis==='x'?[-sign,0,0]:[0,0,-sign],speed,'edge-'+axis);}}
      for(const target of w.targetsFor(f))this.hitEnemy(f,target,h);
    }
    slam(f,speed){
      const w=this.world,b=f.balloon,radius=2.65;
      b.drop=null;b.squashV+=6;w.emit('balloonSlam',{x:f.x,z:f.z,radius});w.shake=Math.max(w.shake,.24);
      for(const other of w.targetsFor(f)){
      const d=L(other.x-f.x,other.z-f.z),dx=(other.x-f.x)/(d||1),dz=(other.z-f.z)/(d||1);
      if(!other.ko&&!other.held&&!(other.dodge&&other.dodge.t<.24)&&d<radius&&other.y<.9&&!w.yard.lineBlocked(f,other,.7)){
        b.hits[other.id]=w.time;w.environmentHit(other,{source:f,damage:Math.round(24-d*4),kind:'belly',dir:[dx||0,0,dz||1],speed});other.vx=dx*4.6/(other.mass||1);other.vz=dz*4.6/(other.mass||1);other.vy=3.4/Math.sqrt(other.mass||1);other.y=Math.max(.03,other.y);other.tumbling=true;
      }
      }
      for(const p of w.yard.props){if(p.broken||p.heldBy||p.pulledBy||p.type==='debris')continue;const d=L(p.x-f.x,p.z-f.z);if(d>radius+Math.max(p.hx,p.hz)||w.yard.lineBlocked(f,{x:p.x,y:0,z:p.z},.7,p))continue;const force=C(1-d/3.3,.15,1),mass=p.mass||8;
        w.yard.damage(p,42*force,f,{x:(p.x-f.x)/(d||1)*6*force,y:4*force*Math.sqrt(5/mass),z:(p.z-f.z)/(d||1)*6*force});
      }
      w.spark(f.x,.15,f.z,'hit',20);w.freeze=Math.max(w.freeze,.045);
      if(b.chargedUntil>w.time){b.chargedUntil=0;w.flow.pulse(f,f,{radius:2.65,damage:10,name:'Thunder belly'});}
    }
    step(f,dt){
      const w=this.world,b=f.balloon;if(!b)return;
      f.hurt=Math.max(0,f.hurt-dt);f.stunned=Math.max(0,f.stunned-dt);f.down=Math.max(0,f.down-dt);f.guard=false;f.moving=0;
      if(f.ko)this.exit(f);
      if(b.phase==='inflating'){b.amount=Math.min(1,b.amount+dt/.42);if(b.amount===1)b.phase='rolling';}
      else if(b.phase==='deflating')b.amount=Math.max(0,b.amount-dt/.34);
      b.radius=.34+.58*ease(b.amount);b.pressure=Math.min(100,b.pressure+dt*(w.time>b.boostUntil?13:0));
      if(w.time>f.regenAt&&!b.drop&&w.time>b.boostUntil)f.stamina=Math.min(100,f.stamina+16*dt);
      // A damped spring supplies squash and overshoot, independent of frame rate.
      const count=Math.max(1,Math.ceil(dt/(1/120))),h=dt/count;
      for(let i=0;i<count;i++){
        b.squashV+=(-100*b.squash-11*b.squashV)*h;b.squash+=b.squashV*h;b.squash=C(b.squash,-.16,.36);
        if(b.phase==='rolling'&&!f.ko){
          const input=w.input,n=L(input.x,input.z),ground=f.y<.04,acceleration=(1+w.perk('balloon')*.14)*(ground?9:4.8)*(b.braking?.3:1);
          if(n>.01){f.vx+=input.x/Math.max(1,n)*acceleration*h;f.vz+=input.z/Math.max(1,n)*acceleration*h;f.angle=Math.atan2(input.x,input.z);}
        }
        const speed=L(f.vx,f.vz),max=w.time<b.boostUntil?10.2:6.6;
        if(speed>max){const t=Math.exp(-6*h),ratio=(max+(speed-max)*t)/speed;f.vx*=ratio;f.vz*=ratio;}
        const drag=Math.exp(-(b.phase==='deflating'?4:b.braking?9*(1+w.perk('balloon')*.18):f.y>.05?.18:.90)*h);f.vx*=drag;f.vz*=drag;
        if(b.drop&&!b.drop.diving&&(f.y>.65||w.time-b.drop.at>.24)){b.drop.diving=true;f.vy=-10;}
        const x=f.x,z=f.z;f.x+=f.vx*h;f.z+=f.vz*h;
        const falling=f.vy;f.vy-=12*h;f.y+=f.vy*h;
        if(f.y<0){f.y=0;if(b.drop?.diving){this.slam(f,Math.abs(falling));f.vy=2.4;}
          else if(falling<-2.8&&b.phase==='rolling'){f.vy=-falling*.46;b.squashV+=Math.min(5,-falling*.65);w.emit('balloonBounce',{x:f.x,z:f.z,speed:-falling});}
          else f.vy=0;
        }
        this.contacts(f,h);
        if(b.amount>.90&&b.phase==='rolling')b.quat=roll(b.quat,f.x-x,f.z-z,b.radius);
      }
      if(f.hits&&w.time>f.hitUntil){f.hits=0;f.damage=0;}
      if(b.phase==='rolling'&&f.buffer.length){const next=f.buffer.shift();if(next.until>=w.time)this.command(f,next.token);}
      if(b.phase==='deflating'&&b.amount<=0){
        const after=b.after;f.balloon=null;f.vx*=.5;f.vz*=.5;f.chain='';f.connections=[];f.flow=0;w.emit('balloonExit');
        if(!f.ko&&after.length){const first=after.shift(),target=w.targetFor(f,false);f.buffer=after.map(token=>({token,until:w.time+1.8}));w.start(f,target,first);const a=f.action,d=L(target.x-f.x,target.z-f.z);if(a?.move.launch&&!a.entryDrive&&!a.move.air&&!a.move.wind&&d>2.05&&d<3.75&&!w.yard.lineBlocked(f,target))a.entryDrive={distance:Math.min(1.35,d-1.65),travel:0};}
      }
    }
  }
  const API={Balloon,roll};root.CombatBalloon=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
