document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

  const splash = $('#splashScreen');
  const loginCard = $('#login-container');
  const form = $('#login-form');
  const db = $('#dashboard');
  const err = $('#error-message');
  const body = document.body;
  const thT = $('#theme-toggle');
  
  const acT = $('#microphone-toggle'); 
  
  const menuT = $('#menu-toggle');
  const sidebar = $('#sidebar');
  const overlay = $('#sidebar-overlay');
  const profileIc = $('#profile-icon');
  const profileLink = $('.nav-links a[data-section="configuracoes"]');
  const noteIc = $('.user-actions i.bxs-bell');
  const noteLink = $('.nav-links a[data-section="notificacoes"]');
  const disciplinaSelect = $('#disciplina-select');
  const contWrap = $('#disciplina-content-wrapper');
  const speech = window.speechSynthesis;
  let narration = false; 

  const save = (k,v) => localStorage.setItem(k, v);
  const load = k => localStorage.getItem(k);

  const spk = txt => {
    if (!speech) return;
    speech.cancel();
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = 'pt-BR';
    speech.speak(u);
  };

  const setProfile = u => {
    const el = $('#account-status-display');
    if (el) el.innerHTML = `Conta Logada: <span style="font-weight:700;color:var(--primary-light)">${u.toUpperCase()}</span>`;
  };

  const logout = () => { 
    localStorage.removeItem('loggedUser'); 
    localStorage.removeItem('high-contrast');
    speech.cancel();
    location.reload(); 
  };

  $('#logout-btn')?.addEventListener('click', logout);

  const applyTheme = () => {
    const t = load('theme');
    if (t === 'light-mode') body.classList.add('light-mode'), thT.classList.replace('bxs-sun','bxs-moon');
    else body.classList.remove('light-mode'), thT.classList.replace('bxs-moon','bxs-sun');
    if (load('high-contrast') === 'true') body.classList.add('high-contrast');
  };
  applyTheme();


  thT?.addEventListener('click', () => {
    body.classList.toggle('light-mode');
    if (body.classList.contains('light-mode')) { thT.classList.replace('bxs-sun','bxs-moon'); save('theme','light-mode'); }
    else { thT.classList.replace('bxs-moon','bxs-sun'); save('theme','dark-mode'); }
  });


  function getText(el){
    if (el.classList.contains('mural-item') || el.classList.contains('task-item') || el.classList.contains('event-item')) {
      const title = el.querySelector('h3')?.textContent?.trim() || '';
      const detail = el.querySelector('p')?.textContent?.trim() || '';
      const meta = el.querySelector('.due-date-label')?.textContent?.trim() || el.querySelector('.status')?.textContent?.trim() || '';
      
      if (el.classList.contains('mural-item')) {
        const author = el.querySelector('.mural-header h3')?.textContent?.trim() || 'Postagem';
        const content = el.querySelector('p')?.textContent?.trim() || '';
        if (el.classList.contains('material-item')) return el.title; 
        return `${author} diz: ${content}`;
      }
      if (el.classList.contains('task-item')) return `${title}, ${detail}. Status: ${meta}`;
      if (el.classList.contains('event-item')) return `${title}. Detalhes: ${detail}`;
    }
    return el?.getAttribute('aria-label') ?? el?.title ?? el?.textContent?.trim()?.replace(/\s\s+/g,' ');
  }
  
  function setupReader(){
    console.warn("setupReader no script.js é obsoleto; use setupLocalReader no voice_module.js.");
  }

  function generateWeeklyProgressSummary(user) {
    const card = $('#progress-summary-card');
    const msg = $('#progress-message');
    const detail = $('#progress-detail');

    if (!card || !msg || !detail) return;
    
    const grades = {
      'ihm': [9.0, 5.0], 
      'redes-comp': [8.0, 7.9], 
      'so': [8.5, 9.3] 
    };
    
    let totalScore = 0;
    let totalExams = 0;
    for (const key in grades) {
      totalScore += grades[key].reduce((a, b) => a + b, 0);
      totalExams += grades[key].length;
    }
    const overallAverage = totalExams > 0 ? (totalScore / totalExams) : 8.0; 

    if (overallAverage >= 8.5) {
      msg.textContent = "Excelente! Seu progresso está acima da média!";
      detail.textContent = `Média atual de ${overallAverage.toFixed(2)}. Continue o foco em IHM para manter o ritmo.`;
      card.style.borderLeftColor = '#10b981'; 
    } else if (overallAverage >= 7.0) {
      msg.textContent = "Bom trabalho! Você está no caminho certo.";
      detail.textContent = `Média atual de ${overallAverage.toFixed(2)}. Fique atento aos prazos de LPOO.`;
      card.style.borderLeftColor = '#f59e0b'; 
    } else {
      msg.textContent = "Atenção: Procure apoio nas disciplinas mais desafiadoras.";
      detail.textContent = `Média atual de ${overallAverage.toFixed(2)}. Revise as matérias com urgência e fale com o monitor.`;
      card.style.borderLeftColor = '#ef4444'; 
    }

    card.style.display = 'block';
    
    if (narration) spk(`Resumo de Progresso: ${msg.textContent}. ${detail.textContent}`);
  }

  const hideEl = (el, delay = 1200) => el && (el.classList.add('splash-hidden'), setTimeout(()=>el.style.display='none', delay));
  const user = load('loggedUser');
  const splashDuration = 1500; 
  const transitionDelay = 1000; 


  if (user){
    setTimeout(() => {
      splash && splash.classList.add('splash-hidden'); 
      db && (db.style.display = 'flex'); 

      setProfile(user);
      
      const initialDisc = disciplinaSelect?.value || 'ihm';
      if (disciplinaSelect) disciplinaSelect.value = initialDisc;
      changeDisc(initialDisc);
      const init = document.querySelector('.nav-links a.sidebar-item-active');
      init && navSec(init.getAttribute('data-section'));
      generateWeeklyProgressSummary(user);
    }, splashDuration);
    
  } else {
    setTimeout(()=> {
      splash && splash.classList.add('splash-hidden');
    }, splashDuration);
    
    setTimeout(()=> {
      loginCard && (loginCard.style.display='flex');
      splash && (splash.style.display='none'); 
    }, splashDuration + transitionDelay);
  }

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const u = $('#username').value.trim();
    const p = $('#password').value.trim();
    if (u === 'aluno' && p === 'ihc') { 
      save('loggedUser', u);
      hideEl(splash, 100); 
      loginCard.style.display = 'none';
      db.style.display = 'flex';
      setProfile(u);
      setTimeout(()=> {
        const init = document.querySelector('.nav-links a.sidebar-item-active');
        init && navSec(init.getAttribute('data-section'));
        
        const initialDisc = disciplinaSelect?.value || 'ihm';
        if (disciplinaSelect) disciplinaSelect.value = initialDisc;
        changeDisc(initialDisc);
        generateWeeklyProgressSummary(u);
      }, 100);
    } else {
      err.style.display='block';
      err.textContent='Usuário ou senha inválidos.';
    }
  });

  function navSec(s){
    $$('[data-section-content]').forEach(c => { 
      c.style.display='none'; 
      c.classList.remove('active-section'); 
    });
    const target = document.querySelector(`[data-section-content="${s}"]`);
    if (target) { 
      target.style.display='block'; 
      target.classList.add('active-section'); 
    }
    $$('.nav-links a').forEach(a => a.classList.remove('sidebar-item-active'));
    document.querySelector(`.nav-links a[data-section="${s}"]`)?.classList.add('sidebar-item-active');
    if (window.innerWidth <= 768) body.classList.remove('sidebar-toggled');
  }

  $$('.nav-links a').forEach(a => 
    a.addEventListener('click', e => { 
      e.preventDefault(); 
      navSec(e.currentTarget.getAttribute('data-section')); 
    })
  );

  menuT?.addEventListener('click', () => {
    body.classList.toggle('sidebar-toggled');
    if (narration) spk(body.classList.contains('sidebar-toggled') ? 'Sidebar aberto' : 'Sidebar fechado');
  });
  overlay?.addEventListener('click', () => { 
    body.classList.remove('sidebar-toggled'); 
    if (narration) spk('Sidebar fechado'); 
  });

  profileIc && profileLink && profileIc.addEventListener('click', () => profileLink.click());
  noteIc && noteLink && noteIc.addEventListener('click', () => noteLink.click());

  function setupTabs(container){
    const links = $$('.disciplina-tabs a', container);
    
    let initialLink = container.querySelector('.disciplina-tabs a.tab-active');
    if (!initialLink && links.length > 0) {
      initialLink = links[0];
      initialLink.classList.add('tab-active');
      initialLink.setAttribute('aria-selected', 'true');
    }

    links.forEach(l => l.addEventListener('click', e => {
      e.preventDefault();
      links.forEach(x => { 
        x.classList.remove('tab-active'); 
        x.setAttribute('aria-selected','false'); 
      });
      e.currentTarget.classList.add('tab-active'); 
      e.currentTarget.setAttribute('aria-selected','true');
      const tn = e.currentTarget.getAttribute('data-tab');
      container.querySelectorAll('[data-tab-content]').forEach(c => c.style.display='none');
      const tgt = container.querySelector(`[data-tab-content="${tn}"]`);
      if (tgt) tgt.style.display = tn.includes('mural') ? 'grid' : 'block';
    }));
    
    if (initialLink) {
      const tn = initialLink.getAttribute('data-tab');
      container.querySelectorAll('[data-tab-content]').forEach(c => c.style.display='none');
      const tgt = container.querySelector(`[data-tab-content="${tn}"]`);
      if (tgt) tgt.style.display = tn.includes('mural') ? 'grid' : 'block';
    }
  }
  
  function changeDisc(name){
    contWrap.querySelectorAll('.disciplina-content').forEach(c=> { 
      c.style.display='none'; 
      c.classList.remove('active'); 
    });
    const t = contWrap.querySelector(`[data-disciplina="${name}"]`);
    if (t){ 
      t.style.display='block'; 
      t.classList.add('active'); 
      setupTabs(t); 
    }
  }

  disciplinaSelect?.addEventListener('change', e => changeDisc(e.target.value));

  const mock = {
    '25':[ 
      {title:'Aula Síncrona: Fundamentos de IHM', time:'Interface Homem Máquina - 19:30 às 21:00', type:'book', color:'blue'},
      {title:'Entrega do Trabalho 1', time:'Desenvolvimento Web - Prazo final', type:'edit', color:'red'},
      {title:'Reunião de Grupo', time:'Projeto de Usabilidade - 18:00', type:'group', color:'green'}
    ],
    '26':[ 
      {title:'Evento com Professor(a)', time:'Geral - 10:00', type:'message', color:'blue'} 
    ],
    '27':[ 
      {title:'Webinar: Tendências de UX', time:'Geral - 10:00', type:'book', color:'green'} 
    ],
    '28':[ 
      {title:'Próxima Aula de LPOO', time:'Linguagem de Programação O.O. - 20:00 às 21:30', type:'book', color:'blue'} 
    ]
  };

  function updEvents(day){
    const header = document.querySelector('.event-list-sidebar h2');
    const card = document.querySelector('.event-list-sidebar');
    card.querySelectorAll('.event-item').forEach(i=>i.remove());
    header && (header.textContent = `Eventos de ${day}/Out`);
    const evs = mock[day] || [];
    if (evs.length){
      evs.forEach(ev=>{
        let ic='bxs-book-bookmark';
        if (ev.type==='edit') ic='bxs-edit-alt';
        if (ev.type==='group') ic='bxs-group';
        if (ev.type==='message') ic='bxs-message-dots';
        card.insertAdjacentHTML('beforeend', 
          `<div class="event-item ${ev.color}-border" title="${ev.title}, ${ev.time}.">
            <i class='bx ${ic}'></i>
            <div><h3>${ev.title}</h3><p>${ev.time}</p></div>
           </div>`
        );
      });
    } else {
      card.insertAdjacentHTML('beforeend', 
        `<div class="event-item" style="border-left-color:var(--text-gray)">
          <i class='bx bx-check-square'></i>
          <div><h3>Dia livre de entregas!</h3><p>Aproveite para adiantar estudos.</p></div>
         </div>`
      );
    }
    card.style.padding='25px';
    card.style.border='1px solid rgba(255,255,255,0.05)';
    card.style.backgroundColor='var(--surface-dark)';
  }

  $$('.dates-grid').forEach(g => {
    g.addEventListener('click', e => {
      if (e.target.tagName !== 'SPAN') return;
      const day = e.target.textContent;
      g.querySelectorAll('span').forEach(s => s.classList.remove('selected-date'));
      if (!e.target.classList.contains('faded')){
        e.target.classList.add('selected-date');
        updEvents(day);
      }
    });
  });

  $$('.calendar-nav i').forEach(i => 
    i.addEventListener('click', e => {
      const title = document.querySelector('.calendar-nav h2');
      let [m, y] = title.textContent.split(' ');
      y = parseInt(y);
      const months = [
        'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
      ];
      let idx = months.indexOf(m);
      if (e.target.classList.contains('bx-chevron-right')) { 
        idx = (idx+1)%12; 
        if (idx===0) y++; 
      }
      else if (e.target.classList.contains('bx-chevron-left')) { 
        idx = (idx-1+12)%12; 
        if (idx===11) y--; 
      }
      title.textContent = `${months[idx]} ${y}`;
      document.querySelectorAll('.dates-grid span')
        .forEach(s => s.classList.remove('selected-date','today-date','event-date','blue-dot','red-dot','green-dot'));
      updEvents('...');
    })
  );

  updEvents('25');
  document.querySelector('.dates-grid .today-date')?.classList.add('selected-date');

  $$('.mural-item, .delivery-item, .classmate-item, .task-item, .event-item')
    .forEach(el => el.addEventListener('click', (ev) => {
      if (ev.target.closest('a.options-btn')) return;
      console.log('Item interativo clicado.');
    }));

});