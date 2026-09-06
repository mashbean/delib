import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// One chronological path changes elevation as people move between settings.
// No duplicate online/offline rounds. Each station has a different data form.
export function createJourneyScene(canvas,{onSelect,labels,reducedMotion=false}) {
 let renderer;
 try { renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'}); }
 catch { canvas.hidden=true;const fallback=document.createElement('p');fallback.className='scene-fallback';fallback.textContent='3D 暫不可用 · Use the interactive pipeline and step buttons below.';canvas.after(fallback);return {update(){},reset(){},setTilt(){},zoom(){}}; }
 const compact=matchMedia('(max-width:760px)').matches;let quality=Math.min(devicePixelRatio,compact?1.15:1.7),slowFrames=0;
 renderer.setPixelRatio(quality);renderer.setClearColor(0x090e14,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x0a0e14,.015);
 const camera=new THREE.PerspectiveCamera(34,1,.1,120);camera.position.set(3,10,18);
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,.5,0);controls.enableDamping=false;controls.dampingFactor=.08;controls.enablePan=false;controls.enableZoom=false;controls.minPolarAngle=.25;controls.maxPolarAngle=Math.PI*.52;controls.rotateSpeed=.6;
 const root=new THREE.Group();scene.add(root);scene.add(new THREE.AmbientLight(0xc5ddff,2));const key=new THREE.DirectionalLight(0xd6ffb0,4);key.position.set(4,12,8);scene.add(key);const fill=new THREE.DirectionalLight(0xc092ff,3);fill.position.set(-8,3,-4);scene.add(fill);
 const colors=[0xb9fa57,0xb9fa57,0x63dcec,0x63dcec,0x63dcec,0xc3a0ff,0xffb874,0xf291c8];
 const position=i=>new THREE.Vector3((i-3.5)*2.7,[0,1,0,1,0,1,0,1][i]?2.3:-.3,Math.sin(i*.85)*2.9);
 let positions=Array.from({length:8},(_,i)=>position(i)),step=0,paused=reducedMotion,visible=true,raf=0,last=0,clock=0,mode='hybrid',language='',peopleData=[];
 const points=new Float32Array(450*3);for(let i=0;i<450;i++){points[i*3]=Math.sin(i*17.3)*24;points[i*3+1]=Math.cos(i*7.1)*12;points[i*3+2]=Math.sin(i*3.2)*20;}
 const dust=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(points,3)),new THREE.PointsMaterial({color:0xb2c4c9,size:.024,transparent:true,opacity:.4}));root.add(dust);
 const grid=new THREE.GridHelper(36,36,0x253c3a,0x162327);grid.position.y=-2.5;root.add(grid);
 const nodes=[],pickables=[],labels3d=[];
 const mat=(color)=>new THREE.MeshStandardMaterial({color,metalness:.5,roughness:.25,emissive:color,emissiveIntensity:.15});
 function mesh(geometry,color,parent){const m=new THREE.Mesh(geometry,mat(color));parent.add(m);return m;}
 for(let i=0;i<8;i++){
   const group=new THREE.Group();group.position.copy(positions[i]);root.add(group);
   const ring=mesh(new THREE.TorusGeometry(.85,.018,8,64),colors[i],group);ring.rotation.x=Math.PI/2;
   const halo=mesh(new THREE.CylinderGeometry(.86,.86,.04,48),colors[i],group);halo.position.y=-.45;halo.material.transparent=true;halo.material.opacity=.13;
   const form=new THREE.Group();group.add(form);
   if(i===0){const box=mesh(new THREE.BoxGeometry(.85,1,.09),colors[i],form);box.rotation.z=-.18;}
   if(i===1){for(let j=0;j<16;j++){const ball=mesh(new THREE.IcosahedronGeometry(.105,0),colors[i],form);ball.position.set(Math.sin(j*2.4)*.65,Math.cos(j*1.8)*.55,Math.cos(j*2.4)*.65);}}
   if(i===2){for(let j=0;j<5;j++){const ball=mesh(new THREE.SphereGeometry(.14,12,8),colors[i],form);ball.position.set(Math.sin(j*1.25)*.55,.12,Math.cos(j*1.25)*.55);}}
   if(i===3){for(let j=0;j<3;j++){const sheet=mesh(new THREE.BoxGeometry(.7,.85,.035),colors[i],form);sheet.position.set(j*.14-.14,0,j*.18-.18);sheet.rotation.y=-.25;}}
   if(i===4){for(let j=0;j<4;j++){const cluster=mesh(new THREE.OctahedronGeometry(.28,0),colors[i],form);cluster.position.set(Math.sin(j*1.57)*.44,j%2*.28,Math.cos(j*1.57)*.44);}}
   if(i===5){mesh(new THREE.IcosahedronGeometry(.57,0),colors[i],form);const wire=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.7,0)),new THREE.LineBasicMaterial({color:0xf4d7ff}));form.add(wire);}
   if(i===6){for(let j=0;j<5;j++){const sheet=mesh(new THREE.BoxGeometry(.9,.045,.6),colors[i],form);sheet.position.y=j*.17-.3;sheet.rotation.y=.1*j;}}
   if(i===7){const loop=mesh(new THREE.TorusGeometry(.5,.11,12,48),colors[i],form);loop.rotation.set(.3,.25,0);mesh(new THREE.OctahedronGeometry(.22),0xffffff,form);}
   const hit=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({visible:false}));hit.userData.step=i;group.add(hit);pickables.push(hit);
   nodes.push({group,form,ring,halo});
 }
 let track=new THREE.Group();root.add(track);
 function rebuildTrack(){track.traverse(x=>{x.geometry?.dispose();if(x.material)x.material.dispose();});root.remove(track);track=new THREE.Group();root.add(track);for(let i=1;i<8;i++){const a=positions[i-1],b=positions[i],curve=new THREE.CatmullRomCurve3([a,a.clone().lerp(b,.3).add(new THREE.Vector3(0,.25,0)),b]);for(const [radius,opacity] of [[.10,.07],[.045,.17],[.015,.85]]){const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,32,radius,6,false),new THREE.MeshBasicMaterial({color:colors[i],transparent:true,opacity:i<=step?opacity:opacity*.55}));track.add(tube);}const arrow=new THREE.Mesh(new THREE.ConeGeometry(.10,.33,8),new THREE.MeshBasicMaterial({color:colors[i],transparent:true,opacity:.8}));arrow.position.copy(curve.getPoint(.6));arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),curve.getTangent(.6).normalize());track.add(arrow);}}
 rebuildTrack();
 function labelSprite(text,color){const el=document.createElement('canvas');el.width=512;el.height=120;const ctx=el.getContext('2d');ctx.font='600 37px system-ui, sans-serif';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,256,70);const map=new THREE.CanvasTexture(el);map.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:false}));sprite.scale.set(5.2,1.22,1);return sprite;}
 function setLabels(){const names=labels();if(names.join('|')===language)return;language=names.join('|');labels3d.forEach(s=>{s.material.map.dispose();s.material.dispose();root.remove(s);});labels3d.length=0;names.forEach((s,i)=>{const label=labelSprite(`${String(i+1).padStart(2,'0')} / ${s}`,i===step?'#efffdc':'#acbdc7');label.position.copy(positions[i]).add(new THREE.Vector3(0,1.35,0));root.add(label);labels3d.push(label);});}
 setLabels();
 const packets=[];for(let i=0;i<18;i++){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.055,0),new THREE.MeshBasicMaterial({color:0xd8ffa8}));root.add(m);packets.push(m);}
 const people=[];for(let i=0;i<14;i++){const p=new THREE.Group();const head=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),new THREE.MeshBasicMaterial({color:0xff91d5}));head.position.y=.15;p.add(head);const body=new THREE.Mesh(new THREE.CylinderGeometry(.035,.08,.21,8),new THREE.MeshBasicMaterial({color:0xff91d5}));p.add(body);root.add(p);people.push(p);}
 const cursor=new THREE.Vector2(),ray=new THREE.Raycaster();let down;
 canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const r=canvas.getBoundingClientRect();cursor.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(cursor,camera);const hit=ray.intersectObjects(pickables)[0];if(hit)onSelect(hit.object.userData.step);});
 function resize(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.zoom=Math.min(1,camera.aspect/1.6);camera.updateProjectionMatrix();render();}
 function render(){if(!visible||document.hidden)return;controls.update();renderer.render(scene,camera);}
 function frame(now){raf=0;if(!visible||document.hidden)return;const elapsed=now-last;if(elapsed>45)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);if(slowFrames>35&&quality>.8){quality=Math.max(.8,quality-.25);renderer.setPixelRatio(quality);slowFrames=0;}const dt=Math.min(elapsed/1000,.04)||0;last=now;if(!paused){clock+=dt;nodes.forEach((n,i)=>{n.form.rotation.y=clock*.13+i*.2;n.form.position.y=Math.sin(clock*.7+i)*.05;});packets.forEach((p,i)=>{const a=positions[Math.max(0,step-1)],b=positions[step],t=(clock*.18+i/18)%1;p.position.copy(a).lerp(b,t);p.position.z+=Math.sin(t*Math.PI)*.18;p.visible=step>0;});}render();if(!paused)raf=requestAnimationFrame(frame);}
 function start(){if(!raf&&visible&&!document.hidden){last=performance.now();raf=requestAnimationFrame(frame);}}
 // OrbitControls gets a render even with motion paused; no continuous idle loop.
 controls.addEventListener('change',()=>{renderer.render(scene,camera);});controls.addEventListener('start',start);
 new ResizeObserver(resize).observe(canvas);
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else{cancelAnimationFrame(raf);raf=0;}},{rootMargin:'100px'});observer.observe(canvas);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else start();});
 const api={
  update(opts={}) {const old=step;step=opts.step??step;paused=opts.paused??paused;mode=opts.mode??mode;peopleData=opts.people??peopleData;
   const modes=opts.modes;positions=Array.from({length:8},(_,i)=>{const p=position(i);p.y=(mode==='online'||(mode==='hybrid'&&(modes?.[i]??(['in-person','online','in-person','online','in-person','online','in-person','online'][i])))==='online')?2.3:-.3;return p;});
   nodes.forEach((n,i)=>{n.group.position.copy(positions[i]);n.group.scale.setScalar(i===step?1.2:.88);n.halo.material.opacity=i===step?.35:.08;});
   rebuildTrack();language='';setLabels();
   people.forEach((p,i)=>{const person=peopleData[i];p.visible=!!person;if(!person)return;const end=positions[step].clone().add(new THREE.Vector3(Math.cos(i*1.8)*1.15,person.mode==='online'?.4:-.35,Math.sin(i*1.8)*1.15));if(window.gsap&&old!==step&&!paused&&visible){p.position.copy(positions[old]);gsap.to(p.position,{x:end.x,y:end.y,z:end.z,duration:1.15,ease:'power2.inOut',overwrite:true,onUpdate:render});}else p.position.copy(end);});
   packets.forEach((p,i)=>{p.position.copy(positions[Math.max(0,step-1)]).lerp(positions[step],i/18);p.visible=step>0;});render();start();
  },
  zoom(factor){camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.25,2.4);camera.updateProjectionMatrix();render();},
  reset(){camera.zoom=Math.min(1,camera.aspect/1.6);camera.updateProjectionMatrix();if(window.gsap&&!paused)gsap.to(camera.position,{x:3,y:10,z:18,duration:1,ease:'power2.inOut',onUpdate:render});else camera.position.set(3,10,18);controls.target.set(0,.5,0);render();},
  setTilt(value){camera.position.y=Number(value)/2;render();}
 };
 window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);observer.disconnect();controls.dispose();renderer.dispose();},{once:true});resize();start();return api;
}
