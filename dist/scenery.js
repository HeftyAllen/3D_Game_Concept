/* Procedural arena art. Static scenery is baked into color batches once per layout. */
(function(root){
  'use strict';
  const PALETTES={canal:{fog:[.14,.18,.18],ambient:[.62,.57,.46]},street:{fog:[.12,.16,.18],ambient:[.58,.57,.54]},foundry:{fog:[.10,.135,.16],ambient:[.52,.56,.59]},courtyard:{fog:[.075,.14,.115],ambient:[.48,.56,.49]},depot:{fog:[.10,.125,.145],ambient:[.53,.54,.55]},rooftop:{fog:[.10,.16,.19],ambient:[.48,.55,.59]}};
  class Scenery{
    constructor(renderer){this.renderer=renderer;this.key=null;this.batches=[];this.serial=0;}
    build(){
      const r=this.renderer,w=r.world,arena=w.arenaId||'courtyard',layout=w.yard.layout,R=root.CombatRenderer,gl=r.gl;
      for(const b of this.batches){const mesh=r.meshes[b.name];gl.deleteBuffer(mesh.p);gl.deleteBuffer(mesh.n);delete r.meshes[b.name];}
      this.batches=[];this.key=arena+':'+r.detail;const buckets=new Map(),geos={};
      const B=(kind,pos,scale,color,yaw=0,layer='base',pitch=0)=>{
        const key=layer+':'+color.join(','),matrix=R.mul(R.model(pos,[1,1,1],yaw),R.mul(R.rigBasis(0,pitch),R.model([0,0,0],scale)));
        let bucket=buckets.get(key);if(!bucket){bucket={color,layer,p:[],n:[]};buckets.set(key,bucket);}
        const g=geos[kind]||(geos[kind]=R.geometry(kind)),m=matrix,sizes=[0,4,8].map(o=>m[o]*m[o]+m[o+1]*m[o+1]+m[o+2]*m[o+2]);
        for(let i=0;i<g.p.length;i+=3){const x=g.p[i],y=g.p[i+1],z=g.p[i+2],nx=g.n[i],ny=g.n[i+1],nz=g.n[i+2];bucket.p.push(m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]);const normal=[m[0]/sizes[0]*nx+m[4]/sizes[1]*ny+m[8]/sizes[2]*nz,m[1]/sizes[0]*nx+m[5]/sizes[1]*ny+m[9]/sizes[2]*nz,m[2]/sizes[0]*nx+m[6]/sizes[1]*ny+m[10]/sizes[2]*nz],n=Math.hypot(...normal)||1;bucket.n.push(...normal.map(v=>v/n));}
      };
      const metal=[.16,.23,.23],stone=[.44,.47,.37],wood=[.42,.31,.21],accent=layout.accent;
      B('cube',[0,-.35,0],[42,.35,42],PALETTES[arena].fog);
      B('cube',[0,-.13,0],[13.5,.22,12.5],metal);B('cube',[0,-.025,0],[12.8,.04,11.8],layout.floor);
      for(let i=-6;i<=6;i++)B('cube',[i,.002,0],[.015,.005,11.5],layout.grid);
      for(let i=-5;i<=5;i++)B('cube',[0,.003,i],[12.4,.005,.015],layout.grid);
      for(const z of [-1.9,1.9])B('cube',[0,.008,z],[4.7,.007,.025],accent);
      for(const x of [-2.35,2.35])B('cube',[x,.008,0],[.025,.007,3.8],accent);
      B('cube',[0,.011,0],[.025,.007,.65],accent);B('cube',[0,.011,0],[.65,.007,.025],accent);
      for(const wall of w.yard.walls){const layer='wall-'+wall.id;B('cube',[wall.x,wall.y,wall.z],[wall.hx*2,wall.hy*2,wall.hz*2],layout.wall,0,layer);B('cube',[wall.x,1.285,wall.z],[wall.hx*2+.05,.07,wall.hz*2+.05],arena==='courtyard'?[.52,.55,.43]:metal,0,layer);
        if(arena==='courtyard')for(let i=-5;i<=5;i++){const horizontal=wall.id==='north'||wall.id==='south';B('cube',[horizontal?i:wall.x,.63,horizontal?wall.z:i],[horizontal?.018:.51,1.15,horizontal?.51:.018],[.30,.36,.29],0,layer);}
        else for(let i=-4;i<=4;i+=2){const horizontal=wall.id==='north'||wall.id==='south';B('cube',[horizontal?i:wall.x,1.05,horizontal?wall.z:i],[horizontal?.65:.52,.08,horizontal?.52:.65],accent,0,layer);}
      }
      for(const pillar of w.yard.pillars){B('cube',[pillar.x,.13,pillar.z],[.95,.26,.95],metal);B(arena==='courtyard'?'cylinder':'cube',[pillar.x,arena==='courtyard'?.24:1.2,pillar.z],arena==='courtyard'?[.4,1.91,.4]:[.8,1.92,.8],arena==='courtyard'?stone:layout.wall);B('cube',[pillar.x,2.20,pillar.z],[.90,.14,.90],accent);B('cylinder',[pillar.x,.55,pillar.z],[.41,.10,.41],metal);}
      for(const x of [-5.65,5.65])for(const z of [-5.25,5.25])B('cube',[x,.027,z],[.48,.015,.15],accent);
      if(arena==='courtyard'){
        // A small walled training court, with buildings and planting beyond the boundary.
        B('cube',[0,-.12,-7.45],[16,.20,2.2],[.34,.36,.29]);B('cube',[-7.6,-.12,0],[2,.20,14],[.34,.36,.29]);
        B('cube',[.5,1.85,-8.05],[14,4.0,1.8],[.51,.49,.37],0,'decor');B('cube',[-8.1,1.45,-.2],[1.8,3.2,13.4],[.45,.46,.34],0,'decor');
        for(const x of [-5.4,-2.6,.2,3,5.8]){B('cube',[x,1.7,-7.12],[1.6,1.8,.10],[.28,.36,.28],0,'decor');B('cube',[x,1.65,-7.04],[1.27,1.37,.06],[.15,.26,.22],0,'decor');B('cube',[x,1.65,-6.995],[.055,1.37,.04],stone,0,'decor');B('cube',[x,1.65,-6.99],[1.27,.055,.04],stone,0,'decor');B('cube',[x,.78,-6.98],[1.8,.12,.26],stone,0,'decor');}
        for(const z of [-4.5,-1,2.5,5]){B('cube',[-7.12,1.4,z],[.08,1.7,1.7],[.25,.32,.25],0,'decor');B('cube',[-7.04,1.4,z],[.06,1.35,1.35],[.15,.25,.21],0,'decor');}
        B('cube',[.5,3.94,-7.8],[14.4,.20,2.4],wood,0,'decor');B('cube',[-7.9,3.20,-.2],[2.4,.18,13.8],wood,0,'decor');
        for(const [x,z] of [[7.3,-4.8],[7.3,4.7],[-6.9,6.7]]){
          B('cube',[x,.35,z],[1.35,.7,1.35],stone,0,'decor');B('cylinder',[x,.7,z],[.16,1.7,.16],wood,0,'decor');
          for(let i=0;i<5;i++)B('sphere',[x+Math.sin(i*2.4)*.55,2.7+(i%2)*.4,z+Math.cos(i*2.4)*.5],[.82,.83,.82],[.25+(i%2)*.035,.40,.25],0,'decor');
        }
        for(const x of [-6.5,6.5]){B('cylinder',[x,0,6.6],[.055,3.7,.055],metal,0,'decor');B('cube',[x,3.65,6.6],[.36,.12,.36],accent,0,'decor');}
        B('cube',[0,2.9,-6.9],[2.1,.63,.12],metal,0,'decor');for(let i=0;i<3;i++)B('cube',[-.35+i*.32,2.9,-6.82],[.11,.36,.06],accent,-.22,'decor');
      }else if(arena==='depot'){
        // Containers, loading bays, gantries, and lamps frame an uncluttered fighting lane.
        for(const [x,z,color] of [[-3,-7.7,[.46,.31,.20]],[4.2,-7.7,[.24,.37,.39]],[8.2,2.5,[.40,.42,.28]]]){
          const side=x>7;B('cube',[x,1.45,z],side?[2.5,2.9,7.5]:[6.7,2.9,2.5],color,0,'decor');
          for(let i=-3;i<=3;i++){B('cube',[side?x-1.28:x+i*.85,1.45,side?z+i:z+1.28],side?[.08,2.78,.075]:[.075,2.78,.08],metal,0,'decor');}
          B('cube',[x,2.96,z],side?[2.65,.14,7.65]:[6.85,.14,2.65],metal,0,'decor');
        }
        for(const [x,z] of [[-7.4,-4.5],[-7.4,3.8],[7.2,-5.3]]){B('cube',[x,2.3,z],[.18,4.6,.18],metal,0,'decor');B('cube',[x,4.45,z+.4],[1.3,.18,1.25],metal,0,'decor');B('cube',[x,4.35,z+.4],[1.1,.04,1.0],[.9,.83,.52],0,'decor');}
        B('cube',[-7.5,2.45,-7.9],[.5,4.9,.5],[.68,.52,.26],0,'decor');B('cube',[-4,4.9,-7.9],[7.6,.32,.35],[.68,.52,.26],0,'decor');
        for(const z of [-4,0,4]){B('cube',[-6.9,1.5,z],[.12,3,.12],metal,0,'decor');B('cube',[-6.9,1.3,z+1.8],[.06,.06,3.8],metal,0,'decor');}
        for(const x of [-5.2,-4.5,-3.8,3.8,4.5,5.2])B('cube',[x,.015,5.23],[.38,.01,.09],accent,.55);
        B('cube',[.7,.012,-4.9],[3.2,.012,.1],accent);B('cube',[.7,.013,-4.75],[3.2,.012,.04],metal);
      }else if(arena==='foundry'){
        const steel=[.23,.31,.34],rust=[.50,.36,.24],blue=[.27,.42,.46];
        B('cube',[0,2.4,-8.15],[16,4.8,2.5],steel,0,'decor');B('cube',[-8.15,2.0,0],[2.5,4,15],blue,0,'decor');
        for(const x of [-6,-3,0,3,6]){B('cube',[x,2.3,-6.86],[.13,4.5,.13],rust,0,'decor');B('cube',[x,3.1,-6.78],[1.7,1.25,.08],[.16,.27,.30],0,'decor');B('cube',[x,3.1,-6.72],[.06,1.25,.04],steel,0,'decor');B('cube',[x,3.1,-6.71],[1.7,.06,.04],steel,0,'decor');}
        B('cube',[0,4.8,-7.5],[15.5,.24,.65],rust,0,'decor');
        for(const x of [-7.1,7.1]){B('cube',[x,2.5,1.3],[.28,5,.28],rust,0,'decor');B('cube',[x,4.8,0],[.3,.25,12.9],rust,0,'decor');B('cube',[x,4.6,-2.8],[.8,.12,1.0],steel,0,'decor');B('cube',[x,4.51,-2.8],[.65,.035,.8],accent,0,'decor');}
        B('cube',[0,5.0,-3.6],[14.4,.30,.4],rust,0,'decor');B('cube',[2.4,4.67,-3.6],[1.0,.4,.75],steel,0,'decor');B('cylinder',[2.4,3.2,-3.6],[.035,1.5,.035],steel,0,'decor');B('torus',[2.4,3.1,-3.6],[.20,.04,.20],accent,0,'decor');
        for(const z of [-4.5,-2,1,3.9]){B('cylinder',[-6.9,.3,z],[.38,2.6,.38],steel,0,'decor');B('cylinder',[-6.9,2.9,z],[.5,.13,.5],rust,0,'decor');}
        for(const x of [7.5,9.3]){B('cylinder',[x,0,-4.8],[.72,3.3,.72],blue,0,'decor');B('cylinder',[x,3.25,-4.8],[.75,.1,.75],steel,0,'decor');}
        for(const z of [-4,0,4]){B('cube',[7.4,.45,z],[1.5,.9,1.1],rust,0,'decor');B('cube',[7.4,.94,z],[1.55,.08,1.15],steel,0,'decor');}
        for(const x of [-5.6,5.6])for(let z=-4.7;z<5;z+=.65)B('cube',[x,.013,z],[.35,.01,.14],accent,.55);
      }else if(arena==='canal'){
        const plaster=[.64,.52,.39],tile=[.44,.30,.23],teal=[.22,.43,.42],sand=[.60,.55,.43];
        B('cube',[0,.013,0],[6.9,.018,10.7],[.43,.42,.34]);
        for(let z=-5;z<=5;z+=.65)for(const x of [-2.9,2.9])B('cube',[x,.025,z],[.45,.014,.035],sand);
        for(const c of w.yard.gadgets.waterways){B('cube',[c.x,.018,c.z],[c.hx*2,.025,c.hz*2],[.14,.28,.29]);for(const sign of [-1,1])B('cube',[c.x+sign*(c.hx+.08),.032,c.z],[.13,.045,c.hz*2+.15],sand);for(let z=-4.6;z<4.8;z+=.7)for(const sign of [-1,1])B('cube',[c.x+sign*(c.hx+.08),.061,z],[.14,.008,.025],[.38,.38,.31]);}
        for(const side of [-1,1])for(const [i,z]of [-4.4,-.4,3.8].entries()){
          const x=side*8.1,color=i%2?plaster:[.50,.53,.43];B('cube',[x,2.25,z],[2.8,4.5,3.8],color,0,'decor');B('cube',[x,4.55,z],[3.0,.16,4.0],tile,0,'decor');
          const front=side*6.66;B('cube',[front,1.05,z],[.06,2.05,1.65],teal,0,'decor');for(const dz of [-.62,.62])B('cube',[front-side*.04,2.95,z+dz],[.04,.85,.50],[.18,.29,.28],0,'decor');
          B('cube',[side*6.6,2.34,z],[1.5,.10,2.8],i%2?[.76,.52,.28]:[.35,.58,.50],0,'decor');for(let j=-3;j<=3;j++)B('cube',[side*6.6,2.28,z+j*.36],[1.5,.08,.14],i%2?[.91,.73,.45]:[.70,.75,.56],0,'decor');
          for(const dz of [-1.28,1.28])B('cube',[side*6.02,1.1,z+dz],[.055,2.2,.055],wood,0,'decor');
          B('cube',[side*6.63,1.9,z],[.06,.4,1.1],metal,0,'decor');for(let j=0;j<3;j++)B('cube',[side*6.58,1.9,z-.3+j*.3],[.035,.19,.08],accent,0,'decor');
        }
        B('cube',[0,2.3,-8],[12.9,4.6,2.7],[.56,.47,.37],0,'decor');B('cube',[0,4.65,-8],[13.3,.18,2.9],tile,0,'decor');
        for(const x of [-4.3,4.3]){B('cube',[x,.36,-6.95],[1.95,.22,2.2],sand,0,'decor');for(const z of [-7.7,-6.2]){B('cube',[x,.93,z],[1.95,.055,.055],metal,0,'decor');for(const side of [-1,1])B('cube',[x+side*.86,.62,z],[.075,.62,.075],metal,0,'decor');}}
        for(const x of [-5,-2.5,0,2.5,5]){B('cube',[x,3.15,-6.65],[.14,.22,.14],accent,0,'decor');B('cube',[x,3.32,-6.65],[.20,.045,.20],metal,0,'decor');}B('cube',[0,3.4,-6.65],[11.6,.018,.018],metal,0,'decor');
        for(const x of [-5.7,5.7]){B('cube',[x,.25,5.2],[.52,.50,.52],sand,0,'decor');B('cylinder',[x,.5,5.2],[.045,2.4,.045],metal,0,'decor');B('cube',[x,2.95,5.2],[.28,.44,.28],accent,0,'decor');}
      }else if(arena==='street'){
        const asphalt=[.20,.23,.25],concrete=[.49,.52,.49],brick=[.40,.30,.25],glass=[.18,.31,.35];
        B('cube',[0,.008,0],[12.2,.018,11.1],asphalt);
        for(const x of [-5.5,5.5])B('cube',[x,.015,0],[.10,.018,10.3],[.82,.77,.58]);
        for(const z of [-4.4,-2.2,0,2.2,4.4])for(const x of [-4.4,4.4])B('cube',[x,.02,z],[2.2,.02,.065],[.73,.73,.65]);
        for(const x of [-7.8,7.8]){B('cube',[x,2.5,-1],[2.2,5,14],brick,0,'decor');B('cube',[x,5.1,-1],[2.4,.2,14.1],concrete,0,'decor');for(const z of [-5,-2,1,4])for(const y of [1.7,3.8])B('cube',[x<0?-6.67:6.67,y,z],[.03,1.1,1.35],glass,0,'decor');}
        B('cube',[0,2.0,-7.5],[13.6,4,1.9],[.42,.45,.42],0,'decor');B('cube',[1.5,1.5,-6.52],[4.5,3,.05],[.20,.27,.28],0,'decor');
        for(let y=.4;y<2.9;y+=.26)B('cube',[1.5,y,-6.46],[4.45,.035,.035],concrete,0,'decor');
        for(const x of [-5.7,5.7]){B('cylinder',[x,0,5.85],[.045,3.6,.045],[.23,.28,.27],0,'decor');B('cube',[x,3.57,5.50],[.5,.09,.7],[.86,.80,.55],0,'decor');}
        B('cube',[-3.6,2.7,-6.48],[2.1,.65,.04],[.73,.47,.23],0,'decor');
      }else{
        // A rooftop training deck above a stylized city, with vents and safety rails.
        B('cube',[0,-2.1,0],[13.6,4.1,12.6],[.19,.26,.28],0,'decor');
        for(const [i,x,z,h] of [[0,-12,-12,7],[1,-4,-15,11],[2,5,-14,8],[3,14,-10,13],[4,14,3,8],[5,-14,3,10],[6,1,15,7],[7,12,13,10]]){
          const y=-5+h/2,color=i%2?[.22,.32,.36]:[.27,.35,.37];B('cube',[x,y,z],[4.4,h,4.5],color,0,'decor');B('cube',[x,y+h/2+.08,z],[4.7,.16,4.8],metal,0,'decor');
          for(let row=0;row<4;row++)for(let col=-1;col<=1;col++)B('cube',[x+col*.9,y+h/2-.9-row*1.2,z+2.27],[.42,.58,.035],row%2?[.42,.57,.53]:[.21,.30,.31],0,'decor');
        }
        for(const x of [-7.5,7.5])for(const z of [-3.8,3.8]){B('cube',[x,.45,z],[1.4,.9,1.6],metal,0,'decor');B('cylinder',[x,.89,z],[.48,.11,.48],[.43,.51,.51],0,'decor');for(let i=-2;i<=2;i++)B('cube',[x+i*.17,.55,z+.81],[.055,.4,.03],layout.wall,0,'decor');}
        for(const x of [-5,-2.5,0,2.5,5]){B('cube',[x,1.63,-6.4],[.075,1.2,.075],metal,0,'decor');B('cube',[x,1.63,6.4],[.075,1.2,.075],metal,0,'decor');}
        for(const z of [-6.4,6.4]){B('cube',[0,2.2,z],[11.8,.055,.055],accent,0,'decor');B('cube',[0,1.75,z],[11.8,.035,.035],metal,0,'decor');}
        B('cube',[-7.2,2.9,-6.9],[.11,5.8,.11],metal,0,'decor');for(let i=0;i<3;i++)B('cube',[-7.2,4.7+i*.4,-6.9],[1.4-i*.3,.035,.035],accent,0,'decor');
      }
      // Neighbourhood detail sits beyond the solid arena boundary.
      for(const x of [-9.8,9.8])for(const z of [-5,1,6]){
        B('cylinder',[x,0,z],[.045,3.7,.045],metal,0,'decor');B('cube',[x,3.6,z],[.5,.12,.5],metal,0,'decor');B('sphere',[x,3.49,z],[.14,.10,.14],[.94,.77,.45],0,'decor');
        B('cube',[x,.15,z+1],[.85,.30,.85],stone,0,'decor');for(let j=0;j<3;j++)B('sphere',[x+Math.sin(j*2)*.22,.6+j*.14,z+1+Math.cos(j*2)*.2],[.35,.36,.35],[.25,.39,.25],0,'decor');
      }
      if(arena==='canal'){
        // Dock, moored skiff, bollards, and produce displays enrich the market edge.
        B('cube',[0,-.05,8.4],[13,.18,2.5],wood,0,'decor');for(let i=-6;i<=6;i++)B('cube',[i,.05,8.4],[.025,.03,2.4],metal,0,'decor');
        B('round',[1.8,.3,10.4],[2.2,.32,.7],[.24,.37,.34],0,'decor');B('cube',[1.8,.43,10.4],[3.4,.12,.65],wood,0,'decor');for(const x of [-4,0,4])B('cylinder',[x,.03,7.4],[.12,.55,.12],metal,0,'decor');
        for(let i=0;i<7;i++)B('sphere',[-5.7+i*.20,1.05,-7.1],[.11,.12,.11],i%2?[.81,.37,.22]:[.69,.70,.29],0,'decor');
      }else if(arena==='street'){
        B('cube',[7.4,2.65,2.1],[1.4,.15,3.8],metal,0,'decor');for(const z of [.5,3.7])B('cube',[7.9,1.3,z],[.09,2.6,.09],accent,0,'decor');B('cube',[7.9,1.5,2.1],[.05,1.8,3.1],[.30,.48,.49],0,'decor');B('cube',[7.4,.48,2.1],[.8,.12,2.6],wood,0,'decor');
        for(const x of [-4,0,4]){B('cube',[x,2.4,-7.2],[1.6,.6,.08],[.16,.25,.24],0,'decor');for(let i=0;i<4;i++)B('cube',[x-.5+i*.3,2.4,-7.14],[.13,.27,.03],accent,0,'decor');}
      }else if(arena==='rooftop'){
        for(let i=0;i<6;i++){const x=-9+i*3.5;B('cube',[x,1.3,-12],[2.4,3+i%3,2.5],[.19,.28,.31],0,'decor');for(let j=0;j<3;j++)B('cube',[x,1+j*.7,-10.72],[1.1,.22,.03],[.71,.71,.46],0,'decor');}
      }
      if(arena==='foundry'){
        // The Warden's kiln and guild standards make the boss's home recognisable.
        B('cube',[0,1.8,-9.1],[4.2,3.6,2.3],[.20,.26,.27],0,'decor');B('cube',[0,1.35,-7.9],[2.4,2.3,.06],[.13,.17,.16],0,'decor');B('cube',[0,1.15,-7.85],[1.65,1.55,.03],[.72,.30,.12],0,'decor');
        for(let i=-3;i<=3;i++)B('cube',[i*.28,1.35,-7.80],[.06,2.2,.04],metal,0,'decor');B('cylinder',[1.3,3.5,-9],[.42,3.8,.42],metal,0,'decor');
        for(const x of [-4.8,4.8]){B('cube',[x,3.35,-7.1],[1.3,1.7,.045],[.37,.22,.17],0,'decor');B('round',[x,3.4,-7.06],[.27,.30,.035],accent,0,'decor');B('cube',[x,2.95,-7.05],[.48,.15,.04],accent,0,'decor');}
      }
      for(const b of buckets.values()){
        if(r.detail==='lean'&&b.layer==='decor')continue;
        const name='scenery-'+(++this.serial),pb=gl.createBuffer(),nb=gl.createBuffer(),p=new Float32Array(b.p),n=new Float32Array(b.n);
        gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,p,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,n,gl.STATIC_DRAW);
        r.meshes[name]={p:pb,n:nb,count:p.length/3,geo:{p,n}};this.batches.push({name,color:b.color,layer:b.layer});
      }
    }
    draw(){
      const r=this.renderer,w=r.world,R=root.CombatRenderer;if(this.key!==(w.arenaId||'courtyard')+':'+r.detail)this.build();
      const identity=R.model([0,0,0],[1,1,1]);
      for(const batch of this.batches){let alpha=1;if(batch.layer.startsWith('wall-')){const side=batch.layer.slice(5);if(side==='south'&&r.eye[2]>3||side==='east'&&r.eye[0]>3||side==='north'&&r.eye[2]<-3||side==='west'&&r.eye[0]<-3)alpha=.26;}r.draw(batch.name,identity,batch.color,alpha);}
      const accent=w.yard.layout.accent;
      if(w.arenaId==='foundry')for(let i=0;i<(r.detail==='lean'?3:7);i++){const t=(w.time*.24+i*.17)%1;r.shape('sphere',[1.3+Math.sin(i*2+w.time*.3)*t*.35,7.3+t*2.4,-9+Math.cos(i*2)*t*.3],[.20+t*.35,.24+t*.45,.20+t*.35],[.32,.34,.32],0,(1-t)*.17,0);}

      for(const pad of w.yard.pads){
        const active=w.hazards,pulse=active?.04+Math.sin(w.time*2)*.015:0,flash=pad.flash;
        r.shape('cylinder',[pad.x,.01,pad.z],[pad.radius,.055,pad.radius],[.12,.20,.19]);r.shape('cylinder',[pad.x,.06-flash*.035,pad.z],[pad.radius*.83,.022,pad.radius*.83],active?accent:[.35,.39,.35],0,1,active?.18:0);
        r.shape('ring',[pad.x,.085,pad.z],[pad.radius+flash*.18+pulse,1,pad.radius+flash*.18+pulse],active?accent:[.4,.44,.39],0,active?.8:.3,.35);
        for(const sign of [-1,1])r.shape('cube',[pad.x+sign*.10,.087-flash*.035,pad.z],[.20,.008,.04],[.16,.25,.22],sign*.6);
      }
      const machinery=w.yard.gadgets,enabled=w.hazards&&machinery.power;
      for(const c of machinery.waterways||[]){r.shape('cube',[c.x,.037,c.z],[c.hx*1.97,.012,c.hz*2],[.24,.51,.50],0,.70,.12);const direction=enabled?c.dz*machinery.power:0;for(let i=0;i<(r.detail==='lean'?7:13);i++){const length=c.hz*2,z=((i*length/13+w.time*direction*.7)%length+length)%length-c.hz+c.z;r.shape('cube',[c.x+Math.sin(i*2.4+w.time)*.20,.052,z],[c.hx*(.7+.2*Math.sin(i)),.006,.025],[.72,.86,.74],.12*Math.sin(i),.38,.15);}for(const z of [-3.3,2.5])r.shape('ring',[c.x,.055,z],[.29,1,.29],[.55,.78,.72],0,.35,.1);}
      for(const belt of machinery.belts){
        const color=enabled?accent:[.32,.38,.37];r.shape('cube',[belt.x,.015,belt.z],[belt.hx*2,.03,belt.hz*2],[.12,.20,.21]);
        for(const sign of [-1,1])r.shape('cube',[belt.x+sign*(belt.hx+.025),.035,belt.z],[.055,.07,belt.hz*2+.06],[.36,.45,.44]);
        const along=belt.hz*2,scroll=enabled?w.time*belt.speed*.36*machinery.power*belt.dz:0;
        for(let i=0;i<9;i++){const offset=((i*along/9+scroll)%along+along)%along-along/2;r.shape('cube',[belt.x,.036,belt.z+offset],[belt.hx*1.78,.014,.055],i%3===0?color:[.23,.31,.32]);}
        for(const z of [-.28,.28])for(const sign of [-1,1])r.shape('cube',[belt.x+sign*.12,.047,belt.z+z],[.31,.012,.045],color,sign*.55*(belt.dz*machinery.power||1));
      }
      for(const vent of machinery.vents){
        const phase=enabled?machinery.phase(vent):'off',color=phase==='warning'?[.98,.64,.20]:phase==='blast'?[.61,.87,.92]:[.31,.43,.44];
        r.shape('cube',[vent.x,.01,vent.z],[vent.hx*2,.025,vent.hz*2],[.15,.24,.25]);for(let i=-3;i<=3;i++)r.shape('cube',[vent.x+i*vent.hx/4,.037,vent.z],[.045,.045,vent.hz*1.8],color);
        if(phase==='blast')for(let i=0;i<4;i++){const t=(w.time*1.6+i*.24)%1;r.shape('windRing',[vent.x,.1+t*2.4,vent.z],[vent.hx*(.6+t*.5),1,vent.hz*(.6+t*.5)],[.60,.86,.91],0,(1-t)*.32,.7);}
        if(phase==='warning')r.shape('ring',[vent.x,.05,vent.z],[vent.hx*1.22,1,vent.hz*1.22],color,0,.5+Math.sin(w.time*14)*.35,.7);
      }
      for(const panel of machinery.panels){
        if(w.arenaId==='canal'){r.shape('cylinder',[panel.x,.02,panel.z],[.11,1.0,.11],[.30,.35,.30]);r.shape('torus',[panel.x,1.02,panel.z],[.34,.06,.34],accent,w.time-machinery.changedAt<.6?(w.time-machinery.changedAt)*2:0);for(let i=0;i<4;i++){const a=i*Math.PI/2;r.bone([panel.x,.99,panel.z],[panel.x+Math.cos(a)*.27,.99,panel.z+Math.sin(a)*.27],.025,accent);}r.shape('ring',[panel.x,.03,panel.z],[.55,1,.55],accent,0,machinery.nearest(w.player)?.d<1.7?.85:.3,.2);continue;}
        const active=enabled?[.68,.87,.47]:[.58,.39,.32];r.shape('cube',[panel.x,.48,panel.z],[.20,.96,.20],[.24,.33,.34]);r.shape('cube',[panel.x,1.0,panel.z],[.58,.35,.31],[.34,.43,.43]);r.shape('cube',[panel.x,1.02,panel.z+.16],[.39,.16,.02],active,0,1,.4);r.shape('sphere',[panel.x+.18,.87,panel.z+.18],[.05,.05,.05],accent);
        const near=machinery.nearest(w.player);if(near?.id===panel.id&&near.d<1.8)r.shape('ring',[panel.x,.03,panel.z],[.6,1,.6],accent,0,.8,.5);
      }
      if(r.detail!=='lean'){
        if(w.arenaId==='rooftop')for(const x of [-7.5,7.5])for(const z of [-3.8,3.8])for(let i=0;i<3;i++)r.shape('cube',[x,.997,z],[.78,.025,.085],[.11,.19,.20],w.time*.8+i*Math.PI/3);
        if(w.arenaId==='courtyard'){const flutter=Math.sin(w.time*1.5)*.08;r.shape('cube',[5.4,3.2,-6.5],[1.4,.50,.025],accent,flutter);r.shape('cylinder',[4.65,0,-6.5],[.028,3.6,.028],[.2,.26,.2]);}
      }
      const candidate=w.yard.candidate(w.player,1.7)||w.yard.candidate(w.player,5.9);
      if(candidate&&!w.yard.held(w.player)&&!w.player.balloon)r.shape('ring',[candidate.x,.025,candidate.z],[Math.max(candidate.hx,candidate.hz)+.22,1,Math.max(candidate.hx,candidate.hz)+.22],accent,0,.8,.4);
    }
  }
  root.CombatScenery={Scenery,PALETTES};if(typeof module!=='undefined'&&module.exports)module.exports={Scenery,PALETTES};
})(typeof window!=='undefined'?window:globalThis);
