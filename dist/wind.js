/* Wind shares contact, mass and cover with the rest of the arena. */
(function(root){
  'use strict';
  const C=(v,a,b)=>Math.max(a,Math.min(b,v)),L=(x,z)=>Math.hypot(x,z),areaModes=new Set(['updraft','downburst','vacuum','cyclone','spiral']);
  class Wind{
    constructor(world){this.world=world;this.waves=[];this.fields=[];}
    prepare(f,a,target){
      const mode=a.move.wind,dx=Math.sin(f.angle),dz=Math.cos(f.angle),d=Math.min(4.6,L(target.x-f.x,target.z-f.z)),field=this.fields.find(q=>q.by===f.id);
      a.windAim={x:f.x,z:f.z,y:f.y,dx,dz,cx:f.x+dx*d,cz:f.z+dz*d,mode};
      if(mode==='vacuum'){a.windAim.cx=f.x+dx*Math.min(1.15,d);a.windAim.cz=f.z+dz*Math.min(1.15,d);}
      if(mode==='downburst'&&field&&f.lastId==='downburst'){a.windAim.cx=field.cx;a.windAim.cz=field.cz;}
      if(mode==='dash')a.windDash={distance:Math.max(0,Math.min(2.6,d-1.05)),travel:0};
      if(mode==='spiral'){a.windAim.cx=f.x+dx*Math.min(d,2.2);a.windAim.cz=f.z+dz*Math.min(d,2.2);}
    }
    dash(f,a,dt){
      if(a.hit||a.t>=a.move.startup||f.stunned>0||f.held)return;
      const remaining=a.windDash.distance-a.windDash.travel,speed=Math.min(10,Math.max(0,remaining)/Math.max(dt,a.move.startup-a.t));
      f.vx=a.windAim.dx*speed;f.vz=a.windAim.dz*speed;a.windDash.travel+=speed*dt;
    }
    resolve(f,a){
      const w=this.world,m=a.move,aim=a.windAim,mode=m.wind,area=areaModes.has(mode),bonus=f.id==='player'?w.perk('wind')*.14:0,radius=(mode==='vacuum'?2.8:mode==='cyclone'?1.85:mode==='spiral'?2.1:1.65)+bonus;
      if(mode==='dash'){aim.x=f.x;aim.z=f.z;f.vx*=.25;f.vz*=.25;}
      if(mode==='downburst')this.fields=this.fields.filter(field=>field.by!==f.id);
      const wave={...aim,mode,life:.65,max:.65,radius:area?radius:1,by:f.id};this.waves.push(wave);
      const origin={x:aim.x,y:aim.y,z:aim.z};
      const inside=(x,y,z,r=0)=>{
        if(area)return L(x-aim.cx,z-aim.cz)<radius+r&&Math.abs(y-aim.y)<4;
        const dx=x-aim.x,dz=z-aim.z,forward=dx*aim.dx+dz*aim.dz,side=Math.abs(dx*aim.dz-dz*aim.dx);
        return forward>-.15&&forward<(mode==='dash'?2.05:5.1)+r&&side<.45+bonus+Math.max(0,forward)*.19+r&&Math.abs(y-aim.y)<3.4;
      };
      let hits=0,props=0;
      for(const target of w.targetsFor(f)){
        if(!inside(target.x,target.y,target.z,.25)||target.dodge&&target.dodge.t<.24||w.yard.lineBlocked(origin,target,.85))continue;
        const mass=target.mass||1,guard=target.guard?.42:1,dx=area?target.x-aim.cx:aim.dx,dz=area?target.z-aim.cz:aim.dz,n=L(dx,dz)||1;
        const dir=[area?dx/n:dx,0,area?dz/n:dz];if(!L(dir[0],dir[2])){dir[0]=aim.dx;dir[2]=aim.dz;}
        if(mode==='vacuum'){dir[0]*=-1;dir[2]*=-1;}
        const damage=Math.max(1,Math.round(m.damage*guard));
        if(!w.environmentHit(target,{source:f,damage,kind:'wind',dir,speed:3,connection:a,name:m.name}))continue;
        w.flow.windHit(f,target,mode,guard<1);
        if(target.impact){target.impact.launch=['updraft','sky','cyclone','spiral'].includes(mode);target.impact.slam=mode==='downburst';target.impact.zone='body';}
        if(['updraft','sky','cyclone','spiral'].includes(mode)){
          target.down=0;target.visual=null;target.recovery=null;target.y=Math.max(target.y,.08);target.vy=(mode==='updraft'?6.4:mode==='spiral'?6.2:mode==='cyclone'?4:4.4)/Math.sqrt(mass)*Math.sqrt(guard);target.tumbling=true;target.stunned=Math.max(target.stunned,.68);target.airJuggles++;
          target.vx=aim.dx*.65/mass;target.vz=aim.dz*.65/mass;
        }else if(mode==='downburst'){
          target.vy=-7;target.down=1.25;target.downAt=w.time;target.stunned=1.25;target.tumbling=true;target.vx=dir[0]*3.1/mass;target.vz=dir[2]*3.1/mass;
        }else if(mode==='vacuum'){
          const pull=Math.min(7,L(dx,dz)*8)/mass*guard;target.vx=dir[0]*pull;target.vz=dir[2]*pull;target.stunned=Math.max(target.stunned,.54);
        }else{
          target.vx=aim.dx*(mode==='dash'?2.2:5.2)/mass*guard;target.vz=aim.dz*(mode==='dash'?2.2:5.2)/mass*guard;target.stunned=Math.max(target.stunned,.42);
          if(target.down>0){target.vy=2.1/Math.sqrt(mass);target.y=Math.max(.04,target.y);target.tumbling=true;}
        }
        hits++;
      }
      for(const p of [...w.yard.props]){
        if(p.broken||p.heldBy||p.pulledBy||p.type==='debris'||!inside(p.x,Math.max(0,p.y-p.hy),p.z,.2)||w.yard.lineBlocked(origin,{x:p.x,y:0,z:p.z},.85,p))continue;
        const dx=area?p.x-aim.cx:aim.dx,dz=area?p.z-aim.cz:aim.dz,n=L(dx,dz)||1,mass=p.mass||8,sign=mode==='vacuum'?-1:1;
        const force=C(Math.sqrt(5/mass),.35,2.1),x=(area?dx/n:dx)*5.7*force*sign,z=(area?dz/n:dz)*5.7*force*sign,y=(mode==='updraft'||mode==='cyclone'||mode==='spiral'?7:mode==='downburst'?-3:mode==='vacuum'?1.1:2.5)*force;
        w.yard.damage(p,mode==='downburst'?24:9,f,{x,y,z});
        if(!p.broken&&p.mass>0){p.vx+=x*.35;p.vy+=y*.35;p.vz+=z*.35;p.wx+=z*.15;p.wz-=x*.15;p.owner=f.id;p.thrownAt=w.time;p.armedUntil=w.time+1.7;p.sleep=false;p.settle=0;}
        props++;
      }
      if(mode==='cyclone'){
        this.fields=this.fields.filter(field=>field.by!==f.id);
        this.fields.push({...aim,by:f.id,life:.95,max:.95,radius:1.85+bonus,next:w.time+.28,ticks:{},age:0});
      }
      w.emit('windCast',{mode,name:m.name,hits,props,assisted:!!a.assisted,requestedToken:({A:'P',Y:'K',M:'H'})[a.request]||a.token,x:area?aim.cx:aim.x,z:area?aim.cz:aim.z});
      if(!hits){if(!props)w.emit('whiff',{move:m.name});return props||mode==='cyclone'?'world':'miss';}
      return 'hit';
    }
    step(dt){
      const w=this.world;for(const wave of this.waves)wave.life-=dt;this.waves=this.waves.filter(wave=>wave.life>0);
      for(const field of this.fields){
        field.life-=dt;field.age+=dt;const source=w.getFighter(field.by);if(!source||source.ko){field.life=0;continue;}
        const origin={x:field.x,y:field.y,z:field.z};
        for(const f of w.targetsFor(source)){
          const x=field.cx-f.x,z=field.cz-f.z,d=L(x,z);if(f.held||w.grapple?.owner===f||f.y>4||d>field.radius||f.dodge&&f.dodge.t<.24||w.yard.lineBlocked(origin,f,.85))continue;
          const n=Math.max(.3,d),mass=f.mass||1,power=C(1-d/field.radius,.15,1)/mass;
          f.vx=C(f.vx+(x/n*18-z/n*6)*power*dt,-6,6);f.vz=C(f.vz+(z/n*18+x/n*6)*power*dt,-6,6);
          if(f.y<1.4)f.vy=Math.max(f.vy,1.8/Math.sqrt(mass));
          const tick=field.ticks[f.id]||{at:field.next,count:0};field.ticks[f.id]=tick;
          if(w.time>=tick.at&&tick.count<3){tick.at=w.time+.28;tick.count++;w.environmentHit(f,{source,damage:3,kind:'wind',dir:[x/n,0,z/n],speed:1.5,preserve:true,name:'Cyclone current'});}
        }
        for(const p of w.yard.props){
          const x=field.cx-p.x,z=field.cz-p.z,d=L(x,z);if(p.broken||p.heldBy||p.pulledBy||p.anchored||!p.mass||p.type==='debris'||d>field.radius||p.y>3.8||w.yard.lineBlocked(origin,{x:p.x,y:0,z:p.z},.85,p))continue;
          const n=Math.max(.3,d),force=C(5/p.mass,.25,1.8);p.vx=C(p.vx+(x/n*13-z/n*9)*force*dt,-7,7);p.vz=C(p.vz+(z/n*13+x/n*9)*force*dt,-7,7);p.vy+=9*force*dt;p.owner=source.id;p.thrownAt=w.time;p.armedUntil=w.time+.7;p.sleep=false;p.settle=0;
        }
      }
      this.fields=this.fields.filter(field=>field.life>0);
    }
    stage(){
      const w=this.world;w.mode='group';w.groupCount=3;w.groupMix='mixed';w.groupBehavior='passive';w.infinite=true;w.reset();
      w.player.x=0;w.player.z=2;w.player.angle=Math.PI;
      w.enemies.forEach((e,i)=>{e.x=(i-1)*.9;e.z=-.5-Math.abs(i-1)*.2;w.face(e,w.player);});
      const p=w.yard.props.find(p=>p.type==='crate');if(p){p.x=.4;p.z=-1.9;p.y=p.hy;p.vx=p.vy=p.vz=0;}
      w.enemy=w.enemies[1];w.opponent=w.controllers[w.enemy.id];w.yard.rebuild();w.emit('target',{id:w.enemy.id,name:w.enemy.name});w.emit('windSetup');
    }
  }
  const API={Wind};root.CombatWind=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
