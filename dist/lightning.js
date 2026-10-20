/* Lightning captures its aim at wind-up, then chains only through real open contacts. */
(function(root){
  'use strict';
  const {segmentBox}=root.CombatArsenal||(typeof require==='function'?require('./arsenal.js'):null);
  const L=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),pos=f=>[f.x,f.y+1.15,f.z];
  class Lightning{
    constructor(world){this.world=world;this.traces=[];this.sequence=0;}
    open(a,b){return !this.world.yard.solids.some(c=>segmentBox([a.x,a.y+1.15,a.z],[b.x,b.y+1.15,b.z],c,.02)!==null);}
    prepare(f,a){a.arcAim={x:f.x,z:f.z,y:f.y,dx:Math.sin(f.angle),dz:Math.cos(f.angle)};}
    trace(a,b,mode){this.traces.push({from:a,to:b,life:mode==='clap'?.30:.22,max:mode==='clap'?.30:.22,seed:++this.sequence,mode});this.traces=this.traces.slice(-32);}
    resolve(f,a){const w=this.world,m=a.move,aim=a.arcAim,origin={x:aim.x,y:aim.y,z:aim.z},mode=m.lightning,visited=new Set();let hits=0;
      const valid=t=>!t.ko&&!t.held&&!(t.dodge&&t.dodge.t<.24)&&this.open(origin,t)&&Math.abs(t.y-aim.y)<(mode==='clap'?4.4:3.6);
      let targets=w.targetsFor(f).filter(valid);
      if(mode==='clap')targets=targets.filter(t=>L(origin,t)<2.35).sort((a,b)=>L(origin,a)-L(origin,b));
      else targets=targets.filter(t=>{const x=t.x-aim.x,z=t.z-aim.z,forward=x*aim.dx+z*aim.dz;return forward>0&&forward<m.range&&Math.abs(x*aim.dz-z*aim.dx)<.48+forward*.075;}).sort((a,b)=>L(origin,a)-L(origin,b)).slice(0,1);
      let previous=pos(f),cursor=targets[0];const queue=mode==='clap'?targets:cursor?[cursor]:[];
      for(let i=0;i<queue.length&&i<(mode==='arc'?3:mode==='clap'?4:1);i++){
        const target=queue[i];if(visited.has(target.id))continue;visited.add(target.id);const guard=target.guard,bonus=w.flow.electricBonus(f,target,guard),damage=Math.max(1,Math.round((m.damage*(mode==='arc'?Math.pow(.62,i):1)+bonus)*(guard?.35:1)));
        if(!w.environmentHit(target,{source:f,damage,kind:'lightning',dir:[aim.dx,0,aim.dz],speed:1.8,connection:a,name:m.name}))continue;
        w.flow.electricHit(f,target,a,bonus,guard);if(!guard)w.infusion?.contact(f,target,a,'lightning');
        this.trace(mode==='clap'?pos(f):previous,pos(target),mode);previous=pos(target);hits++;
        if(!guard){target.stunned=Math.max(target.stunned,mode==='clap'?.55:.36);if(mode==='lift'){target.down=0;target.visual=null;target.recovery=null;target.y=Math.max(.06,target.y);target.vy=6.3/Math.sqrt(target.mass||1);target.tumbling=true;target.airJuggles++;if(target.impact)target.impact.launch=true;}else if(mode==='clap'){target.down=1.2;target.downAt=w.time;target.vy=target.y>.1?-7:0;target.tumbling=true;if(target.impact)target.impact.slam=true;}else if(target.y>.2)target.vy=Math.max(target.vy,2.6);}
        if(mode==='arc'){const next=w.targetsFor(f).filter(t=>!visited.has(t.id)&&!t.held&&!(t.dodge&&t.dodge.t<.24)&&L(target,t)<2.15&&Math.abs(target.y-t.y)<2.5&&this.open(target,t)).sort((a,b)=>L(target,a)-L(target,b))[0];if(next)queue.push(next);}
      }
      if(!hits){const from=pos(f),to=[aim.x+aim.dx*m.range,aim.y+1.15,aim.z+aim.dz*m.range];let contact=1;for(const c of w.yard.solids){const hit=segmentBox(from,to,c,.02);if(hit!==null)contact=Math.min(contact,hit);}this.trace(from,to.map((v,i)=>from[i]+(v-from[i])*Math.max(0,contact-.002)),mode);w.emit('whiff',{move:m.name});}
      w.emit('lightningCast',{mode,hits,name:m.name});return hits?'hit':'miss';
    }
    step(dt){for(const p of this.traces)p.life-=dt;this.traces=this.traces.filter(p=>p.life>0);}
    stage(){const w=this.world;w.mode='group';w.groupCount=3;w.groupBehavior='passive';w.infinite=true;w.reset();w.player.x=0;w.player.z=2;w.player.angle=Math.PI;w.enemies.forEach((f,i)=>{f.x=(i-1)*.85;f.z=-.6-Math.abs(i-1)*.2;w.face(f,w.player);});w.enemy=w.enemies[1];w.opponent=w.controllers[w.enemy.id];w.emit('target',{id:w.enemy.id,name:w.enemy.name});w.emit('lightningSetup');}
  }
  root.CombatLightning={Lightning};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatLightning;
})(typeof window!=='undefined'?window:globalThis);
