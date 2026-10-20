/* Shared balance, linked powers and contextual assistance. Contacts remain authoritative. */
(function(root){
  'use strict';
  const C=(v,a,b)=>Math.max(a,Math.min(b,v)),D=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const PROFILES={tap:{duration:.22,fold:.08,whip:.20,loose:.55},heavy:{duration:.42,fold:.23,whip:.30,loose:.86},body:{duration:.38,fold:.31,whip:.04,loose:.78},leg:{duration:.46,fold:.15,whip:.06,loose:.88},launch:{duration:.40,fold:.18,whip:.12,loose:.72},slam:{duration:.55,fold:.25,whip:.08,loose:.92},electric:{duration:.42,fold:.12,whip:.10,loose:.80},wind:{duration:.36,fold:.20,whip:.10,loose:.72}};
  function reaction(m){return m.profile|| (m.slam||m.throwType?'slam':m.launch?'launch':m.lightning||m.kind==='lightning'?'electric':m.wind||m.kind==='wind'?'wind':m.zone==='leg'||/lowkick|oblique|sweep/i.test(m.pose)?'leg':m.zone==='body'||/body|knee|roundhouse/i.test(m.pose)?'body':m.damage>=16||m.finish?'heavy':'tap');}
  class Flow{
    constructor(world){this.world=world;this.pulses=[];this.focus=null;}
    broken(f){return !f.ko&&(f.balanceBreakUntil||0)>this.world.time;}
    marked(f,key,by){const m=f.powerMarks?.[key];return !!m&&m.until>this.world.time&&(!by||m.by===by.id);}
    mark(f,key,by,seconds=3.5){f.powerMarks??={};f.powerMarks[key]={by:by.id,until:this.world.time+seconds};}
    pressure(target,source,m,{blocked=false,kind=null}={}){
      const w=this.world;if(!m.damage||target.ko||target.health<=0||target.balloon||this.broken(target)||w.time<(target.balanceImmuneUntil||0))return;
      const id=m.id||m.name||m.pose||kind||'impact',same=target.balanceLast===id;target.balanceRepeat=same?(target.balanceRepeat||0)+1:0;target.balanceLast=id;
      const profile=reaction({...m,kind}),base=m.damage*.60+(profile==='leg'?11:profile==='heavy'?10:m.throwType?12:kind&&['wall','table','barrier','prop','body','bumper'].includes(kind)?14:0);
      const amount=base/(Math.sqrt(target.mass||1)*(1+Math.min(5,target.balanceRepeat)*.22))*(blocked?.28:1);
      target.balance=C((target.balance||0)+amount,0,100);target.balanceAt=w.time;
      if(target.balance<100)return;
      target.balance=100;target.balanceBreakUntil=w.time+1.8;target.balanceImmuneUntil=w.time+4.8;target.guard=false;
      if(!target.held){target.action=null;target.buffer=[];target.stunned=Math.max(target.stunned,1.8);}
      w.emit('balanceBreak',{target:target.id,by:source?.id,seconds:1.8});
    }
    throwMove(f,target,m){
      if(!m.throwType)return m;const w=this.world,broken=this.broken(target),coil=this.marked(target,'coil',f),wind=m.throwType==='elastic'&&this.marked(target,'wind',f),extraFocus=coil?8:wind?8:0;
      const powered=(coil||wind)&&(f.id==='player'&&w.freePlayer()||f.windEnergy>=extraFocus);
      if(!broken&&!powered)return m;
      return {...m,damage:Math.round(m.damage*(broken?1.22:1))+(powered?6:0),balanceFinisher:broken,fusion:powered?(coil?'stormSlam':'galeSling'):null,windCost:(m.windCost||0)+(powered?extraFocus:0)};
    }
    commit(f,target,a){
      const w=this.world,m=a.move;
      if(m.balanceFinisher){target.balance=0;target.balanceBreakUntil=0;w.emit('balancePunish',{by:f.id,target:target.id,move:m.name});}
      if(m.fusion){delete target.powerMarks[m.fusion==='stormSlam'?'coil':'wind'];a.powerLink=m.fusion;}
    }
    windHit(f,target,mode,guarded){
      if(guarded)return;this.mark(target,'wind',f);if(['updraft','sky','cyclone','spiral'].includes(mode))this.focus={id:target.id,until:this.world.time+2.4};
    }
    electricBonus(f,target,guarded){return !guarded&&this.marked(target,'wind',f)&&this.world.airHeight(target)>.08?5:0;}
    electricHit(f,target,a,bonus,guarded){
      if(guarded)return;const w=this.world;this.mark(target,'shock',f,4.2);
      if(bonus){delete target.powerMarks.wind;target.vy=Math.max(target.vy,4.8/Math.sqrt(target.mass||1));target.tumbling=true;target.down=0;this.link('Storm relay',f,target);}
      if(this.world.airHeight(target)>.08||a.move.lightning==='lift')this.focus={id:target.id,until:w.time+2.4};
    }
    reel(f,target){if(this.marked(target,'shock',f)){delete target.powerMarks.shock;this.mark(target,'coil',f,5.5);this.link('Conductive coil',f,target);}}
    link(name,f,target){this.world.emit('powerLink',{name,by:f.id,target:target.id});}
    chargeBalloon(f){
      const w=this.world,b=f.balloon;if(!b||b.phase!=='rolling'||this.broken(f)||w.time<(b.chargeAt??-10)+.5||b.chargedUntil>w.time)return false;
      if(!w.freePlayer()&&(f.windEnergy<20||f.stamina<8)){w.emit(f.windEnergy<20?'windEmpty':'tired');return false;}
      if(!w.freePlayer()){f.windEnergy-=20;f.stamina-=8;}f.regenAt=w.time+.8;b.chargedUntil=w.time+6;b.chargeAt=w.time;w.emit('balloonCharge',{by:f.id,seconds:6});return true;
    }
    pulse(f,center,{radius=2.25,damage=8,name='Charged roll',exclude=null}={}){
      const w=this.world;this.pulses.push({x:center.x,y:center.y+.5,z:center.z,radius,life:.4,max:.4});this.pulses=this.pulses.slice(-8);let hits=0;
      for(const t of w.targetsFor(f)){if(t===exclude||t.held||t.dodge&&t.dodge.t<.24||Math.abs(t.y-center.y)>2.8||D(t,center)>radius||w.yard.lineBlocked(center,t,.8))continue;
        const guard=t.guard,dx=t.x-center.x,dz=t.z-center.z,d=Math.hypot(dx,dz)||1;
        if(w.environmentHit(t,{source:f,damage:Math.round(damage*(guard?.35:1)),kind:'lightning',name,dir:[dx/d||Math.sin(f.angle),0,dz/d||Math.cos(f.angle)],speed:2.4})){hits++;if(!guard)this.mark(t,'shock',f);}
      }
      if(hits)this.link(name,f,center);return hits;
    }
    balloonHit(f,target){const b=f.balloon;if(b?.chargedUntil>this.world.time){b.chargedUntil=0;this.pulse(f,target);}}
    throwImpact(f,target,a){if(a.move.fusion==='stormSlam'){this.pulse(f,target,{radius:2.4,damage:10,name:'Storm slam',exclude:target});this.link('Storm slam',f,target);}else if(a.move.fusion==='galeSling')this.link('Gale sling',f,target);}
    releaseThrow(f,target,m){if(m.fusion==='galeSling'&&!target.ko){target.vx=Math.sin(f.angle)*7/(target.mass||1);target.vz=Math.cos(f.angle)*7/(target.mass||1);target.vy=3/Math.sqrt(target.mass||1);target.y=.05;target.tumbling=true;}}
    target(f,current,token){
      const w=this.world;if(f.id!=='player'||!w.smartTarget||w.grapple||w.tether||w.ground||w.time<(w.manualTargetUntil||0)||!['P','K','H','U','G','R','S','T'].includes(token))return current;
      const reach=['R','S','T'].includes(token)?5.7:3.0,valid=t=>!t.ko&&!t.held&&D(f,t)<=reach&&!w.yard.lineBlocked(f,t,1.1),focus=this.focus?.until>w.time?w.getFighter(this.focus.id):null;
      if(focus&&valid(focus)&&w.airHeight(focus)>.12)return focus;
      if(valid(current))return current;
      const candidates=w.enemies.filter(valid).filter(t=>{const d=D(f,t)||1;return ((t.x-f.x)*Math.sin(f.angle)+(t.z-f.z)*Math.cos(f.angle))/d>-.12;});
      candidates.sort((a,b)=>(D(f,a)-(w.airHeight(a)>.18?.6:0))-(D(f,b)-(w.airHeight(b)>.18?.6:0)));return candidates[0]||current;
    }
    opportunities(){
      const w=this.world,f=w.player,t=w.enemy,g=w.grapple?.owner===f?w.grapple:null,d=D(f,t),free=w.freePlayer(),focus=n=>free||f.windEnergy>=n;
      let title='Build your next opening',note='Mix hands, legs and powers. Different attacks build balance pressure.',items=[['Launch','U','Start an air chain'],[d>2.1?'Reel / catch':'Grab',''+(d>2.1?'R':'G'),'Bring them into a clinch'],['Wind palm','W','Create space or follow with another wind cast']];
      if(f.held){title='You are held';note='Tap Dodge to resist the grip. Wait for the landing during a committed throw.';items=[];}
      else if(f.balloon){title=f.balloon.chargedUntil>w.time?'Charged balloon ready':'Roll, charge, release';note=f.balloon.chargedUntil>w.time?'Your next body collision releases a covered electric pulse.':'Charge costs 20 focus and lasts six seconds.';items=[['Charge roll','E','20 focus · next collision pulses'],['Burst roll','P','Steer, then accelerate'],['Unroll / lift','U','Return directly to an air launcher']];}
      else if(g?.phase==='clinch'){title=this.marked(t,'coil',f)?'Conductive grip ready':this.broken(t)?'Use the balance opening':'Connected: choose your finish';note='Change grip for different throws. Charged coils add an electric slam.';items=[['Knee','K','Keep control'],[g.grip==='front'?'Hip throw':'Body slam',''+(g.grip==='front'?'G':'U'),'Throw from this grip'],['Slingshot','R','Stretch throw · wind can add propulsion']];}
      else if(w.grapple||w.tether){title=w.tether?'Reeling into the clinch':'Throw in motion';note='Queue a follow-up; the pair stays attached until release.';items=[];}
      else if(!t.ko&&t.down>.08&&w.airHeight(t)<.12){title='Floor opening';note='Lift them back into the air or stand them up for another throw.';items=[['Relaunch','U','Pop-up kick'],['Stand-up clinch','G','Lift into a grab'],['Ground finish','H','Finish on the floor']];}
      else if(w.airHeight(t)>.18&&!t.held){title=this.marked(t,'wind',f)?'Wind lift: link lightning':'Air chain window';note='Catch before they land, keep juggling, or drive them down.';items=[['Air strike','P','Keep height'],[this.marked(t,'wind',f)?'Storm spark':'Reel / catch',this.marked(t,'wind',f)?'E':'R','Link the lift into a charged catch'],['Air finish','H','Slam down']];}
      else if(this.broken(t)){title='Balance broken: throw opening';note='A throw started during this window gains 22% damage.';items=[['Grab','G','Secure the opening'],['Reel / catch','R','Close from range'],['Heavy strike','H','Keep pressure']];}
      else if(this.marked(t,'shock',f)){title='Lightning connected: coil next';note='Reel this charged target in, then throw for a Storm slam.';items=[['Conductive reel','R','Store the charge in a grip'],['Wind lift','W','Set up another power link'],['Launch','U','Continue into the air']];}
      const fusion=w.infusion?.ready(f);if(fusion&&!f.held&&!f.balloon&&!w.grapple&&!w.tether&&!f.ko){title=fusion.name+' ready';note='Mix made. Release with 0, or keep your hand-to-hand chain going.';items[2]=[fusion.name,'0',fusion.note];}
      const unavailable=f.ko||w.over||f.down>.35||w.run.blocked()||f.buffer.length>=4,range=token=>f.balloon||g?Infinity:token==='0'?fusion?.range||0:token==='R'?5.6:token==='W'||token==='E'?5.1:token==='G'?t.down>.08?2.8:2.05:w.airHeight(t)>.18?4.2:t.down>.08?2.8:2.45;
      const choices=items.map(([label,token,hint])=>({label,token,hint,disabled:unavailable||d>range(token)||token==='0'&&(!fusion||!focus(fusion.focus))||token==='E'&&!focus(20)||token==='W'&&!focus(f.lastId==='gale'?24:18)||f.balloon&&token==='E'&&f.balloon.chargedUntil>w.time}));
      if(!unavailable&&!f.held&&!f.balloon&&choices.length&&choices.every(i=>i.disabled)){title='Move closer or let focus recover';note='Follow-up buttons light up when their target and resources are in reach.';}
      return {title,note,items:choices};
    }
    step(dt){
      const w=this.world;for(const f of w.fighters()){
        if((f.balanceBreakUntil||0)>0&&w.time>=f.balanceBreakUntil){f.balanceBreakUntil=0;f.balance=0;}
        if(!this.broken(f)&&w.time>(f.balanceAt||0)+1.7&&!f.held)f.balance=Math.max(0,(f.balance||0)-14*dt);
        if(f.powerMarks)for(const [key,m]of Object.entries(f.powerMarks))if(m.until<=w.time)delete f.powerMarks[key];
      }
      for(const p of this.pulses)p.life-=dt;this.pulses=this.pulses.filter(p=>p.life>0);
    }
    snapshot(){const w=this.world,state=f=>({pressure:Math.round(f.balance||0),broken:this.broken(f),opening:Math.max(0,(f.balanceBreakUntil||0)-w.time),marks:Object.keys(f.powerMarks||{}),reaction:f.impact?.profile});return {smartTarget:w.smartTarget,player:state(w.player),target:state(w.enemy),pulses:this.pulses.length,opportunity:this.opportunities()};}
  }
  root.CombatFlow={Flow,PROFILES,reaction};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatFlow;
})(typeof window!=='undefined'?window:globalThis);
