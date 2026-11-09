// Mesmo caminho da página (funciona na raiz e em /public), não só em /api na raiz do domínio.
const API = new URL('api', document.baseURI).pathname.replace(/\/$/, '');
const $ = (id) => document.getElementById(id);
const E = {
    token: localStorage.getItem('vago_token'),
    user: JSON.parse(localStorage.getItem('vago_user') || 'null'),
    favs: new Set(), r: null, aba: 'cardapio', mesaSel: null, feed: 'lista',
    geo: JSON.parse(localStorage.getItem('vago_geo') || 'null'),
};

const esc = (v) => { const d = document.createElement('div'); d.textContent = v ?? ''; return d.innerHTML; };
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (d) => String(d).slice(0, 10).split('-').reverse().join('/');
const cpfBR = (c) => {
    const d = String(c || '').replace(/\D/g, '');
    return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (c || 'Não informado');
};
const hoje = () => new Date().toISOString().slice(0, 10);
const val = (id) => $(id).value.trim();
const ehRestaurante = () => E.user?.tipo === 'restaurante';
const ehCliente = () => !!E.token && !ehRestaurante();
const horaCurta = (id) => { const v = $(id).value.trim(); return v ? v.slice(0, 5) : ''; };
const telaAtiva = (id) => $(id)?.classList.contains('ativa');

let toastTimer;
function toast(msg, erro = false) {
    const t = $('toast');
    t.textContent = msg; t.className = erro ? 'erro' : ''; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), erro ? 7000 : 3200);
}

const SEM_TOKEN = new Set(['/login', '/usuarios', '/cadastro/restaurante']);

function textoErro(res, dados, bruto) {
    let lista = [];
    if (dados && dados.errors && typeof dados.errors === 'object') {
        lista = Object.values(dados.errors).flatMap((item) => (Array.isArray(item) ? item : [item])).filter(Boolean);
    }
    const dito = String((lista[0] || dados?.erro || dados?.message || '')).trim();
    if (/sqlstate|no such column|unknown column|has no column/i.test(dito)) {
        return 'Não consegui gravar no banco. Rode php artisan migrate e tente de novo.';
    }
    if (dito && !/^server error$/i.test(dito)) return dito;
    const html = !bruto || bruto.trim().startsWith('<');
    if (html || res.status === 404) {
        return 'Não encontrei a API. Abra o VAGO com php artisan serve, em http://127.0.0.1:8000.';
    }
    if (res.status === 429) return 'Muitas tentativas. Espere um minuto e tente de novo.';
    if (res.status >= 500) return 'Erro no servidor. Se a conta não entrou, rode php artisan migrate.';
    return `Não foi possível concluir (${res.status}).`;
}

async function api(caminho, { method = 'GET', corpo } = {}) {
    const headers = { Accept: 'application/json' };
    if (corpo) headers['Content-Type'] = 'application/json';
    if (E.token && !SEM_TOKEN.has(caminho)) headers.Authorization = `Bearer ${E.token}`;
    let res;
    try {
        res = await fetch(API + caminho, { method, headers, body: corpo ? JSON.stringify(corpo) : undefined });
    } catch (e) {
        throw new Error('Não consegui falar com o servidor. Rode php artisan serve e abra http://127.0.0.1:8000.');
    }
    const bruto = await res.text();
    let dados = {};
    try { dados = bruto ? JSON.parse(bruto) : {}; } catch (e) { dados = {}; }
    if (!res.ok) {
        if (res.status === 401 && E.token && !SEM_TOKEN.has(caminho)) sair(false);
        throw new Error(textoErro(res, dados, bruto));
    }
    return dados;
}
// Executa uma ação e mostra o erro em toast, sem quebrar a tela.
async function tentar(fn) { try { await fn(); } catch (e) { toast(e.message, true); } }

// ---------- Tema ----------
function temaAtual() {
    return document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';
}
function aplicarTema(tema) {
    document.documentElement.dataset.tema = tema;
    localStorage.setItem('vago_tema', tema);
    const b = $('btn-tema');
    const escuro = tema === 'escuro';
    b.querySelector('.ico-lua').hidden = escuro;
    b.querySelector('.ico-sol').hidden = !escuro;
    b.setAttribute('aria-pressed', escuro);
    b.title = escuro ? 'Ativar modo claro' : 'Ativar modo escuro';
    b.setAttribute('aria-label', b.title);
}

// ---------- Navegação ----------
const PROTEGIDAS = new Set(['tela-favoritos', 'tela-reservas', 'tela-perfil', 'tela-avaliacoes', 'tela-fila', 'tela-cardapio']);
function navegarPara(id) {
    if (id === 'tela-feed' && ehRestaurante()) id = 'tela-cardapio';
    if (id === 'tela-mesas' && ehCliente()) id = 'tela-feed';
    if (id === 'tela-cardapio' && !ehRestaurante()) id = E.token ? 'tela-feed' : 'tela-login';
    if (PROTEGIDAS.has(id) && !E.token) id = 'tela-login';
    document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('ativa', t.id === id));
    const nav = id === 'tela-detalhe' ? (ehRestaurante() ? 'tela-cardapio' : 'tela-feed') : id;
    document.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('on', b.dataset.nav === nav));
    ({ 'tela-feed': () => carregarRestaurantes(),
       'tela-favoritos': carregarFavoritos, 'tela-reservas': carregarReservas,
       'tela-perfil': carregarPerfil, 'tela-promocoes': carregarPromocoes,
       'tela-avaliacoes': carregarAvaliacoes, 'tela-mesas': carregarMesas,
       'tela-cardapio': carregarCardapio,
       'tela-fila': carregarFila, 'tela-cadastro': prepararCadastroRestaurante })[id]?.();
    window.scrollTo(0, 0);
}

