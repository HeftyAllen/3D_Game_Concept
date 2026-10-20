/* Small atlas sprites supplement world-space contacts; all effects are bounded. */
(function(root){
  'use strict';
  const C=(v,a,b)=>Math.max(a,Math.min(b,v)),TILES={hit:0,slash:1,wind:2,muzzle:3,dust:4,guard:5,coil:6,spark:7};
  class CombatFX{
    constructor(renderer){this.renderer=renderer;this.items=[];this.serial=0;this.atlas=null;this.marks=[];if(typeof Image!=='undefined'){const atlas=new Image();atlas.onload=()=>{this.atlas=atlas;};atlas.src='combat-sprites.svg?v=11';}}
    add(kind,pos,size=60,life=.26){this.items.push({kind,pos:[...pos],size,life,max:life,angle:(++this.serial%5-2)*.15});if(this.items.length>64)this.items.splice(0,this.items.length-64);}
    notify(e){
      const r=this.renderer,w=r.world,target=w.getFighter(e.target)||(e.type==='hurt'?w.player:w.getFighter(e.by)||w.enemy),pos=e.contact?.point||e.point||(e.x!==undefined?[e.x,e.y??.3,e.z]:[target.x,target.y+(e.air?1.25:e.ground?.3:1.4),target.z]);
      if(e.type==='reset'){this.items=[];this.marks=[];return;}
      const source=w.getFighter(e.by)||w.player;
      if(['coating','coatingHit','fusionReady','fusionRelease','powerLink','elementCast','fireImpact','elementImpact','bossBurst'].includes(e.type))this.add(['fire','water','earth'].includes(e.element)?e.element:'aura',pos,100,.48);
      if(e.type==='hit'||e.type==='hurt'){const element=e.element||source.action?.move?.elementFamily?.toLowerCase()||source.action?.imbued;if(['fire','water','earth'].includes(element))this.add(element,pos,88,.36);}
      if(['throwImpact','balloonSlam','propBreak'].includes(e.type)){this.add('shock',pos,145,.48);this.marks.push({pos:[pos[0],.04,pos[2]],life:5,max:5});if(this.marks.length>16)this.marks.shift();}
      if(e.type==='hit'||e.type==='hurt'){this.add(e.ranged||e.lightning?'spark':e.wind?'wind':e.elastic?'coil':e.finish?'slash':'hit',pos,e.finish?83:55,e.finish?.31:.22);if(e.finish)this.add('spark',pos,37,.18);}
      if(e.type==='weaponClash'){this.add('spark',pos,74,.25);this.add('guard',pos,58,.20);}
      if(e.type==='surfaceContact')this.add('spark',pos,42,.18);
      if(e.type==='throwImpact'||e.type==='balloonSlam')this.add('dust',[target.x,.25,target.z],125,.46);
      if(e.type==='envHit')this.add(e.kind==='wind'?'wind':['shot','lightning'].includes(e.kind)?'spark':'hit',pos,64,.28);
      if(e.type==='gunShot')this.add('muzzle',pos,e.charged?70:45,.11);
      if(e.type==='shotImpact')this.add(e.charged?'wind':e.cover?'hit':'spark',pos,e.charged?78:44,.22);
      if(['parry','enemyParry','shotParry','shotBlock','block'].includes(e.type))this.add('guard',e.contact?.point||e.point||e.x!==undefined?pos:[(w.getFighter(e.by)||target).x,(w.getFighter(e.by)||target).y+1.5,(w.getFighter(e.by)||target).z],72,.28);
      if(e.type==='gustStep')this.add('wind',pos,88,.30);
      if(e.type==='propBreak')this.add('dust',pos,110,.4);
      if(e.type==='land')this.add('dust',[(w.getFighter(e.by)||target).x,.15,(w.getFighter(e.by)||target).z],70,.3);
    }
    frame(dt){
      const r=this.renderer,ctx=r.ctx;for(const m of this.marks)m.life-=dt;this.marks=this.marks.filter(m=>m.life>0);for(const e of this.items)e.life-=dt;this.items=this.items.filter(e=>e.life>0);if(!r.impact)return;
      for(const m of this.marks){const p=r.project(m.pos);if(!p)continue;ctx.save();ctx.translate(...p);ctx.scale(1,.35);ctx.strokeStyle='#d9cc9b';ctx.globalAlpha=m.life/m.max*.3;ctx.lineWidth=1.5;for(let i=0;i<7;i++){const a=i*.897;ctx.beginPath();ctx.moveTo(Math.cos(a)*5,Math.sin(a)*5);ctx.lineTo(Math.cos(a+.09)*19,Math.sin(a+.09)*19);ctx.lineTo(Math.cos(a)*27,Math.sin(a)*27);ctx.stroke();}ctx.restore();}
      const list=r.detail==='lean'?this.items.slice(-24):this.items;
      for(const e of list){const p=r.project(e.pos);if(!p)continue;const t=1-e.life/e.max,far=Math.hypot(...e.pos.map((v,i)=>v-r.eye[i])),size=C(e.size*10/Math.max(5,far),18,135)*(.72+t*.45);
        ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(e.angle);ctx.globalAlpha=C(e.life/.09,0,1)*.88;
        if(['fire','water','earth','aura','shock'].includes(e.kind)){
          const colors={fire:['#ffe7a0','#ff6635'],water:['#e2ffff','#63cfe5'],earth:['#f3d7a1','#ae8055'],aura:['#f4ffc5','#b9e994'],shock:['#fff0c5','#d9d6a8']},col=colors[e.kind],n=r.detail==='lean'?7:12;
          ctx.shadowColor=col[1];ctx.shadowBlur=e.kind==='earth'?0:9;ctx.strokeStyle=col[0];ctx.lineWidth=2;
          for(let i=0;i<n;i++){const a=i*Math.PI*2/n+e.angle,dist=size*(.08+t*.4),x=Math.cos(a)*dist,y=Math.sin(a)*dist*.75;ctx.fillStyle=i%2?col[0]:col[1];ctx.beginPath();if(e.kind==='earth'){ctx.rect(x,y,size*.05,size*.035);ctx.fill();}else{ctx.ellipse(x,y,size*(e.kind==='fire'?.035:.02)*(1-t*.6),size*.07, a,0,Math.PI*2);ctx.fill();}}
          if(['water','shock','aura'].includes(e.kind)){ctx.beginPath();ctx.ellipse(0,0,size*(.15+t*.35),size*(.07+t*.15),0,0,Math.PI*2);ctx.stroke();}
        }else if(this.atlas)ctx.drawImage(this.atlas,TILES[e.kind]*128,0,128,128,-size/2,-size/2,size,size);
        else{ctx.strokeStyle=e.kind==='wind'?'#a0e3ed':'#e9f5ae';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,size*.26,0,Math.PI*1.7);ctx.stroke();}
        ctx.restore();
      }
    }
  }
  root.CombatEffects={CombatFX};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatEffects;
})(typeof window!=='undefined'?window:globalThis);
