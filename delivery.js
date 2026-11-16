/* Pickup in store or USPS delivery at checkout. Works alongside app.js. */
(function(){"use strict";
var PICKUP_PLACE='2750 S Hamilton Rd, Columbus, OH 43232 (inside Saraga International Grocery)';
var $=function(i){return document.getElementById(i)};
var form,lastKey='',timer,rates=[];
function esc(s){return String(s==null?'':s).replace(/[<>&"]/g,function(c){return{'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]})}
function cartQty(){try{return(JSON.parse(localStorage.getItem('ct73cart'))||[]).reduce(function(s,i){return s+(+i.qty||0)},0)}catch(e){return 0}}
function shirtsTotal(){var t=$('cartTotal');return parseFloat(((t&&t.textContent)||'0').replace(/[^0-9.]/g,''))||0}
function field(n){return form.elements[n]}
function partsOf(el){if(!el||!el.tagName)return[];var l=el.closest('label');if(l&&form.contains(l))return[l];
 var a=[el],p=el.previousElementSibling;if(p&&p.tagName==='LABEL')a.push(p);return a}
function method(){var r=form.querySelector('input[name=delivery]:checked');return r?r.value:'pickup'}

function applyMethod(){
 var ship=method()==='ship';
 ['address','city','state','zip'].forEach(function(n){var el=field(n);if(!el||!el.tagName)return;
  if(el.dataset.req===undefined)el.dataset.req=el.required?'1':'0';
  el.required=ship&&(el.dataset.req==='1'||n==='address'||n==='zip');
  partsOf(el).forEach(function(w){w.style.display=ship?'':'none'})});
 var ph=field('phone');if(ph&&ph.tagName){if(ph.dataset.req===undefined)ph.dataset.req=ph.required?'1':'0';ph.required=!ship||ph.dataset.req==='1'}
 $('pickupInfo').style.display=ship?'none':'';
 $('shipBox').style.display=ship?'':'none';
 if(ship)loadRates(true);else showTotal()}

function loadRates(force){
 var zEl=field('zip'),z=((zEl&&zEl.value)||'').trim().slice(0,5),q=cartQty(),key=z+'|'+q;
 if(!/^\d{5}$/.test(z)){rates=[];lastKey='';$('shipOpts').innerHTML='<p class="hint">Type your ZIP code above to see USPS shipping prices.</p>';showTotal();return}
 if(!q){rates=[];$('shipOpts').innerHTML='<p class="hint">Your cart is empty.</p>';showTotal();return}
 if(key===lastKey&&!force)return;lastKey=key;
 $('shipOpts').innerHTML='<p class="hint">Getting USPS prices...</p>';
 fetch('/api/shipping',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({zip:z,qty:q})})
  .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Could not get shipping prices.');return d})})
  .then(function(d){if(key!==lastKey)return;rates=d.rates||[];renderRates()})
  .catch(function(e){if(key!==lastKey)return;lastKey='';rates=[];
   $('shipOpts').innerHTML='<p class="hint warn">'+esc(e.message)+' You can also call or text 220-204-0090.</p>';showTotal()})}

function renderRates(){
 var cheapest=rates.slice().sort(function(a,b){return a.price-b.price})[0];
 $('shipOpts').innerHTML=rates.map(function(r){
  return '<label class="dl-opt"><input type="radio" name="shipService" value="'+esc(r.id)+'"'+(r===cheapest?' checked':'')+'> '+
   '<span><b>'+esc(r.name)+'</b> - $'+r.price.toFixed(2)+'<small>'+esc(r.days)+'</small></span></label>'}).join('');
 showTotal()}

function showTotal(){
 var shirts=shirtsTotal(),ship=method()==='ship',sel=form.querySelector('input[name=shipService]:checked'),
  r=sel&&rates.filter(function(x){return x.id===sel.value})[0];
 $('shipTotal').innerHTML=!ship?'Pickup is free. Total: <b>$'+shirts.toFixed(2)+'</b>':
  r?'Shirts $'+shirts.toFixed(2)+' + shipping $'+r.price.toFixed(2)+' = <b>$'+(shirts+r.price).toFixed(2)+'</b>':'Shirts $'+shirts.toFixed(2)+' + shipping'}

function setup(){
 form=$('coForm');if(!form||$('shipBox'))return;
 var css=document.createElement('style');
 css.textContent='.delivery{margin:0 0 12px}.dl-title{font-weight:700;margin:0 0 6px}'+
  '.dl-opt{display:flex;gap:8px;align-items:flex-start;padding:10px;border:1px solid rgba(0,0,0,.15);border-radius:10px;margin:0 0 6px;cursor:pointer;font-weight:400}'+
  '.dl-opt small{display:block;opacity:.7;font-size:12px}.dl-opt input{margin-top:3px}'+
  '#shipBox{margin:10px 0}#shipTotal{margin:8px 0;font-size:15px}.hint.warn{color:#c8323a}';
 document.head.appendChild(css);
 var top=document.createElement('div');top.className='delivery';
 top.innerHTML='<p class="dl-title">How do you want to get your order?</p>'+
  '<label class="dl-opt"><input type="radio" name="delivery" value="pickup" checked> <span><b>Pick up in store</b> - free</span></label>'+
  '<label class="dl-opt"><input type="radio" name="delivery" value="ship"> <span><b>Ship it to me</b> - USPS</span></label>'+
  '<p class="hint" id="pickupInfo">Pick up at '+PICKUP_PLACE+'. We\'ll call or text you when your shirts are ready.</p>';
 form.insertBefore(top,form.firstChild);
 var bottom=document.createElement('div');
 bottom.innerHTML='<div id="shipBox" style="display:none"><p class="dl-title">USPS shipping</p><div id="shipOpts"></div></div><p id="shipTotal"></p>';
 var pay=$('payBtn');if(pay&&form.contains(pay))pay.parentNode.insertBefore(bottom,pay);else form.appendChild(bottom);
 form.addEventListener('change',function(ev){var n=ev.target.name;if(n==='delivery')applyMethod();else if(n==='shipService')showTotal()});
 var z=field('zip');if(z&&z.addEventListener)z.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(function(){if(method()==='ship')loadRates()},500)});
 var go=$('toCheckout');if(go)go.addEventListener('click',function(){setTimeout(function(){if(method()==='ship')loadRates(true);else showTotal()},0)});
 // don't send a shipped order until a shipping option is picked
 document.addEventListener('submit',function(ev){if(ev.target!==form)return;
  if(method()==='ship'&&!form.querySelector('input[name=shipService]:checked')){ev.preventDefault();ev.stopImmediatePropagation();
   var m=$('coMsg');if(m)m.textContent='Please pick a USPS shipping option first.'}},true);
 applyMethod()}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
