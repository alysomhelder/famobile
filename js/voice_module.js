document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => Array.from((ctx || document).querySelectorAll(s));


  const micBtn = $('#microphone-toggle'); 

  const contrastBtn = $('#contrast-toggle');
  if (!micBtn || !contrastBtn) return console.warn('voice_module: botões de microfone ou contraste não encontrados'); 

  const loginCard = $('#login-container');
  const db = $('#dashboard');

  const originalLogout = window.logout; 
  if (typeof originalLogout !== 'function') console.warn('voice_module: Função logout (do script.js) não encontrada no escopo global.');

  const voiceLogout = () => {
    localStorage.removeItem('loggedUser'); 
    localStorage.removeItem('high-contrast');
    window.speechSynthesis.cancel();

    if (db) db.style.display = 'none'; 
    if (loginCard) loginCard.style.display = 'flex'; 

    document.body.classList.remove('high-contrast');
    document.body.classList.remove('sidebar-toggled');
    
  };

  micBtn.title = 'Ativar/Desativar Reconhecimento de Voz';
  contrastBtn.title = 'Ativar/Desativar Alto Contraste e Leitor de Tela';

  const body = document.body;
  const disciplinaSelect = $('#disciplina-select');
  const contWrap = $('#disciplina-content-wrapper');

  let recognizing = false;
  let recognition = null;
  let pressTimer = null;
  let narration = (localStorage.getItem('high-contrast') === 'true');
  let listeningAnimationOn = false;

  function spk(t) {
    if (!t) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'pt-BR';
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.warn('speech error', e);
    }
  }

  const STOPWORDS = ["o","a","os","as","um","uma","por","favor","porfavor","ai","aí","pra","pra','para","me","minha","por gentileza","gentileza","por","que","pra", "man", "ei", "filhao", "filhão", "oh", "faz", "isso", "aquilo", "liga"];
  const AUTO_CORRECT = {
    "calenda rio":"calendario",
    "calend ario":"calendario",
    "l po o":"lpoo", "l po":"lpoo", "ele poo":"lpoo", "i h m":"ihm", "i hm":"ihm"
  };

  function normalize(str) {
    if (!str) return '';
    let t = String(str).toLowerCase();
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g,''); 
    for (const k in AUTO_CORRECT) if (t.includes(k)) t = t.replace(new RegExp(k, 'g'), AUTO_CORRECT[k]);
    t = t.replace(/[^a-z0-9\s]/g,' ');
    STOPWORDS.forEach(w => t = t.replace(new RegExp('\\b'+w+'\\b','g'),' '));
    t = t.replace(/\s+/g,' ').trim();
    return t;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    const matrix = Array.from({length: al + 1}, () => Array(bl + 1).fill(0));
    for (let i=0;i<=al;i++) matrix[i][0] = i;
    for (let j=0;j<=bl;j++) matrix[0][j] = j;
    for (let i=1;i<=al;i++){
      for (let j=1;j<=bl;j++){
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i-1][j]+1, matrix[i][j-1]+1, matrix[i-1][j-1]+cost);
      }
    }
    return matrix[al][bl];
  }

  function fuzzyEquals(a, b) {
    a = normalize(a);
    b = normalize(b);
    if (!a || !b) return false;
    if (a.includes(b) || b.includes(a)) return true;
    const d = levenshtein(a,b);
    return d <= Math.max(1, Math.floor(Math.min(a.length, b.length) * 0.28));
  }

  const readerHandles = new WeakMap();
  function getTextForNode(el) {
    if (!el) return '';
    if (el.classList && (el.classList.contains('mural-item') || el.classList.contains('task-item') || el.classList.contains('event-item'))) {
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
    return el?.getAttribute('aria-label') ?? el?.title ?? el?.textContent?.trim()?.replace(/\s\s+/g,' ') ?? '';
  }

  function setupLocalReader(enable) {
    const nodes = $$('a,button,input,select,[role="button"],.classmate-item,.delivery-item,.task-item,.event-item,.menu-toggle,.user-actions i, .mural-item');
    if (enable) {
      narration = true;
      nodes.forEach(n => {
        const t = getTextForNode(n) || '';
        const onm = () => spk(t);
        const onf = () => spk(t);
        const h = readerHandles.get(n);
        if (h) {
          n.removeEventListener('mouseover', h.onm);
          n.removeEventListener('focus', h.onf);
        }
        readerHandles.set(n, {onm, onf});
        n.addEventListener('mouseover', onm);
        n.addEventListener('focus', onf);
      });
    } else {
      narration = false;
      nodes.forEach(n => {
        const h = readerHandles.get(n);
        if (h) {
          n.removeEventListener('mouseover', h.onm);
          n.removeEventListener('focus', h.onf);
          readerHandles.delete(n);
        }
      });
      window.speechSynthesis.cancel();
    }
  }

  if (localStorage.getItem('high-contrast') === 'true') {
    narration = true;
    body.classList.add('high-contrast');
    setupLocalReader(true); 
  }


  function setListeningAnimation(on) {
    listeningAnimationOn = !!on;
    if (on) {
      micBtn.classList.add('mic-grow');
      micBtn.setAttribute('aria-pressed','true');
    } else {
      micBtn.classList.remove('mic-grow');
      micBtn.setAttribute('aria-pressed','false');
    }
  }

  function startRecognition() {
    if (recognizing) return;
    try {
      recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    } catch (e) {
      spk('Reconhecimento de voz não suportado neste navegador.');
      return;
    }
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      recognizing = true;
      setListeningAnimation(true);
      spk('Ouvindo...');
    };
    recognition.onresult = (evt) => {
      const transcript = evt.results[0][0].transcript;
      console.log('Reconhecido:', transcript);
      processCommand(transcript);
    };
    recognition.onerror = (e) => {
      console.warn('Speech error', e);
    };
    recognition.onend = () => {
      recognizing = false;
      setListeningAnimation(false);

    };

    try { recognition.start(); } catch (e) { console.warn(e); }
  }

  function stopRecognition() {
    if (!recognizing) return;
    try {
      recognition.stop();
    } catch (e) {}
    recognizing = false;
    setListeningAnimation(false);
  }


  function goToSection(section) {
    section = section || 'disciplina';
    const link = document.querySelector(`.nav-links a[data-section="${section}"]`);
    if (link) {
      link.click(); 
      spk(`Indo para ${link.textContent.trim()}`);
      return true;
    }
    return false;
  }

  function goToDisc(discKey) {
    if (!disciplinaSelect) return false;

    const option = Array.from(disciplinaSelect.options).find(o => normalize(o.textContent) === normalize(discKey) || normalize(o.value) === normalize(discKey));

    const byValue = disciplinaSelect.querySelector(`option[value="${discKey}"]`);
    
    let targetOption = byValue || option;
    
    if (!targetOption) {
        const optlist = Array.from(disciplinaSelect.options);
        let best = null; let bestScore = Infinity;
        const target = normalize(discKey);
        optlist.forEach(o => {
          const n = normalize(o.textContent);
          const d = levenshtein(n, target);
          if (d < bestScore) { bestScore = d; best = o; }
        });
        if (best && bestScore <= Math.max(2, Math.floor(best.textContent.length * 0.3))) {
            targetOption = best;
        }
    }
    
    if (targetOption) {
      disciplinaSelect.value = targetOption.value;
      disciplinaSelect.dispatchEvent(new Event('change', { bubbles: true }));
      spk(`Abrindo disciplina ${targetOption.textContent.trim()}`);
      return true;
    }
    
    return false;
  }

  function switchTab(tabName, discContainer = null) {
    const activeDisc = discContainer || document.querySelector('.disciplina-content.active') || contWrap.querySelector('.disciplina-content');
    if (!activeDisc) return false;

    let candidate = activeDisc.querySelector(`.disciplina-tabs a[data-tab="${tabName}"]`);
    if (!candidate) {
      candidate = Array.from(activeDisc.querySelectorAll('.disciplina-tabs a')).find(a => {
        const dt = a.getAttribute('data-tab') || '';
        return normalize(dt).includes(normalize(tabName)) || normalize(a.textContent).includes(normalize(tabName));
      });
    }
    if (!candidate) return false;

    const links = Array.from(activeDisc.querySelectorAll('.disciplina-tabs a'));
    links.forEach(x => { x.classList.remove('tab-active'); x.setAttribute('aria-selected','false'); });
    candidate.classList.add('tab-active');
    candidate.setAttribute('aria-selected','true');
    const tn = candidate.getAttribute('data-tab');
    activeDisc.querySelectorAll('[data-tab-content]').forEach(c => c.style.display = 'none');
    const tgt = activeDisc.querySelector(`[data-tab-content="${tn}"]`);
    if (tgt) tgt.style.display = tn.includes('mural') ? 'grid' : 'block';
    try { tgt?.scrollIntoView({behavior:'smooth', block:'start'}); } catch(e){}
    spk(`Abrindo ${candidate.textContent.trim()}`);
    return true;
  }

  const ACTION_PHRASES = [
    'abrir', 'ir para', 'ir', 'mostrar', 'entrar', 'abrir disciplina', 'abrir materia', 
    'abrir matéria', 'va para', 'va pra', 'me leva para', 'acessar', 'entra ali'
  ];

  const SECTIONS = {

    disciplina: [
        'inicio','início','home','principal','inicial','dashboard','disciplina',
        'matéria','materia','minha matéria','minha disciplina','meu inicio','tela inicial'
    ], 

    calendario: [
        'calendario','calendário','agenda','eventos','datas','data','compromissos',
        'meu calendario','minha agenda','agenda de eventos'
    ],
    'minhas-disciplinas': [
        'minhas disciplinas','grade','grade curricular','disciplinas','materias',
        'grade de materias','todas as disciplinas','aulas','meu curso','minhas materias'
    ], 
    comunicacao: [
        'comunicacao','comunicação','chat','forum','fórum','mensagens',
        'bate papo','falar com','chat geral'
    ],
    notificacoes: [
        'notificacoes','notificações','notificação','notificacao','avisos','alerta',
        'minhas notificacoes','ver notificacoes','notif'
    ],
    configuracoes: [
        'configuracoes','configurações','ajustes','preferencias','preferências','perfil',
        'minha conta','minhas configs','minhas preferencias'
    ]
  };

  const TAB_KEYWORDS = {
    mural: [
        'mural','avisos','recados','postagens','posts','postagem','feed',
        'ver posts','mural da disciplina'
    ],

    tarefas: [
        'tarefas','atividades','entregas','proximas tarefas','próximas tarefas','trabalhos',
        'minhas tarefas','ver tarefas','entregas futuras','atividades pendentes','prazos'
    ],
 
    materiais: [
        'materiais','slides','aulas','conteudo','conteúdo','materiais de aula','pdfs',
        'material didatico','apostila','material'
    ],

    notas: [
        'notas','boletim','avaliacoes','avaliações','nota','resultado','ver notas',
        'minhas notas','painel de notas','qual minha nota','avs'
    ],

    grupo: [
        'grupo','grupos','colaboracao','colaboração','equipe','trabalho em grupo',
        'meu grupo'
    ]
  };

  const DISC_KEYS = Array.from(document.querySelectorAll('#disciplina-select option')).map(o => ({value:o.value, text:o.textContent}));

  function findSectionFromText(text) {
      let bestMatch = null;
      let maxScore = 0; 
      const actionPattern = new RegExp(ACTION_PHRASES.join('|'), 'g');
      let cleanText = normalize(text).replace(actionPattern, '').trim(); 
      cleanText = normalize(cleanText); 

      for (const key in SECTIONS) {
          for (const variant of SECTIONS[key]) {
              const normalizedVariant = normalize(variant);
              
              if (cleanText.includes(normalizedVariant) && normalizedVariant.length > maxScore) {
                  maxScore = normalizedVariant.length;
                  bestMatch = key;
              }
              else if (fuzzyEquals(cleanText, normalizedVariant) && normalizedVariant.length > maxScore) {
                  maxScore = normalizedVariant.length;
                  bestMatch = key;
              }
          }
      }
      return bestMatch;
  }

  function findTabFromText(text) {
    for (const key in TAB_KEYWORDS) {
      for (const v of TAB_KEYWORDS[key]) {
        if (fuzzyEquals(text,v) || text.includes(v)) return key;
      }
    }
    return null;
  }

  function findDiscFromText(text) {

    const discAbbreviations = {
        'ihm': 'ihm', 'lpoo': 'lpoo', 'es': 'es', 'redes': 'redes-comp', 
        'so': 'so', 'direitos': 'dir-humanos', 'logica': 'logica-prog', 
        'bd': 'fund-bd', 'bd': 'tec-impl-bd', 'teste': 'teste-software', 
        'cloud': 'cloud', 'cyber': 'cyber', 'proj': 'proj-ext-redes' 
    };

    const normalizedText = normalize(text);
    for (const abbr in discAbbreviations) {
        if (normalizedText.includes(abbr)) {
            const foundDisc = discAbbreviations[abbr];
            const matchingOption = DISC_KEYS.find(o => o.value === foundDisc);
            if (matchingOption) return foundDisc;
        }
    }
    
    for (const o of DISC_KEYS) {
      if (fuzzyEquals(text, o.value) || fuzzyEquals(text, o.text) || normalizedText.includes(normalize(o.text))) return o.value;
    }
    
    const parts = normalizedText.split(' ');
    for (const p of parts) {
      const found = DISC_KEYS.find(o => normalize(o.value) === p || normalize(o.text).includes(p));
      if (found) return found.value;
    }
    
    return null;
  }


  function processCommand(original) {
    const input = normalize(original);
    const rawInput = original.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); 
    console.log('[voice] got:', original, '-> normalized:', input, '-> rawInput:', rawInput);

    if (!input) { spk('Não entendi. Repita, por favor.'); return; }
    if (/(sair da conta|fazer logoff|deslogar agora)/.test(rawInput)) {
        spk('Saindo da conta. Você retornará à tela de login.'); 
        voiceLogout(); 
        return; 
    }

    if (/(desativar contraste|desligar contraste|desativar acessibilidade|desligar leitor|parar narrador|desativar modo acessibilidade|desligar modo acessibilidade)/.test(rawInput)) {
      narration = false; localStorage.setItem('high-contrast','false'); body.classList.remove('high-contrast'); setupLocalReader(false); spk('Acessibilidade desativada. Leitor de tela parado.'); return;
    }

    if (/(ativar contraste|alto contraste|ativar acessibilidade|ativar leitor|ligar leitor|ativar narrador)/.test(rawInput)) {
      narration = true; localStorage.setItem('high-contrast','true'); body.classList.add('high-contrast'); setupLocalReader(true); spk('Acessibilidade ativada. Leitor de tela pronto.'); return;
    }

    if (/(ativar microfone|ligar microfone|iniciar microfone|abrir microfone)/.test(rawInput)) { startRecognition(); return; }
    if (/(desativar microfone|parar microfone|desligar microfone|fechar microfone)/.test(rawInput)) { stopRecognition(); return; }
    if (/(ativar modo claro|modo claro|tema claro|ligar modo claro)/.test(rawInput)) { body.classList.add('light-mode'); localStorage.setItem('theme','light-mode'); spk('Modo claro ativado'); return; }
    if (/(desativar modo claro|modo escuro|tema escuro|desligar modo claro)/.test(rawInput)) { body.classList.remove('light-mode'); localStorage.setItem('theme','dark-mode'); spk('Modo escuro ativado'); return; }

    if (/(abrir download|fazer download|baixar aplicativo|baixar app|download do app)/.test(rawInput)) {
      const downloadLink = document.querySelector('.download-button');
      if (downloadLink) {
        downloadLink.click();
        spk('Iniciando download do aplicativo na nova aba.');
        return;
      }
    }

    const sectionKey = findSectionFromText(original); 
    if (sectionKey) { goToSection(sectionKey); return; }

    let tab = findTabFromText(input); 
    let disc = findDiscFromText(original); 

    if (!disc) {
        const m = input.match(/\b(?:da|de|do|das|dos)\s+([a-z0-9\s\-]+)/);
        if (m && m[1]) disc = findDiscFromText(m[1].trim());
    }

    const actionMatch = new RegExp(ACTION_PHRASES.join('|'), 'i').test(original);
    if (disc && (actionMatch || !tab)) {
        const ok = goToDisc(disc);
        if (!ok) spk('Não localizei essa disciplina.');
        return;
    }

    if (disc && tab) {
      const ok = goToDisc(disc);
      setTimeout(() => {
        const success = switchTab(tab);
        if (!success) spk('A aba solicitada não existe nesta disciplina.');
      }, 100);
      return;
    }

    if (tab && !disc) {
      const success = switchTab(tab);
      if (!success) spk('Não encontrei a aba nessa disciplina atual.');
      return;
    }

    spk('Desculpe, não entendi o comando. Tente: abrir calendário, abrir notas da LPOO, sair da conta, ou ir para perfil.');
  }

  micBtn.addEventListener('click', () => {
    if (!recognizing) startRecognition();
    else stopRecognition();
  });

  contrastBtn.addEventListener('click', () => {
    narration = !narration;
    localStorage.setItem('high-contrast', narration ? 'true' : 'false');
    if (narration) { 
        body.classList.add('high-contrast'); 
        setupLocalReader(true); 
        spk('Acessibilidade ativada. Leitor de tela pronto.'); 
    }
    else { 
        body.classList.remove('high-contrast'); 
        setupLocalReader(false); 
        spk('Acessibilidade desativada. Leitor de tela parado.'); 
    }
  });


  window.__voiceModule = {
    startRecognition,
    stopRecognition,
    processCommand,
    setupLocalReader,
  };

});