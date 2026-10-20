/* Run dialogs and a touch-first bank of the same combat actions as the keyboard. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  class OrbitGesture{
    constructor(renderer){this.r=renderer;this.points=new Map();this.previous=null;}
    down(id,x,y){this.points.set(id,{x,y});this.previous=this.measure();}
    measure(){const p=[...this.points.values()];return p.length>1?{distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}:p[0]?{...p[0]}:null;}
    move(id,x,y){if(!this.points.has(id))return;this.points.set(id,{x,y});const now=this.measure(),old=this.previous,r=this.r;if(old&&now){if(now.distance!==undefined&&old.distance!==undefined)r.zoom=clamp(r.zoom+(old.distance-now.distance)*.025,5.5,13);else if(now.x!==undefined&&old.x!==undefined){r.yaw+=(now.x-old.x)*.008;r.cameraTilt=clamp(r.cameraTilt-(now.y-old.y)*.004,-.18,.24);}}this.previous=now;}
    up(id){this.points.delete(id);this.previous=this.measure();}
  }
  function actionLabels(w){
    const f=w.player,item=w.yard.held(f),target=w.enemy;
    if(f.held)return {P:'Held',K:'Held',H:'Held',U:'Held',G:'Held',C:'Held'};
    if(f.balloon)return {P:'Burst',K:'Bounce',H:'Belly drop',U:'Unroll / launch',G:'Unroll / grab',C:'Unroll / grip'};
    if(w.assistMode==='easy')return {P:'Auto combo',K:'Air mix',H:'Finish',U:'Launch',G:'Grab',C:'Grip switch'};
    if(w.grapple?.owner===f&&w.grapple.phase==='clinch')return {P:'Clinch strike',K:'Knee',H:'Clinch finish',U:'Lift / suplex',G:'Throw',C:'Change grip'};
    if(item)return {P:item.type==='blaster'?'Shoot':'Weapon swing',K:'Kick',H:item.type==='blaster'?'Palm strike':'Heavy swing',U:'Launch',G:'Throw item',C:'Grip switch'};
    if(!target.ko&&target.down>.08&&w.airHeight(target)<.12)return {P:'Ground strike',K:'Stomp',H:'Ground hammer',U:'Pop-up kick',G:'Stand-up clinch',C:'Mount'};
    if(w.airHeight(target)>.18&&!target.held)return {P:'Air punch',K:'Air kick',H:'Air slam',U:'Lift again',G:'Air catch',C:'Grip switch'};
    return {P:'Punch',K:'Kick',H:'Heavy',U:'Launch',G:'Grab',C:'Grip switch'};
  }
  class PlayUI{
    constructor(options){Object.assign(this,options);this.phase=null;this.lastBalloon=false;this.deck=document.querySelector('.control-deck');this.dialog=document.getElementById('run-dialog');this.gesture=this.renderer?new OrbitGesture(this.renderer):null;
      document.querySelectorAll('[data-element-tab]').forEach(b=>b.addEventListener('click',()=>this.elementBank(b.dataset.elementTab)));
      document.getElementById('element-more').addEventListener('click',()=>{this.elementPage(this.elementPageName==='more'?'core':'more');});this.elementPage('core');
      document.querySelectorAll('[data-pad-tab]').forEach(b=>b.addEventListener('click',()=>this.bank(b.dataset.padTab)));
      document.querySelectorAll('[data-utility]').forEach(b=>b.addEventListener('click',()=>this.utility(b.dataset.utility)));
      document.querySelectorAll('[data-run]').forEach(b=>b.addEventListener('click',()=>this.runAction(b.dataset.run)));
      document.querySelectorAll('[data-follow]').forEach(b=>{const follow=()=>{const choice=this.world.flow.opportunities().items[Number(b.dataset.follow)];if(choice&&!choice.disabled)this.manualAttack(choice.token,true);};b.addEventListener('pointerdown',e=>{e.preventDefault();follow();});b.addEventListener('click',e=>{if(e.detail===0)follow();});});
      document.getElementById('smart-target').addEventListener('click',()=>{this.world.smartTarget=!this.world.smartTarget;this.world.flow.focus=null;this.savePreferences();this.update();});
      document.getElementById('lightning-stage').addEventListener('click',()=>{this.awaken();this.world.lightning.stage();this.setPaused(false);this.syncMode();});
      this.dialog.addEventListener('cancel',e=>e.preventDefault());this.bank('fight');this.update();this.movementUI();
    }
    bank(name){this.deck.dataset.pad=name;document.querySelectorAll('[data-pad-tab]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.padTab===name));b.classList.toggle('selected',b.dataset.padTab===name);});document.querySelectorAll('[data-bank]').forEach(b=>b.hidden=b.dataset.bank!==name);}
    elementBank(name){document.querySelectorAll('[data-element-tab]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.elementTab===name));b.classList.toggle('selected',b.dataset.elementTab===name);});document.querySelectorAll('[data-element-panel]').forEach(p=>p.hidden=p.dataset.elementPanel!==name);}
    elementPage(name){this.elementPageName=name;document.querySelectorAll('[data-element-page]').forEach(p=>p.hidden=p.dataset.elementPage!==name);const b=document.getElementById('element-more');b.setAttribute('aria-pressed',String(name==='more'));b.textContent=name==='more'?'Core moves':'More moves';b.setAttribute('aria-label',name==='more'?'Show core elemental moves':'Show advanced elemental moves');}
    infusionUI(){const w=this.world,I=w.infusion,f=w.player,s=I.snapshot(),blocked=this.isPaused()||w.run.blocked()||w.over||f.ko,active=I.active(f),ready=I.ready(f);
      const hud=document.getElementById('infusion-hud');hud.hidden=blocked||!s.coat&&!s.primer&&!s.fusion;hud.dataset.element=s.coat?.element||s.primer?.element||'fusion';hud.dataset.ready=String(!!ready);
      document.getElementById('coating-state').textContent=s.coat?s.coat.name.toUpperCase()+' · '+s.coat.seconds.toFixed(1)+'s':s.fusion?'FUSION PRIMED':'MIX '+(s.primer?.element||'ELEMENTS').toUpperCase();
      const hint=s.fusion?s.fusion.note:s.coat?s.coat.note:s.primer?'Add a different element within '+s.primer.seconds.toFixed(1)+'s':'Coat or cast two elements, then release with 0.';
      document.getElementById('coating-note').textContent=hint;document.getElementById('coat-window').style.width=(s.coat?s.coat.seconds/10:s.fusion?s.fusion.seconds/8:(s.primer?.seconds||0)/6)*100+'%';
      document.getElementById('quick-fusion').hidden=!ready;document.getElementById('fusion-window').textContent=s.fusion?s.fusion.seconds.toFixed(1)+'s · '+s.fusion.focus+' FOCUS':'';
      const note=s.fusion?s.fusion.name+' ready · release with 0':s.primer?s.primer.element.toUpperCase()+' primed · mix a different element':hint;document.getElementById('mix-hint').textContent=note;document.getElementById('infusion-summary').textContent=s.coat?s.coat.name+' · '+note:note;
      for(const b of document.querySelectorAll('[data-coat]')){const key=b.dataset.coat;b.setAttribute('aria-pressed',String(active?.element===key));b.disabled=blocked||key==='off'?!active||blocked:I.blocked(f)||w.time-f.coatAt<.22||!w.freePlayer()&&f.windEnergy<root.CombatInfusion.COATS[key].focus;}
      for(const b of document.querySelectorAll('[data-attack="0"]')){b.querySelector('span').textContent=ready?ready.name:'Release fusion';b.disabled=blocked||f.held||f.down>.35||!ready||!w.freePlayer()&&(f.windEnergy<ready.focus||f.stamina<12);b.classList.toggle('ready',!!ready);}
      for(const b of document.querySelectorAll('[data-fusion-demo]'))b.classList.toggle('selected',ready?.id===b.dataset.fusionDemo);
    }
    utility(key){if(key==='zoom-in'||key==='zoom-out'||key==='center'){const r=this.renderer;if(!r)return;if(key==='center'){r.yaw=.43;r.cameraTilt=0;r.zoom=8.15;r.camera.reset();}else r.zoom=clamp(r.zoom+(key==='zoom-in'?-.7:.7),5.5,13);return;}
      if(this.isPaused()||this.world.run.blocked())return;this.awaken();if(key==='balloon')this.manualBalloon();if(key==='gust')this.manualGust();if(key==='target')this.world.cycleTarget();if(key==='machine')this.world.useArena();
    }
    runAction(action){this.awaken();if(action==='start'){this.clearInputs();this.setPaused(false);this.world.run.start();this.syncMode();}else if(action==='finish')this.world.run.finish();else if(action==='practice'){this.world.setMode('practice');this.syncMode();}this.update();}
    clearInputs(){this.keys.clear();this.touchMove.clear();this.clearHeld();this.world.mobility.setDuck(false);this.world.cover.clear();this.world.input={x:0,z:0};}
    showRun(){const run=this.world.run,choice=run.phase==='choice',result=run.result;let html;
      if(choice){html='<div class="eyebrow">WAVE '+run.wave+' / '+run.totalWaves+' CLEARED</div><h2 id="run-dialog-title">Take a breath. Pick your edge.</h2><p>Health carries into the next wave. Stamina and focus refill.</p><div class="run-health">'+Math.ceil(this.world.player.health)+' / '+this.world.player.maxHealth+' HEALTH</div><div class="run-choices">'+run.choices().map(c=>'<button data-choice="'+c.id+'" '+(c.disabled?'disabled':'')+'><strong>'+c.name+'</strong><span>'+c.note+'</span><small>'+(c.id==='heal'?c.disabled?'HEALTH FULL':'+'+Math.min(50,Math.ceil(this.world.player.maxHealth-this.world.player.health))+' HEALTH':c.disabled?'MAX RANK':'RANK '+c.rank+' → '+(c.rank+1))+'</small></button>').join('')+'</div><button class="run-exit" data-run="finish">End run and see results</button>';}
      else if(result){html='<div class="eyebrow">'+(result.reason==='complete'?'ALL WAVES CLEARED':result.reason==='defeat'?'RUN ENDED':'RUN RESULTS')+'</div><div class="run-result-heading"><h2 id="run-dialog-title">Your run results.</h2><span class="run-grade">'+result.grade+'</span></div><div class="run-results-grid">'+[['STYLE SCORE',result.styleScore],['LONGEST CHAIN',result.longestChain],['ENVIRONMENT KOs',result.environmentKOs],['DAMAGE TAKEN',result.damageTaken],['WAVES CLEARED',result.waves+' / '+result.totalWaves],['UNIQUE MOVES',result.uniqueMoves]].map(([label,value])=>'<div><strong>'+value+'</strong><span>'+label+'</span></div>').join('')+'</div><p class="run-variety">'+(result.families.length?'Your mix: '+result.families.join(' · '):'Mix hands, kicks, throws, powers and the environment to build your style.')+'</p><p class="run-score-note">New move families and varied attacks earn more. Repeating one move earns less. Damage taken reduces the final score.</p><div class="run-result-actions"><button data-run="start">Try another run</button><button data-run="practice">Back to practice</button></div>';}
      this.dialog.innerHTML=html||'';this.dialog.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>{if(run.choose(b.dataset.choice)){this.clearInputs();this.syncMode();this.update();}}));this.dialog.querySelectorAll('[data-run]').forEach(b=>b.addEventListener('click',()=>this.runAction(b.dataset.run)));if(!this.dialog.open)this.dialog.showModal();
    }
    update(){const w=this.world,run=w.run,blocked=run.blocked(),phase=run.active?run.phase:'idle';
      const status=document.getElementById('run-status');status.textContent=run.active?'Wave '+run.wave+' / '+run.totalWaves+' · '+Math.ceil(w.player.health)+' health · '+(phase==='clearing'?'wave clear':phase==='choice'?'choose your upgrade':phase==='results'?'results ready':'live teamwork'):'Five waves. Carry your health. Build your own mix.';
      document.querySelector('[data-run="finish"]').hidden=!run.active||phase==='results';document.querySelector('[data-run="start"]').textContent=run.active?'Restart run':'Start wave run';
      document.getElementById('touch-focus').textContent=(w.freePlayer()?'∞':Math.round(w.player.windEnergy))+' focus';
      if(phase!==this.phase){if(blocked){this.clearInputs();this.showRun();}else if(this.dialog.open)this.dialog.close();this.phase=phase;}
      if(w.player.balloon&&!this.lastBalloon)this.bank('fight');this.lastBalloon=!!w.player.balloon;
      const labels=actionLabels(w),item=w.yard.held(w.player);
      for(const b of this.deck.querySelectorAll('.attack-controls [data-attack]'))b.querySelector('span').textContent=labels[b.dataset.attack];
      document.getElementById('guard').querySelector('span').textContent=w.player.balloon?'Brake':'Block / parry';
      this.deck.querySelector('[data-utility="target"]').disabled=w.enemies.filter(e=>!e.ko).length<2||!!w.grapple||!!w.tether||w.player.held;
      this.deck.querySelector('[data-utility="machine"]').disabled=document.getElementById('machine-use').disabled;
      this.deck.querySelector('[data-attack="J"]').disabled=item?.type!=='blaster'||item.ammo>=item.capacity||!!w.player.action?.move.reload;
      const opportunity=w.flow.opportunities();document.getElementById('opportunity-title').textContent=opportunity.title;document.getElementById('opportunity-note').textContent=opportunity.note;
      document.querySelectorAll('[data-follow]').forEach(b=>{const choice=opportunity.items[Number(b.dataset.follow)];b.hidden=!choice;if(choice){b.querySelector('span').textContent=choice.label;b.querySelector('kbd').textContent=root.CombatLab.KEY[choice.token];b.title=choice.hint;b.disabled=choice.disabled||this.isPaused();}});
      const smart=document.getElementById('smart-target');smart.setAttribute('aria-pressed',String(w.smartTarget));smart.querySelector('span').textContent=w.smartTarget?'On':'Off';
      for(const [id,f]of [['player',w.player],['enemy',w.enemy]]){const meter=document.getElementById(id+'-balance'),broken=w.flow.broken(f),pressure=Math.round(f.balance||0);meter.querySelector('i').style.width=pressure+'%';meter.setAttribute('aria-valuenow',String(pressure));meter.classList.toggle('broken',broken);document.getElementById(id+'-balance-label').textContent=broken?'OPENING '+Math.max(0,f.balanceBreakUntil-w.time).toFixed(1)+'s':'BALANCE '+pressure+'%';}
    }
    movementUI(){
      const w=this.world,f=w.player,s=f.mobility,m=w.mobility,blocked=this.isPaused()||w.run.blocked()||w.over,air=f.y>.001&&!m.grounded(),eta=m.landingETA(),armed=w.time<=s.techUntil,landAge=w.time-s.landAt;
      const jump=document.getElementById('jump'),duck=document.getElementById('duck'),anchor=document.getElementById('anchor');
      document.getElementById('dodge').querySelector('span').textContent=f.held?'Resist grip':f.balloon?'Bounce':w.grapple?.owner===f||w.ground?.mounted?'Release hold':air?(f.vy<-.3?s.techAttempted?(armed?'Recovery armed':'Recovery used'):'Recover':'Air evade'):'Evade';
      jump.querySelector('span').textContent=s.anchor?'Release & rise':'Jump';jump.disabled=blocked||m.blocked()||!s.anchor&&(air||f.down>0||f.stunned>0||!!f.dodge);
      duck.disabled=(blocked||m.blocked()||air||f.down>0||f.stunned>0)&&!duck.classList.contains('held');duck.setAttribute('aria-pressed',String(s.crouch>.5));
      anchor.querySelector('span').textContent=s.anchor?'Release anchor':'Anchor';anchor.disabled=blocked||m.blocked()||!s.anchor&&(!s.candidate||!!w.yard.held(f)||f.down>0||f.stunned>0);
      anchor.title=s.anchor?'Release and carry your momentum':s.candidate?'Pull toward '+s.candidate.label.toLowerCase():'Aim toward a visible pillar or wall';
      const cover=f.cover,near=!cover&&w.cover.ready(f)&&w.cover.candidates(f).length>0,toggle=document.getElementById('cover-toggle'),coverHud=document.getElementById('cover-hud');
      toggle.disabled=blocked||!cover&&!near;toggle.setAttribute('aria-pressed',String(!!cover));toggle.querySelector('span').textContent=cover?'Leave cover':near?'Take cover':'Find cover';
      for(const b of document.querySelectorAll('[data-peek]')){const available=!!cover&&w.cover.peekable(cover,b.dataset.peek);b.disabled=blocked||!available&&!b.classList.contains('held');b.setAttribute('aria-pressed',String(cover?.peek===b.dataset.peek&&cover.exposure>.5));}
      coverHud.hidden=blocked||!cover&&!near;coverHud.dataset.exposed=String(!!cover?.peek);
      document.getElementById('cover-state').textContent=cover?cover.peek?'EXPOSED · '+(cover.peek==='up'?'POP UP':'PEEK '+cover.peek.toUpperCase()):'IN COVER · '+cover.name.toUpperCase():'COVER IN REACH';
      document.getElementById('cover-note').textContent=cover?cover.peek?'Fire with J / 4 · release Peek to duck':cover.top<=1.5?'Hold Q / Pop up to fire · Enter leaves':'Shuffle to an edge · hold Q / Peek to fire':'Enter / Take cover to attach';
      const hud=document.getElementById('mobility-hud');hud.hidden=!!cover||blocked||!!f.balloon||f.held||!!w.grapple||!(air||s.crouch>.2||s.anchor||landAge<.7);
      let label='AIR CONTROL',note='Steer · G wind · B anchor',phase='air',progress=0;
      if(s.anchor){label='STRETCH ANCHOR';note='U releases & rises · B detaches';phase='anchor';progress=clamp((w.time-s.anchor.at)/.85,0,1);}
      else if(air&&f.vy<-.3){const now=eta<=.18;label=armed?'RECOVERY ARMED':s.techAttempted?'RECOVERY TOO EARLY':now?'RECOVER NOW':'DESCENDING';note=armed?'Keep your direction for the landing':s.techAttempted?'One attempt each descent':'Tap Space just before landing';phase=armed?'armed':now&&!s.techAttempted?'ready':'fall';progress=clamp(1-eta/.6,0,1);}
      else if(s.crouch>.2){label='DUCKING';note='High strikes pass · low attacks reach';phase='duck';progress=s.crouch;}
      else if(!air&&landAge<.7){label=s.landKind==='tech'?'CLEAN RECOVERY':'LANDING';note=s.landKind==='tech'?'Move or counter · J / K / L':'Absorb the landing, then keep moving';phase=s.landKind==='tech'?'ready':'land';progress=Math.max(0,1-landAge/.7);}
      hud.dataset.phase=phase;document.getElementById('mobility-state').textContent=label;document.getElementById('mobility-note').textContent=note;document.getElementById('landing-window').style.width=progress*100+'%';
    }
  }
  root.CombatPlayUI={PlayUI,OrbitGesture,actionLabels};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatPlayUI;
})(typeof window!=='undefined'?window:globalThis);