function iniciaisDe(nome) {
    return String(nome || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase() || '•';
}
function atualizarConta() {
    document.querySelectorAll('.logado').forEach((e) => (e.hidden = !E.token));
    document.querySelectorAll('.deslogado').forEach((e) => (e.hidden = !!E.token));
    document.querySelectorAll('.so-cliente').forEach((e) => (e.hidden = !ehCliente()));
    document.querySelectorAll('.so-restaurante').forEach((e) => (e.hidden = !ehRestaurante()));
    document.querySelectorAll('.nao-cliente').forEach((e) => (e.hidden = ehCliente()));
    document.querySelectorAll('.nao-restaurante').forEach((e) => (e.hidden = ehRestaurante()));
    const b = $('btn-perfil');
    const nome = E.user?.name || '';
    const tipo = $('tipo-conta');
    if (tipo) tipo.textContent = !E.token ? '' : (ehRestaurante() ? 'Restaurante' : 'Cliente');
    if (b) {
        b.title = nome ? `Perfil de ${nome}` : 'Perfil';
        b.setAttribute('aria-label', b.title);
    }
    const ini = $('perfil-iniciais');
    if (ini) ini.textContent = iniciaisDe(nome);
}

// ---------- Restaurantes ----------
const FOTOS = {
    Italiana: 'img/massas.jpg',
    Pizzaria: 'img/massas.jpg',
    Japonesa: 'img/oriental.jpg',
    'Árabe': 'img/oriental.jpg',
    Brasileira: 'img/brasa.jpg',
    Hamburgueria: 'img/brasa.jpg',
    Mexicana: 'img/brasa.jpg',
};
const fotoDe = (r) => FOTOS[r.categoria] || 'img/hero.jpg';
function card(r, pos) {
    const nota = notaTxt(r.avaliacoes_avg_nota, r.avaliacoes_count);
    return `<article class="card">
        <div class="card-foto" style="background-image:url('${fotoDe(r)}')">
            ${ehCliente() ? `<button class="fav ${E.favs.has(r.id) ? 'on' : ''}" data-fav="${r.id}" title="Favoritar">♥</button>` : ''}
            <span class="selo">${esc(r.categoria || 'Geral')}</span>
        </div>
        <h3>${pos ? pos + 'º ' : ''}${esc(r.nome)}</h3>
        <p>${esc(r.endereco)}${r.distancia_km != null ? ` · ${fmtKm(r.distancia_km)}` : ''}</p>
        ${r.descricao ? `<p>${esc(r.descricao)}</p>` : ''}
        <div class="nota">${nota}</div>
        <button class="primario" data-abrir="${r.id}">Ver detalhes</button>
    </article>`;
}
const vazio = (msg) => `<p class="mut">${msg}</p>`;
const htmlResposta = (x) => x.resposta
    ? `<div class="resposta"><strong>Resposta do restaurante</strong><p>${esc(x.resposta)}</p>${x.respondida_em ? `<span class="mut">${dataBR(x.respondida_em)}</span>` : ''}</div>`
    : '';
const MAPA_COLS = 6, MAPA_LINHAS = 5;
const htmlMapa = (mesas, dono) => {
    const byPos = {};
    mesas.forEach((m) => { if (m.pos_x != null && m.pos_y != null) byPos[`${m.pos_x},${m.pos_y}`] = m; });
    const cols = Math.max(MAPA_COLS, ...mesas.map((m) => (m.pos_x ?? -1) + 1), 0);
    const linhas = Math.max(MAPA_LINHAS, ...mesas.map((m) => (m.pos_y ?? -1) + 1), 0);
    let cells = '';
    for (let y = 0; y < linhas; y++) {
        for (let x = 0; x < cols; x++) {
            const m = byPos[`${x},${y}`];
            cells += m
                ? `<button type="button" class="assento ${m.status}${E.mesaSel == m.id ? ' sel' : ''}" data-acao="mesa-sel" data-id="${m.id}" title="Mesa ${m.numero} · ${m.cadeiras} lugares · ${m.status}"><strong>${m.numero}</strong><small>${m.cadeiras} lug</small></button>`
                : (dono
                    ? `<button type="button" class="assento vazio" data-acao="mesa-vaga" data-x="${x}" data-y="${y}" title="Colocar mesa aqui">+</button>`
                    : `<span class="assento vazio"></span>`);
        }
    }
    const dica = dono
        ? 'Clique numa mesa para selecionar. Clique num espaço vazio para posicionar a nova (ou mover a selecionada).'
        : 'Clique numa mesa para escolhê-la na reserva.';
    return `<div class="salao"><div class="mapa-mesas" style="--cols:${cols}">${cells}</div>
        <p class="legenda-mapa"><span class="mesa livre">livre</span><span class="mesa reservada">reservada</span><span class="mesa ocupada">ocupada</span></p>
        <p class="mut">${dica}</p></div>`;
};
const queryMaps = (r) => (r.latitude != null && r.longitude != null) ? `${r.latitude},${r.longitude}` : (r.endereco || r.nome);
const urlMapsEmbed = (q) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&hl=pt-BR&output=embed`;
const urlMapsAbrir = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const htmlMaps = (r, iframeId) => {
    const q = queryMaps(r);
    return `<div class="mapa-ext">
        <iframe${iframeId ? ` id="${iframeId}"` : ''} title="Mapa de ${esc(r.nome)}" src="${urlMapsEmbed(q)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        <p><a href="${urlMapsAbrir(q)}" target="_blank" rel="noopener">Abrir ${esc(r.nome)} no Google Maps</a></p></div>`;
};
const htmlMapaFeed = (lista) => {
    if (!lista.length) return vazio('Nenhum restaurante encontrado.');
    const atual = lista.find((r) => r.id == E.mapaFoco) || lista[0];
    E.mapaFoco = atual.id;
    return `<div class="mapa-feed">${htmlMaps(atual, 'mapa-iframe')}<div class="lista">${lista.map((r) => `<div class="${r.id == atual.id ? 'on' : ''}">
        <strong>${esc(r.nome)}</strong>
        <p class="mut">${esc(r.endereco)}${r.distancia_km != null ? ` · ${fmtKm(r.distancia_km)}` : ''}</p>
        <div class="linha"><button class="mini" data-acao="mapa-foco" data-id="${r.id}" data-q="${esc(queryMaps(r))}" data-nome="${esc(r.nome)}">Ver no mapa</button>
        <button class="mini primario" data-abrir="${r.id}">Detalhes</button></div></div>`).join('')}</div></div>`;
};
const htmlPicos = (p) => {
    if (!p?.dias?.length) return '';
    const resumo = p.picos?.length
        ? `Dias de pico: ${p.picos.join(', ')}`
        : 'Ainda sem dias de pico — faltam reservas para calcular.';
    return `<div class="picos">${p.dias.map((d) =>
        `<span class="pico${d.pico ? ' on' : ''}" title="${d.reservas} reserva(s)">${esc(d.nome.slice(0, 3))}<small>${d.reservas}</small></span>`
    ).join('')}</div><p class="mut" style="margin-top:.45rem">${esc(resumo)}</p>`;
};

