(function () {
  'use strict';
  const { World, ROUTES, KEY, clamp } = window.CombatLab;
  const {STYLES,LEVELS}=window.CombatOpponent;
  const $ = id => document.getElementById(id);
  const ui = Object.fromEntries(['arena','effects','viewport','sound','sound-label','reset','controls','pause','fullscreen',
    'player-health','player-stamina','stamina-label','player-state','enemy-health','enemy-title','enemy-state','round-icon','round-label',
    'welcome','combo-hud','hit-number','combo-rank','combo-damage','event-banner','event-text','event-sub','input-history','last-move',
    'pause-overlay','resume','defeat-overlay','retry','graphics-error','dummy','infinite','impact','lock','best-hits','best-damage','total-hits','parries',
    'coach-status','coach-progress','coach-title','coach-keys','coach-note','watch','route-list','controls-modal','close-controls','got-it','announcer','mode-caption',
    'cover-toggle','cover-hud','cover-state','cover-note','dodge','guard','jump','duck','anchor','mobility-hud','mobility-state','mobility-note','landing-window','grapple-hud','grip-title','grip-hint','grip-control','grip-options','route-count','library-count',
    'flow-hud','flow-state','flow-queued','flow-fill','flow-hint','object-status','object-hint','object-pickup','object-fetch','yard-progress','yard-hint',
    'balloon-deck','balloon-toggle','balloon-status','balloon-hint','balloon-pressure','balloon-stage','weapon-status','gun-reload','gust-step','ammo-hud','ammo-count','ammo-note',
    'recenter','arena-note','enemy-stamina','opponent-style','difficulty','practice-speed','scene-detail','hazards','partner-summary','style-note',
    'trial-hud','trial-state','trial-name','trial-goals','trial-time','trial-best','trial-retry','trial-leave','trial-tip','machine-status','machine-hint','machine-use','machine-power','foundry-visit','assist-style','assist-hint','wind-hint','group-settings','group-count','group-mix','group-behavior','group-note','target-deck','target-list','cycle-target','difficulty-note','wind-stage','wind-status','wind-energy','route-search','session-summary','stat-breaks','stat-springs','stat-steps','stat-props','session-log'].map(id=>[id,$(id)]));
  let world, renderer, selected=ROUTES[0], group='All', paused=false, bannerUntil=0, bannerPriority=0, completeUntil=0, interaction=false;
  let easyHeld=false,easyAt=0,inputMap=null,controlUI=null,fieldUI=null;const aimPointers=new Set();
  let coachChain='', inputTokens=[], lastAttackAt=0, previousModalPause=null, soundOn=false,defeatAt=Infinity;
  const completed=new Set(), keys=new Set(), touchMove=new Set(),yardCompleted=new Set();
  const sessionTotals={broken:0,springs:0,steps:0,props:0};
  function yardGoal(kind){yardCompleted.add(kind);setText(ui['yard-progress'],yardCompleted.size+' / 8');document.querySelectorAll('[data-yard-drill]').forEach(b=>b.classList.toggle('completed',yardCompleted.has(b.dataset.yardDrill)));}
  const setText=(el,value)=>{value=String(value);if(el.textContent!==value)el.textContent=value;};
  const styleNotes={balanced:'Circles, closes distance, and mixes hands, feet, air, and clinch.',boxer:'Stays in the pocket, guards, and pressures with fast hands.',kicker:'Controls kicking distance and changes between low, body, and spinning kicks.',wrestler:'Closes space, changes grip, and works into takedowns and suplexes.',elastic:'Makes space, attacks from range, and reels into clinch follow-ups.',scavenger:'Finds loose objects, picks them up, then mixes swings and throws.',gunner:'Keeps shooting distance with a pulse blaster. Dodge, parry a shot, or close into a clinch.'};
  function logEvent(value){const li=document.createElement('li');li.textContent=value;ui['session-log'].prepend(li);while(ui['session-log'].children.length>6)ui['session-log'].lastElementChild.remove();}
  function savePreferences(){try{localStorage.setItem('kinetic-playground-v10',JSON.stringify({arena:world.arenaId,style:world.opponentStyle,difficulty:world.difficulty,speed:world.practiceSpeed,hazards:world.hazards,detail:renderer?.detail||'full',groupCount:world.groupCount,groupMix:world.groupMix,groupBehavior:world.groupBehavior,assistMode:world.assistMode,assistStyle:world.assistStyle,smartTarget:world.smartTarget,powerElement:world.power.selected}));}catch{}}
  function restorePreferences(){try{const current=localStorage.getItem('kinetic-playground-v10'),v=JSON.parse(current||localStorage.getItem('kinetic-playground-v9')||localStorage.getItem('kinetic-playground-v8')||localStorage.getItem('kinetic-playground-v7'));if(!v)return;if(window.CombatArenas.ARENAS[v.arena])world.arenaId=v.arena;if(STYLES[v.style])world.opponentStyle=v.style;if(LEVELS[v.difficulty])world.difficulty=v.difficulty;if([.5,.75,1].includes(v.speed))world.practiceSpeed=v.speed;world.hazards=v.hazards!==false;if([2,3].includes(v.groupCount))world.groupCount=v.groupCount;if(['mixed','runner','bruiser','grappler','reach'].includes(v.groupMix))world.groupMix=v.groupMix;if(['passive','moving','live'].includes(v.groupBehavior))world.groupBehavior=v.groupBehavior;if(['manual','easy'].includes(v.assistMode))world.assistMode=v.assistMode;if(['mixed','wind','wrestling','fusion','elements'].includes(v.assistStyle))world.assistStyle=v.assistStyle;if(typeof v.smartTarget==='boolean')world.smartTarget=v.smartTarget;if(window.CombatPowerControl.ELEMENTS.includes(v.powerElement))world.powerElement=v.powerElement;if(renderer)renderer.setDetail(v.detail);world.reset();}catch{}}
  let audioCtx, noiseBuffer;
  function startAudio(){
    if(!soundOn)return;
    try{
      if(!audioCtx){
        const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
        audioCtx=new Audio();noiseBuffer=audioCtx.createBuffer(1,audioCtx.sampleRate*.3,audioCtx.sampleRate);
        const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      }
      if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
    }catch{soundOn=false;}
  }
  function tone(frequency,duration,volume,kind='sine',end=frequency){
    if(!soundOn||!audioCtx||audioCtx.state!=='running')return;
    const t=audioCtx.currentTime,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
    osc.type=kind;osc.frequency.setValueAtTime(frequency,t);osc.frequency.exponentialRampToValueAtTime(Math.max(1,end),t+duration);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain);gain.connect(audioCtx.destination);osc.start(t);osc.stop(t+duration+.01);
  }
  function noise(duration,volume,frequency){
    if(!soundOn||!audioCtx||audioCtx.state!=='running')return;
    const t=audioCtx.currentTime,source=audioCtx.createBufferSource(),gain=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();
    source.buffer=noiseBuffer;filter.type='lowpass';filter.frequency.value=frequency;
    gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    source.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);source.start(t);source.stop(t+duration);
  }
  function impactAudio(event){
    if(event.type==='attack'){noise(.09,.023,1200);if(window.CombatLab.MOVES[event.id]?.elastic){tone(180,.15,.022,'triangle',290);noise(.12,.018,1900);}}
    if(event.type==='hit'||event.type==='hurt'){tone(event.finish?92:135,event.finish?.18:.11,.13,'sine',42);noise(.085,.14,2300);}
    if(event.type==='weaponClash'){tone(480,.12,.07,'triangle',180);noise(.06,.08,5200);}
    if(event.type==='block'){tone(330,.08,.045,'triangle',120);noise(.035,.055,4000);}
    if(event.type==='parry'){tone(740,.2,.075,'triangle',1200);tone(1480,.25,.032);}
    if(event.type==='dodge'){noise(.14,.026,2600);}
    if(event.type==='lightningCast'){tone(560,.16,.035,'sawtooth',90);noise(.14,.06,6500);}
    if(event.type==='ko'){tone(170,.4,.07,'triangle',60);}
    if(event.type==='balloonInflate'){tone(100,.4,.055,'sine',420);noise(.30,.025,1600);}
    if(event.type==='balloonDeflate'){tone(390,.30,.04,'triangle',100);noise(.28,.024,2800);}
    if(event.type==='balloonBurst'){noise(.22,.06,1800);tone(180,.16,.06,'sine',70);}
    if(event.type==='balloonHop'){tone(150,.18,.065,'sine',370);}
    if(event.type==='balloonBounce'||event.type==='balloonRicochet'){tone(90+Math.min(130,event.speed*12),.14,.045,'sine',85);}
    if(event.type==='balloonSlam'){tone(90,.26,.14,'sine',32);noise(.14,.11,1100);}
    if(event.type==='springLaunch'||event.type==='springProp')tone(140,.28,.06,'triangle',640);
    if(event.type==='windCast'){noise(event.mode==='cyclone'?.4:.28,event.mode==='cyclone'?.075:.055,3200);tone(event.mode==='updraft'?240:140,.26,.04,'sine',event.mode==='updraft'?520:65);}
    if(event.type==='bagHit'){tone(100,.12,.055,'sine',60);noise(.07,.035,1000);}
    if(event.type==='playerEscape')tone(440,.16,.055,'triangle',690);
  }
  function banner(text,sub='',seconds=1.1,priority=1){
    const now=performance.now()/1000;
    if(now<bannerUntil&&priority<bannerPriority)return;
    setText(ui['event-text'],text);setText(ui['event-sub'],sub);bannerUntil=now+seconds;bannerPriority=priority;
    ui['event-banner'].classList.add('visible');
  }
  function awaken(){
    if(!interaction){interaction=true;ui.welcome.style.opacity='0';}
    startAudio();
  }
  function setPaused(value){
    paused=value;ui['pause-overlay'].hidden=!value||world.over;ui.pause.textContent=value?'▷':'Ⅱ';
    ui.pause.setAttribute('aria-label',value?'Resume game':'Pause game');
    if(value){inputMap?.clear();world.power?.cancel();aimPointers.clear();keys.clear();touchMove.clear();world.input.x=world.input.z=0;world.setGuard(false);world.mobility.setDuck(false);world.cover.clear();clearHeld();}
    if(!value)ui.arena.focus({preventScroll:true});
  }
  function clearHeld(){easyHeld=false;document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));}
  function syncMode(){
    document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===world.mode;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});
    ui.dummy.disabled=world.mode!=='practice';ui.dummy.value=world.dummy;
    ui.infinite.checked=world.infinite;ui.infinite.disabled=world.mode==='sparring';
    setText(ui['mode-caption'],world.isGroup()?world.isLive()?'ONE ATTACKER AT A TIME.':'CHAIN BETWEEN PARTNERS.':world.mode==='sparring'?'TIMING IS EVERYTHING.':'NO PRESSURE. JUST FLOW.');
    setText(ui['enemy-title'],world.mode==='sparring'?'SPARRING PARTNER':'TRAINING PARTNER');
    document.querySelectorAll('[data-arena]').forEach(b=>{const active=b.dataset.arena===world.arenaId;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
    ui.viewport.dataset.arena=world.arenaId;setText(ui['arena-note'],world.yard.layout.subtitle);
    ui['opponent-style'].value=world.opponentStyle;ui.difficulty.value=world.difficulty;ui['practice-speed'].value=String(world.practiceSpeed);ui['practice-speed'].disabled=world.isLive()||world.trials.run?.status==='running';ui.hazards.disabled=world.trials.run?.status==='running';ui['scene-detail'].value=renderer?.detail||'full';ui.hazards.checked=world.hazards;
    ui['opponent-style'].disabled=world.isGroup();
    syncGroup();syncAssist();
    setText(ui['difficulty-note'],LEVELS[world.difficulty].name+' · '+Math.round(LEVELS[world.difficulty].damage*100)+'% damage · up to '+LEVELS[world.difficulty].chain+' attacks'+(!LEVELS[world.difficulty].grabs?' · no grabs':!LEVELS[world.difficulty].ground?' · no ground follow-ups':''));
    setText(ui['partner-summary'],(world.isGroup()?'Group lab':STYLES[world.opponentStyle].name)+' · '+LEVELS[world.difficulty].name);setText(ui['style-note'],world.isGroup()?'Runners are quick and light. Bruisers resist knockback. Grapplers close into clinches. Long-reach rivals work from range.':styleNotes[world.opponentStyle]);
  }
  function syncGroup(){
    const active=world.isGroup();ui['group-settings'].hidden=!active;ui['target-deck'].hidden=!active;
    ui['group-count'].value=String(world.groupCount);ui['group-mix'].value=world.groupMix;ui['group-behavior'].value=world.groupBehavior;
    setText(ui['group-note'],world.groupBehavior==='live'?'One opponent attacks at a time. Others give your clinches and floor recovery room.':world.groupBehavior==='moving'?'Moving targets defend and circle without attacking. Switch targets to practice chains.':'Still targets wait for your next experiment. Lift the group or bowl through it.');
    ui['target-list'].replaceChildren();
    for(const enemy of world.enemies){const b=document.createElement('button');b.className='target-card';b.dataset.target=enemy.id;b.innerHTML='<strong></strong><small></small><i></i>';b.querySelector('strong').textContent=enemy.name;ui['target-list'].append(b);}
    updateTargets();
  }
  function updateTargets(){
    if(!world.isGroup())return;
    for(const b of ui['target-list'].children){const enemy=world.getFighter(b.dataset.target);if(!enemy)continue;const active=enemy===world.enemy;b.classList.toggle('selected',active);b.classList.toggle('attacking',world.attackOwner===enemy.id);b.setAttribute('aria-pressed',String(active));b.disabled=enemy.ko;b.querySelector('i').style.transform='scaleX('+enemy.health/enemy.maxHealth+')';setText(b.querySelector('small'),enemy.ko?'DOWN':world.attackOwner===enemy.id?'ATTACKING':Math.ceil(enemy.health)+' / '+enemy.maxHealth+' HP');}
    ui['cycle-target'].disabled=world.enemies.filter(e=>!e.ko).length<2||!!world.grapple||!!world.tether||world.player.held;
  }
  function updateMachines(){
    const g=world.yard.gadgets,near=g.nearest(world.player),available=!!g.panels.length,power=!world.hazards?'DISABLED':g.power===1?'FORWARD':g.power===-1?'REVERSE':'OFF';
    setText(ui['machine-status'],available?(world.arenaId==='canal'?'Canal current · ':'Foundry machinery · ')+power:'A new place to cause a chain reaction.');
    setText(ui['machine-hint'],available?world.arenaId==='canal'?(near.d<=1.7?'Turn the sluice wheel: forward → reverse → off. Side channels stay wet.':'Sluice wheel '+near.d.toFixed(1)+' m away · water carries bodies and cargo.'):near.d<=1.7?'Y cycles forward → reverse → off. Amber warns before a vent blast.':'Control post '+near.d.toFixed(1)+' m away · belts carry cargo · amber vents warn before a blast.':'Visit the Foundry for cargo carts, glass cover, conveyors, and timed air vents.');
    setText(ui['machine-power'],available?power:'Use switch');ui['machine-use'].disabled=!available||near.d>1.7||!!world.player.action||world.player.held||!!world.player.balloon||world.player.down>0||world.player.stunned>0||!!world.grapple||!!world.tether;ui['foundry-visit'].hidden=available;
  }
  function restoreTrialBests(){try{world.trials.load(JSON.parse(localStorage.getItem('kinetic-trial-bests-v1')));}catch{}}
  function updateTrial(){
    const r=world.trials.snapshot();ui['trial-hud'].hidden=!r;
    const mode=world.assistMode==='easy'?'easy:'+world.assistStyle:'manual';
    for(const el of document.querySelectorAll('[data-trial-best]')){const best=world.trials.best[el.dataset.trialBest+':'+mode];setText(el,best?best.toFixed(2)+'s':'—');}
    if(!r)return;
    setText(ui['trial-name'],r.name);setText(ui['trial-state'],r.status==='running'?'ENVIRONMENT TRIAL':r.status==='complete'?r.newBest?'NEW PERSONAL BEST':'TRIAL COMPLETE':r.status==='timeout'?'TIME UP':'TRY AGAIN');
    setText(ui['trial-time'],r.status==='running'?Math.ceil(r.left)+'s':r.elapsed.toFixed(2)+'s');setText(ui['trial-best'],r.best?'BEST '+r.best.toFixed(2)+'s':'YOUR NEXT PERSONAL BEST');
    const html=r.steps.map((label,i)=>{const n=Number(r.progress[i]),done=n>=r.counts[i];return '<li class="'+(done?'done':'')+'"><span>'+(done?'✓':n+'/'+r.counts[i])+'</span>'+label+'</li>';}).join('');if(ui['trial-goals'].innerHTML!==html)ui['trial-goals'].innerHTML=html;
  }
  function syncAssist(){
    document.querySelectorAll('[data-assist]').forEach(b=>{const active=b.dataset.assist===world.assistMode;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
    ui['assist-style'].value=world.assistStyle;ui['assist-style'].disabled=world.assistMode!=='easy';
    document.querySelector('.control-deck').classList.toggle('easy-controls',world.assistMode==='easy');
    setText(ui['assist-hint'],world.assistMode==='easy'?world.assistStyle==='elements'?'Tap or hold J: coatings, water, fire, earth and real hand-to-hand links. K launches; L finishes or releases a ready fusion.':world.assistStyle==='fusion'?'Tap or hold J: wind lift → spark → catch → throw. K mixes air attacks; L finishes.':'Tap or hold J: auto combo · K: air mix · L: finish. Use the power buttons for direct casts. You steer, block, and dodge.':'Manual inputs. Choose Easy combos to tap or hold J through mixed hands, feet, air, and throws.');
    previousContext='';
  }
  function updateWind(){
    const p=world.player,free=world.freePlayer(),active=world.time<=p.chainUntil,energy=Math.round(p.windEnergy);
    setText(ui['wind-status'],p.balloon?'H unrolls directly into a wind palm.':active&&p.lastId==='gale'?'Gather, dash, lift, or slam.':active&&p.lastId==='updraft'?'Next H: cyclone · catch the current.':active&&p.lastId==='cyclone'?'Cyclone active · L collapses the current.':'Wind energy '+(free?'∞':energy+' / 100'));
    setText(ui['wind-hint'],world.assistMode==='easy'?'Tap the wind buttons to pull, dash, or gather · choose Wind & air for easy storm combos.':'H → K pulls · H → E dashes · H → H → H cyclone · L collapses');
    ui['wind-energy'].querySelector('i').style.width=(free?100:energy)+'%';ui['wind-energy'].setAttribute('aria-valuenow',String(free?100:energy));
  }
  function handleEvent(e){
    if(!world)return;
    if(renderer)renderer.notify(e);impactAudio(e);
    if(e.type==='reset'){
      coachChain='';inputTokens=[];drawInputs();setText(ui['last-move'],'THE FLOOR IS YOURS.');
      ui['defeat-overlay'].hidden=true;defeatAt=Infinity;keys.clear();touchMove.clear();clearHeld();
      ui['event-banner'].classList.remove('visible');bannerUntil=0;completeUntil=0;
    }
    if(e.type==='mode'){syncMode();}
    if(e.type==='districtDiscovery'){try{localStorage.setItem('kinetic-journal-v1',JSON.stringify(world.journal.snapshot().seen));}catch{}banner(e.entry.title,'DISTRICT DISCOVERY · '+e.count+' / '+e.total,2.8,2);}
    if(e.type==='bossPhase')banner('Phase '+e.stage+' · '+e.name,'WATCH FOR NEW ATTACK ZONES',1.8,3);
    if(e.type==='bossInterrupt')banner('Wind-up broken.','YOUR OPENING · KEEP THE CHAIN',.8,2);

    if(e.type==='jump'){setText(ui['last-move'],'JUMP · STEER WITH YOUR MOVEMENT INPUT');setText(ui.announcer,'Jump. Move to steer, G redirects with wind, B grabs a scenery anchor.');tone(190,.14,.035,'triangle',350);}
    if(e.type==='airRedirect'){setText(ui['last-move'],'AIR REDIRECT · KEEP YOUR COMBO');tone(240,.20,.04,'triangle',450);noise(.18,.035,2400);}
    if(e.type==='anchorAttach'){setText(ui['last-move'],'STRETCH ANCHOR · '+e.label.toUpperCase());setText(ui.announcer,'Scenery anchor attached. U releases with a rising jump. B releases the cable.');tone(160,.18,.035,'triangle',320);}
    if(e.type==='landingRecovery'){banner('Clean recovery.','KEEP MOVING · YOUR COUNTER IS READY',.75,2);setText(ui['last-move'],'CLEAN RECOVERY · COUNTER READY');setText(ui.announcer,'Timed landing recovery.');tone(440,.16,.05,'triangle',660);}
    if(e.type==='landingMiss'){setText(ui['last-move'],'RECOVERY TOO EARLY · TAP SPACE JUST BEFORE LANDING');}
    if(e.type==='duckEvade'){setText(ui['last-move'],'UNDER THE STRIKE · J / K / L TO COUNTER');setText(ui.announcer,'Ducked a high attack. Counter now.');}
    if(e.type==='mobilityNotice')banner(e.text,'MOVE OR AIM TOWARD A CLEAR ANCHOR',1.4,2);
    if(e.type==='machineSwitch'){banner(world.arenaId==='canal'?(e.power===1?'Current forward.':e.power===-1?'Current reversed.':'Current off.'):e.power===1?'Belts forward.':e.power===-1?'Belts reversed.':'Machinery off.','Y AT A CONTROL POST CYCLES THE FLOW',1,2);tone(300,.1,.045,'triangle',e.power?480:180);updateMachines();}
    if(e.type==='ventLaunch'){sessionTotals.springs++;tone(210,.28,.055,'triangle',650);if(e.by==='player')setText(ui['last-move'],'VENT FLIGHT · J / K CONNECT IN THE AIR');}
    if(e.type==='bumperBounce'){tone(120,.2,.07,'sine',340);if(e.by==='player')setText(ui['last-move'],'REBOUND · FOLLOW WITH AN AIR HIT');}
    if(e.type==='trialStart'){setText(ui['trial-tip'],e.hint);syncMode();updateTrial();banner(e.name,'60 SECONDS · '+e.hint,3,3);}
    if(e.type==='trialStop'){syncMode();updateTrial();setText(ui['trial-tip'],'Free play. Choose another trial whenever you want.');}
    if(e.type==='trialFinish'){easyHeld=false;keys.clear();touchMove.clear();clearHeld();updateTrial();syncMode();try{localStorage.setItem('kinetic-trial-bests-v1',JSON.stringify(world.trials.best));}catch{}banner(e.status==='complete'?e.newBest?'New personal best.':'Trial complete.':e.status==='timeout'?'Time up.':'Try that setup again.',e.status==='complete'?e.elapsed.toFixed(2)+'s · RETRY TO IMPROVE YOUR TIME':'RETRY RESTORES THE WHOLE SETUP',2.3,4);logEvent(window.CombatTrials.DEFINITIONS[e.id].name+' · '+e.status+' · '+e.elapsed.toFixed(2)+'s.');}

    if(e.type==='assist'){syncAssist();setText(ui.announcer,e.mode==='easy'?'Easy combos on. Tap or hold J. K mixes air attacks. L finishes.':'Manual controls restored.');}
    if(e.type==='target'){setText(ui.announcer,'Target: '+e.name);updateTargets();}
    if(e.type==='enemyKO'){banner(e.name+' down.',e.remaining+' REMAIN · T CHANGES TARGET',1.1,3);logEvent(e.name+' knocked out.');}
    if(e.type==='balanceBreak')banner(e.target==='player'?'Your balance broke.':'Balance broken.',e.target==='player'?'RECOVER, THEN GUARD OR MOVE':'GRAB → THROW DURING THE OPENING',1.4,3);
    if(e.type==='balancePunish')banner('Throw opening secured.','BALANCE FINISH · +22% DAMAGE',1.1,3);
    if(e.type==='powerLink')banner(e.name+'.','POWERS CONNECTED · KEEP THE FLOW',1,2);
    if(e.type==='balloonCharge')banner('Charged roll ready.','J BURST → BODY CONTACT RELEASES THE PULSE',1.3,2);
    if(e.type==='windEmpty')banner('Let the wind gather.','ENERGY REFILLS BETWEEN CASTS',1,2);
    if(e.type==='gunShot'){tone(e.charged?640:930,.09,.045,'triangle',e.charged?180:350);noise(.055,.035,2600);}
    if(e.type==='gunEmpty'&&e.by==='player')banner('Magazine empty.','N RELOADS · K KICKS · L STRIKES',.9,2);
    if(e.type==='gunReload'){tone(430,.09,.03,'square',690);if(e.by==='player')setText(ui['last-move'],'BLASTER RELOADED · 6 ROUNDS');}
    if(e.type==='shotParry'){tone(780,.14,.05,'triangle',1350);banner(e.by==='player'?'Pulse reflected.':'Your shot was reflected.','A TIMED GUARD SENDS ONE SHOT BACK',.8,2);}
    if(e.type==='gustStep'){easyHeld=false;easyAt=world.time+.35;tone(390,.18,.04,'triangle',710);setText(ui['last-move'],'GUST STEP · QUEUE THE NEXT HIT');}
    if(e.type==='weaponLab'){syncMode();const hints={baton:'J → J → K → L · Z EXTENDS · E THROWS',staff:'J → I → J → K → L · Z EXTENDS',blaster:'J SHOOTS · K KICKS · Z LIFTS · N RELOADS'};banner(e.weapon==='blaster'?'Pulse blaster ready.':e.weapon==='staff'?'Staff ready.':'Baton ready.',hints[e.weapon],2.5,3);}
    if(e.type==='windCast'){setText(ui['last-move'],(e.assisted?KEY[e.requestedToken]+' → ASSIST: ':'')+e.name.toUpperCase()+' · '+e.hits+' TARGETS · '+e.props+' OBJECTS');}
    if(e.type==='windSetup')banner('Catch them in the current.','TRY H → H → H → L · OR USE THE WIND BUTTONS',2.3,2);
    if(e.type==='controlInput'){awaken();inputTokens.push(e.key||KEY[e.token]);inputTokens=inputTokens.slice(-8);lastAttackAt=performance.now()/1000;drawInputs();}
    if(e.type==='attack'){
      setText(ui['last-move'],(e.assisted?KEY[e.requestedToken]+' → ASSIST: ':'')+e.move.toUpperCase());
      const b=document.querySelector('[data-attack="'+(e.requestedToken||e.token)+'"]');if(b){b.classList.add('pressed');setTimeout(()=>b.classList.remove('pressed'),115);}
    }
    if(e.type==='hit'){
      if(e.weapon)yardGoal('chair');
      if(world.mode==='sparring'&&world.opponentStyle==='boxer'&&e.hits>=3)yardGoal('duel');
      if(e.hits>=5&&e.finish)banner('Beautiful connection.',e.hits+' HITS · '+e.total+' DAMAGE',.9,1);
    }
    if(e.type==='weaponClash'){setText(ui['last-move'],'WEAPON CLASH');setText(ui.announcer,'Weapons met. Change the angle or mix in a kick.');}
    if(e.type==='surfaceContact'&&e.by==='player')setText(ui['last-move'],'CONTACT · '+(world.yard.props.find(p=>p.id===e.prop)?.name||'COVER').toUpperCase());
    if(e.type==='connect')coachChain=e.connectedChain;
    if(e.type==='grabFirst')banner('Secure a clinch first.','E GRABS · Q CHANGES YOUR GRIP',1.2,2);
    if(e.type==='reel')setText(ui['last-move'],'REELING IN · E THROW / Q CHANGE GRIP');
    if(e.type==='clinch')setText(ui.announcer,e.by!=='player'?'You are grabbed. Tap Space to resist the grip.':'Clinch secured. Q changes grip. Space releases.');
    if(e.type==='gripEscape')banner('Grip escaped.','CHANGE POSITION OR THROW BEFORE CONTROL RUNS OUT',1.1,2);
    if(e.type==='throwStart')setText(ui['last-move'],e.move.toUpperCase()+' · QUEUE YOUR FOLLOW-UP');
    if(e.type==='route'){
      completed.add(e.route.id);drawRoutes();
      if(selected.id===e.route.id){completeUntil=world.time+1.7;setText(ui.announcer,e.route.name+' connected.');}
      if(e.route.seq.length>=3)banner(e.route.name,e.route.seq.split('').map(k=>KEY[k]).join('  ›  '),1,2);
    }
    if(e.type==='whiff'&&(!e.by||e.by==='player')){setText(ui['last-move'],'MISSED · REPOSITION AND TRY AGAIN');}
    if(e.type==='tired'){banner('Catch your breath.','STAMINA RECOVERS WHEN YOU STOP ATTACKING',.8,2);}
    if(e.type==='bufferFull')setText(ui['last-move'],'FOUR MOVES QUEUED · KEEP THE RHYTHM');
    if(e.type==='yardNotice'){setText(ui['last-move'],e.text.toUpperCase());setText(ui.announcer,e.text);}
    if(e.type==='propReel')setText(ui['last-move'],'STRETCHING TO '+e.prop.toUpperCase());
    if(e.type==='propPickup'){banner((e.by!=='player'?'Partner picked up ':'Equipped: ')+e.prop,e.by!=='player'?'WATCH THE SWING · DODGE THE THROW':'J SWING · L HEAVY · E THROW · F DROP',1.1,1);if(e.by==='player'&&e.elastic)yardGoal('stretch');logEvent((e.by!=='player'?'Partner':'You')+' picked up '+e.prop.toLowerCase()+'.');}
    if(e.type==='propDrop'&&e.by==='player')setText(ui['last-move'],'HANDS FREE · E CLINCH / V REEL-IN');
    if(e.type==='propThrow'){setText(ui['last-move'],(e.by!=='player'?'INCOMING · ':e.power?'SPRING THROW · ':'THROWN · ')+e.prop.toUpperCase());logEvent((e.by!=='player'?'Partner':'You')+' threw '+e.prop.toLowerCase()+'.');}
    if(e.type==='propBreak'){sessionTotals.broken++;banner(e.prop+' broken.','KEEP THE COMBINATION MOVING',.85,2);noise(.20,.12,1900);if(e.by==='player'&&e.propType==='table')yardGoal('table');if(e.by==='player'&&e.propType==='divider')yardGoal('divider');logEvent(e.prop+' broken.');}
    if(e.type==='envHit'){if(e.kind==='prop')sessionTotals.props++;banner(e.move,e.damage+' DAMAGE · KEEP CHAINING',.85,2);impactAudio({type:'hit',finish:true});if(e.by==='player'&&e.target!=='player'){if(e.kind==='wall')yardGoal('wall');if(e.kind==='prop'&&e.propType!=='bag')yardGoal('chair');if(e.propType==='bag')yardGoal('bag');}logEvent(e.move+' · '+e.damage+' damage to '+(e.target==='player'?'you':'partner')+'.');}
    if(e.type==='springLaunch'){sessionTotals.springs++;if(e.by==='player'){yardGoal('spring');setText(ui['last-move'],'SPRING LAUNCH · MIX J / K / Z / X IN THE AIR');}logEvent((e.by==='player'?'You':'Partner')+' launched from a spring pad.');}
    if(e.type==='springProp')sessionTotals.springs++;
    if(e.type==='opponentStep')sessionTotals.steps++;
    if(e.type==='gripResist'){setText(ui['last-move'],'RESISTING GRIP · '+Math.ceil(e.control)+' CONTROL LEFT');}
    if(e.type==='playerEscape'){banner('Grip escaped.','COUNTER OR CREATE SOME SPACE',1,2);setText(ui.announcer,'You escaped the grip.');}
    if(e.type==='balloonInflate'){awaken();setText(ui['last-move'],'INFLATING · STEER INTO YOUR NEXT COMBO');setText(ui.announcer,'Balloon form. WASD steers, J bursts, Space bounces, L belly drops, Shift brakes.');}
    if(e.type==='balloonBurst')setText(ui['last-move'],'BURST ROLL · MOMENTUM IS YOUR WEAPON');
    if(e.type==='balloonBowl')setText(ui['last-move'],'BOWLED OVER · I UNROLLS INTO A LAUNCHER');
    if(e.type==='balloonDrop')setText(ui['last-move'],'BELLY DROP · CLEAR THE LANDING');
    if(e.type==='balloonSlam')banner('A little more bounce.','I UNROLLS INTO A LAUNCHER · V REELS THEM BACK',1,2);
    if(e.type==='balloonDeflate')setText(ui['last-move'],'UNROLLING'+(e.follow?' → '+KEY[e.follow]+' FOLLOW-UP':''));
    if(e.type==='balloonDeflect')setText(ui['last-move'],'RUBBER BODY · KEEP MOVING');
    if(e.type==='block'){
      setText(ui['last-move'],e.by!=='player'?'BLOCKED · TRY A HEAVY FINISH OR GRAB':'GUARD HELD');
    }
    if(e.type==='guardBreak'){banner('Guard broken.',e.by==='player'?'THE OPENING IS YOURS.':'DODGE TO CREATE SPACE.',.9,2);}
    if(e.type==='parry'){banner('Perfect parry.','J / K / L → COUNTER',1.15,3);setText(ui.announcer,'Perfect parry. Follow with a punch, kick, or heavy counter.');}
    if(e.type==='rescueTell')banner('A teammate is moving in.','THROW NOW OR RELEASE AND EVADE.',.75,2);
    if(e.type==='teamRescue')banner('They broke the hold.','RESET YOUR POSITION AND KEEP FLOWING.',.9,2);
    if(e.type==='lightningCast')setText(ui['last-move'],e.name.toUpperCase()+' · '+e.hits+' CONTACT'+(e.hits===1?'':'S'));
    if(['lightningSetup','coverSetup','elementSetup','infusionSetup'].includes(e.type))syncMode();
    if(['coverNotice','elementNotice'].includes(e.type))banner(e.text,'COVER & ELEMENTS',2,1);
    if(e.type==='coverEnter'&&e.by==='player')setText(ui['last-move'],'IN COVER · '+e.name.toUpperCase());
    if(e.type==='elementCast'||e.type==='earthWall'||e.type==='fusionRelease'||e.type==='coating')setText(ui['last-move'],e.name.toUpperCase());
    if(e.type==='enemyParry'){banner('You were parried.','MIX YOUR TIMING.',.75,2);}
    if(e.type==='evade'){banner('Clean evade.','YOUR NEXT STRIKE IS A COUNTER.',.9,2);}
    if(e.type==='ko'&&!world.run.active){banner(world.isGroup()?'Group cleared.':world.mode==='sparring'?'Round '+world.round+' cleared.':'Clean finish.',world.isGroup()?'NEXT GROUP INCOMING':'PARTNER RESETS AUTOMATICALLY',1.7,4);}
    if(e.type==='defeat'){
      defeatAt=world.time;keys.clear();touchMove.clear();clearHeld();
      setText(ui.announcer,world.run.active?'Run over. Choose Try another run or Back to practice.':'Round over. Press R to try again.');
    }
    if(e.type==='demoStart'){syncMode();setText(ui['coach-status'],'WATCHING · TAKE OVER ANYTIME');}
    if(e.type==='demoEnd'){setText(ui['coach-status'],'NOW MAKE IT YOURS');}
  }
  world=new World(handleEvent);
  try{renderer=new window.CombatRenderer.Renderer(ui.arena,ui.effects,world);}
  catch(error){ui['graphics-error'].hidden=false;console.error('Combat renderer:',error.message);}
  if(renderer&&window.matchMedia?.('(pointer:coarse)').matches)renderer.setDetail('lean');
  function drawInputs(){ui['input-history'].innerHTML=(inputTokens.length?'<span class="input-label">PRESSED</span>':'')+inputTokens.map(k=>'<kbd>'+k+'</kbd>').join('');}
  function selectRoute(id){
    selected=ROUTES.find(r=>r.id===id)||ROUTES[0];coachChain='';completeUntil=0;
    setText(ui['coach-title'],selected.name);setText(ui['coach-note'],selected.note);
    ui['coach-keys'].innerHTML=selected.seq.split('').map((t,i)=>'<kbd title="'+window.CombatLab.MOVES[selected.steps[i]].name+'">'+KEY[t]+'</kbd>'+(i<selected.seq.length-1?'<span>›</span>':'')).join('');
    drawRoutes();updateCoach();
  }
  function drawRoutes(){
    const query=ui['route-search'].value.trim().toLowerCase(),keyQuery=query.replace(/[\s+>→›·,\-]/g,'').toUpperCase(),shown=ROUTES.filter(r=>(group==='All'||r.group===group)&&(!query||(r.name+' '+r.group+' '+r.note).toLowerCase().includes(query)||/^[A-Z0-9]+$/.test(keyQuery)&&r.seq.split('').map(t=>KEY[t]).join('').replace(/\s/g,'').includes(keyQuery)));
    setText(ui['library-count'],shown.length===ROUTES.length?ROUTES.length+' ROUTES':shown.length+' / '+ROUTES.length);
    ui['route-list'].innerHTML=shown.map(r=>{
      return '<button class="route-row'+(r.id===selected.id?' selected':'')+(completed.has(r.id)?' completed':'')+'" data-route="'+r.id+'" aria-pressed="'+(r.id===selected.id)+'"><div><strong>'+r.name+'</strong><small>'+r.group+' · '+r.seq.length+' steps</small><small class="mini-seq">'+r.seq.split('').map(k=>KEY[k]).join(' › ')+'</small></div><span class="route-arrow">↗</span></button>';
    }).join('')||'<p class="empty-routes">No matching routes. Try a move name or another category.</p>';
  }
  function updateCoach(){
    let progress=0;
    const chain=world.player.chain;
    if(coachChain&&selected.seq.startsWith(coachChain)&&chain)progress=coachChain.length;
    if(completeUntil>world.time)progress=selected.seq.length;
    const k=ui['coach-keys'].querySelectorAll('kbd');k.forEach((el,i)=>{el.classList.toggle('done',i<progress);el.classList.toggle('next',i===progress);});
    setText(ui['coach-progress'],progress+' / '+selected.seq.length);
    if(world.demo)setText(ui['coach-status'],'WATCHING · TAKE OVER ANYTIME');
    else if(progress===selected.seq.length)setText(ui['coach-status'],'ROUTE CONNECTED ✓');
    else if(progress)setText(ui['coach-status'],'KEEP THE RHYTHM');
    else setText(ui['coach-status'],'TRY THIS COMBO');
  }
  const attackKeys={Digit0:'0',Digit7:'7',Digit8:'8',Digit9:'9',Digit1:'1',Digit2:'2',Digit3:'3',Digit4:'4',Digit5:'5',Digit6:'6',KeyO:'E',KeyP:'L',KeyM:'Q',KeyJ:'P',KeyK:'K',KeyL:'H',KeyI:'U',KeyE:'G',KeyQ:'C',KeyZ:'S',KeyX:'T',KeyV:'R',KeyH:'W',KeyN:'J'};
  const LABELS={
    grabbed:{P:'Held',K:'Held',H:'Held',U:'Held',G:'Held',C:'Held',S:'Held',T:'Held',R:'Held'},
    balloon:{P:'Burst roll',K:'Bounce',H:'Belly drop',U:'Unroll launch',G:'Unroll grab',C:'Unroll',S:'Unroll punch',T:'Unroll kick',R:'Unroll reel'},
    standing:{P:'Punch',K:'Kick',H:'Heavy',U:'Launch',G:'Grab',C:'Grip switch'},
    air:{P:'Air punch',K:'Air kick',H:'Meteor',U:'Air palm',G:'Air catch',C:'Grip switch',S:'Air reach',T:'Air arc',R:'Reel down'},
    object:{P:'Swing',K:'Kick',H:'Heavy swing',U:'Launch',G:'Throw object',C:'Grip switch',S:'Stretch swing',T:'Whip kick',R:'Spring throw'},
    front:{P:'Elbow',K:'Knee',H:'Sweep',U:'Shoulder',G:'Hip toss',C:'Underhooks'},
    bodylock:{P:'Elbow',K:'Knee',H:'Belly suplex',U:'Body slam',G:'Suplex',C:'Rear control'},
    rear:{P:'Forearm',K:'Knee',H:'Back suplex',U:'German',G:'Mat return',C:'Collar tie'},
    ground:{P:'Ground jab',K:'Stomp',H:'Hammer',U:'Relaunch',G:'Pick up',C:'Mount'}
  };
  Object.assign(LABELS.standing,{S:'Elastic punch',T:'Whip kick',R:'Reel-in grab'});
  for(const context of ['front','bodylock','rear'])Object.assign(LABELS[context],{S:'Coiled body',T:'Knee',R:'Slingshot throw'});
  Object.assign(LABELS.ground,{S:'Elastic hammer',T:'Stomp',R:'Pick up'});
  for(const [context,labels] of Object.entries(LABELS)){labels.W=context==='grabbed'?'Held':context==='balloon'?'Unroll wind':context==='air'?'Sky current':'Wind palm';Object.assign(labels,{'1':'Earth wall','2':'Earth launch','3':'Seismic ring','4':'Ember shot','5':'Flame trail','6':'Furnace burst',N:'Vacuum pull',D:'Air dash',Z:'Cyclone',J:'Reload',V:context==='balloon'?'Unroll tempest':'Tempest kick',E:context==='balloon'?'Charge roll':'Chain spark',L:'Rising voltage',Q:'Thunderclap'});}
  const elementLabels={'0':'Release fusion','7':'Water dart','8':'Tidal lash','9':'Waterspout',e1:'Stone fist',e2:'Boulder pitch',e3:'Stone vault',f1:'Blazing uppercut',f2:'Comet heel',f3:'Flare rush',w1:'Riptide sweep',w2:'Hydro cannon',w3:'Tide step',a:'Crag uppercut',b:'Ridge breaker',c:'Quarry hammer',d:'Cinder jab',e:'Dragon breath',f:'Phoenix dive',g:'Current palm',h:'Undertow ring',i:'Waterwheel kick'};for(const labels of Object.values(LABELS))Object.assign(labels,elementLabels);
  LABELS.blaster={...LABELS.object,P:'Fire pulse',H:'Palm strike',S:'Gale shot',G:'Toss blaster'};
  let previousContext='';
  function updateGrappleHUD(){
    const g=world.grapple,ground=world.ground;
    const item=world.yard.held(world.player),grabbed=world.player.held,context=grabbed?'grabbed':world.player.balloon?'balloon':item?.type==='blaster'?'blaster':item?'object':world.tether?'front':g?(g.phase==='clinch'?g.grip:g.phase==='pickup'?'front':'ground'):world.enemy.down>.08&&world.airHeight(world.enemy)<.12&&!world.enemy.ko?'ground':world.airHeight(world.enemy)>.18?'air':'standing';
    const controlContext=context+':'+world.assistMode;
    if(controlContext!==previousContext){
      document.querySelectorAll('[data-attack]').forEach(b=>{if(b.dataset.attack==='0')return;const label=world.assistMode==='easy'&&!['grabbed','balloon'].includes(context)&&({P:'Auto combo',K:'Air mix',H:'Finish'})[b.dataset.attack]||LABELS[context][b.dataset.attack];setText(b.querySelector('span')||b,label);b.title=KEY[b.dataset.attack]+': '+label;b.disabled=grabbed;});previousContext=controlContext;
    }
    ui['grapple-hud'].hidden=!g&&!ground&&!world.tether;
    if(grabbed){
      setText(ui['grip-title'],g?.phase==='throw'?'CAUGHT IN A THROW':'ENEMY GRIP');setText(ui['grip-hint'],g?.phase==='throw'?'Brace for landing.':'TAP SPACE TO RESIST');setText(ui['grip-options'],g?.phase==='throw'?'Recover, then create an opening.':'Each escape attempt spends stamina.');ui['grip-control'].style.width=clamp(g?.control??100,0,100)+'%';
    }else if(world.tether){
      setText(ui['grip-title'],'REELING IN');setText(ui['grip-hint'],'QUEUE A CLINCH FOLLOW-UP');setText(ui['grip-options'],'E hip toss · Q underhooks · V slingshot');ui['grip-control'].style.width='100%';
    }else if(g){
      const names={front:'COLLAR TIE',bodylock:'BODY LOCK',rear:'REAR CONTROL'};
      setText(ui['grip-title'],g.phase==='clinch'?names[g.grip]:g.phase==='pickup'?'STANDING THEM UP':g.phase==='mount'?'MOVING TO MOUNT':'THROW IN MOTION');
      setText(ui['grip-hint'],g.phase==='clinch'?'J elbow · K knee · Space releases':'QUEUE J / K / L TO FOLLOW UP');
      setText(ui['grip-options'],g.phase==='clinch'?g.grip==='front'?'E hip toss · L sweep · I shoulder':g.grip==='bodylock'?'E suplex · L belly-to-belly · I slam':'E mat return · L back suplex · I German':'Damage lands with the opponent.');
      ui['grip-control'].style.width=clamp(g.control,0,100)+'%';
    }else if(ground){
      setText(ui['grip-title'],ground.mounted?'MOUNTED CONTROL':'GROUND FOLLOW-UP');
      setText(ui['grip-hint'],'J / K / L attack · Space steps away');
      setText(ui['grip-options'],'Q mount · E pick up · I relaunch');ui['grip-control'].style.width=clamp((ground.until-world.time)/2.1,0,1)*100+'%';
    }
    setText(ui.guard.querySelector('span'),world.player.balloon?'Brake':'Block / parry');
    const blocked=grabbed||world.player.ko||world.over;document.querySelectorAll('[data-attack]').forEach(b=>{if(b.dataset.attack==='0')return;const disabled=blocked||b.dataset.attack==='J'&&(item?.type!=='blaster'||item.ammo>=item.capacity);if(b.disabled!==disabled)b.disabled=disabled;});
    ui['gust-step'].disabled=blocked||!!world.player.balloon||!!g||!!world.tether||!!ground||!!world.player.dodge||world.player.down>0||world.player.stunned>0;
    ui.guard.disabled=blocked;ui['balloon-toggle'].disabled=blocked;ui['object-pickup'].disabled=blocked||!!world.player.balloon;ui['object-fetch'].disabled=blocked||!!world.player.balloon;
  }
  function updateFlow(){
    const b=world.player.balloon;
    if(b){ui['flow-hud'].hidden=false;const speed=Math.hypot(world.player.vx,world.player.vz);setText(ui['flow-state'],b.phase==='deflating'?'UNROLLING':b.drop?'BELLY DROP':b.braking?'BRAKING':speed>7?'BURST ROLL':'BALLOON FORM');setText(ui['flow-queued'],speed.toFixed(1)+' m/s');ui['flow-fill'].style.width=clamp(speed/10,0,1)*100+'%';ui['flow-hud'].dataset.phase='ROLL';setText(ui['flow-hint'],b.after.length?'Next: '+b.after.map(t=>KEY[t]).join(' › '):'J burst · Space bounce · L belly drop');return;}
    const p=world.player,a=p.action;ui['flow-hud'].hidden=!a&&!p.buffer.length;
    const phase=!a?'RECOVERING':a.t<a.move.startup?'WIND-UP':a.t<a.move.cancel?'CONTACT':'FOLLOW-UP';
    setText(ui['flow-state'],p.buffer.length?'NEXT MOVES QUEUED':phase);
    setText(ui['flow-queued'],p.buffer.map(b=>KEY[b.token]).join(' › '));
    ui['flow-fill'].style.width=(a?clamp(a.t/a.move.cancel,0,1)*100:0)+'%';ui['flow-hud'].dataset.phase=phase;
    setText(ui['flow-hint'],p.buffer.length?p.buffer.length+' / 4 queued · inputs play in order':world.airHeight(world.enemy)>.18?'J / K mix in the air · V reels down':world.grapple?.phase==='clinch'?'Alternate hands and knees · mix in Z':a?.move.elastic?'Change the reach · curve, coil, or reel':'Tap ahead · combine hands and feet');
  }
  function updateObjects(){
    const p=world.player,item=world.yard.held(p),near=world.yard.candidate(p,1.7),far=world.yard.candidate(p,5.9);
    ui['ammo-hud'].hidden=item?.type!=='blaster';if(item?.type==='blaster'){setText(ui['ammo-count'],item.ammo+' / '+item.capacity);setText(ui['ammo-note'],p.action?.move.reload?'RELOADING…':item.ammo?'PULSE · N RELOAD':'EMPTY · N RELOAD');}
    setText(ui['weapon-status'],item?.type==='blaster'?item.ammo+' / '+item.capacity+' rounds · N reload · Z uses 2 rounds + 20 wind':item?.gear?item.name+' · '+Math.ceil(item.health)+' durability · F drops':'Try a loadout · each button resets the practice setup.');
    if(p.balloon){setText(ui['object-status'],'Roll through loose props to send them flying.');setText(ui['object-hint'],'Light chairs scatter · heavy barrels bounce you back · C unrolls');return;}
    setText(ui['object-status'],item?item.name+' in hand':world.yard.retrieve?'Reeling in '+world.yard.retrieve.prop.name.toLowerCase():near?near.name+' within reach':far?far.name+' within stretching range':'Move close to an object or training weapon.');
    setText(ui['object-hint'],item?.type==='blaster'?'J fire · K kick · L palm strike · Z gale shot · N reload':item?.type==='staff'?'J thrust / sweep · I rising vault · L overhead · Z telescopes':item?'J swing · L heavy · Z stretch swing · E throw · V spring throw':'F picks up · B retrieves a distant object · Space releases a clinch');
    setText(ui['object-pickup'].querySelector('span'),item?'Drop '+item.name.toLowerCase():near?'Pick up '+near.name.toLowerCase():'Pick up');
  }
  function updateBalloon(){
    const b=world.player.balloon,active=!!b;
    ui['balloon-deck'].classList.toggle('active',active);ui['balloon-toggle'].setAttribute('aria-pressed',String(active));
    setText(ui['balloon-toggle'].querySelector('span'),b?.phase==='deflating'?'Unrolling…':active?'Unroll':'Inflate & roll');
    setText(ui['balloon-status'],b?'Pressure '+Math.round(b.pressure)+'% · '+(b.phase==='inflating'?'filling up':b.phase==='deflating'?'back to hands & feet':b.braking?'braking':Math.hypot(world.player.vx,world.player.vz)>7?'burst rolling':'ready to bounce'):'Make some room. Then become the bowling ball.');
    setText(ui['balloon-hint'],b?'WASD steer · J burst · Space bounce · L drop · I unroll → launch':'WASD steer · J burst · Space bounce · L belly drop · Shift brake');
    ui['balloon-pressure'].querySelector('i').style.width=(b?b.pressure:100)+'%';ui['balloon-pressure'].setAttribute('aria-valuenow',String(Math.round(b?.pressure??100)));
  }
  function updateRecap(){setText(ui['stat-breaks'],sessionTotals.broken);setText(ui['stat-springs'],sessionTotals.springs);setText(ui['stat-steps'],sessionTotals.steps);setText(ui['stat-props'],sessionTotals.props);setText(ui['session-summary'],sessionTotals.broken+' broken · '+sessionTotals.springs+' launches · '+sessionTotals.props+' object hits');}
  const moveCodes=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']);
  function manualAttack(token,literal=false){
    if(paused||ui['controls-modal'].open||world.run.blocked())return;
    awaken();if(literal){if(world.demo){world.demo=null;world.emit('demoEnd');}world.emit('controlInput',{token,key:KEY[token]});world.attack(token,true);}else world.attack(token);if(world.assistMode==='easy'&&token==='P')easyAt=world.time+.18;
  }
  function manualObject(kind){if(paused||ui['controls-modal'].open||world.run.blocked())return;awaken();world.interact(kind);ui.arena.focus({preventScroll:true});}
  function manualBalloon(){if(paused||ui['controls-modal'].open||world.run.blocked())return;awaken();world.emit('controlInput',{token:'O',key:'C'});world.balloon.toggle();ui.arena.focus({preventScroll:true});}
  function manualGust(){if(paused||ui['controls-modal'].open||world.run.blocked())return;awaken();moveInput();world.gustStep();ui.arena.focus({preventScroll:true});}
  function manualJump(){if(paused||ui['controls-modal'].open||world.run.blocked())return;awaken();moveInput();world.mobility.jump();ui.arena.focus({preventScroll:true});}
  function manualCoat(element){if(paused||ui['controls-modal'].open||world.run.blocked())return;awaken();world.emit('controlInput',{token:'COAT',key:({'fire':'SHIFT 1','lightning':'SHIFT 2','earth':'SHIFT 3','water':'SHIFT 4','off':'COAT OFF'})[element]});world.infusion.coat(element);ui.arena.focus({preventScroll:true});}
  function manualCover(){if(paused||ui['controls-modal'].open||world.run.blocked())return;awaken();world.cover.toggle();ui.arena.focus({preventScroll:true});}
  function manualAnchor(){if(paused||ui['controls-modal'].open||world.run.blocked())return;awaken();moveInput();world.mobility.anchor();ui.arena.focus({preventScroll:true});}
  const qDucks=()=>!world.grapple&&!world.tether&&!world.ground?.mounted&&!(world.enemy.down>.08&&world.airHeight(world.enemy)<.20)&&!world.player.balloon;
  function moveInput(){
    const raw=inputMap?.movement()||[0,0];let x=raw[0]+(touchMove.has('right')?1:0)-(touchMove.has('left')?1:0),z=raw[1]+(touchMove.has('down')?1:0)-(touchMove.has('up')?1:0),n=Math.max(1,Math.hypot(x,z));x/=n;z/=n;
    const yaw=renderer?renderer.yaw:.43;world.input.x=x*Math.cos(yaw)+z*Math.sin(yaw);world.input.z=z*Math.cos(yaw)-x*Math.sin(yaw);
    if((x||z)&&world.demo){world.demo=null;world.emit('demoEnd');}
    if(!paused&&!world.over){world.setGuard(!!inputMap?.held('guard')||ui.guard.classList.contains('held'));world.mobility.setDuck(!world.player.cover&&(inputMap?.held('duck')||inputMap?.held('attack:C')&&qDucks()||ui.duck.classList.contains('held')));}
    const touchPeek=document.querySelector('.cover-controls .held'),kind=touchPeek?.dataset.peek||(inputMap?.held('peekLeft')?'left':inputMap?.held('peekRight')?'right':inputMap?.held('attack:C')&&world.player.cover?'auto':null);if(!paused)world.cover.setPeek(kind,!!kind);
  }
  function inputAction(action,down,source){
    if(action==='cancel'){world.power?.cancel();world.setGuard(false);world.mobility.setDuck(false);return;}
    if(fieldUI?.dialog.open){if(action==='evade'&&down&&source==='gamepad')fieldUI.close();return;}
    if(action==='guide'&&down){fieldUI?.open();return;}if(action==='coach'&&down){if(fieldUI){fieldUI.pinned=!fieldUI.pinned;fieldUI.update();}return;}
    if(action==='wheel:choose'){controlUI?.choose(down);return;}if(action==='wheel:confirm'){controlUI?.select();return;}if(action==='wheel:close'){controlUI?.closeWheel();return;}
    if(action==='pause'&&down){if(!ui['controls-modal'].open&&!controlUI?.wheel.open)setPaused(!paused);return;}
    if(action==='power'&&!down){if(world.easyPowerKey){world.power.cancel();return;}if(paused||ui['controls-modal'].open)world.power.cancel();else world.power.release();return;}
    if(action==='powerthrow'&&!down){world.power.releaseThrow();return;}
    if(action==='attack:G'&&source==='gamepad'&&(world.grapple?.owner===world.player&&world.grapple.phase==='clinch'||world.player.action?.move.controlledThrow)){if(down&&!paused)world.power.beginThrow();else world.power.releaseThrow();return;}
    if(action==='guard'){if(!paused)world.setGuard(!!inputMap?.held('guard'));return;}
    if(action==='duck'){if(!paused)world.mobility.setDuck(!!inputMap?.held('duck'));return;}
    if(!down){if(action==='attack:C')world.mobility.setDuck(false);return;}
    if(action==='reset'){reset();return;}if(action==='wheel'){controlUI?.openWheel();return;}
    if(paused||ui['controls-modal'].open||world.run.blocked())return;
    if(['up','down','left','right'].includes(action))return;
    awaken();moveInput();
    if(action.startsWith('attack:')){const token=action.slice(7);if(token==='C'&&world.player.cover)world.cover.setPeek('auto',true);else if(token==='C'&&qDucks())world.mobility.setDuck(true);else manualAttack(token);return;}
    if(action.startsWith('coat:')){manualCoat(action.slice(5));return;}
    if(action==='jump')manualJump();if(action==='evade')world.dodge();if(action==='cover')manualCover();if(action==='target')world.cycleTarget();if(action==='windstep')manualGust();if(action==='pickup')manualObject('pickup');if(action==='anchor'){if(world.airHeight(world.player)>.10||world.player.mobility.anchor)manualAnchor();else manualObject('fetch');}if(action==='machine')world.useArena();if(action==='balloon')manualBalloon();
    if(action==='power'){if(world.easyPowerKey)world.power.quick('combo');else world.power.begin();}if(action==='utility')world.power.utility();if(action==='coat')world.power.coat();if(action==='powerthrow')world.power.beginThrow();if(action==='aim')world.power.toggleAim();
  }
  window.addEventListener('keydown',e=>{
    if(inputMap?.capture){e.preventDefault();inputMap.handle(e,true);return;}
    if(fieldUI?.dialog.open){if(inputMap?.actionFor(e)==='guide'){e.preventDefault();if(!e.repeat)fieldUI.close();}return;}
    if(controlUI?.wheel.open)return;
    if(ui['controls-modal'].open||world.run.blocked())return;
    if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return;
    if(e.code==='Enter'&&e.target instanceof HTMLButtonElement||e.code==='Space'&&e.target instanceof HTMLButtonElement)return;
    if(e.code==='Escape'){e.preventDefault();setPaused(!paused);return;}if(e.code==='Tab')return;
    if(paused&&!['reset','guide','coach'].includes(inputMap?.actionFor(e)))return;
    if(inputMap?.handle(e,true)){e.preventDefault();keys.add(e.code);}
  });
  window.addEventListener('keyup',e=>{keys.delete(e.code);inputMap?.handle(e,false);});
  window.addEventListener('blur',()=>{if(interaction&&!ui['controls-modal'].open&&!world.over)setPaused(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&interaction&&!world.over)setPaused(true);});
  document.querySelectorAll('[data-attack]').forEach(button=>button.addEventListener('pointerdown',e=>{
    e.preventDefault();manualAttack(button.dataset.attack);if(world.assistMode==='easy'&&button.dataset.attack==='P'&&!paused){button.setPointerCapture(e.pointerId);easyHeld=true;button.classList.add('held');}ui.arena.focus({preventScroll:true});
  }));
  for(const button of document.querySelectorAll('[data-attack="P"]'))for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{easyHeld=false;button.classList.remove('held');});
  document.querySelectorAll('[data-object]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();manualObject(b.dataset.object);});b.addEventListener('click',e=>{if(e.detail===0)manualObject(b.dataset.object);});});
  ui['machine-use'].addEventListener('click',()=>{if(paused)return;awaken();world.useArena();ui.arena.focus({preventScroll:true});});
  ui['gust-step'].addEventListener('click',manualGust);
  document.querySelectorAll('[data-weapon]').forEach(b=>b.addEventListener('click',()=>{awaken();world.arsenal.stage(b.dataset.weapon);setPaused(false);syncMode();ui.arena.focus({preventScroll:true});}));
  document.querySelectorAll('[data-study]').forEach(b=>b.addEventListener('click',()=>{awaken();if(b.dataset.study==='impact'){world.mode='practice';world.dummy='active';world.infinite=true;world.reset();world.player.health=world.player.maxHealth=500;world.enemy.health=world.enemy.maxHealth=1000;}else world.watch(b.dataset.study);world.practiceSpeed=.75;setPaused(false);syncMode();if(renderer){renderer.zoom=7.4;renderer.yaw=.43;}ui.arena.focus({preventScroll:true});}));
  ui['foundry-visit'].addEventListener('click',()=>{world.setArena('foundry');awaken();setPaused(false);syncMode();savePreferences();});
  document.querySelectorAll('[data-trial]').forEach(b=>b.addEventListener('click',()=>{awaken();world.trials.start(b.dataset.trial);setPaused(false);syncMode();}));
  ui['trial-retry'].addEventListener('click',()=>{world.trials.start(world.trials.lastId);setPaused(false);syncMode();});
  ui['trial-leave'].addEventListener('click',()=>{world.trials.cancel();setPaused(false);syncMode();});
  ui['wind-stage'].addEventListener('click',()=>{awaken();world.wind.stage();setPaused(false);syncMode();});
  ui['cycle-target'].addEventListener('click',()=>{awaken();world.cycleTarget();ui.arena.focus({preventScroll:true});});
  ui['target-list'].addEventListener('click',e=>{const b=e.target.closest('[data-target]');if(b){awaken();world.selectTarget(b.dataset.target);ui.arena.focus({preventScroll:true});}});
  for(const id of ['group-count','group-mix','group-behavior'])ui[id].addEventListener('change',()=>{world.setGroup(ui['group-count'].value,ui['group-mix'].value,ui['group-behavior'].value);syncMode();setPaused(false);savePreferences();});
  ui['balloon-toggle'].addEventListener('click',manualBalloon);
  ui['balloon-stage'].addEventListener('click',()=>{world.yard.stage('balloon');awaken();setPaused(false);syncMode();world.balloon.toggle();banner('Be the bowling ball.','J BURST → I UNROLL & LAUNCH → J → K',2,2);});
  const yardHints={table:'E → E: grab and hip-throw into the table. Walk the clinch closer if needed.',wall:'L → K: power straight into a push kick. Drive your opponent into the wall.',chair:'F → J → K → L → E: pick up, mix a kick into the swings, then throw.',stretch:'B retrieves the distant chair. J or Z swings it; V spring-throws it.',spring:'The partner starts on a spring pad. Walk onto it too, then mix J / K / Z / X while airborne.',divider:'L → K drives through the divider. Heavy strikes and balloon bursts can also break it.',bag:'Z → Z → L sends elastic hits through the swing bag. Let its momentum hit the partner behind it.',duel:'A live boxer circles and defends. Connect a three-hit string to complete this challenge. Mix fast hands with kicks.'};
  document.querySelectorAll('[data-yard-drill]').forEach(b=>b.addEventListener('click',()=>{const kind=b.dataset.yardDrill;if(kind==='duel'){world.opponentStyle='boxer';world.setMode('sparring');}else world.yard.stage(kind);awaken();setPaused(false);syncMode();setText(ui['yard-hint'],yardHints[kind]);}));
  document.querySelectorAll('[data-move]').forEach(button=>{
    const stop=e=>{touchMove.delete(button.dataset.move);button.classList.remove('held');};
    button.addEventListener('pointerdown',e=>{e.preventDefault();if(paused)return;button.setPointerCapture(e.pointerId);touchMove.add(button.dataset.move);button.classList.add('held');awaken();ui.arena.focus({preventScroll:true});});
    button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);button.addEventListener('lostpointercapture',stop);
  });
  ui.dodge.addEventListener('pointerdown',e=>{e.preventDefault();if(paused)return;awaken();moveInput();world.dodge();ui.arena.focus({preventScroll:true});});
  document.querySelectorAll('[data-coat]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();manualCoat(b.dataset.coat);});b.addEventListener('click',e=>{if(e.detail===0)manualCoat(b.dataset.coat);});});
  document.querySelectorAll('[data-infusion-lab]').forEach(b=>b.addEventListener('click',()=>{awaken();world.infusion.stage(b.dataset.infusionLab);setPaused(false);syncMode();ui.arena.focus({preventScroll:true});}));
  document.querySelectorAll('[data-fusion-demo]').forEach(b=>b.addEventListener('click',()=>{awaken();world.infusion.stageRecipe(b.dataset.fusionDemo);setPaused(false);syncMode();ui.arena.focus({preventScroll:true});}));
  ui['cover-toggle'].addEventListener('pointerdown',e=>{e.preventDefault();manualCover();});ui['cover-toggle'].addEventListener('click',e=>{if(e.detail===0)manualCover();});
  document.querySelectorAll('[data-peek]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();if(paused||world.run.blocked()||!world.player.cover)return;b.setPointerCapture(e.pointerId);b.classList.add('held');awaken();world.cover.setPeek(b.dataset.peek);ui.arena.focus({preventScroll:true});});for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])b.addEventListener(event,()=>{b.classList.remove('held');world.cover.setPeek(null,false);});b.addEventListener('keydown',e=>{if(!['Space','Enter'].includes(e.code)||paused||!world.player.cover)return;e.preventDefault();b.classList.add('held');awaken();world.cover.setPeek(b.dataset.peek);});b.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();b.classList.remove('held');world.cover.setPeek(null,false);}});});
  document.querySelectorAll('[data-cover-lab]').forEach(b=>b.addEventListener('click',()=>{awaken();world.cover.stage(b.dataset.coverLab==='live');setPaused(false);syncMode();ui.arena.focus({preventScroll:true});}));
  document.getElementById('element-stage').addEventListener('click',()=>{awaken();world.elements.stage();setPaused(false);syncMode();ui.arena.focus({preventScroll:true});});
  ui.jump.addEventListener('pointerdown',e=>{e.preventDefault();manualJump();});
  ui.anchor.addEventListener('pointerdown',e=>{e.preventDefault();manualAnchor();});
  ui.duck.addEventListener('pointerdown',e=>{e.preventDefault();if(paused||world.run.blocked())return;ui.duck.setPointerCapture(e.pointerId);ui.duck.classList.add('held');awaken();world.mobility.setDuck(true);ui.arena.focus({preventScroll:true});});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])ui.duck.addEventListener(ev,()=>{ui.duck.classList.remove('held');world.mobility.setDuck(false);});
  ui.guard.addEventListener('pointerdown',e=>{e.preventDefault();if(paused)return;ui.guard.setPointerCapture(e.pointerId);ui.guard.classList.add('held');awaken();world.setGuard(true);});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])ui.guard.addEventListener(ev,()=>{ui.guard.classList.remove('held');world.setGuard(false);});
  // Click handlers also support keyboard activation of the visible controls.
  document.querySelectorAll('[data-attack]').forEach(b=>b.addEventListener('click',e=>{if(e.detail===0)manualAttack(b.dataset.attack);}));
  ui.dodge.addEventListener('click',e=>{if(e.detail===0&&!paused)world.dodge();});
  ui.jump.addEventListener('click',e=>{if(e.detail===0)manualJump();});ui.anchor.addEventListener('click',e=>{if(e.detail===0)manualAnchor();});
  ui.duck.addEventListener('click',e=>{if(e.detail===0&&!paused){world.mobility.setDuck(true);ui.duck.classList.add('held');setTimeout(()=>{ui.duck.classList.remove('held');world.mobility.setDuck(false);},350);}});
  ui.guard.addEventListener('click',e=>{if(e.detail===0&&!paused){world.setGuard(true);setTimeout(()=>world.setGuard(false),200);}});
  document.querySelectorAll('[data-assist]').forEach(b=>b.addEventListener('click',()=>{easyHeld=false;world.setAssist(b.dataset.assist);savePreferences();ui.arena.focus({preventScroll:true});}));
  ui['assist-style'].addEventListener('change',()=>{world.setAssist(world.assistMode,ui['assist-style'].value);savePreferences();ui.arena.focus({preventScroll:true});});
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{world.setMode(b.dataset.mode);setPaused(false);awaken();syncMode();}));
  document.querySelectorAll('[data-arena]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.arena!==world.arenaId){world.setArena(b.dataset.arena);setPaused(false);awaken();syncMode();savePreferences();logEvent('Arena changed to '+world.yard.layout.name+'.');}}));
  ui['opponent-style'].addEventListener('change',()=>{world.setOpponent(ui['opponent-style'].value,world.difficulty);syncMode();setPaused(false);savePreferences();});
  ui.difficulty.addEventListener('change',()=>{world.setOpponent(world.opponentStyle,ui.difficulty.value);syncMode();setPaused(false);savePreferences();});
  ui['practice-speed'].addEventListener('change',()=>{world.practiceSpeed=clamp(Number(ui['practice-speed'].value),.5,1);savePreferences();});
  ui['scene-detail'].addEventListener('change',()=>{renderer?.setDetail(ui['scene-detail'].value);savePreferences();});
  ui.hazards.addEventListener('change',()=>{world.hazards=ui.hazards.checked;savePreferences();});
  ui['route-search'].addEventListener('input',drawRoutes);
  document.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>{
    group=b.dataset.group;document.querySelectorAll('[data-group]').forEach(el=>{const active=el===b;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});drawRoutes();ui['route-list'].scrollTop=0;
  }));
  ui['route-list'].addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(b)selectRoute(b.dataset.route);});
  document.querySelectorAll('[data-load-element-route]').forEach(b=>b.addEventListener('click',()=>{selectRoute(b.dataset.loadElementRoute);const route=selected;playUI.bank('elements');playUI.elementBank(route.group.toLowerCase());playUI.elementPage('more');ui['coach-title'].focus({preventScroll:true});banner(route.name,'Follow the coach or press Watch.',1.6,2);}));
  ui.watch.addEventListener('click',()=>{awaken();setPaused(false);world.watch(selected.id);syncMode();});
  function reset(){inputMap?.clear();if(world.trials.run)world.trials.start(world.trials.lastId);else world.reset();setPaused(false);syncMode();}
  ui.reset.addEventListener('click',reset);ui.retry.addEventListener('click',reset);
  ui.pause.addEventListener('click',()=>setPaused(!paused));ui.resume.addEventListener('click',()=>setPaused(false));
  ui.dummy.addEventListener('change',()=>{world.dummy=ui.dummy.value;world.reset();syncMode();setPaused(false);});
  ui.infinite.addEventListener('change',()=>{world.infinite=ui.infinite.checked;});
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){ui.impact.checked=false;if(renderer)renderer.impact=false;}
  ui.impact.addEventListener('change',()=>{if(renderer)renderer.impact=ui.impact.checked;});
  ui.lock.addEventListener('click',()=>{world.locked=!world.locked;ui.lock.setAttribute('aria-pressed',world.locked);ui.lock.querySelector('span').textContent=world.locked?'ON':'OFF';});
  ui.sound.addEventListener('click',()=>{soundOn=!soundOn;startAudio();ui.sound.setAttribute('aria-pressed',soundOn);setText(ui['sound-label'],soundOn?'Sound on':'Sound off');if(soundOn)tone(500,.08,.04);});
  ui.controls.addEventListener('click',()=>{previousModalPause=paused;setPaused(true);ui['pause-overlay'].hidden=true;ui['controls-modal'].showModal();});
  function restoreControlsPause(){
    if(ui['controls-modal'].open||previousModalPause===null)return;
    const value=previousModalPause;previousModalPause=null;setPaused(value);
  }
  function closeControls(){ui['controls-modal'].close();restoreControlsPause();}
  ui['close-controls'].addEventListener('click',closeControls);ui['got-it'].addEventListener('click',closeControls);
  ui['controls-modal'].addEventListener('cancel',e=>{e.preventDefault();closeControls();});
  ui['controls-modal'].addEventListener('close',restoreControlsPause);
  ui['controls-modal'].addEventListener('click',e=>{if(e.target===ui['controls-modal']){const r=ui['controls-modal'].getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeControls();}});
  ui.recenter.addEventListener('click',()=>{if(renderer){renderer.yaw=.43;renderer.zoom=8.15;renderer.cameraTilt=0;renderer.camera.reset();}ui.arena.focus({preventScroll:true});});
  let expanded=false,toolsWereOpen=true,nativeOwned=false;
  function expandArena(value){
    expanded=value;document.querySelector('.play-area').classList.toggle('expanded',expanded);
    const tools=document.querySelector('.sandbox-tools');if(expanded){toolsWereOpen=tools.open;tools.open=true;}else tools.open=toolsWereOpen;
    document.body.style.overflow=expanded?'hidden':'';ui.fullscreen.textContent=expanded?'↙':'⛶';ui.fullscreen.setAttribute('aria-label',expanded?'Exit expanded arena':'Expand arena');
    requestAnimationFrame(()=>{if(renderer)renderer.resize();ui.arena.focus({preventScroll:true});});
    fieldUI?.update();quickUI?.update();encounterUI?.update();
  }
  ui.fullscreen.addEventListener('click',()=>{const next=!expanded;expandArena(next);if(next&&document.documentElement?.requestFullscreen){document.documentElement.requestFullscreen().then(()=>{nativeOwned=true;}).catch(()=>{nativeOwned=false;});}else if(!next&&nativeOwned&&document.fullscreenElement){nativeOwned=false;document.exitFullscreen?.().catch(()=>{});}});
  document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement){for(const dialog of document.querySelectorAll('dialog'))if(dialog.open){dialog.close();dialog.showModal();}}else if(nativeOwned){nativeOwned=false;expandArena(false);}});
  ui.arena.addEventListener('pointerdown',e=>{if(!renderer)return;awaken();ui.arena.focus({preventScroll:true});ui.arena.setPointerCapture(e.pointerId);if(e.button===2){world.power.aim.active=true;}if(world.power.aim.active){aimPointers.add(e.pointerId);const point=renderer.aimAt(e.clientX,e.clientY);if(point)world.power.setAim(point);}else playUI.gesture.down(e.pointerId,e.clientX,e.clientY);});
  ui.arena.addEventListener('pointermove',e=>{if(!renderer)return;if(aimPointers.has(e.pointerId)){const point=renderer.aimAt(e.clientX,e.clientY);if(point)world.power.setAim(point);}else playUI.gesture.move(e.pointerId,e.clientX,e.clientY);});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])ui.arena.addEventListener(ev,e=>{aimPointers.delete(e.pointerId);playUI.gesture?.up(e.pointerId);});
  ui.arena.addEventListener('wheel',e=>{if(!renderer)return;e.preventDefault();renderer.zoom=clamp(renderer.zoom+e.deltaY*.006,5.5,13);},{passive:false});
  ui.arena.addEventListener('contextmenu',e=>e.preventDefault());
  ui.arena.addEventListener('webglcontextlost',e=>{e.preventDefault();setPaused(true);ui['pause-overlay'].hidden=true;ui['graphics-error'].hidden=false;ui['graphics-error'].querySelector('h2').textContent='The 3D view was interrupted.';ui['graphics-error'].querySelector('p').textContent='Reload this page to return to the arena.';});
  if(renderer)new ResizeObserver(()=>renderer.resize()).observe(ui.viewport);
  let quickUI=null,encounterUI=null;
  let prev=performance.now(),lastCoach=0;
  function frame(now){
    const dt=Math.min((now-prev)/1000,.05);prev=now;
    try{inputMap?.poll(window.navigator?.getGamepads?.()||[],dt);}catch{}
    if(!paused&&!ui['controls-modal'].open){const axes=inputMap?.aimAxes||[0,0],yaw=renderer?.yaw||0;world.power.moveAim(axes[0]*Math.cos(yaw)+axes[1]*Math.sin(yaw),axes[1]*Math.cos(yaw)-axes[0]*Math.sin(yaw),dt);moveInput();if(world.assistMode==='easy'&&!world.player.balloon&&!world.player.guard&&!world.player.dodge&&(easyHeld||inputMap?.held('attack:P'))&&world.time>=easyAt){world.attack('P');easyAt=world.time+.18;}world.step(dt);}
    if(renderer)renderer.frame(paused?0:dt);
    const p=world.player,e=world.enemy;
    ui['player-health'].style.width=p.health/p.maxHealth*100+'%';ui['enemy-health'].style.width=e.health/e.maxHealth*100+'%';ui['enemy-stamina'].style.width=e.stamina+'%';
    ui['player-stamina'].style.width=p.stamina+'%';setText(ui['stamina-label'],world.freePlayer()?'∞':Math.round(p.stamina));
    const doll=renderer?.ragdolls.player;
    setText(ui['player-state'],p.ko?'DOWN':p.held?'HELD · SPACE':p.balloon?'BALLOON':p.down>0?'FALLING / DOWN':doll?.recovery<.9?'RECOVERING':world.grapple?'GRAPPLING':world.ground?.mounted?'MOUNT':p.mobility.anchor?'ANCHOR PULL':p.mobility.crouch>.5?'DUCKING':p.guard?'GUARD':p.dodge?'EVADE':p.y>.2&&!world.mobility.grounded()?'AIRBORNE':'READY');
    setText(ui['enemy-state'],e.ko?world.boss.active?'DEFEATED':world.run.active?'WAVE CLEAR':'RESETTING…':e.held?'CONNECTED · CONTROLLED':e.down>.08?'DOWN · KEEP CHAINING':e.action?e.action.move.name.toUpperCase():world.mode==='sparring'||world.isGroup()||world.dummy==='footwork'?(e.intent||'READING').toUpperCase():world.dummy==='guard'?'GUARDING · BREAK OR GRAB':world.dummy==='counter'?'PARRY DRILL · TAP SHIFT':world.dummy==='active'?'COMBO / IMPACT DRILL':'PASSIVE · AUTO RESET');
    setText(ui['enemy-title'],world.boss.active?'ROOK · KILN WARDEN':world.isGroup()?e.name.toUpperCase():world.mode==='sparring'?'SPARRING PARTNER':'TRAINING PARTNER');
    updateGrappleHUD();updateFlow();updateTargets();playUI.movementUI();playUI.infusionUI();controlUI?.update();fieldUI?.update();quickUI?.update();encounterUI?.update();
    if(world.over&&!world.run.active&&!world.boss.active&&world.time>defeatAt+1.15)ui['defeat-overlay'].hidden=false;
    setText(ui['round-icon'],world.mode==='practice'?'∞':String(world.round).padStart(2,'0'));setText(ui['round-label'],world.boss.active?'BOSS':world.run.active?'WAVE':world.isGroup()?'GROUP':world.mode==='practice'?'PRACTICE':'ROUND');
    ui['combo-hud'].classList.toggle('visible',p.hits>0);setText(ui['hit-number'],p.hits);setText(ui['combo-damage'],p.damage);
    setText(ui['combo-rank'],p.hits>=8?'UNSTOPPABLE':p.hits>=5?'IN THE FLOW':p.hits>=3?'CONNECTED':'MAKE IT FLOW');
    setText(ui['best-hits'],String(world.best).padStart(2,'0'));setText(ui['best-damage'],world.bestDamage);setText(ui['total-hits'],world.totalHits);setText(ui.parries,world.parries);
    if(now/1000>bannerUntil)ui['event-banner'].classList.remove('visible');
    if(inputTokens.length&&now/1000-lastAttackAt>3){inputTokens=[];drawInputs();}
    if(now-lastCoach>70){updateCoach();updateObjects();updateBalloon();updateWind();updateMachines();updateTrial();updateRecap();playUI.update();lastCoach=now;}
    requestAnimationFrame(frame);
  }
  setText(ui['route-count'],ROUTES.length+' COMBO ROUTES');setText(ui['library-count'],ROUTES.length+' ROUTES');
  inputMap=new window.CombatInputMap.InputMap(inputAction,()=>{try{localStorage.setItem('kinetic-input-v1',JSON.stringify(inputMap.bindings));}catch{}if(controlUI)controlUI.renderBindings();});
  try{inputMap.load(JSON.parse(localStorage.getItem('kinetic-input-v1')||'null'));}catch{}
  restorePreferences();restoreTrialBests();try{world.journal.load(JSON.parse(localStorage.getItem('kinetic-journal-v1')));}catch{}selectRoute(selected.id);syncMode();
  const playUI=new window.CombatPlayUI.PlayUI({world,renderer,manualAttack,manualBalloon,manualGust,clearHeld,keys,touchMove,awaken,setPaused,syncMode,savePreferences,isPaused:()=>paused});
  controlUI=new window.CombatControlUI.ControlUI({world,renderer,bindings:inputMap,awaken,setPaused,isPaused:()=>paused,clearInputs:()=>{inputMap.clear();playUI.clearInputs();},savePreferences,syncMode,onSelect:()=>playUI.bank('flow'),onBindings:()=>selectRoute(selected.id)});
  fieldUI=new window.CombatFieldGuide.FieldGuide({world,bindings:inputMap,awaken,setPaused,isPaused:()=>paused,clearInputs:()=>{inputMap.clear();playUI.clearInputs();},selectRoute,syncMode,savePreferences,setBank:name=>playUI.bank(name),prepareControls:p=>{playUI.bank(p.bank);if(p.element){playUI.elementBank(p.element);playUI.elementPage(p.page);}},getCoach:()=>({route:selected,progress:Number(ui['coach-progress'].textContent.split('/')[0])||0})});
  requestAnimationFrame(frame);
  // Read-only state is useful when assessing or extending this prototype.
  quickUI=new window.CombatQuickPowers.QuickPowers({world,onKeyMode:()=>controlUI.renderBindings(),guide:fieldUI,bindings:inputMap,isPaused:()=>paused,awaken,savePreferences,setBank:name=>playUI.bank(name)});
  encounterUI=new window.CombatEncounterUI.EncounterUI({world,guide:fieldUI,awaken,setPaused,clearInputs:()=>{inputMap.clear();playUI.clearInputs();},syncMode});
  window.CombatStudio?.init({world,renderer});
  window.kinetic={world,renderer,inputs:inputMap,controls:controlUI,guide:fieldUI,getState:()=>world.snapshot()};
})();
