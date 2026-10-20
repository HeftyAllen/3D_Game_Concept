/* One attack lane, moving flankers, and a visible, interruptible rescue attempt. */
(function(root){
  'use strict';
  const L=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  class EnemyTeam{
    constructor(world){this.world=world;this.lead=null;this.rescuer=null;this.hold=null;this.nextRescue=-10;}
    active(){const w=this.world;return w.isGroup()&&w.isLive()&&!w.over&&!w.run?.blocked();}
    step(){const w=this.world;if(!this.active())return;
      const g=w.grapple,eligible=w.enemies.filter(f=>!f.ko&&!f.held&&f.down<=0&&f.stunned<=0&&f.y<.2&&f.stamina>18);
      this.lead=w.attackOwner||eligible.sort((a,b)=>(a.id===w.lastAttackOwner?3:0)+L(a,w.player)-(b.id===w.lastAttackOwner?3:0)-L(b,w.player))[0]?.id;
      if(g?.owner===w.player&&g.phase==='clinch'){
        if(this.hold!==g){this.hold=g;this.rescuer=null;this.readyAt=w.time+.8+root.CombatOpponent.LEVELS[w.difficulty].reaction;this.telegraphed=false;}
        if(this.rescuer&&!eligible.some(f=>f.id===this.rescuer))this.rescuer=null;
        if(!this.rescuer&&w.time>=this.nextRescue)this.rescuer=eligible.filter(f=>f!==g.target&&!f.action&&!f.dodge).sort((a,b)=>L(a,w.player)-L(b,w.player))[0]?.id||null;
      }else{for(const f of w.enemies)if(f.rescueFor){if(f.action&&!f.action.hit){f.action=null;f.buffer=[];}f.rescueFor=null;}this.hold=null;this.rescuer=null;}
      for(const f of w.enemies)if(f.rescueFor&&w.time>(f.rescueUntil||0)){f.rescueFor=null;this.nextRescue=w.time+3.5;}
    }
    canRescue(f){return this.active()&&this.hold===this.world.grapple&&this.world.grapple?.phase==='clinch'&&this.rescuer===f.id;}
    control(brain,dt){const w=this.world,e=brain.fighter,p=w.player,s=brain.state;if(!this.active()||e.action||e.dodge||e.stamina<24)return false;
      const g=w.grapple||w.tether,d=L(e,p);
      if(g&&g.owner!==e&&g.target!==e){
        s.plan=[];e.guard=false;
        if(this.canRescue(e)){
          brain.intent(w.time<this.readyAt?'watching the hold':'rescuing teammate');
          if(d>1.85){brain.move(p.x-e.x,p.z-e.z,brain.style().pace*brain.level().pace,dt,p);return true;}
          e.moving=0;
          if(w.time>=this.readyAt&&!this.telegraphed){this.telegraphed=true;this.readyAt=w.time+.38;w.emit('rescueTell',{by:e.id,target:g.target.id});return true;}
          if(this.telegraphed&&w.time>=this.readyAt&&!e.rescueFor&&w.requestAttack(e)){s.plan=[];s.stringHits=0;e.rescueFor=g.target.id;e.rescueUntil=w.time+1.1;w.start(e,p,'K');this.nextRescue=w.time+4;}
        }else{e.moving=0;brain.intent('giving space');}
        return true;
      }
      if(e.id===this.lead||s.object)return false;
      const held=w.yard.held(e);
      if(!held&&w.time>=s.decideAt&&d>1.5){s.decideAt=w.time+1.8;const prop=w.yard.props.filter(q=>q.mass>0&&q.carry!==false&&!q.anchored&&q.type!=='debris'&&!q.broken&&!q.heldBy&&!q.pulledBy&&L(e,q)<2.6&&w.yard.clearPath(e,q)).sort((a,b)=>L(e,a)-L(e,b))[0];if(prop){s.object=prop.id;return false;}}
      const index=w.enemies.indexOf(e),angle=p.angle+(index%2?-1:1)*(1.7+index*.18),radius=held?.type==='blaster'?4:2.85,goal={x:clamp(p.x+Math.sin(angle)*radius,-5.2,5.2),y:0,z:clamp(p.z+Math.cos(angle)*radius,-4.8,4.8)};
      brain.intent(held?'covering with an object':'flanking');if(L(e,goal)>.22)brain.move(goal.x-e.x,goal.z-e.z,brain.style().pace*brain.level().pace*.85,dt,p);else{e.moving=0;w.face(e,p,1-Math.exp(-8*dt));}return true;
    }
    onEvent(e){if(e.type!=='hurt'||e.damage<=0)return;const w=this.world,g=w.grapple,f=w.getFighter(e.by);if(!f?.rescueFor||g?.owner!==w.player||g.phase!=='clinch'||g.target.id!==f.rescueFor)return;
      const rescued=g.target;w.releaseGrip('teammate rescue');w.player.action=null;w.player.buffer=[];rescued.stunned=Math.max(rescued.stunned,.4);f.rescueFor=null;this.rescuer=null;this.hold=null;this.nextRescue=w.time+4;w.emit('teamRescue',{by:f.id,target:rescued.id});
    }
  }
  root.CombatTeam={EnemyTeam};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatTeam;
})(typeof window!=='undefined'?window:globalThis);