async function carregarRestaurantes(pagina = 1) {
    const c = $('lista-restaurantes');
    c.innerHTML = vazio('Carregando...');
    const p = new URLSearchParams({ page: pagina });
    if (val('busca-nome')) p.set('busca', val('busca-nome'));
    if ($('filtro-categoria').value) p.set('categoria', $('filtro-categoria').value);
    if ($('filtro-nota').value) p.set('nota_min', $('filtro-nota').value);
    if (E.geo) { p.set('lat', E.geo.lat); p.set('lng', E.geo.lng); }
    if (E.geo && $('filtro-raio').value) p.set('raio', $('filtro-raio').value);
    atualizarBtnLocal();
    await tentar(async () => {
        const r = await api('/restaurantes?' + p);
        const btn = $('btn-feed-mapa');
        if (btn) btn.textContent = E.feed === 'mapa' ? 'Lista' : 'Mapa';
        c.className = E.feed === 'mapa' ? '' : 'grid';
        c.innerHTML = E.feed === 'mapa'
            ? htmlMapaFeed(r.data)
            : (r.data.length ? r.data.map((x) => card(x)).join('') : vazio('Nenhum restaurante encontrado.'));
        $('paginacao').innerHTML = r.last_page > 1
            ? `<button data-pagina="${r.current_page - 1}" ${r.current_page <= 1 ? 'disabled' : ''}>←</button>
               <span class="mut">Página ${r.current_page} de ${r.last_page}</span>
               <button data-pagina="${r.current_page + 1}" ${r.current_page >= r.last_page ? 'disabled' : ''}>→</button>` : '';
    });
}
const fmtKm = (km) => Number(km) < 1
    ? `${Math.round(Number(km) * 1000)} m`
    : `${Number(km).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
function atualizarBtnLocal() {
    const b = $('btn-local');
    if (!b) return;
    b.textContent = E.geo ? 'Local ativo' : 'Perto de mim';
    b.classList.toggle('primario', !!E.geo);
}
function guardarGeo(geo) {
    E.geo = geo;
    geo ? localStorage.setItem('vago_geo', JSON.stringify(geo)) : localStorage.removeItem('vago_geo');
    atualizarBtnLocal();
}
function pedirLocal() {
    if (!navigator.geolocation) { toast('Seu navegador não informa a localização.', true); return; }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            guardarGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            toast('Filtrando a partir da sua localização');
            carregarRestaurantes();
        },
        () => toast('Não deu para obter sua localização. Permita o acesso no navegador.', true),
        { enableHighAccuracy: false, timeout: 8000 },
    );
}
function notaTxt(avg, n) {
    return avg ? `★ ${Number(avg).toFixed(1)} <span class="mut">(${n})</span>` : '<span class="mut">Sem avaliações</span>';
}
async function carregarFavoritos() {
    await tentar(async () => {
        const l = await api('/favoritos');
        E.favs = new Set(l.map((r) => r.id));
        $('lista-favoritos').innerHTML = l.length ? l.map((r) => card(r)).join('') : vazio('Você ainda não favoritou nenhum restaurante.');
    });
}
async function carregarCategorias() {
    try {
        const cs = await api('/restaurantes/categorias');
        const op = cs.map((c) => `<option>${esc(c)}</option>`).join('');
        $('filtro-categoria').innerHTML = '<option value="">Todas as categorias</option>' + op;
        $('cad-categoria').innerHTML = op;
    } catch (e) { /* o HTML já traz as opções */ }
}

// ---------- Detalhe do restaurante ----------
const ehDono = () => E.user && E.r && E.r.user_id === E.user.id;

async function abrirRestaurante(id, aba) {
    if (aba) E.aba = aba;
    navegarPara('tela-detalhe');
    await tentar(async () => {
        E.r = await api(`/restaurantes/${id}`);
        E.mesaSel = null;
        const voltar = $('btn-voltar-detalhe');
        if (voltar) {
            const varios = ehRestaurante() && E.variosSaloes;
            voltar.hidden = ehRestaurante() && !varios;
            voltar.dataset.tela = varios ? 'tela-cardapio' : 'tela-feed';
            voltar.textContent = varios ? '← Meus restaurantes' : '← Voltar aos restaurantes';
        }
        const r = E.r;
        $('detalhe-topo').innerHTML = `
            <span class="selo">${esc(r.categoria || 'Geral')}</span>
            <h2>${esc(r.nome)}</h2>
            <div class="info">
                <span>📍 <a href="${urlMapsAbrir(queryMaps(r))}" target="_blank" rel="noopener">${esc(r.endereco)}</a></span>
                ${r.telefone ? `<span>📞 ${esc(r.telefone)}</span>` : ''}
                <span>🪑 ${r.capacidade_mesas} mesas</span>
                <span>⏱ Tolerância de ${esc(String(r.tempo_tolerancia).slice(0, 5))}</span>
                <span class="nota">${r.avaliacoes_avg_nota ? '★ ' + Number(r.avaliacoes_avg_nota).toFixed(1) : 'Sem nota'}</span>
            </div>
            ${r.descricao ? `<p>${esc(r.descricao)}</p>` : ''}
            ${htmlPicos(r.picos)}
            ${ehCliente() ? `<button data-fav="${r.id}" class="fav-topo">${E.favs.has(r.id) ? '♥ Favorito' : '♡ Favoritar'}</button>` : ''}`;
        await mostrarAba(E.aba);
    });
}

async function mostrarAba(aba) {
    E.aba = aba;
    document.querySelectorAll('#abas button').forEach((b) => b.classList.toggle('on', b.dataset.aba === aba));
    const c = $('aba-conteudo'), id = E.r.id, dono = ehDono();
    c.innerHTML = vazio('Carregando...');
    await tentar(async () => { c.innerHTML = await ABAS[aba](id, dono); });
}

const PRATO_CATS = ['Entrada', 'Prato principal', 'Acompanhamento', 'Sobremesa', 'Bebida', 'Outro'];
const htmlAvaliacoesPrato = (p, dono) => {
    const lista = (p.avaliacoes || []).map((x) => `<div>
        <strong class="nota">${'★'.repeat(x.nota)}${'☆'.repeat(5 - x.nota)}</strong>
        <span class="mut"> por ${esc(x.user?.name || 'Anônimo')}</span>
        ${x.comentario ? `<p>${esc(x.comentario)}</p>` : ''}
        ${htmlResposta(x)}
        ${dono ? `<form data-acao="responder-prato" data-id="${x.id}">
            <label>${x.resposta ? 'Atualizar resposta' : 'Responder'} <textarea id="rpp-${x.id}" rows="2" required maxlength="2000">${esc(x.resposta || '')}</textarea></label>
            <button class="mini primario">${x.resposta ? 'Atualizar' : 'Responder'}</button></form>` : ''}
    </div>`).join('');
    return lista ? `<div class="avs-prato">${lista}</div>` : '';
};
const cardPrato = (p, dono) => `<div class="card">
    ${p.foto ? `<img src="${esc(p.foto)}" alt="" onerror="this.remove()">` : ''}
    <h3>${esc(p.nome)}</h3>
    ${p.descricao ? `<p>${esc(p.descricao)}</p>` : ''}
    <div class="preco">${brl(p.preco)}</div>
    <div class="nota">${notaTxt(p.avaliacoes_avg_nota, p.avaliacoes_count)}</div>
    ${dono ? `<form data-acao="editar-prato" data-id="${p.id}">
        <label>Nome <input name="nome" value="${esc(p.nome)}" required maxlength="255"></label>
        <label>Preço (R$) <input name="preco" type="number" step="0.01" min="0" value="${esc(p.preco)}" required></label>
        <label>Imagem <input name="foto" type="url" value="${esc(p.foto || '')}" placeholder="https://..." maxlength="500"></label>
        <button class="mini primario">Salvar prato</button>
    </form>` : ''}
    ${htmlAvaliacoesPrato(p, dono)}
    ${ehCliente() && !dono ? (p.minha_nota
        ? `<p class="mut">Você avaliou ★${p.minha_nota}</p>`
        : `<form data-acao="avaliar-prato" data-id="${p.id}">
            <div class="linha"><label>Nota <select id="ap-${p.id}">${[5, 4, 3, 2, 1].map((n) => `<option>${n}</option>`).join('')}</select></label>
            <button class="mini primario">Avaliar</button></div>
            <label>Comentário <textarea id="ac-${p.id}" rows="2" maxlength="2000"></textarea></label></form>`)         : ''}</div>`;

const formDono = (acao, titulo, campos) => `<div class="dono"><strong>👑 Área do dono · ${titulo}</strong>
    <form data-acao="${acao}">${campos}<button class="primario">Adicionar</button></form></div>`;
function camposPrato(prefixo) {
    const id = (nome) => prefixo + nome;
    return `<div class="linha">
        <label>Nome <input id="${id('p-nome')}" required maxlength="255"></label>
        <label>Preço (R$) <input id="${id('p-preco')}" type="number" step="0.01" min="0" required></label>
    </div>
    <label>Categoria <select id="${id('p-cat')}">${PRATO_CATS.map((c) => `<option${c === 'Prato principal' ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    <label>Descrição <textarea id="${id('p-desc')}" rows="2" maxlength="2000" placeholder="Ingredientes, porção..."></textarea></label>
    <label>URL da foto <input id="${id('p-foto')}" type="url" placeholder="https://..."></label>`;
}

function htmlCardapio(itens, dono) {
    const grupos = {};
    itens.forEach((p) => { (grupos[p.categoria || 'Outro'] ||= []).push(p); });
    const blocos = PRATO_CATS.filter((c) => grupos[c]).map((c, i) =>
        `<h3 style="margin-top:${i ? '1.2rem' : '0'}">${esc(c)}</h3><div class="grid">${grupos[c].map((p) => cardPrato(p, dono)).join('')}</div>`).join('');
    return itens.length ? blocos : vazio('O cardápio ainda está vazio.');
}

const ABAS = {
    async mapa() { return htmlMaps(E.r); },
    async cardapio(id, dono) {
        const itens = await api(`/restaurantes/${id}/cardapio`);
        return htmlCardapio(itens, dono)
            + (!E.token && itens.length ? vazio('Entre com uma conta de cliente para avaliar os pratos.') : '')
            + (ehRestaurante() && !dono && itens.length ? vazio('Para avaliar os pratos, use uma conta de cliente.') : '')
            + (dono ? formDono('add-prato', 'novo prato', camposPrato('')) : '');
    },

    async reservar(id, dono) {
        const mesas = await api(`/restaurantes/${id}/mesas`);
        const proximo = mesas.reduce((n, m) => Math.max(n, m.numero), 0) + 1;
        const cap = Number(E.r?.capacidade_mesas) || 0;
        const lotado = cap > 0 && mesas.length >= cap;
        let html = `<h3 style="margin-top:0">Mapa do salão</h3>`;
        if (dono) html += `<p class="mut">${cap > 0 ? `${mesas.length} de ${cap} mesas da capacidade.` : `${mesas.length} mesas no salão.`}${E.r?.cheio ? ' Salão cheio — a fila está aberta.' : ''}</p>`;
        html += htmlMapa(mesas, dono);
        html += mesas.length ? `<div class="lista">${mesas.map((m) => `<div>
                <span><strong>Mesa ${m.numero}</strong> · ${m.cadeiras} cadeiras</span>
                <span><span class="mesa ${m.status}">${m.status}</span>
                ${dono ? ['livre', 'ocupada', 'reservada'].filter((s) => s !== m.status).map((s) => `<button class="mini" data-acao="mesa-status" data-id="${m.id}" data-v="${s}">${s}</button>`).join(' ') : ''}
                ${dono ? `<form class="em-linha" data-acao="mesa-cadeiras" data-id="${m.id}"><input type="number" min="1" max="50" value="${m.cadeiras}" aria-label="Cadeiras da mesa ${m.numero}"><button class="mini">Cadeiras</button></form>` : ''}</span>
            </div>`).join('')}</div>` : vazio('Nenhuma mesa no mapa ainda.');

        if (ehCliente() && mesas.length) {
            html += `<h3>Reservar</h3><form data-acao="reservar">
            <label>Mesa <select id="r-mesa">${mesas.map((m) => `<option value="${m.id}"${E.mesaSel == m.id ? ' selected' : ''}>Mesa ${m.numero} (${m.cadeiras} lugares)</option>`).join('')}</select></label>
            <div class="linha"><label>Data <input id="r-data" type="date" min="${hoje()}" required></label>
            <label>Horário <input id="r-hora" type="time" required></label>
            <label>Pessoas <input id="r-pessoas" type="number" min="1" value="2" required></label></div>
            <button class="primario">Solicitar reserva</button></form>`;
        } else if (!E.token) {
            html += vazio('Entre com uma conta de cliente para reservar uma mesa.');
        } else if (ehRestaurante() && !dono) {
            html += vazio('Para reservar uma mesa, use uma conta de cliente.');
        }

        if (dono) {
            html += lotado
                ? vazio('A capacidade de mesas deste restaurante já foi atingida.')
                : formDono('add-mesa', 'nova mesa', `<div class="linha"><label>Número <input id="m-num" type="number" min="1" value="${proximo}" required></label><label>Cadeiras <input id="m-cad" type="number" min="1" value="4" required></label></div>
                <input type="hidden" id="m-x"><input type="hidden" id="m-y">
                <p class="mut" id="m-pos">Clique num espaço vazio do mapa para escolher o lugar — ou deixe o sistema posicionar.</p>`);
            const rs = await api(`/restaurantes/${id}/reservas`);
            html += `<h3>Reservas recebidas</h3><div class="lista">${rs.map((r) => `<div>
                <span><strong>${esc(r.user.name)}</strong> · Mesa ${r.mesa.numero} · ${dataBR(r.data)} ${String(r.horario).slice(0, 5)} · ${r.num_pessoas}p</span>
                <span><span class="mesa ${r.status_confirmacao}">${r.status_confirmacao}</span>
                ${r.status_confirmacao === 'pendente' ? `<button class="mini" data-acao="res-status" data-id="${r.id}" data-v="confirmada">Confirmar</button>
                <button class="mini" data-acao="res-status" data-id="${r.id}" data-v="recusada">Recusar</button>` : ''}</span></div>`).join('') || vazio('Nenhuma reserva ainda.')}</div>`;
        }
        return html;
    },

    async promocoes(id, dono) {
        const ps = await api(`/restaurantes/${id}/promocoes`);
        return `<div class="grid">${ps.map((p) => `<div class="card">
                ${p.banner_url ? `<img class="banner" src="${esc(p.banner_url)}" alt="" onerror="this.remove()">` : ''}
                <h3>🔥 ${esc(p.titulo)}</h3></div>`).join('')}</div>`
            + (ps.length ? '' : vazio('Nenhuma promoção no momento.'))
            + (dono ? formDono('add-promo', 'nova promoção', `<label>Título <input id="pr-titulo" required></label>
                <label>URL do banner <input id="pr-banner" type="url" placeholder="https://..."></label>`) : '');
    },

    async fila(id, dono) {
        const [f, info] = await Promise.all([api(`/restaurantes/${id}/fila`), api(`/restaurantes/${id}`)]);
        E.r = info;
        const naFila = E.user && f.some((x) => x.user_id === E.user.id);
        const lista = `<div class="lista">${f.map((x) => `<div><span><span class="pos">${x.posicao}</span> &nbsp;${esc(x.user.name)}</span>
                <span class="mut">entrou às ${String(x.hora_entrada).slice(0, 5)}</span></div>`).join('') || vazio('Ninguém na fila agora.')}</div>`;
        if (dono) {
            return lista + `<div class="linha" style="margin-top:1rem">${f.length ? '<button class="primario" data-acao="fila-chamar">Chamar próximo</button>' : ''}</div>
                <p class="mut">${info.cheio ? 'O salão está cheio. Os clientes podem entrar na fila.' : 'Enquanto houver mesa livre, a fila fica fechada e o cliente reserva.'}</p>`;
        }
        if (!E.token) return lista + vazio('Entre com uma conta de cliente. A fila abre quando o salão estiver cheio.');
        if (!ehCliente()) return lista + vazio('A fila é para contas de cliente.');
        if (naFila) return lista + '<div class="linha" style="margin-top:1rem"><button data-acao="fila-sair">Sair da fila</button></div>';
        if (!info.cheio) {
            const texto = info.mesas_count ? 'Ainda há mesa livre. Reserve em vez de entrar na fila.' : 'O restaurante ainda não publicou mesas. A fila abre quando o salão estiver cheio.';
            return lista + `<p class="mut">${texto}</p><button type="button" data-aba="reservar">Ver mesas</button>`;
        }
        return lista + '<div class="linha" style="margin-top:1rem"><button class="primario" data-acao="fila-entrar">Entrar na fila</button></div>';
    },

    async avaliacoes(id, dono) {
        const a = await api(`/restaurantes/${id}/avaliacoes`);
        return `<div class="lista">${a.data.map((x) => `<div style="display:block"><strong class="nota">${'★'.repeat(x.nota)}${'☆'.repeat(5 - x.nota)}</strong>
                <span class="mut"> por ${esc(x.user?.name || 'Anônimo')}</span>${x.comentario ? `<p>${esc(x.comentario)}</p>` : ''}
                ${htmlResposta(x)}
                ${dono ? `<form data-acao="responder" data-id="${x.id}">
                    <label>${x.resposta ? 'Atualizar resposta' : 'Responder'} <textarea id="rp-${x.id}" rows="2" required maxlength="2000">${esc(x.resposta || '')}</textarea></label>
                    <button class="primario">${x.resposta ? 'Atualizar resposta' : 'Publicar resposta'}</button></form>` : ''}</div>`).join('') || vazio('Ainda não há avaliações.')}</div>`
            + (ehCliente() && !dono ? `<h3>Avaliar o restaurante</h3><form data-acao="avaliar">
                <label>Nota <select id="av-nota">${[5, 4, 3, 2, 1].map((n) => `<option>${n}</option>`).join('')}</select></label>
                <label>Comentário <textarea id="av-com" rows="3"></textarea></label><button class="primario">Enviar avaliação</button></form>`
                : (!E.token ? vazio('Entre com uma conta de cliente para avaliar.') : (ehRestaurante() && !dono ? vazio('Para avaliar, use uma conta de cliente.') : '')));
    },
};

// ---------- Perfil ----------
function guardarUsuario(p) {
    E.user = { id: p.id, name: p.name, email: p.email, cpf: p.cpf, telefone: p.telefone, tipo: p.tipo || 'cliente' };
    localStorage.setItem('vago_user', JSON.stringify(E.user));
    atualizarConta();
}
function htmlCabecaPerfil(p, selo) {
    return `<div class="painel hero" style="margin-top:1rem">
            <span class="selo">${selo}</span>
            <h3 style="margin:.3rem 0 0">${esc(p.name)}</h3>
            <div class="info">
                <span>${esc(p.email)}</span>
                ${p.telefone ? `<span>📞 ${esc(p.telefone)}</span>` : ''}
                <span>No VAGO desde ${dataBR(p.created_at)}</span>
            </div>
            <button type="button" data-acao="sair">Sair da conta</button>
        </div>`;
}
function htmlFormDados(p) {
    return `<form data-acao="salvar-perfil" class="painel">
                <h3 style="margin-top:0">Seus dados</h3>
                <label>Nome completo <input id="pf-nome" required maxlength="255" value="${esc(p.name)}"></label>
                <label>E-mail <input id="pf-email" type="email" value="${esc(p.email)}" readonly></label>
                <label>CPF <input id="pf-cpf" value="${esc(cpfBR(p.cpf))}" readonly></label>
                <label>Telefone <input id="pf-tel" maxlength="30" value="${esc(p.telefone || '')}" placeholder="(00) 00000-0000"></label>
                <button class="primario">Salvar alterações</button>
            </form>`;
}
function htmlPerfil(p) {
    return p.tipo === 'restaurante' ? htmlPerfilRestaurante(p) : htmlPerfilCliente(p);
}
function htmlPerfilCliente(p) {
    const c = p.contagens || {};
    const avaliacoes = p.avaliacoes?.length
        ? `<div class="lista">${p.avaliacoes.map((a) => `<div style="display:block">
            <strong class="nota">${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)}</strong>
            <span class="mut"> em </span><button class="mini" data-abrir="${a.restaurante?.id}" data-aba="avaliacoes">${esc(a.restaurante?.nome || 'Restaurante')}</button>
            ${a.comentario ? `<p>${esc(a.comentario)}</p>` : ''}${htmlResposta(a)}</div>`).join('')}</div>`
        : vazio('Você ainda não avaliou nenhum restaurante.');
    const pratos = p.avaliacoes_pratos?.length
        ? `<div class="lista">${p.avaliacoes_pratos.map((a) => `<div style="display:block">
            <strong class="nota">${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)}</strong>
            <span class="mut">${esc(a.prato?.nome || 'Prato')} · ${esc(a.prato?.restaurante?.nome || '')}</span>
            ${a.comentario ? `<p>${esc(a.comentario)}</p>` : ''}</div>`).join('')}</div>`
        : vazio('Você ainda não avaliou um prato.');
    return `
        ${htmlCabecaPerfil(p, 'Cliente')}
        <div class="numeros">
            <button type="button" data-tela="tela-favoritos"><strong>${c.favoritos ?? 0}</strong><span>Favoritos</span></button>
            <button type="button" data-tela="tela-reservas"><strong>${c.reservas ?? 0}</strong><span>Reservas</span></button>
            <button type="button" data-tela="tela-avaliacoes"><strong>${c.avaliacoes ?? 0}</strong><span>Avaliações</span></button>
            <button type="button" data-tela="tela-fila"><strong>Fila</strong><span>Quando lotar</span></button>
        </div>
        <div class="duas">
            ${htmlFormDados(p)}
            <div class="painel">
                <h3 style="margin-top:0">Avaliações de restaurantes</h3>
                ${avaliacoes}
                <h3>Avaliações de pratos</h3>
                ${pratos}
            </div>
        </div>`;
}
function htmlPerfilRestaurante(p) {
    const c = p.contagens || {};
    const restaurantes = p.restaurantes?.length
        ? `<div class="lista">${p.restaurantes.map((r) => `<div>
            <span><strong>${esc(r.nome)}</strong> · ${esc(r.categoria || 'Geral')}</span>
            <span><button class="mini" data-abrir="${r.id}" data-aba="cardapio">Ver</button>
            <button class="mini primario" data-acao="abrir-cardapio" data-id="${r.id}">Meu restaurante</button>
            <button class="mini" data-acao="abrir-salao" data-id="${r.id}">Mesas</button></span></div>`).join('')}</div>`
        : vazio('Você ainda não cadastrou um restaurante.');
    return `
        ${htmlCabecaPerfil(p, 'Restaurante')}
        <div class="numeros">
            <button type="button" data-tela="tela-cardapio"><strong>Meu restaurante</strong><span>Pratos e notas</span></button>
            <button type="button" data-tela="tela-mesas"><strong>${c.restaurantes ?? 0}</strong><span>Salões</span></button>
            <button type="button" data-tela="tela-reservas"><strong>Reservas</strong><span>Recebidas</span></button>
            <button type="button" data-tela="tela-avaliacoes"><strong>Avaliações</strong><span>Do salão e dos pratos</span></button>
            <button type="button" data-tela="tela-fila"><strong>Fila</strong><span>Chamar próximo</span></button>
        </div>
        <div class="duas">
            ${htmlFormDados(p)}
            <div class="painel">
                <h3 style="margin-top:0">Seus restaurantes</h3>
                ${restaurantes}
                <button class="primario" data-tela="tela-cadastro" style="margin-top:1rem">Cadastrar outro restaurante</button>
            </div>
        </div>`;
}
async function carregarPerfil() {
    if (!E.token) { navegarPara('tela-login'); return; }
    const c = $('perfil-conteudo');
    c.innerHTML = vazio('Carregando...');
    await tentar(async () => {
        const p = await api('/perfil');
        guardarUsuario(p);
        c.innerHTML = htmlPerfil(p);
    });
}

