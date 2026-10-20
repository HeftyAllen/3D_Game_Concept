/* Accessible element selection, hold controls and rebinding over the same combat actions. */
(function(root){
  'use strict';
  const {ELEMENTS,LABELS:POWERS}=root.CombatPowerControl,{LABELS}=root.CombatInputMap;
  class ControlUI{
    constructor(options){Object.assign(this,options);this.previousPause=null;this.wheel=document.getElementById('power-wheel-dialog');this.focusIndex=0;this.revision=-1;this.defaultKeys={...root.CombatLab.KEY};
      document.querySelectorAll('[data-open-wheel]').forEach(b=>b.addEventListener('click',()=>this.openWheel()));
      document.getElementById('close-power-wheel').addEventListener('click',()=>this.closeWheel());this.wheel.addEventListener('cancel',e=>{e.preventDefault();this.closeWheel();});this.wheel.addEventListener('close',()=>{if(!this.wheel.open)this.restoreWheelPause();});
      document.querySelectorAll('[data-power-select]').forEach((b,i)=>b.addEventListener('click',()=>this.select(i)));
      this.wheel.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(e.code)){e.preventDefault();this.choose((this.focusIndex+(['ArrowLeft','ArrowUp'].includes(e.code)?5:1))%6);document.querySelector('[data-power-select="'+ELEMENTS[this.focusIndex]+'"]').focus();}});
      this.hold('power-cast',()=>this.world.power.begin(),()=>this.world.power.release(),()=>this.world.power.cancel());
      this.hold('power-throw',()=>this.world.power.beginThrow(),()=>this.world.power.releaseThrow(),()=>this.world.power.releaseThrow());
      document.getElementById('power-utility').addEventListener('click',()=>this.act(()=>this.world.power.utility()));
      document.getElementById('power-coat').addEventListener('click',()=>this.act(()=>this.world.power.coat()));
      document.getElementById('power-aim').addEventListener('click',()=>this.act(()=>this.world.power.toggleAim()));
      document.getElementById('bindings-reset').addEventListener('click',()=>{this.bindings.reset();this.renderBindings();});
      document.querySelectorAll('[data-physics-lab]').forEach(b=>b.addEventListener('click',()=>{this.awaken();this.world.elementPhysics.stage(b.dataset.physicsLab);this.setPaused(false);this.syncMode();this.onSelect?.(this.world.power.selected);this.update();}));
      this.renderBindings();this.update();
    }
    blocked(){return this.isPaused()||this.world.run.blocked()||this.world.over||document.getElementById('controls-modal').open;}
    act(fn){if(this.blocked())return;this.awaken();fn();document.getElementById('arena').focus({preventScroll:true});}
    hold(id,start,end,cancel){const b=document.getElementById(id);let held=false;b.addEventListener('pointerdown',e=>{e.preventDefault();if(this.blocked())return;this.awaken();held=true;b.setPointerCapture(e.pointerId);start();b.classList.add('held');});b.addEventListener('pointerup',e=>{if(!held)return;e.preventDefault();held=false;end();b.classList.remove('held');});for(const event of ['pointercancel','lostpointercapture'])b.addEventListener(event,()=>{if(held){held=false;cancel();}b.classList.remove('held');});b.addEventListener('click',e=>{if(e.detail===0)this.act(()=>{start();end();});});}
    openWheel(){if(this.world.run.blocked()||document.getElementById('controls-modal').open)return;if(this.wheel.open)return;this.awaken();this.previousPause=this.isPaused();this.clearInputs();this.setPaused(true);document.getElementById('pause-overlay').hidden=true;this.bindings.wheelOpen=true;this.bindings.padWheelIndex=-1;this.focusIndex=ELEMENTS.indexOf(this.world.power.selected);this.choose(this.focusIndex);this.wheel.showModal();}
    choose(index){this.focusIndex=(index+6)%6;this.bindings.wheelIndex=this.focusIndex;document.querySelectorAll('[data-power-select]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.powerSelect===ELEMENTS[this.focusIndex])));document.getElementById('wheel-selected').textContent=ELEMENTS[this.focusIndex].toUpperCase();document.getElementById('wheel-description').textContent=POWERS[ELEMENTS[this.focusIndex]].join(' · HOLD: ');}
    select(index=this.focusIndex){const element=ELEMENTS[index];this.world.power.select(element);this.onSelect?.(element);this.savePreferences();this.closeWheel();}
    closeWheel(){if(this.wheel.open)this.wheel.close();this.restoreWheelPause();}
    restoreWheelPause(){if(this.wheel.open||this.previousPause===null)return;const paused=this.previousPause;this.previousPause=null;this.bindings.wheelOpen=false;this.bindings.clear();this.setPaused(paused);}
    actionLabel(action){if(action==='power'&&this.world.easyPowerKey)return 'Power: tap easy combo';if(action.startsWith('attack:'))return root.CombatLab.MOVES[root.CombatLab.BASE[action.slice(7)]]?.name||action;if(action.startsWith('coat:'))return 'Coat '+action.slice(5);return LABELS[action]||action;}
    renderBindings(){const main=['attack:P','attack:K','attack:H','attack:U','attack:G','attack:C','jump','evade','guard','duck','power','utility','wheel','powerthrow','aim','coat'],all=Object.keys(this.bindings.bindings),row=action=>'<button type="button" data-binding="'+action+'"><span>'+this.actionLabel(action)+'</span><kbd>'+this.bindings.shortcut(action)+'</kbd><small>CHANGE</small></button>';
      document.getElementById('bindings-main').innerHTML=main.map(row).join('');document.getElementById('bindings-extra').innerHTML=all.filter(a=>!main.includes(a)).map(row).join('');document.querySelectorAll('[data-binding]').forEach(b=>b.addEventListener('click',()=>{this.bindings.capture=b.dataset.binding;this.update();}));
      for(const [token]of Object.entries(root.CombatLab.KEY)){const action='attack:'+token;if(this.bindings.bindings[action])root.CombatLab.KEY[token]=this.bindings.shortcut(action);}
      for(const b of document.querySelectorAll('[data-attack]')){const k=b.querySelector('kbd'),action='attack:'+b.dataset.attack;if(k&&this.bindings.bindings[action])k.textContent=this.bindings.shortcut(action);}
      for(const [id,action]of [['jump','jump'],['dodge','evade'],['guard','guard'],['duck','duck'],['anchor','anchor'],['cover-toggle','cover']]){const k=document.getElementById(id).querySelector('kbd');if(k)k.textContent=this.bindings.shortcut(action);}
      for(const [id,action]of [['power-cast','power'],['power-utility','utility'],['power-coat','coat'],['power-throw','powerthrow'],['power-aim','aim']])document.getElementById(id).querySelector('kbd').textContent=this.bindings.shortcut(action);for(const b of document.querySelectorAll('[data-open-wheel]')){const k=b.querySelector('kbd');if(k)k.textContent=this.bindings.shortcut('wheel');}
      const moveLabel=document.querySelector('.movement-controls .desktop-label');if(moveLabel)moveLabel.textContent=['up','left','down','right'].map(a=>this.bindings.shortcut(a)).join(' ');this.revision=this.bindings.revision;this.onBindings?.();
    }
    update(){if(this.revision!==this.bindings.revision)this.renderBindings();const p=this.world.power.snapshot(),blocked=this.blocked();
      const titles={earth:'Raise terrace / moving ridge',water:p.surfing?'End surf':'Surf wet trail',fire:'Release heat · 35+',wind:'Air dash',lightning:'Rising voltage',stretch:'Reel / catch'};
      document.getElementById('power-selected').textContent=p.selected;document.getElementById('power-cast').querySelector('span').textContent=p.charging?'Release · '+p.held:p.primary;document.getElementById('power-cast').querySelector('small').textContent='HOLD: '+p.held;document.getElementById('power-utility').querySelector('span').textContent=titles[p.selected];document.getElementById('power-coat').querySelector('span').textContent='Coat '+p.selected;document.getElementById('power-coat').disabled=blocked||['wind','stretch'].includes(p.selected);document.getElementById('power-aim').setAttribute('aria-pressed',String(p.aim.active));
      for(const id of ['power-cast','power-utility','power-aim'])document.getElementById(id).disabled=blocked;document.getElementById('power-throw').disabled=blocked||!(this.world.grapple?.owner===this.world.player&&this.world.grapple.phase==='clinch'||p.throwing);
      const hud=document.getElementById('power-hud');hud.hidden=!!this.world.over||this.world.run.blocked()||!(p.charging||p.aim.active||p.throwing||p.heat>0||p.surfing);hud.dataset.element=p.selected;
      document.getElementById('power-state').textContent=p.throwing?'STEER · RELEASE THROW':p.charging?'CHARGING '+p.selected.toUpperCase():p.surfing?'SURFING · STEER':p.aim.active?'GROUND AIM · '+p.selected.toUpperCase():p.selected.toUpperCase()+' · HEAT '+p.heat;
      document.getElementById('power-hint').textContent=p.throwing?'Hold to load · move or aim · release to launch':p.charging?'Release to cast · cancels on interruption':p.surfing?'Move along wet ground · attack to dismount':p.aim.active?'Drag the arena / right stick to place your cast':p.heat>=35?'Heat ready · use Element utility':'Build heat with confirmed fire hits';document.getElementById('power-charge-fill').style.width=(p.charging?p.charge:p.heat/100)*100+'%';
      const status=document.getElementById('binding-status');status.textContent=this.bindings.capture?'Press a key for '+this.actionLabel(this.bindings.capture)+'. Escape cancels.':'Choose a binding, then press a key. Conflicts swap places.';document.getElementById('input-device').textContent=this.bindings.device;
      for(const b of document.querySelectorAll('[data-binding]'))b.classList.toggle('binding-pending',b.dataset.binding===this.bindings.capture);
    }
  }
  root.CombatControlUI={ControlUI};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatControlUI;
})(typeof window!=='undefined'?window:globalThis);
