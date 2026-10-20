/* One accepted tap requests one move. Context is read when the move starts. */
(function(root){
  'use strict';
  const TOKENS={P:'A',K:'Y',H:'M'},REQUESTS=new Set(Object.values(TOKENS));
  class ComboAssist{
    constructor(world){this.world=world;this.step=0;this.air=0;this.floor=0;}
    choose(f,target,request){
      const w=this.world,g=w.grapple?.owner===f?w.grapple:null,d=Math.hypot(target.x-f.x,target.z-f.z),style=w.assistStyle,last=f.lastId;
      if(w.time>f.chainUntil){this.step=0;this.air=0;this.floor=0;}
      if(this.world.airHeight(target)>.18&&/slam|meteor|downburst/i.test(last))return null;
      const item=w.yard.held(f);
      if(item?.type==='blaster'){if(item.ammo<1)return 'J';if(request==='M')return 'H';if(request==='Y')return item.ammo>=2&&(w.freePlayer()||f.windEnergy>=20)?'S':'U';return d<2.5&&this.step++%4===3?'K':'P';}
      if(item?.gear)return request==='M'?'H':request==='Y'?'U':this.step++%4===3?'K':'P';
      if(item)return request==='M'?'G':request==='Y'?'U':this.step++%3===2?'K':'P';
      if(g?.phase==='clinch'){
        if(request==='M')return g.grip==='front'?'G':'U';
        if(request==='Y')return 'U';
        if(style==='wrestling')return g.grip==='front'?last==='clinchknee'?'C':'K':g.grip==='bodylock'?last==='underhook'?'K':'U':'U';
        return ['K','P','G'][this.step++%3];
      }
      if(target.down>.08&&this.world.airHeight(target)<.12&&d<2.9){
        if(request==='Y')return 'U';
        if(request==='M')return 'H';
        if(style==='wrestling')return this.floor++%3===2?'G':'P';
        return ['P','K','G'][this.floor++%3];
      }
      if(style==='elements'){
        const focus=n=>w.freePlayer()||f.windEnergy>=n,ready=w.infusion.ready(f);
        if(ready&&focus(ready.focus)&&(request==='M'||target.y<1.4&&d>2))return '0';
        if(this.world.airHeight(target)>.18&&!target.held){if(request==='M')return 'H';if(d>4.2)return focus(18)?'8':'S';return ['P','K',focus(18)?'f2':'K','R'][this.air++%4];}
        if(request==='Y')return d<1.8&&focus(18)?['a','i','f1'][this.step++%3]:focus(26)?'9':'U';if(request==='M')return d<2.7&&focus(22)?'c':'H';
        if(w.infusion.status(target,'wet',f)&&focus(20)&&d<5.1)return 'E';
        if(d>2.4)return focus(24)?(this.step++%3?'2':'7'):'S';
        return [focus(9)?'d':'P',focus(10)?'g':'K',focus(18)?'i':'U','P','K','R','G'][this.step++%7];
      }
      if(style==='fusion'&&d>4.5)return 'R';
      if((style==='wind'||style==='fusion')&&!w.freePlayer()&&f.windEnergy<(style==='fusion'?20:32))return this.world.airHeight(target)>.18?'K':d>(style==='fusion'?1.9:2.6)?'S':'P';
      if(this.world.airHeight(target)>.18&&!target.held){
        if(request==='M')return 'H';
        if(request==='Y')return this.air++%2?'K':'P';
        if(style==='wrestling')return 'R';
        if(style==='fusion')return w.flow.marked(target,'shock',f)?'R':w.flow.marked(target,'wind',f)?'E':last==='voltlift'?'E':['P','K','R'][this.air++%3];
        if(style==='wind')return last==='updraft'?'W':last==='cyclone'?'H':['P','K','W','K','H'][this.air++%5];
        return ['P','K','S','H'][this.air++%4];
      }
      this.air=0;this.floor=0;
      if(request==='A'&&target.guard)return d>2.2?'R':'G';
      if(request==='Y')return d>2.65?'W':'U';
      if(request==='M')return last==='gale'||last==='cyclone'?'H':d>2.6?'T':this.step%2?'H':'K';
      if(style==='wrestling')return d>2.2?'R':'G';
      if(style==='fusion'){
        if(w.flow.marked(target,'shock',f))return 'R';
        if(last==='gale'&&w.time<f.chainUntil)return 'W';
        if(w.flow.broken(target))return d>2.2?'R':'G';
        return w.freePlayer()||f.windEnergy>=40?'W':d>1.9?'S':this.step++%3===2?'L':'P';
      }
      if(style==='wind'){
        if(last==='gale')return 'W';
        if(last==='updraft'||last==='skycurrent')return 'W';
        if(last==='cyclone')return 'H';
        return 'W';
      }
      if(d>2.6)return this.step++%2?'W':'S';
      return ['P','P','K','U','P','K','H','G','K','G'][this.step++%10];
    }
    start(f,target,request){
      if(this.world.assistStyle==='elements'&&!this.world.infusion.active(f)&&!this.world.grapple&&!f.balloon)this.world.infusion.coat(['fire','water','lightning','earth'][this.step%4],f);
      const token=this.choose(f,target,request);if(!token)return false;
      const started=this.world.start(f,target,token,request);
      if(started&&f.action){f.action.assisted=true;f.action.request=request;this.world.emit('assistMove',{request,token,move:f.action.move.name});}
      return started;
    }
  }
  const API={ComboAssist,TOKENS,REQUESTS};root.CombatAssist=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
