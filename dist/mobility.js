/* Player movement and traversal. Runs on the combat world's fixed 120 Hz clock. */
(function(root){
  'use strict';
  const Contact=root.CombatContact||(typeof require==='function'?require('./contact.js'):null);
  const C=(v,a,b)=>Math.max(a,Math.min(b,v)),len=(x,z)=>Math.hypot(x,z),G=10.5;
  const unit=(x,z,angle)=>{const n=len(x,z);return n>.1?[x/n,z/n]:[Math.sin(angle),Math.cos(angle)];};
  const state=()=>({duckHeld:false,crouch:0,airborne:false,voluntary:false,support:null,jumpAt:-10,landAt:-10,landUntil:0,landKind:'',airEvade:false,airWind:false,techAttempted:false,techAt:-10,techUntil:-10,techDir:[0,0],lastVy:0,anchor:null,retract:null,anchorAt:-10,candidate:null});
  class Mobility{
    constructor(world){this.world=world;world.player.mobility=state();this.previous=null;}
    get f(){return this.world.player;}
    get s(){return this.f.mobility;}
    free(){return this.world.freePlayer();}
    blocked(){const w=this.world,f=this.f;return w.over||w.run?.blocked()||f.ko||f.held||!!f.balloon||!!w.grapple||!!w.tether||!!w.ground?.mounted;}
    ready(){return !this.blocked()&&this.f.down<=0&&this.f.stunned<=0&&!this.f.dodge;}
    supports(c){return !c.prop?.mass&&!c.prop?.broken&&!c.prop?.heldBy&&Math.min(c.hx,c.hz)>=.22&&c.y+c.hy>.1;}
    above(c,x,z){return c.cylinder?Math.hypot((x-c.x)/c.hx,(z-c.z)/c.hz)<.95:Math.abs(x-c.x)<c.hx-.04&&Math.abs(z-c.z)<c.hz-.04;}
    support(){const s=this.s.support||this.f.elementSupport;if(!s)return null;return this.world.yard.solids.find(c=>c.id===s.id&&this.supports(c)&&this.above(c,this.f.x,this.f.z))||null;}
    grounded(){const f=this.f,c=this.support();return f.vy<=.01&&(f.y<=.001||!!c&&Math.abs(f.y-(c.y+c.hy))<.001);}
    spend(stamina,focus=0){const w=this.world,f=this.f;if(!this.free()&&(f.stamina<stamina||f.windEnergy<focus)){w.emit(f.windEnergy<focus?'windEmpty':'tired');return false;}if(!this.free()){f.stamina-=stamina;f.windEnergy-=focus;}f.regenAt=w.time+.6;return true;}
    cancelDemo(){if(this.world.demo){this.world.demo=null;this.world.emit('demoEnd');}}
    setDuck(held){this.s.duckHeld=!!held&&!this.blocked();return this.s.duckHeld;}
    jump(){
      const w=this.world,f=this.f,s=this.s;w.emit('controlInput',{token:'JUMP',key:'U'});
      if(this.blocked())return false;
      if(s.anchor){this.release('jump');f.vy=Math.max(3.5,f.vy+1.5);return true;}
      if(!this.ready()||!this.grounded()||w.time-s.jumpAt<.32)return false;
      if(f.action&&(!f.action.connected||f.action.t<f.action.move.cancel||f.action.move.throwType))return false;
      if(!this.spend(8))return false;w.cover?.release(f,'jump');this.cancelDemo();
      if(w.ground){w.standBlend(f);w.ground.target.visual=null;w.ground=null;}
      f.action=null;f.guard=false;f.y+=.015;f.vy=6.0;f.tumbling=false;s.support=null;
      const [x,z]=unit(w.input.x,w.input.z,f.angle),moving=len(w.input.x,w.input.z)>.1;
      if(moving){f.vx=x*3.5;f.vz=z*3.5;}
      Object.assign(s,{airborne:true,voluntary:true,jumpAt:w.time,airEvade:false,airWind:false,techAttempted:false,techUntil:-10,landUntil:0,crouch:0});
      w.emit('jump',{by:f.id,x:f.x,y:f.y,z:f.z});return true;
    }
    landingETA(){const f=this.f;if(this.grounded())return 0;let eta=f.y>0?(f.vy+Math.sqrt(f.vy*f.vy+2*G*f.y))/G:0;if(f.tumbling||f.down>0)return eta;for(const c of this.world.yard.solids){const top=c.y+c.hy;if(!this.supports(c)||top>f.y)continue;const t=(f.vy+Math.sqrt(f.vy*f.vy+2*G*(f.y-top)))/G,travel=(1-Math.exp(-1.45*t))/1.45;if(t<eta&&this.above(c,f.x+f.vx*travel,f.z+f.vz*travel))eta=t;}return eta;}
    airEvasion(x=this.world.input.x,z=this.world.input.z){
      const w=this.world,f=this.f,s=this.s;if(this.blocked()||f.y<=.001||this.grounded())return false;
      let armed=false;
      if(f.vy<-.3&&!s.techAttempted){s.techAttempted=true;s.techAt=w.time;s.techUntil=w.time+.18;s.techDir=unit(x,z,f.angle+Math.PI);w.emit('landingArmed',{eta:this.landingETA()});armed=true;}
      if(armed&&this.landingETA()<=.20)return true;
      if(f.tumbling||f.down>0||f.stunned>0||f.dodge||s.airEvade||f.action&&!f.action.connected)return armed;
      if(!this.spend(12))return armed;
      const dir=unit(x,z,f.angle+Math.PI);s.airEvade=true;s.voluntary=true;f.action=null;f.guard=false;f.vx=dir[0]*5.2;f.vz=dir[1]*5.2;f.dodge={t:0,x:dir[0],z:dir[1],kind:'air',duration:.25,origin:{x:f.x,z:f.z}};
      this.release('evade');this.cancelDemo();w.emit('dodge',{kind:'air'});return true;
    }
    redirect(x=this.world.input.x,z=this.world.input.z){
      const w=this.world,f=this.f,s=this.s;
      if(!this.ready()||this.grounded()||f.y<.1||f.tumbling||s.airWind||f.action&&(!f.action.connected||f.action.move.throwType||f.action.move.reload))return false;
      if(!this.spend(8,18))return false;
      const dir=unit(x,z,f.angle);this.release('wind');s.airWind=true;s.voluntary=true;s.redirectAt=w.time;f.action=null;f.guard=false;f.vx=dir[0]*6.2;f.vz=dir[1]*6.2;f.vy=Math.max(f.vy,2.1);f.gustAt=w.time;
      f.chainUntil=Math.max(f.chainUntil,w.time+1.1);f.hitUntil=Math.max(f.hitUntil,w.time+1.1);for(const b of f.buffer)b.until=Math.max(b.until,w.time+.9);
      this.cancelDemo();w.emit('airRedirect',{x:f.x,y:f.y+.8,z:f.z,dx:dir[0],dz:dir[1]});return true;
    }
    structures(){const y=this.world.yard;return [...y.pillars,...y.walls];}
    anchorPoint(c){const f=this.f,dx=f.x-c.x,dz=f.z-c.z,n=len(dx,dz)||1;
      if(c.cylinder)return [c.x+dx/n*(c.hx+.04),c.y+c.hy-.10,c.z+dz/n*(c.hz+.04)];
      return [C(f.x,c.x-c.hx+.06,c.x+c.hx-.06),c.y+c.hy-.10,C(f.z,c.z-c.hz+.06,c.z+c.hz-.06)].map((v,i)=>i===0&&c.id==='west'?c.x+c.hx+.04:i===0&&c.id==='east'?c.x-c.hx-.04:i===2&&c.id==='north'?c.z+c.hz+.04:i===2&&c.id==='south'?c.z-c.hz-.04:v);
    }
    clearCable(point,ignore){const f=this.f,from=[f.x,f.y+1.52,f.z];for(const c of this.world.yard.solids){if(c.id===ignore||c.prop?.broken||c.prop?.heldBy||c.prop?.pulledBy||c.prop?.type==='debris')continue;const t=Contact.segmentBox(from,point,c,.045);if(t!==null&&t<.98)return false;}return true;}
    candidate(){
      const w=this.world,f=this.f,dir=unit(w.input.x,w.input.z,f.angle);
      return this.structures().map(c=>{const point=this.anchorPoint(c),dx=point[0]-f.x,dz=point[2]-f.z,d=len(dx,dz),dot=(dx*dir[0]+dz*dir[1])/Math.max(.01,d);return {id:c.id,point,d,dot,label:c.cylinder?'Pillar':'Wall',score:dot*4-d*.32};}).filter(a=>a.d>1.25&&a.d<8.5&&a.dot>.20&&this.clearCable(a.point,a.id)).sort((a,b)=>b.score-a.score)[0]||null;
    }
    anchor(){
      const w=this.world,f=this.f,s=this.s;w.emit('controlInput',{token:'ANCHOR',key:'B'});
      if(s.anchor){this.release('manual');return true;}
      if(!this.ready()||f.tumbling||w.yard.held(f)||w.yard.retrieve?.owner===f||w.time-s.anchorAt<.4||f.action&&(!f.action.connected||f.action.t<f.action.move.cancel))return false;
      const candidate=this.candidate();if(!candidate){w.emit('mobilityNotice',{text:'Aim toward a visible pillar or wall within stretch range.'});return false;}
      if(!this.spend(12))return false;w.cover?.release(f,'anchor');this.cancelDemo();f.action=null;f.guard=false;f.tumbling=false;
      const wasGrounded=this.grounded();s.support=null;s.anchor={...candidate,at:w.time,from:[f.x,f.y+1.5,f.z]};s.anchorAt=w.time;s.retract=null;s.voluntary=true;s.airborne=true;s.crouch=0;
      if(wasGrounded){f.y+=.015;f.vy=Math.max(f.vy,3.0);}w.emit('anchorAttach',{point:candidate.point,id:candidate.id,label:candidate.label});return true;
    }
    release(reason='manual'){
      const s=this.s,a=s.anchor;if(!a)return false;
      s.retract={point:a.point.slice(),at:this.world.time};s.anchor=null;this.world.emit('anchorRelease',{reason});return true;
    }
    interrupt(f){if(f!==this.f)return;this.release('hit');Object.assign(this.s,{duckHeld:false,crouch:0,voluntary:false});}
    before(dt){
      const w=this.world,f=this.f,s=this.s;this.previous=[f.x,f.y,f.z];
      if(s.support&&(this.blocked()||f.tumbling||f.vy>.01))s.support=null;
      if(s.support&&!this.support()){s.support=null;if(!f.tumbling){s.voluntary=true;s.airborne=true;}}
      if(this.blocked()||f.down>0||f.stunned>0){this.release('interrupted');s.duckHeld=false;}
      const want=!f.cover&&s.duckHeld&&this.ready()&&this.grounded()&&!f.action?1:0;s.crouch+=(want-s.crouch)*(1-Math.exp(-24*dt));if(s.crouch<.001)s.crouch=0;
      if(f.y>.1&&!this.grounded()){if(!s.airborne){s.airEvade=false;s.airWind=false;s.techAttempted=false;s.techUntil=-10;}s.airborne=true;
        if(f.vy>1&&s.lastVy<=0){s.techAttempted=false;s.techUntil=-10;}
        if(!this.blocked()&&!f.tumbling&&f.down<=0&&f.stunned<=0&&!f.dodge&&!s.anchor&&!f.action){const n=Math.max(1,len(w.input.x,w.input.z)),accel=12;f.vx+=w.input.x/n*accel*dt;f.vz+=w.input.z/n*accel*dt;const speed=len(f.vx,f.vz),limit=s.airWind?6.3:4.2;if(speed>limit){f.vx*=limit/speed;f.vz*=limit/speed;}}
      }
      s.lastVy=f.vy;if(s.retract&&w.time-s.retract.at>.20)s.retract=null;
      if(s.anchor){const a=s.anchor;if(!this.structures().some(c=>c.id===a.id)||!this.clearCable(a.point,a.id)||w.time-a.at>.85){this.release('ended');return;}
        const dx=a.point[0]-f.x,dz=a.point[2]-f.z,d=len(dx,dz),dy=a.point[1]-.85-f.y;
        if(d<1.02){f.vy=Math.max(f.vy,2.2);this.release('arrived');return;}
        const extension=C((w.time-a.at)/.12,0,1),force=C(d*9,10,34)*extension;f.vx+=dx/d*force*dt;f.vz+=dz/d*force*dt;f.vy+=C(dy*22+G,-12,22)*dt;
        const speed=len(f.vx,f.vz);if(speed>7){f.vx*=7/speed;f.vz*=7/speed;}f.vy=C(f.vy,-5,4.5);w.face(f,{x:a.point[0],z:a.point[2]},Math.min(1,dt*12));
      }
      if(w.time>=(s.nextCandidateAt||0)){s.candidate=this.candidate();s.nextCandidateAt=w.time+.1;}
    }
    land(speed){
      const w=this.world,f=this.f,s=this.s,eligible=s.airborne&&!f.ko&&!f.held&&!w.grapple&&!w.tether;
      const tech=eligible&&s.techAttempted&&w.time<=s.techUntil&&w.time-s.techAt>=0;
      this.release('landed');s.airborne=false;s.airWind=false;s.airEvade=false;s.voluntary=false;s.lastVy=0;
      s.landAt=w.time;s.landSpeed=speed;s.landKind=tech?'tech':f.tumbling?'fall':'soft';s.landUntil=w.time+(tech?.08:f.tumbling?0:.14);
      if(tech){f.tumbling=false;f.down=0;f.stunned=.07;f.visual=null;f.recovery=null;f.action=null;f.guard=false;f.vx=s.techDir[0]*3.8;f.vz=s.techDir[1]*3.8;f.counterUntil=w.time+.65;w.emit('landingRecovery',{speed,by:f.id});}
      else if(eligible&&!f.tumbling&&!f.action){f.stunned=Math.max(f.stunned,.14);w.emit('softLanding',{speed,by:f.id});}
      else if(eligible&&s.techAttempted)w.emit('landingMiss',{speed});
      s.techAttempted=false;s.techUntil=-10;return tech;
    }
    // Swept torso/hip volumes stop new traversal from crossing solid scenery.
    constrain(){
      const w=this.world,f=this.f,s=this.s;if(!this.previous||this.blocked()||!(s.voluntary||s.anchor||f.dodge?.kind))return;
      let from=this.previous.slice(),goal=[f.x,f.y,f.z],blocked=false;
      if(!f.tumbling&&!f.held&&goal[1]<from[1]){let surface=null,tFirst=1;
        for(const c of w.yard.solids){const top=c.y+c.hy;if(!this.supports(c)||from[1]<top-.001||goal[1]>top)continue;const t=(from[1]-top)/(from[1]-goal[1]),x=from[0]+(goal[0]-from[0])*t,z=from[2]+(goal[2]-from[2])*t;if(t<=tFirst&&this.above(c,x,z)){surface=c;tFirst=t;}}
        if(surface){const speed=Math.abs(f.vy);goal[1]=surface.y+surface.hy;f.y=goal[1];f.vy=0;s.support={id:surface.id};this.land(speed);}
      }
      for(let pass=0;pass<3;pass++){
        let first=null;const delta=goal.map((v,i)=>v-from[i]);if(Math.hypot(...delta)<.00001)break;
        for(const c of w.yard.solids){if(c.prop?.mass>0||c.prop?.broken||c.prop?.heldBy||c.prop?.pulledBy)continue;
          for(const [height,r]of [[.48,.31],[1.35,.25]]){const a=from.map((v,i)=>v+(i===1?height:0)),b=goal.map((v,i)=>v+(i===1?height:0)),t=Contact.segmentBox(a,b,c,r);
            if(t===null||t>=1||first&&t>=first.t)continue;const hit=a.map((v,i)=>v+(b[i]-v)*t),center=[c.x,c.y,c.z],ext=[c.hx+r,c.hy+r,c.hz+r],axis=[0,1,2].sort((i,j)=>Math.abs(hit[j]-center[j])/ext[j]-Math.abs(hit[i]-center[i])/ext[i])[0],normal=[0,0,0];normal[axis]=Math.sign(hit[axis]-center[axis])||1;if(t<.00001&&delta.reduce((sum,v,i)=>sum+v*normal[i],0)>=-.00001)continue;first={t,normal};
          }
        }
        if(!first){from=goal;break;}blocked=true;const t=Math.max(0,first.t-.002),n=first.normal;from=from.map((v,i)=>v+delta[i]*t);const rest=delta.map(v=>v*(1-t)),dot=rest.reduce((a,v,i)=>a+v*n[i],0);goal=from.map((v,i)=>v+rest[i]-Math.min(0,dot)*n[i]);const velocity=[f.vx,f.vy,f.vz],into=velocity.reduce((a,v,i)=>a+v*n[i],0);[f.vx,f.vy,f.vz]=velocity.map((v,i)=>v-Math.min(0,into)*n[i]);
      }
      [f.x,f.y,f.z]=from;f.y=Math.max(0,f.y);if(blocked)this.release('blocked');
    }
    snapshot(){const s=this.s;return {crouch:s.crouch,grounded:this.grounded(),support:s.support?.id||null,airborne:s.airborne,airWindUsed:s.airWind,airEvadeUsed:s.airEvade,landingETA:this.landingETA(),recoveryArmed:this.world.time<=s.techUntil,landing:s.landKind,anchor:s.anchor?{id:s.anchor.id,point:s.anchor.point.slice()}:null,candidate:s.candidate?{id:s.candidate.id,label:s.candidate.label,point:s.candidate.point.slice()}:null};}
  }
  root.CombatMobility={Mobility};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatMobility;
})(typeof window!=='undefined'?window:globalThis);
