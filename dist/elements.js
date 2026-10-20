/* Earth, fire and water share real solids, swept projectiles, combat timing and attribution. */
(function(root){
  'use strict';
  const A=root.CombatArsenal||(typeof require==='function'?require('./arsenal.js'):null),Contact=root.CombatContact||(typeof require==='function'?require('./contact.js'):null);
  const C=(v,a,b)=>Math.max(a,Math.min(b,v)),L=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const move=(name,pose,damage,cost,startup,duration,range,element,focus,family,extra={})=>({name,pose,damage,cost,startup,duration,range,element,elementFamily:family,focus,cancel:startup+.12,push:0,stun:.3,lunge:0,...extra});
  const melee=(name,pose,damage,cost,startup,duration,range,tag,extra={})=>({name,pose,damage,cost,startup,duration,range,elementTag:tag,elementFamily:tag[0].toUpperCase()+tag.slice(1),focus:18,cancel:startup+.10,push:.32,stun:.35,lunge:.12,...extra});
  const MOVES={
    earthwall:move('Raise earth cover','earthRaise',0,8,.30,.65,1.7,'wall',24,'Earth'),
    earthlift:move('Fault-line launcher','earthLift',17,10,.34,.68,5.7,'lift',24,'Earth',{launch:true}),
    earthquake:move('Seismic ring','earthQuake',23,15,.44,.83,2.8,'quake',36,'Earth',{finish:true}),
    firebolt:move('Ember shot','fireCast',13,5,.18,.42,10,'bolt',12,'Fire'),
    flameline:move('Flame trail','flameSweep',8,10,.34,.71,5.5,'trail',28,'Fire'),
    fireburst:move('Furnace burst','fireBurst',24,15,.38,.77,2.6,'burst',34,'Fire',{finish:true}),
    stonefist:melee('Stone-breaker fist','cross',25,11,.24,.56,2.6,'earth',{break:true,limb:'R',finish:true}),
    boulder:move('Boulder pitch','boulderCast',25,12,.36,.73,9,'boulder',24,'Earth'),
    stonevault:move('Stone vault','stoneVault',8,11,.18,.47,1.8,'vault',20,'Earth',{mobilityElement:true}),
    flameupper:melee('Blazing uppercut','leadupper',19,10,.20,.51,2.3,'fire',{launch:true,limb:'L'}),
    cometkick:melee('Comet heel','roundhouse',23,12,.25,.58,2.7,'fire',{limb:'legR',zone:'body',finish:true}),
    flarerush:move('Flare rush','flareRush',11,11,.25,.56,1.9,'flaredash',22,'Fire',{mobilityElement:true,dash:true}),
    waterbolt:move('Water dart','waterCast',11,5,.16,.40,10,'waterbolt',11,'Water'),
    tidelash:move('Tidal lash','tideLash',9,8,.24,.55,5.8,'lash',18,'Water'),
    waterspout:move('Waterspout cradle','waterSpout',13,10,.32,.69,5.6,'spout',26,'Water',{launch:true,bubble:true}),
    riptide:move('Riptide sweep','riptideSweep',15,10,.26,.59,3.8,'riptide',22,'Water',{slam:true}),
    hydrocannon:move('Hydro cannon','hydroCast',22,13,.43,.79,10,'hydro',28,'Water'),
    tidestep:move('Tide step','tideStep',7,9,.20,.48,1.8,'tidedash',17,'Water',{mobilityElement:true,dash:true}),
    cragupper:melee('Crag uppercut','leadupper',18,9,.19,.50,2.3,'earth',{launch:true,limb:'L',focus:16,airPose:'airlift'}),
    ridgebreaker:move('Ridge breaker','ridgeStomp',18,12,.30,.72,6.4,'ridge',25,'Earth',{launch:true,cancel:.48}),
    quarryhammer:melee('Quarry hammer','hammer',29,14,.30,.65,2.5,'earth',{limb:'R',slam:true,break:true,finish:true,focus:22,airPose:'airslam',groundPose:'groundhammer'}),
    cinderjab:melee('Cinder jab','jab',12,5,.12,.34,2.2,'fire',{limb:'L',focus:9,push:.02,cancel:.23,airPose:'airjab'}),
    dragonbreath:move('Dragon breath','dragonBreath',6,12,.23,1.02,5.6,'breath',30,'Fire',{cancel:.50}),
    phoenixdive:melee('Phoenix dive','heel',26,13,.28,.62,2.7,'fire',{limb:'legR',slam:true,finish:true,focus:21,airPose:'airslam',groundPose:'stomp'}),
    currentpalm:melee('Current palm','cross',13,6,.16,.40,2.3,'water',{limb:'R',focus:10,push:.01,airPose:'aircross'}),
    undertow:move('Undertow ring','undertowPull',8,10,.26,.63,3.9,'undertow',21,'Water'),
    watercurrent:move('Water current','hydroCast',12,12,.29,.70,5.8,'current',24,'Water'),
    earthplatform:move('Raise terrace','earthRaise',0,10,.35,.76,6,'platform',25,'Earth'),
    heatrelease:move('Heat release','fireBurst',26,14,.38,.79,3.1,'heat',26,'Fire',{finish:true,heatCost:35}),
    waterwheel:melee('Waterwheel kick','crescent',18,10,.24,.56,2.6,'water',{limb:'legR',launch:true,focus:18,airPose:'airknee',groundPose:'groundlaunch'})
  };
  const TOKENS={'1':'earthwall','2':'earthlift','3':'earthquake','4':'firebolt','5':'flameline','6':'fireburst','7':'waterbolt','8':'tidelash','9':'waterspout',e1:'stonefist',e2:'boulder',e3:'stonevault',f1:'flameupper',f2:'cometkick',f3:'flarerush',w1:'riptide',w2:'hydrocannon',w3:'tidestep',a:'cragupper',b:'ridgebreaker',c:'quarryhammer',d:'cinderjab',e:'dragonbreath',f:'phoenixdive',g:'currentpalm',h:'undertow',i:'waterwheel',k:'watercurrent',l:'earthplatform',m:'heatrelease'};
  class Elements{
    constructor(world){this.world=world;this.bolts=[];this.zones=[];this.effects=[];this.waves=[];this.channels=[];this.serial=0;}
    open(a,b,height=.55,ignore=null){return !this.world.yard.solids.some(c=>c.prop!==ignore&&A.segmentBox([a.x,a.y+height,a.z],[b.x,b.y+height,b.z],c,.025)!==null);}
    prepare(f,a,target){const w=this.world,dx=Math.sin(f.angle),dz=Math.cos(f.angle),d=Math.min(a.move.range,L(f,target));a.elementAim={x:f.x,y:f.y,z:f.z,dx,dz,cx:f.x+dx*d,cz:f.z+dz*d,target:[target.x,target.y+(target.down>.08?.4:1.35),target.z]};
      if(a.powerAim){const point=a.powerAim,d=Math.hypot(point[0]-f.x,point[2]-f.z)||1,scale=Math.min(1,a.move.range/d);a.elementAim.cx=f.x+(point[0]-f.x)*scale;a.elementAim.cz=f.z+(point[2]-f.z)*scale;a.elementAim.dx=(point[0]-f.x)/d;a.elementAim.dz=(point[2]-f.z)/d;const near=w.targetsFor(f).find(t=>Math.hypot(t.x-point[0],t.z-point[2])<.7);a.elementAim.target=[a.elementAim.cx,near?near.y+1.2:.35,a.elementAim.cz];}
      if(['lift','spout'].includes(a.move.element)){this.effects.push({kind:a.move.element==='spout'?'watertell':'tell',x:a.elementAim.cx,y:.025,z:a.elementAim.cz,life:a.move.startup,max:a.move.startup,radius:.78,by:f.id});}
      if(a.move.dash){const n=Math.hypot(w.input.x,w.input.z),dir=f.id==='player'&&n>.1?[w.input.x/n,w.input.z/n]:[dx,dz];a.dashAim={x:dir[0],z:dir[1],travel:0,max:a.move.element==='flaredash'?2.8:2.35,next:0};}
      if(a.move.element==='fusion')w.infusion.prepare(f,a);
    }
    effect(kind,x,y,z,radius=1,life=.45,extra={}){this.effects.push({kind,x,y,z,radius,life,max:life,seed:++this.serial,...extra});this.effects=this.effects.slice(-48);}
    addZone(zone){this.zones.push({at:this.world.time,kind:'fire',...zone});this.zones=this.zones.slice(-24);}
    quench(x,z,radius){this.world.elementPhysics?.quench(x,z,radius);for(const p of this.zones)if(['fire','lava'].includes(p.kind)&&Math.hypot(x-p.x,z-p.z)<radius+p.radius&&this.open({x,y:0,z},p,.32)){p.life=Math.min(p.life,.08);this.effect('steam',p.x,.35,p.z,.65,.4);}}
    wall(f,a){const w=this.world,v=a.elementAim,side=Math.abs(v.dx)>Math.abs(v.dz),angle=side?Math.PI/2:0,x=C(v.x+(side?Math.sign(v.dx)*1.65:0),-5.05,5.05),z=C(v.z+(side?0:Math.sign(v.dz)*1.65),-4.65,4.65),p=w.yard.make('earthwall',x,z,angle,{life:12,raisedAt:w.time,owner:f.id});
      const b=w.yard.bounds(p),overlap=c=>Math.abs(b.x-c.x)<b.hx+c.hx+.06&&Math.abs(b.z-c.z)<b.hz+c.hz+.06;
      if((x-v.x)*v.dx+(z-v.z)*v.dz<.85||w.yard.solids.some(overlap)||w.fighters().some(t=>!t.ko&&Math.abs(t.x-b.x)<b.hx+.48&&Math.abs(t.z-b.z)<b.hz+.48)){w.emit('elementNotice',{text:'Earth needs a clear patch of ground ahead.'});return 'miss';}
      const walls=w.yard.props.filter(p=>p.type==='earthwall'&&!p.broken&&p.owner===f.id);if(walls.length>=3)walls[0].broken=true;
      w.yard.props.push(p);w.yard.rebuild();this.effect('earth',x,.05,z,1.1,.55);w.emit('earthWall',{by:f.id,name:a.move.name});return 'world';
    }
    hit(f,t,a,kind,scale=1){const w=this.world;if(t.ko||t.held||t.dodge&&t.dodge.t<.24)return false;const guarded=t.guard&&!t.action,damage=Math.max(1,Math.round(a.move.damage*scale*(guarded?.4:1))),v=a.elementAim,dir=[t.x-v.x,0,t.z-v.z];
      if(!w.environmentHit(t,{source:f,damage,kind,dir,speed:kind==='earth'?3.8:2.5,connection:guarded||a.pulse?null:a,name:a.move.name}))return false;
      if(guarded){t.stamina=Math.max(0,t.stamina-12);return true;}
      w.infusion.credit(f,a,t);w.infusion.contact(f,t,a,kind==='plasma'?'lightning':kind);
      if(['lift','spout','ridge'].includes(a.move.element)){t.down=0;t.visual=null;t.recovery=null;t.y=Math.max(t.y,.06);t.vy=(a.move.element==='spout'?5.3:6.6)/Math.sqrt(t.mass||1);t.tumbling=true;t.airJuggles++;if(t.impact)t.impact.launch=true;if(a.move.bubble)t.aquaBubble={by:f.id,at:w.time,until:w.time+1.15,height:1.9};}
      if(['quake','burst','riptide','heat'].includes(a.move.element)){t.down=Math.max(t.down,.95);t.stunned=Math.max(t.stunned,.65);t.downAt=w.time;t.tumbling=true;if(t.y>.1)t.vy=-5;}
      else if(t.y>.2&&['fire','water','plasma'].includes(kind))t.vy=Math.max(t.vy,2.2);
      if(a.move.element==='hydro'||a.move.element==='boulder'){const d=Math.hypot(dir[0],dir[2])||1;t.vx+=dir[0]/d*(a.move.element==='hydro'?5.5:4)/(t.mass||1);t.vz+=dir[2]/d*(a.move.element==='hydro'?5.5:4)/(t.mass||1);}
      return true;
    }
    projectile(f,a,options={}){const w=this.world,kind=options.kind||(a.move.element==='waterbolt'||a.move.element==='hydro'?'water':a.move.element==='boulder'?'earth':'fire'),origin=Contact.muzzle(w,f,options.radius>.2?.32:.17),v=a.elementAim,target=a.powerAim||w.locked||f.id!=='player'?v.target:[origin[0]+v.dx*10,origin[1],origin[2]+v.dz*10],delta=target.map((n,i)=>n-origin[i]),d=Math.hypot(...delta)||1;
      this.bolts.push({pos:origin,previous:origin.slice(),velocity:delta.map(n=>n/d*(options.speed||16)),by:f.id,life:options.life||.8,kind,radius:options.radius||.09,pierce:options.pierce||1,hitIds:[],action:{...a,move:{...a.move}},seed:++this.serial});this.bolts=this.bolts.slice(-18);return 'projectile';
    }
    dash(f,a,dt){if(!a.dashAim||a.t>a.move.startup||a.hit||f.stunned>0||f.held)return;const w=this.world,d=a.dashAim,travel=Math.min(d.max-d.travel,dt*(a.move.element==='flaredash'?10:8));if(travel<=0)return;
      const from=[f.x,f.y+.52,f.z],to=[f.x+d.x*travel,from[1],f.z+d.z*travel];let fraction=1;for(const c of w.yard.solids){const t=A.segmentBox(from,to,c,.32);if(t!==null)fraction=Math.min(fraction,Math.max(0,t-.01));}f.x+=d.x*travel*fraction;f.z+=d.z*travel*fraction;d.travel+=travel;f.vx=f.vz=0;f.moving=7;f.walk+=dt*18;
      if(d.travel>=d.next){d.next=d.travel+.55;this.addZone({x:f.x,y:0,z:f.z,radius:.46,life:1.8,by:f.id,kind:a.move.element==='flaredash'?'fire':'water',hits:{},action:{...a,move:{...a.move,damage:a.move.element==='flaredash'?4:0}}});}
    }
    resolve(f,a){const w=this.world,m=a.move,v=a.elementAim;let mode=m.element;if(mode==='platform')return w.elementPhysics.platform(f,a);if(mode==='current')return w.elementPhysics.addFlow(f,a);if(mode==='heat'){if((f.heat||0)<m.heatCost)return 'miss';const heat=f.heat;f.heat=0;f.heatAt=w.time;a.move={...m,damage:m.damage+Math.round(heat*.14)};mode='burst';w.emit('heatRelease',{by:f.id,heat});}if(mode==='fusion')return w.infusion.resolve(f,a);if(mode==='wall')return this.wall(f,a);let hits=0;
      if(mode==='ridge'){this.waves.push({x:v.x,z:v.z,y:0,dx:v.dx,dz:v.dz,travel:0,range:m.range,by:f.id,hitIds:[],action:a,next:0});this.waves=this.waves.slice(-8);this.effect('quake',f.x,.04,f.z,.7,.35);w.emit('elementCast',{by:f.id,name:m.name,element:'earth'});return 'projectile';}
      if(mode==='breath'){const channel={by:f.id,action:a,life:.64,next:0,from:[f.x,f.y+1.45,f.z],dx:v.dx,dz:v.dz,reach:m.range,seed:++this.serial};this.channels.push(channel);this.channels=this.channels.slice(-3);this.breathe(channel);w.emit('elementCast',{by:f.id,name:m.name,element:'fire'});return a.connected?'hit':'world';}
      if(['bolt','waterbolt','boulder','hydro'].includes(mode)){const options=mode==='boulder'?{speed:11,radius:.25,life:1}:mode==='hydro'?{speed:23,radius:.18,life:.65}:mode==='waterbolt'?{speed:19,radius:.10,life:.7}:{};this.projectile(f,a,options);w.emit('elementCast',{by:f.id,name:m.name,element:m.elementFamily.toLowerCase()});return 'projectile';}
      if(mode==='vault'){
        if((f.id==='player'?!w.mobility.grounded():f.y>.03)||f.held||f.down>0)return 'miss';w.cover.release(f,'vault');f.y+=.04;f.vy=6.5;f.tumbling=false;if(f.mobility)Object.assign(f.mobility,{voluntary:true,airborne:true,airEvade:false,airWind:false,techAttempted:false,support:null,landUntil:0});this.effect('vault',f.x,.05,f.z,1.5,.6);w.emit('jump',{by:f.id});
      }
      if(mode==='trail'){
        const from=Contact.muzzle(w,f,.12),to=[from[0]+v.dx*m.range,from[1],from[2]+v.dz*m.range];let fraction=1;for(const c of w.yard.solids){const t=A.segmentBox(from,to,c,.12);if(t!==null)fraction=Math.min(fraction,Math.max(0,t-.025));}
        const reach=m.range*fraction;for(let d=.65;d<=reach;d+=.75){const x=from[0]+v.dx*d,z=from[2]+v.dz*d;if(Math.abs(x)<6&&Math.abs(z)<5.5)this.addZone({x,z,y:f.y,radius:.55,by:f.id,life:3.2,hits:{},action:{...a,move:{...m}}});}
        this.effect('ember',from[0],from[1],from[2],.5,.32);w.emit('elementCast',{by:f.id,name:m.name,element:'fire'});return reach>.6?'world':'miss';
      }
      const captured=['lift','spout'].includes(mode),cone=['lash','riptide','flaredash','tidedash'].includes(mode),origin={x:cone?f.x:v.x,y:cone?f.y:v.y,z:cone?f.z:v.z},center=captured?{x:v.cx,y:0,z:v.cz}:origin,radius=captured?(mode==='spout'?.94:.78):m.range,kind=m.elementFamily.toLowerCase(),height=mode==='burst'?1.1:mode==='lash'?1:.35;
      const pathOpen=!captured||this.open({x:v.x,y:0,z:v.z},center);
      this.effect(({lift:'spikes',quake:'quake',burst:'burst',spout:'spout',lash:'lash',riptide:'riptide',tidedash:'riptide',flaredash:'burst',vault:'vault',undertow:'undertow'})[mode]||'splash',center.x,center.y,center.z,radius,.55,{dx:v.dx,dz:v.dz,from:[origin.x,origin.y+1.35,origin.z],to:[v.cx,Math.max(.6,w.targetFor(f).y+1),v.cz]});
      for(const t of w.targetsFor(f)){const dx=t.x-origin.x,dz=t.z-origin.z,along=dx*v.dx+dz*v.dz,side=Math.abs(dx*v.dz-dz*v.dx);if(!pathOpen||L(center,t)>radius||Math.abs(t.y-center.y)>(mode==='lift'?1.7:mode==='quake'||mode==='riptide'?1.2:3.3)||!this.open(center,t,height)||cone&&(along<-.2||side>.6+Math.max(0,along)*.18))continue;
        if(this.hit(f,t,a,kind)){hits++;if(['lash','undertow'].includes(mode)&&!t.guard&&!t.held){const d=L(f,t)||1,speed=mode==='undertow'?6.8:5.4;t.vx=(f.x-t.x)/d*speed/Math.sqrt(t.mass||1);t.vz=(f.z-t.z)/d*speed/Math.sqrt(t.mass||1);t.stunned=Math.max(t.stunned,.5);if(t.y>.2)t.vy=Math.max(t.vy,3.5);}}
      }
      for(const p of w.yard.props){if(p.broken||p.heldBy||p.type==='debris'||L(center,p)>radius||!pathOpen||!this.open(center,{x:p.x,y:0,z:p.z},height,p))continue;w.yard.damage(p,m.damage*.8,f,{x:(p.x-center.x)*(['lash','undertow'].includes(mode)?-2:1.5),y:mode==='lift'||mode==='spout'?4:1.5,z:(p.z-center.z)*(['lash','undertow'].includes(mode)?-2:1.5)});}
      if(kind==='water'){this.quench(center.x,center.z,radius);if(mode==='riptide')for(let d=.8;d<m.range;d+=.85){const z={x:origin.x+v.dx*d,y:0,z:origin.z+v.dz*d};if(this.open(origin,z,.35))this.addZone({...z,kind:'water',radius:.56,life:2.1,by:f.id,hits:{},action:{...a,move:{...m,damage:0}}});}}
      w.emit('elementCast',{by:f.id,name:m.name,element:kind,hits});return hits?'hit':mode==='vault'||mode==='tidedash'?'world':'miss';
    }
    danger(f){return this.zones.find(z=>z.by!==f.id&&['fire','lava','chargedwater'].includes(z.kind)&&Math.hypot(f.x-z.x,f.z-z.z)<z.radius+1.05&&Math.abs(f.y-z.y)<1.8);}
    breathe(c){const w=this.world,f=w.getFighter(c.by);if(!f)return;const m=c.action.move,from=Contact.muzzle(w,f,.16),to=[from[0]+c.dx*m.range,from[1],from[2]+c.dz*m.range];c.from=from;let fraction=1;
      let obstruction=null;for(const solid of w.yard.solids){const t=A.segmentBox(from,to,solid,.12);if(t!==null&&t<=fraction){fraction=Math.max(0,t-.01);obstruction=solid.prop;}}c.reach=m.range*fraction;if(obstruction)w.elementPhysics.ignite(obstruction,f);
      for(const target of w.targetsFor(f)){const dx=target.x-from[0],dz=target.z-from[2],along=dx*c.dx+dz*c.dz,side=Math.abs(dx*c.dz-dz*c.dx);if(along<-.18||along>c.reach+.15||side>.30+Math.max(0,along)*.14||Math.abs(target.y+1.1-from[1])>1.1||!this.open({x:from[0],y:from[1]-.8,z:from[2]},target,.8))continue;this.hit(f,target,c.pulses?{...c.action,pulse:true}:c.action,'fire');}c.pulses=(c.pulses||0)+1;
      c.next=w.time+.19;
    }
    step(dt){const w=this.world;for(const p of this.effects)p.life-=dt;this.effects=this.effects.filter(p=>p.life>0);
      for(const c of this.channels){const f=w.getFighter(c.by);c.life-=dt;if(!f||f.action!==c.action||f.stunned>0||f.held||c.life<=0){c.life=0;continue;}if(w.time>=c.next)this.breathe(c);else c.from=Contact.muzzle(w,f,.16);}this.channels=this.channels.filter(c=>c.life>0);
      for(const wave of this.waves){const f=w.getFighter(wave.by);if(!f){wave.travel=wave.range;continue;}const distance=Math.min(8*dt,wave.range-wave.travel),from=[wave.x,.18,wave.z],to=[wave.x+wave.dx*distance,.18,wave.z+wave.dz*distance];let stop=false;for(const solid of w.yard.solids){const t=A.segmentBox(from,to,solid,.18);if(t!==null){if(solid.prop)w.yard.damage(solid.prop,24,f,{x:wave.dx*2,y:3,z:wave.dz*2});stop=true;break;}}if(stop){wave.travel=wave.range;this.effect('earth',wave.x,.1,wave.z,.8,.55);continue;}wave.x=to[0];wave.z=to[2];wave.travel+=distance;
        if(wave.travel>=wave.next){wave.next=wave.travel+.5;this.effect('ridge',wave.x,.02,wave.z,.54,.68,{dx:wave.dx,dz:wave.dz});w.elementPhysics.ridge(wave);}
        for(const t of w.targetsFor(f)){if(wave.hitIds.includes(t.id)||t.y>1.15||Math.hypot(t.x-wave.x,t.z-wave.z)>.94||!this.open(wave,t,.32))continue;if(this.hit(f,t,wave.action,'earth'))wave.hitIds.push(t.id);}
      }this.waves=this.waves.filter(v=>v.travel<v.range);
      for(const b of this.bolts){b.life-=dt;if(b.life<=0)continue;const from=b.pos,to=from.map((v,i)=>v+b.velocity[i]*dt),source=w.getFighter(b.by);if(!source){b.life=0;continue;}b.previous=from.slice();let first=null;
        const consider=(t,data)=>{if(t!==null&&(!first||t<first.t))first={t,...data};};for(const c of w.yard.solids)consider(A.segmentBox(from,to,c,b.radius),{c});for(const f of w.targetsFor(source)){if(f.ko||f.held||b.hitIds.includes(f.id)||f.dodge&&f.dodge.t<.24)continue;consider(Contact.projectile(w,f,from,to,b.radius),{f});}
        if(first){const p=from.map((v,i)=>v+(to[i]-v)*first.t);if(first.f){this.hit(source,first.f,b.action,b.kind);b.hitIds.push(first.f.id);if(b.kind==='plasma')w.infusion.contact(source,first.f,b.action,'fire');}
          else if(first.c.prop){w.yard.damage(first.c.prop,b.kind==='earth'?35:b.kind==='plasma'?32:14,source,{x:b.velocity[0]*.1,y:.7,z:b.velocity[2]*.1});if(['fire','plasma'].includes(b.kind))w.elementPhysics.ignite(first.c.prop,source);}
          this.effect(b.kind==='water'?'splash':b.kind==='earth'?'spikes':b.kind==='plasma'?'plasma':'ember',...p,.45,.32);w.emit(b.kind==='fire'?'fireImpact':'elementImpact',{by:b.by,target:first.f?.id,cover:!first.f,element:b.kind});
          if(b.kind==='water'){this.quench(p[0],p[2],.9);this.addZone({x:p[0],y:0,z:p[2],radius:.58,life:2.3,kind:'water',by:source.id,hits:{},action:{...b.action,move:{...b.action.move,damage:0}}});}
          if(first.f&&b.hitIds.length<b.pierce){b.pos=to;b.action={...b.action,move:{...b.action.move,damage:Math.max(1,Math.round(b.action.move.damage*.7))}};}else b.life=0;
        }else b.pos=to;
      }this.bolts=this.bolts.filter(b=>b.life>0);
      for(const z of this.zones){z.life-=dt;const source=w.getFighter(z.by);if(!source||z.life<=0)continue;if(['fire','lava'].includes(z.kind))for(const p of w.yard.props)if(!p.broken&&Math.hypot(p.x-z.x,p.z-z.z)<z.radius+.2&&this.open(z,{x:p.x,y:0,z:p.z},.4,p))w.elementPhysics.ignite(p,source,2);for(const f of w.targetsFor(source)){if(f.held||f.ko||L(z,f)>z.radius+.22||Math.abs(f.y-z.y)>.9||w.time-(z.hits[f.id]??-10)<.85||!this.open(z,f,.32))continue;z.hits[f.id]=w.time;
          if(z.kind==='water'||z.kind==='mud'){w.infusion.mark(f,z.kind==='water'?'wet':'mud',source,z.kind==='water'?3:1.1);if(z.kind==='water')delete f.elementStatus.burn;continue;}
          f.elementHazards??={};const hazardKey=source.id+':'+z.kind;if(w.time<(f.elementHazards[hazardKey]||0))continue;f.elementHazards[hazardKey]=w.time+.8;
          this.hit(source,f,z.action,z.kind==='chargedwater'?'lightning':'fire',.5);if(z.kind==='chargedwater')w.infusion.mark(f,'wet',source,2);this.effect(z.kind==='chargedwater'?'splash':'ember',f.x,f.y+.6,f.z,.28,.25);
        }}this.zones=this.zones.filter(z=>z.life>0);
    }
    stage(){const w=this.world;w.mode='group';w.groupCount=3;w.groupBehavior='passive';w.infinite=true;w.arenaId='street';w.reset();w.player.x=0;w.player.z=2;w.player.angle=Math.PI;w.enemies.forEach((f,i)=>{f.x=(i-1)*1.05;f.z=-1.0;f.health=f.maxHealth=1000;w.face(f,w.player);});w.enemy=w.enemies[1];w.opponent=w.controllers[w.enemy.id];w.emit('elementSetup');}
  }
  root.CombatElements={Elements,MOVES,TOKENS};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatElements;
})(typeof window!=='undefined'?window:globalThis);
