(function(){
  var h=document.querySelector('.header'), solidAlways=h&&h.classList.contains('header--solid');
  function onScroll(){ if(h&&!solidAlways) h.classList.toggle('is-solid', window.scrollY>60); }
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();
  var mb=document.querySelector('.menu-btn'), nav=document.querySelector('.nav');
  if(mb&&nav) mb.addEventListener('click',function(){var o=nav.classList.toggle('open');document.body.classList.toggle('menu-open',o);mb.setAttribute('aria-expanded',String(o));mb.querySelector('b').textContent=o?'Close':'Menu';});
  document.querySelectorAll('[data-rail]').forEach(function(btn){btn.addEventListener('click',function(){var r=document.getElementById(btn.getAttribute('data-rail'));r.scrollBy({left:(btn.dataset.dir==='prev'?-1:1)*r.clientWidth*0.8,behavior:'smooth'});});});
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
    document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});} else document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('in');});
})();
