/* Trials score actual contact events. Best times stay on this browser. */
(function(root){
  'use strict';
  const DEFINITIONS={
    glass:{name:'Glass crash',seconds:60,steps:['Break the glass','Connect 3 hits'],counts:[1,3],hint:'Manual: L → L, then J / K. Easy / Mixed: tap J through the glass into a combo.'},
    cargo:{name:'Cargo bowling',seconds:60,steps:['Land a cart or cargo hit'],counts:[1],hint:'Face the cargo lane. H or the wind buttons push cargo; C + J bowls through it.'},
    vent:{name:'Vent flight',seconds:60,steps:['Ride an air vent','Connect 2 air hits'],counts:[1,2],hint:'Wait for amber → blue, then J / K as both partners lift. Easy combos works too.'},
    rebound:{name:'Rebound follow-up',seconds:60,steps:['Bounce the partner off the pad','Connect an air hit'],counts:[1,1],hint:'Manual: L → K, then J after the bounce. Easy / Mixed: keep tapping J.'}
  };
  class Trials{
    constructor(world){this.world=world;this.run=null;this.lastId='glass';this.settingUp=false;this.best={};}
    load(records){if(!records||typeof records!=='object')return;for(const [k,v] of Object.entries(records))if(/^(glass|cargo|vent|rebound):(manual|easy:(mixed|wind|wrestling|fusion))$/.test(k)&&Number.isFinite(v)&&v>0&&v<=60)this.best[k]=v;}
    reset(){if(!this.settingUp)this.run=null;}
    cancel(){if(!this.run)return false;this.run=null;this.world.emit('trialStop');return true;}
    start(id){
      if(!DEFINITIONS[id])return false;const w=this.world;this.run=null;this.settingUp=true;
      w.mode='practice';w.dummy='passive';w.infinite=true;w.arenaId='foundry';w.practiceSpeed=1;w.hazards=true;w.reset();this.settingUp=false;
      const y=w.yard,p=w.player,e=w.enemy;
      e.maxHealth=e.health=600;
      if(id==='glass'){
        y.props=y.props.filter(q=>q.type!=='glass');y.props.push(y.make('glass',0,1.0));p.x=0;p.z=2.15;e.x=0;e.z=.35;
      }else if(id==='cargo'){
        y.props=y.props.filter(q=>!(Math.abs(q.x-4.35)<1&&Math.abs(q.z)<3));y.props.push(y.make('cart',4.35,1.4));p.x=4.35;p.z=3.35;e.x=4.35;e.z=-.45;
      }else if(id==='vent'){
        const v=y.gadgets.vents[0];v.offset=v.period-.5-w.time;p.x=v.x+.22;p.z=v.z-.1;e.x=v.x-.22;e.z=v.z+.5;
      }else{
        y.props=y.props.filter(q=>q.type!=='bumper');y.props.push(y.make('bumper',0,-3.0));p.x=0;p.z=-.45;e.x=0;e.z=-1.95;
      }
      w.face(p,e);w.face(e,p);y.previous={};y.rebuild();
      const mode=w.assistMode==='easy'?'easy:'+w.assistStyle:'manual';this.lastId=id;this.run={id,status:'running',at:w.time,elapsed:0,left:60,mode,key:id+':'+mode,broken:false,hits:0,launched:false,air:0,bounced:false,cargo:false};
      w.emit('trialStart',{id,...DEFINITIONS[id]});return true;
    }
    onEvent(event){
      const r=this.run,w=this.world;if(!r||r.status!=='running')return;
      if(event.type==='propBreak'&&event.propType==='glass'&&event.by==='player')r.broken=true;
      if(event.type==='hit'&&r.broken&&event.damage>0)r.hits++;
      if(event.type==='envHit'&&event.by==='player'&&event.target!=='player'&&event.kind==='prop'&&['cart','crate','barrel'].includes(event.propType))r.cargo=true;
      if(event.type==='ventLaunch'&&event.by==='player'){r.launched=true;r.launchAt=w.time;}
      if(event.type==='bumperBounce'&&event.by==='player'&&event.target!=='player'){r.bounced=true;r.bounceAt=w.time;}
      if(event.type==='hit'&&event.air&&w.player.y>.12){if(r.id==='vent'&&r.launched&&w.time-r.launchAt<3||r.id==='rebound'&&r.bounced&&w.time-r.bounceAt<3)r.air++;}
      const done=r.id==='glass'?r.broken&&r.hits>=3:r.id==='cargo'?r.cargo:r.id==='vent'?r.launched&&r.air>=2:r.bounced&&r.air>=1;
      if(done)this.finish('complete');
      else if(event.type==='ko'||event.type==='defeat'){w.respawn=0;this.finish('failed');}
    }
    finish(status){
      const r=this.run;if(!r||r.status!=='running')return;r.elapsed=Math.max(.01,this.world.time-r.at);r.status=status;r.left=Math.max(0,60-r.elapsed);r.newBest=false;
      if(status==='complete'&&(!this.best[r.key]||r.elapsed<this.best[r.key])){this.best[r.key]=r.elapsed;r.newBest=true;}
      this.world.player.buffer=[];this.world.emit('trialFinish',{id:r.id,status,elapsed:r.elapsed,best:this.best[r.key]||null,newBest:r.newBest,mode:r.mode});
    }
    step(){const r=this.run;if(!r||r.status!=='running')return;r.elapsed=this.world.time-r.at;r.left=Math.max(0,60-r.elapsed);if(r.left<=0)this.finish('timeout');}
    snapshot(){
      const r=this.run;if(!r)return null;const progress=r.id==='glass'?[r.broken,Math.min(3,r.hits)]:r.id==='cargo'?[r.cargo]:r.id==='vent'?[r.launched,Math.min(2,r.air)]:[r.bounced,Math.min(1,r.air)];
      return {...r,progress,name:DEFINITIONS[r.id].name,steps:DEFINITIONS[r.id].steps,counts:DEFINITIONS[r.id].counts,best:this.best[r.key]||null};
    }
  }
  const API={Trials,DEFINITIONS};root.CombatTrials=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
