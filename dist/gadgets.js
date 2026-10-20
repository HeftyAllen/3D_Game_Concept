/* Ground-level machinery drives existing bodies; it never teleports a hit. */
(function(root){
  'use strict';
  const L=(x,z)=>Math.hypot(x,z);
  class Gadgets{
    constructor(world,yard){
      this.world=world;this.yard=yard;this.power=1;this.actor=null;this.changedAt=-10;this.lastUse=-10;
      this.belts=(yard.layout.belts||[]).map((p,i)=>({id:'belt-'+i,...p}));
      this.vents=(yard.layout.vents||[]).map((p,i)=>({id:'vent-'+i,period:4.8,offset:i*2.1,last:{},flash:0,...p}));
      this.panels=(yard.layout.panels||[]).map((p,i)=>({id:'panel-'+i,...p}));
      this.waterways=(yard.layout.channels||[]).map((p,i)=>({id:'channel-'+i,...p}));this.nextWet=0;
    }
    colliders(){return this.panels.map(p=>({id:p.id,x:p.x,y:.55,z:p.z,hx:.30,hy:.55,hz:.18}));}
    nearest(f){return this.panels.map(p=>({...p,d:L(p.x-f.x,p.z-f.z)})).sort((a,b)=>a.d-b.d)[0]||null;}
    activate(f){
      const w=this.world,p=this.nearest(f);
      if(!p||p.d>1.7){w.emit('yardNotice',{text:p?'Move close to a striped control post, then press Y.':'This arena has no machinery switches. Try the Foundry.'});return false;}
      if(f.ko||f.held||f.down>0||f.stunned>0||f.dodge||f.action||w.grapple||w.tether||f.balloon){w.emit('yardNotice',{text:'Free your hands and finish the move before using the switch.'});return false;}
      if(w.time-this.lastUse<.45)return false;this.lastUse=w.time;this.power=this.power===1?-1:this.power===-1?0:1;this.actor=f.id;this.changedAt=w.time;
      w.emit('machineSwitch',{by:f.id,power:this.power,x:p.x,z:p.z});return true;
    }
    phase(vent){const t=((this.world.time+vent.offset)%vent.period+vent.period)%vent.period;return t<.65?'blast':t>vent.period-.75?'warning':'idle';}
    wetAt(f){return f.y<.16&&this.waterways.some(c=>Math.abs(f.x-c.x)<c.hx&&Math.abs(f.z-c.z)<c.hz);}
    water(dt){const w=this.world;if(!this.waterways.length||!w.elements||!w.infusion)return;
      for(const f of w.fighters())if(this.wetAt(f)){w.infusion.mark(f,'wet',{id:'environment'},1.3);delete f.elementStatus.burn;}
      for(const p of this.yard.props)if(!p.broken&&!p.heldBy&&!p.pulledBy&&p.y-p.hy<.12&&this.waterways.some(c=>Math.abs(p.x-c.x)<c.hx&&Math.abs(p.z-c.z)<c.hz)){p.wetUntil=w.time+1.3;p.burning=null;}
      if(w.time>=this.nextWet){this.nextWet=w.time+.45;for(const c of this.waterways)for(let z=-c.hz+.4;z<c.hz;z+=1.15)w.elements.quench(c.x,c.z+z,c.hx*.9);}
      if(!w.hazards||!this.power)return;
      for(const c of this.waterways){const inside=f=>f.y<.16&&Math.abs(f.x-c.x)<c.hx&&Math.abs(f.z-c.z)<c.hz,dx=c.dx*this.power,dz=c.dz*this.power;
        for(const f of w.fighters()){if(f.ko||f.held||!inside(f)||w.tether?.owner===f||w.ground?.target===f)continue;if(w.grapple?.owner===f){if(w.grapple.phase==='clinch')this.yard.movePair(f,dx*c.speed*.25*dt,dz*c.speed*.25*dt);continue;}const force=c.speed*3.5*dt/Math.sqrt(f.mass||1);f.vx+=dx*force;f.vz+=dz*force;}
        for(const p of this.yard.props){if(!p.mass||p.broken||p.heldBy||p.pulledBy||p.anchored||p.y-p.hy>.14||Math.abs(p.x-c.x)>c.hx||Math.abs(p.z-c.z)>c.hz)continue;p.sleep=false;p.settle=0;const force=c.speed*8*dt/Math.sqrt(p.mass);p.vx+=dx*force;p.vz+=dz*force;p.wy+=dt*.12;}
      }
    }
    arm(p){
      const w=this.world;if(!p.machineArmed){p.thrownAt=w.time;p.machineArmed=true;}
      if(this.actor&&w.time-this.changedAt<3)p.owner=this.actor;
      p.armedUntil=Math.max(p.armedUntil,w.time+.6);
    }
    step(dt){
      const w=this.world,y=this.yard;this.water(dt);if(!w.hazards||!this.power){for(const v of this.vents)v.flash=Math.max(0,v.flash-dt*3);return;}
      for(const belt of this.belts){
        const inside=(x,z)=>Math.abs(x-belt.x)<belt.hx&&Math.abs(z-belt.z)<belt.hz,dx=belt.dx*this.power,dz=belt.dz*this.power;
        for(const f of w.fighters()){
          if(f.ko||f.held||f.y>.12||!inside(f.x,f.z)||w.tether?.owner===f)continue;
          if(w.grapple?.owner===f&&w.grapple.phase!=='clinch')continue;
          if(f.balloon){f.vx+=dx*5*dt;f.vz+=dz*5*dt;}else y.movePair(f,dx*belt.speed*.32*dt,dz*belt.speed*.32*dt);
        }
        for(const p of y.props){
          if(p.broken||p.heldBy||p.pulledBy||p.anchored||!p.mass||p.type==='debris'||!inside(p.x,p.z)||p.y>p.hy+.28)continue;
          p.sleep=false;p.settle=0;const blend=1-Math.exp(-22*dt);p.vx+=(dx*belt.speed-p.vx)*blend;p.vz+=(dz*belt.speed-p.vz)*blend;
          if(L(p.vx,p.vz)>2.7)this.arm(p);
        }
      }
      for(const vent of this.vents){
        vent.flash=Math.max(0,vent.flash-dt*2.5);if(this.phase(vent)!=='blast')continue;vent.flash=1;
        const inside=(x,z)=>Math.abs(x-vent.x)<vent.hx&&Math.abs(z-vent.z)<vent.hz;
        for(const f of w.fighters()){
          if(f.ko||f.held||w.grapple?.owner===f||w.tether?.owner===f||f.y>.12||f.vy>1||!inside(f.x,f.z)||w.time-(vent.last[f.id]??-10)<1.1)continue;
          vent.last[f.id]=w.time;
          if(w.ground?.target===f){w.standBlend(w.ground.owner);w.ground.owner.visual=null;w.ground=null;f.visual=null;f.down=f.stunned=0;}
          f.y=.04;f.vy=(f.balloon?8.2:7.5)/Math.sqrt(f.mass||1);if(f.down>0){f.down=0;f.tumbling=true;f.visual=null;}
          if(f.balloon)f.balloon.squashV-=3.2;
          w.emit('ventLaunch',{by:f.id,x:vent.x,z:vent.z});
        }
        for(const p of y.props){
          if(p.broken||p.heldBy||p.pulledBy||p.anchored||!p.mass||p.type==='debris'||p.y>p.hy+.2||p.vy>1||!inside(p.x,p.z)||w.time-(vent.last[p.id]??-10)<1.1)continue;
          vent.last[p.id]=w.time;p.sleep=false;p.settle=0;p.vy=7.4*Math.sqrt(5/Math.max(3,p.mass));p.wx+=1.5;this.arm(p);w.emit('ventProp',{prop:p.name,x:vent.x,z:vent.z});
        }
      }
    }
    snapshot(){return {power:this.power,waterways:this.waterways.length,belts:this.belts.length,vents:this.vents.map(v=>({id:v.id,phase:this.world.hazards&&this.power?this.phase(v):'off'})),panel:this.nearest(this.world.player)};}
  }
  const API={Gadgets};root.CombatGadgets=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