// ---------- Páginas dos dois contextos ----------
function prepararCadastroRestaurante() {
    const conta = $('cad-conta');
    const aviso = $('cad-aviso-cliente');
    const form = document.querySelector('#tela-cadastro form');
    const cliente = E.user?.tipo === 'cliente';
    const donoLogado = ehRestaurante();
    if (conta) conta.hidden = donoLogado;
    if (aviso) aviso.hidden = !cliente;
    if (form) form.hidden = cliente;
    conta?.querySelectorAll('input').forEach((el) => { el.required = !donoLogado && !cliente; });
    const titulo = $('cad-titulo');
    if (titulo) titulo.textContent = donoLogado ? 'Novo restaurante' : 'Cadastrar restaurante';
}

async function carregarReservas() {
    const lead = $('lead-reservas');
    if (ehRestaurante()) {
        if (lead) lead.textContent = 'Pedidos que chegaram para o seu salão. Confirme ou recuse.';
        await tentar(async () => {
            const l = await api('/reservas-recebidas');
            $('lista-reservas').innerHTML = l.map((r) => `<div>
                <span><strong>${esc(r.user?.name || 'Cliente')}</strong>${r.user?.telefone ? ` · ${esc(r.user.telefone)}` : ''} · ${esc(r.mesa?.restaurante?.nome || '')} · Mesa ${r.mesa?.numero} (${r.mesa?.cadeiras || '?'} cadeiras) · ${dataBR(r.data)} ${String(r.horario).slice(0, 5)} · ${r.num_pessoas} pessoa(s)</span>
                <span><span class="mesa ${r.status_confirmacao}">${r.status_confirmacao}</span>
                ${r.status_confirmacao === 'pendente' ? `<button class="mini" data-acao="res-status" data-id="${r.id}" data-v="confirmada" data-origem="pagina">Confirmar</button>
                <button class="mini" data-acao="res-status" data-id="${r.id}" data-v="recusada" data-origem="pagina">Recusar</button>` : ''}</span></div>`).join('')
                || vazio('Nenhuma reserva recebida ainda.');
        });
        return;
    }
    if (lead) lead.textContent = 'As mesas que você pediu. O restaurante confirma ou recusa.';
    await tentar(async () => {
        const l = await api('/minhas-reservas');
        $('lista-reservas').innerHTML = l.map((r) => `<div>
            <span><strong>${esc(r.mesa.restaurante.nome)}</strong> · Mesa ${r.mesa.numero} · ${dataBR(r.data)} ${String(r.horario).slice(0, 5)} · ${r.num_pessoas} pessoa(s)</span>
            <span><span class="mesa ${r.status_confirmacao}">${r.status_confirmacao}</span>
            ${['pendente', 'confirmada'].includes(r.status_confirmacao) ? `<button class="mini" data-acao="res-status" data-id="${r.id}" data-v="cancelada" data-origem="pagina">Cancelar</button>` : ''}
            <button class="mini" data-abrir="${r.mesa.restaurante.id}">Ver salão</button></span></div>`).join('')
            || vazio('Você ainda não fez nenhuma reserva.');
    });
}

