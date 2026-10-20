/* Kinetic: deterministic combat simulation, independent of rendering. */
(function (root) {
  'use strict';
  const {DistrictJournal}=root.CombatJournal||(typeof require==='function'?require('./journal.js'):null);
  const {BossEncounter}=root.CombatBoss||(typeof require==='function'?require('./boss.js'):null);
  const {WaveRun,ENV}=root.CombatRun||(typeof require==='function'?require('./run.js'):null);
  const Lightning=(root.CombatLightning||(typeof require==='function'?require('./lightning.js'):null)).Lightning;
  const EnemyTeam=(root.CombatTeam||(typeof require==='function'?require('./team.js'):null)).EnemyTeam;
  const ContactAPI=root.CombatContact||(typeof require==='function'?require('./contact.js'):null);
  const {Cover}=root.CombatCover||(typeof require==='function'?require('./cover.js'):null);
  const InfusionAPI=root.CombatInfusion||(typeof require==='function'?require('./infusion.js'):null);
  const {ElementPhysics}=root.CombatElementPhysics||(typeof require==='function'?require('./element-physics.js'):null);
  const {PowerControl}=root.CombatPowerControl||(typeof require==='function'?require('./power-control.js'):null);
  const ElementsAPI=root.CombatElements||(typeof require==='function'?require('./elements.js'):null);
  const Mobility=(root.CombatMobility||(typeof require==='function'?require('./mobility.js'):null)).Mobility;
  const FlowAPI=root.CombatFlow||(typeof require==='function'?require('./flow.js'):null);
  const Wrestling=root.CombatWrestling||(typeof require==='function'?require('./wrestling.js'):null);
  const Yard=(root.CombatYard||(typeof require==='function'?require('./yard.js'):null)).Yard;
  const Balloon=(root.CombatBalloon||(typeof require==='function'?require('./balloon.js'):null)).Balloon;
  const {ComboAssist,TOKENS:ASSIST_TOKENS,REQUESTS:ASSIST_REQUESTS}=root.CombatAssist||(typeof require==='function'?require('./assist.js'):null);
  const Trials=(root.CombatTrials||(typeof require==='function'?require('./trials.js'):null)).Trials;
  const Wind=(root.CombatWind||(typeof require==='function'?require('./wind.js'):null)).Wind;
  const ArsenalAPI=root.CombatArsenal||(typeof require==='function'?require('./arsenal.js'):null);
  const {Opponent,STYLES,LEVELS,VARIANTS}=root.CombatOpponent||(typeof require==='function'?require('./opponent.js'):null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const KEY = { '0':'0','7':'7','8':'8','9':'9',e1:'STONE',e2:'BOULDER',e3:'VAULT',f1:'BLAZE',f2:'COMET',f3:'FLARE',w1:'RIPTIDE',w2:'HYDRO',w3:'TIDE', '1':'1','2':'2','3':'3','4':'4','5':'5','6':'6', E:'O',L:'P',Q:'M', P: 'J', K: 'K', H: 'L', U: 'I', G: 'E', C: 'Q', S:'Z', T:'X', R:'V',F:'F',B:'B',O:'C',W:'H',A:'J',Y:'K',M:'L',N:'PULL',D:'DASH',Z:'STORM',J:'N',V:'SPIRAL' };
  const smooth = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const makeMove = (name, pose, damage, cost, startup, duration, range, extra = {}) => ({
    name, pose, damage, cost, startup, duration, range,
    cancel: Math.min(duration * .72, startup + .085), push: .17, stun: .28, lunge: .16, ...extra
  });
  const MOVES = {
    arcbolt:makeMove('Chain spark','arcCast',18,8,.23,.52,5.2,{lightning:'arc',focus:20,lunge:0,push:0}),
    voltlift:makeMove('Rising voltage','voltageLift',16,10,.28,.59,3.8,{lightning:'lift',focus:25,lunge:0,push:0}),
    thunderclap:makeMove('Thunderclap','thunderclap',25,15,.42,.83,2.35,{lightning:'clap',focus:38,lunge:0,push:0,finish:true}),
    vacuum:makeMove('Vacuum sweep','vacuum',9,9,.22,.58,5.1,{wind:'vacuum',focus:22,cancel:.35,lunge:0}),
    slipstream:makeMove('Slipstream palm','windDash',16,10,.30,.62,4.8,{wind:'dash',focus:24,cancel:.43,lunge:0}),
    cyclone:makeMove('Cyclone cradle','cyclone',8,12,.26,.86,5.1,{wind:'cyclone',focus:32,cancel:.46,lunge:0}),
    gale:makeMove('Gale palm','gale',13,8,.19,.54,5.1,{wind:'gale',focus:18,cancel:.32,lunge:0}),
    updraft:makeMove('Updraft','updraft',12,10,.24,.62,5.1,{wind:'updraft',focus:24,cancel:.36,lunge:0,launch:true}),
    skycurrent:makeMove('Sky current','updraft',11,8,.17,.49,5.1,{wind:'sky',focus:20,cancel:.30,lunge:0,air:true}),
    downburst:makeMove('Downburst','downburst',23,12,.25,.64,5.1,{wind:'downburst',focus:22,cancel:.44,lunge:0,finish:true,slam:true}),
    propPickup:makeMove('Pick up object','propPickup',0,4,.18,.47,1.8,{propPickup:true,cancel:.43}),
    propFetch:makeMove('Elastic object grab','propFetch',0,9,.22,.74,5.9,{propFetch:true,elasticProp:true,cancel:.65}),
    propThrow:makeMove('Object throw','propThrow',0,8,.21,.50,6,{propThrow:true,cancel:.43}),
    propPower:makeMove('Spring-loaded throw','propThrow',0,13,.28,.62,8,{propThrow:true,powerThrow:true,elasticProp:true,cancel:.54}),
    weaponSwing:makeMove('Object swing','weaponSwing',17,9,.18,.44,2.35,{weapon:true,push:.35}),
    weaponBack:makeMove('Object backhand','weaponBack',20,10,.20,.48,2.4,{weapon:true,push:.30}),
    weaponHeavy:makeMove('Heavy object swing','weaponHeavy',26,14,.27,.60,2.5,{weapon:true,break:true,finish:true,push:.65}),
    weaponStretch:makeMove('Elastic object swing','weaponSwing',23,14,.28,.62,4.8,{weapon:true,elasticProp:true,push:.4}),
    jab: makeMove('Lead jab', 'jab', 6, 4, .10, .30, 1.8),
    cross: makeMove('Straight cross', 'cross', 9, 5, .13, .35, 1.95, { push: .12 }),
    hook: makeMove('Lead hook', 'hook', 12, 6, .16, .40, 1.9),
    flurry: makeMove('Rapid straight', 'cross', 17, 9, .15, .43, 2.1, { push: .65, finish: true }),
    overhand: makeMove('Crushing overhand', 'overhand', 22, 12, .23, .57, 2.1, { push: .65, break: true, finish: true }),
    bodyhook: makeMove('Liver hook', 'body', 13, 8, .16, .42, 1.85, { stun: .34 }),
    elbow: makeMove('Stepping elbow', 'elbow', 19, 9, .15, .43, 1.8, { push: .35, finish: true }),
    backfist: makeMove('Spinning backfist', 'backfist', 18, 9, .19, .46, 2.1, { push: .5, finish: true }),
    hammer: makeMove('Hammer fist', 'hammer', 24, 14, .25, .60, 2.05, { slam: true, break: true, finish: true }),
    heavy: makeMove('Power straight', 'cross', 17, 10, .23, .50, 2.15, { lunge: .28, push: .28, stun: .32 }),
    lowkick: makeMove('Inside low kick', 'lowkick', 10, 6, .17, .41, 2.15, { stun: .3, push: .08 }),
    frontkick: makeMove('Snap front kick', 'frontkick', 12, 7, .18, .43, 2.3, { push: .13 }),
    roundhouse: makeMove('Body roundhouse', 'roundhouse', 16, 8, .20, .46, 2.3, { push: .18 }),
    switchkick: makeMove('Switch roundhouse', 'roundhouse', 21, 11, .20, .48, 2.45, { push: .7, finish: true }),
    crescent: makeMove('Crescent kick', 'spinkick', 21, 11, .22, .52, 2.4, { push: .6, finish: true }),
    tornado: makeMove('Tornado kick', 'spinkick', 27, 15, .28, .65, 2.5, { push: .8, break: true, finish: true }),
    heel: makeMove('Spinning heel', 'spinkick', 26, 13, .26, .60, 2.45, { push: .75, finish: true }),
    sidekick: makeMove('Driving side kick', 'sidekick', 23, 12, .24, .55, 2.5, { push: .85, break: true, finish: true }),
    pushkick: makeMove('Push kick', 'frontkick', 18, 10, .22, .51, 2.5, { push: .9, finish: true }),
    spinelbow: makeMove('Turning elbow', 'backfist', 16, 9, .20, .46, 2.1, { stun: .36, push: .08 }),
    knee: makeMove('Rising knee', 'knee', 23, 12, .21, .50, 1.95, { stun: .5, push: .35, finish: true }),
    upper: makeMove('Rising uppercut', 'uppercut', 15, 12, .21, .50, 2.05, { launch: true, push: .07, stun: .65 }),
    airjab: makeMove('Air straight', 'airpunch', 10, 6, .12, .33, 2.35, { air: true, push: .04, stun: .4 }),
    aircross: makeMove('Air cross', 'airpunch', 17, 8, .14, .40, 2.35, { air: true, push: .3, stun: .4, finish: true }),
    airkick: makeMove('Air roundhouse', 'airkick', 16, 8, .18, .43, 2.45, { air: true, push: .07, stun: .4 }),
    airslam: makeMove('Meteor heel', 'slam', 28, 14, .22, .56, 2.65, { air: true, slam: true, push: .3, finish: true }),
    clinch: makeMove('Clinch entry', 'clinch', 3, 7, .13, .36, 2.05, { grab: true, capture: true, stun: .75, push: 0, lunge: .24 }),
    clinchelbow: makeMove('Clinch elbow', 'elbow', 14, 7, .13, .35, 1.9, { grab: true, heldStrike: true, stun: .4, push: 0 }),
    clinchfinish: makeMove('Clinch back elbow', 'elbow', 19, 9, .17, .41, 1.9, { grab: true, heldStrike: true, stun: .4, push: 0 }),
    clinchknee: makeMove('Clinch knee', 'knee', 20, 9, .18, .43, 2.05, { grab: true, heldStrike: true, stun: .4, push: 0 }),
    underhook: makeMove('Double underhooks', 'underhook', 0, 4, .22, .40, 1.9, { grab: true, grip: 'bodylock', push: 0 }),
    armdrag: makeMove('Arm drag to rear control', 'armdrag', 0, 5, .26, .46, 1.9, { grab: true, grip: 'rear', push: 0 }),
    resetgrip: makeMove('Return to collar tie', 'clinch', 0, 3, .20, .37, 1.9, { grab: true, grip: 'front', push: 0 }),
    throw: makeMove('Hip throw', 'throw', 30, 14, .72, .99, 2.4, { grab: true, throwType: 'hip', cancel: .94, finish: true, push: 0 }),
    sweep: makeMove('Clinch sweep', 'sweep', 24, 11, .54, .82, 2.4, { grab: true, throwType: 'sweep', cancel: .76, finish: true, push: 0 }),
    shoulderthrow: makeMove('Shoulder throw', 'shoulderthrow', 32, 15, .84, 1.13, 2.4, { grab: true, throwType: 'shoulder', cancel: 1.06, finish: true, push: 0 }),
    doubleleg: makeMove('Double-leg takedown', 'doubleleg', 28, 13, .73, 1.04, 2.4, { grab: true, throwType: 'doubleleg', cancel: .96, finish: true, push: 0 }),
    bodyslam: makeMove('Scoop body slam', 'bodyslam', 36, 17, .95, 1.26, 2.4, { grab: true, throwType: 'bodyslam', cancel: 1.18, finish: true, push: 0 }),
    bellysuplex: makeMove('Belly-to-belly suplex', 'suplex', 35, 17, .83, 1.13, 2.4, { grab: true, throwType: 'belly', cancel: 1.06, finish: true, push: 0 }),
    verticalsuplex: makeMove('Vertical suplex', 'suplex', 39, 19, 1.12, 1.48, 2.4, { grab: true, throwType: 'vertical', cancel: 1.40, finish: true, push: 0 }),
    germansuplex: makeMove('German suplex', 'suplex', 40, 20, 1.00, 1.36, 2.4, { grab: true, throwType: 'german', cancel: 1.28, finish: true, push: 0 }),
    backsuplex: makeMove('Back suplex', 'suplex', 35, 17, .89, 1.24, 2.4, { grab: true, throwType: 'back', cancel: 1.17, finish: true, push: 0 }),
    matreturn: makeMove('Lift and mat return', 'matreturn', 29, 14, .80, 1.10, 2.4, { grab: true, throwType: 'return', cancel: 1.03, finish: true, push: 0 }),
    groundpunch: makeMove('Ground straight', 'groundpunch', 10, 5, .15, .37, 2.6, { ground: true, stun: .3, push: 0 }),
    groundelbow: makeMove('Ground elbow', 'groundelbow', 14, 7, .18, .43, 2.6, { ground: true, stun: .4, push: 0 }),
    groundhammer: makeMove('Ground hammer fist', 'groundhammer', 20, 10, .25, .54, 2.6, { ground: true, stun: .5, push: 0, finish: true }),
    stomp: makeMove('Ground stomp', 'stomp', 15, 8, .22, .47, 2.6, { ground: true, stun: .4, push: 0 }),
    groundlaunch: makeMove('Ground pop-up kick', 'upkick', 16, 12, .22, .50, 2.6, { ground: true, launch: true, stun: .65, push: .05 }),
    pickup: makeMove('Stand-up clinch', 'pickup', 0, 7, .58, .83, 2.8, { ground: true, grab: true, pickup: true, cancel: .78, push: 0 }),
    mount: makeMove('Mount transition', 'mount', 0, 5, .31, .52, 2.8, { ground: true, mount: true, cancel: .45, push: 0 }),
    palm: makeMove('Driving palm','palm',16,8,.16,.43,2.2,{push:.16}),
    hookkick: makeMove('Hook kick','hookkick',22,12,.24,.56,2.5,{push:.4,finish:true}),
    axekick: makeMove('Axe kick','axekick',25,13,.29,.64,2.35,{slam:true,break:true,finish:true}),
    shovel: makeMove('Shovel hook','shovel',14,7,.15,.39,1.95,{zone:'body',limb:'L',stun:.34}),
    leadupper: makeMove('Lead uppercut','leadupper',15,8,.17,.43,2.0,{limb:'L',stun:.38}),
    shortcross: makeMove('Short cross','cross',12,6,.12,.34,1.9,{push:.06}),
    ridgehand: makeMove('Ridge-hand strike','ridgehand',17,9,.18,.44,2.1,{limb:'L',push:.2}),
    doublepalm: makeMove('Double palm drive','doublepalm',22,11,.21,.50,2.2,{push:.35,finish:true}),
    leadkick: makeMove('Lead-leg snap','leadkick',12,7,.16,.39,2.2,{limb:'legL',push:.08}),
    obliquekick: makeMove('Oblique kick','oblique',13,8,.18,.43,2.3,{zone:'leg',push:.12}),
    questionkick: makeMove('Question-mark kick','questionkick',23,12,.25,.57,2.5,{push:.3,finish:true}),
    wheelkick: makeMove('Wheel kick','wheelkick',26,14,.29,.64,2.5,{push:.45,finish:true}),
    jumpkick: makeMove('Jumping switch kick','jumpkick',24,13,.26,.58,2.55,{push:.38,finish:true}),
    airhook: makeMove('Aerial lead hook','airhook',13,7,.15,.37,2.5,{air:true,limb:'L',push:.04,stun:.48}),
    airknee: makeMove('Flying knee','airknee',19,10,.18,.44,2.5,{air:true,push:.07,stun:.5}),
    airspin: makeMove('Aerial spinning kick','airspin',23,12,.23,.52,2.7,{air:true,push:.12,stun:.5}),
    airlift: makeMove('Aerial rising palm','airlift',12,10,.17,.42,2.5,{air:true,launch:true,push:.03,stun:.55}),
    clinchbody: makeMove('Clinch body shot','body',12,6,.12,.33,1.9,{grab:true,heldStrike:true,zone:'body',push:0}),
    clinchhook: makeMove('Collar-tie hook','hook',15,7,.14,.36,1.9,{grab:true,heldStrike:true,limb:'L',push:0}),
    clinchupper: makeMove('Clinch short upper','leadupper',17,8,.16,.40,1.9,{grab:true,heldStrike:true,limb:'L',push:0}),
    clinchkneel: makeMove('Left clinch knee','kneelead',18,8,.16,.40,2.05,{grab:true,heldStrike:true,limb:'legL',zone:'body',push:0}),
    clinchpush: makeMove('Clinch break and shove','doublepalm',10,7,.17,.42,2.05,{grab:true,heldStrike:true,release:true,push:.35}),
    elastichook: makeMove('Elastic hook','elasticHook',18,12,.23,.56,5.2,{elastic:true,limb:'L',curve:'hook',push:.08}),
    coilhands: makeMove('Coiled double strike','elasticCoil',24,15,.27,.62,5.4,{elastic:true,limb:'both',curve:'coil',push:.13,finish:true}),
    elasticsweep: makeMove('Elastic low sweep','elasticSweep',16,12,.24,.56,5.0,{elastic:true,limb:'legL',curve:'sweep',zone:'leg',push:.12}),
    elasticround: makeMove('Elastic roundhouse','elasticRound',23,14,.28,.63,5.3,{elastic:true,limb:'leg',curve:'round',push:.2,finish:true}),
    springknee: makeMove('Spring-loaded knee','elasticKnee',20,13,.24,.56,4.8,{elastic:true,limb:'leg',curve:'knee',push:.1}),
    elasticairhook: makeMove('Elastic aerial hook','elasticHook',15,11,.21,.51,5.4,{elastic:true,limb:'L',curve:'hook',air:true,push:.04,stun:.5}),
    elasticairround: makeMove('Elastic aerial arc kick','elasticRound',21,13,.25,.56,5.5,{elastic:true,limb:'leg',curve:'round',air:true,push:.04,stun:.5}),
    airreel: makeMove('Aerial reel into clinch','elasticGrab',4,14,.23,.80,5.6,{elastic:true,pull:true,air:true,grab:true,lunge:0,push:0,stun:.8,cancel:.69}),
    clinchstretch: makeMove('Coiled clinch body shot','elasticCoil',16,10,.20,.45,1.9,{elastic:true,limb:'R',curve:'coil',heldStrike:true,grab:true,zone:'body',push:0}),
    stretchjab: makeMove('Elastic straight','elasticPunch',13,10,.20,.54,5.2,{elastic:true,limb:'L',lunge:0,push:.06}),
    stretchcross: makeMove('Elastic cross','elasticPunch',17,12,.23,.57,5.2,{elastic:true,limb:'R',lunge:0,push:.08}),
    whipkick: makeMove('Whip kick','elasticKick',18,13,.25,.60,4.9,{elastic:true,limb:'leg',lunge:0,push:.1}),
    springhammer: makeMove('Spring hammer','elasticSlam',25,16,.28,.66,5.2,{elastic:true,limb:'R',lunge:0,push:.4,break:true,finish:true}),
    elasticupper: makeMove('Elastic uppercut','elasticUpper',16,14,.23,.59,5.0,{elastic:true,limb:'R',launch:true,lunge:0,push:.04,stun:.65}),
    reelgrab: makeMove('Reel-in grab','elasticGrab',3,13,.25,.81,5.6,{elastic:true,pull:true,grab:true,lunge:0,push:0,stun:.8,cancel:.70}),
    elasticairpunch: makeMove('Elastic air straight','elasticPunch',11,9,.20,.48,5.4,{elastic:true,limb:'L',air:true,lunge:0,push:.04,stun:.45}),
    elasticairkick: makeMove('Elastic air kick','elasticKick',16,12,.22,.53,5.4,{elastic:true,limb:'leg',air:true,lunge:0,push:.04,stun:.45}),
    elasticairslam: makeMove('Elastic meteor','elasticSlam',28,17,.27,.64,5.4,{elastic:true,limb:'R',air:true,slam:true,lunge:0,push:.1,finish:true}),
    elasticground: makeMove('Elastic ground hammer','elasticGround',22,13,.24,.59,4.8,{elastic:true,limb:'R',ground:true,lunge:0,push:0,finish:true}),
    elasticthrow: makeMove('Slingshot throw','elasticThrow',32,18,.87,1.20,5.8,{elastic:true,grab:true,throwType:'elastic',cancel:1.12,push:0,finish:true}),
    counter: makeMove('Parry counter', 'cross', 25, 7, .13, .44, 2.3, { push: .75, break: true, finish: true }),
    counterkick: makeMove('Counter knee', 'knee', 26, 8, .17, .46, 2.2, { push: .5, break: true, finish: true })
  };
  Object.assign(MOVES,ArsenalAPI.MOVES,ElementsAPI.MOVES,InfusionAPI.MOVES,{
    windwheel:makeMove('Tempest wheel kick','windKick',15,12,.24,.60,4.2,{wind:'spiral',focus:26,launch:true,lunge:0,cancel:.38}),
    coilrise:makeMove('Coil spring palm','elasticCoil',19,14,.25,.57,5.1,{elastic:true,limb:'R',curve:'coil',launch:true,lunge:0,push:.04}),
    rubberaxe:makeMove('Rubber axe drop','elasticAxe',27,16,.28,.64,5.4,{elastic:true,limb:'legL',curve:'axe',air:true,slam:true,lunge:0,push:.12,finish:true})
  });
  const route = (id, name, seq, steps, group, note) => ({ id, name, seq, steps: steps.split(' '), group, note });
  const ROUTES = [
    route('one-two-hook', 'One · two · hook', 'PPP', 'jab cross hook', 'Hands', 'A fast, dependable three-hit string. Your starting point.'),
    route('four-beat', 'Four-beat rush', 'PPPP', 'jab cross hook flurry', 'Hands', 'Add a fourth punch to send your opponent back.'),
    route('overhand', 'Overhand finish', 'PPH', 'jab cross overhand', 'Hands', 'Finish your one-two with a guard-breaking overhand.'),
    route('body-elbow', 'Body to elbow', 'PHP', 'jab bodyhook elbow', 'Hands', 'Change levels, then close in with an elbow.'),
    route('double-heavy', 'Hammer time', 'PHH', 'jab bodyhook hammer', 'Hands', 'The final heavy knocks your opponent to the floor.'),
    route('power-rush', 'Power rush', 'HPP', 'heavy jab cross', 'Hands', 'A heavy opener flows into quicker hands.'),
    route('hammer', 'Double impact', 'HH', 'heavy hammer', 'Hands', 'Two committed strikes. The hammer breaks a guard.'),
    route('triple-kick', 'Three-level kicks', 'KKK', 'lowkick roundhouse crescent', 'Kicks', 'Low kick, body kick, spinning high finish.'),
    route('heel', 'Heel turn', 'KKH', 'lowkick roundhouse heel', 'Kicks', 'Finish your kick chain with a spinning heel.'),
    route('double-kick', 'Crescent flow', 'PKK', 'jab frontkick crescent', 'Kicks', 'Set up a spinning kick with a jab and front kick.'),
    route('tornado', 'Tornado finish', 'PKH', 'jab frontkick tornado', 'Kicks', 'A big airborne rotation with a guard-breaking finish.'),
    route('low-switch', 'Kick · cross · kick', 'KPK', 'lowkick cross switchkick', 'Kicks', 'Switch between low kicks and straight punches.'),
    route('one-two-kick', 'One-two roundhouse', 'PPK', 'jab cross switchkick', 'Mixed', 'Use your hands to set up a powerful roundhouse.'),
    route('backfist', 'Backfist flow', 'PKP', 'jab frontkick backfist', 'Mixed', 'Push with your foot, then rotate into a backfist.'),
    route('liver-kick', 'Body-breaker', 'PHK', 'jab bodyhook sidekick', 'Mixed', 'A liver hook flows into a long side kick.'),
    route('kick-elbow', 'Inside combination', 'KPP', 'lowkick cross elbow', 'Mixed', 'Stay close and end the exchange with an elbow.'),
    route('turning-hands', 'Turn and strike', 'KHP', 'lowkick spinelbow heavy', 'Mixed', 'A turning elbow sets up a lunging power straight.'),
    route('knee', 'Knee drive', 'HPK', 'heavy jab knee', 'Mixed', 'Walk in behind a straight, then drive your knee up.'),
    route('push', 'Make space', 'HK', 'heavy pushkick', 'Mixed', 'A simple two-hit combination that creates distance.'),
    route('launch-one-two', 'Lift-off', 'UPP', 'upper airjab aircross', 'Air', 'The uppercut launches. Your next attack automatically chases.'),
    route('launch-kick', 'Skyline', 'UPK', 'upper airjab airkick', 'Air', 'Launch, follow with a straight, then kick in mid-air.'),
    route('meteor', 'Meteor drop', 'UKH', 'upper airkick airslam', 'Air', 'Lift, juggle, then slam your opponent back down.'),
    route('full-flight', 'Full flight', 'PPUPKH', 'jab cross upper airjab airkick airslam', 'Air', 'Six steps: one-two, launch, punch, kick, meteor heel.'),
    route('turn-launch', 'Spiral ascent', 'KHUKH', 'lowkick spinelbow upper airkick airslam', 'Air', 'A five-hit route from low kick to aerial slam.'),
    route('power-launch', 'Power lift', 'HUPP', 'heavy upper airjab aircross', 'Air', 'A power straight starts this four-hit juggle.'),
    route('clinch-knee', 'Clinch and knee', 'GK', 'clinch clinchknee', 'Clinch', 'Grab through a guard, then deliver a knee.'),
    route('clinch-sweep', 'Take the legs', 'GH', 'clinch sweep', 'Clinch', 'Enter the clinch and sweep your opponent off their feet.'),
    route('hip-throw', 'Hip throw', 'GG', 'clinch throw', 'Clinch', 'Press grab twice to throw. Get close before starting.'),
    route('clinch-elbow', 'Close quarters', 'GPP', 'clinch clinchelbow clinchfinish', 'Clinch', 'Keep your collar tie through both elbows. Space releases the hold.'),
    route('clinch-launch', 'Break the clinch', 'GPUPK', 'clinch clinchelbow upper airjab airkick', 'Clinch', 'Break out of your clinch with an uppercut and an air juggle.'),
    route('rush-roundhouse', 'Rush into roundhouse', 'PPPPK', 'jab cross hook flurry switchkick', 'Mixed', 'Keep chaining after the four-punch rush.'),
    route('high-low-elbow', 'High · low · elbow', 'PPPHP', 'jab cross hook bodyhook elbow', 'Hands', 'Five hits with a level change in the middle.'),
    route('high-low-kick', 'High · low · kick', 'PPPHK', 'jab cross hook bodyhook sidekick', 'Mixed', 'A body hook branches into a driving side kick.'),
    route('seven-flight', 'Seven-beat flight', 'PPPUPKH', 'jab cross hook upper airjab airkick airslam', 'Air', 'Three punches, a launch, then a three-hit air finish.'),
    route('backfist-chain', 'Backfist continuation', 'PKPPK', 'jab frontkick backfist cross switchkick', 'Mixed', 'Continue the rotation into a cross and roundhouse.'),
    route('power-overhand', 'Heavy-handed', 'HPPH', 'heavy jab cross overhand', 'Hands', 'Power opener, quick hands, then a crushing overhand.'),
    route('inside-kick', 'Elbow to front kick', 'KPPK', 'lowkick cross elbow frontkick', 'Mixed', 'Flow out of the elbow without dropping your combo.'),
    route('kick-lift', 'Kick chain lift', 'KKKU', 'lowkick roundhouse crescent upper', 'Air', 'Turn a three-level kick chain into an uppercut.'),
    route('shoulder-throw', 'Over the shoulder', 'GU', 'clinch shoulderthrow', 'Wrestling', 'Enter a collar tie, turn in, and throw over your shoulder.'),
    route('double-leg', 'Knee to double-leg', 'GKG', 'clinch clinchknee doubleleg', 'Wrestling', 'Knee, change levels, then drive through the legs.'),
    route('body-slam', 'Scoop and slam', 'GCU', 'clinch underhook bodyslam', 'Wrestling', 'Q secures underhooks. I lifts and slams.'),
    route('belly-suplex', 'Belly-to-belly', 'GCH', 'clinch underhook bellysuplex', 'Wrestling', 'Lock the body, lift, and rotate through the throw.'),
    route('vertical-suplex', 'Vertical suplex', 'GCG', 'clinch underhook verticalsuplex', 'Wrestling', 'A slower overhead lift with a heavy floor impact.'),
    route('german-suplex', 'German suplex', 'GCCU', 'clinch underhook armdrag germansuplex', 'Wrestling', 'Two Q presses move to rear control. I bridges into the suplex.'),
    route('back-suplex', 'Rear-control suplex', 'GCCH', 'clinch underhook armdrag backsuplex', 'Wrestling', 'Rear control opens a different backward throw.'),
    route('mat-return', 'Lift and return', 'GCCG', 'clinch underhook armdrag matreturn', 'Wrestling', 'Lift from behind and return your opponent to the mat.'),
    route('hip-elbow', 'Toss and follow', 'GGPP', 'clinch throw groundpunch groundelbow', 'Wrestling', 'The combo continues after the hip throw lands.'),
    route('sweep-hammer', 'Sweep to hammer', 'GHPH', 'clinch sweep groundpunch groundhammer', 'Wrestling', 'Sweep, land a straight, then drop a hammer fist.'),
    route('slam-mount', 'Slam to mount', 'GCUCPPH', 'clinch underhook bodyslam mount groundpunch groundelbow groundhammer', 'Wrestling', 'Seven transitions and strikes from standing to mounted control.'),
    route('regrip-throw', 'Throw · lift · throw', 'GGGG', 'clinch throw pickup throw', 'Wrestling', 'E on the floor brings the opponent back into a clinch.'),
    route('standing-ground-air', 'Floor to sky', 'GGGPUPKH', 'clinch throw pickup clinchelbow upper airjab airkick airslam', 'Wrestling', 'Throw, pick up, elbow, launch, then finish in the air.'),
    route('clinch-pummel', 'Elbows into knee', 'GPPKG', 'clinch clinchelbow clinchfinish clinchknee doubleleg', 'Clinch', 'Stay connected through three close strikes, then change levels.'),
    route('knee-bodylock', 'Knee to body lock', 'GKCU', 'clinch clinchknee underhook bodyslam', 'Wrestling', 'Use a knee to create the opening for a body slam.'),
    route('strike-toss', 'One-two into hip toss', 'PPGG', 'jab cross clinch throw', 'Wrestling', 'Your punches feed directly into the clinch and throw.'),
    route('strike-sweep', 'One-two into sweep', 'PPGH', 'jab cross clinch sweep', 'Wrestling', 'Four inputs take you from boxing to a leg sweep.'),
    route('strike-ground', 'Boxing to ground control', 'PPGGPP', 'jab cross clinch throw groundpunch groundelbow', 'Wrestling', 'Hands, grab, toss, then two ground follow-ups.'),
    route('kick-toss', 'Low kick into toss', 'KPGG', 'lowkick cross clinch throw', 'Wrestling', 'A low kick and cross set up the hip throw.'),
    route('heavy-slam', 'Heavy entry body slam', 'HPGCU', 'heavy jab clinch underhook bodyslam', 'Wrestling', 'Drive in with a heavy, secure underhooks, and slam.'),
    route('strike-german', 'One-two to German', 'PPGCCU', 'jab cross clinch underhook armdrag germansuplex', 'Wrestling', 'A six-step flow from punches to rear control and a German suplex.'),
    route('kick-slam', 'Kick to body slam', 'PKGCU', 'jab frontkick clinch underhook bodyslam', 'Wrestling', 'Close the distance after the kick and enter the body lock.'),
    route('ground-reset', 'Sweep and re-enter', 'GHGP', 'clinch sweep pickup clinchelbow', 'Wrestling', 'Pick your opponent up and continue working from the clinch.'),
    route('rear-regrip', 'Around the clinch', 'GCCCG', 'clinch underhook armdrag resetgrip throw', 'Wrestling', 'Move through underhooks and rear control, then return to a collar tie.'),
    route('toss-relaunch', 'Toss and relaunch', 'GGUPKH', 'clinch throw groundlaunch airjab airkick airslam', 'Wrestling', 'The pop-up kick sends your grounded opponent into an air juggle.'),
    route('slam-relaunch', 'Slam · bounce · meteor', 'GCUUPKH', 'clinch underhook bodyslam groundlaunch airjab airkick airslam', 'Wrestling', 'A body slam branches into a ground-to-air finish.'),
    route('reel-toss','Reel and toss','RG','reelgrab throw','Stretch','V reels them in. E follows with a hip throw.'),
    route('reel-doubleleg','Reel to double-leg','RPKG','reelgrab clinchelbow clinchknee doubleleg','Stretch','Bring them in, strike twice, then take the legs.'),
    route('reel-slam','Long-range body slam','RCU','reelgrab underhook bodyslam','Stretch','Stretch grab, body lock, then scoop and slam.'),
    route('reel-german','Long-range German','RCCU','reelgrab underhook armdrag germansuplex','Stretch','Pull them in and work around to rear control.'),
    route('reel-belly','Reel into suplex','RCH','reelgrab underhook bellysuplex','Stretch','The reel-in opens a belly-to-belly suplex.'),
    route('reel-ground','Reel, throw, follow','RGPP','reelgrab throw groundpunch groundelbow','Stretch','Control the distance, throw, then continue on the floor.'),
    route('elastic-toss','Stretch, reel, toss','SRG','stretchjab reelgrab throw','Stretch','A long straight feeds into a reel-in grab and hip throw.'),
    route('elastic-tackle','Stretch into double-leg','SRPKG','stretchjab reelgrab clinchelbow clinchknee doubleleg','Stretch','Long punch, pull, close strikes, and a takedown.'),
    route('elastic-body-slam','Stretch into body slam','SRCU','stretchjab reelgrab underhook bodyslam','Stretch','Elastic reach creates your opening to wrestle.'),
    route('whip-german','Whip kick to German','TRCCU','whipkick reelgrab underhook armdrag germansuplex','Stretch','Kick from distance, reel in, then throw from behind.'),
    route('boxing-elastic','Boxing, stretch, throw','PPSRG','jab cross stretchjab reelgrab throw','Stretch','Blend ordinary hands, elastic reach, and wrestling.'),
    route('kick-elastic','Kick, whip, throw','PKTRG','jab frontkick whipkick reelgrab throw','Stretch','Mix an ordinary kick with an elastic leg and reel-in.'),
    route('low-elastic-slam','Low entry, elastic slam','KPSRCU','lowkick cross stretchjab reelgrab underhook bodyslam','Stretch','Six steps mixing kicks, hands, stretching, and a slam.'),
    route('elastic-hammer','Double stretch to hammer','SSH','stretchjab stretchcross springhammer','Stretch','Alternate elastic arms, then spring into a hammer.'),
    route('elastic-punch-kick','Elastic one-two','ST','stretchjab whipkick','Stretch','An extended punch branches into a whip kick.'),
    route('elastic-flight','Elastic aerial flow','SUSTH','stretchjab elasticupper elasticairpunch elasticairkick elasticairslam','Stretch','Launch from range and stretch through an air juggle.'),
    route('whip-hands','Whip into long hands','TSS','whipkick stretchjab stretchcross','Stretch','Whip kick, elastic straight, elastic cross.'),
    route('elastic-vertical','Long hands to vertical','SSRCG','stretchjab stretchcross reelgrab underhook verticalsuplex','Stretch','Two long punches become a reel-in and overhead lift.'),
    route('elastic-floor','Stretch from standing to floor','SRGSH','stretchjab reelgrab throw elasticground groundhammer','Stretch','Use elastic attacks before and after the throw.'),
    route('elastic-close','Short, long, kick','PSK','jab stretchjab frontkick','Mixed','Change your reach and finish with a normal front kick.'),
    route('elastic-boxing','Reach mix-up','PSPK','jab stretchjab cross switchkick','Mixed','Short punch, elastic punch, cross, roundhouse.'),
    route('kick-whip-box','Kick, whip, hands','KTPP','lowkick whipkick cross hook','Mixed','Alternate ordinary and elastic legs, then switch to hands.'),
    route('heavy-elastic-air','Heavy to elastic launch','HSPUPKH','heavy stretchjab cross upper airjab airkick airslam','Mixed','Heavy hands, elastic reach, and a full air finish.'),
    route('push-reel','Push out, reel back','HKRG','heavy pushkick reelgrab throw','Stretch','Create space with your foot, then pull them back in.'),
    route('elastic-fling','Reel and slingshot','RR','reelgrab elasticthrow','Stretch','V pulls into a clinch. V again stretches both arms into a throw.'),
    route('clinch-fling','Clinch to slingshot','GR','clinch elasticthrow','Stretch','Elastic arms add reach and momentum to your throw.'),
    route('elastic-fling-floor','Slingshot to elastic hammer','RRS','reelgrab elasticthrow elasticground','Stretch','A long throw lands, then your fist stretches into the follow-up.'),
    route('roundhouse-palm','Roundhouse to palm','PPKP','jab cross switchkick palm','Mixed','Continue through the kick with a driving palm.'),
    route('elbow-hookkick','Elbow to hook kick','PHPK','jab bodyhook elbow hookkick','Mixed','Finish with a hooking kick.'),
    route('power-axe','Power to axe kick','HPPK','heavy jab cross axekick','Mixed','Quick hands set up a guard-breaking axe kick.'),
    route('kick-palm-hook','Kick, palm, hook','KKPP','lowkick roundhouse palm hook','Mixed','A kick chain flows into an open palm and hook.'),
    route('backfist-power','Backfist to power','PKPH','jab frontkick backfist overhand','Mixed','Rotate from the backfist into a heavy overhand.'),
    route("flow-pocket-six","Pocket six","PPPPPP","jab cross hook flurry shovel leadupper","Hands","Four fast punches, a body shovel, then a lead upper."),
    route("flow-pocket-pressure","Pocket pressure","PPPPPPP","jab cross hook flurry shovel leadupper shortcross","Hands","Keep the six-beat pocket string moving with a short cross."),
    route("flow-pocket-palm","Pocket palm","PPPPPPH","jab cross hook flurry shovel leadupper doublepalm","Hands","Change both hands into a double palm finish."),
    route("flow-rush-and-shovel","Rush and shovel","PPPPP","jab cross hook flurry shovel","Hands","Change the height of your fifth punch."),
    route("flow-shovel-to-ridge","Shovel to ridge","PPPPPH","jab cross hook flurry shovel ridgehand","Hands","A low shovel opens a sweeping ridge-hand strike."),
    route("flow-overhand-rebound","Overhand rebound","PPHPP","jab cross overhand shortcross leadupper","Hands","Recover from the overhand into two compact punches."),
    route("flow-overhand-body-change","Overhand body change","PPHPPP","jab cross overhand shortcross leadupper shovel","Hands","Keep changing levels after your heavy opener."),
    route("flow-overhand-palm","Overhand palm","PPHPPH","jab cross overhand shortcross leadupper doublepalm","Hands","Push out of the pocket with both palms."),
    route("flow-elbow-into-shovel","Elbow into shovel","PHPPP","jab bodyhook elbow shortcross shovel","Hands","The close elbow continues into cross and body shot."),
    route("flow-elbow-rising-hand","Elbow rising hand","PHPPPP","jab bodyhook elbow shortcross shovel leadupper","Hands","Rise back up after the body shot."),
    route("flow-elbow-ridge-finish","Elbow ridge finish","PHPPPH","jab bodyhook elbow shortcross shovel ridgehand","Hands","Turn a close-range string into a wide finishing hand."),
    route("flow-heavy-short-flow","Heavy short flow","HPPP","heavy jab cross leadupper","Hands","A heavy opener becomes a compact lead upper."),
    route("flow-heavy-five-hands","Heavy five hands","HPPPP","heavy jab cross leadupper shovel","Hands","Keep the body and head levels alternating."),
    route("flow-heavy-double-palms","Heavy double palms","HPPPPH","heavy jab cross leadupper shovel doublepalm","Hands","End the five-hand pressure with a two-hand drive."),
    route("flow-body-pocket-return","Body pocket return","PPPHPPP","jab cross hook bodyhook elbow shovel shortcross","Hands","Seven hands with elbows, a body shot, and a fast return."),
    route("flow-four-leg-flow","Four-leg flow","KKKK","lowkick roundhouse crescent leadkick","Kicks","Reset your kicking leg with a quick lead snap."),
    route("flow-five-leg-rhythm","Five-leg rhythm","KKKKK","lowkick roundhouse crescent leadkick obliquekick","Kicks","Alternate high and low after the crescent."),
    route("flow-six-leg-rotation","Six-leg rotation","KKKKKK","lowkick roundhouse crescent leadkick obliquekick hookkick","Kicks","Finish the low return with a hook kick."),
    route("flow-wheel-after-crescent","Wheel after crescent","KKKH","lowkick roundhouse crescent wheelkick","Kicks","Two different high arcs in the same kick string."),
    route("flow-heel-snap-return","Heel snap return","KKHK","lowkick roundhouse heel leadkick","Kicks","Recover the spinning heel into your lead leg."),
    route("flow-heel-to-hook","Heel to hook","KKHKK","lowkick roundhouse heel leadkick hookkick","Kicks","The quick snap feeds a hooking heel."),
    route("flow-heel-into-axe","Heel into axe","KKHH","lowkick roundhouse heel axekick","Kicks","A lateral spin changes into a downward axe."),
    route("flow-wheel-to-switch","Wheel to switch","KKKHK","lowkick roundhouse crescent wheelkick jumpkick","Kicks","Use the wheel rotation to switch legs in a jump."),
    route("flow-oblique-to-axe","Oblique to axe","KKKKKH","lowkick roundhouse crescent leadkick obliquekick axekick","Kicks","Low pressure creates a high downward finish."),
    route("flow-seven-leg-pressure","Seven-leg pressure","KKKKKKK","lowkick roundhouse crescent leadkick obliquekick hookkick questionkick","Kicks","A question-mark finish after alternating six kicks."),
    route("flow-lead-into-wheel","Lead into wheel","KKKKH","lowkick roundhouse crescent leadkick wheelkick","Kicks","A compact lead kick becomes a full wheel."),
    route("flow-whip-and-snap","Whip and snap","KKTK","lowkick roundhouse elasticround leadkick","Kicks","Add elastic reach and return to your ordinary lead leg."),
    route("flow-whip-sweep-switch","Whip sweep switch","KKTTK","lowkick roundhouse elasticround elasticsweep jumpkick","Kicks","A high elastic arc changes to low sweep and a jumping switch."),
    route("flow-snap-arc-kick","Snap arc kick","KKKTK","lowkick roundhouse crescent elasticround questionkick","Kicks","Stretch a kick after the crescent, then recover into a question mark."),
    route("flow-crescent-long-arc","Crescent long arc","KKKT","lowkick roundhouse crescent elasticround","Kicks","Add a longer curved leg after the crescent."),
    route("flow-heel-long-sweep","Heel long sweep","KKHT","lowkick roundhouse heel elasticsweep","Kicks","Keep the spin but change to a stretching low leg."),
    route("flow-low-long-high","Low long high","KTTT","lowkick whipkick elasticsweep elasticround","Kicks","Whip, sweep, and high arc after an ordinary low opener."),
    route("flow-spring-leg-finish","Spring-leg finish","KTTTT","lowkick whipkick elasticsweep elasticround springknee","Kicks","Compress the extended leg into a spring-loaded knee."),
    route("flow-arc-and-axe","Arc and axe","KKTH","lowkick roundhouse elasticround axekick","Kicks","Recover the long curved leg into a close axe kick."),
    route("flow-palm-and-lead-leg","Palm and lead leg","KKPK","lowkick roundhouse palm leadkick","Mixed","A kick chain becomes a palm and a quick lead snap."),
    route("flow-body-leg-hand","Body leg hand","PHKP","jab bodyhook sidekick shovel","Mixed","Re-enter the pocket after your side kick."),
    route("flow-low-hands-high","Low hands high","KPPKP","lowkick cross elbow frontkick ridgehand","Mixed","A front kick feeds a wide hand strike."),
    route("flow-eight-beat-mix","Eight-beat mix","PPPPKPKP","jab cross hook flurry switchkick shovel leadkick shortcross","Mixed","Keep mixing hands and feet after the rush roundhouse."),
    route("flow-hook-kick-to-hands","Hook kick to hands","KPKPP","lowkick cross switchkick shortcross shovel","Mixed","Your switch kick returns into compact boxing."),
    route("flow-lead-snap-elbow","Lead snap elbow","PKKPP","jab frontkick crescent shortcross elbow","Mixed","Recover a crescent into two close hands."),
    route("flow-palm-leg-loop","Palm leg loop","KKPKPK","lowkick roundhouse palm leadkick shortcross questionkick","Mixed","Alternate palm, leg, hand, and a high question mark."),
    route("flow-body-leg-launch","Body leg launch","PHKPUKH","jab bodyhook sidekick shovel upper airkick airslam","Mixed","A body shot and side kick become a launch and air finish."),
    route("flow-short-long-pocket","Short-long pocket","PSPKPP","jab stretchjab cross switchkick shovel leadupper","Mixed","Return from stretched reach to body and head hands."),
    route("flow-whip-to-inside","Whip to inside","KTPPKP","lowkick whipkick cross hook leadkick elbow","Mixed","Change from elastic leg to quick leg and close elbow."),
    route("flow-kick-palm-spin","Kick palm spin","KKPPK","lowkick roundhouse palm hook wheelkick","Mixed","Your palm and hook set up a wheel kick."),
    route("flow-low-palm-question","Low palm question","KHPKK","lowkick spinelbow heavy leadkick questionkick","Mixed","A turning elbow and power straight open two leg shapes."),
    route("flow-hook-leg-body-palm","Hook leg body palm","PPPHKPPH","jab cross hook bodyhook sidekick shortcross shovel doublepalm","Mixed","Hands and side kick loop back into a double-palm finish."),
    route("flow-aerial-four-hands","Aerial four hands","UPPPP","upper airjab aircross airhook airjab","Air","Chase the uppercut with alternating hands in flight."),
    route("flow-sky-hook-knee","Sky hook knee","UPPPK","upper airjab aircross airhook airknee","Air","The aerial hook branches into a flying knee."),
    route("flow-sky-hook-meteor","Sky hook meteor","UPPPKH","upper airjab aircross airhook airknee airslam","Air","Finish the flying knee by returning to the floor."),
    route("flow-aerial-knee-hook","Aerial knee hook","UPKKP","upper airjab airkick airknee airhook","Air","Roundhouse, flying knee, and a hook in mid-air."),
    route("flow-sky-elastic-arc","Sky elastic arc","UPKKPT","upper airjab airkick airknee airhook elasticairround","Air","An aerial hand opens a long curved kick."),
    route("flow-sky-elastic-landing","Sky elastic landing","UPKKPTH","upper airjab airkick airknee airhook elasticairround elasticairslam","Air","The long arc feeds an elastic meteor finish."),
    route("flow-air-kick-hook-spin","Air kick hook spin","UKPK","upper airkick airhook airspin","Air","Mix a hand between two different aerial kicks."),
    route("flow-air-spin-cross","Air spin cross","UKPKP","upper airkick airhook airspin aircross","Air","A spinning kick returns into an aerial cross."),
    route("flow-air-spin-landing","Air spin landing","UKPKPH","upper airkick airhook airspin aircross airslam","Air","Land the extended mixed air string with a meteor."),
    route("flow-jab-into-sky-knee","Jab into sky knee","PUPK","jab upper airjab airknee","Air","A quick jab opens a launcher, hand, and flying knee."),
    route("flow-low-hand-air-spin","Low hand air spin","KPUKP","lowkick cross upper airspin airhook","Air","A low kick and cross become an aerial spin and hook."),
    route("flow-rising-air-palm","Rising air palm","UPPU","upper airjab aircross airlift","Air","Re-lift in mid-air with an upward palm."),
    route("flow-air-palm-loop","Air palm loop","UPPUPKH","upper airjab aircross airlift airhook airknee airslam","Air","Re-lift, alternate hand and knee, then finish downward."),
    route("flow-air-to-clinch-catch","Air-to-clinch catch","URPK","upper airreel clinchelbow clinchkneel","Air","Reel down from the uppercut into a close elbow and knee."),
    route("flow-sky-catch-release","Sky catch release","URPKUPKH","upper airreel clinchelbow clinchkneel upper airjab airkick airslam","Air","Catch into a clinch, then launch back out and finish in flight."),
    route("flow-aerial-stretch-hands","Aerial stretch hands","UPSS","upper airjab elasticairpunch elasticairhook","Air","A normal air straight flows into two elastic arm shapes."),
    route("flow-aerial-stretch-knee","Aerial stretch knee","UPSSK","upper airjab elasticairpunch elasticairhook airknee","Air","Return from long aerial hands to a close flying knee."),
    route("flow-sky-long-arc-return","Sky long arc return","UPSSKTH","upper airjab elasticairpunch elasticairhook airknee elasticairround elasticairslam","Air","The flying knee becomes a long leg arc and elastic landing."),
    route("flow-collar-body-rhythm","Collar body rhythm","GPPP","clinch clinchelbow clinchfinish clinchbody","Clinch","Both elbows continue into a close body shot."),
    route("flow-collar-alternating-knee","Collar alternating knee","GPPPK","clinch clinchelbow clinchfinish clinchbody clinchkneel","Clinch","Follow the body shot with your lead knee."),
    route("flow-collar-rising-return","Collar rising return","GPPPKP","clinch clinchelbow clinchfinish clinchbody clinchkneel clinchupper","Clinch","Rise through the tie after the knee."),
    route("flow-two-knee-rhythm","Two-knee rhythm","GKK","clinch clinchknee clinchkneel","Clinch","Alternate knees without breaking your collar tie."),
    route("flow-knees-to-hook","Knees to hook","GKKP","clinch clinchknee clinchkneel clinchhook","Clinch","Change from legs into the free lead hand."),
    route("flow-knees-body-loop","Knees body loop","GKKPP","clinch clinchknee clinchkneel clinchhook clinchbody","Clinch","Switch back down to the body after your hook."),
    route("flow-knee-elbow-knee","Knee elbow knee","GPK","clinch clinchelbow clinchkneel","Clinch","Keep one hand connected while the other elbow and knee strike."),
    route("flow-collar-hand-knee-loop","Collar hand knee loop","GPKPPK","clinch clinchelbow clinchkneel clinchbody clinchhook clinchknee","Clinch","Trade body hands, a collar hook, and the rear knee."),
    route("flow-coiled-collar-strike","Coiled collar strike","GS","clinch clinchstretch","Clinch","A compressed elastic hand works from inside the tie."),
    route("flow-coil-body-knee","Coil body knee","GSPK","clinch clinchstretch clinchbody clinchkneel","Clinch","Close elastic hand, body shot, then left knee."),
    route("flow-coil-hook-knee","Coil hook knee","GSPKPK","clinch clinchstretch clinchbody clinchkneel clinchhook clinchknee","Clinch","Alternate the free hand and knee after the coiled shot."),
    route("flow-body-lock-close-hands","Body-lock close hands","GCPP","clinch underhook clinchbody clinchupper","Clinch","Underhooks also support close body and rising hands."),
    route("flow-body-lock-leg-hands","Body-lock leg hands","GCPPKP","clinch underhook clinchbody clinchupper clinchkneel clinchhook","Clinch","Keep the lock while changing from knee to lead hook."),
    route("flow-rear-forearm-knee","Rear forearm knee","GCCPK","clinch underhook armdrag clinchfinish clinchkneel","Clinch","Rear control opens forearm and lead knee pressure."),
    route("flow-rear-coiled-return","Rear coiled return","GCCPKS","clinch underhook armdrag clinchfinish clinchkneel clinchstretch","Clinch","Add a short compressed elastic strike from rear control."),
    route("flow-collar-shove-exit","Collar shove exit","GKKPPH","clinch clinchknee clinchkneel clinchhook clinchbody clinchpush","Clinch","Release the tie with a shove after the body loop."),
    route("flow-shove-to-boxing","Shove to boxing","GKKPPHPPK","clinch clinchknee clinchkneel clinchhook clinchbody clinchpush shortcross hook leadkick","Clinch","Use the clinch release to return to hands and a lead kick."),
    route("flow-close-release-to-sky","Close release to sky","GPPPKPUPK","clinch clinchelbow clinchfinish clinchbody clinchkneel clinchupper upper airhook airknee","Clinch","Break the tie with a launch and keep alternating in the air."),
    route("flow-coil-shove-return","Coil shove return","GSPKPKHPK","clinch clinchstretch clinchbody clinchkneel clinchhook clinchknee clinchpush shortcross leadkick","Clinch","Exit the coiled clinch chain and continue standing."),
    route("flow-long-hook-branch","Long hook branch","SP","stretchjab elastichook","Stretch","The long straight changes into a curving elastic hook."),
    route("flow-long-hook-coil","Long hook coil","SPS","stretchjab elastichook coilhands","Stretch","Follow the hook with a coiled two-hand strike."),
    route("flow-coil-leg-arc","Coil leg arc","SPST","stretchjab elastichook coilhands elasticround","Stretch","The coiled hands feed a long curved leg."),
    route("flow-coil-leg-re-entry","Coil leg re-entry","SPSTRP","stretchjab elastichook coilhands elasticround reelgrab clinchbody","Stretch","Bring the long arc back into a body-shot clinch."),
    route("flow-elastic-alternating-arms","Elastic alternating arms","SSP","stretchjab stretchcross elastichook","Stretch","Two straights become a third hand with a different curve."),
    route("flow-elastic-arm-leg-sweep","Elastic arm leg sweep","SSPT","stretchjab stretchcross elastichook elasticsweep","Stretch","A wide arm hook sets up a long low leg."),
    route("flow-low-stretch-spring","Low stretch spring","TT","whipkick elasticsweep","Stretch","Your whip kick changes height into an elastic sweep."),
    route("flow-long-sweep-high-arc","Long sweep high arc","TTT","whipkick elasticsweep elasticround","Stretch","Change the low elastic leg into a high sweeping arc."),
    route("flow-triple-leg-spring","Triple leg spring","TTTK","whipkick elasticsweep elasticround springknee","Stretch","Compress into a spring-loaded knee after three elastic legs."),
    route("flow-whip-coiled-hands","Whip coiled hands","TSSS","whipkick stretchjab stretchcross coilhands","Stretch","Three leg-and-arm extensions become a coiled double hand."),
    route("flow-hook-into-long-launch","Hook into long launch","SPU","stretchjab elastichook elasticupper","Stretch","The curved hook sets up an elastic uppercut."),
    route("flow-hook-long-air-flow","Hook long air flow","SPUPKTH","stretchjab elastichook elasticupper airhook airknee elasticairround elasticairslam","Stretch","Mix close aerial hand and knee with long leg and meteor."),
    route("flow-coil-aerial-catch","Coil aerial catch","SPURPK","stretchjab elastichook elasticupper airreel clinchbody clinchkneel","Stretch","Catch from an elastic launch and land into close strikes."),
    route("flow-aerial-coil-return","Aerial coil return","SUSTPR","stretchjab elasticupper elasticairpunch elasticairkick elasticairhook airreel","Stretch","An elastic air juggle becomes a curved hook and reel-down."),
    route("flow-long-short-long-hands","Long-short-long hands","PSPS","jab stretchjab cross elastichook","Stretch","Alternate ordinary and extended arms without restarting."),
    route("flow-inside-out-legs","Inside-out legs","KTKT","lowkick whipkick leadkick elasticround","Stretch","Change normal and stretching legs twice in the same flow."),
    route("flow-elastic-sweep-clinch","Elastic sweep clinch","TTRPK","whipkick elasticsweep reelgrab clinchbody clinchkneel","Stretch","The low stretched leg feeds a connected hand-and-knee tie."),
    route("flow-coiled-grip-exit","Coiled grip exit","RSPH","reelgrab clinchstretch clinchbody clinchpush","Stretch","Reel in, compress the striking arm, then shove free."),
    route("flow-reel-shove-long-leg","Reel shove long leg","RSPHT","reelgrab clinchstretch clinchbody clinchpush elasticround","Stretch","After the shove, use a long arc kick to reach back in."),
    route("flow-reel-shove-aerial","Reel shove aerial","RSPHUPKTH","reelgrab clinchstretch clinchbody clinchpush upper airhook airknee elasticairround elasticairslam","Stretch","Exit the grip and mix normal air strikes with elastic finishers.")
  ];
  ROUTES.push(
    route('wind-lift-mix','Rising gale','WWPK','gale updraft airjab airkick','Wind','H twice lifts a cluster. J and K chase your selected opponent.'),
    route('wind-meteor','Storm heel','WWKH','gale updraft airkick airslam','Wind','Lift with H twice, follow with K, finish with L.'),
    route('wind-reel-throw','Catch the wind','WRG','gale reelgrab throw','Wind','Push with H, catch with V, then E hip-throws.'),
    route('wind-downburst','Pressure drop','WH','gale downburst','Wind','H into L calls a downward blast around the aimed spot.'),
    route('wind-air-current','Sky current mix','UWKH','upper skycurrent airkick airslam','Wind','I launches; H sustains the juggle before K and L.'),
    route('wind-stretch-air','Wind and reach','WWSTH','gale updraft elasticairpunch elasticairkick elasticairslam','Wind','Lift the group, then mix Z and X into an elastic meteor.')
  );
  ROUTES.push(
    route('wind-vacuum-catch','Draw them into the clinch','WKGKG','gale vacuum clinch clinchknee doubleleg','Wind','H → K draws them close. E → K → E takes them down.'),
    route('wind-vacuum-ascent','Pressure into flight','WKUPKH','gale vacuum upper airjab airkick airslam','Wind','Pull with H → K, launch with I, then J → K → L.'),
    route('wind-dash-mix','Slipstream combination','WGPKH','gale slipstream jab frontkick tornado','Wind','H → E rides the gust into hands and a turning kick.'),
    route('wind-dash-grip','Slipstream body slam','WGGCU','gale slipstream clinch underhook bodyslam','Wind','H → E closes the gap. E → Q → I lifts and slams.'),
    route('wind-cyclone-mix','Eye of the storm','WWWPKH','gale updraft cyclone airjab airkick airslam','Wind','Three H presses form a cyclone. J → K → L follows it into the air.'),
    route('wind-collapse','Collapse the current','WWWH','gale updraft cyclone downburst','Wind','H → H → H gathers a cyclone; L collapses it into a downburst.'),
    route('wind-vacuum-reach','Vacuum and elastic catch','WKSRG','gale vacuum stretchjab reelgrab throw','Wind','Draw in with H → K, then Z → V → E catches and throws.'),
    route('wind-dash-elastic','Slipstream sky arc','WGUSTH','gale slipstream upper elasticairpunch elasticairkick elasticairslam','Wind','Ride H → E into I, then mix Z → X → L in the air.')
  );
  ROUTES.push(
    route('hybrid-wheel','Tempest wheel','WT','gale windwheel','Wind','H → X turns a gale into a lifting wind kick.'),
    route('hybrid-wheel-mix','Tempest hand and knee','WTPK','gale windwheel airhook airknee','Wind','Lift with H → X, then mix J and K in flight.'),
    route('hybrid-wheel-axe','Storm rubber axe','WTSH','gale windwheel elasticairhook rubberaxe','Wind','H → X lifts; Z curves a hand; L drops a stretched heel.'),
    route('hybrid-reach-wheel','Reach into the current','SWT','stretchjab gale windwheel','Stretch','Z → H → X links stretching hands to a wind-powered kick.'),
    route('hybrid-reach-flight','Long-range storm flight','SWTPKH','stretchjab gale windwheel airhook airknee rubberaxe','Stretch','Link a long hand, gust, wheel kick, and aerial mix.'),
    route('hybrid-hands-wheel','Hands feed the tempest','PWTPK','jab gale windwheel airhook airknee','Mixed','J → H → X changes close hands into a wind launch.'),
    route('hybrid-coil-rise','Coiled spring ascent','TSU','whipkick stretchjab coilrise','Stretch','X → Z → I compresses the arm into a springing launcher.'),
    route('hybrid-coil-mix','Coil sky mix','TSUPK','whipkick stretchjab coilrise airhook airknee','Stretch','Use the compressed palm to mix a hand and knee in the air.'),
    route('hybrid-coil-axe','Coil to rubber axe','TSUPKH','whipkick stretchjab coilrise airhook airknee rubberaxe','Stretch','End the spring-palm juggle with a stretched axe kick.'),
    route('hybrid-kick-gale','Foot to storm','KWT','lowkick gale windwheel','Mixed','K → H → X blends a low kick, gale, and wind wheel.'),
    route('hybrid-pull-wheel','Pull, wheel, catch','WKTRG','gale vacuum windwheel airreel throw','Wind','Draw them close, kick them up, then reel down into a hip throw.'),
    route('hybrid-dash-wheel','Slipstream wheel mix','WGTPKH','gale slipstream windwheel airhook airknee rubberaxe','Wind','Ride into a wind kick and finish with hands, knee, and rubber axe.')
  );
  ROUTES.push(
    route('lightning-lift','Voltage to air','LPKH','voltlift airjab airkick airslam','Lightning','P launches; J and K juggle, then L slams.'),
    route('lightning-reach','Spark and reach','ES','arcbolt stretchjab','Lightning','O sparks the target, then Z follows with elastic reach.'),
    route('lightning-clinch','Spark to clinch','EGG','arcbolt clinch throw','Lightning','O creates a short opening for E, E and a hip throw.'),
    route('lightning-juggle','Stretch into voltage','SLPKH','stretchjab voltlift airjab airkick airslam','Lightning','Z into P opens an electric air route.'),
    route('lightning-finish','Shockwave finish','PPQ','jab cross thunderclap','Lightning','Two close punches feed an electric clap.'),
    route('lightning-wind','Wind to voltage','WLPKH','gale voltlift airjab airkick airslam','Lightning','Use H to push, then P to lift the displaced target.')
  );
  ROUTES.push(
    route('fusion-storm-coil','Storm cradle','WWERG','gale updraft arcbolt airreel throw','Fusion','H, H lifts; O links lightning. V coils the charge, then E slams.'),
    route('fusion-voltage-catch','Voltage catch','LERG','voltlift arcbolt airreel throw','Fusion','P launches; O charges, V catches, E finishes the conductive grip.'),
    route('fusion-charged-sling','Charged slingshot','ERR','arcbolt reelgrab elasticthrow','Fusion','O electrifies; V reels, then V releases a Storm slam.'),
    route('fusion-gale-sling','Gale slingshot','WRR','gale reelgrab elasticthrow','Fusion','H marks the target with wind. V, V adds propulsion to the slingshot.'),
    route('fusion-storm-relaunch','Storm to sky','WWERGUPKH','gale updraft arcbolt airreel throw groundlaunch airjab airkick airslam','Fusion','Link wind, lightning and a throw; I relaunches into J, K, L.'),
    route('fusion-coil-slam','Conductive body slam','ERCU','arcbolt reelgrab underhook bodyslam','Fusion','O, V carries charge into a grip. Q secures the body; I slams.')
  );
  Object.assign(KEY,{a:'ALT 1',b:'ALT 2',c:'ALT 3',d:'ALT 4',e:'ALT 5',f:'ALT 6',g:'ALT 7',h:'ALT 8',i:'ALT 9'});
  ROUTES.push(
    route('earth-crag-flight','Crag to sky','aPKH','cragupper airjab airkick airslam','Earth','Alt+1 launches from a real uppercut. J, K, L follows through the air.'),
    route('earth-crag-catch','Crag cradle throw','aPKRG','cragupper airjab airkick airreel throw','Earth','Alt+1, J, K, V, E: a stone hand feeds an air catch and hip throw.'),
    route('earth-ridge-flight','Ride the fault','bPKH','ridgebreaker airjab airkick airslam','Earth','Alt+2 sends a travelling ridge along the ground. Chase its lift with J, K, L.'),
    route('earth-quarry-relaunch','Quarry to orbit','cUPKH','quarryhammer groundlaunch airjab airkick airslam','Earth','Alt+3 knocks down; I relaunches, then J, K, L juggles and finishes.'),
    route('earth-fault-catch','Fault-line catch','2PKRG','earthlift airjab airkick airreel throw','Earth','2, J, K, V, E links an earth launch, hand, kick and wrestling catch.'),
    route('fire-cinder-flight','Cinder ascent','dUKf','cinderjab upper airkick phoenixdive','Fire','Alt+4, I, K, Alt+6 mixes a quick fire hand into a Phoenix dive.'),
    route('fire-cinder-boxing','Cinder combination','dPK','cinderjab cross frontkick','Fire','Alt+4, J, K: a quick cinder jab, cross and front kick.'),
    route('fire-cinder-catch','Cinder clinch','dRKG','cinderjab reelgrab clinchknee doubleleg','Fire','Alt+4, V, K, E: ignite, reel, knee, then take the legs.'),
    route('fire-dive-relaunch','Phoenix reborn','fUPKH','phoenixdive groundlaunch airjab airkick airslam','Fire','Alt+6, I, J, K, L turns the dive knockdown into another air route.'),
    route('water-wheel-flight','Waterwheel flight','iPKH','waterwheel airjab airkick airslam','Water','Alt+9, J, K, L: a water kick launches into hands and a meteor heel.'),
    route('water-wheel-catch','Waterwheel wrestling','iPKRG','waterwheel airjab airkick airreel throw','Water','Alt+9, J, K, V, E changes a water kick into a five-step wrestling combo.'),
    route('water-current-catch','Current to collar tie','gKRU','currentpalm frontkick reelgrab shoulderthrow','Water','Alt+7, K, V, I mixes water hands, a kick and a shoulder throw.'),
    route('water-undertow-throw','Undertow body slam','hRCU','undertow reelgrab underhook bodyslam','Water','Alt+8 draws nearby enemies inward. V, Q, I catches and body-slams the target.'),
    route('water-cradle-catch','Cradle to clinch','9PKRG','waterspout airjab airkick airreel throw','Water','9, J, K, V, E: pop the bubble with a hand, add a kick, reel and throw.'),
    route('element-water-phoenix','Water into Phoenix','iPKf','waterwheel airjab airkick phoenixdive','Fusion','Alt+9 launches with water; J, K, Alt+6 finishes with a burning heel. Actual contacts prime Steam.')
  );
  const TREE = {};
  for (const r of ROUTES) {
    for (let i = 0; i < r.seq.length; i++) {
      const prefix = r.seq.slice(0, i + 1);
      if (TREE[prefix] && TREE[prefix] !== r.steps[i]) throw new Error('Conflicting combo ' + prefix);
      TREE[prefix] = r.steps[i];
    }
  }
  MOVES.elementthrow=makeMove('Directed elemental throw','elasticThrow',30,18,.87,1.20,5.8,{grab:true,throwType:'elastic',cancel:1.12,push:0,finish:true,controlledThrow:true,windCost:18});KEY.j='POWER THROW';KEY.k='CURRENT';KEY.l='TERRACE';KEY.m='HEAT';
  const BASE = { '@':'jab', '1':'earthwall','2':'earthlift','3':'earthquake','4':'firebolt','5':'flameline','6':'fireburst', E:'arcbolt',L:'voltlift',Q:'thunderclap', P:'jab',K:'lowkick',H:'heavy',U:'upper',G:'clinch',C:'underhook',S:'stretchjab',T:'whipkick',R:'reelgrab',W:'gale',A:'jab',Y:'upper',M:'heavy',N:'vacuum',D:'slipstream',Z:'cyclone',J:'gunReload',V:'windwheel' };
  Object.assign(BASE,ElementsAPI.TOKENS,{'0':'fusionRelease',j:'elementthrow'});
  const GRIP_MOVES = {
    front: {P:'clinchelbow',K:'clinchknee',H:'sweep',U:'shoulderthrow',G:'throw',C:'underhook'},
    bodylock: {P:'clinchelbow',K:'clinchknee',H:'bellysuplex',U:'bodyslam',G:'verticalsuplex',C:'armdrag'},
    rear: {P:'clinchfinish',K:'clinchknee',H:'backsuplex',U:'germansuplex',G:'matreturn',C:'resetgrip'}
  };
  const GROUND_MOVES = {P:'groundpunch',K:'stomp',H:'groundhammer',U:'groundlaunch',G:'pickup',C:'mount'};
  for(const map of Object.values(GRIP_MOVES))Object.assign(map,{S:'clinchfinish',T:'clinchknee',R:'elasticthrow'});
  Object.assign(GROUND_MOVES,{S:'elasticground',T:'stomp',R:'pickup'});
  // q, owner x/z/hip height/pitch/yaw, opponent x/z/hip height/pitch/yaw.
  // Both rigs use the same timeline; impact is at q=1, never at the lift.
  const PAIRS = {
    hip: [[0,0,0,1,0,0,0,.74,1,0,Math.PI],[.3,0,.1,.86,.1,1.5,-.18,.52,1.15,.2,2.6],[.65,0,.12,.85,.25,2.8,.1,.70,1.65,2.35,.6],[1,0,.02,.9,.12,2.8,0,1.38,.24,1.5,0]],
    sweep: [[0,0,0,1,0,0,0,.74,1,0,Math.PI],[.45,0,.08,.91,.14,.15,.12,.86,.85,-.45,Math.PI],[1,0,.05,.92,.12,.1,.13,1.18,.24,-1.5,Math.PI]],
    shoulder: [[0,0,0,1,0,0,0,.74,1,0,Math.PI],[.3,0,.08,.73,.25,2.5,0,.35,1.35,.9,1.8],[.6,0,.08,.81,.48,3.1,0,.42,1.93,2.45,.7],[1,0,.02,.88,.18,3.1,.05,1.38,.24,1.5,0]],
    doubleleg: [[0,0,0,1,0,0,0,.74,1,0,Math.PI],[.35,0,.28,.64,.55,0,0,1.0,.9,-.55,Math.PI],[.7,0,.5,.65,.55,0,0,1.35,.7,-1.05,Math.PI],[1,0,.55,.82,.25,0,0,1.63,.24,-1.5,Math.PI]],
    bodyslam: [[0,0,0,1,0,0,0,.58,1,0,Math.PI],[.25,0,0,.83,.1,-.1,.15,.48,1.35,-.6,Math.PI],[.58,0,.02,1.03,0,-.25,.12,.40,1.90,-1.45,Math.PI],[1,0,.08,.83,.35,-.15,.06,1.18,.24,-1.5,Math.PI]],
    belly: [[0,0,0,1,0,0,0,.58,1,0,Math.PI],[.35,0,0,1.03,-.18,.4,.15,.45,1.52,.7,2.3],[.7,-.3,-.15,.73,-.65,1.0,.3,-.35,1.36,2.5,2.9],[1,-.45,-.16,.46,-1.0,1.2,.3,-1.1,.24,1.5,Math.PI]],
    vertical: [[0,0,0,1,0,0,0,.58,1,0,Math.PI],[.28,0,0,.95,-.1,0,0,.4,1.55,1.55,Math.PI],[.47,0,0,1.05,-.12,0,.03,.28,2.13,Math.PI,Math.PI],[.66,0,-.08,.87,-.4,0,.05,-.25,1.90,2.75,Math.PI],[1,0,-.14,.46,-1.0,0,.08,-1.28,.24,1.5,Math.PI]],
    german: [[0,0,0,1,0,0,0,.60,1,0,0],[.32,0,-.05,.94,-.24,0,0,.39,1.58,-.7,0],[.67,0,-.17,.65,-.87,0,0,-.48,1.53,-2.6,0],[1,0,-.22,.30,-1.32,0,.05,-1.3,.24,-1.5,0]],
    back: [[0,0,0,1,0,0,0,.60,1,0,0],[.38,0,-.08,.94,-.2,-.3,.15,.25,1.50,-.6,0],[.74,-.2,-.17,.77,-.65,-.5,.35,-.48,1.1,-1.7,-.2],[1,-.25,-.19,.54,-.8,-.5,.4,-1.14,.24,-1.5,-.2]],
    return: [[0,0,0,1,0,0,0,.60,1,0,0],[.40,0,0,.95,.1,0,0,.57,1.58,.1,0],[.75,0,.12,.90,.25,0,.1,.73,1.13,.8,0],[1,0,.1,.86,.3,0,.1,1.12,.24,1.5,0]],
    elastic: [[0,0,0,1,0,0,0,.74,1,0,Math.PI],[.35,0,-.10,.87,.15,0,0,1.1,1.15,-.4,Math.PI],[.68,0,-.05,1,0,0,0,2.1,1.5,-2.0,Math.PI],[1,0,.08,.92,.15,0,0,2.65,.24,-1.5,Math.PI]],
    pickup: [[0,0,0,1,0,0,0,1.2,.24,1.5,0],[.4,0,.14,.73,.3,0,0,.95,.55,.85,Math.PI],[1,0,.1,1,0,0,0,.84,1,0,Math.PI]],
    mount: [[0,0,0,1,0,0,0,1.2,.24,1.5,0],[1,0,.82,.68,.02,0,0,1.2,.24,1.5,0]]
  };
  function pairSample(type, q, first, end, customNodes) {
    const frames = PAIRS[type], nodes = (customNodes || (end ? [first,end] : first ? [first, ...frames.slice(1)] : frames)).map(n=>n.slice());
    for(const column of [5,10])for(let i=1;i<nodes.length;i++)nodes[i][column]=nodes[i-1][column]+Math.atan2(Math.sin(nodes[i][column]-nodes[i-1][column]),Math.cos(nodes[i][column]-nodes[i-1][column]));
    let b = nodes.length - 1;
    for(let i=1;i<nodes.length;i++)if(q<=nodes[i][0]){b=i;break;}
    const a=nodes[b-1],z=nodes[b],h=z[0]-a[0],t=clamp((q-a[0])/h,0,1);
    const slope=(index,column)=>{
      if(index===0)return 0;
      if(index===nodes.length-1)return column===8?(nodes[index][column]-nodes[index-1][column])/(nodes[index][0]-nodes[index-1][0]):0;
      const p=nodes[index-1],v=nodes[index],n=nodes[index+1],d0=(v[column]-p[column])/(v[0]-p[0]),d1=(n[column]-v[column])/(n[0]-v[0]);
      return d0*d1<=0?0:2*d0*d1/(d0+d1);
    };
    return a.map((v,i)=>i===0?q:(2*t*t*t-3*t*t+1)*v+(t*t*t-2*t*t+t)*h*slope(b-1,i)+(-2*t*t*t+3*t*t)*z[i]+(t*t*t-t*t)*h*slope(b,i));
  }
  function fighter(id, x, z) {
    return { id, x, z, y: 0, vx: 0, vz: 0, vy: 0, angle: id === 'player' ? Math.PI : 0,
      health: 120, maxHealth: 120, stamina: 100, action: null, buffer: [],
      chain: '', landedChain: '', chainUntil: 0, stunned: 0, down: 0, downAt: 0, guard: false, guardAt: -9,
      dodge: null, counterUntil: 0, hurt: 0, walk: 0, moving: 0, regenAt: 0,
      hits: 0, damage: 0, hitUntil: 0, lastMove: '', ko: false, held: false, visual: null, downPitch:1.5, recovery:null,
      lastId:'',flow:0,impact:null,impactId:0,tumbling:false,airJuggles:0,connections:[],balloon:null,mass:1,bulk:1,pace:1,variant:'standard',windEnergy:100,balance:0,balanceBreakUntil:0,balanceAt:0,powerMarks:{},heat:0,heatAt:-10,elementSupport:null };
  }
  class World {
    constructor(onEvent = () => {}, random = Math.random) {
      this.onEvent = onEvent; this.random = random; this.time = 0; this.mode = 'practice';
      this.dummy = 'passive'; this.infinite = true; this.locked = true;
      this.best = 0; this.bestDamage = 0; this.parries = 0; this.totalHits = 0;
      this.round = 1; this.freeze = 0; this.shake = 0; this.particles = [];
      this.input = { x: 0, z: 0 }; this.demo = null; this.over = false;
      this.arenaId='courtyard';this.hazards=true;this.opponentStyle='balanced';this.difficulty='relaxed';this.practiceSpeed=1;this.smartTarget=true;this.manualTargetUntil=0;
      this.assistMode='manual';this.assistStyle='mixed';
      this.groupCount=3;this.groupMix='mixed';this.groupBehavior='moving';
      this.run=new WaveRun(this);this.boss=new BossEncounter(this);this.journal=new DistrictJournal(this);this.reset(false);
    }
    emit(type, data = {}) {
      const brain=this.controllers?.[data.by];if(brain){if(type==='propPickup')brain.stats.pickups++;if(type==='propThrow')brain.stats.throws++;}
      const event={type,time:this.time,...data};this.contacts?.onEvent(event);this.trials?.onEvent(event);this.run?.onEvent(event);this.team?.onEvent(event);this.infusion?.onEvent(event);this.power?.onEvent(event);this.boss?.onEvent(event);this.onEvent(event);
    }
    reset(keepRound = false) {
      if(this.boss?.active&&!this.boss.transition)this.boss.cancel();
      if(this.run?.active&&!this.run.transition)this.run.cancel();
      this.tickRemainder=0;
      if (!keepRound) this.round = 1;
      this.player = fighter('player', -.7, .6);
      this.enemies=[];const count=this.isGroup()?this.groupCount:1,spawns=count===1?[[.65,-.35]]:[[0,-.8],[-1.9,-2.05],[1.9,-1.8]],mix=this.groupMix==='mixed'?['runner','bruiser','grappler']:[this.groupMix,this.groupMix,this.groupMix];
      for(let i=0;i<count;i++){const f=fighter(i?'enemy'+(i+1):'enemy',...spawns[i]),variant=this.isGroup()?VARIANTS[mix[i]]||VARIANTS.standard:VARIANTS.standard;Object.assign(f,{variant:this.isGroup()?mix[i]:'standard',name:variant.name+(count>1?' '+(i+1):''),mass:variant.mass,bulk:variant.bulk,pace:variant.pace,style:variant.style,accent:variant.color,shirt:variant.shirt});f.maxHealth=Math.round((this.isGroup()?210:this.mode==='practice'?320:125)*variant.health);f.health=f.maxHealth;this.enemies.push(f);}
      this.enemy=this.enemies[0];this.face(this.player,this.enemy);for(const f of this.enemies)this.face(f,this.player);
      this.player.maxHealth = this.player.health = 140;
      this.grapple = null; this.ground = null; this.tether=null;
      this.over = false; this.respawn = 0; this.aiAt = this.time + 1;
      this.attackOwner=null;this.attackGap=this.time+.9;this.lastAttackOwner=null;
      this.aiPlan = []; this.demo = null; this.freeze = 0; this.particles.length = 0;
      if(this.yard)this.yard.reset();else this.yard=new Yard(this);
      this.balloon=new Balloon(this);this.wind=new Wind(this);this.assist=new ComboAssist(this);this.arsenal=new ArsenalAPI.Arsenal(this);this.lightning=new Lightning(this);this.team=new EnemyTeam(this);this.flow=new FlowAPI.Flow(this);this.mobility=new Mobility(this);this.manualTargetUntil=0;this.contacts=new ContactAPI.Contacts(this);this.cover=new Cover(this);this.elements=new ElementsAPI.Elements(this);this.infusion=new InfusionAPI.Infusion(this);this.elementPhysics=new ElementPhysics(this);this.power=new PowerControl(this);
      this.controllers=Object.fromEntries(this.enemies.map(f=>[f.id,new Opponent(this,MOVES,f)]));this.opponent=this.controllers[this.enemy.id];
      if(!this.isGroup()&&this.opponentStyle==='gunner'&&(this.mode==='sparring'||this.dummy==='footwork')){const p=this.yard.props.find(p=>p.type==='blaster');p.x=this.enemy.x;p.z=this.enemy.z+.45;this.yard.pickup(this.enemy,p);}
      if(this.trials)this.trials.reset();else this.trials=new Trials(this);
      this.input.x = this.input.z = 0; this.emit('reset');
    }
    setMode(mode) {
      this.mode = ['sparring','group'].includes(mode)?mode:'practice';
      this.infinite = !this.isLive(); this.reset(); this.emit('mode', { mode: this.mode });
    }
    isGroup(){return this.mode==='group';}
    isLive(){return this.mode==='sparring'||this.isGroup()&&this.groupBehavior==='live';}
    perk(key){return this.run?.level(key)||0;}
    freePlayer(){return this.mode!=='sparring'&&this.infinite;}
    airHeight(f){return Math.max(0,f.y-(f.elementSupport?.top||0));}
    fighters(){return [this.player,...(this.enemies||[this.enemy]).filter(Boolean)];}
    getFighter(id){return this.fighters().find(f=>f.id===id)||null;}
    targetsFor(f){return f.id==='player'?this.enemies.filter(e=>!e.ko):[this.player].filter(p=>!p.ko);}
    targetFor(f,current=true){
      if(current&&f.action?.targetId){const target=this.getFighter(f.action.targetId);if(target)return target;}
      if(this.grapple?.owner===f)return this.grapple.target;if(this.tether?.owner===f)return this.tether.target;
      if(f.id!=='player')return this.player;
      if(this.enemy.ko){const alive=this.enemies.filter(e=>!e.ko).sort((a,b)=>distance(f,a)-distance(f,b));if(alive.length){this.enemy=alive[0];this.opponent=this.controllers[this.enemy.id];this.emit('target',{id:this.enemy.id,name:this.enemy.name});}}
      return this.enemy;
    }
    selectTarget(id){
      const target=this.enemies.find(e=>e.id===id&&!e.ko);if(!target)return false;
      if(this.grapple||this.tether||this.player.held){this.emit('yardNotice',{text:'Finish or release the hold before changing targets.'});return false;}
      if(this.ground){this.standBlend(this.ground.owner);this.ground.target.visual=null;this.ground=null;}
      this.enemy=target;this.opponent=this.controllers[id];this.manualTargetUntil=this.time+1.2;this.flow.focus=null;this.emit('target',{id,name:target.name});return true;
    }
    cycleTarget(){const alive=this.enemies.filter(e=>!e.ko);if(alive.length<2)return false;return this.selectTarget(alive[(alive.indexOf(this.enemy)+1)%alive.length].id);}
    setGroup(count,mix=this.groupMix,behavior=this.groupBehavior){if(![2,3].includes(Number(count))||!['mixed','runner','bruiser','grappler','reach'].includes(mix)||!['passive','moving','live'].includes(behavior))return false;this.groupCount=Number(count);this.groupMix=mix;this.groupBehavior=behavior;this.infinite=!(this.mode==='sparring'||this.isGroup()&&behavior==='live');this.reset();return true;}
    requestAttack(f){
      if(!this.isGroup())return true;
      if(!this.isLive()||this.player.down>0||this.player.held||this.tether||this.grapple&&!this.team.canRescue(f))return false;
      if(this.attackOwner)return this.attackOwner===f.id;
      if(this.time<this.attackGap)return false;
      if(this.team.canRescue(f)){this.attackOwner=f.id;return true;}
      const candidates=this.enemies.filter(e=>!e.ko&&!e.held&&e.stunned<=0&&e.down<=0&&this.airHeight(e)<.2&&!e.dodge&&e.stamina>18&&distance(e,this.player)<5.2);
      candidates.sort((a,b)=>(a.id===this.lastAttackOwner?3:0)+distance(a,this.player)-(b.id===this.lastAttackOwner?3:0)-distance(b,this.player));
      if(candidates[0]!==f)return false;this.attackOwner=f.id;return true;
    }
    updateAttackTurn(){
      if(!this.attackOwner)return;const f=this.getFighter(this.attackOwner),brain=this.controllers[this.attackOwner];
      if(!f||f.ko||f.stunned>0||f.down>0||!f.action&&!f.buffer.length&&!brain.state.plan.length){this.lastAttackOwner=this.attackOwner;this.attackOwner=null;this.attackGap=this.time+(LEVELS[this.difficulty]?.gap||.8);}
    }
    separateFighters(){
      const list=this.fighters();
      for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
        const a=list[i],b=list[j],g=this.grapple||this.ground,inPair=f=>!!g&&(g.owner===f||g.target===f),pairedA=inPair(a),pairedB=inPair(b);
        if(a.balloon||b.balloon||pairedA&&pairedB||a.held&&!pairedA||b.held&&!pairedB||Math.abs(a.y-b.y)>.8)continue;
        const d=distance(a,b),close=[a,b].some(f=>f.action&&/knee|elbow/i.test(f.action.move.pose)),reach=close?.64:.78;if(d>=reach)continue;
        const angle=(i+j)*2.39996,x=d>.001?(b.x-a.x)/d:Math.sin(angle),z=d>.001?(b.z-a.z)/d:Math.cos(angle);
        if(this.isGroup())for(const [body,target,nx,nz] of [[a,b,x,z],[b,a,-x,-z]]){
          const speed=body.vx*nx+body.vz*nz;
          if(body.tumbling&&speed>3.1&&!target.ko&&!target.tumbling&&this.time-(body.bodyHitAt??-10)>.65){body.bodyHitAt=this.time;this.environmentHit(target,{source:body.lastAttacker,damage:Math.round(clamp(speed*1.3,4,11)),kind:'body',dir:[nx,0,nz],speed});target.vx+=nx*2.3/(target.mass||1);target.vz+=nz*2.3/(target.mass||1);body.vx*=.65;body.vz*=.65;}
        }
        const pairMass=g?(g.owner.mass||1)+(g.target.mass||1):1,weightA=1/(pairedA?pairMass:a.mass||1),weightB=1/(pairedB?pairMass:b.mass||1),amount=reach-d;this.yard.movePair(a,-x*amount*weightA/(weightA+weightB),-z*amount*weightA/(weightA+weightB));this.yard.movePair(b,x*amount*weightB/(weightA+weightB),z*amount*weightB/(weightA+weightB));
      }
    }
    setArena(id){if(!root.CombatYard.ARENAS[id])return false;this.arenaId=id;this.reset();this.emit('arena',{id,name:this.yard.layout.name});return true;}
    setOpponent(style,difficulty=this.difficulty){if(!STYLES[style]||!LEVELS[difficulty])return false;this.opponentStyle=style;this.difficulty=difficulty;this.reset();this.emit('opponent',{style,difficulty});return true;}
    face(f, target, amount = 1) {
      const targetAngle = Math.atan2(target.x - f.x, target.z - f.z);
      let delta = Math.atan2(Math.sin(targetAngle - f.angle), Math.cos(targetAngle - f.angle));
      f.angle += delta * amount;
    }
    setAssist(mode,style=this.assistStyle){if(!['manual','easy'].includes(mode)||!['mixed','wind','wrestling','fusion','elements'].includes(style))return false;if(this.trials?.run?.status==='running')this.trials.cancel();this.assistMode=mode;this.assistStyle=style;this.player.buffer=[];this.assist=new ComboAssist(this);this.emit('assist',{mode,style});return true;}
    attack(token, auto = false, powerRequest = null) {
      if(this.run?.blocked()||this.boss?.blocked())return false;
      if(!BASE[token]||this.over||this.player.ko)return false;
      if(!auto)this.emit('controlInput',{token,key:KEY[token]});
      if(!auto&&!this.player.balloon&&this.assistMode==='easy'&&ASSIST_TOKENS[token])token=ASSIST_TOKENS[token];
      if (!BASE[token] || this.over || this.player.ko) return false;
      if (!auto && this.demo) { this.demo = null; this.emit('demoEnd'); }
      const f = this.player;
      if(f.balloon)return this.balloon.command(f,token);
      if (f.down > .35 || f.dodge&&!f.dodge.flow || f.held) return false;
      if (f.action || f.stunned > 0 || f.down > 0 || f.dodge?.flow) {
        if(ASSIST_REQUESTS.has(token)&&f.buffer.filter(b=>ASSIST_REQUESTS.has(b.token)).length>=2)return false;
        if(f.buffer.length>=4){this.emit('bufferFull');return false;}
        f.buffer.push({ token, power:powerRequest, until:this.time+Math.max(.8,(f.action?.move.cancel??f.stunned)- (f.action?.t??0)+.45,f.down+.45) });
        this.emit('input', { token, buffered: true }); return true;
      }
      return this.start(f, this.targetFor(f,false), token,null,powerRequest);
    }
    useArena(){this.emit('controlInput',{token:'ENV',key:'Y'});return this.yard.gadgets.activate(this.player);}
    interact(kind='pickup',queued=false){
      const f=this.player;if(!queued)this.emit('controlInput',{token:kind==='fetch'?'B':'F',key:kind==='fetch'?'B':'F'});
      if(f.balloon){this.emit('yardNotice',{text:'C unrolls so your hands are free to grab objects.'});return false;}
      if(this.demo){this.demo=null;this.emit('demoEnd');}
      if(this.over||f.ko||f.held||f.down>0||f.stunned>0||f.dodge)return false;
      if(kind==='pickup'&&this.yard.held(f)){this.yard.release(f);if(f.action?.move.weapon||f.action?.move.propThrow||f.action?.move.ranged||f.action?.move.reload)f.action=null;if(!queued)f.buffer=[];return true;}
      if(this.grapple?.phase==='clinch'||this.tether){this.emit('yardNotice',{text:'Release the clinch with Space first.'});return false;}
      if(f.action&&(!f.action.hit||f.action.t<f.action.move.cancel)){
        if(f.buffer.length>=4){this.emit('bufferFull');return false;}f.buffer.push({token:kind==='fetch'?'B':'F',until:this.time+Math.max(.8,f.action.move.cancel-f.action.t+.5)});this.emit('input',{token:kind==='fetch'?'B':'F',buffered:true});return true;
      }
      if(this.yard.held(f)){this.emit('yardNotice',{text:'E throws the held object. V adds elastic power.'});return false;}
      const p=this.yard.candidate(f,kind==='fetch'?5.9:1.7);
      if(!p){this.emit('yardNotice',{text:kind==='fetch'?'Face an object within stretching range.':'Move closer to a chair, crate, or barrel.'});return false;}
      const id=kind==='fetch'?'propFetch':'propPickup',move=MOVES[id],free=this.freePlayer();
      if(!free&&f.stamina<move.cost){this.emit('tired');return false;}if(!free)f.stamina-=move.cost;
      if(!queued)f.buffer=[];f.guard=false;f.action={id,move,t:0,hit:false,chain:f.chain,token:kind==='fetch'?'B':'F',propId:p.id,grabFrom:{x:f.x,z:f.z}};f.regenAt=this.time+.7;
      this.emit('attack',{id,move:move.name,token:f.action.token,chain:f.chain});return true;
    }
    flowMove(f,target,token,context){
      const n=f.flow,last=MOVES[f.lastId];
      if(context==='ground')return GROUND_MOVES[token];
      if(context==='clinch'){
        if(token==='P')return ['clinchelbow','clinchbody','clinchhook','clinchupper'][n%4];
        if(token==='K'||token==='T')return n%2?'clinchkneel':'clinchknee';
        if(token==='S')return 'clinchstretch';
        return GRIP_MOVES[this.grapple.grip][token];
      }
      if(context==='air')return {P:n%2?'airjab':'airhook',K:n%2?'airkick':'airknee',H:'airslam',U:'airlift',S:n%2?'elasticairpunch':'elasticairhook',T:n%2?'elasticairkick':'elasticairround',R:'airreel',G:'airreel'}[token];
      if(token==='P')return last?.pose==='body'?'leadupper':['jab','cross','hook','shovel','shortcross','ridgehand'][n%6];
      if(token==='K')return ['lowkick','leadkick','roundhouse','obliquekick','hookkick','questionkick'][n%6];
      if(token==='H')return last?.limb?.startsWith('leg')?'palm':n%2?'overhand':'heavy';
      if(token==='S')return ['stretchjab','elastichook','stretchcross','coilhands'][n%4];
      if(token==='T')return ['whipkick','elasticsweep','elasticround','springknee'][n%4];
      return BASE[token];
    }
    start(f, target, token, request = null, powerRequest = null) {
      if(f.id==='player'&&!f.balloon){const chosen=this.flow.target(f,target,token);if(chosen!==target){target=chosen;this.enemy=chosen;this.opponent=this.controllers[chosen.id];this.emit('target',{id:chosen.id,name:chosen.name,automatic:true});}}
      if(token==='@'){if(f.id!=='player')return false;token=this.power.comboToken(f,target,powerRequest?.element);}
      if(ASSIST_REQUESTS.has(token))return f.id==='player'?this.assist.start(f,target,token):false;
      if(token==='O')return f.id==='player'?this.balloon.toggle():false;
      if(f.balloon)return this.balloon.command(f,token);
      if(token==='F'||token==='B')return f.id==='player'?this.interact(token==='B'?'fetch':'pickup',true):false;
      if(f.id==='player'&&target.ko)target=this.targetFor(f,false);
      let chain = this.time <= f.chainUntil ? f.chain + token : token;
      chain=chain.slice(-24);
      let id = TREE[chain];
      const grip = this.grapple && this.grapple.owner === f && this.grapple.phase === 'clinch';
      const floor = target.down > .08 && this.airHeight(target)<.20 && !target.ko;
      const air=(this.airHeight(target)>.18||f.mobility?.voluntary&&this.airHeight(f)>.35)&&!target.held;
      const context=grip?'clinch':floor?'ground':air?'air':'standing';
      if (grip) {
        if (!id || (!MOVES[id].heldStrike && !MOVES[id].throwType && !MOVES[id].grip && !MOVES[id].launch)) {
          id = this.flowMove(f,target,token,context);
        }
      } else if (floor) {
        if (!id || !MOVES[id].ground) id=this.flowMove(f,target,token,context);
      } else if(air&&(!id||!MOVES[id].air)){
        id=this.flowMove(f,target,token,context);
      } else if (!id || MOVES[id].throwType || MOVES[id].heldStrike || MOVES[id].grip || MOVES[id].ground) {
        id = this.flowMove(f,target,token,context);
        if (token === 'C') { if(f.id==='player')this.emit('grabFirst'); return false; }
      }
      if(token==='W'&&f.lastId==='updraft'&&this.time<=f.chainUntil)id='cyclone';
      if(token==='W')id=MOVES[id]?.wind?id:f.lastId==='gale'&&this.time<=f.chainUntil?'updraft':air?'skycurrent':'gale';
      if(MOVES[TREE[chain]]?.wind)id=TREE[chain];
      if(token==='j')id='elementthrow';
      if(Object.hasOwn(ElementsAPI.TOKENS,token)||['0','N','D','Z','J','V','E','L','Q'].includes(token))id=BASE[token];
      const item=this.yard.held(f);
      if(item&&!grip)id=({P:f.lastId==='weaponSwing'?'weaponBack':'weaponSwing',H:'weaponHeavy',S:'weaponStretch',G:'propThrow',R:'propPower'})[token]||id;
      if(item&&!grip)id=this.arsenal.choose(item,f,token)||id;
      if(this.time<=f.chainUntil){if(token==='H'&&['gale','cyclone'].includes(f.lastId))id='downburst';if(token==='K'&&f.lastId==='gale')id='vacuum';if(token==='G'&&f.lastId==='gale')id='slipstream';}
      if(!id)return false;
      if (!MOVES[id].wind && this.time < f.counterUntil && (token === 'P' || token === 'H' || token === 'K')) {
        id = token === 'K' ? 'counterkick' : item?'weaponHeavy':'counter'; chain = token; f.counterUntil = 0;
      }
      let move = MOVES[id];
      if(move.controlledThrow){if(!grip){if(f.id==='player')this.emit('elementNotice',{text:'Catch an opponent before a directed power throw.'});return false;}const element=powerRequest?.element||this.infusion.active(f)?.element||this.power.selected;move={...move,throwElement:element,elementFamily:element[0].toUpperCase()+element.slice(1)};}
      if(move.heatCost&&(f.heat||0)<move.heatCost){if(f.id==='player')this.emit('elementNotice',{text:'Build 35 heat with real fire hits before releasing it.'});return false;}
      if(powerRequest?.charge>0){const charge=clamp(powerRequest.charge,0,1);move={...move,damage:Math.round(move.damage*(1+charge*.25)),focus:move.focus?Math.round(move.focus*(1+charge*.20)):move.focus,cost:move.cost+Math.round(charge*3)};}
      if(token==='0'){move=this.infusion.move(f);if(!move)return false;}
      if(move.elementTag){move={...move,air,ground:floor,pose:air?(move.airPose||(move.elementTag==='earth'?'airjab':move.limb==='legR'?'airkick':'airlift')):floor?(move.groundPose||(move.launch?'groundlaunch':move.limb==='legR'?'stomp':'groundhammer')):move.pose};}
      if(move.element==='vault'&&f.id==='player'&&!this.mobility.grounded()){this.emit('elementNotice',{text:'Stone vault needs a grounded launch. Use water, wind or a fire kick while airborne.'});return false;}
      move=this.flow.throwMove(f,target,move);
      if(f.id==='player'&&move.air)move={...move,cost:move.cost*Math.pow(.9,this.perk('air'))};
      if(f.id==='player'&&move.wind)move={...move,focus:move.focus*Math.pow(.88,this.perk('wind'))};
      if(!this.arsenal.ready(f,move)||!this.cover.canAttack(f,move))return false;
      if(item&&move.weapon&&(floor||air))move={...move,ground:floor,air};
      if(item&&move.launch&&!move.grab&&!move.wind&&!move.weapon&&!move.ranged)move={...move,pose:'leadupper',limb:'L'};
      if (move.air && !move.wind && this.airHeight(target) < .14 && !f.mobility?.voluntary) { id = this.flowMove(f,target,token,'standing'); move = MOVES[id]; }
      if(f.id!=='player'&&this.isLive()){const level=LEVELS[this.difficulty];if(!level.grabs&&(move.grab||move.throwType||move.pull)||!level.ground&&move.ground)return false;move={...move,damage:Math.round(move.damage*level.damage),startup:move.startup*level.windup,duration:move.duration*level.windup,cancel:move.cancel*level.windup};}
      const free = f.id === 'player' && this.freePlayer();
      if (!free && f.stamina < move.cost) {
        if (f.id === 'player') this.emit('tired'); return false;
      }
      if((move.wind||move.lightning||move.element||move.elementTag)&&!free&&f.windEnergy<move.focus){if(f.id==='player')this.emit('windEmpty');return false;}
      if(move.windCost&&!free&&f.windEnergy<move.windCost){if(f.id==='player')this.emit('windEmpty');return false;}
      if((move.wind||move.lightning||move.element||move.elementTag)&&!free)f.windEnergy-=move.focus;
      if(move.windCost&&!free)f.windEnergy-=move.windCost;
      if((move.wind||move.lightning||move.element||move.elementTag)&&grip)this.releaseGrip(move.wind?'wind':move.element?'element':'lightning');
      if (!free) f.stamina -= move.cost;
      if(f.id==='player'){this.mobility.release('attack');this.elementPhysics.endSurf('attack');}
      f.regenAt = this.time + .5; f.guard = false; f.chain = chain;
      if (chain.length === 1) f.landedChain = '';
      f.chainUntil = this.time + move.duration + .78;
      if(powerRequest?.aim){const point=powerRequest.aim;f.angle=Math.atan2(point[0]-f.x,point[2]-f.z);}else if(this.locked||f.id!=='player')this.face(f,target);
      f.action = { id, move, t: 0, hit: false, chain,token,targetId:target.id,powerRequest,powerAim:powerRequest?.aim?.slice(),at:this.time,throwHold:0 };f.lastId=id;f.flow++;
      this.flow.commit(f,target,f.action);
      if(request&&!grip&&!move.air&&!move.ground&&!move.grab&&!move.elastic&&!move.wind&&!move.lightning&&!move.element&&!move.ranged&&!move.reload&&distance(f,target)>1.4&&distance(f,target)<2.8&&this.yard.clearPath(f,target))f.action.entryDrive={distance:Math.min(1,distance(f,target)-1.2),travel:0};
      if(request&&move.pull&&!grip&&distance(f,target)>4.8&&distance(f,target)<6.1&&this.yard.clearPath(f,target))f.action.entryDrive={distance:Math.min(.65,distance(f,target)-4.8),travel:0};
      if(move.element)this.elements.prepare(f,f.action,target);
      if(move.wind)this.wind.prepare(f,f.action,target);if(move.lightning)this.lightning.prepare(f,f.action);
      if(move.ranged||move.reload)this.arsenal.prepare(f,f.action,target);
      const nearbyProp=this.yard.strikeProps(f,move,target,true);if(nearbyProp&&(distance(f,nearbyProp)<distance(f,target)-.2||target.ko||distance(f,target)>move.range))f.action.aimProp=nearbyProp.id;
      for (const b of f.buffer) b.until=Math.max(b.until,this.time+move.cancel+.32);
      if (move.throwType || move.pickup || move.mount) this.beginPair(f,target,move);
      else if (grip && move.launch) this.releaseGrip('launch');
      if (move.air) {
        if(!f.mobility?.voluntary||this.airHeight(target)>.18)f.vy = Math.max(f.vy, f.y < target.y - .5 ? 6.6 : 2.5);
        const d = distance(f, target);
        if(!move.elastic&&d>1.35)f.action.chase={x:f.x,z:f.z};
        if (d > 1.45) { f.vx += Math.sin(f.angle) * 3.5; f.vz += Math.cos(f.angle) * 3.5; }
      }
      if(ContactAPI.geometric(move)&&!move.elastic&&!move.elasticProp&&!grip){
        const desc=ContactAPI.descriptor(move),item=this.yard.held(f),desired=move.capture?1.0:move.ground?.30:move.weapon?1.0+(item?.hz||.5)*.65:desc.kind==='knee'?.64:desc.kind==='elbow'?.66:desc.kind==='foot'?(ContactAPI.zone(move)==='head'?.93:ContactAPI.zone(move)==='leg'?.94:1.12):move.air?.85:.98;
        const d=distance(f,target),ahead=(Math.sin(f.angle)*(target.x-f.x)+Math.cos(f.angle)*(target.z-f.z))/Math.max(.01,d);
        if(d<(move.air?5.6:move.range+.12)&&ahead>.65&&this.yard.clearPath(f,target)){const travel=clamp(d-desired+Math.max(0,(target.vx*Math.sin(f.angle)+target.vz*Math.cos(f.angle))*(1-Math.exp(-8*move.startup))/8),0,move.air?4.4:1.10);f.action.entryDrive={distance:travel,travel:0,dx:Math.sin(f.angle),dz:Math.cos(f.angle)};}
        if(move.air&&f.action.entryDrive){const delay=Math.max(0,f.action.entryDrive.distance/14-move.startup);if(delay>0)f.action.move={...move,startup:move.startup+delay,cancel:move.cancel+delay,duration:move.duration+delay};}
        f.action.chase=null;f.vx*=.2;f.vz*=.2;
      }
      if(f.action.entryDrive){f.action.entryDrive.dx??=Math.sin(f.angle);f.action.entryDrive.dz??=Math.cos(f.angle);}
      this.contacts.prepare(f,target,f.action);
      if(f.action.contactAim&&!move.elastic&&!move.elasticProp&&!grip){
        const a=f.action,point=a.contactAim.point,goal={x:point[0],y:point[1],z:point[2]},d=Math.hypot(goal.x-f.x,goal.z-f.z),desc=ContactAPI.descriptor(move),range=move.ground?3.5:move.air?5.6:request?2.8:move.range+.12;
        const desired=move.ground?(desc.kind==='elbow'?.35:desc.kind==='foot'?(move.pose==='upkick'?.48:.80):.52):move.weapon?.88:desc.kind==='knee'?.64:desc.kind==='elbow'?.66:desc.kind==='foot'?(ContactAPI.zone(move)==='head'?.93:ContactAPI.zone(move)==='leg'?.94:1.12):move.air?.85:.98;
        const pathTarget=a.aimProp?this.yard.props.find(p=>p.id===a.aimProp):target;
        if(d<range&&d>.01&&Math.sin(f.angle)*(goal.x-f.x)+Math.cos(f.angle)*(goal.z-f.z)>d*.65&&this.yard.clearPath(f,pathTarget)){
          const travel=clamp(d-desired,0,move.air?4.4:move.ground?3.0:request?1.8:1.10);a.entryDrive={distance:travel,travel:0,dx:(goal.x-f.x)/d,dz:(goal.z-f.z)/d};
          const delay=(move.ground||request)?Math.max(0,travel/6-a.move.startup):0;if(delay>0){a.move={...a.move,startup:a.move.startup+delay,cancel:a.move.cancel+delay,duration:a.move.duration+delay};this.contacts.prepare(f,target,a);}
        }
      }
      if (f.id === 'player') this.emit('attack', { token,requestedToken:({A:'P',Y:'K',M:'H'})[request]||token,assisted:!!request,move: move.name, id, chain });
      else {const brain=this.controllers[f.id];if(brain)brain.state.stringHits=(brain.state.stringHits||0)+1;this.emit('enemyAttack', { move: move.name,by:f.id });}
      return true;
    }
    setGuard(held) {
      if(this.run?.blocked()||this.boss?.blocked())return;
      const f = this.player;
      if(f.balloon){f.balloon.braking=held;f.guard=false;return;}
      if (held && !this.grapple && !this.tether && !f.guard && !f.action && !f.dodge && f.down <= 0 && f.stunned <= 0 && !this.over) {
        f.guardAt = this.time; f.guard = true; this.emit('guard');
      } else if (!held) f.guard = false;
    }
    gustStep(x=this.input.x,z=this.input.z){
      if(this.run?.blocked()||this.boss?.blocked())return false;
      const f=this.player;this.emit('controlInput',{token:'STEP',key:'G'});
      if(f.y>.10&&!this.mobility.grounded())return this.mobility.redirect(x,z);
      if(this.over||f.ko||f.balloon||f.down>0||f.stunned>0||f.held||f.dodge||this.grapple||this.tether||this.ground||this.time-(f.gustAt??-10)<.65)return false;
      const a=f.action;if(a&&(!a.connected||a.move.throwType||a.move.pickup||a.move.mount||a.move.reload))return false;
      const free=this.freePlayer();if(!free&&(f.windEnergy<18||f.stamina<8)){this.emit(f.windEnergy<18?'windEmpty':'tired');return false;}
      if(!free){f.windEnergy-=18;f.stamina-=8;}let n=Math.hypot(x,z);if(n<.1){x=Math.sin(f.angle);z=Math.cos(f.angle);n=1;}
      this.cover.release(f,'evade');f.gustAt=this.time;f.dodge={t:0,x:x/n,z:z/n,flow:true,origin:{x:f.x,z:f.z}};f.action=null;f.guard=false;f.regenAt=this.time+.6;f.chainUntil=Math.max(f.chainUntil,this.time+1.2);f.hitUntil=Math.max(f.hitUntil,this.time+1.2);for(const b of f.buffer)b.until=Math.max(b.until,this.time+1);
      this.demo=null;this.emit('gustStep',{x:f.x,y:f.y+.8,z:f.z});return true;
    }
    dodge(x = this.input.x, z = this.input.z) {
      if(this.run?.blocked()||this.boss?.blocked())return false;
      const f = this.player;
      if(f.balloon)return this.balloon.hop(f);
      if(f.held)return this.escapeHold();
      if(f.y>.001&&!this.mobility.grounded()&&!this.grapple&&!this.tether)return this.mobility.airEvasion(x,z);
      if (this.demo) { this.demo = null; this.emit('demoEnd'); }
      this.cover.release(f,'evade');
      if (this.over || f.down > 0 || f.stunned > 0 || f.dodge) return false;
      if(this.tether&&this.tether.owner===f){this.tether.target.held=false;this.tether=null;f.action=null;}
      if(f.y>.001&&!this.mobility.grounded()&&!this.grapple)return this.mobility.airEvasion(x,z);
      if (this.grapple && this.grapple.owner === f) {
        if (this.grapple.phase !== 'clinch') return false;
        this.releaseGrip('release'); f.action=null;
      }
      if(this.ground){this.standBlend(f);this.ground.target.visual=null;this.ground=null;this.enemy.down=Math.min(this.enemy.down,.45);}
      if (f.action && (!f.action.hit || f.action.t < f.action.move.cancel * .8)) return false;
      const free = this.freePlayer();
      if (!free && f.stamina < 14) { this.emit('tired'); return false; }
      if (!free) f.stamina -= 14;
      let len = Math.hypot(x, z);
      if (len < .1) { x = -Math.sin(f.angle); z = -Math.cos(f.angle); len = 1; }
      const front=(x*Math.sin(f.angle)+z*Math.cos(f.angle))/len,kind=front<-.55?'backstep':front>.55?'slip':'sidestep';
      f.dodge = { t: 0, x: x / len, z: z / len, kind, duration:kind==='slip'?.42:kind==='backstep'?.32:.30, origin: { x: f.x, z: f.z } };
      f.action = null; f.buffer.length = 0; f.guard = false; f.chain = '';
      f.regenAt = this.time + .6; this.emit('dodge',{kind}); return true;
    }
    escapeHold(){
      const f=this.player,g=this.grapple,t=this.tether;
      if(this.over||f.ko||this.time-(f.escapeAt??-10)<.28||!(g?.target===f&&g.phase==='clinch'||t?.target===f))return false;
      const free=this.freePlayer();if(!free&&f.stamina<18){this.emit('tired');return false;}if(!free)f.stamina-=18;f.regenAt=this.time+.8;f.escapeAt=this.time;
      const owner=g?.owner||t.owner;
      if(g){g.control=Math.max(0,g.control-38);this.emit('gripResist',{control:g.control});if(g.control>0)return true;this.releaseGrip('escape');}
      else{t.target.held=false;this.tether=null;this.emit('gripResist',{control:0});}
      owner.action=null;owner.buffer=[];owner.stunned=.28;f.stunned=0;f.vx=Math.sin(owner.angle)*2.5;f.vz=Math.cos(owner.angle)*2.5;f.counterUntil=this.time+.65;
      const brain=this.controllers[owner.id];if(brain){brain.state.plan=[];brain.state.next=this.time+.8;}this.emit('playerEscape');return true;
    }
    beginGrip(f,target,grip='front') {
      this.yard.onHurt(f);this.yard.onHurt(target);
      this.tether=null;
      if(f.id!=='player'){this.enemy=f;this.opponent=this.controllers[f.id];this.emit('target',{id:f.id,name:f.name});}
      target.action=null; target.buffer=[]; target.guard=false; target.held=true;
      const floor=Math.min(this.elementPhysics.floor(f),this.elementPhysics.floor(target));target.vx=target.vz=target.vy=0;target.y=floor;target.tumbling=false;target.down=0;f.y=floor;f.vy=0;
      const entryHands={};for(const actor of [f,target]){const pts=this.contacts.poses[actor.id]?.pts;if(pts)entryHands[actor.id]={L:pts.handL.slice(),R:pts.handR.slice()};}
      this.grapple={owner:f,target,phase:'clinch',floor,grip,control:100,age:0,gripAt:this.time,gripFrom:grip,entryHands,entryAt:this.time};this.ground=null;
      this.emit('clinch',{grip,by:f.id,target:target.id});
    }
    beginTether(owner,target){
      this.flow.reel(owner,target);
      target.held=true;target.guard=false;target.action=null;target.vx=target.vz=target.vy=0;
      this.tether={owner,target,at:this.time,fromX:target.x,fromZ:target.z,fromY:target.y,ownerY:owner.y,air:!!owner.action?.move.air,duration:.34};this.emit('reel');
    }
    updateTether(){
      const r=this.tether;if(!r)return;
      if(r.target.ko||r.owner.ko||!r.owner.action?.move.pull){r.target.held=false;this.tether=null;return;}
      const t=smooth((this.time-r.at)/r.duration),x=r.owner.x+Math.sin(r.owner.angle)*.78,z=r.owner.z+Math.cos(r.owner.angle)*.78;
      r.target.x=r.fromX+(x-r.fromX)*t;r.target.z=r.fromZ+(z-r.fromZ)*t;r.target.y=r.fromY*(1-t);
      if(r.air){r.owner.y=r.ownerY*(1-t);r.owner.vy=0;}
      r.target.walk+=.11;r.target.moving=1.2;
      if(t>=1)this.beginGrip(r.owner,r.target);
    }
    releaseGrip(reason='release') {
      if(!this.grapple)return;
      const {owner,target}=this.grapple;
      target.held=false;owner.visual=null;target.visual=null;this.grapple=null;
      this.emit('release',{reason});
    }
    standBlend(f){if(f.visual){f.recovery={height:f.visual.height,pitch:f.visual.pitch,at:this.time,duration:.5};f.visual={...f.visual,role:'recovering',mounted:false,pair:null};}}
    beginPair(f,target,m) {
      const grip=this.grapple?.grip||'front',floor=this.grapple?.floor??(this.ground?.target===target?this.ground.floor:null)??Math.min(this.elementPhysics.floor(f),this.elementPhysics.floor(target));
      const base=f.angle,dx=target.x-f.x,dz=target.z-f.z;
      const ox=dx*Math.cos(base)-dz*Math.sin(base),oz=dx*Math.sin(base)+dz*Math.cos(base);
      const type=m.throwType||(m.pickup?'pickup':'mount');
      const first=[0,0,0,(f.visual?.height??(f.y+1))-floor,f.visual?.pitch??0,0,ox,oz,(target.visual?.height??(target.down>0?.24+floor:target.y+1))-floor,target.visual?.pitch??(target.down>0?1.5:0),Math.atan2(Math.sin(target.angle-base),Math.cos(target.angle-base))];
      this.grapple={owner:f,target,phase:type==='pickup'?'pickup':type==='mount'?'mount':'throw',grip,control:100,age:0,type,
        floor,motion:{base,x:f.x,z:f.z,first,move:m,floor}};
      if(m.mount){
        const headYaw=first[10]+(first[9]<0?Math.PI:0);
        this.grapple.motion.end=[1,ox-Math.sin(headYaw)*.1,oz-Math.cos(headYaw)*.1,.68,0,headYaw,ox,oz,.24,first[9],first[10]];
      }
      if(m.pickup){
        const px=ox, pz=oz-.78,py=first[9];
        this.grapple.motion.nodes=[first,[.35,px,pz,.84,.2,0,ox,oz,.24,py,first[10]],[.7,px,pz,.75,.25,0,ox,oz,.64,py*.45,Math.PI],[1,px,pz,1,0,0,px,pz+.74,1,0,Math.PI]];
      }
      f.vx=f.vz=f.vy=0;f.y=floor;target.vx=target.vz=target.vy=0;target.held=true;target.action=null;
      if(m.throwType)this.emit('throwStart',{move:m.name,throwKind:m.throwType});
    }
    finishPair() {
      const g=this.grapple;if(!g||g.phase==='clinch')return;
      const {owner,target,motion}=g,m=motion.move,throwAction=owner.action;
      if(m.pickup){target.down=target.stunned=0;target.y=g.floor||0;this.beginGrip(owner,target,'front');return;}
      target.held=false;const recoverOwner=!!m.throwType&&owner.visual&&(owner.visual.height<.88||Math.abs(owner.visual.pitch)>.18);if(recoverOwner)this.standBlend(owner);else owner.visual=null;this.grapple=null;
      target.downPitch=target.visual?.pitch??1.5;
      if(!target.ko){
        target.down=Math.max(target.down,1.65);target.stunned=Math.max(target.stunned,1.65);
        this.ground={owner,target,until:this.time+2.1,floor:g.floor||0,mounted:!!m.mount,pitch:target.visual?.pitch??1.5,yaw:target.angle};
      }
      if(m.controlledThrow&&throwAction)this.elementPhysics.releaseThrow(owner,target,m,throwAction);
      else if(g.floor>0&&!this.elementPhysics.support(target)){this.ground=null;target.visual=null;target.down=0;target.vy=-1;target.tumbling=true;delete target.elementSupport;}
      if(m.fusion==='galeSling'){target.visual=null;this.ground=null;this.flow.releaseThrow(owner,target,m);}
      this.emit('ground',{mounted:!!m.mount});
    }
    updateGrapple(dt) {
      const g=this.grapple;if(!g)return;
      const {owner:f,target}=g;g.age+=dt;
      if(this.over||(target.ko&&g.phase==='clinch')){this.releaseGrip('reset');return;}
      if(g.phase==='clinch'){
        const gapFor=grip=>(grip==='bodylock'?.58:grip==='rear'?.60:.74)*(.6+.2*((f.bulk||1)+(target.bulk||1))),blend=smooth((this.time-(g.gripAt??-10))/.24),gap=gapFor(g.gripFrom||g.grip)+(gapFor(g.grip)-gapFor(g.gripFrom||g.grip))*blend,rate=1-Math.exp(-20*dt);
        const tx=f.x+Math.sin(f.angle)*gap,tz=f.z+Math.cos(f.angle)*gap;
        const previousX=target.x,previousZ=target.z;
        target.x+=(tx-target.x)*rate;target.z+=(tz-target.z)*rate;
        target.moving=Math.min(1.4,Math.hypot(target.x-previousX,target.z-previousZ)/Math.max(.001,dt));target.walk+=target.moving*dt*3.5;
        const angle=f.angle+(g.grip==='rear'?0:Math.PI);
        target.angle+=Math.atan2(Math.sin(angle-target.angle),Math.cos(angle-target.angle))*rate;
        target.y=g.floor||0;target.down=0;target.stunned=Math.max(target.stunned,.1);target.guard=false;
        target.visual={height:1+(g.floor||0),pitch:g.grip==='front'?.10:0,role:'held',grip:g.grip};
        f.visual={height:1+(g.floor||0),pitch:0,role:'holder',grip:g.grip};
        const free=this.freePlayer();
        if(!free){g.control-=dt*(this.mode==='sparring'?26:15);f.stamina=Math.max(0,f.stamina-3*dt);}
        f.hitUntil=Math.max(f.hitUntil,this.time+.3);f.chainUntil=Math.max(f.chainUntil,this.time+.4);
        if(g.control<=0||(!free&&f.stamina<1)){
          this.releaseGrip('escape');f.action=null;f.buffer=[];f.stunned=.22;this.aiAt=this.time+.45;this.emit('gripEscape');
        }
        return;
      }
      const motion=g.motion,m=motion.move,a=f.action;
      if(!a||a.move!==m){this.finishPair();return;}
      if(m.controlledThrow){const d=this.elementPhysics.throwDirection(f),wanted=Math.atan2(d[0],d[1]),turn=Math.atan2(Math.sin(wanted-motion.base),Math.cos(wanted-motion.base));motion.base+=clamp(turn,-dt*2.6,dt*2.6);a.throwDirection=d;}
      const q=clamp(a.t/m.startup,0,1),s=Wrestling.solveSample(g.type,pairSample(g.type,q,motion.first,motion.end,motion.nodes),q,g.grip,{owner:f.bulk||1,target:target.bulk||1});
      const toWorld=(x,z)=>[motion.x+x*Math.cos(motion.base)+z*Math.sin(motion.base),motion.z+z*Math.cos(motion.base)-x*Math.sin(motion.base)];
      [f.x,f.z]=toWorld(s[1],s[2]);[target.x,target.z]=toWorld(s[6],s[7]);
      const edge=Math.hypot(f.x,f.z)>Math.hypot(target.x,target.z)?f:target,rad=Math.hypot(edge.x,edge.z);
      if(rad>6.4){const shiftX=edge.x*(1-6.4/rad),shiftZ=edge.z*(1-6.4/rad);f.x-=shiftX;f.z-=shiftZ;target.x-=shiftX;target.z-=shiftZ;motion.x-=shiftX;motion.z-=shiftZ;}
      let oh=s[3],op=s[4],oy=s[5];
      if(a.t>m.startup){const r=smooth((a.t-m.startup)/(m.duration-m.startup));if(m.mount)oh=.68;else{oh+=(1-oh)*r;oy*=1-r;}op*=1-r;}
      f.angle=motion.base+oy;target.angle=motion.base+s[10];
      f.visual={height:oh+(motion.floor||0),pitch:op,role:'holder',grip:g.grip,pair:g.type,phase:q,mounted:!!m.mount};
      target.visual={height:s[8]+(motion.floor||0),pitch:s[9],role:'held',grip:g.grip,pair:g.type,phase:q};
      f.y=motion.floor||0;target.y=Math.max(motion.floor||0,s[8]-1+(motion.floor||0));target.stunned=Math.max(target.stunned,.1);target.guard=false;
      if(!m.pickup&&q>=1)target.y=motion.floor||0;
    }
    updateGround(dt) {
      const g=this.ground;if(!g||this.grapple)return;
      const {owner,target}=g;
      if(target.ko||this.time>g.until||distance(owner,target)>3.2){this.standBlend(owner);this.ground=null;target.visual=null;return;}
      target.down=Math.max(target.down,.35);target.stunned=Math.max(target.stunned,.35);target.y=g.floor||0;
      target.visual={height:.24+(g.floor||0),pitch:g.pitch,role:'grounded',mountPinned:!!g.mounted};target.angle=g.yaw;
      if(g.mounted){
        const headYaw=target.angle+(g.pitch<0?Math.PI:0);
        const x=target.x-Math.sin(headYaw)*.1,z=target.z-Math.cos(headYaw)*.1,r=1-Math.exp(-15*dt);
        owner.x+=(x-owner.x)*r;owner.z+=(z-owner.z)*r;owner.angle=headYaw;
        owner.visual={height:.68+(g.floor||0),pitch:0,role:'holder',mounted:true};
      }
    }
    spark(x, y, z, kind, count = 13) {
      const colors = kind === 'parry' ? [[.63, .91, 1], [1, 1, 1]] : kind === 'block' ? [[.59, .67, .69]] : [[1, .85, .26], [1, .98, .83]];
      for (let i = 0; i < count; i++) {
        const a = this.random() * Math.PI * 2, speed = 1 + this.random() * 3.3;
        this.particles.push({ x, y, z, vx: Math.cos(a) * speed, vz: Math.sin(a) * speed,
          vy: .8 + this.random() * 2.4, life: .28 + this.random() * .25, max: .55,
          color: colors[i % colors.length], size: .025 + this.random() * .025 });
      }
    }
    react(target,source,m,strength=1){
      this.mobility.interrupt(target);this.cover.release(target,'hit');
      const zone=m.zone||(/lowkick|oblique|sweep/i.test(m.pose)?'leg':/body|knee|roundhouse/i.test(m.pose)?'body':m.throwType||m.ground?'floor':'head'),profile=FlowAPI.reaction({...m,zone});
      target.impact={id:++target.impactId,at:this.time,zone,direction:m.contact?.normal?m.contact.normal.slice():[Math.sin(source.angle),0,Math.cos(source.angle)],
        power:Math.min(4.8,.8+m.damage*.09)*strength,side:m.limb==='L'||m.limb==='legL'?-1:1,launch:!!m.launch,slam:!!m.slam||!!m.throwType,profile,duration:FlowAPI.PROFILES[profile].duration,point:m.contact?.point?.slice(),joint:m.contact?.joint};
    }
    strike(f, target, a) {
      let m=a.move;const d=distance(f,target),contact=a.contact,physical=!!contact;
      if(m.weapon&&!this.yard.held(f))return 'miss';
      if(contact?.kind==='world'){
        if(contact.prop)this.yard.damage(contact.prop,m.damage*(contact.prop.type==='crate'?.85:1.15),f,{x:Math.sin(f.angle)*m.damage/Math.max(2,contact.prop.mass)*1.3,y:m.launch?3:.8,z:Math.cos(f.angle)*m.damage/Math.max(2,contact.prop.mass)*1.3});
        if(m.weapon)this.yard.wear(f);this.spark(...contact.point,'block',7);this.freeze=.018;this.emit('surfaceContact',{by:f.id,move:m.name,point:contact.point,prop:contact.prop?.id||null});return 'world';
      }
      if(contact?.kind==='clash'){
        f.stamina=Math.max(0,f.stamina-7);target.stamina=Math.max(0,target.stamina-7);f.regenAt=target.regenAt=this.time+.6;
        target.action.hit=true;target.action.result='clash';this.spark(...contact.point,'parry',14);this.freeze=.045;this.shake=.07;this.emit('weaponClash',{by:f.id,target:target.id,point:contact.point});return 'clash';
      }
      const propHit=physical?false:this.yard.strikeProps(f,m,target);if(m.weapon)this.yard.wear(f);
      const paired=this.grapple&&this.grapple.owner===f&&this.grapple.target===target&&this.grapple.phase!=='clinch';
      const attached=this.grapple&&this.grapple.owner===f&&this.grapple.target===target;
      if(!physical&&!paired&&!attached&&this.yard.lineBlocked(f,target,m.zone==='leg'||m.pose==='lowkick'?.55:1.45)){if(f.id==='player')this.emit('yardNotice',{text:'A solid object blocks the strike.'});return propHit?'world':'miss';}
      const facing = d < .15 ? 1 : (Math.sin(f.angle) * (target.x - f.x) + Math.cos(f.angle) * (target.z - f.z)) / d;
      const vertical = Math.abs(f.y - target.y);
      if (target.ko || (target.down > .08 && this.airHeight(target)<.12 && !m.ground && !paired)) return propHit?'world':'miss';
      if(m.capture&&(f.y-this.elementPhysics.floor(f)>.2||target.y-this.elementPhysics.floor(target)>.35||Math.abs(f.y-target.y)>.3)){if(f.id==='player')this.emit('whiff',{move:m.name});return 'miss';}
      if (!physical&&target.dodge && target.dodge.t < .24) {
        const origin = target.dodge.origin, originalDistance = distance(f, origin);
        const originalFacing = originalDistance < .15 ? 1 : (Math.sin(f.angle) * (origin.x - f.x) + Math.cos(f.angle) * (origin.z - f.z)) / originalDistance;
        if (originalDistance <= m.range + .12 && originalFacing > .35) {
          if (target.id === 'player' && !target.dodge.rewarded) {
            target.dodge.rewarded = true; target.counterUntil = this.time + .9; this.emit('evade');
          }
          return 'evade';
        }
      }
      if (!physical && !paired && !attached && (d > m.range || facing < .35 || (!m.ground&&vertical > (m.air?2.3:m.launch ? 1.7 : 1.32)))) {
        if (f.id === 'player'&&!propHit) this.emit('whiff', { move: m.name }); return propHit?'world':'miss';
      }
      if (!physical&&target.dodge && target.dodge.t < .24) return 'evade';
      if(target.balloon)return this.balloon.absorb(target,f,m);
      const guarded = target.guard && !target.action && !m.grab && (!physical||contact.kind==='guard');
      if (guarded && this.time - target.guardAt < .17 && target.stamina > 5) {
        f.action = null; f.buffer.length = 0; f.stunned = .65; f.hurt = .2;
        this.react(f,target,m,.5);
        target.counterUntil = this.time + 1.2; target.stamina = Math.min(100, target.stamina + 12);
        this.spark(...(contact?.point||[target.x,target.y+1.5,target.z]),'parry',20);
        this.freeze = .07; this.shake = .18;
        if (target.id === 'player') { this.parries++; this.emit('parry',{point:contact?.point}); }
        else this.emit('enemyParry',{point:contact?.point});
        return 'parry';
      }
      if (guarded && !m.break && target.stamina > m.damage * 1.35) {
        target.stamina -= m.damage * 1.35; target.regenAt = this.time + 1;
        target.vx += Math.sin(f.angle) * .7; target.vz += Math.cos(f.angle) * .7;
        this.react(target,f,m,.3);
        this.flow.pressure(target,f,m,{blocked:true});
        this.spark(...(contact?.point||[target.x,target.y+1.4,target.z]),'block',7); this.freeze = .025;
        this.emit('block', { by: target.id, move: m.name,point:contact?.point }); return 'block';
      }
      if (guarded) {
        target.guard = false; target.stamina = Math.max(0, target.stamina - 25);
        target.stunned = .65; this.emit('guardBreak', { by: f.id });
      }
      if(m.damage>0)m={...m,damage:this.infusion.defend(target,this.infusion.amplify(f,target,a,m.damage))};
      target.action = null; target.buffer.length = 0; target.chain = '';target.connections=[];target.flow=0;
      target.hurt = .25; target.stunned = Math.max(target.stunned, m.stun);
      target.health = Math.max(0, target.health - m.damage);target.lastDamage={kind:m.throwType?'throw':m.weapon?'weapon':'strike',by:f.id};
      target.lastAttacker=f;target.lastHitAt=this.time;
      if(m.damage>=12||m.launch||m.slam)this.yard.onHurt(target);
      if(m.damage>0)this.react(target,f,physical?{...m,zone:contact.zone,contact}:m);
      this.flow.pressure(target,f,m);
      const push = m.push * 7/(target.mass||1)*(this.ground?.mounted&&this.ground.target===target&&!m.launch?.08:1);
      target.vx = Math.sin(f.angle) * push; target.vz = Math.cos(f.angle) * push;
      if (m.launch) { target.vy = (6.1+(f.id==='player'?this.perk('air')*.25:0))/Math.sqrt(target.mass||1); target.y = Math.max(.06, target.y);target.tumbling=true;target.down=0; }
      if (m.air && !m.slam && !m.pull) { target.y = Math.max(.65, target.y); target.vy = 3.3+(f.id==='player'?this.perk('air')*.35:0);target.tumbling=true;target.airJuggles++; }
      if (m.grab) { target.vx *= .3; target.vz *= .3; }
      if (m.slam) { target.vy = -6; target.down = 1.35; target.downAt = this.time; target.stunned = 1.35;target.tumbling=true; }
      if(m.throwType){this.updateGrapple(0);target.down=2.2;target.downAt=this.time;target.stunned=2.2;target.vx=target.vz=target.vy=0;target.y=this.grapple?.floor||0;this.emit('throwImpact',{move:m.name,throwKind:m.throwType,target:target.id});this.flow.throwImpact(f,target,a);}
      if(m.ground&&m.damage>0&&!m.launch){target.down=Math.max(target.down,1.4);target.stunned=Math.max(target.stunned,1.4);if(this.ground)this.ground.until=this.time+2.1;}
      if(m.ground&&m.launch){target.down=0;target.downAt=this.time;target.recovery={height:.24,pitch:target.visual?.pitch??1.5,at:this.time};this.ground=null;f.visual=null;target.visual=null;}
      if(m.capture)this.beginGrip(f,target);
      if(m.pull)this.beginTether(f,target);
      if(m.grip&&this.grapple){this.grapple.gripFrom=this.grapple.grip;this.grapple.gripAt=this.time;this.grapple.grip=m.grip;this.grapple.control=Math.min(100,this.grapple.control+24);this.emit('grip',{grip:m.grip});}
      if(m.heldStrike&&this.grapple)this.grapple.control=Math.min(100,this.grapple.control+5);
      if(m.release)this.releaseGrip('shove');
      if(m.damage>0){
        this.spark(...(contact?.point||[target.x,m.throwType||m.ground?.3:target.y+(m.pose==='lowkick'?.55:1.35),target.z]),'hit',m.throwType?28:m.finish?20:12);
        this.freeze=m.throwType?.065:m.finish?.045:.022;this.shake=m.throwType?.24:m.finish?.2:.085;
      }
      this.recordConnection(f,target,a,m.damage);
      if (target.health <= 0)this.knockout(target);
      if(m.throwType)this.finishPair();
      if(m.damage>0)this.infusion.contact(f,target,a);
      return 'hit';
    }
    recordConnection(f,target,a,damage=a.move.damage){
      const m={...a.move,damage},firstConnection=!a.connected;a.connected=true;
      if((m.launch||m.air)&&f.id==='player')this.flow.focus={id:target.id,until:this.time+2.4};
      if (f.id === 'player') {
        if (this.time > f.hitUntil) { f.hits = 0; f.damage = 0; }
        if(m.damage>0)f.hits++;
        f.damage += m.damage; f.hitUntil = this.time + 2.0; f.lastMove = m.name;
        if(firstConnection){f.landedChain = f.chain.length === 1 || f.landedChain === f.chain.slice(0, -1) ? f.chain : '';
          f.connections.push({token:a.token,id:a.id});f.connections=f.connections.slice(-24);}
        if(m.damage>0)this.totalHits++;
        this.best = Math.max(this.best, f.hits); this.bestDamage = Math.max(this.bestDamage, f.damage);
        const event={contact:a.contact?{point:a.contact.point.slice(),normal:a.contact.normal.slice(),zone:a.contact.zone,joint:a.contact.joint}:null,id:a.id,damage:m.damage,move:m.name,hits:f.hits,total:f.damage,finish:m.finish,chain:a.chain,connectedChain:f.landedChain,transition:m.damage===0,weapon:!!m.weapon,air:!!m.air,elastic:!!m.elastic||!!m.elasticProp,wind:!!m.wind,lightning:!!m.lightning,element:m.elementFamily|| (a.imbued?a.imbued[0].toUpperCase()+a.imbued.slice(1):null),ranged:!!m.ranged,ground:!!m.ground,target:target.id};
        this.emit('connect',event);if(m.damage>0)this.emit('hit',event);
        const completed = ROUTES.filter(r => r.seq === f.landedChain || (f.connections.length>=r.seq.length&&f.connections.slice(-r.seq.length).every((c,i)=>c.token===r.seq[i]&&c.id===r.steps[i])));
        if (firstConnection&&completed.length) this.emit('route', { route: completed.sort((a,b)=>b.seq.length-a.seq.length)[0] });
      } else {
        this.player.hits = 0; this.player.damage = 0; this.emit('hurt', { damage: m.damage,by:f.id,target:target.id,contact:a.contact?{point:a.contact.point.slice(),zone:a.contact.zone,joint:a.contact.joint}:null });
        if(m.ground&&!m.launch){f.groundHits=1;this.aiPlan=[];this.aiAt=this.time+target.down+.60;}
      }
    }
    knockout(target){
      if(target.ko)return;
      target.ko=true;this.emit('fighterKO',{target:target.id,by:target.lastDamage?.by||null,kind:target.lastDamage?.kind,environmental:target.lastDamage?.by==='player'&&ENV.has(target.lastDamage?.kind)});target.down=2;target.downAt=this.time;target.stunned=2;target.guard=false;target.tumbling=true;this.yard.onHurt(target);
      if(target.id!=='player'){const remaining=this.enemies.filter(e=>!e.ko).length;if(!remaining){this.respawn=2;this.emit('ko',{round:this.round});}else this.emit('enemyKO',{id:target.id,name:target.name,remaining});}
      else{this.over=true;if(this.isGroup()||this.mode==='practice'&&this.dummy==='active')this.respawn=2.8;this.emit('defeat');}
    }
    environmentHit(target,{source=null,damage,kind,dir,speed=3,preserve=false,propType=null,connection=null,name=null,difficultyApplied=false}){
      if(target.ko)return false;
      if(!difficultyApplied&&target.id==='player'&&source&&source.id!=='player'&&this.isLive())damage=Math.max(1,Math.round(damage*LEVELS[this.difficulty].damage));
      if(target.balloon)return this.balloon.absorb(target,{angle:Math.atan2(dir[0],dir[2])},{damage,pose:'impact'});
      const d=Math.hypot(dir[0],dir[2])||1,dx=dir[0]/d,dz=dir[2]/d;
      if(target.guard&&kind==='prop'){damage=Math.max(2,Math.round(damage*.35));target.stamina=Math.max(0,target.stamina-12);}
      const coatAction={move:{damage,name:name||kind,finish:kind==='belly'}};if(source&&['balloon','belly'].includes(kind))damage=this.infusion.amplify(source,target,coatAction,damage);damage=this.infusion.defend(target,damage);
      target.health=Math.max(0,target.health-damage);target.lastDamage={kind,by:source?.id||null};target.hurt=.25;target.lastAttacker=source;target.lastHitAt=this.time;
      if(!preserve){if(target.action?.move.wind==='dash'){target.vx*=.25;target.vz*=.25;}target.action=null;target.buffer=[];target.chain='';target.connections=[];target.stunned=Math.max(target.stunned,.30);this.yard.onHurt(target);}
      if(!preserve){
        if(this.grapple&&(this.grapple.owner===target||this.grapple.target===target)){this.grapple.owner.action=null;this.grapple.owner.buffer=[];this.grapple.target.action=null;this.grapple.target.buffer=[];this.releaseGrip('impact');}
        if(this.tether&&(this.tether.owner===target||this.tether.target===target)){this.tether.owner.action=null;this.tether.target.held=false;this.tether=null;}
        if(this.ground&&(this.ground.owner===target||this.ground.target===target)){this.standBlend(this.ground.owner);this.ground.target.visual=null;this.ground=null;}
      }
      const down=kind==='table'||kind==='barrier'||kind==='balloon'||kind==='belly'||kind==='body'&&speed>3.2||kind==='prop'&&speed>5||kind==='wall'&&speed>5.8;
      if(down&&!preserve){target.down=Math.max(target.down,1.15);target.stunned=Math.max(target.stunned,1.15);target.downAt=this.time;target.tumbling=true;}
      target.vx+=dx*Math.min(2.6,speed*.28)/(target.mass||1);target.vz+=dz*Math.min(2.6,speed*.28)/(target.mass||1);
      const contactMove={damage,pose:'impact',kind,zone:kind==='table'||kind==='barrier'?'floor':'body',slam:down};
      if(kind!=='burn')this.react(target,{angle:Math.atan2(dx,dz)},contactMove);this.flow.pressure(target,source,connection?{...connection.move,damage}:contactMove,{kind});
      name=name|| (kind==='wall'?'Wall impact':kind==='table'?'Table crash':kind==='barrier'?'Barrier crash':kind==='balloon'?'Balloon bowling':kind==='belly'?'Belly-drop shockwave':kind==='body'?'Body collision':kind==='bumper'?'Rebound pad':'Object impact');
      if(!connection&&source?.id==='player'&&source!==target){if(this.time>source.hitUntil){source.hits=0;source.damage=0;}source.hits++;source.damage+=damage;source.hitUntil=this.time+2;source.lastMove=name;this.totalHits++;this.best=Math.max(this.best,source.hits);this.bestDamage=Math.max(this.bestDamage,source.damage);}
      if(kind!=='burn'){this.spark(target.x,target.y+.65,target.z,'hit',15);this.shake=Math.max(this.shake,.18);this.freeze=Math.max(this.freeze,.035);}
      if(connection)this.recordConnection(source,target,connection,damage);else this.emit('envHit',{kind,damage,by:source?.id,target:target.id,move:name,x:target.x,z:target.z,propType});
      if(target.health<=0)this.knockout(target);else if(coatAction.imbued)this.infusion.contact(source,target,coatAction);return true;
    }
    watch(routeId) {
      const r = ROUTES.find(c => c.id === routeId);
      if (!r) return;
      this.mode = 'practice'; this.dummy = 'passive'; this.infinite = true; this.reset();
      if(r.group==='Stretch'&&/^[STR]/.test(r.seq)){this.player.x-=Math.sin(this.player.angle)*2;this.player.z-=Math.cos(this.player.angle)*2;}
      this.demo = { route: r, index: 0, next: this.time + .55 };
      this.emit('demoStart', { route: r });
    }
    updateFighter(f, other, dt) {
      f.windEnergy=Math.min(100,f.windEnergy+dt*(f.action?.move.wind||f.action?.move.lightning||f.action?.move.element||f.action?.move.elementTag||f.action?.move.windCost||this.infusion.active(f)&&f.action?0:13));
      if(f.balloon){this.balloon.step(f,dt);return;}
      if(f.recovery){const r=smooth((this.time-f.recovery.at)/(f.recovery.duration||.36));f.visual={height:f.recovery.height+(f.y+1-f.recovery.height)*r,pitch:f.recovery.pitch*(1-r),role:'recovering'};if(r>=1){f.recovery=null;f.visual=null;}}
      f.hurt = Math.max(0, f.hurt - dt); f.stunned = Math.max(0, f.stunned - dt); f.down = Math.max(0, f.down - dt);
      if (this.time > f.regenAt && !f.action && !f.guard && (!this.grapple||this.grapple.owner!==f)) f.stamina = Math.min(100, f.stamina + 27 * dt);
      if (f.guard) f.stamina = Math.max(0, f.stamina - 1.2 * dt);
      if (f.stamina <= 0) f.guard = false;
      if (f.dodge) {
        f.dodge.t += dt;
        const kind=f.dodge.kind;
        const speed=f.dodge.flow?(f.dodge.t<.16?6.4:2):kind==='air'?0:kind==='backstep'?(f.dodge.t<.13?8.5:1.8):kind==='sidestep'?(f.dodge.t<.16?8:1.8):kind==='slip'?(f.dodge.t<.28?6.3:1.8):f.dodge.t<.22?7.7:2;
        f.x += f.dodge.x * speed * dt; f.z += f.dodge.z * speed * dt;
        if (f.dodge.t >= (f.dodge.duration||(f.dodge.flow?.26:.38))) f.dodge = null;
      }
      if(f.action?.move.wind==='dash')this.wind.dash(f,f.action,dt);if(f.action?.move.dash)this.elements.dash(f,f.action,dt);
      if(f.action?.entryDrive&&!f.action.hit){const a=f.action,drive=a.entryDrive,progress=smooth(Math.min(a.move.startup,a.t+dt)/a.move.startup)*drive.distance,travel=Math.max(0,progress-drive.travel),d=distance(f,other)||1;f.x+=(drive.dx??(other.x-f.x)/d)*travel;f.z+=(drive.dz??(other.z-f.z)/d)*travel;drive.travel=progress;}
      f.x += f.vx * dt; f.z += f.vz * dt;
      const airControl=f.id==='player'&&f.mobility.voluntary&&!f.tumbling&&f.y>.08&&!f.held&&!this.grapple&&!this.tether;
      const decay = Math.exp(-(airControl?f.mobility.anchor?2:1.45:8) * dt); f.vx *= decay; f.vz *= decay;
      const controlled=f.held||(this.grapple&&this.grapple.owner===f&&this.grapple.phase!=='clinch')||(this.tether?.owner===f&&this.tether.air);
      if (!controlled && (f.y > 0 || f.vy > 0) && !(f.elementSupport&&this.elementPhysics.support(f)||f.id==='player'&&f.mobility.support&&this.mobility.grounded())) {
        const previousY=f.y;f.vy -= 10.5 * dt; f.y = Math.max(0, f.y + f.vy * dt);
        if(f.action?.move.air&&!f.action.airTrack&&!f.action.move.pull&&other.y>.2)f.y+=(other.y-f.y)*Math.min(1,dt*5);
        const surface=this.elementPhysics.landing(f,previousY);if(surface){f.y=surface.y+surface.hy;f.elementSupport={id:surface.id,top:f.y};if(f.id==='player')f.mobility.support={id:surface.id};}
        if (f.y === 0||surface) { const speed=Math.abs(f.vy);f.vy = 0;f.airJuggles=0;const recovered=f.id==='player'&&this.mobility.land(speed);if(!recovered&&f.tumbling&&!f.action){f.down=Math.max(f.down,1.05);f.stunned=Math.max(f.stunned,1.05);f.downAt=this.time;this.react(f,{angle:Math.atan2(f.vx||Math.sin(f.angle),f.vz||Math.cos(f.angle))},{damage:Math.min(30,speed*2),pose:'landing',zone:'floor',slam:true},.65);this.emit('land',{by:f.id,speed});}f.tumbling=false; }
      }
      const radius = Math.hypot(f.x, f.z);
      if (!this.yard&&radius > 6.5) { f.x *= 6.5 / radius; f.z *= 6.5 / radius; f.vx *= .4; f.vz *= .4; }
      if (f.action) {
        const a = f.action; a.t += dt;
        if(a.move.controlledThrow&&f.id==='player'&&this.power.throwHeld&&this.time-a.at<1.25&&a.t>a.move.startup*.67){a.t=a.move.startup*.67;a.throwHold+=dt;}
        if(a.airTrack&&a.t<=a.move.startup+.035){const u=clamp(a.t/a.move.startup,0,1),s=u*u*(3-2*u);f.y=a.airTrack.from+(a.airTrack.to-a.airTrack.from)*s;f.vy=(a.airTrack.to-a.airTrack.from)*6*u*(1-u)/a.move.startup;}
        if(a.move.propPickup||a.move.propFetch){const p=this.yard.props.find(p=>p.id===a.propId);if(p&&!p.heldBy){this.face(f,p,Math.min(1,dt*16));if(a.move.propPickup&&a.t<=a.move.startup){const d=distance(f,p),e=smooth(a.t/a.move.startup),move=Math.max(0,d-.80);f.x+=Math.sin(f.angle)*move*e*.35;f.z+=Math.cos(f.angle)*move*e*.35;}}}
        if(a.chase&&a.t<=a.move.startup+dt){const e=smooth(a.t/a.move.startup),x=other.x-Math.sin(f.angle)*1.20,z=other.z-Math.cos(f.angle)*1.20;f.x=a.chase.x+(x-a.chase.x)*e;f.z=a.chase.z+(z-a.chase.z)*e;}
        if (!a.hit && !ContactAPI.geometric(a.move) && a.t >= a.move.startup) { a.hit = true;a.result=a.move.element?this.elements.resolve(f,a):a.move.ranged||a.move.reload?this.arsenal.resolve(f,a):a.move.wind?this.wind.resolve(f,a):a.move.lightning?this.lightning.resolve(f,a):a.move.propPickup||a.move.propFetch||a.move.propThrow?this.yard.resolveAction(f,a):this.strike(f, other, a);this.infusion.cast(f,a,a.result);if(a.result!=='hit'&&a.result!=='projectile'){f.connections=[];f.landedChain='';} }
        if (f.action === a) {
          f.buffer = f.buffer.filter(b => b.until >= this.time);
          if (a.t >= a.move.cancel && f.buffer.length && f.stunned <= 0) {
            if(a.move.throwType||a.move.pickup||a.move.mount)this.finishPair();
            const b = f.buffer.shift(); f.action = null; this.start(f, this.targetFor(f,false), b.token,null,b.power);
          } else if (a.t >= a.move.duration) {
            if(a.move.throwType||a.move.pickup||a.move.mount)this.finishPair();
            f.action = null;
            if (f.buffer.length && f.stunned <= 0){const b=f.buffer.shift();this.start(f,this.targetFor(f,false),b.token,null,b.power);}
          }
        }
      }
      if(!f.action&&f.buffer.length&&!f.held&&!f.dodge&&f.stunned<=0&&f.down<=0&&!f.ko){f.buffer=f.buffer.filter(b=>b.until>=this.time);if(f.buffer.length){const b=f.buffer.shift();this.start(f,this.targetFor(f,false),b.token,null,b.power);}}
      if (f.hits && this.time > f.hitUntil) { f.hits = 0; f.damage = 0; }
      if (!f.action && this.time > f.chainUntil) {f.chain='';f.connections=[];f.flow=0;}
      if (this.locked && !f.cover && !this.grapple && !f.action && !f.ko && !f.dodge) this.face(f, other, Math.min(1, dt * 12));
    }
    updateAI(dt) {
      if(this.boss?.active)return this.boss.update(dt);
      if(this.isGroup()){this.updateAttackTurn();if(this.groupBehavior==='passive'){for(const e of this.enemies){e.moving=0;e.intent='practice target';}}else for(const e of this.enemies)this.controllers[e.id].update(dt);return;}
      if(this.mode==='sparring'||this.dummy==='footwork')return this.opponent.update(dt);
      const e = this.enemy, p = this.player;
      if (e.ko || e.held || this.over || e.stunned > 0 || e.down > 0 || (this.airHeight(e)>.1&&this.airHeight(p)<.15)) return;
      const active = this.mode === 'sparring' || this.dummy === 'counter'||this.dummy==='active';
      if (!active) {
        e.moving=0;e.intent=this.dummy==='guard'?'guarding':'passive';
        e.guard = this.dummy === 'guard';
        e.guardAt = -9; return;
      }
      if(p.down>.08&&this.airHeight(p)<.12&&e.groundHits&&!e.action)return;
      if(p.down<=0)e.groundHits=0;
      const d = distance(p, e);
      if(e.action&&e.action.t>=e.action.move.cancel&&!e.buffer.length&&this.aiPlan.length){e.buffer.push({token:this.aiPlan.shift(),until:this.time+1.5});this.aiAt=this.time+.55;}
      if (!e.action && d > 1.75) {
        this.face(e, p); const speed = this.mode === 'sparring' ? 2.05 : 1.25;
        const direction=this.yard.steer(e,p);e.x += direction[0] * dt * speed; e.z += direction[1] * dt * speed;
        e.moving = speed; e.walk += dt * speed * 3.5; e.guard = false;
      } else e.moving = 0;
      if (this.time >= this.aiAt && !e.action && d < 2.45) {
        e.guard = false;
        if(!this.aiPlan.length&&this.dummy!=='counter'){
          const plans=[['P','P','K'],['K','P','K'],['H','H'],['U','P','K','H'],['P','S','T'],['T','S','S'],['H','P','H']];
          this.aiPlan=plans[Math.floor(this.random()*plans.length)].slice();
        }
        const token = this.aiPlan.length ? this.aiPlan.shift() : 'H';
        this.start(e, p, token);
        this.aiAt = this.time + (this.dummy === 'counter' && this.mode !== 'sparring' ? 2.1 : .55 + this.random() * .5);
      }
      if (!e.action && this.time < this.aiAt - .25 && this.mode === 'sparring') { e.guard = this.random() < .009 ? !e.guard : e.guard; e.guardAt = -9; }
    }
    step(realDt){
      this.tickRemainder=(this.tickRemainder||0)+clamp(realDt,0,.05);
      const h=1/120;let count=0;while(this.tickRemainder+1e-9>=h&&count++<6){this.tickRemainder=Math.max(0,this.tickRemainder-h);this.tick(h);}
    }
    tick(realDt) {
      if(this.run?.blocked()||this.boss?.blocked())return;
      realDt = clamp(realDt, 0, .05);
      this.shake *= Math.exp(-13 * realDt);
      for (const p of this.particles) {
        p.life -= realDt; p.x += p.vx * realDt; p.y += p.vy * realDt; p.z += p.vz * realDt; p.vy -= 8 * realDt;
      }
      this.particles = this.particles.filter(p => p.life > 0);
      if (this.freeze > 0) { this.freeze = Math.max(0, this.freeze - realDt); return; }
      const dt = realDt*(!this.isLive()?clamp(this.practiceSpeed,.5,1):1);this.contacts.begin(); this.time += dt;
      const p = this.player;
      this.elementPhysics.before(dt);this.power.update();this.cover.before(dt);this.mobility.before(dt);
      if(!p.cover)p.motion={x:0,z:0};
      if (!this.elementPhysics.surf && !p.cover && !p.balloon && this.mobility.grounded() && !this.over && !p.action && !p.dodge && p.stunned <= 0 && p.down <= 0 && !p.ko && (!this.grapple||this.grapple.phase==='clinch') && !this.ground?.mounted) {
        let { x, z } = this.input, len = Math.hypot(x, z);
        if (len > 0) {
          x /= Math.max(1, len); z /= Math.max(1, len);
          const speed = (this.grapple ? .85 : p.mobility.crouch>.1 ? 1.25 : p.guard ? 1.45 : 3.5)*(this.infusion.status(p,'mud')?.58:1)*(this.power.charge?.65:1);
          p.x += x * speed * dt; p.z += z * speed * dt; p.moving = speed; p.walk += dt * speed * 3.5;
          p.motion={x:x*Math.cos(p.angle)-z*Math.sin(p.angle),z:x*Math.sin(p.angle)+z*Math.cos(p.angle)};
          if (!this.locked){const angle=Math.atan2(x,z);p.angle=this.grapple?p.angle+Math.atan2(Math.sin(angle-p.angle),Math.cos(angle-p.angle))*Math.min(1,dt*7):angle;}
        } else if(!p.cover)p.moving = 0;
      } else if(!p.cover)p.moving = 0;
      this.team.step();this.updateFighter(p,this.targetFor(p),dt);for(const e of this.enemies)this.updateFighter(e,p,dt);
      this.updateTether();this.updateGrapple(dt);this.updateGround(dt);this.mobility.constrain();this.contacts.sync();this.contacts.resolve();this.updateAI(dt);
      this.wind.step(dt);this.lightning.step(dt);this.flow.step(dt);this.separateFighters();
      this.yard.step(dt);this.arsenal.step(dt);this.elements.step(dt);this.infusion.step(dt);this.elementPhysics.after(dt);this.trials.step(dt);this.journal.step();
      if(this.run.active||this.boss.active)this.respawn=0;this.run.step();
      if (this.respawn > 0) {
        this.respawn -= dt;
        if (this.respawn <= 0) {
          if (this.mode === 'sparring'||this.isGroup()&&!this.over) this.round++;
          const best = this.best; this.reset(true); this.best = best; this.emit('ready', { round: this.round });
        }
      }
      if (this.demo && this.time >= this.demo.next && !p.action && !this.enemy.ko) {
        const d = this.demo;
        if (d.index < d.route.seq.length) { this.attack(d.route.seq[d.index++], true); d.next = this.time + .03; }
        else { this.demo = null; this.emit('demoEnd'); }
      } else if (this.demo && p.action && this.time >= this.demo.next && p.action.t >= p.action.move.cancel && !p.buffer.length) {
        const d = this.demo;
        if (d.index < d.route.seq.length) { this.attack(d.route.seq[d.index++], true); d.next = this.time + .1; }
      }
    }
    snapshot() {
      const p = this.player;
      return { journal:this.journal.snapshot(),boss:this.boss.snapshot(),power:this.power.snapshot(),elementPhysics:this.elementPhysics.snapshot(),infusion:this.infusion.snapshot(),cover:this.cover.snapshot(),mobility:this.mobility.snapshot(),flow:this.flow.snapshot(),run:this.run.snapshot(),trial:this.trials.snapshot(),assist:{mode:this.assistMode,style:this.assistStyle},mode: this.mode, chain: p.chain, action: p.action && p.action.id,
        hits: p.hits, damage: p.damage, best: this.best, enemyHealth: this.enemy.health,
        playerHealth: p.health, stamina: p.stamina, round: this.round, parries: this.parries,
        grapple:this.grapple?{phase:this.grapple.phase,grip:this.grapple.grip,control:this.grapple.control}:null,
        ground:this.ground?{mounted:this.ground.mounted}:null,tether:!!this.tether,yard:this.yard.snapshot(),opponent:this.opponent.snapshot(),arena:this.arenaId,hazards:this.hazards,
        windEnergy:p.windEnergy,wind:this.wind.waves.length,target:this.enemy.id,group:this.isGroup()?{count:this.groupCount,mix:this.groupMix,behavior:this.groupBehavior,attacker:this.attackOwner}:null,enemies:this.enemies.map(e=>({id:e.id,name:e.name,variant:e.variant,x:e.x,y:e.y,z:e.z,health:e.health,maxHealth:e.maxHealth,ko:e.ko,intent:e.intent})),
        balloon:p.balloon?{phase:p.balloon.phase,amount:p.balloon.amount,pressure:p.balloon.pressure,speed:Math.hypot(p.vx,p.vz),braking:p.balloon.braking}:null};
    }
  }
  const API = { World, MOVES, ROUTES, TREE, BASE, KEY, clamp, distance, PAIRS, pairSample, GRIP_MOVES, GROUND_MOVES };
  root.CombatLab = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
