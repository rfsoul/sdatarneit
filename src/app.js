'use strict';
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const menu=$('.menu-toggle');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');$('.site-header').classList.toggle('nav-open',open)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){menu.click();menu.focus()}});

const dialog=$('#media-dialog'), content=$('#media-content');
let photos=[],active=0,mainIndex=0,mode='photos',previousFocus=null,galleryPromise;
const loadGallery=()=>galleryPromise??=fetch('/assets/gallery.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Gallery unavailable');return r.json()}).then(p=>photos=p).catch(err=>{galleryPromise=null;throw err});
function counterText(i){return `${i+1} / ${photos.length} · ${photos[i].caption}`}
function makeImage(p){const image=new Image();image.src=`/assets/${p.slug}-1600.webp`;image.alt=p.caption;image.width=p.width;image.height=p.height;return image}
function showPhoto(index){active=(index+photos.length)%photos.length;content.replaceChildren(makeImage(photos[active]));$('#dialog-counter').textContent=counterText(active);$$('#dialog-thumbnails button').forEach((b,i)=>i===active?b.setAttribute('aria-current','true'):b.removeAttribute('aria-current'));const current=$('#dialog-thumbnails button[aria-current]');if(current){const strip=$('#dialog-thumbnails');strip.scrollLeft=current.offsetLeft-strip.offsetLeft-strip.clientWidth/2+current.clientWidth/2}}
function openDialog(){previousFocus=document.activeElement;dialog.showModal();document.body.style.overflow='hidden';$('#close-dialog').focus()}
function thumbs(){const strip=$('#dialog-thumbnails');if(strip.childElementCount)return;photos.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',`Photo ${i+1}: ${p.caption}`);const im=new Image();im.src=`/assets/${p.slug}-240.webp`;im.alt='';im.loading='lazy';b.append(im);b.addEventListener('click',()=>showPhoto(i));strip.append(b)})}
async function openPhotos(index){await loadGallery();mode='photos';$('#media-title').textContent='A closer look at the home';$('#media-note').textContent='Actual property photos and neighbourhood views. Furniture pictured does not confirm rental inclusions.';$('#dialog-navigation').hidden=false;$('#dialog-thumbnails').hidden=false;thumbs();showPhoto(index);openDialog()}
async function updateMain(index){await loadGallery();mainIndex=(index+photos.length)%photos.length;const p=photos[mainIndex];const main=$('#main-photo-link');main.href=`/assets/${p.slug}-1600.webp`;main.dataset.photo=mainIndex;const im=makeImage(p);im.className='hero-image';im.srcset=`/assets/${p.slug}-800.webp 800w, /assets/${p.slug}-1600.webp 1600w`;im.sizes='(max-width:760px) 100vw, 70vw';main.replaceChildren(im);$('#main-counter').textContent=`${mainIndex+1} / ${photos.length}`;$$('[data-main-photo]').forEach(a=>+a.dataset.mainPhoto===mainIndex?a.setAttribute('aria-current','true'):a.removeAttribute('aria-current'))}
if($('#main-photo-link')){mainIndex=+$('#main-photo-link').dataset.photo;$('#main-prev').addEventListener('click',()=>updateMain(mainIndex-1).catch(()=>{}));$('#main-next').addEventListener('click',()=>updateMain(mainIndex+1).catch(()=>{}))}
document.addEventListener('click',async event=>{
 const photo=event.target.closest('[data-photo]'),main=event.target.closest('[data-main-photo]'),video=event.target.closest('[data-video]'),plan=event.target.closest('[data-plan]');
 if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
 if(photo){event.preventDefault();try{await openPhotos(+photo.dataset.photo)}catch{location.href=photo.href}}
 if(main){event.preventDefault();try{await updateMain(+main.dataset.mainPhoto)}catch{location.href=main.href}}
 if(video){event.preventDefault();mode='video';$('#media-title').textContent='Walkthrough · 2 min 15 sec';$('#media-note').textContent='A walkthrough of the actual home. Press play to explore. Some on-screen captions are historical; see the walkthrough page for details.';$('#dialog-navigation').hidden=true;$('#dialog-thumbnails').hidden=true;const v=document.createElement('video');v.controls=true;v.playsInline=true;v.preload='none';v.poster='/assets/photo-051-800.webp';v.src='/assets/tarneit-720p.mp4';v.setAttribute('aria-label','Recorded walkthrough of the Social Street home');content.replaceChildren(v);openDialog()}
 if(plan){event.preventDefault();mode='plan';const is2d=plan.dataset.plan==='2d';$('#media-title').textContent=is2d?'2D floor plan · illustrative marketing plan':'3D view · illustrative furnished concept';$('#media-note').textContent=is2d?'An illustrative 2D marketing floorplan. Check dimensions at your inspection. Not for construction.':'An illustrative furnished 3D concept, not a photograph. Furniture and fittings may differ from the actual home.';$('#dialog-navigation').hidden=true;$('#dialog-thumbnails').hidden=true;const im=new Image();im.src=`/assets/plan-${is2d?'2d':'3d'}-2000.webp`;im.alt=is2d?'2D home layout and site overview':'Illustrative furnished 3D concept';content.replaceChildren(im);openDialog()}
});
$('#close-dialog')?.addEventListener('click',()=>dialog.close());
dialog?.addEventListener('close',()=>{const v=$('video',content);if(v){v.pause();v.removeAttribute('src');v.load()}content.replaceChildren();document.body.style.overflow='';previousFocus?.focus()});
dialog?.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
$('#dialog-prev')?.addEventListener('click',()=>showPhoto(active-1));$('#dialog-next')?.addEventListener('click',()=>showPhoto(active+1));
dialog?.addEventListener('keydown',event=>{if(mode!=='photos')return;if(event.key==='ArrowRight'){event.preventDefault();showPhoto(active+1)}if(event.key==='ArrowLeft'){event.preventDefault();showPhoto(active-1)}if(event.key==='Home'){event.preventDefault();showPhoto(0)}if(event.key==='End'){event.preventDefault();showPhoto(photos.length-1)}});
function swipe(el,fn){
 let start=null,suppressClick=false;
 el?.addEventListener('pointerdown',event=>{if(event.isPrimary)start=[event.clientX,event.clientY]});
 el?.addEventListener('pointerup',event=>{if(!start)return;const dx=event.clientX-start[0],dy=event.clientY-start[1];start=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4){suppressClick=true;fn(dx<0?1:-1);setTimeout(()=>suppressClick=false,100)}});
 el?.addEventListener('pointercancel',()=>start=null);
 el?.addEventListener('dragstart',event=>event.preventDefault());
 el?.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopPropagation()}},true);
}
swipe(content,dir=>{if(mode==='photos')showPhoto(active+dir)});swipe($('.main-photo'),dir=>updateMain(mainIndex+dir).catch(()=>{}));
$('.main-photo')?.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();updateMain(mainIndex+(event.key==='ArrowRight'?1:-1)).catch(()=>{})}});
window.addEventListener('hashchange',()=>{if(location.hash==='#all-photos')$('#all-photos')?.setAttribute('open','')});if(location.hash==='#all-photos')$('#all-photos')?.setAttribute('open','');

const form=$('#enquiry-form');
if(form){
 const fields=$('#enquiry-fields');
 const submit=$('button[type=submit]',form);
 const result=$('#form-result');
 let sending=false;
 fields.disabled=false;
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(sending||!form.reportValidity())return;
  const values=Object.fromEntries(new FormData(form));
  sending=true;fields.disabled=true;submit.textContent='Sending…';result.textContent='';
  try{
   const response=await fetch('/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Your enquiry could not be saved. Please try again shortly.');
   if(data.accepted!==true||typeof data.reference!=='string'||!data.reference)throw new Error('We could not confirm that your enquiry was saved. Please try again.');
   result.textContent='Thank you. Your enquiry has been received. We’ll be in touch using the details you provided.';
   const reference=document.createElement('span');reference.className='enquiry-reference';reference.textContent=`Your reference: ${data.reference}`;result.append(reference);
   form.reset();
  }catch(error){
   result.textContent=error instanceof TypeError||error instanceof SyntaxError?'We could not confirm that your enquiry was saved. Please check your connection and try again. Your details are still in the form.':error.message;
  }finally{
   sending=false;fields.disabled=false;submit.textContent='Send enquiry';result.focus();
  }
 });
}