async function carregarPromocoes() {
    const c = $('lista-promocoes');
    c.innerHTML = vazio('Carregando...');
    await tentar(async () => {
        const ps = await api('/promocoes');
        let html = ps.length ? `<div class="grid">${ps.map((p) => `<article class="card">
            ${p.banner_url ? `<img class="banner" src="${esc(p.banner_url)}" alt="" onerror="this.remove()">` : ''}
            <h3>${esc(p.titulo)}</h3>
            <p>${esc(p.restaurante?.nome || '')}${p.restaurante?.categoria ? ` · ${esc(p.restaurante.categoria)}` : ''}</p>
            <button class="primario" data-abrir="${p.restaurante_id}" data-aba="promocoes">Ver no restaurante</button>
        </article>`).join('')}</div>` : vazio('Nenhuma promoção publicada ainda.');
        if (ehRestaurante()) {
            const perfil = await api('/perfil');
            const meus = perfil.restaurantes || [];
            html += meus.length
                ? `<div class="dono"><strong>Área do restaurante · publicar promoção</strong>
                    <form data-acao="add-promo-pagina">
                        ${meus.length > 1 ? `<label>Restaurante <select id="pg-pr-rest">${meus.map((r) => `<option value="${r.id}">${esc(r.nome)}</option>`).join('')}</select></label>` : `<input type="hidden" id="pg-pr-rest" value="${meus[0].id}">`}
                        <label>Título <input id="pg-pr-titulo" required maxlength="255"></label>
                        <label>URL do banner <input id="pg-pr-banner" type="url" placeholder="https://..."></label>
                        <button class="primario">Publicar promoção</button>
                    </form></div>`
                : vazio('Publique o restaurante para anunciar uma promoção.') + '<button class="primario" data-tela="tela-cadastro">Cadastrar restaurante</button>';
        }
        c.innerHTML = html;
    });
}

