/* Readable sparring decisions. Reactions observe visible wind-ups, then wait. */
(function(root){
  'use strict';
  const C=(v,a,b)=>Math.max(a,Math.min(b,v)),L=(x,z)=>Math.hypot(x,z);
  const STYLES={
    balanced:{name:'All-rounder',range:1.75,pace:2.15,guard:.40,plans:['PPK','KPK','HPH','UPKH','PST','GKPG']},
    boxer:{name:'Boxer',range:1.45,pace:2.45,guard:.58,plans:['PPPP','PHP','KPP','PPH','HPP','PPPPP']},
    kicker:{name:'Kickboxer',range:2.05,pace:2.35,guard:.33,plans:['KKK','PKH','KPK','PPK','HK','KHUKH']},
    wrestler:{name:'Wrestler',range:1.18,pace:2.25,guard:.26,plans:['GKG','GCH','GCCU','PGG','KGKPG','GCU']},
    elastic:{name:'Elastic rival',range:3.45,pace:2.10,guard:.30,plans:['STS','SSH','TRG','SRG','SUSTH','RGPK']},
    scavenger:{name:'Scavenger',range:1.95,pace:2.30,guard:.36,plans:['PPK','HPP','PKH','PSK','GKPG']},
    gunner:{name:'Pulse rival',range:4.4,pace:1.85,guard:.30,plans:['PP','PK','HPP']}
  };
  const LEVELS={
    beginner:{name:'Gentle',reaction:.58,recover:1.7,defense:.10,pace:.65,damage:.40,chain:2,windup:1.25,grabs:false,ground:false,gap:1.1},
    relaxed:{name:'Easy',reaction:.38,recover:1.25,defense:.23,pace:.78,damage:.62,chain:3,windup:1.12,grabs:true,ground:false,gap:.85},
    standard:{name:'Normal',reaction:.24,recover:.95,defense:.43,pace:.92,damage:.82,chain:4,windup:1,grabs:true,ground:true,gap:.60},
    relentless:{name:'Hard',reaction:.16,recover:.65,defense:.65,pace:1.05,damage:1,chain:6,windup:1,grabs:true,ground:true,gap:.40}
  };
  const VARIANTS={
    standard:{name:'Partner',mass:1,health:1,pace:1,bulk:1,style:null,color:[.96,.40,.31],shirt:[.63,.29,.235]},
    runner:{name:'Runner',mass:.78,health:.80,pace:1.12,bulk:.88,style:'kicker',color:[.42,.86,.89],shirt:[.24,.48,.50]},
    bruiser:{name:'Bruiser',mass:1.65,health:1.40,pace:.78,bulk:1.22,style:'boxer',color:[1,.67,.27],shirt:[.60,.40,.22]},
    grappler:{name:'Grappler',mass:1.15,health:1.10,pace:.94,bulk:1.08,style:'wrestler',color:[.77,.57,.96],shirt:[.43,.31,.55]},
    reach:{name:'Long-reach',mass:.95,health:.95,pace:1,bulk:.96,style:'elastic',color:[.49,.89,.61],shirt:[.26,.48,.33]}
  };
  class Opponent{
    constructor(world,moves,fighter=world.enemy){this.world=world;this.moves=moves;this.fighter=fighter;this.reset();}
    reset(){this.state={intent:'reading',next:this.world.time+.9,decideAt:0,side:1,turnAt:0,plan:[],stringHits:0,sequence:0,seen:null,seenAt:0,responded:false,dodgeAt:-10,object:null,guardUntil:0};this.stats={sidesteps:0,guards:0,pickups:0,throws:0,plans:0};}
    style(){return STYLES[this.fighter.style||this.world.opponentStyle]||STYLES.balanced;}
    level(){return LEVELS[this.world.difficulty]||LEVELS.standard;}
    intent(value){this.state.intent=value;this.fighter.intent=value;}
    move(dx,dz,speed,dt,target){
      const w=this.world,e=this.fighter,n=L(dx,dz);if(n<.01){e.moving=0;e.motion={x:0,z:0};return;}
      const direction=w.yard.steer(e,target,[dx/n,dz/n]);speed*=L(...direction)*(e.pace||1)*(w.infusion.status(e,'mud')?.58:1);
      e.x+=direction[0]*speed*dt;e.z+=direction[1]*speed*dt;e.moving=speed;e.walk+=speed*dt*3.5;
      const s=Math.sin(e.angle),c=Math.cos(e.angle);e.motion={x:direction[0]*c-direction[1]*s,z:direction[0]*s+direction[1]*c};
      w.face(e,target,1-Math.exp(-8*dt));
    }
    sidestep(p){
      const w=this.world,e=this.fighter,s=this.state;if(e.stamina<18||e.y>.08||w.time-s.dodgeAt<1.7||e.action||e.dodge)return false;
      const dx=p.x-e.x,dz=p.z-e.z,d=L(dx,dz)||1;
      let side=s.side,x=dz/d*side,z=-dx/d*side;
      const clear=(x,z)=>Math.abs(e.x+x*1.7)<5.6&&Math.abs(e.z+z*1.7)<5.05&&!w.yard.lineBlocked(e,{x:e.x+x*1.65,y:e.y,z:e.z+z*1.65},.65);
      if(!clear(x,z)){side*=-1;x=dz/d*side;z=-dx/d*side;if(!clear(x,z))return false;}
      s.side=side;s.dodgeAt=w.time;s.plan=[];s.next=w.time+.52;e.stamina-=14;e.regenAt=w.time+.8;e.guard=false;e.buffer=[];e.chain='';e.flow=0;e.counterUntil=w.time+.8;
      e.dodge={t:0,x,z,origin:{x:e.x,z:e.z}};this.stats.sidesteps++;this.intent('sidestepping');w.emit('opponentStep',{kind:'dodge'});return true;
    }
    observe(p,d){
      const w=this.world,e=this.fighter,s=this.state,level=this.level(),ball=p.balloon;
      const danger=ball?(ball.drop||w.time<ball.boostUntil&&ball.burstAt||null):p.action;
      if(danger!==s.seen){s.seen=danger;s.seenAt=w.time;s.responded=false;}
      const obvious=!ball&&(danger?.move.elastic||danger?.move.wind||danger?.move.lightning||danger?.move.element);
      if(!danger||s.responded||w.time-s.seenAt<level.reaction*(obvious?.65:1)+w.random()*.055||e.action||e.dodge)return;
      s.responded=true;
      const range=ball?ball.drop?3.2:4.1:p.action?.move.range+.4;
      if(d>range||w.yard.lineBlocked(p,e,1.1))return;
      const choice=w.random();
      if(ball||p.action?.move.grab||p.action?.move.break||p.action?.move.elastic||p.action?.move.wind||p.action?.move.lightning||p.action?.move.element){if(choice<Math.min(.88,level.defense+(p.action?.move.wind||p.action?.move.lightning?.25:0))&&this.sidestep(p))return;}
      if(!ball&&choice<this.style().guard*level.defense/.43&&e.stamina>18){s.guardUntil=w.time+.36;e.guard=true;e.guardAt=-9;this.stats.guards++;this.intent('guarding');}
    }
    equip(prop){
      const w=this.world,e=this.fighter,s=this.state,m=this.moves.propPickup;if(e.stamina<m.cost||!prop||prop.carry===false||prop.broken||prop.heldBy)return false;
      e.stamina-=m.cost;e.guard=false;e.regenAt=w.time+.7;e.action={id:'propPickup',move:m,t:0,hit:false,chain:'',token:'F',propId:prop.id,grabFrom:{x:e.x,z:e.z}};
      s.plan=[];s.object=null;s.next=w.time+.65;this.intent('picking up');w.emit('enemyAttack',{move:'Picking up '+prop.name.toLowerCase()});return true;
    }
    choosePlan(d){
      const w=this.world,e=this.fighter,s=this.state,held=w.yard.held(e);e.chain='';e.connections=[];e.flow=0;
      let plan;
      if(w.grapple?.owner===e&&w.grapple.phase==='clinch'){
        const grip=w.grapple.grip;plan=grip==='rear'?'PU':grip==='bodylock'?'KU':s.sequence%2?'KPG':'CCU';
      }else if(w.player.down>.08&&w.player.y<.12)plan=e.groundHits||!this.level().ground?'':'P';
      else if(held?.type==='blaster')plan=held.ammo<1?'J':d>2.4?'PP':s.sequence%2?'PK':'HP';
      else if(held)plan=d>2.8?'G':s.sequence%2?'PKG':'PHG';
      else if(w.player.balloon)plan=d<2.2?'HK':'SS';
      else {const plans=this.style().plans.filter(p=>this.level().grabs||!/[GR]/.test(p));plan=plans.length?plans[(Math.floor(w.random()*plans.length)+s.sequence)%plans.length]:'PP';}
      s.sequence++;s.plan=plan.split('').slice(0,this.level().chain);if(plan)this.stats.plans++;
    }
    update(dt){
      const w=this.world,e=this.fighter,p=w.player,s=this.state,style=this.style(),level=this.level(),training=!w.isLive();
      if(e.ko||w.over){e.moving=0;this.intent(e.ko?'recovering':'round over');return;}
      if(e.held||e.stunned>0||e.down>0){e.moving=0;s.plan=[];s.object=null;s.guardUntil=0;this.intent(e.held?'in the clinch':'recovering');return;}
      if(e.y>.15&&p.y<.15&&!e.action){this.intent('airborne');return;}
      const d=L(e.x-p.x,e.z-p.z);
      if(p.down<=0)e.groundHits=0;
      const pair=w.grapple||w.tether;
      if(w.isGroup()&&pair&&pair.owner!==e&&pair.target!==e&&!e.rescueFor&&!w.team.canRescue(e)){e.action=null;e.buffer=[];s.plan=[];e.moving=0;this.intent('giving space');return;}
      if(e.action){
        e.moving=0;this.intent(e.action.move.propPickup?'picking up':e.action.move.throwType?'throwing':'attacking');
        if(e.action.t>=e.action.move.cancel&&!e.buffer.length&&s.plan.length)e.buffer.push({token:s.plan.shift(),until:w.time+1.8});
        if(!s.plan.length)s.next=Math.max(s.next,w.time+level.recover*.65);
        return;
      }
      if(e.dodge){this.intent('sidestepping');return;}
      this.observe(p,d);if(e.dodge)return;
      if((e.aimLostUntil||0)>w.time){s.next=Math.max(s.next,w.time+.18);s.plan=[];}
      const fire=w.elements?.danger(e);if(fire&&!e.action){w.cover.release(e,'fire');s.plan=[];e.guard=false;this.intent('escaping flames');this.move(e.x-fire.x||s.side,e.z-fire.z||1,style.pace*level.pace*1.3,dt,p);return;}
      if(w.cover.ai(this,dt))return;
      if(w.team.control(this,dt))return;
      e.guard=s.guardUntil>w.time;if(e.guard){e.guardAt=-9;this.intent('guarding');}
      if(w.grapple?.owner===e){
        e.moving=0;if(w.grapple.phase!=='clinch')return;
        if(s.stringHits>=level.chain){w.releaseGrip('pause');s.plan=[];s.next=w.time+level.recover;this.intent('giving space');return;}
        if(!s.plan.length){this.choosePlan(d);s.plan=s.plan.slice(0,level.chain-s.stringHits);}
        if(s.plan.length){const token=s.plan.shift();w.start(e,p,token);}return;
      }
      if(p.down>.08&&p.y<.12&&(e.groundHits||!level.ground)){e.moving=0;s.plan=[];s.next=w.time+.3;this.intent('giving space');return;}
      if(e.stamina<24&&!s.object){
        this.intent('catching breath');s.plan=[];s.next=Math.max(s.next,w.time+.35);this.move(e.x-p.x,e.z-p.z,style.pace*.72,dt,p);return;
      }
      if(w.time>s.turnAt){s.side=s.sequence%2?-1:1;s.turnAt=w.time+1.7+w.random()*1.3;}
      if(!training&&!w.yard.held(e)&&!p.balloon&&d>1.5&&(['scavenger','gunner'].includes(e.style||w.opponentStyle)||s.object)){
        let prop=s.object&&w.yard.props.find(q=>q.id===s.object&&!q.broken&&!q.heldBy&&!q.pulledBy);
        if(!prop&&w.time>s.decideAt){s.decideAt=w.time+1.8;prop=w.yard.props.filter(q=>q.mass>0&&q.carry!==false&&!q.anchored&&q.type!=='debris'&&!q.broken&&!q.heldBy&&!q.pulledBy&&L(q.x-e.x,q.z-e.z)<4&&w.yard.clearPath(e,q)).sort((a,b)=>L(a.x-e.x,a.z-e.z)-L(b.x-e.x,b.z-e.z))[0];s.object=prop?.id||null;}
        if(prop){this.intent('seeking an object');if(L(prop.x-e.x,prop.z-e.z)<1.25){this.equip(prop);return;}this.move(prop.x-e.x,prop.z-e.z,style.pace,dt,prop);return;}
      }else s.object=null;
      const dx=(p.x-e.x)/(d||1),dz=(p.z-e.z)/(d||1),range=p.balloon?3.2:(e.style||w.opponentStyle)==='gunner'&&!w.yard.held(e)?1.75:style.range;
      if(d>range+.42){if(!e.guard)this.intent('closing in');this.move(dx+dz*s.side*.18,dz-dx*s.side*.18,style.pace*level.pace*(e.guard?.55:1),dt,p);}
      else if(d<range-.36&&p.down<=0){if(!e.guard)this.intent('making space');this.move(-dx+dz*s.side*.35,-dz-dx*s.side*.35,style.pace*.76,dt,p);}
      else {if(!e.guard)this.intent('circling');this.move(dz*s.side,-dx*s.side,style.pace*.48*(e.guard?.45:1),dt,p);}
      if(training)return;
      if(w.isGroup()&&(w.player.held||w.grapple||w.tether||w.player.down>.08)){this.intent('giving space');return;}
      const held=w.yard.held(e),attackRange=held?.type==='blaster'?9:held?4.7:(e.style||w.opponentStyle)==='elastic'?5:p.balloon?4.7:2.65;
      if(w.time>=s.next&&!e.guard&&d<attackRange&&!w.yard.lineBlocked(e,p,1.3)&&w.requestAttack(e)){
        s.stringHits=0;this.choosePlan(d);const token=s.plan.shift();if(token){e.moving=0;if(!w.start(e,p,token))s.plan=[];s.next=w.time+level.recover;}
      }
    }
    snapshot(){return {id:this.fighter.id,style:this.fighter.style||this.world.opponentStyle||'balanced',difficulty:this.world.difficulty||'standard',intent:this.state.intent,stats:{...this.stats}};}
  }
  const API={Opponent,STYLES,LEVELS,VARIANTS};root.CombatOpponent=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
