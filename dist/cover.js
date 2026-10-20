/* Cover is a constrained movement stance. Solids and the shared body rig stop shots. */
(function(root){
  'use strict';
  const Contact=root.CombatContact||(typeof require==='function'?require('./contact.js'):null);
  const C=(v,a,b)=>Math.max(a,Math.min(b,v)),L=(x,z)=>Math.hypot(x,z);
  class Cover{
    constructor(world){this.world=world;this.held=new Map();this.nextAI={};for(const f of world.fighters())f.cover=null;}
    eligible(c){return !c.cylinder&&!c.prop?.broken&&!c.prop?.heldBy&&!c.prop?.pulledBy&&!c.prop?.mass&&c.y+c.hy>=1.1&&c.y+c.hy<2.3&&Math.max(c.hx,c.hz)>.55&&(c.prop?.type==='car'?c.cover===true:!c.prop||c.prop.cover===true||['table','divider'].includes(c.prop.type));}
    solids(){return this.world.yard.solids.filter(c=>this.eligible(c));}
    ready(f){const w=this.world;return !w.over&&!w.run?.blocked()&&!f.ko&&!f.held&&!f.balloon&&f.y<.02&&f.down<=0&&f.stunned<=0&&!f.dodge&&!w.grapple&&!w.tether&&!w.ground?.mounted;}
    faces(c){return [[1,0,c.hx,c.hz],[-1,0,c.hx,c.hz],[0,1,c.hz,c.hx],[0,-1,c.hz,c.hx]].map(([nx,nz,depth,extent])=>({id:c.id,n:[nx,nz],t:[-nz,nx],x:c.x+nx*(depth+.44),z:c.z+nz*(depth+.44),extent,top:c.y+c.hy,name:c.prop?.name||'Wall'}));}
    candidates(f,reach=1.15,threat=null){return this.solids().flatMap(c=>this.faces(c).filter(face=>c.prop?.type!=='car'||Math.abs(face.n[0]*Math.cos(c.prop.angle)-face.n[1]*Math.sin(c.prop.angle))>.9).map(face=>{const u=C((f.x-face.x)*face.t[0]+(f.z-face.z)*face.t[1],-face.extent,face.extent),x=face.x+face.t[0]*u,z=face.z+face.t[1]*u,d=L(f.x-x,f.z-z),outside=(f.x-c.x)*face.n[0]+(f.z-c.z)*face.n[1];return {...face,u,xGoal:x,zGoal:z,d,outside};}).filter(a=>a.d<reach&&a.outside>0&&(!threat||(threat.x-c.x)*a.n[0]+(threat.z-c.z)*a.n[1]<0)) ).sort((a,b)=>a.d-b.d).filter(a=>this.world.yard.solids.every(c=>c.prop?.mass>0||Contact.segmentBox([f.x,.55,f.z],[a.xGoal,.55,a.zGoal],c,.32)===null));}
    toggle(f=this.world.player){const w=this.world;w.emit('controlInput',{token:'COVER',key:'ENTER'});if(f.cover){this.release(f,'manual');return true;}if(!this.ready(f)||f.action)return false;const a=this.candidates(f)[0];if(!a){if(f===w.player)w.emit('coverNotice',{text:'Move close to a car, concrete barrier, planter or earth wall.'});return false;}return this.attach(f,a);}
    attach(f,a){if(!this.ready(f))return false;const w=this.world;f.cover={...a,from:[f.x,f.z],at:w.time,peek:null,exposure:0,shuffle:0};f.guard=false;f.vx=f.vz=0;f.chain='';f.buffer=[];if(f===w.player){w.mobility.release('cover');w.demo=null;}w.face(f,{x:f.x-a.n[0],z:f.z-a.n[1]});w.emit('coverEnter',{by:f.id,name:a.name});return true;}
    release(f=this.world.player,reason='move'){if(!f?.cover)return false;f.cover=null;this.held.delete(f.id);this.world.emit('coverExit',{by:f.id,reason});return true;}
    setPeek(kind,held=true,f=this.world.player){if(held&&f.cover)this.held.set(f.id,kind);else this.held.delete(f.id);}
    clear(){this.held.clear();}
    requested(f){const s=f.cover,kind=this.held.get(f.id);if(!s||!kind)return null;if(kind==='auto')return s.top<=1.5?'up':s.u<0?'left':'right';return kind;}
    peekable(s,kind){return kind==='up'?s.top<=1.5:kind==='left'?s.u<=-s.extent+.35:kind==='right'?s.u>=s.extent-.35:false;}
    canAttack(f,move){const s=f.cover;if(!s)return true;if(move.reload||move.element==='wall')return true;if(move.mobilityElement){this.release(f,'element move');return true;}if(!move.ranged&&!move.element){this.release(f,'attack');return true;}if(!s.peek||s.exposure<.78){if(f===this.world.player)this.world.emit('coverNotice',{text:'Hold Peek at an edge, or pop up over low cover, before firing.'});return false;}return true;}
    before(dt){const w=this.world;for(const f of w.fighters()){const s=f.cover;if(!s)continue;const c=w.yard.solids.find(c=>c.id===s.id);if(!c||!this.eligible(c)||!this.ready(f)||L(f.x-(s.x+s.t[0]*s.u),f.z-(s.z+s.t[1]*s.u))>1.4){this.release(f,'interrupted');continue;}
        const kind=this.requested(f),allowed=this.peekable(s,kind);s.peek=allowed?kind:null;s.exposure+=(Number(allowed)-s.exposure)*(1-Math.exp(-23*dt));if(s.exposure<.001)s.exposure=0;
        if(!f.action){const input=f===w.player?w.input:{x:s.aiMove||0,z:s.aiMoveZ||0},along=C(input.x*s.t[0]+input.z*s.t[1],-1,1);s.shuffle=along*(allowed?.28:1.55);s.u=C(s.u+s.shuffle*dt,-s.extent-.08,s.extent+.08);f.moving=Math.abs(s.shuffle);f.walk+=Math.abs(s.shuffle)*dt*3.5;f.motion={x:along,z:0};}
        const entry=C((w.time-s.at)/.16,0,1),blend=entry*entry*(3-2*entry),x=s.x+s.t[0]*s.u,z=s.z+s.t[1]*s.u;f.x=s.from[0]+(x-s.from[0])*blend;f.z=s.from[1]+(z-s.from[1])*blend;f.vx=f.vz=0;f.guard=false;
        if(!f.action)w.face(f,{x:f.x-s.n[0],z:f.z-s.n[1]},Math.min(1,dt*14));
        // Releasing peek before the shot commits cancels it; never fire from a hidden muzzle.
        if(f.action&&!f.action.hit&&(f.action.move.ranged||f.action.move.element&&f.action.move.element!=='wall')&&(!s.peek||s.exposure<.55)){f.action=null;f.buffer=[];}
      }}
    ai(brain,dt){const w=this.world,f=brain.fighter,p=w.player,s=f.cover;if(!w.isLive())return false;
      if(s){if(L(f.x-p.x,f.z-p.z)<2.1||w.elements?.danger(f)){this.release(f,'flushed');brain.state.next=w.time+.3;return false;}
        const side=s.u<0?-1:1;s.aiMove=s.t[0]*side;s.aiMoveZ=s.t[1]*side;const edge=Math.abs(s.u)>=s.extent-.3;
        if(!edge){brain.intent('moving to cover edge');return true;}
        const phase=(w.time-s.at)%3.1,peek=phase>1.05&&phase<2.45;this.setPeek(side<0?'left':'right',peek,f);brain.intent(peek?'peeking to fire':'behind cover');f.moving=0;
        if(peek&&s.exposure>.86&&w.time>=brain.state.next&&w.requestAttack(f)){const item=w.yard.held(f),token=item?.ammo>0?'P':'J';brain.state.plan=[];if(w.start(f,p,token))brain.state.next=w.time+1.0;}return true;
      }
      if(w.time<(this.nextAI[f.id]||0)||w.yard.held(f)?.type!=='blaster'||L(f.x-p.x,f.z-p.z)<3)return false;
      const a=this.candidates(f,2.4,p)[0];if(!a){this.nextAI[f.id]=w.time+1.3;return false;}
      const goal={x:a.xGoal,y:0,z:a.zGoal};if(L(f.x-goal.x,f.z-goal.z)<.28){this.attach(f,a);brain.state.plan=[];}else{brain.intent('seeking cover');brain.move(goal.x-f.x,goal.z-f.z,brain.style().pace,dt,goal);}return true;
    }
    stage(live=false){const w=this.world;w.arenaId='street';w.mode=live?'sparring':'practice';w.dummy='passive';w.opponentStyle='gunner';w.infinite=!live;w.reset();const f=w.player,e=w.enemy,barrier=w.yard.props.find(p=>p.type==='barrier');f.x=barrier.x;f.z=barrier.z+.44+barrier.hz;e.x=live?.15:barrier.x;e.z=live?-5.36:barrier.z-3.1;w.face(f,e);w.face(e,f);f.health=f.maxHealth=live?220:140;let gun=w.yard.props.find(p=>p.type==='blaster'&&!p.heldBy);if(!gun){gun=w.yard.make('blaster',f.x,f.z);w.yard.props.push(gun);}if(gun){gun.x=f.x;gun.z=f.z;gun.y=gun.hy;w.yard.rebuild();w.yard.pickup(f,gun);}this.world.cover.toggle();if(live)this.world.cover.toggle(e);w.emit('coverSetup',{live});return true;}
    snapshot(){const s=this.world.player.cover;return s?{id:s.id,name:s.name,peek:s.peek,exposure:s.exposure,position:s.u,extent:s.extent,low:s.top<=1.5}:null;}
  }
  root.CombatCover={Cover};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatCover;
})(typeof window!=='undefined'?window:globalThis);