function htmlAvaliacoesFeitas(dados) {
    const restaurantes = (dados.restaurantes || []).map((a) => `<div style="display:block">
        <strong class="nota">${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)}</strong>
        <button class="mini" data-abrir="${a.restaurante?.id}" data-aba="avaliacoes">${esc(a.restaurante?.nome || 'Restaurante')}</button>
        ${a.comentario ? `<p>${esc(a.comentario)}</p>` : ''}${htmlResposta(a)}</div>`).join('');
    const pratos = (dados.pratos || []).map((a) => `<div style="display:block">
        <strong class="nota">${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)}</strong>
        <span class="mut">${esc(a.prato?.nome || 'Prato')} · ${esc(a.prato?.restaurante?.nome || '')}</span>
        ${a.comentario ? `<p>${esc(a.comentario)}</p>` : ''}${htmlResposta(a)}
        <button class="mini" data-abrir="${a.prato?.restaurante?.id || a.prato?.restaurante_id}" data-aba="cardapio">Ver cardápio</button></div>`).join('');
    return `<div class="duas">
        <div class="painel"><h3 style="margin-top:0">Restaurantes</h3><div class="lista">${restaurantes || vazio('Você ainda não avaliou um restaurante.')}</div></div>
        <div class="painel"><h3 style="margin-top:0">Pratos do cardápio</h3><div class="lista">${pratos || vazio('Você ainda não avaliou um prato.')}</div></div>
    </div>`;
}
function htmlAvaliacoesRecebidas(dados) {
    const bloco = (itens, prato) => itens.map((a) => `<div style="display:block">
        <strong class="nota">${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)}</strong>
        <span class="mut">${prato ? esc(a.prato?.nome || 'Prato') + ' · ' : ''}${esc(a.restaurante?.nome || a.prato?.restaurante?.nome || '')} · por ${esc(a.user?.name || 'Cliente')}</span>
        ${a.comentario ? `<p>${esc(a.comentario)}</p>` : ''}${htmlResposta(a)}
        <form data-acao="${prato ? 'responder-prato-pagina' : 'responder-pagina'}" data-id="${a.id}">
            <label>${a.resposta ? 'Atualizar resposta' : 'Responder'} <textarea rows="2" required maxlength="2000">${esc(a.resposta || '')}</textarea></label>
            <button class="primario">${a.resposta ? 'Atualizar resposta' : 'Publicar resposta'}</button>
        </form></div>`).join('');
    return `<div class="duas">
        <div class="painel"><h3 style="margin-top:0">Do restaurante</h3><div class="lista">${bloco(dados.restaurantes || [], false) || vazio('Ainda não há avaliações do salão.')}</div></div>
        <div class="painel"><h3 style="margin-top:0">Dos pratos</h3><div class="lista">${bloco(dados.pratos || [], true) || vazio('Ainda não há avaliações de pratos.')}</div></div>
    </div>`;
}
async function carregarAvaliacoes() {
    const c = $('lista-avaliacoes');
    const lead = $('lead-avaliacoes');
    c.innerHTML = vazio('Carregando...');
    await tentar(async () => {
        const dados = await api('/minhas-avaliacoes');
        if (dados.contexto === 'restaurante') {
            if (lead) lead.textContent = 'O que os clientes escreveram sobre o salão e sobre os pratos. Você pode responder.';
            c.innerHTML = htmlAvaliacoesRecebidas(dados);
            return;
        }
        if (lead) lead.textContent = 'Suas notas para os restaurantes e para os pratos do cardápio.';
        c.innerHTML = htmlAvaliacoesFeitas(dados);
    });
}

async function carregarCardapio() {
    if (!ehRestaurante()) { navegarPara(E.token ? 'tela-feed' : 'tela-login'); return; }
    const c = $('lista-cardapio');
    const lead = $('lead-cardapio');
    c.innerHTML = vazio('Carregando...');
    await tentar(async () => {
        const perfil = await api('/perfil');
        const meus = perfil.restaurantes || [];
        E.variosSaloes = meus.length > 1;
        if (!meus.length) {
            if (lead) lead.textContent = 'Publique o salão para cuidar do cardápio, das mesas, das promoções e da fila.';
            c.innerHTML = vazio('Você ainda não cadastrou um restaurante.') + '<button class="primario" data-tela="tela-cadastro">Cadastrar restaurante</button>';
            return;
        }
        if (meus.length === 1) {
            abrirRestaurante(meus[0].id, 'cardapio');
            return;
        }
        if (lead) lead.textContent = 'Escolha o salão. Dentro dele estão o cardápio, o mapa, as mesas, as promoções, a fila e as avaliações.';
        c.innerHTML = `<div class="lista">${meus.map((r) => `<div>
            <span><strong>${esc(r.nome)}</strong> · ${esc(r.categoria || 'Geral')}</span>
            <button class="mini primario" data-acao="abrir-cardapio" data-id="${r.id}">Abrir</button>
        </div>`).join('')}</div>`;
    });
}

async function carregarMesas() {
    if (ehRestaurante()) return carregarMesasDono();
    const lead = $('lead-mesas');
    if (lead) lead.textContent = 'Escolha um restaurante e veja quantas cadeiras cada mesa tem antes de reservar.';
    const c = $('lista-mesas');
    c.innerHTML = vazio('Carregando...');
    await tentar(async () => {
        const r = await api('/restaurantes');
        c.innerHTML = r.data.length ? `<div class="grid">${r.data.map((x) => {
            const livres = x.mesas_livres_count ?? 0;
            const total = x.mesas_count ?? 0;
            const estado = total === 0 ? 'Mesas ainda não publicadas' : (livres === 0 ? 'Salão cheio — fila aberta' : `${livres} de ${total} mesas livres`);
            return `<article class="card">
                <span class="selo">${esc(x.categoria || 'Geral')}</span>
                <h3>${esc(x.nome)}</h3>
                <p>${esc(x.endereco)}</p>
                <p>Capacidade prevista: ${x.capacidade_mesas ?? 0} mesas</p>
                <p>${estado}</p>
                <button class="primario" data-abrir="${x.id}" data-aba="reservar">Ver mesas</button>
            </article>`;
        }).join('')}</div>` : vazio('Nenhum restaurante por aqui.');
    });
}
async function carregarMesasDono() {
    const lead = $('lead-mesas');
    if (lead) lead.textContent = 'Cadastre cada mesa com o número e a quantidade de cadeiras. O limite é a capacidade do restaurante.';
    const c = $('lista-mesas');
    c.innerHTML = vazio('Carregando...');
    await tentar(async () => {
        const perfil = await api('/perfil');
        const meus = perfil.restaurantes || [];
        if (!meus.length) {
            c.innerHTML = vazio('Publique o restaurante para montar o salão.') + '<button class="primario" data-tela="tela-cadastro">Cadastrar restaurante</button>';
            return;
        }
        if (!E.salaoId || !meus.some((r) => r.id == E.salaoId)) E.salaoId = meus[0].id;
        const info = await api(`/restaurantes/${E.salaoId}`);
        E.r = info;
        const mesas = await api(`/restaurantes/${E.salaoId}/mesas`);
        const proximo = mesas.reduce((n, m) => Math.max(n, m.numero), 0) + 1;
        const cap = Number(info.capacidade_mesas) || 0;
        const lotado = cap > 0 && mesas.length >= cap;
        let html = meus.length > 1 ? `<label>Restaurante <select id="pg-salao">${meus.map((r) => `<option value="${r.id}"${r.id == E.salaoId ? ' selected' : ''}>${esc(r.nome)}</option>`).join('')}</select></label>` : `<p><strong>${esc(info.nome)}</strong></p>`;
        html += `<p class="mut">${cap > 0 ? `${mesas.length} de ${cap} mesas cadastradas.` : `${mesas.length} mesas cadastradas. A capacidade 0 não limita o salão.`}</p>`;
        html += htmlMapa(mesas, true);
        html += mesas.length ? `<div class="lista">${mesas.map((m) => `<div>
            <span><strong>Mesa ${m.numero}</strong> · ${m.cadeiras} cadeiras</span>
            <span><span class="mesa ${m.status}">${m.status}</span>
            ${['livre', 'ocupada', 'reservada'].filter((s) => s !== m.status).map((s) => `<button class="mini" data-acao="mesa-status" data-id="${m.id}" data-v="${s}">${s}</button>`).join(' ')}
            <form class="em-linha" data-acao="mesa-cadeiras" data-id="${m.id}"><input type="number" min="1" max="50" value="${m.cadeiras}" aria-label="Cadeiras da mesa ${m.numero}"><button class="mini">Salvar</button></form></span>
        </div>`).join('')}</div>` : vazio('Nenhuma mesa ainda. A primeira pode ser a mesa 1.');
        html += lotado
            ? vazio('A capacidade de mesas deste restaurante já foi atingida.')
            : formDono('add-mesa-pagina', 'nova mesa', `<div class="linha"><label>Número <input id="pg-m-num" type="number" min="1" value="${proximo}" required></label><label>Cadeiras <input id="pg-m-cad" type="number" min="1" value="4" required></label></div>
                <input type="hidden" id="pg-m-x"><input type="hidden" id="pg-m-y">
                <p class="mut" id="pg-m-pos">Clique num espaço vazio do mapa para escolher o lugar — ou deixe o sistema posicionar.</p>`);
        c.innerHTML = html;
    });
}

