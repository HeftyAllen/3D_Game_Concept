/* Discoverable district stories reward moving through the arena, without stat bonuses. */
(function(root){
'use strict';
const ENTRIES=[
{id:'court-garden',arena:'courtyard',x:-2.9,z:3.2,title:'The borrowed garden',text:'Neighbours brought the first benches here. Training began around them; the court still belongs to the block.'},
{id:'court-timber',arena:'courtyard',x:2.5,z:-3.5,title:'A school without a master',text:'Old repair marks record practice throws. Every broken plank is replaced by the next person who learns the move.'},
{id:'depot-route',arena:'depot',x:-2.1,z:3.7,title:'Night-shift route',text:'The freight crews made their own training circuit between deliveries. Fast feet matter more here than a clean uniform.'},
{id:'depot-tag',arena:'depot',x:2.1,z:-3.8,title:'Cargo from the guild',text:'A stamped ash emblem links these crates to the Foundry. The guild kept shipping long after its furnaces fell silent.'},
{id:'roof-signal',arena:'rooftop',x:0,z:-3.8,title:'Roofline signals',text:'Runners once used these rooftops to carry messages across the district. Wind techniques still follow their routes.'},
{id:'roof-vow',arena:'rooftop',x:2.2,z:3.1,title:'The open-sky vow',text:'No cages, no spectators at your shoulder. Fighters came here to test whether their style could stand on its own.'},
{id:'forge-warning',arena:'foundry',x:-3.1,z:-3.6,title:'An unfinished shutdown',text:'The shutdown order was never signed. Rook still tends a kiln that nobody remembers how to extinguish.'},
{id:'forge-seal',arena:'foundry',x:2.1,z:3.4,title:'The Ash Guild seal',text:'A stone fist inside a flame: the guild promised to build the district. Its Warden now decides who may enter.'},
{id:'street-shelter',arena:'street',x:2.1,z:4.1,title:'Last service home',text:'The late bus no longer stops here. Its shelter became a meeting point for fighters arriving from the outer blocks.'},
{id:'street-garage',arena:'street',x:-1.8,z:-3.8,title:'Repairs on credit',text:'Local mechanics keep this yard alive. Damage the workshop and you had better help put it back together.'},
{id:'canal-ledger',arena:'canal',x:-2.4,z:.2,title:'A market on borrowed water',text:'Traders built their stalls around the sluice. The current carries supplies, cools the paving and occasionally settles arguments.'},
{id:'canal-brass',arena:'canal',x:2.1,z:4.6,title:'The keeper of the wheel',text:'The wheel once belonged to the guild. Market workers took it over so nobody could shut off their water again.'}
];
class DistrictJournal{
 constructor(world){this.world=world;this.seen=new Set();this.latest=null;}
 load(ids){this.seen=new Set(Array.isArray(ids)?ids.filter(id=>ENTRIES.some(e=>e.id===id)):[]);}
 step(){const w=this.world,p=w.player;if(w.over||p.ko||p.y>.35||p.down>0)return;for(const e of ENTRIES)if(e.arena===w.arenaId&&!this.seen.has(e.id)&&Math.hypot(p.x-e.x,p.z-e.z)<.8){this.seen.add(e.id);this.latest={...e,at:w.time};w.emit('districtDiscovery',{entry:{...e},count:this.seen.size,total:ENTRIES.length});}}
 snapshot(){return {seen:[...this.seen],total:ENTRIES.length,latest:this.latest};}
}
function draw(r){const w=r.world;for(const e of ENTRIES)if(e.arena===w.arenaId&&!w.journal.seen.has(e.id)&&Math.hypot(w.player.x-e.x,w.player.z-e.z)<3){r.shape('ring',[e.x,.04,e.z],[.22,1,.22],[.91,.81,.45],0,.55,.35);r.shape('sphere',[e.x,.18+Math.sin(w.time*2)*.035,e.z],[.045,.07,.045],[.91,.81,.45],0,.8,.4);}}
root.CombatJournal={DistrictJournal,ENTRIES,draw};if(typeof module!=='undefined')module.exports=root.CombatJournal;
})(typeof window!=='undefined'?window:globalThis);
