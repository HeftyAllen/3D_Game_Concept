/* Coatings amplify confirmed contacts. Two deliberate elements prime one timed release. */
(function(root){
  'use strict';
  const C=(v,a,b)=>Math.max(a,Math.min(b,v)),D=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const COATS={
    fire:{name:'Flame mantle',mult:1.25,flat:2,focus:18,color:[1,.37,.08],note:'+25% melee + 2 · ignites contacts'},
    lightning:{name:'Live wire',mult:1.18,flat:2,focus:18,color:[.52,.80,1],note:'+18% melee + 2 · conducts through wet targets'},
    earth:{name:'Stone skin',mult:1.22,flat:3,focus:20,color:[.73,.56,.34],note:'+22% melee + 3 · heavier throws · 20% damage resistance'},
    water:{name:'Water veil',mult:1.12,flat:1,focus:16,color:[.30,.83,.98],note:'+12% melee + 1 · wets contacts · 12% damage resistance'}
  };
  const recipe=(id,name,a,b,focus,damage,range,pose,note)=>({id,name,pair:[a,b],focus,damage,range,pose,note});
  const RECIPES=[
    recipe('lava','Lava surge','earth','fire',34,20,5.8,'lavaRelease','A rising fault leaves molten ground. Launch, then chase the juggle.'),
    recipe('steam','Steam cannon','fire','water',28,20,5.2,'steamRelease','A pressure cone blows enemies upward and interrupts their aim.'),
    recipe('thundertide','Thunder Tide','lightning','water',32,18,5.6,'tideRelease','A charged wave lifts wet targets and leaves an electric pool.'),
    recipe('mud','Mudslide','earth','water',28,17,4.8,'mudRelease','A ground wave trips and slows. Close in for a clinch.'),
    recipe('plasma','Plasma lance','fire','lightning',36,29,11,'plasmaRelease','A piercing lance can pass through three bodies, losing damage each time.'),
    recipe('magnet','Magnet quake','earth','lightning',34,15,3.6,'magnetRelease','Pull bodies and metal inward, then launch the gathered group.'),
    recipe('firestorm','Firestorm','fire','wind',34,10,5.4,'stormRelease','A hot vortex gathers enemies and loose props into a burning juggle.'),
    recipe('typhoon','Typhoon cradle','water','wind',32,13,5.4,'typhoonRelease','A water vortex suspends enemies briefly. Punch, kick or reel them out.')
  ];
  const MOVES={fusionRelease:{name:'Elemental release',pose:'steamRelease',damage:20,cost:12,startup:.36,duration:.75,cancel:.51,range:5.8,element:'fusion',elementFamily:'Fusion',focus:32,lunge:0,push:0,stun:.3,finish:true}};
  class Infusion{
    constructor(world){this.world=world;this.serial=0;this.credited=new Set();this.fields=[];this.traces=[];for(const f of world.fighters()){f.coating=null;f.elementStatus={};f.elementPrimer=null;f.elementFusion=null;f.aquaBubble=null;f.coatAt=-10;}}
    status(f,key,by=null){const s=f.elementStatus?.[key];return s&&s.until>this.world.time&&(!by||s.by===by.id)?s:null;}
    mark(f,key,source,seconds=4,extra={}){f.elementStatus??={};return f.elementStatus[key]={by:source.id,until:this.world.time+seconds,...extra};}
    active(f){return f.coating&&f.coating.until>this.world.time?f.coating:null;}
    ready(f=this.world.player){const r=f.elementFusion;return r&&r.until>this.world.time?r:null;}
    blocked(f){const w=this.world;return w.over||w.run?.blocked()||f.ko||f.held||f.down>0||f.stunned>0||f.dodge||f.action&&(!f.action.connected||f.action.t<f.action.move.cancel);}
    coat(element,f=this.world.player){const w=this.world;if(element==='off'){f.coating=null;w.emit('coating',{by:f.id,element:null,name:'Coating released'});return true;}const data=COATS[element];if(!data||this.blocked(f)||w.time-f.coatAt<.22)return false;
      if(this.active(f)?.element===element){f.coating=null;w.emit('coating',{by:f.id,element:null,name:'Coating released'});return true;}
      const free=f.id==='player'&&w.freePlayer();if(!free&&(f.windEnergy<data.focus||f.stamina<5)){w.emit(f.windEnergy<data.focus?'windEmpty':'tired');return false;}
      if(!free){f.windEnergy-=data.focus;f.stamina-=5;}f.coatAt=w.time;f.coating={element,at:w.time,until:w.time+10};f.guard=false;f.regenAt=w.time+.5;this.feed(f,element);w.elements.effect('coat',f.x,f.y+1,f.z,.75,.4,{element});w.emit('coating',{by:f.id,element,name:data.name,seconds:10});return true;
    }
    feed(f,element){if(!['fire','earth','water','lightning','wind'].includes(element))return;const w=this.world,last=f.elementPrimer;
      if(last&&last.until>w.time&&last.element!==element){const data=RECIPES.find(r=>r.pair.includes(last.element)&&r.pair.includes(element));if(data){f.elementFusion={...data,serial:++this.serial,until:w.time+8};w.emit('fusionReady',{by:f.id,name:data.name,recipe:data.id,seconds:8});}}
      f.elementPrimer={element,until:w.time+6};
    }
    cast(f,a,result){const m=a.move;if(m.element==='fusion'||m.elementTag||m.element==='wall'&&result==='miss')return;const element=m.elementFamily?.toLowerCase()||(m.wind?'wind':m.lightning?'lightning':null);if(element)this.feed(f,element);}
    move(f){const r=this.ready(f);if(!r){if(f.id==='player')this.world.emit('elementNotice',{text:'Coat or cast two different elements, then release their fusion with 0.'});return null;}return {...MOVES.fusionRelease,name:r.name,pose:r.pose,damage:r.damage,range:r.range,focus:r.focus,fusionId:r.id,fusionSerial:r.serial};}
    amplify(f,target,a,damage){const coat=this.active(f);if(!coat||damage<=0)return damage;const free=f.id==='player'&&this.world.freePlayer(),cost=a.move?.throwType||a.move?.finish?4:2;
      if(!free&&f.windEnergy<cost){f.coating=null;this.world.emit('coating',{by:f.id,element:null,name:'Coating exhausted'});return damage;}if(!free)f.windEnergy-=cost;
      const data=COATS[coat.element];a.imbued=coat.element;const heavy=coat.element==='earth'&&(a.move.throwType||a.move.damage>=20)?3:0;return Math.round(damage*data.mult)+data.flat+heavy;
    }
    defend(target,damage){const coat=this.active(target);const factor=coat?.element==='earth'?.8:coat?.element==='water'?.88:1;return factor===1?damage:Math.max(damage>0?1:0,Math.round(damage*factor));}
    trace(from,to,color='lightning'){this.traces.push({from:from.slice(),to:to.slice(),color,life:.24,max:.24,seed:++this.serial});this.traces=this.traces.slice(-24);}
    pop(source,target,name,damage,radius,kind){const w=this.world;let count=0;for(const t of w.targetsFor(source)){if(t.ko||t.held||D(t,target)>radius||!w.elements.open(target,t,.85)||t.dodge&&t.dodge.t<.24)continue;if(w.environmentHit(t,{source,damage,kind,name,dir:[t.x-source.x,0,t.z-source.z],speed:2.3,preserve:true})){count++;if(!t.guard){t.vy=Math.max(t.vy,3.2/Math.sqrt(t.mass||1));t.y=Math.max(t.y,.035);t.down=0;t.tumbling=true;}}}if(count)w.emit('powerLink',{name,by:source.id,target:target.id});}
    contact(source,target,a,element=null){const w=this.world;if(!source||target.ko||target.health<=0)return;const m=a?.move||{},type=element||m.elementTag||(m.controlledThrow?m.throwElement:null)||a?.imbued;if(!type)return;target.aquaBubble=null;
      const wet=this.status(target,'wet'),heat=this.status(target,'burn');if(m.elementTag)this.feed(source,m.elementTag);if(m.controlledThrow)this.feed(source,m.throwElement);w.elementPhysics?.contact(source,target,a,type);
      if(type==='water'){
        delete target.elementStatus.burn;this.mark(target,'wet',source,5);if(heat&&w.time-(target.steamAt??-10)>1.25){target.steamAt=w.time;this.pop(source,target,'Steam pop',5,1.35,'steam');w.elements.effect('steam',target.x,target.y+.7,target.z,1.25,.55);}
        w.elements.quench(target.x,target.z,1.0);if(m.throwType){w.elements.addZone({x:target.x,y:0,z:target.z,radius:.85,life:2.2,by:source.id,kind:'water',action:{move:{damage:0,name:'Tide landing'},elementAim:{x:source.x,z:source.z}},hits:{}});}
      }else if(type==='fire'){
        if(wet&&w.time-(target.steamAt??-10)>1.25){delete target.elementStatus.wet;target.steamAt=w.time;this.pop(source,target,'Steam pop',5,1.35,'steam');w.elements.effect('steam',target.x,target.y+.8,target.z,1.3,.55);}
        else this.mark(target,'burn',source,2.1,{ticks:2,next:w.time+.8});
        if(m.throwType)w.elements.addZone({x:target.x,y:0,z:target.z,radius:.85,life:2,by:source.id,kind:'fire',hits:{},action:{move:{damage:5,name:'Cinder slam',elementFamily:'Fire'},elementAim:{x:source.x,z:source.z}}});
      }else if(type==='lightning'){
        this.mark(target,'charged',source,4);if(wet&&w.time-(target.conductAt??-10)>1.1){target.conductAt=w.time;delete target.elementStatus.wet;this.pop(source,target,'Conductive splash',6,1.9,'lightning');let previous=target;
          const next=w.targetsFor(source).filter(t=>t!==target&&!t.ko&&!t.held&&D(t,target)<2.3&&w.elements.open(target,t,1)).sort((a,b)=>D(a,target)-D(b,target)).slice(0,2);
          for(const [i,t]of next.entries()){w.environmentHit(t,{source,damage:i?4:7,kind:'lightning',name:'Conductive arc',dir:[t.x-target.x,0,t.z-target.z],speed:1.4,preserve:true});this.trace([previous.x,previous.y+1,previous.z],[t.x,t.y+1,t.z]);previous=t;}
        }
      }else if(type==='earth'){
        if(wet){this.mark(target,'mud',source,2.8);delete target.elementStatus.wet;w.emit('powerLink',{name:'Mud bind',by:source.id,target:target.id});}
        if(a?.imbued==='earth'&&!w.flow.broken(target))target.balance=C((target.balance||0)+7,0,99);
      }
      if(!element&&m.elementTag&&a?.imbued&&m.elementTag!==a.imbued)this.contact(source,target,{...a,imbued:null,move:{...m,elementTag:null}},a.imbued);
      if(a?.imbued)w.emit('coatingHit',{by:source.id,target:target.id,element:a.imbued,move:m.name});
    }
    credit(f,a,target){if(a.move.element!=='fusion'||this.credited.has(a.move.fusionSerial))return;this.credited.add(a.move.fusionSerial);if(this.credited.size>64)this.credited.delete(this.credited.values().next().value);this.world.emit('powerLink',{name:a.move.name,by:f.id,target:target.id});}
    prepare(f,a){a.fusionData=this.ready(f)?{...this.ready(f)}:null;}
    resolve(f,a){const w=this.world,r=a.fusionData;if(!r||f.elementFusion?.serial!==r.serial)return 'miss';f.elementFusion=null;f.elementPrimer=null;const v=a.elementAim,m=a.move,origin={x:v.x,y:v.y,z:v.z};let hits=0;
      if(r.id==='plasma'){w.elements.projectile(f,a,{kind:'plasma',speed:24,radius:.14,life:.65,pierce:3});}
      else if(['magnet','firestorm','typhoon'].includes(r.id)){
        const cx=r.id==='magnet'?f.x:v.x+v.dx*Math.min(3.2,D(f,w.targetFor(f))),cz=r.id==='magnet'?f.z:v.z+v.dz*Math.min(3.2,D(f,w.targetFor(f))),center={x:cx,y:0,z:cz};
        if(!w.elements.open(origin,center,.65))return 'miss';this.fields.push({serial:++this.serial,props:{},x:cx,y:0,z:cz,by:f.id,kind:r.id,radius:r.id==='magnet'?3.6:1.8,life:r.id==='magnet'?.75:1.65,max:r.id==='magnet'?.75:1.65,hits:{},action:a});this.fields=this.fields.slice(-3);
      }else{
        const reach=r.range,kind=r.id==='lava'?'fire':r.id==='steam'?'water':r.id==='thundertide'?'lightning':'water';
        for(const t of w.targetsFor(f)){const dx=t.x-v.x,dz=t.z-v.z,along=dx*v.dx+dz*v.dz,side=Math.abs(dx*v.dz-dz*v.dx),ground=r.id==='lava'||r.id==='mud';if(t.ko||t.held||along<-.2||along>reach||side>.65+along*.23||Math.abs(t.y-v.y)>(ground?1.8:3.3)||!w.elements.open(origin,t,ground?.35:1.1))continue;
          if(w.elements.hit(f,t,a,kind)){hits++;if(!t.guard){if(r.id==='mud'){this.mark(t,'mud',f,3.2);t.down=.85;t.downAt=w.time;t.stunned=.35;t.tumbling=true;}else{t.down=0;t.y=Math.max(.05,t.y);t.vy=(r.id==='steam'?5.8:5.0)/Math.sqrt(t.mass||1);t.tumbling=true;if(r.id==='steam')t.aimLostUntil=w.time+1.2;}}}
        }
        for(const p of w.yard.props){const dx=p.x-v.x,dz=p.z-v.z,along=dx*v.dx+dz*v.dz;if(p.broken||p.heldBy||p.type==='debris'||along<.2||along>reach||Math.abs(dx*v.dz-dz*v.dx)>.7+along*.23||!w.elements.open(origin,{x:p.x,y:0,z:p.z},.45,p))continue;w.yard.damage(p,r.id==='lava'?34:r.id==='steam'?12:18,f,{x:v.dx*2,y:1,z:v.dz*2});}
        let distance=reach;const from=[v.x,.40,v.z],to=[v.x+v.dx*reach,.40,v.z+v.dz*reach];for(const c of w.yard.solids){const t=root.CombatContact.segmentBox(from,to,c,.08);if(t!==null)distance=Math.min(distance,Math.max(0,t*reach-.14));}
        if(r.id==='lava')for(let d=.75;d<=distance;d+=.78)w.elements.addZone({x:v.x+v.dx*d,y:0,z:v.z+v.dz*d,radius:.64,life:4.2,by:f.id,kind:'lava',hits:{},action:{...a,move:{...m,damage:9}}});
        if(r.id==='thundertide')for(let d=1;d<=distance;d+=1.05)w.elements.addZone({x:v.x+v.dx*d,y:0,z:v.z+v.dz*d,radius:.68,life:3.2,by:f.id,kind:'chargedwater',hits:{},action:{...a,move:{...m,damage:6}}});
        if(r.id==='mud')for(let d=.7;d<=distance;d+=.85)w.elements.addZone({x:v.x+v.dx*d,y:0,z:v.z+v.dz*d,radius:.65,life:3,by:f.id,kind:'mud',hits:{},action:{...a,move:{...m,damage:0}}});
        w.elements.effect(r.id,v.x+v.dx*distance*.5,.18,v.z+v.dz*distance*.5,Math.max(.5,distance*.6),.7);
      }
      w.emit('fusionRelease',{by:f.id,name:r.name,recipe:r.id,hits});return r.id==='plasma'?'projectile':hits?'hit':'world';
    }
    onEvent(e){const w=this.world;if(['connect','envHit','hurt'].includes(e.type)&&e.damage>0){const f=w.getFighter(e.target);if(f?.aquaBubble&&w.time-f.aquaBubble.at>.04)f.aquaBubble=null;}
      if(e.type==='dodge'&&this.active(w.player)?.element==='water'){const f=w.player;w.elements.addZone({x:f.x,y:0,z:f.z,radius:.7,life:1.8,by:f.id,kind:'water',hits:{},action:{move:{damage:0,name:'Tide wake'},elementAim:{x:f.x,z:f.z}}});}
    }
    step(dt){const w=this.world;for(const f of w.fighters()){
        if(f.coating&&(!this.active(f)||f.ko))f.coating=null;if(f.elementPrimer?.until<=w.time)f.elementPrimer=null;
        if(f.elementFusion?.until<=w.time&&f.action?.move.fusionSerial!==f.elementFusion.serial)f.elementFusion=null;
        for(const [key,s]of Object.entries(f.elementStatus||{})){if(s.until<=w.time||f.ko){delete f.elementStatus[key];continue;}if(key==='burn'&&s.ticks>0&&w.time>=s.next&&!f.held){s.next=w.time+.8;s.ticks--;const by=w.getFighter(s.by);if(by)w.environmentHit(f,{source:by,damage:2,kind:'burn',name:'Mantle burn',dir:[f.x-by.x,0,f.z-by.z],speed:0,preserve:true});}}
        if(f.aquaBubble){const b=f.aquaBubble;if(w.time>=b.until||f.ko||f.held||w.grapple?.owner===f||w.tether?.owner===f){f.aquaBubble=null;continue;}f.y=Math.max(.04,f.y);f.vy=C((b.height-f.y)*5,-2,4.5)+10.5*dt;f.down=0;f.tumbling=true;}
      }
      for(const field of this.fields){field.life-=dt;const f=w.getFighter(field.by);if(!f||field.life<=0)continue;
        for(const t of w.targetsFor(f)){const d=D(field,t);if(t.ko||t.held||t.dodge&&t.dodge.t<.24||d>field.radius||Math.abs(t.y-field.y)>3.5||!w.elements.open(field,t,.7))continue;const key=field.hits[t.id]??-10,pull=(field.kind==='magnet'?18:12)*dt/(t.mass||1);t.vx+=(field.x-t.x)/(d||1)*pull;t.vz+=(field.z-t.z)/(d||1)*pull;
          if(key===-10&&w.elements.hit(f,t,field.action,field.kind==='firestorm'?'fire':field.kind==='magnet'?'lightning':'water')){field.hits[t.id]=w.time;t.down=0;t.y=Math.max(.05,t.y);t.vy=4.7/Math.sqrt(t.mass||1);t.tumbling=true;if(field.kind==='typhoon')t.aquaBubble={by:f.id,at:w.time,until:w.time+1.2,height:2.0};}
          if(field.kind==='magnet'&&field.life<.15&&!field.hits[t.id+'-launch']){field.hits[t.id+'-launch']=true;t.down=0;t.y=Math.max(.05,t.y);t.vy=6/Math.sqrt(t.mass||1);t.tumbling=true;w.elements.effect('magnet',field.x,.1,field.z,field.radius,.4);}
        }
        for(const p of w.yard.props){if(!p.mass||p.heldBy||p.pulledBy||p.broken||p.anchored||p.type==='debris'||field.kind==='magnet'&&!['barrel','cart','blaster'].includes(p.type))continue;const d=D(field,p);if(d>field.radius||!w.elements.open(field,{x:p.x,y:0,z:p.z},.55,p))continue;p.sleep=false;p.settle=0;const k=(field.kind==='magnet'?70:26)*dt/Math.sqrt(p.mass);p.vx+=(field.x-p.x)/(d||1)*k;p.vz+=(field.z-p.z)/(d||1)*k;p.vy+=field.kind==='magnet'?3*dt:18*dt;if(p.fieldArm!==field.serial){p.fieldArm=field.serial;p.owner=f.id;p.thrownAt=w.time;}p.armedUntil=w.time+1.1;if(field.kind==='magnet'&&field.life<.15&&!field.props[p.id]){field.props[p.id]=true;const n=D(field,p)||1,speed=10*Math.sqrt(5/p.mass);p.vx=(p.x-field.x)/n*speed;p.vz=(p.z-field.z)/n*speed;p.vy=3.8*Math.sqrt(5/p.mass);}}
      }this.fields=this.fields.filter(f=>f.life>0);for(const t of this.traces)t.life-=dt;this.traces=this.traces.filter(t=>t.life>0);
    }
    snapshot(){const f=this.world.player,w=this.world,c=this.active(f),r=this.ready(f);return {coat:c?{element:c.element,name:COATS[c.element].name,seconds:Math.max(0,c.until-w.time),note:COATS[c.element].note}:null,primer:f.elementPrimer?{element:f.elementPrimer.element,seconds:Math.max(0,f.elementPrimer.until-w.time)}:null,fusion:r?{id:r.id,name:r.name,focus:r.focus,seconds:Math.max(0,r.until-w.time),note:r.note}:null,target:Object.keys(this.world.enemy.elementStatus||{}),fields:this.fields.length};}
    stageRecipe(id){const data=RECIPES.find(r=>r.id===id);if(!data)return false;this.stage('fusion');const w=this.world,I=w.infusion;if(data.pair[1]==='wind'){I.coat(data.pair[0]);I.feed(w.player,'wind');}else{I.feed(w.player,data.pair[0]);I.coat(data.pair[1]);}w.emit('infusionSetup',{kind:id});return true;}
    stage(kind='fusion'){const w=this.world;w.elements.stage();if(kind==='coating'){w.mode='practice';w.groupBehavior='passive';w.reset();w.player.x=0;w.player.z=.8;w.enemy.x=0;w.enemy.z=-.55;w.enemy.health=w.enemy.maxHealth=1500;w.face(w.player,w.enemy);}w.emit('infusionSetup',{kind});}
  }
  root.CombatInfusion={Infusion,COATS,RECIPES,MOVES};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatInfusion;
})(typeof window!=='undefined'?window:globalThis);
