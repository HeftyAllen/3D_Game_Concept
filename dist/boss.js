/* Rook is a finite, interruptible encounter over the shared fighter simulation. */
(function(root){
'use strict';
const CLAMP=(v,a,b)=>Math.max(a,Math.min(b,v));
const PATTERNS=[{id:'stomp',name:'Kiln quake',hint:'Jump or leave the ring',windup:1.15,radius:2.65,damage:22},{id:'fissure',name:'Fault line',hint:'Move sideways out of the strip',windup:1.05,range:5.8,width:.72,damage:25},{id:'flare',name:'Furnace fan',hint:'Get behind Rook, evade, or use cover',windup:1.25,range:4.4,angle:.64,damage:27}];
class BossEncounter{
 constructor(world){this.world=world;this.active=false;this.phase='idle';this.transition=false;this.result=null;this.tell=null;}
 start(){const w=this.world;if(w.run?.active)return false;this.transition=true;this.active=true;this.phase='fighting';this.result=null;this.tell=null;this.stage=1;this.sequence=0;this.next=w.time+2.2;this.recoverUntil=0;this.started=w.time;this.longest=0;this.damageTaken=0;this.interrupts=0;this.phasesSeen=[1];w.mode='sparring';w.arenaId='foundry';w.infinite=false;w.reset();this.transition=false;
 const f=w.enemy;Object.assign(f,{name:'Rook · Kiln Warden',variant:'warden',mass:1.4,bulk:1.22,pace:.92,shirt:[.25,.29,.28],accent:[1,.51,.20],style:'wrestler',boss:true});f.maxHealth=f.health=({beginner:360,relaxed:440,standard:540,relentless:650})[w.difficulty]||440;Object.assign(w.player,{x:0,z:2.35});Object.assign(f,{x:0,z:-2.1});w.face(f,w.player);w.face(w.player,f);this.health=w.player.health;w.contacts.sync();w.emit('bossStart',{name:f.name});return true;
 }
 cancel(){this.active=false;this.phase='idle';this.tell=null;this.result=null;}
 blocked(){return this.active&&this.phase==='results';}
 onEvent(e){if(!this.active||this.transition||this.phase!=='fighting')return;const w=this.world;
 if((e.type==='connect'||e.type==='envHit')&&e.target===w.enemy.id){this.longest=Math.max(this.longest,w.player.hits);if(this.tell&&e.damage>0)this.interrupt('Hit interrupted the wind-up');}
 if(e.type==='ko')this.finish('victory');if(e.type==='defeat')this.finish('defeat');
 }
 interrupt(reason){if(!this.tell)return;this.tell=null;this.interrupts++;this.recoverUntil=this.world.time+.8;this.next=this.world.time+1.8;this.world.emit('bossInterrupt',{text:reason});}
 finish(reason){if(this.phase==='results')return;const w=this.world;this.capture();this.tell=null;this.phase='results';this.result={reason,seconds:Math.round((w.time-this.started)*10)/10,longest:this.longest,damageTaken:Math.round(this.damageTaken),interrupts:this.interrupts,phase:this.stage,difficulty:w.difficulty};w.respawn=0;w.player.buffer=[];w.enemy.buffer=[];w.input={x:0,z:0};w.power.cancel();w.emit('bossResult',{result:this.result});}
 capture(){const hp=this.world.player.health;if(hp<this.health)this.damageTaken+=this.health-hp;this.health=hp;}
 telegraph(pattern){const w=this.world,e=w.enemy,p=w.player,angle=Math.atan2(p.x-e.x,p.z-e.z),factor=({beginner:1.28,relaxed:1.14,standard:1,relentless:.9})[w.difficulty]||1;this.tell={...pattern,x:e.x,z:e.z,angle,at:w.time,until:w.time+pattern.windup*factor};e.angle=angle;e.guard=false;e.moving=0;e.buffer=[];e.chain='';e.intent=pattern.name+' · '+pattern.hint;w.emit('bossTell',{name:pattern.name,hint:pattern.hint,by:e.id});}
 contains(t,p){const dx=p.x-t.x,dz=p.z-t.z,d=Math.hypot(dx,dz),along=dx*Math.sin(t.angle)+dz*Math.cos(t.angle),side=dx*Math.cos(t.angle)-dz*Math.sin(t.angle);
 if(t.id==='stomp')return d<t.radius&&p.y<.65;
 if(t.id==='fissure')return along>-.4&&along<t.range&&Math.abs(side)<t.width&&p.y<.85;
 return d<t.range&&Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-t.angle),Math.cos(Math.atan2(dx,dz)-t.angle)))<t.angleWidth;
 }
 resolve(){const w=this.world,e=w.enemy,p=w.player,t=this.tell;if(!t)return;this.tell=null;const dodging=p.dodge&&p.dodge.t<.28,safe=p.ko||p.held||w.grapple||p.cover&&t.id!=='stomp'||w.yard.lineBlocked({x:t.x,y:0,z:t.z},p,t.id==='stomp'?.3:1.2);if(!dodging&&!safe&&this.contains({...t,angleWidth:t.id==='flare'?.64:0},p))w.environmentHit(p,{source:e,damage:t.damage+(this.stage-1)*2,kind:t.id==='flare'?'fire':'earth',dir:[p.x-t.x,0,p.z-t.z],name:t.name,speed:5});
 w.elements.effect(t.id==='flare'?'ember':'quake',t.x,.12,t.z,2,.55);w.emit('bossBurst',{by:e.id,name:t.name,element:t.id==='flare'?'fire':'earth',x:t.x,z:t.z});this.recoverUntil=w.time+(this.stage===3?1.05:1.4);this.next=this.recoverUntil+1.2;e.guard=false;e.intent='OPEN · punish the recovery';
 }
 update(dt){const w=this.world,e=w.enemy,p=w.player;if(!this.active||this.phase!=='fighting')return;this.capture();this.longest=Math.max(this.longest,p.hits);w.respawn=0;const stage=e.health/e.maxHealth<=.3?3:e.health/e.maxHealth<=.65?2:1;
 if(stage>this.stage){this.stage=stage;this.phasesSeen.push(stage);this.next=Math.max(this.next,w.time+.85);w.emit('bossPhase',{stage,name:stage===2?'Fault & flame':'Kiln overload'});}
 if(e.ko||p.ko)return;
 if(w.grapple?.owner===e){if(w.grapple.phase==='clinch'&&!e.action)w.start(e,p,'G');return;}
 if(e.held||e.down>0||e.stunned>0||e.y>.25||w.grapple||w.ground?.mounted){if(this.tell)this.interrupt('Control broke the wind-up');e.moving=0;e.guard=false;return;}
 if(this.tell){e.moving=0;e.guard=false;if(w.time>=this.tell.until)this.resolve();return;}
 if(w.time<this.recoverUntil){e.moving=0;e.guard=false;e.intent='OPEN · punish the recovery';return;}
 if(p.down>.08||p.held){e.moving=0;e.guard=false;e.intent='Giving you recovery space';return;}
 const brain=w.opponent,d=Math.hypot(p.x-e.x,p.z-e.z);
 if(e.action){e.moving=0;e.intent='Close-range combination';if(e.action.t>=e.action.move.cancel&&!e.buffer.length&&this.plan?.length)e.buffer.push({token:this.plan.shift(),until:w.time+1.5});return;}
 if(w.time>=this.next){const turn=this.sequence++;if(turn%2===0){const list=this.stage===1?[0]:this.stage===2?[0,1]:[0,1,2],pattern=PATTERNS[list[Math.floor(turn/2)%list.length]];if(d<(pattern.range||pattern.radius)+1.6){this.telegraph(pattern);return;}}
 if(d<2.25&&!w.yard.lineBlocked(e,p,1.3)){const plan=(this.stage===3?['PKH','KPU','PG']:['PK','KP','HP'])[Math.floor(turn/2)%3];this.plan=plan.split('');const token=this.plan.shift();w.start(e,p,token);this.next=w.time+2.2;return;}this.next=w.time+.6;}
 e.guard=false;const target=d>2.1?[p.x-e.x,p.z-e.z]:[p.z-e.z,-(p.x-e.x)];brain.move(...target,d>2.1?1.85:1.1,dt,p);e.intent=d>2.1?'Closing the gap':'Watching your rhythm';
 }
 snapshot(){return {active:this.active,phase:this.phase,stage:this.stage||0,name:'Rook · Kiln Warden',tell:this.tell?{...this.tell,remaining:Math.max(0,this.tell.until-this.world.time)}:null,open:this.active&&this.world.time<this.recoverUntil,result:this.result};}
}
function draw(r){const b=r.world.boss,t=b?.tell;if(!b?.active||!t)return;const progress=CLAMP((r.world.time-t.at)/(t.until-t.at),0,1),color=t.id==='flare'?[1,.40,.18]:[1,.74,.29],alpha=.26+progress*.35;
 for(const side of ['L','R']){const p=r.rigs[r.world.enemy.id]?.pts['hand'+side];if(p)r.shape('sphere',[p[0],p[1]+.08,p[2]],[.12+progress*.06,.12+progress*.06,.12+progress*.06],color,0,.6,.8);}
 if(t.id==='stomp'){r.shape('ring',[t.x,.065,t.z],[t.radius,1,t.radius],color,0,alpha,.7);r.shape('ring',[t.x,.07,t.z],[t.radius*progress,1,t.radius*progress],color,0,alpha,.6);}
 else if(t.id==='fissure'){const x=t.x+Math.sin(t.angle)*t.range/2,z=t.z+Math.cos(t.angle)*t.range/2;r.shape('cube',[x,.055,z],[t.width*2,.025,t.range],color,t.angle,alpha,.6);}
 else{for(let i=-4;i<=4;i++){const a=t.angle+i*.16;r.bone([t.x,.06,t.z],[t.x+Math.sin(a)*t.range,.06,t.z+Math.cos(a)*t.range],.028,color,'cylinder');}r.shape('ring',[t.x,.055,t.z],[.45,1,.45],color,0,alpha,.6);}
}
root.CombatBoss={BossEncounter,PATTERNS,draw};if(typeof module!=='undefined')module.exports=root.CombatBoss;
})(typeof window!=='undefined'?window:globalThis);
