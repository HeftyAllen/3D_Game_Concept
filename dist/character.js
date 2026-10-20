/* Stylised fighters retain the exact shared skeleton, hand contacts and skinning. */
(function(root){
  'use strict';
  const Rig=root.CombatRig||(typeof require==='function'?require('./rig.js'):null),{V,oriented,jointBasis}=Rig;
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),C=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  function palette(f){const hero=f.id==='player',variant=f.variant;if(hero&&root.CombatCharacter.look)return {...root.CombatCharacter.look};return {skin:hero?[.61,.39,.25]:variant==='runner'?[.74,.49,.32]:variant==='grappler'?[.80,.63,.45]:[.65,.45,.32],hair:hero?[.055,.055,.042]:variant==='runner'?[.18,.10,.065]:[.075,.065,.05],style:hero?'coils':variant==='grappler'?'braid':variant==='runner'?'swept':'crop'};}
  function hand(r,f,rig,side,accent,skin,bulk){const p=rig.pts,ha=p['hand'+side],el=p['elbow'+side],b=jointBasis([rig.rootBasis[0],rig.rootBasis[1],rig.rootBasis[2]],V.sub(ha,el)),s=Math.sqrt(bulk)*(rig.elastic[side]?.bulge||1),active=f.action?.move,open=!!f.held||!!f.visual?.pair||active?.grab||active?.element||f.guard;
    const at=(x,y,z)=>ha.map((v,i)=>v+(b[i]*x+b[4+i]*y+b[8+i]*z)*s),D=(kind,pos,scale,color)=>r.draw(kind,oriented(pos,scale.map(v=>v*s),b),color);
    D('round',ha,[.079,.091,.060],skin);D('round',at(0,-.054,0),[.083,.034,.064],accent);
    if(r.detail==='lean'){D('round',at(0,.060,.025),[.086,.061,.065],accent);D('round',at(side==='L'?.07:-.07,-.012,.025),[.031,.052,.035],skin);return;}
    for(let i=0;i<4;i++){const x=(i-1.5)*.036,len=.070+(i===1?.017:i===2?.010:0),start=at(x,.045,.014),bend=at(x*(open?1.10:1),.045+len*.57,open?.014:.053),tip=at(x*(open?1.18:1),open?.045+len:.066,open?.023:.072);r.bone(start,bend,.020*s,skin,'cylinder');r.bone(bend,tip,.019*s,skin,'cylinder');D('round',bend,[.023,.025,.023],accent);}
    const sign=side==='L'?1:-1,a=at(sign*.064,-.016,.035),bent=at(sign*.101,.016,.061),tip=at(sign*.077,.051,.075);r.bone(a,bent,.027*s,skin,'cylinder');r.bone(bent,tip,.024*s,skin,'cylinder');
    for(const y of [-.060,-.042])r.bone(at(-.072,y,.043),at(.072,y,.043),.008*s,[.84,.84,.70],'cylinder');
  }
  function face(r,f,rig,skin){const pal=palette(f),dark=pal.hair,trans=rig.trans,basis=rig.basis,time=r.world.time,effort=f.action?Math.sin(C(f.action.t/f.action.move.duration)*Math.PI):0,pain=C(f.hurt*4),blink=Math.pow(Math.max(0,Math.sin(time*1.45+(f.id==='player'?0:2))),32),lid=Math.max(.24,1-blink*.8-pain*.5),part=(pos,scale,color)=>r.draw('round',oriented(trans(pos),scale,basis),color);
    part([0,1.92,.074],[.135,.094,.104],mix(skin,[.35,.20,.13],.09));
    part([0,2.095,-.033],[.173,.116,.156],dark);
    if(pal.style==='coils')for(let i=0;i<(r.detail==='lean'?3:7);i++){const a=i*2.4;part([Math.cos(a)*.108,2.13+Math.sin(i*1.2)*.013,-.035+Math.sin(a)*.095],[.057,.049,.054],mix(dark,[.16,.12,.08],i%2*.17));}
    if(pal.style==='swept'){part([.035,2.13,.015],[.13,.067,.12],dark);part([-.095,2.08,-.01],[.043,.09,.12],dark);}
    if(pal.style==='braid')for(let i=0;i<(r.detail==='lean'?2:4);i++)part([(i-1.5)*.063,2.14,-.04],[.030,.043,.135],dark);
    if(pal.accessory==='headband'||f.boss){part([0,2.065,.055],[.177,.025,.142],f.boss?[.88,.48,.19]:pal.accent);}
    if(pal.accessory==='visor'){part([0,2.009,.161],[.126,.033,.022],pal.accent);part([0,2.013,.181],[.10,.014,.010],[.16,.27,.28]);}
    if(pal.beard==='trim')part([0,1.899,.085],[.121,.043,.09],mix(skin,dark,.75));
    const target=r.world.targetFor(f),dx=target.x-f.x,dz=target.z-f.z,look=C((dx*Math.cos(f.angle)-dz*Math.sin(f.angle))*.018,-.012,.012);
    for(const sign of [-1,1]){const x=sign*.062;part([x,2.008,.151],[.044,.023*lid,.019],[.89,.87,.75]);part([x+look,2.008,.166],[.018,.019*lid,.009],[.18,.13,.085]);if(r.detail!=='lean')part([x+look-.006,2.015,.174],[.006,.006,.005],[.98,.99,.92]);const inner=trans([x-sign*.034,2.052-effort*.010-pain*.006,.152]),outer=trans([x+sign*.035,2.051+effort*.014,.144]);r.bone(inner,outer,.012,dark,'cylinder');}
    part([0,1.970,.166],[.027,.032,.031],mix(skin,[.86,.64,.44],.12));
    const mouth=1.908-pain*.008;part([0,mouth,.145],[.043+effort*.009,.006+effort*.012+pain*.01,.011],[.23,.11,.075]);if(effort>.5&&r.detail!=='lean')part([0,mouth+.005,.156],[.033,.005,.004],[.86,.84,.71]);
    for(const sign of [-1,1]){part([sign*.166,1.990,-.005],[.025,.043,.028],skin);if(r.detail!=='lean')part([sign*.169,1.991,.016],[.011,.024,.010],mix(skin,[.39,.20,.12],.25));}
    if(f.id!=='player'&&pal.style==='crop'&&r.detail!=='lean')part([0,1.898,.070],[.112,.039,.085],mix(skin,dark,.63));
  }
  function dress(r,f,rig,shirt,pants,accent){const p=rig.pts,b=rig.rootBasis,front=[b[8],b[9],b[10]],side=[b[0],b[1],b[2]],at=(base,x,y,z)=>base.map((v,i)=>v+side[i]*x+(i===1?y:0)+front[i]*z),dark=mix(shirt,[.12,.19,.18],.5);
    const neck=p.neck,chest=p.chest,waist=mix(p.pelvis,p.torso,.20);r.bone(at(neck,-.10,-.04,.06),at(chest,-.08,.05,.16),.022,dark,'cylinder');r.bone(at(neck,.10,-.04,.06),at(chest,.08,.05,.16),.022,dark,'cylinder');
    r.draw('round',oriented(at(waist,0,0,.03),[.25*(f.bulk||1),.035,.19],b),dark);
    r.draw('round',oriented(at(chest,.10,-.03,.18),[.035,.047,.012],b),accent);
    const look=f.id==='player'?root.CombatCharacter.look:null,outfit=f.boss?'guard':look?.outfit;
    if(outfit==='sport')for(const sign of [-1,1]){r.bone(at(neck,sign*.14,-.09,.09),at(waist,sign*.18,.05,.17),.018,accent,'cylinder');r.bone(p['hip'+(sign<0?'L':'R')],p['knee'+(sign<0?'L':'R')],.023,accent,'cylinder');}
    if(outfit==='guard')for(const side of ['L','R']){r.draw('round',oriented(p['shoulder'+side],[.16,.14,.19],b),mix(shirt,[.22,.28,.29],.5));r.draw('round',oriented(p['elbow'+side],[.11,.10,.11],b),accent);r.draw('round',oriented(at(chest,0,-.03,.17),[.18,.12,.045],b),mix(shirt,accent,.24));}
    if(r.detail==='lean')return;
    for(const sign of [-1,1]){r.bone(at(waist,sign*.17,0,.12),at(chest,sign*.24,-.04,.10),.010,dark,'cylinder');const hip=p['hip'+(sign<0?'L':'R')],knee=p['knee'+(sign<0?'L':'R')];r.bone(at(hip,sign*.045,0,.035),at(mix(hip,knee,.75),sign*.055,0,.035),.012,mix(pants,shirt,.24),'cylinder');}
    r.bone(at(chest,0,.04,.185),at(waist,0,.04,.188),.006,mix(shirt,[.9,.89,.74],.3),'cylinder');
  }
  function shoes(r,f,rig,side,dark){if(f.id==='player'&&root.CombatCharacter.look?.shoes)dark=root.CombatCharacter.look.shoes;const p=rig.pts,foot=p['foot'+side],knee=p['knee'+side],right=[rig.rootBasis[0],rig.rootBasis[1],rig.rootBasis[2]],a=f.action,pivot=a&&!a.move.air?Math.sin(C(a.t/a.move.duration)*Math.PI)*rig.torsoTwist*.38:0,forward=[rig.rootBasis[8],rig.rootBasis[9],rig.rootBasis[10]],axis=right.map((v,i)=>v*Math.cos(pivot)+forward[i]*Math.sin(pivot)),b=jointBasis(axis,V.sub(knee,foot));r.draw('shoe',oriented(foot,[.105,.095,.19],b),dark);
    const at=(x,y,z)=>foot.map((v,i)=>v+b[i]*x+b[4+i]*y+b[8+i]*z);r.draw('shoe',oriented(at(0,-.045,0),[.107,.036,.193],b),[.30,.34,.29]);if(r.detail==='lean')return;for(const z of [.03,.085])r.bone(at(-.054,.054,z),at(.054,.054,z),.009,[.69,.70,.59],'cylinder');
  }
  root.CombatCharacter={palette,hand,face,dress,shoes};if(typeof module!=='undefined'&&module.exports)module.exports=root.CombatCharacter;
})(typeof window!=='undefined'?window:globalThis);
