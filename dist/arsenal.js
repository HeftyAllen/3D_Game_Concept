/* Training weapons share combat timing. Bolts use swept contacts, never target damage on fire. */
(function(root){
  'use strict';
  const C=(v,a,b)=>Math.max(a,Math.min(b,v));
  const move=(name,pose,damage,cost,startup,duration,range,extra={})=>({name,pose,damage,cost,startup,duration,range,cancel:startup+.085,push:.18,stun:.30,lunge:.1,...extra});
  const MOVES={
    batonHit:move('Baton diagonal','baton',13,6,.13,.34,2.5,{weapon:true}),
    batonBack:move('Baton return','batonBack',16,7,.15,.37,2.5,{weapon:true,push:.22}),
    batonHeavy:move('Baton breaker','weaponHeavy',24,12,.25,.56,2.6,{weapon:true,break:true,finish:true,push:.60}),
    batonStretch:move('Elastic baton arc','weaponSwing',20,12,.23,.53,5.0,{weapon:true,elasticProp:true,push:.3}),
    staffThrust:move('Staff thrust','staffThrust',16,8,.19,.43,3.0,{weapon:true,push:.24}),
    staffSweep:move('Staff sweep','staffSweep',20,10,.23,.49,3.1,{weapon:true,push:.50,zone:'leg'}),
    staffHeavy:move('Staff overhead','staffHeavy',27,14,.30,.64,3.2,{weapon:true,break:true,finish:true,slam:true}),
    staffLift:move('Staff rising vault','staffLift',17,12,.24,.54,2.9,{weapon:true,launch:true,push:.06}),
    staffStretch:move('Telescoping staff','staffThrust',23,14,.27,.59,5.5,{weapon:true,elasticProp:true,push:.3}),
    gunShot:move('Pulse shot','gunFire',9,2,.12,.33,11,{ranged:true,lunge:0,push:.10,cancel:.27}),
    gunGale:move('Gale-charged shot','gunFire',16,7,.26,.54,11,{ranged:true,windCost:20,launch:true,lunge:0,push:.20,cancel:.46}),
    gunButt:move('Blaster palm strike','gunButt',16,7,.16,.40,1.95,{weapon:true,push:.25}),
    gunReload:move('Reload blaster','gunReload',0,0,.78,.94,0,{reload:true,lunge:0,cancel:.92})
  };
  function segmentBox(a,b,c,r=0){
    let lo=0,hi=1;for(let i=0;i<3;i++){const axis=['x','y','z'][i],h=c[['hx','hy','hz'][i]]+r,d=b[i]-a[i],min=c[axis]-h,max=c[axis]+h;
      if(Math.abs(d)<1e-8){if(a[i]<min||a[i]>max)return null;continue;}
      let x=(min-a[i])/d,y=(max-a[i])/d;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)return null;
    }return lo;
  }
  class Arsenal{
    constructor(world){this.world=world;this.bolts=[];this.serial=0;}
    choose(item,f,token){
      if(item.type==='baton')return ({P:f.lastId==='batonHit'?'batonBack':'batonHit',H:'batonHeavy',S:'batonStretch'})[token];
      if(item.type==='staff')return ({P:f.lastId==='staffThrust'?'staffSweep':'staffThrust',H:'staffHeavy',U:'staffLift',S:'staffStretch'})[token];
      if(item.type==='blaster')return ({P:'gunShot',H:'gunButt',S:'gunGale',J:'gunReload'})[token];
    }
    prepare(f,a,target){a.propId=this.world.yard.held(f)?.id;if(a.move.ranged){if(f.y>.12)a.move={...a.move,air:true};a.shotAim=this.world.locked||f.id!=='player'?[target.x,target.y+(target.down>.08?.35:1.32),target.z]:[f.x+Math.sin(f.angle)*10,f.y+1.48,f.z+Math.cos(f.angle)*10];}}
    ready(f,move){
      const p=this.world.yard.held(f);if(!move.ranged&&!move.reload)return true;
      if(p?.type!=='blaster')return false;
      if(move.reload){if(p.ammo>=p.capacity){if(f.id==='player')this.world.emit('yardNotice',{text:'The blaster is already loaded.'});return false;}return true;}
      if(p.ammo<(move.windCost?2:1)){this.world.emit('gunEmpty',{by:f.id});return false;}return true;
    }
    resolve(f,a){
      const w=this.world,p=w.yard.held(f);if(!p||p.id!==a.propId||p.type!=='blaster')return 'miss';
      if(a.move.reload){p.ammo=p.capacity;w.emit('gunReload',{by:f.id,ammo:p.ammo});return 'world';}
      const cost=a.move.windCost?2:1;if(p.ammo<cost)return 'miss';p.ammo-=cost;
      const origin=root.CombatContact.muzzle(w,f,.24),delta=a.shotAim.map((v,i)=>v-origin[i]),len=Math.hypot(...delta)||1;
      const dir=delta.map(v=>v/len),bolt={id:++this.serial,pos:origin,velocity:dir.map(v=>v*27),life:.65,by:f.id,action:{...a,move:{...a.move}},charged:!!a.move.windCost,bounces:0};
      this.bolts.push(bolt);if(this.bolts.length>24)this.bolts.shift();w.emit('gunShot',{by:f.id,charged:bolt.charged,ammo:p.ammo,x:origin[0],y:origin[1],z:origin[2],direction:dir});return 'projectile';
    }
    impact(bolt,hit,point){
      const w=this.world,source=w.getFighter(bolt.by),f=hit.f;
      if(!f){if(hit.c.prop)w.yard.damage(hit.c.prop,bolt.charged?28:12,source,{x:bolt.velocity[0]*.11,y:bolt.charged?2:.4,z:bolt.velocity[2]*.11});w.emit('shotImpact',{x:point[0],y:point[1],z:point[2],cover:true,charged:bolt.charged});return false;}
      if(f.guard&&!f.action&&w.time-f.guardAt<.17&&f.stamina>=6&&bolt.bounces<1){
        f.stamina-=6;if(f.id==='player')w.parries++;bolt.by=f.id;bolt.bounces++;const target=source?[source.x,source.y+1.3,source.z]:point.map((v,i)=>v-bolt.velocity[i]),d=target.map((v,i)=>v-point[i]),n=Math.hypot(...d)||1;bolt.velocity=d.map(v=>v/n*27);bolt.pos=point.map((v,i)=>v+bolt.velocity[i]/27*.18);bolt.life=.65;bolt.action={...bolt.action,chain:'',connected:false,move:{...bolt.action.move,name:'Reflected pulse'}};w.emit('shotParry',{by:f.id,x:point[0],y:point[1],z:point[2]});return true;
      }
      const guarded=f.guard&&!f.action,m=bolt.action.move,damage=guarded?Math.max(2,Math.round(m.damage*.3)):m.damage,dir=[bolt.velocity[0],0,bolt.velocity[2]];
      if(guarded){f.stamina=Math.max(0,f.stamina-10);f.regenAt=w.time+.8;w.emit('shotBlock',{by:f.id,x:point[0],y:point[1],z:point[2]});}
      const balloon=!!f.balloon;
      if(w.environmentHit(f,{source,damage,kind:'shot',dir,speed:2.5,connection:guarded||balloon?null:bolt.action,name:m.name,difficultyApplied:true})&&!guarded&&!balloon){
        f.stunned=Math.max(f.stunned,.32);
        if(bolt.charged){f.down=0;f.visual=null;f.recovery=null;f.y=Math.max(f.y,.05);f.vy=5.6/Math.sqrt(f.mass||1);f.tumbling=true;f.airJuggles++;if(f.impact)f.impact.launch=true;}
        else if(f.y>.2){f.vy=Math.max(f.vy,2.2);f.airJuggles++;}
      }
      w.emit('shotImpact',{by:bolt.by,target:f.id,x:point[0],y:point[1],z:point[2],charged:bolt.charged});return false;
    }
    step(dt){
      const w=this.world;
      for(const bolt of this.bolts){
        bolt.life-=dt;if(bolt.life<=0)continue;const from=bolt.pos,to=from.map((v,i)=>v+bolt.velocity[i]*dt),source=w.getFighter(bolt.by);if(!source){bolt.life=0;continue;}
        let hit=null;
        const consider=(t,data)=>{if(t!==null&&(!hit||t<hit.t))hit={t,...data};};
        for(const c of w.yard.solids)consider(segmentBox(from,to,c,.045),{c});
        for(const f of w.targetsFor(source)){if(f.ko||f.held||w.grapple?.owner===f||f.dodge&&f.dodge.t<.24)continue;consider(root.CombatContact.projectile(w,f,from,to,.045),{f});}
        if(hit){const point=from.map((v,i)=>v+(to[i]-v)*hit.t);if(!this.impact(bolt,hit,point))bolt.life=0;}else bolt.pos=to;
      }
      this.bolts=this.bolts.filter(b=>b.life>0);
    }
    stage(type){
      if(!['baton','staff','blaster'].includes(type))return false;const w=this.world;w.mode='practice';w.dummy='passive';w.infinite=true;w.reset();
      w.player.x=0;w.player.z=1.8;w.enemy.x=0;w.enemy.z=type==='blaster'?-2.6:.1;w.enemy.health=w.enemy.maxHealth=1000;w.face(w.player,w.enemy);w.face(w.enemy,w.player);
      const p=w.yard.props.find(p=>p.type===type);p.x=.2;p.z=1;p.y=p.hy;w.yard.rebuild();w.yard.pickup(w.player,p);w.emit('weaponLab',{weapon:type});return true;
    }
  }
  root.CombatArsenal={Arsenal,MOVES,segmentBox};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatArsenal;
})(typeof window!=='undefined'?window:globalThis);
