import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
export function createWorkspaceFlowScene(canvas,model,{onSelect,onReplayEnd,labels}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,1000),controls=new OrbitControls(camera,canvas);
 controls.enableDamping=false;controls.enablePan=true;controls.enableZoom=true;
 if(matchMedia('(max-width:760px)').matches){controls.enableRotate=false;controls.enableZoom=false;canvas.style.touchAction='pan-y';}
 const root=new THREE.Group();scene.add(root);const pickables=[],points=new Map(),resources=[];
 const roundIds=model.rounds.filter(r=>model.nodes.some(n=>n.roundId===r.id)).map(r=>r.id),slots=new Map();
 const light=document.documentElement.dataset.theme==='light',ink=light?0x183845:0xc5e5eb;
 const colors=[0x45b6a8,0x9671df,0xeb9863,0x619bd2];
 function label(value,x,y,z,scale=5.3,font=44){const c=document.createElement('canvas');c.width=512;c.height=80;const ctx=c.getContext('2d');ctx.font=`500 ${font}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=light?'#183845':'#d0e1e8';ctx.fillText(value,256,40);const map=new THREE.CanvasTexture(c);resources.push(map);const m=new THREE.SpriteMaterial({map,depthTest:false});const s=new THREE.Sprite(m);s.position.set(x,y,z);s.scale.set(scale,scale*80/512,1);root.add(s);}
 model.nodes.forEach((n,i)=>{
  const x=roundIds.indexOf(n.roundId)*15+n.stage*3.1,key=`${x}/${n.setting}`,slot=slots.get(key)||0;slots.set(key,slot+1);
  const pos=new THREE.Vector3(x,n.setting==='online'?2.3:n.setting==='in-person'?-2.3:0,(slot-2)*.7);points.set(n.id,pos);
  const geometry=n.kind==='transfer'?new THREE.OctahedronGeometry(.25):new THREE.SphereGeometry(.23,12,10);
  const material=new THREE.MeshBasicMaterial({color:n.restricted?0x999999:n.kind==='transfer'?0xe8b250:colors[Math.floor(n.stage)],transparent:true,opacity:n.older?.35:1,wireframe:n.kind==='transfer'||!n.reviewed});
  const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(pos);mesh.userData.id=n.id;root.add(mesh);pickables.push(mesh);label(String(i+1),pos.x,pos.y+.58,pos.z,3.2,64);
 });
 const replayCurves=[];
 for(const e of model.edges.slice(0,400)){
  const a=points.get(e.from),b=points.get(e.to);if(!a||!b)continue;
  const curve=new THREE.QuadraticBezierCurve3(a,a.clone().lerp(b,.5).add(new THREE.Vector3(0,.3,.3)),b),geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(16));
  const line=new THREE.Line(geometry,new THREE.LineDashedMaterial({color:e.replay?ink:0x8a8f96,transparent:true,opacity:e.type==='context'?.18:.45,dashSize:e.replay?100:.13,gapSize:.12}));line.computeLineDistances();root.add(line);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(.055,.18,5),new THREE.MeshBasicMaterial({color:ink,transparent:true,opacity:.65}));cone.position.copy(curve.getPoint(.8));cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),curve.getTangent(.8).normalize());root.add(cone);
  if(e.replay)replayCurves.push(curve);
 }
 roundIds.forEach((id,i)=>{label(model.rounds.find(r=>r.id===id).title.slice(0,23),i*15+4.5,5,-3,8,26);labels.forEach((name,j)=>label(name,i*15+j*3.1,3.7,-3));});
 const box=new THREE.Box3().setFromObject(root),center=box.isEmpty()?new THREE.Vector3():box.getCenter(new THREE.Vector3()),size=box.isEmpty()?new THREE.Vector3(10,4,6):box.getSize(new THREE.Vector3());
 let dead=false,raf=0,start=0,visible=true,replaying=false;
 const packet=new THREE.Mesh(new THREE.IcosahedronGeometry(.1),new THREE.MeshBasicMaterial({color:light?0x216342:0xc4ff69}));packet.visible=false;scene.add(packet);
 function draw(){if(!dead&&visible&&!document.hidden)renderer.render(scene,camera);}
 function fit(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();const distance=Math.max(size.x/camera.aspect,size.z,size.y,8)*1.5;camera.position.set(center.x+distance*.12,center.y+distance*.55,center.z+distance);controls.target.copy(center);controls.update();draw();}
 function stop(){replaying=false;cancelAnimationFrame(raf);packet.visible=false;draw();onReplayEnd?.();}
 function frame(now){if(dead||!visible||document.hidden){stop();return;}const t=(now-start)/5000;if(t>=1){stop();return;}const i=Math.min(replayCurves.length-1,Math.floor(t*replayCurves.length));packet.position.copy(replayCurves[i].getPoint((t*replayCurves.length)%1));draw();raf=requestAnimationFrame(frame);}
 const resize=new ResizeObserver(fit);resize.observe(canvas);
 const intersection=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(!visible)stop();else draw();});intersection.observe(canvas);
 const theme=new MutationObserver(()=>{stop();});theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 const visibility=()=>{if(document.hidden)stop();else draw();};document.addEventListener('visibilitychange',visibility);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),reduceChange=()=>{if(reduced.matches)stop();};reduced.addEventListener('change',reduceChange);
 controls.addEventListener('change',draw);
 let down;const pointerDown=e=>{down=[e.clientX,e.clientY];},pointerUp=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=ray.intersectObjects(pickables)[0];if(hit)onSelect(hit.object.userData.id);};
 canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);
 fit();
 return {reset:fit,select(id){const p=points.get(id);if(!p)return;pickables.forEach(m=>m.scale.setScalar(m.userData.id===id?1.6:1));window.gsap?.killTweensOf(controls.target);if(window.gsap&&!reduced.matches)window.gsap.to(controls.target,{x:p.x,y:p.y,z:p.z,duration:.45,overwrite:true,onUpdate:()=>{controls.update();draw();}});else{controls.target.copy(p);controls.update();draw();}},replay(){if(reduced.matches||!replayCurves.length)return false;if(replaying){stop();return false;}replaying=true;start=performance.now();packet.visible=true;raf=requestAnimationFrame(frame);return true;},destroy(){dead=true;stop();window.gsap?.killTweensOf(controls.target);resize.disconnect();intersection.disconnect();theme.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',reduceChange);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);controls.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});resources.forEach(r=>r.dispose());renderer.dispose();}};
}
