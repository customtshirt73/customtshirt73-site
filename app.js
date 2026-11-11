(function(){"use strict";
var $=function(i){return document.getElementById(i)};
/* ---------- DATA (prices must match netlify/functions/create-checkout.mjs) ---------- */
var STYLES=[{id:'tee',name:'Classic tee',desc:'100% cotton',price:24},{id:'heavy',name:'Heavyweight',desc:'Boxy fit',price:29},
 {id:'longsleeve',name:'Long sleeve',desc:'Soft cotton',price:32},{id:'hoodie',name:'Hoodie',desc:'Fleece lined',price:46}];
var COLORS=[{id:'white',name:'White',hex:'#f7f7f5'},{id:'black',name:'Black',hex:'#1d1d1f'},{id:'navy',name:'Navy',hex:'#1f2a44'},
 {id:'grey',name:'Heather grey',hex:'#b9b8b4'},{id:'red',name:'Red',hex:'#c8323a'},{id:'royal',name:'Royal blue',hex:'#2a52be'},
 {id:'forest',name:'Forest green',hex:'#2f5236'},{id:'maroon',name:'Maroon',hex:'#6b1f2a'},{id:'sand',name:'Sand',hex:'#d8c7a1'},
 {id:'pink',name:'Light pink',hex:'#f4c6cf'},{id:'gold',name:'Gold',hex:'#e7a92b'},{id:'purple',name:'Purple',hex:'#5b3a8c'}];
var SIZES=[['xs',0],['s',0],['m',0],['l',0],['xl',0],['2xl',3],['3xl',3],['4xl',5]];
var BACK_PRINT=6;
var FONTS=['Inter','Anton','Bebas Neue','Oswald','Graduate','Bungee','Permanent Marker','Pacifico','Lobster','Dancing Script','Playfair Display'];
var TEXT_COLORS=['#ffffff','#111111','#e8483c','#f2b705','#2a52be','#2f8f4e','#7b3fa0','#ff7ab6','#c0c0c0','#d4af37'];
var CLIPS=['★','♥','⚡','👑','🔥','⚽','🏀','🏈','⚾','🎂','🎉','🌸','🦋','🐾','🎵','✝','☮','♛','✈','☀'];
/* print area, in canvas coords (600x680) */
var AREA={front:{x:190,y:185,w:220,h:290},back:{x:180,y:170,w:240,h:320}};

var state={style:'tee',color:'white',size:'m',qty:1,view:'front',sel:null,els:{front:[],back:[]}};
var cart=[];try{cart=JSON.parse(localStorage.getItem('ct73cart'))||[]}catch(e){}
var history=[],future=[],uid=1;

/* ---------- REALISTIC GARMENT DRAWING ---------- */
function shade(hex,amt){var n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;
 function f(c){return Math.max(0,Math.min(255,Math.round(amt<0?c*(1+amt):c+(255-c)*amt)))}
 return 'rgb('+f(r)+','+f(g)+','+f(b)+')'}
function bodyPath(style,view){
 var p=new Path2D(),hood=style==='hoodie',long=style==='longsleeve'||hood,boxy=style==='heavy';
 var sw=boxy?8:0, nk=view==='front'?(hood?60:52):34;
 p.moveTo(225,70);
 p.bezierCurveTo(250,70+nk,350,70+nk,375,70);           // neckline
 p.lineTo(460+sw,105);                                  // right shoulder
 if(long){p.lineTo(520,330);p.lineTo(545,560);p.lineTo(500,572);p.lineTo(468,350);p.lineTo(450,230);}
 else{p.lineTo(545,215);p.lineTo(478,262);}
 p.lineTo(455+sw,250);p.bezierCurveTo(458+sw,400,462+sw,520,465+sw,625);
 p.bezierCurveTo(360,640,240,640,135-sw,625);
 p.bezierCurveTo(138-sw,520,142-sw,400,145-sw,250);
 if(long){p.lineTo(150,230);p.lineTo(132,350);p.lineTo(100,572);p.lineTo(55,560);p.lineTo(80,330);}
 else{p.lineTo(122,262);p.lineTo(55,215);}
 p.lineTo(140-sw,105);p.closePath();return p}
function drawGarment(ctx,style,colorHex,view){
 ctx.clearRect(0,0,600,680);
 var body=bodyPath(style,view);
 ctx.save();ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=24;ctx.shadowOffsetY=10;ctx.fillStyle=colorHex;ctx.fill(body);ctx.restore();
 ctx.save();ctx.clip(body);
 var g=ctx.createLinearGradient(0,0,600,0);   // side shading for a 3D look
 g.addColorStop(0,'rgba(0,0,0,.22)');g.addColorStop(.18,'rgba(0,0,0,0)');g.addColorStop(.5,'rgba(255,255,255,.07)');
 g.addColorStop(.82,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.22)');ctx.fillStyle=g;ctx.fillRect(0,0,600,680);
 var v=ctx.createLinearGradient(0,60,0,640);v.addColorStop(0,'rgba(255,255,255,.08)');v.addColorStop(1,'rgba(0,0,0,.12)');ctx.fillStyle=v;ctx.fillRect(0,0,600,680);
 // fabric folds
 ctx.filter='blur(6px)';ctx.lineCap='round';
 [[200,300,180,600,.10],[410,320,425,610,.10],[260,520,300,630,.07],[340,500,380,630,.06],[150,240,200,290,.12],[450,240,400,290,.12]].forEach(function(f){
  ctx.strokeStyle='rgba(0,0,0,'+f[4]+')';ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(f[0],f[1]);ctx.quadraticCurveTo((f[0]+f[2])/2+15,(f[1]+f[3])/2,f[2],f[3]);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(f[0]+14,f[1]);ctx.quadraticCurveTo((f[0]+f[2])/2+29,(f[1]+f[3])/2,f[2]+14,f[3]);ctx.stroke();});
 ctx.filter='none';
 // seams and hems
 ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=1.2;ctx.setLineDash([3,3]);
 ctx.beginPath();ctx.moveTo(130,612);ctx.bezierCurveTo(240,627,360,627,470,612);ctx.stroke();
 ctx.beginPath();ctx.moveTo(145,250);ctx.lineTo(140,105);ctx.moveTo(455,250);ctx.lineTo(460,105);ctx.stroke();ctx.setLineDash([]);
 ctx.restore();
 // collar / hood
 if(style==='hoodie'){
  var hood=new Path2D();hood.moveTo(222,72);hood.bezierCurveTo(200,-5,400,-5,378,72);
  if(view==='front')hood.bezierCurveTo(350,130,250,130,222,72);else hood.bezierCurveTo(360,150,240,150,222,72);
  ctx.fillStyle=shade(colorHex,-.08);ctx.fill(hood);ctx.strokeStyle='rgba(0,0,0,.2)';ctx.lineWidth=2;ctx.stroke(hood);
  if(view==='front'){ctx.fillStyle=shade(colorHex,-.35);ctx.beginPath();ctx.ellipse(300,88,58,24,0,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle=shade(colorHex,.5);ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(280,112);ctx.lineTo(276,200);ctx.moveTo(320,112);ctx.lineTo(324,200);ctx.stroke();
   var pk=new Path2D();pk.moveTo(205,470);pk.lineTo(395,470);pk.lineTo(420,580);pk.lineTo(180,580);pk.closePath();
   ctx.fillStyle='rgba(0,0,0,.05)';ctx.fill(pk);ctx.strokeStyle='rgba(0,0,0,.2)';ctx.lineWidth=1.5;ctx.stroke(pk);}
 } else {
  var nk=view==='front'?52:34;
  ctx.strokeStyle=shade(colorHex,-.18);ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(225,72);ctx.bezierCurveTo(250,72+nk,350,72+nk,375,72);ctx.stroke();
  ctx.fillStyle=shade(colorHex,-.3);ctx.beginPath();ctx.moveTo(225,70);ctx.bezierCurveTo(250,70+nk-6,350,70+nk-6,375,70);ctx.bezierCurveTo(340,62,260,62,225,70);ctx.fill();
 }
}/* ---------- TEXT RENDERING (same function for screen and print file) ---------- */
function textCanvas(el,px){
 var fs=px,font=(el.italic?'italic ':'')+(el.bold?'800 ':'400 ')+fs+'px "'+el.font+'"';
 var c=document.createElement('canvas'),x=c.getContext('2d');x.font=font;
 var w=Math.max(1,x.measureText(el.text).width),sw=el.strokeW*fs/40,pad=sw+fs*.2,curve=el.curve/100;
 if(Math.abs(curve)<.02){
  c.width=w+pad*2;c.height=fs*1.35+pad*2;x=c.getContext('2d');x.font=font;x.textBaseline='middle';x.lineJoin='round';
  if(sw>0){x.lineWidth=sw*2;x.strokeStyle=el.stroke;x.strokeText(el.text,pad,c.height/2)}
  x.fillStyle=el.color;x.fillText(el.text,pad,c.height/2);return c}
 var ang=Math.abs(curve)*Math.PI*1.2,R=w/ang,h=R*(1-Math.cos(ang/2))+fs*1.4+pad*2;
 c.width=Math.max(w,2*R*Math.sin(ang/2))+fs+pad*2;c.height=h;x=c.getContext('2d');x.font=font;x.textBaseline='middle';x.lineJoin='round';
 var cx=c.width/2,cy=curve>0?R+fs*.7+pad:h-R-fs*.7-pad,a=-ang/2;
 for(var i=0;i<el.text.length;i++){var ch=el.text[i],cw=x.measureText(ch).width,t=a+cw/2/R;
  x.save();if(curve>0){x.translate(cx+R*Math.sin(t),cy-R*Math.cos(t));x.rotate(t)}else{x.translate(cx+R*Math.sin(t),cy+R*Math.cos(t));x.rotate(-t)}
  if(sw>0){x.lineWidth=sw*2;x.strokeStyle=el.stroke;x.strokeText(ch,-cw/2,0)}x.fillStyle=el.color;x.fillText(ch,-cw/2,0);x.restore();a+=cw/R}
 return c}

/* ---------- ELEMENTS ---------- */
function els(){return state.els[state.view]}
function selEl(){return els().filter(function(e){return e.id===state.sel})[0]}
function snapshot(){history.push(JSON.stringify(state.els));if(history.length>50)history.shift();future=[]}
function restore(s){state.els=JSON.parse(s);state.sel=null;renderEls();syncPanels();update()}
function areaPx(){var st=$('stage').getBoundingClientRect(),k=st.width/600,a=AREA[state.view];return{k:k,x:a.x*k,y:a.y*k,w:a.w*k,h:a.h*k}}
function addEl(o){snapshot();o.id=uid++;o.x=o.x||.5;o.y=o.y||.4;o.rot=0;els().push(o);state.sel=o.id;renderEls();syncPanels();update()}
function renderEls(){
 var A=areaPx(),pa=$('printArea');pa.style.left=A.x+'px';pa.style.top=A.y+'px';pa.style.width=A.w+'px';pa.style.height=A.h+'px';pa.innerHTML='';
 els().forEach(function(e){
  var d=document.createElement('div');d.className='el'+(e.id===state.sel?' sel':'');
  var img=new Image();
  if(e.type==='text'){var c=textCanvas(e,120);img.src=c.toDataURL();e.ar=c.height/c.width}else img.src=e.src;
  var w=e.size*A.w;d.style.width=w+'px';
  d.style.left=(e.x*A.w-w/2)+'px';d.style.top=(e.y*A.h-w*e.ar/2)+'px';d.style.transform='rotate('+e.rot+'deg)';
  d.appendChild(img);
  if(e.id===state.sel){var h=document.createElement('div');h.className='handle';d.appendChild(h);var r=document.createElement('div');r.className='rhandle';d.appendChild(r);bindHandle(h,e,'size');bindHandle(r,e,'rot')}
  bindDrag(d,e);pa.appendChild(d)});
}
function bindDrag(d,e){d.addEventListener('pointerdown',function(ev){
 if(ev.target.classList.contains('handle')||ev.target.classList.contains('rhandle'))return;
 ev.preventDefault();if(state.sel!==e.id){state.sel=e.id;renderEls();syncPanels()}
 snapshot();var A=areaPx(),sx=ev.clientX,sy=ev.clientY,ox=e.x,oy=e.y;
 function mv(m){e.x=Math.max(0,Math.min(1,ox+(m.clientX-sx)/A.w));e.y=Math.max(0,Math.min(1,oy+(m.clientY-sy)/A.h));
  if(Math.abs(e.x-.5)<.02)e.x=.5;renderEls()}   // snaps to centre line
 function up(){removeEventListener('pointermove',mv);removeEventListener('pointerup',up);update()}
 addEventListener('pointermove',mv);addEventListener('pointerup',up)})}
function bindHandle(h,e,mode){h.addEventListener('pointerdown',function(ev){ev.preventDefault();ev.stopPropagation();snapshot();
 var A=areaPx(),r=$('printArea').getBoundingClientRect(),cx=r.left+e.x*A.w,cy=r.top+e.y*A.h,d0=Math.hypot(ev.clientX-cx,ev.clientY-cy),s0=e.size;
 function mv(m){if(mode==='size'){e.size=Math.max(.08,Math.min(2,s0*Math.hypot(m.clientX-cx,m.clientY-cy)/d0))}
  else{var a=Math.atan2(m.clientY-cy,m.clientX-cx)*180/Math.PI+90;if(Math.abs(a)<4)a=0;e.rot=Math.round(a>180?a-360:a)}
  syncPanels();renderEls()}
 function up(){removeEventListener('pointermove',mv);removeEventListener('pointerup',up);update()}
 addEventListener('pointermove',mv);addEventListener('pointerup',up)})}
function syncPanels(){var e=selEl();$('layerPanel').classList.toggle('hidden',!e);$('textEdit').classList.toggle('hidden',!(e&&e.type==='text'));
 if(!e)return;$('sizeRange').value=Math.round(e.size*100);$('rotRange').value=e.rot;
 if(e.type==='text'){$('textInput').value=e.text;$('fontSel').value=e.font;$('strokeColor').value=e.stroke;$('strokeW').value=e.strokeW;$('curve').value=e.curve;
  $('addText').textContent='Add another text'}}

/* ---------- IMAGE UPLOAD ---------- */
function handleFile(f){
 if(!/^image\//.test(f.type)){toast('Please choose an image file');return}
 if(f.size>15*1024*1024){toast('That file is over 15 MB');return}
 var rd=new FileReader();rd.onload=function(){var im=new Image();im.onload=function(){
  // keep up to 2400px for print quality
  var s=Math.min(1,2400/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s)||800;c.height=Math.round(im.height*s)||800;
  c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  var inches=12*(AREA[state.view].w/240)*.8,dpi=Math.round(c.width/inches);
  $('dpiNote').textContent=dpi<150?'Heads up: this image is low resolution ('+c.width+'px wide) and may print blurry at full size.':'Image looks good for printing.';
  $('dpiNote').className='hint'+(dpi<150?' warn':'');
  addEl({type:'img',src:c.toDataURL('image/png'),ar:c.height/c.width,size:.8})};im.src=rd.result};rd.readAsDataURL(f)}
            /* ---------- PRODUCT OPTIONS + PRICE ---------- */
function find(a,id){return a.filter(function(x){return x.id===id})[0]}
function build(){
 $('styleOpts').innerHTML=STYLES.map(function(s){return '<button class="opt" data-v="'+s.id+'">'+s.name+'<small>'+s.desc+' &middot; $'+s.price+'</small></button>'}).join('');
 $('colorOpts').innerHTML=COLORS.map(function(c){return '<button class="sw" title="'+c.name+'" data-v="'+c.id+'" style="background:'+c.hex+'"></button>'}).join('');
 $('sizeOpts').innerHTML=SIZES.map(function(s){return '<button class="opt" data-v="'+s[0]+'">'+s[0].toUpperCase()+(s[1]?'<small>+$'+s[1]+'</small>':'')+'</button>'}).join('');
 $('fontSel').innerHTML=FONTS.map(function(f){return '<option style="font-family:\''+f+'\'">'+f+'</option>'}).join('');
 $('textColors').innerHTML=TEXT_COLORS.map(function(c){return '<button class="sw" data-v="'+c+'" style="background:'+c+'"></button>'}).join('');
 $('clipGrid').innerHTML=CLIPS.map(function(c){return '<button>'+c+'</button>'}).join('');
 [['styleOpts','style'],['colorOpts','color'],['sizeOpts','size']].forEach(function(p){
  $(p[0]).addEventListener('click',function(ev){var b=ev.target.closest('[data-v]');if(!b)return;state[p[1]]=b.getAttribute('data-v');update()})});
}
function unitPrice(){var s=find(STYLES,state.style).price,up=SIZES.filter(function(z){return z[0]===state.size})[0][1];
 return s+up+(state.els.front.length&&state.els.back.length?BACK_PRINT:0)}
function disc(q){return q>=12?.2:q>=6?.1:0}
function update(){
 drawGarment($('shirtCanvas').getContext('2d'),state.style,find(COLORS,state.color).hex,state.view);
 document.querySelectorAll('#styleOpts .opt,#sizeOpts .opt,#colorOpts .sw').forEach(function(b){
  var v=b.getAttribute('data-v');b.classList.toggle('active',v===state.style||v===state.color||v===state.size)});
 $('colorName').textContent=find(COLORS,state.color).name;
 var u=unitPrice(),q=state.qty,d=disc(q),t=u*q*(1-d);
 $('sumLines').innerHTML='<div><span>'+find(STYLES,state.style).name+', '+find(COLORS,state.color).name+', '+state.size.toUpperCase()+'</span></div>'+
  '<div><span>$'+u.toFixed(2)+' &times; '+q+'</span><span>$'+(u*q).toFixed(2)+'</span></div>'+
  (state.els.front.length&&state.els.back.length?'<div><span>Front + back print</span><span>incl. $'+BACK_PRINT+'</span></div>':'')+
  (d?'<div><span>Bulk discount '+d*100+'%</span><span>-$'+(u*q*d).toFixed(2)+'</span></div>':'');
 $('sumTotal').textContent='$'+t.toFixed(2);
 $('addCart').disabled=!(state.els.front.length||state.els.back.length);
 $('addCart').textContent=$('addCart').disabled?'Add a design first':'Add to cart';
}

/* ---------- EXPORT: print file (transparent PNG) + mockup ---------- */
function drawEls(ctx,list,area,k){list.forEach(function(e){
 var src=e.type==='text'?textCanvas(e,Math.round(160*k)):(function(){var i=new Image();i.src=e.src;return i})();
 var w=e.size*area.w*k,h=w*e.ar;ctx.save();ctx.translate((area.x+e.x*area.w)*k,(area.y+e.y*area.h)*k);ctx.rotate(e.rot*Math.PI/180);
 ctx.drawImage(src,-w/2,-h/2,w,h);ctx.restore()})}
function exportSide(view,style,color){
 var list=state.els[view];if(!list.length)return null;var a=AREA[view],k=1800/a.w;
 var pf=document.createElement('canvas');pf.width=a.w*k;pf.height=a.h*k;
 drawEls(pf.getContext('2d'),list,{x:0,y:0,w:a.w,h:a.h},k);
 var mk=document.createElement('canvas');mk.width=600;mk.height=680;var mc=mk.getContext('2d');
 drawGarment(mc,style,find(COLORS,color).hex,view);drawEls(mc,list,a,1);
 return{file:pf.toDataURL('image/png'),mock:mk.toDataURL('image/png')}}
function shrink(d,max){return new Promise(function(res){var i=new Image();i.onload=function(){var s=Math.min(1,max/i.width),c=document.createElement('canvas');
 c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/png'))};i.src=d})}

/* ---------- CART ---------- */
function saveCart(){try{localStorage.setItem('ct73cart',JSON.stringify(cart))}catch(e){toast('Cart is too big to save if you leave the page')}}
async function addToCart(){
 await document.fonts.ready;
 var f=exportSide('front',state.style,state.color),b=exportSide('back',state.style,state.color);
 var texts=[].concat(state.els.front,state.els.back).filter(function(e){return e.type==='text'}).map(function(e){return '"'+e.text+'" ('+e.font+')'});
 var item={id:Date.now(),style:state.style,styleName:find(STYLES,state.style).name,color:state.color,colorName:find(COLORS,state.color).name,
  size:state.size,qty:state.qty,front:!!f,back:!!b,unit:unitPrice(),
  summary:'Print: '+(f&&b?'front + back':f?'front':'back')+(texts.length?'. Text: '+texts.join(', '):''),
  files:{front:f&&f.file,back:b&&b.file},mockups:{front:f&&await shrink(f.mock,500),back:b&&await shrink(b.mock,500)},thumb:await shrink((f||b).mock,160)};
 cart.push(item);saveCart();renderCart();openCart();toast('Added to cart')}
function itemTotal(i){return i.unit*i.qty*(1-disc(i.qty))}
function renderCart(){
 $('cartCount').textContent=cart.reduce(function(s,i){return s+i.qty},0);
 $('cartItems').innerHTML=cart.length?cart.map(function(i){return '<div class="ci"><img src="'+i.thumb+'" alt=""><div><b>'+i.styleName+'</b><br>'+i.colorName+', '+i.size.toUpperCase()+' &times; '+i.qty+
  '<br>'+i.summary+'<br><b>$'+itemTotal(i).toFixed(2)+'</b><br><button data-id="'+i.id+'">Remove</button></div></div>'}).join(''):'<p class="hint">Your cart is empty.</p>';
 $('cartTotal').textContent='$'+cart.reduce(function(s,i){return s+itemTotal(i)},0).toFixed(2);$('toCheckout').disabled=!cart.length}
function openCart(){$('overlay').classList.add('show');$('drawer').classList.add('show')}
function closeCart(){$('overlay').classList.remove('show');$('drawer').classList.remove('show')}
function toast(m){var t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove('show')},2500)}

/* ---------- CHECKOUT -> SQUARE ---------- */
async function submitOrder(ev){ev.preventDefault();var fd=new FormData($('coForm')),customer={};fd.forEach(function(v,k){customer[k]=String(v).trim()});
 $('payBtn').disabled=true;$('payBtn').textContent='Preparing secure checkout...';$('coMsg').textContent='';
 try{var r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({customer:customer,items:cart.map(function(i){return{style:i.style,styleName:i.styleName,colorName:i.colorName,size:i.size,qty:i.qty,front:i.front,back:i.back,summary:i.summary,files:i.files,mockups:i.mockups}})})});
  var d=await r.json();if(!r.ok||!d.url)throw new Error(d.error||'Checkout failed');location.href=d.url}
 catch(e){$('coMsg').textContent='Sorry, something went wrong: '+e.message+'. Please try again or email us.';$('payBtn').disabled=false;$('payBtn').textContent='Continue to secure payment'}}

/* ---------- INIT ---------- */
function setView(v){state.view=v;state.sel=null;$('vFront').classList.toggle('active',v==='front');$('vBack').classList.toggle('active',v==='back');syncPanels();update();renderEls()}
function editSel(fn){var e=selEl();if(!e)return;fn(e);renderEls();update()}
function init(){
 build();update();renderEls();renderCart();syncPanels();
 document.querySelectorAll('.tabs button').forEach(function(b){b.addEventListener('click',function(){
  document.querySelectorAll('.tabs button').forEach(function(x){x.classList.toggle('active',x===b)});
  document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('hidden',t.id!=='tab-'+b.getAttribute('data-tab'))})})});
 $('qMinus').onclick=function(){state.qty=Math.max(1,state.qty-1);$('qty').value=state.qty;update()};
 $('qPlus').onclick=function(){state.qty=Math.min(500,state.qty+1);$('qty').value=state.qty;update()};
 $('qty').oninput=function(){state.qty=Math.max(1,Math.min(500,parseInt(this.value)||1));update()};
 $('addText').onclick=function(){var t=$('textInput').value.trim()||'Your Name';
  addEl({type:'text',text:t,font:$('fontSel').value||'Anton',color:state.color==='white'||state.color==='sand'||state.color==='pink'?'#111111':'#ffffff',stroke:'#000000',strokeW:0,curve:0,bold:false,italic:false,size:.7});
  document.fonts.load('400 40px "'+selEl().font+'"').then(renderEls)};
 $('textInput').oninput=function(){var v=this.value;editSel(function(e){if(e.type==='text'&&v)e.text=v})};
 $('fontSel').onchange=function(){var f=this.value;document.fonts.load('400 40px "'+f+'"').then(function(){editSel(function(e){e.font=f})})};
 $('textColors').onclick=function(ev){var b=ev.target.closest('[data-v]');if(b)editSel(function(e){e.color=b.getAttribute('data-v')})};
 $('strokeColor').oninput=function(){var v=this.value;editSel(function(e){e.stroke=v})};
 $('strokeW').oninput=function(){var v=+this.value;editSel(function(e){e.strokeW=v})};
 $('curve').oninput=function(){var v=+this.value;editSel(function(e){e.curve=v})};
 $('boldBtn').onclick=function(){editSel(function(e){e.bold=!e.bold})};$('italicBtn').onclick=function(){editSel(function(e){e.italic=!e.italic})};
 $('clipGrid').onclick=function(ev){var b=ev.target.closest('button');if(!b)return;
  addEl({type:'text',text:b.textContent,font:'Inter',color:'#e8483c',stroke:'#000000',strokeW:0,curve:0,bold:false,italic:false,size:.35})};
 var dz=$('drop'),fi=$('fileIn');dz.onclick=function(){fi.click()};dz.onkeydown=function(e){if(e.key==='Enter')fi.click()};
 fi.onchange=function(){if(fi.files[0])handleFile(fi.files[0]);fi.value=''};
 ['dragover','dragenter'].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.add('drag')})});
 ['dragleave','drop'].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.remove('drag')})});
 dz.addEventListener('drop',function(e){var f=e.dataTransfer.files[0];if(f)handleFile(f)});
 $('sizeRange').oninput=function(){var v=+this.value/100;editSel(function(e){e.size=v})};
 $('rotRange').oninput=function(){var v=+this.value;editSel(function(e){e.rot=v})};
 $('centerBtn').onclick=function(){snapshot();editSel(function(e){e.x=.5})};
 $('delBtn').onclick=function(){snapshot();state.els[state.view]=els().filter(function(e){return e.id!==state.sel});state.sel=null;syncPanels();renderEls();update()};
 $('dupBtn').onclick=function(){var e=selEl();if(!e)return;var c=JSON.parse(JSON.stringify(e));c.x=Math.min(1,c.x+.05);c.y=Math.min(1,c.y+.05);addEl(c)};
 $('fwdBtn').onclick=function(){var a=els(),i=a.indexOf(selEl());if(i>-1&&i<a.length-1){snapshot();a.splice(i+1,0,a.splice(i,1)[0]);renderEls()}};
 $('backBtn2').onclick=function(){var a=els(),i=a.indexOf(selEl());if(i>0){snapshot();a.splice(i-1,0,a.splice(i,1)[0]);renderEls()}};
 $('undoBtn').onclick=function(){if(history.length){future.push(JSON.stringify(state.els));restore(history.pop())}};
 $('redoBtn').onclick=function(){if(future.length){history.push(JSON.stringify(state.els));restore(future.pop())}};
 document.addEventListener('keydown',function(e){if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
  if((e.key==='Delete'||e.key==='Backspace')&&state.sel)$('delBtn').onclick();
  if((e.ctrlKey||e.metaKey)&&e.key==='z')$('undoBtn').onclick()});
 $('stage').addEventListener('pointerdown',function(e){if(e.target.id==='shirtCanvas'||e.target.id==='stage'||e.target.id==='printArea'){state.sel=null;renderEls();syncPanels()}});
 $('vFront').onclick=function(){setView('front')};$('vBack').onclick=function(){setView('back')};
 $('addCart').onclick=addToCart;$('cartOpen').onclick=openCart;$('cartClose').onclick=closeCart;$('overlay').onclick=closeCart;
 $('cartItems').onclick=function(ev){var id=ev.target.getAttribute('data-id');if(id){cart=cart.filter(function(i){return String(i.id)!==id});saveCart();renderCart()}};
 $('toCheckout').onclick=function(){if(cart.length){closeCart();$('checkout').classList.remove('hidden')}};
 $('coClose').onclick=function(){$('checkout').classList.add('hidden')};$('coForm').onsubmit=submitOrder;
 addEventListener('resize',renderEls);document.fonts.ready.then(renderEls);
}
document.addEventListener('DOMContentLoaded',init);
})();
