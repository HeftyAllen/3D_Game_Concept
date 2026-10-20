/* Physical key codes, atomic rebinding and standard-gamepad edges share one action map. */
(function(root){
  'use strict';
  const DEFAULTS={
    'attack:P':'KeyJ','attack:K':'KeyK','attack:H':'KeyL','attack:U':'KeyI','attack:G':'KeyE','attack:C':'KeyQ','attack:S':'KeyZ','attack:T':'KeyX','attack:R':'KeyV','attack:W':'KeyH','attack:E':'KeyO','attack:L':'KeyP','attack:Q':'KeyM','attack:J':'KeyN',
    'attack:0':'Digit0','attack:1':'Digit1','attack:2':'Digit2','attack:3':'Digit3','attack:4':'Digit4','attack:5':'Digit5','attack:6':'Digit6','attack:7':'Digit7','attack:8':'Digit8','attack:9':'Digit9',
    'attack:a':'Alt+Digit1','attack:b':'Alt+Digit2','attack:c':'Alt+Digit3','attack:d':'Alt+Digit4','attack:e':'Alt+Digit5','attack:f':'Alt+Digit6','attack:g':'Alt+Digit7','attack:h':'Alt+Digit8','attack:i':'Alt+Digit9',
    'coat:fire':'Shift+Digit1','coat:lightning':'Shift+Digit2','coat:earth':'Shift+Digit3','coat:water':'Shift+Digit4',
    up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',jump:'KeyU',evade:'Space',guard:'ShiftLeft',duck:'ControlLeft',anchor:'KeyB',windstep:'KeyG',target:'KeyT',cover:'Enter',pickup:'KeyF',machine:'KeyY',balloon:'KeyC',reset:'KeyR',peekLeft:'BracketLeft',peekRight:'BracketRight',
    guide:'F1',coach:'F2',power:'Semicolon',utility:'Quote',wheel:'Backquote',coat:'Comma',powerthrow:'Period',aim:'Slash'
  };
  const ALIASES={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',ShiftRight:'guard',ControlRight:'duck'};
  const LABELS={guide:'Open field guide',coach:'Toggle pinned coach',up:'Move forward',down:'Move backward',left:'Move left',right:'Move right',jump:'Jump',evade:'Evade / recover',guard:'Block / parry',duck:'Duck',anchor:'Stretch anchor',windstep:'Wind redirect',target:'Next target',cover:'Take cover',pickup:'Pick up / drop',machine:'Use machinery',balloon:'Inflate / unroll',reset:'Reset round',peekLeft:'Peek left',peekRight:'Peek right',power:'Power: tap / hold',utility:'Element utility',wheel:'Element wheel',coat:'Coat selected element',powerthrow:'Hold directed throw',aim:'Toggle ground aim'};
  const C=(v,a,b)=>Math.max(a,Math.min(b,v)),valid=code=>typeof code==='string'&&/^(?:(?:Alt|Shift)\+)?(?:Key[A-Z]|Digit[0-9]|F[1-9]|F1[0-2]|Space|Enter|ShiftLeft|ControlLeft|BracketLeft|BracketRight|Semicolon|Quote|Backquote|Comma|Period|Slash|Backslash|Minus|Equal)$/.test(code);
  function format(code){return (code||'—').replace(/Key([A-Z])/g,'$1').replace(/Digit([0-9])/g,'$1').replace('ShiftLeft','SHIFT').replace('ControlLeft','CTRL').replace('Semicolon',';').replace('Quote',"'").replace('Backquote','`').replace('Comma',',').replace('Period','.').replace('Slash','/').replace('Space','SPACE').replace('Enter','ENTER').replace('BracketLeft','[').replace('BracketRight',']').replace(/\+/g,' + ');}
  function deadzone(x,y){const n=Math.hypot(x||0,y||0);if(n<.18)return [0,0];const scale=C((n-.18)/.82,0,1)/n;return [x*scale,y*scale];}
  class InputMap{
    constructor(onAction=()=>{},onChange=()=>{}){this.onAction=onAction;this.onChange=onChange;this.bindings={...DEFAULTS};this.codes=new Map();this.keysHeld=new Set();this.padHeld=new Set();this.axes=[0,0];this.aimAxes=[0,0];this.capture=null;this.revision=0;this.padIndex=null;this.padPrevious=[];this.device='Keyboard / touch';this.wheelOpen=false;this.wheelIndex=0;this.padWheelIndex=-1;}
    actionFor(e){if(e.metaKey||e.ctrlKey&&!e.code.startsWith('Control')&&!this.keysHeld.has('duck'))return null;const chord=e.altKey?'Alt+'+e.code:e.shiftKey&&!e.code.startsWith('Shift')?'Shift+'+e.code:e.code;return Object.keys(this.bindings).find(k=>this.bindings[k]===chord)||(!e.altKey&&!e.metaKey&&(!e.ctrlKey||e.code.startsWith('Control'))?Object.keys(this.bindings).find(k=>this.bindings[k]===e.code)||ALIASES[e.code]:null);}
    handle(e,down){if(this.capture&&down){if(e.code==='Escape'){this.capture=null;this.onChange();return true;}if(['ShiftLeft','ShiftRight','AltLeft','AltRight','ControlLeft','ControlRight'].includes(e.code)&&!['guard','duck'].includes(this.capture))return true;const chord=e.altKey?'Alt+'+e.code:e.shiftKey&&/^Digit/.test(e.code)?'Shift+'+e.code:e.code;if(valid(chord)){const action=this.capture;this.capture=null;this.rebind(action,chord);}return true;}
      if(!down){const action=this.codes.get(e.code);if(!action)return false;this.codes.delete(e.code);if(![...this.codes.values()].includes(action))this.keysHeld.delete(action);this.onAction(action,false,'keyboard');return true;}
      const action=this.actionFor(e);if(!action)return false;if(e.repeat||this.codes.has(e.code))return true;this.codes.set(e.code,action);this.keysHeld.add(action);this.device='Keyboard / touch';this.onAction(action,true,'keyboard');return true;
    }
    held(action){return this.keysHeld.has(action)||this.padHeld.has(action);}
    movement(){let x=(this.held('right')?1:0)-(this.held('left')?1:0)+this.axes[0],z=(this.held('down')?1:0)-(this.held('up')?1:0)+this.axes[1],n=Math.max(1,Math.hypot(x,z));return [x/n,z/n];}
    rebind(action,code){if(!Object.hasOwn(DEFAULTS,action)||!valid(code))return false;const old=this.bindings[action],other=Object.keys(this.bindings).find(k=>k!==action&&this.bindings[k]===code);this.clear();if(other)this.bindings[other]=old;this.bindings[action]=code;this.revision++;this.onChange();return true;}
    load(value){if(!value||typeof value!=='object')return;for(const [action,code]of Object.entries(value))if(Object.hasOwn(DEFAULTS,action)&&valid(code))this.rebind(action,code);}
    reset(){this.clear();this.bindings={...DEFAULTS};this.capture=null;this.revision++;this.onChange();}
    clear(){this.codes.clear();this.keysHeld.clear();this.padHeld.clear();this.axes=[0,0];this.aimAxes=[0,0];this.onAction('cancel',false,'system');}
    shortcut(action){return format(this.bindings[action]);}
    poll(pads,dt){const pad=Array.from(pads||[]).find(p=>p?.connected!==false&&p?.mapping==='standard');if(!pad){if(this.padIndex!==null){this.clear();this.padIndex=null;this.padPrevious=[];}this.device='Keyboard / touch';return;}
      const buttons=Array.from(pad.buttons||[],b=>!!b?.pressed||(b?.value||0)>.45),first=this.padIndex!==pad.index;this.device='Gamepad · standard mapping';this.axes=deadzone(pad.axes?.[0]||0,pad.axes?.[1]||0);this.aimAxes=deadzone(pad.axes?.[2]||0,pad.axes?.[3]||0);
      if(first){this.padIndex=pad.index;this.padPrevious=buttons;return;}const rising=i=>buttons[i]&&!this.padPrevious[i];
      if(this.wheelOpen){const [x,y]=this.axes,n=Math.hypot(x,y);if(n>.3){const index=Math.round(((Math.atan2(x,-y)+Math.PI*2)%(Math.PI*2))/(Math.PI/3))%6;if(index!==this.padWheelIndex){this.padWheelIndex=index;this.wheelIndex=index;this.onAction('wheel:choose',index,'gamepad');}}if(rising(0))this.onAction('wheel:confirm',true,'gamepad');if(rising(1)||rising(4))this.onAction('wheel:close',true,'gamepad');this.axes=[0,0];this.aimAxes=[0,0];}
      else {const map={0:'jump',1:'evade',2:'attack:P',3:'attack:K',4:'wheel',5:'attack:H',6:'guard',7:'power',8:'attack:C',9:'pause',10:'balloon',11:'aim',12:'target',13:'attack:G',14:'coat',15:'utility'};for(const [index,action]of Object.entries(map)){const pressed=!!buttons[index],was=!!this.padPrevious[index];if(pressed===was)continue;if(pressed)this.padHeld.add(action);else this.padHeld.delete(action);this.onAction(action,pressed,'gamepad');}}
      this.padPrevious=buttons;
    }
    snapshot(){return {bindings:{...this.bindings},device:this.device,held:[...this.keysHeld,...this.padHeld],axes:this.axes.slice(),aimAxes:this.aimAxes.slice(),capture:this.capture};}
  }
  root.CombatInputMap={InputMap,DEFAULTS,ALIASES,LABELS,format,deadzone};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatInputMap;
})(typeof window!=='undefined'?window:globalThis);
