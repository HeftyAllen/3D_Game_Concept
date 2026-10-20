'use strict';
const assert=require('node:assert/strict');
const {World,MOVES}=require('../dist/combat.js');
const {sphere,extents}=require('../dist/yard.js');
const fresh=()=>{const events=[];const w=new World(e=>events.push(e),()=>.4);return {w,events};};
const step=(w,s,fps=120)=>{for(let i=0;i<Math.ceil(s*fps);i++)w.step(1/fps);};
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
test('a sphere separates correctly from the inside and outside of a wall',()=>{
  const box={x:0,y:1,z:0,hx:1,hy:1,hz:1};assert.equal(sphere([2,1,0],.2,box),null);
  const hit=sphere([1.1,1,0],.2,box);assert.ok(hit.n[0]>.99);assert.ok(Math.abs(hit.depth-.1)<1e-6);
  const inside=sphere([.9,1,0],.2,box);assert.ok(inside.n[0]>.99);assert.ok(inside.depth>.29);
});
test('the courtyard has walls, pillars, spring pads, and varied useful props',()=>{const {w}=fresh();assert.equal(w.yard.walls.length,4);assert.equal(w.yard.pillars.length,2);assert.ok(w.yard.props.length>=14);});
test('a fighter cannot walk through a courtyard wall',()=>{const {w}=fresh();w.player.x=5.7;w.player.z=0;w.input.x=1;step(w,2);assert.ok(w.player.x<=6.09);});
test('a moving fighter transfers momentum to a loose crate',()=>{const {w}=fresh();const p=w.yard.props.find(p=>p.type==='crate');p.x=0;p.z=0;w.player.x=-1.2;w.player.z=0;w.enemy.x=4;w.input.x=1;w.yard.rebuild();step(w,.8);assert.ok(p.x>.15);});
test('a hip throw breaks the staged table and creates physical debris',()=>{
  const {w,events}=fresh();w.yard.stage('table');w.attack('G');w.attack('G');step(w,2);
  assert.ok(events.some(e=>e.type==='propBreak'&&e.propType==='table'));assert.ok(events.some(e=>e.type==='envHit'&&e.kind==='table'));
  assert.ok(w.yard.props.filter(p=>p.type==='debris'&&!p.broken).length>=5);assert.equal(w.yard.stats.wallHits,0);
});
test('wall pressure adds a single impact and keeps the combo connected',()=>{
  const {w,events}=fresh();w.yard.stage('wall');w.attack('H');w.attack('K');step(w,1.3);
  assert.deepEqual(events.filter(e=>e.type==='connect').map(e=>e.move),['Power straight','Push kick']);
  const hits=events.filter(e=>e.type==='envHit'&&e.kind==='wall');assert.equal(hits.length,1);assert.ok(hits[0].damage<=12);
});
test('normal pickup takes animation time and changes a punch into a real weapon swing',()=>{
  const {w,events}=fresh();w.yard.stage('chair');assert.ok(w.interact());assert.equal(w.yard.held(w.player),null);step(w,.5);assert.equal(w.yard.held(w.player).type,'chair');
  w.attack('P');step(w,.6);assert.ok(events.some(e=>e.type==='hit'&&e.weapon));assert.equal(w.enemy.health,320-MOVES.weaponSwing.damage);
});
test('a kick can sit between two weapon swings without dropping the object',()=>{
  const {w,events}=fresh();w.yard.stage('chair');w.interact();step(w,.5);w.attack('P');w.attack('K');w.attack('H');step(w,2);
  assert.equal(events.filter(e=>e.type==='hit').length,3);assert.ok(w.yard.held(w.player));
});
test('a pickup can be queued after a strike with its follow-up preserved',()=>{
  const {w,events}=fresh();w.yard.stage('chair');w.attack('P');assert.ok(w.interact());w.attack('P');step(w,2);
  assert.ok(events.some(e=>e.type==='propPickup'));assert.ok(events.some(e=>e.type==='hit'&&e.weapon));
});
test('the elastic grab actually moves the object before it becomes equipped',()=>{
  const {w}=fresh();w.yard.stage('stretch');const p=w.yard.candidate(w.player,5.9),x=p.x;assert.ok(w.interact('fetch'));step(w,.31);
  assert.ok(w.yard.retrieve);assert.ok(p.x<x);assert.equal(w.yard.held(w.player),null);step(w,.5);assert.equal(w.yard.held(w.player),p);assert.equal(w.yard.stats.stretchGets,1);
});
test('interrupted elastic retrieval releases a falling prop',()=>{
  const {w}=fresh();w.yard.stage('stretch');w.interact('fetch');step(w,.32);const p=w.yard.retrieve.prop,y=p.y;w.yard.onHurt(w.player);w.player.action=null;step(w,.25);
  assert.equal(p.pulledBy,null);assert.ok(p.y<y);assert.equal(w.yard.held(w.player),null);
});
test('a pillar blocks both a stretch pickup and a long strike',()=>{
  const {w}=fresh();w.player.x=-3.9;w.player.z=-1.4;w.enemy.x=-3.9;w.enemy.z=-4.1;w.face(w.player,w.enemy);const p=w.yard.props.find(p=>p.type==='chair');p.x=-3.9;p.z=-4.1;w.yard.rebuild();
  assert.equal(w.yard.clearPath(w.player,p),false);w.attack('S');step(w,.7);assert.equal(w.enemy.health,320);
});
test('throwing releases a projectile and damages only on physical contact',()=>{
  const {w,events}=fresh();w.yard.stage('stretch');w.interact('fetch');step(w,.8);w.attack('G');step(w,.18);assert.equal(w.enemy.health,320);step(w,1.1);
  assert.ok(events.some(e=>e.type==='propThrow'));assert.ok(events.some(e=>e.type==='envHit'&&e.kind==='prop'));assert.ok(w.enemy.health<320);assert.equal(w.yard.held(w.player),null);
});
test('a missed throw does not produce a phantom hit',()=>{
  const {w,events}=fresh();w.yard.stage('chair');w.interact();step(w,.5);w.enemy.x=4;w.enemy.z=-4;w.attack('G');step(w,.23);w.enemy.x=-4;w.enemy.z=-4;step(w,1.3);
  assert.equal(events.some(e=>e.type==='envHit'&&e.target==='enemy'),false);
});
test('strong incoming hits disarm an equipped fighter',()=>{
  const {w}=fresh();w.yard.stage('chair');w.interact();step(w,.5);w.enemy.x=w.player.x;w.enemy.z=w.player.z-.9;w.start(w.enemy,w.player,'H');step(w,.3);assert.equal(w.yard.held(w.player),null);
});
test('objects wear out and fall back to empty-handed combat',()=>{
  const {w}=fresh();w.yard.stage('chair');w.interact();step(w,.5);const p=w.yard.held(w.player);w.yard.damage(p,40,w.player);assert.ok(p.broken);assert.equal(w.yard.held(w.player),null);w.attack('P');assert.ok(!w.player.action.move.weapon);
});
test('the same wall and object impacts can knock down the player',()=>{
  const {w,events}=fresh();w.player.x=0;w.player.z=5.25;w.player.vz=7;w.player.lastAttacker=w.enemy;w.player.lastHitAt=w.time;w.yard.previous.player={x:0,z:5.2,h:1};step(w,.10);
  assert.ok(events.some(e=>e.type==='envHit'&&e.target==='player'));assert.ok(w.player.health<140);
});
test('a full reset restores broken props and clears every object reference',()=>{
  const {w}=fresh();w.yard.stage('chair');w.interact();step(w,.5);const table=w.yard.props.find(p=>p.type==='table');w.yard.damage(table,80,w.player);w.reset();
  assert.ok(w.yard.props.length>=14);assert.equal(w.yard.stats.broken,0);assert.equal(w.yard.held(w.player),null);assert.equal(w.yard.retrieve,null);assert.ok(w.yard.props.every(p=>!p.broken));
});
test('thrown and broken props settle without invalid transforms or floor penetration',()=>{
  const {w}=fresh();w.yard.stage('stretch');w.interact('fetch');step(w,.8);w.attack('R');step(w,8);
  for(const p of w.yard.props.filter(p=>!p.broken)){assert.ok([p.x,p.y,p.z,p.angle,p.rx,p.rz,p.vx,p.vy,p.vz].every(Number.isFinite));assert.ok(p.y>=extents(p)[1]-.02);}
});
console.log('\n'+checks+' courtyard checks passed.');
