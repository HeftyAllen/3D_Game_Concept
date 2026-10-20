/* Five-wave runs keep real combat events, health and choices between encounters. */
(function(root){
  'use strict';
  const ENV=new Set(['wall','table','barrier','prop','body','bumper']);
  const CHOICES=[{id:'heal',name:'Catch your breath',note:'Recover up to 50 health.'},{id:'air',name:'Air rhythm',note:'Longer lifts and lighter air-combo stamina costs.'},{id:'wind',name:'Wind control',note:'Wider gusts and lower wind focus costs.'},{id:'balloon',name:'Balloon handling',note:'Sharper steering, stronger brakes, cheaper bursts.'}];
  class WaveRun{
    constructor(world){this.world=world;this.active=false;this.phase='idle';this.result=null;this.transition=false;}
    blocked(){return this.active&&['choice','results'].includes(this.phase);}
    level(key){return this.active?(this.perks[key]||0):0;}
    start(){const w=this.world,count=this.active?this.count:w.groupCount;this.active=true;this.phase='playing';this.result=null;this.wave=1;this.totalWaves=5;this.count=count;this.difficulty=w.difficulty;this.perks={air:0,wind:0,balloon:0};this.stats={longest:0,environmentKOs:0,damageTaken:0,score:0,knockouts:0,completed:0,parries:0,unique:new Set(),families:new Set(),repeats:{},recent:[]};this.started=w.time;this.loadWave(140);w.emit('runStart');return true;}
    loadWave(health){const w=this.world;this.transition=true;w.mode='group';w.groupBehavior='live';w.groupCount=this.wave===1?2:this.count;w.infinite=false;w.difficulty=this.difficulty;w.reset();w.round=this.wave;w.player.health=Math.min(w.player.maxHealth,health);this.previousHealth=w.player.health;w.enemies.forEach((f,i)=>{const variant=root.CombatOpponent.VARIANTS[f.variant];f.maxHealth=f.health=Math.round((90+this.wave*18)*(variant?.health||1));if(this.wave>=3&&i===2)f.style='elastic';if(this.wave>=4&&i===1)f.style='scavenger';});this.phase='playing';this.transition=false;w.emit('runWave',{wave:this.wave,total:this.totalWaves});}
    captureDamage(){const health=this.world.player.health;if(Number.isFinite(this.previousHealth)&&health<this.previousHealth)this.stats.damageTaken+=this.previousHealth-health;this.previousHealth=health;}
    onEvent(e){if(!this.active||this.transition||!['playing','clearing'].includes(this.phase))return;this.captureDamage();const s=this.stats;
      if((e.type==='connect'||e.type==='envHit'&&e.by==='player'&&e.target!=='player')&&e.damage>0){
        const m=root.CombatLab.MOVES[e.id]||{},tags=[];if(e.type==='envHit')tags.push(ENV.has(e.kind)?'Environment':e.kind==='wind'?'Wind':e.kind==='lightning'?'Lightning':e.kind==='earth'?'Earth':e.kind==='fire'||e.kind==='burn'?'Fire':e.kind==='water'||e.kind==='steam'?'Water':e.kind==='fusion'?'Fusion':['balloon','belly'].includes(e.kind)?'Balloon':'Objects');
        else{if(e.air)tags.push('Air');if(e.wind)tags.push('Wind');if(e.lightning)tags.push('Lightning');if(e.element)tags.push(e.element);if(e.elastic)tags.push('Stretch');if(e.weapon||e.ranged)tags.push('Weapons');if(m.throwType||m.grab)tags.push('Wrestling');if(e.ground)tags.push('Ground');if(!tags.length)tags.push(/kick|knee|sweep|heel|crescent/i.test(m.pose||e.move)?'Kicks':'Hands');}
        const count=s.repeats[e.move]||0;s.repeats[e.move]=count+1;s.unique.add(e.move);let novelty=0;for(const tag of tags)if(!s.families.has(tag)){s.families.add(tag);novelty+=32;}const fresh=!s.recent.includes(e.move);s.score+=Math.max(.5,14/(1+count*.65))+(fresh?6:0)+novelty;s.recent.push(e.move);s.recent=s.recent.slice(-8);s.longest=Math.max(s.longest,e.hits||this.world.player.hits);
      }
      if(e.type==='parry'){s.parries++;s.score+=12;}
      if(e.type==='powerLink'&&e.by==='player'){s.links??=new Set();if(!s.links.has(e.name)){s.links.add(e.name);s.families.add('Fusion');s.score+=24;}}
      if(e.type==='fighterKO'&&e.target!=='player'&&e.by==='player'){s.knockouts++;if(e.environmental){s.environmentKOs++;s.score+=65;}}
      if(e.type==='ko'&&this.phase==='playing'){this.phase='clearing';this.clearAt=this.world.time+.85;this.world.respawn=0;s.completed=this.wave;}
      if(e.type==='defeat')this.finish('defeat');
    }
    choices(){return CHOICES.map(c=>({...c,rank:c.id==='heal'?null:this.perks[c.id],disabled:c.id==='heal'?this.world.player.health>=this.world.player.maxHealth:this.perks[c.id]>=3}));}
    choose(id){if(this.phase!=='choice'||!this.active)return false;const choice=this.choices().find(c=>c.id===id);if(!choice||choice.disabled)return false;let health=this.world.player.health;if(id==='heal')health=Math.min(this.world.player.maxHealth,health+50);else this.perks[id]++;this.wave++;this.loadWave(health);this.world.emit('runChoice',{id});return true;}
    step(){if(!this.active)return;if(['playing','clearing'].includes(this.phase))this.captureDamage();if(this.phase==='clearing'&&this.world.time>=this.clearAt){if(this.wave===this.totalWaves)this.finish('complete');else{this.phase='choice';this.world.player.action=null;this.world.player.buffer=[];this.world.input={x:0,z:0};this.world.emit('runIntermission',{wave:this.wave});}}}
    finish(reason='retired'){if(!this.active||this.phase==='results')return false;this.captureDamage();const s=this.stats,score=Math.max(0,Math.round(s.score-s.damageTaken*.35));this.result={reason,waves:s.completed,totalWaves:this.totalWaves,longestChain:s.longest,environmentKOs:s.environmentKOs,damageTaken:Math.round(s.damageTaken),styleScore:score,grade:score>=1200?'S':score>=800?'A':score>=450?'B':score>=220?'C':'D',families:[...s.families],uniqueMoves:s.unique.size,knockouts:s.knockouts,parries:s.parries,seconds:Math.round(this.world.time-this.started),perks:{...this.perks}};this.phase='results';this.world.respawn=0;this.world.input={x:0,z:0};this.world.emit('runResults',{result:this.result});return true;}
    cancel(){this.active=false;this.phase='idle';}
    snapshot(){return {active:this.active,phase:this.phase,wave:this.wave||0,total:this.totalWaves||5,perks:{...this.perks},result:this.result,health:this.world.player.health,choices:this.phase==='choice'?this.choices():[]};}
  }
  root.CombatRun={WaveRun,CHOICES,ENV};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatRun;
})(typeof window!=='undefined'?window:globalThis);