async function carregarFila() {
    const lead = $('lead-fila');
    const c = $('lista-fila');
    if (ehRestaurante()) {
        if (lead) lead.textContent = 'Quando o salão estiver cheio, os clientes entram aqui. Chame o próximo quando liberar uma mesa.';
        await tentar(async () => {
            const f = await api('/fila-recebida');
            c.innerHTML = f.length ? f.map((x) => `<div>
                <span><span class="pos">${x.posicao}</span> &nbsp;<strong>${esc(x.user?.name || '')}</strong> · ${esc(x.restaurante?.nome || '')}</span>
                <span><span class="mut">entrou às ${String(x.hora_entrada).slice(0, 5)}</span>
                ${x.posicao === 1 ? `<button class="mini primario" data-acao="fila-chamar" data-restaurante="${x.restaurante_id}">Chamar</button>` : ''}</span>
            </div>`).join('') : vazio('Ninguém esperando nos seus restaurantes.');
        });
        return;
    }
    if (lead) lead.textContent = 'A fila só abre quando não há mesa livre. Acompanhe sua posição aqui.';
    await tentar(async () => {
        const f = await api('/minha-fila');
        c.innerHTML = f.length ? f.map((x) => `<div>
            <span><span class="pos">${x.posicao}</span> &nbsp;<strong>${esc(x.restaurante?.nome || 'Restaurante')}</strong></span>
            <span><span class="mut">entrou às ${String(x.hora_entrada).slice(0, 5)}</span>
            <button class="mini" data-acao="fila-sair" data-restaurante="${x.restaurante_id}">Sair</button>
            <button class="mini primario" data-abrir="${x.restaurante_id}" data-aba="fila">Ver salão</button></span>
        </div>`).join('') : vazio('Você não está em nenhuma fila. Abra um restaurante cheio para entrar.');
    });
}

function atualizarSalas() {
    if (telaAtiva('tela-mesas')) return carregarMesas();
    return mostrarAba('reservar');
}
function atualizarFila() {
    if (telaAtiva('tela-fila')) return carregarFila();
    return mostrarAba('fila');
}
function atualizarReservas(origemPagina) {
    if (origemPagina || telaAtiva('tela-reservas')) return carregarReservas();
    return mostrarAba('reservar');
}

// ---------- Conta ----------
async function sair(chamar = true) {
    if (chamar && E.token) await api('/logout', { method: 'POST' }).catch(() => {});
    E.token = null; E.user = null; E.favs = new Set();
    localStorage.removeItem('vago_token'); localStorage.removeItem('vago_user');
    atualizarConta(); navegarPara('tela-inicio');
}

// ---------- Ações (cliques) ----------
const ACOES = {
    sair: () => sair(),
    buscar: () => carregarRestaurantes(),
    limpar: () => {
        $('busca-nome').value = ''; $('filtro-categoria').value = ''; $('filtro-nota').value = ''; $('filtro-raio').value = '';
        guardarGeo(null); carregarRestaurantes();
    },
    'usar-local': () => { E.geo ? (guardarGeo(null), carregarRestaurantes()) : pedirLocal(); },
    'ver-mapa': () => { E.feed = E.feed === 'mapa' ? 'lista' : 'mapa'; carregarRestaurantes(); },
    estilo(b) {
        $('busca-nome').value = '';
        $('filtro-nota').value = '';
        $('filtro-categoria').value = b.dataset.categoria || '';
        navegarPara('tela-feed');
    },
    'mapa-foco'(b) {
        E.mapaFoco = b.dataset.id;
        const frame = $('mapa-iframe'), q = b.dataset.q;
        if (frame && q) {
            frame.src = urlMapsEmbed(q);
            const a = frame.closest('.mapa-ext')?.querySelector('a');
            if (a) { a.href = urlMapsAbrir(q); a.textContent = `Abrir ${b.dataset.nome} no Google Maps`; }
        }
        document.querySelectorAll('.mapa-feed .lista > div').forEach((el) => el.classList.toggle('on', el.contains(b)));
    },
    'mesa-status': async (b) => { await api(`/mesas/${b.dataset.id}`, { method: 'PATCH', corpo: { status: b.dataset.v } }); atualizarSalas(); },
    'abrir-salao'(b) { E.salaoId = +b.dataset.id; navegarPara('tela-mesas'); },
    'abrir-cardapio'(b) { abrirRestaurante(b.dataset.id, 'cardapio'); },
    'mesa-sel'(b) {
        document.querySelectorAll('.assento.sel').forEach((el) => el.classList.remove('sel'));
        if (E.mesaSel == b.dataset.id) {
            E.mesaSel = null;
            toast('Mesa desmarcada');
            return;
        }
        E.mesaSel = b.dataset.id;
        b.classList.add('sel');
        if ($('r-mesa')) $('r-mesa').value = b.dataset.id;
        toast(`Mesa ${b.querySelector('strong')?.textContent || ''} selecionada`);
    },
    async 'mesa-vaga'(b) {
        const x = +b.dataset.x, y = +b.dataset.y;
        if (E.mesaSel && ehDono()) {
            await api(`/mesas/${E.mesaSel}`, { method: 'PATCH', corpo: { pos_x: x, pos_y: y } });
            toast('Mesa movida no mapa!');
            atualizarSalas();
            return;
        }
        [['m-x', 'm-y', 'm-pos'], ['pg-m-x', 'pg-m-y', 'pg-m-pos']].forEach(([ix, iy, ip]) => {
            if ($(ix)) { $(ix).value = x; $(iy).value = y; }
            if ($(ip)) $(ip).textContent = `Posição coluna ${x + 1}, fileira ${y + 1} escolhida.`;
        });
        toast('Posição escolhida para a nova mesa');
    },
    'res-status': async (b) => {
        await api(`/reservas/${b.dataset.id}`, { method: 'PATCH', corpo: { status_confirmacao: b.dataset.v } });
        atualizarReservas(b.dataset.origem === 'pagina');
    },
    'fila-entrar': async () => { await api(`/restaurantes/${E.r.id}/fila`, { method: 'POST' }); toast('Você entrou na fila!'); atualizarFila(); },
    'fila-sair': async (b) => { await api(`/restaurantes/${b?.dataset?.restaurante || E.r?.id}/fila`, { method: 'DELETE' }); atualizarFila(); },
    'fila-chamar': async (b) => {
        const c = await api(`/restaurantes/${b?.dataset?.restaurante || E.r?.id}/fila/chamar`, { method: 'POST' });
        toast(`Chamando ${c.user.name}!`);
        atualizarFila();
    },
    tema: () => aplicarTema(temaAtual() === 'escuro' ? 'claro' : 'escuro'),
};

async function alternarFavorito(id) {
    const { favorito } = await api(`/restaurantes/${id}/favorito`, { method: 'POST' });
    favorito ? E.favs.add(+id) : E.favs.delete(+id);
    document.querySelectorAll(`.fav[data-fav="${id}"]`).forEach((b) => b.classList.toggle('on', favorito));
    document.querySelectorAll(`.fav-topo[data-fav="${id}"]`).forEach((b) => (b.textContent = favorito ? '♥ Favorito' : '♡ Favoritar'));
}

document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tela],[data-acao],[data-aba],[data-abrir],[data-fav],[data-pagina]');
    if (!t || t.tagName === 'FORM') return;
    const d = t.dataset;
    if (d.tela) navegarPara(d.tela);
    else if (d.abrir) abrirRestaurante(d.abrir, d.aba);
    else if (d.aba) mostrarAba(d.aba);
    else if (d.fav) tentar(() => alternarFavorito(d.fav));
    else if (d.pagina) carregarRestaurantes(+d.pagina);
    else if (d.acao && ACOES[d.acao]) tentar(() => ACOES[d.acao](t));
});

function entrarCom(r) {
    const usuario = r?.usuario || r;
    if (!r?.token || !usuario?.name) return null;
    E.token = r.token;
    guardarUsuario(usuario);
    localStorage.setItem('vago_token', r.token);
    E.favs = new Set();
    return usuario;
}

// ---------- Formulários ----------
const FORMS = {
    async login(f) {
        const r = await api('/login', { method: 'POST', corpo: { email: val('login-email'), password: $('login-senha').value } });
        E.token = r.token; guardarUsuario(r.usuario);
        localStorage.setItem('vago_token', r.token);
        f.reset();
        E.favs = new Set();
        if (ehCliente()) E.favs = new Set((await api('/favoritos')).map((x) => x.id));
        toast(`Bem-vindo, ${r.usuario.name}!`);
        navegarPara(ehRestaurante() ? 'tela-mesas' : 'tela-feed');
    },
    async 'cad-usuario'(f) {
        const email = val('u-email');
        const password = $('u-senha').value;
        const cpf = val('u-cpf').replace(/\D/g, '');
        if (cpf && cpf.length !== 11) { toast('O CPF precisa ter 11 dígitos.', true); return; }
        const r = await api('/usuarios', { method: 'POST', corpo: {
            name: val('u-nome'), email, password,
            cpf: cpf || null, telefone: val('u-tel') || null } });
        const usuario = entrarCom(r) || entrarCom(await api('/login', { method: 'POST', corpo: { email, password } }));
        f.reset();
        toast(`Conta criada, ${usuario.name}!`);
        navegarPara('tela-perfil');
    },
    async 'cad-restaurante'(f) {
        if (E.user?.tipo === 'cliente') {
            toast('Saia da conta de cliente para cadastrar um restaurante.', true);
            return;
        }
        const restaurante = {
            nome: val('cad-nome'), categoria: $('cad-categoria').value, telefone: val('cad-telefone') || null,
            endereco: val('cad-endereco'), descricao: val('cad-descricao') || null,
            capacidade_mesas: +$('cad-capacidade').value || 0,
            tempo_tolerancia: horaCurta('cad-tolerancia') || '00:15',
        };
        if (E.token && ehRestaurante()) {
            await api('/restaurantes', { method: 'POST', corpo: restaurante });
            f.reset();
            toast('Restaurante cadastrado.');
            navegarPara('tela-mesas');
            return;
        }
        const email = val('cad-email');
        const password = $('cad-senha').value;
        const r = await api('/cadastro/restaurante', { method: 'POST', corpo: {
            name: val('cad-responsavel'), email, password, ...restaurante } });
        if (!entrarCom(r)) entrarCom(await api('/login', { method: 'POST', corpo: { email, password } }));
        f.reset();
        toast('Restaurante cadastrado. Agora você pode montar as mesas.');
        navegarPara('tela-mesas');
    },
    async 'add-prato'() {
        await api(`/restaurantes/${E.r.id}/cardapio`, { method: 'POST', corpo: {
            nome: val('p-nome'), preco: val('p-preco'), categoria: $('p-cat').value,
            descricao: val('p-desc') || null, foto: val('p-foto') || null } });
        toast('Prato adicionado ao cardápio.');
        mostrarAba('cardapio');
    },
    async 'editar-prato'(f) {
        const foto = f.querySelector('[name="foto"]').value.trim();
        await api(`/cardapios/${f.dataset.id}`, { method: 'PATCH', corpo: {
            nome: f.querySelector('[name="nome"]').value.trim(),
            preco: f.querySelector('[name="preco"]').value,
            foto: foto || null,
        } });
        toast('Prato atualizado.');
        mostrarAba('cardapio');
    },
    async 'add-prato-pagina'() {
        await api(`/restaurantes/${E.salaoId}/cardapio`, { method: 'POST', corpo: {
            nome: val('pg-p-nome'), preco: val('pg-p-preco'), categoria: $('pg-p-cat').value,
            descricao: val('pg-p-desc') || null, foto: val('pg-p-foto') || null } });
        toast('Prato adicionado ao cardápio.');
        carregarCardapio();
    },
    async 'add-promo'() {
        await api(`/restaurantes/${E.r.id}/promocoes`, { method: 'POST', corpo: { titulo: val('pr-titulo'), banner_url: val('pr-banner') || null } });
        mostrarAba('promocoes');
    },
    async 'add-mesa'() {
        const corpo = { numero: +val('m-num'), cadeiras: +val('m-cad') };
        if (val('m-x') !== '' && val('m-y') !== '') { corpo.pos_x = +val('m-x'); corpo.pos_y = +val('m-y'); }
        await api(`/restaurantes/${E.r.id}/mesas`, { method: 'POST', corpo });
        toast('Mesa adicionada.');
        atualizarSalas();
    },
    async 'add-mesa-pagina'() {
        const corpo = { numero: +val('pg-m-num'), cadeiras: +val('pg-m-cad') };
        if (val('pg-m-x') !== '' && val('pg-m-y') !== '') { corpo.pos_x = +val('pg-m-x'); corpo.pos_y = +val('pg-m-y'); }
        await api(`/restaurantes/${E.salaoId}/mesas`, { method: 'POST', corpo });
        toast('Mesa adicionada.');
        carregarMesas();
    },
    async 'mesa-cadeiras'(f) {
        const input = f.querySelector('input');
        await api(`/mesas/${f.dataset.id}`, { method: 'PATCH', corpo: { cadeiras: +input.value } });
        toast('Quantidade de cadeiras atualizada.');
        atualizarSalas();
    },
    async 'add-promo-pagina'() {
        await api(`/restaurantes/${$('pg-pr-rest').value}/promocoes`, { method: 'POST', corpo: { titulo: val('pg-pr-titulo'), banner_url: val('pg-pr-banner') || null } });
        toast('Promoção publicada.');
        carregarPromocoes();
    },
    async reservar() {
        await api(`/restaurantes/${E.r.id}/reservas`, { method: 'POST', corpo: {
            mesa_id: +$('r-mesa').value, data: $('r-data').value, horario: $('r-hora').value, num_pessoas: +$('r-pessoas').value } });
        toast('Reserva solicitada! Aguarde a confirmação do restaurante.'); mostrarAba('reservar');
    },
    async avaliar() {
        await api(`/restaurantes/${E.r.id}/avaliacoes`, { method: 'POST', corpo: { nota: +$('av-nota').value, comentario: val('av-com') } });
        toast('Avaliação enviada!'); abrirRestaurante(E.r.id);
    },
    async 'avaliar-prato'(f) {
        const id = f.dataset.id;
        await api(`/cardapios/${id}/avaliacoes`, { method: 'POST', corpo: { nota: +$(`ap-${id}`).value, comentario: val(`ac-${id}`) || null } });
        toast('Prato avaliado!'); mostrarAba('cardapio');
    },
    async 'responder-prato'(f) {
        const id = f.dataset.id;
        await api(`/avaliacoes-pratos/${id}/resposta`, { method: 'PUT', corpo: { resposta: val(`rpp-${id}`) } });
        toast('Resposta publicada!');
        if (telaAtiva('tela-cardapio')) return carregarCardapio();
        mostrarAba('cardapio');
    },
    async responder(f) {
        const id = f.dataset.id;
        await api(`/avaliacoes/${id}/resposta`, { method: 'PUT', corpo: { resposta: val(`rp-${id}`) } });
        toast('Resposta publicada!'); mostrarAba('avaliacoes');
    },
    async 'responder-pagina'(f) {
        await api(`/avaliacoes/${f.dataset.id}/resposta`, { method: 'PUT', corpo: { resposta: f.querySelector('textarea').value.trim() } });
        toast('Resposta publicada!');
        carregarAvaliacoes();
    },
    async 'responder-prato-pagina'(f) {
        await api(`/avaliacoes-pratos/${f.dataset.id}/resposta`, { method: 'PUT', corpo: { resposta: f.querySelector('textarea').value.trim() } });
        toast('Resposta publicada!');
        carregarAvaliacoes();
    },
    async 'salvar-perfil'() {
        const p = await api('/perfil', { method: 'PATCH', corpo: { name: val('pf-nome'), telefone: val('pf-tel') || null } });
        guardarUsuario(p);
        $('perfil-conteudo').innerHTML = htmlPerfil(p);
        toast('Perfil atualizado!');
    },
};
document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-acao]');
    if (!f || !FORMS[f.dataset.acao]) return;
    e.preventDefault();
    tentar(() => FORMS[f.dataset.acao](f));
});

$('busca-nome').addEventListener('keydown', (e) => e.key === 'Enter' && carregarRestaurantes());
$('filtro-categoria').addEventListener('change', () => carregarRestaurantes());
$('filtro-nota').addEventListener('change', () => carregarRestaurantes());
$('filtro-raio').addEventListener('change', () => {
    if ($('filtro-raio').value && !E.geo) { pedirLocal(); return; }
    carregarRestaurantes();
});
document.addEventListener('change', (e) => {
    if (e.target.id === 'pg-salao') { E.salaoId = +e.target.value; E.mesaSel = null; carregarMesas(); }
});

// ---------- Início ----------
aplicarTema(temaAtual());
atualizarConta();
carregarCategorias();
if (E.token) {
    api('/perfil').then((p) => {
        guardarUsuario(p);
        if (p.tipo === 'restaurante') return null;
        return api('/favoritos').then((l) => { E.favs = new Set(l.map((x) => x.id)); });
    }).catch(() => {});
}
