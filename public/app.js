const API = '/api';
const $ = (id) => document.getElementById(id);
const E = {
    token: localStorage.getItem('vago_token'),
    user: JSON.parse(localStorage.getItem('vago_user') || 'null'),
    favs: new Set(), r: null, aba: 'cardapio', rank: 'restaurantes', mesaSel: null, feed: 'lista',
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

let toastTimer;
function toast(msg, erro = false) {
    const t = $('toast');
    t.textContent = msg; t.className = erro ? 'erro' : ''; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

async function api(caminho, { method = 'GET', corpo } = {}) {
    const headers = { Accept: 'application/json' };
    if (corpo) headers['Content-Type'] = 'application/json';
    if (E.token) headers.Authorization = `Bearer ${E.token}`;
    const res = await fetch(API + caminho, { method, headers, body: corpo ? JSON.stringify(corpo) : undefined });
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) {
        if (res.status === 401 && E.token) sair(false);
        const primeiro = dados.errors ? Object.values(dados.errors)[0][0] : null;
        throw new Error(primeiro || dados.erro || dados.message || 'Erro na requisição.');
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
    b.textContent = escuro ? '☀ Claro' : '☾ Escuro';
    b.setAttribute('aria-pressed', escuro);
    b.title = escuro ? 'Ativar modo claro' : 'Ativar modo escuro';
}

// ---------- Navegação ----------
function navegarPara(id) {
    document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('ativa', t.id === id));
    ({ 'tela-feed': () => carregarRestaurantes(), 'tela-ranking': carregarRanking,
       'tela-favoritos': carregarFavoritos, 'tela-reservas': carregarMinhasReservas,
       'tela-perfil': carregarPerfil })[id]?.();
    window.scrollTo(0, 0);
}

function atualizarConta() {
    document.querySelectorAll('.logado').forEach((e) => (e.hidden = !E.token));
    document.querySelectorAll('.deslogado').forEach((e) => (e.hidden = !!E.token));
    const b = $('btn-perfil');
    if (b) b.textContent = E.user?.name ? E.user.name.split(' ')[0] : 'Perfil';
}

// ---------- Restaurantes ----------
function card(r, pos) {
    const nota = notaTxt(r.avaliacoes_avg_nota, r.avaliacoes_count);
    return `<div class="card">
        ${E.token ? `<button class="fav ${E.favs.has(r.id) ? 'on' : ''}" data-fav="${r.id}" title="Favoritar">♥</button>` : ''}
        <span class="selo">${esc(r.categoria || 'Geral')}</span>
        <h3>${pos ? pos + 'º ' : ''}${esc(r.nome)}</h3>
        <p>📍 ${esc(r.endereco)}${r.distancia_km != null ? ` · ${fmtKm(r.distancia_km)}` : ''}</p>
        ${r.descricao ? `<p>${esc(r.descricao)}</p>` : ''}
        <div class="nota">${nota}</div>
        <button class="primario" data-abrir="${r.id}">Ver detalhes</button>
    </div>`;
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
        if (btn) btn.textContent = E.feed === 'mapa' ? '☰ Lista' : '🗺 Mapa';
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
    b.textContent = E.geo ? '📍 Local ativo' : '📍 Perto de mim';
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
async function carregarRanking() {
    document.querySelectorAll('#abas-ranking button').forEach((b) => b.classList.toggle('on', b.dataset.rank === E.rank));
    if (E.rank === 'pratos') return carregarRankingPratos();
    await tentar(async () => {
        const l = await api('/restaurantes/ranking');
        $('lista-ranking').innerHTML = l.length ? l.map((r, i) => card(r, i + 1)).join('') : vazio('Nada por aqui ainda.');
    });
}
async function carregarRankingPratos() {
    await tentar(async () => {
        const l = await api('/pratos/ranking');
        $('lista-ranking').innerHTML = l.length ? l.map((p, i) => cardPratoRank(p, i + 1)).join('') : vazio('Ainda não há pratos avaliados.');
    });
}
async function carregarFavoritos() {
    await tentar(async () => {
        const l = await api('/favoritos');
        E.favs = new Set(l.map((r) => r.id));
        $('lista-favoritos').innerHTML = l.length ? l.map((r) => card(r)).join('') : vazio('Você ainda não favoritou nenhum restaurante.');
    });
}
async function carregarCategorias() {
    await tentar(async () => {
        const cs = await api('/restaurantes/categorias');
        const op = cs.map((c) => `<option>${esc(c)}</option>`).join('');
        $('filtro-categoria').innerHTML = '<option value="">Todas as categorias</option>' + op;
        $('cad-categoria').innerHTML = op;
    });
}

// ---------- Detalhe do restaurante ----------
const ehDono = () => E.user && E.r && E.r.user_id === E.user.id;

async function abrirRestaurante(id) {
    navegarPara('tela-detalhe');
    await tentar(async () => {
        E.r = await api(`/restaurantes/${id}`);
        E.mesaSel = null;
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
            ${E.token ? `<button data-fav="${r.id}" class="fav-topo">${E.favs.has(r.id) ? '♥ Favorito' : '♡ Favoritar'}</button>` : ''}`;
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
    ${htmlAvaliacoesPrato(p, dono)}
    ${E.token ? (p.minha_nota
        ? `<p class="mut">Você avaliou ★${p.minha_nota}</p>`
        : `<form data-acao="avaliar-prato" data-id="${p.id}">
            <div class="linha"><label>Nota <select id="ap-${p.id}">${[5, 4, 3, 2, 1].map((n) => `<option>${n}</option>`).join('')}</select></label>
            <button class="mini primario">Avaliar</button></div>
            <label>Comentário <textarea id="ac-${p.id}" rows="2" maxlength="2000"></textarea></label></form>`) : ''}</div>`;
const cardPratoRank = (p, pos) => `<div class="card">
    <span class="selo">${esc(p.categoria || 'Outro')}</span>
    <h3>${pos}º ${esc(p.nome)}</h3>
    <p>${esc(p.restaurante?.nome || '')}</p>
    ${p.descricao ? `<p>${esc(p.descricao)}</p>` : ''}
    <div class="preco">${brl(p.preco)}</div>
    <div class="nota">${notaTxt(p.avaliacoes_avg_nota, p.avaliacoes_count)}</div>
    <button class="primario" data-abrir="${p.restaurante_id}">Ver restaurante</button></div>`;

const formDono = (acao, titulo, campos) => `<div class="dono"><strong>👑 Área do dono · ${titulo}</strong>
    <form data-acao="${acao}">${campos}<button class="primario">Adicionar</button></form></div>`;

const ABAS = {
    async mapa() { return htmlMaps(E.r); },
    async cardapio(id, dono) {
        const itens = await api(`/restaurantes/${id}/cardapio`);
        const grupos = {};
        itens.forEach((p) => { (grupos[p.categoria || 'Outro'] ||= []).push(p); });
        const blocos = PRATO_CATS.filter((c) => grupos[c]).map((c, i) =>
            `<h3 style="margin-top:${i ? '1.2rem' : '0'}">${esc(c)}</h3><div class="grid">${grupos[c].map((p) => cardPrato(p, dono)).join('')}</div>`).join('');
        return (itens.length ? blocos : vazio('O cardápio ainda está vazio.'))
            + (dono ? formDono('add-prato', 'novo prato', `
                <div class="linha">
                    <label>Nome <input id="p-nome" required maxlength="255"></label>
                    <label>Preço (R$) <input id="p-preco" type="number" step="0.01" min="0" required></label>
                </div>
                <label>Categoria <select id="p-cat">${PRATO_CATS.map((c) => `<option${c === 'Prato principal' ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
                <label>Descrição <textarea id="p-desc" rows="2" maxlength="2000" placeholder="Ingredientes, porção..."></textarea></label>
                <label>URL da foto <input id="p-foto" type="url" placeholder="https://..."></label>`) : '');
    },

    async reservar(id, dono) {
        const mesas = await api(`/restaurantes/${id}/mesas`);
        const proximo = mesas.reduce((n, m) => Math.max(n, m.numero), 0) + 1;
        let html = `<h3 style="margin-top:0">Mapa do salão</h3>${htmlMapa(mesas, dono)}`;
        html += mesas.length ? `<div class="lista">${mesas.map((m) => `<div>
                <span><strong>Mesa ${m.numero}</strong> · ${m.cadeiras} cadeiras</span>
                <span><span class="mesa ${m.status}">${m.status}</span>
                ${dono ? ['livre', 'ocupada', 'reservada'].filter((s) => s !== m.status).map((s) => `<button class="mini" data-acao="mesa-status" data-id="${m.id}" data-v="${s}">${s}</button>`).join(' ') : ''}</span>
            </div>`).join('')}</div>` : vazio('Nenhuma mesa no mapa ainda.');

        html += E.token && mesas.length ? `<h3>Reservar</h3><form data-acao="reservar">
            <label>Mesa <select id="r-mesa">${mesas.map((m) => `<option value="${m.id}"${E.mesaSel == m.id ? ' selected' : ''}>Mesa ${m.numero} (${m.cadeiras} lugares)</option>`).join('')}</select></label>
            <div class="linha"><label>Data <input id="r-data" type="date" min="${hoje()}" required></label>
            <label>Horário <input id="r-hora" type="time" required></label>
            <label>Pessoas <input id="r-pessoas" type="number" min="1" value="2" required></label></div>
            <button class="primario">Solicitar reserva</button></form>`
            : (!E.token ? vazio('Entre na sua conta para reservar uma mesa.') : '');

        if (dono) {
            html += formDono('add-mesa', 'nova mesa', `<div class="linha"><label>Número <input id="m-num" type="number" min="1" value="${proximo}" required></label><label>Cadeiras <input id="m-cad" type="number" min="1" value="4" required></label></div>
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
        const f = await api(`/restaurantes/${id}/fila`);
        const naFila = E.user && f.some((x) => x.user_id === E.user.id);
        return `<div class="lista">${f.map((x) => `<div><span><span class="pos">${x.posicao}</span> &nbsp;${esc(x.user.name)}</span>
                <span class="mut">entrou às ${String(x.hora_entrada).slice(0, 5)}</span></div>`).join('') || vazio('Ninguém na fila agora.')}</div>
            <div class="linha" style="margin-top:1rem">
            ${E.token ? (naFila ? '<button data-acao="fila-sair">Sair da fila</button>' : '<button class="primario" data-acao="fila-entrar">Entrar na fila</button>') : vazio('Entre na sua conta para entrar na fila.')}
            ${dono && f.length ? '<button class="primario" data-acao="fila-chamar">Chamar próximo</button>' : ''}</div>`;
    },

    async avaliacoes(id, dono) {
        const a = await api(`/restaurantes/${id}/avaliacoes`);
        return `<div class="lista">${a.data.map((x) => `<div style="display:block"><strong class="nota">${'★'.repeat(x.nota)}${'☆'.repeat(5 - x.nota)}</strong>
                <span class="mut"> por ${esc(x.user?.name || 'Anônimo')}</span>${x.comentario ? `<p>${esc(x.comentario)}</p>` : ''}
                ${htmlResposta(x)}
                ${dono ? `<form data-acao="responder" data-id="${x.id}">
                    <label>${x.resposta ? 'Atualizar resposta' : 'Responder'} <textarea id="rp-${x.id}" rows="2" required maxlength="2000">${esc(x.resposta || '')}</textarea></label>
                    <button class="primario">${x.resposta ? 'Atualizar resposta' : 'Publicar resposta'}</button></form>` : ''}</div>`).join('') || vazio('Ainda não há avaliações.')}</div>`
            + (E.token ? `<h3>Avaliar</h3><form data-acao="avaliar">
                <label>Nota <select id="av-nota">${[5, 4, 3, 2, 1].map((n) => `<option>${n}</option>`).join('')}</select></label>
                <label>Comentário <textarea id="av-com" rows="3"></textarea></label><button class="primario">Enviar avaliação</button></form>` : vazio('Entre na sua conta para avaliar.'));
    },
};

// ---------- Perfil ----------
function guardarUsuario(p) {
    E.user = { id: p.id, name: p.name, email: p.email, cpf: p.cpf, telefone: p.telefone };
    localStorage.setItem('vago_user', JSON.stringify(E.user));
    atualizarConta();
}
function htmlPerfil(p) {
    const c = p.contagens || {};
    const restaurantes = p.restaurantes?.length
        ? `<div class="lista">${p.restaurantes.map((r) => `<div>
            <span><strong>${esc(r.nome)}</strong> · ${esc(r.categoria || 'Geral')}</span>
            <button class="mini primario" data-abrir="${r.id}">Ver</button></div>`).join('')}</div>`
        : vazio('Você ainda não cadastrou um restaurante.') + '<button class="primario" data-tela="tela-cadastro">Cadastrar restaurante</button>';
    const avaliacoes = p.avaliacoes?.length
        ? `<div class="lista">${p.avaliacoes.map((a) => `<div style="display:block">
            <strong class="nota">${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)}</strong>
            <span class="mut"> em </span><button class="mini" data-abrir="${a.restaurante?.id}">${esc(a.restaurante?.nome || 'Restaurante')}</button>
            ${a.comentario ? `<p>${esc(a.comentario)}</p>` : ''}${htmlResposta(a)}</div>`).join('')}</div>`
        : vazio('Você ainda não avaliou nenhum restaurante.');
    return `
        <div class="painel hero" style="margin-top:1rem">
            <span class="selo">Conta</span>
            <h3 style="margin:.3rem 0 0">${esc(p.name)}</h3>
            <div class="info">
                <span>${esc(p.email)}</span>
                ${p.telefone ? `<span>📞 ${esc(p.telefone)}</span>` : ''}
                <span>No VAGO desde ${dataBR(p.created_at)}</span>
            </div>
        </div>
        <div class="numeros">
            <button type="button" data-tela="tela-favoritos"><strong>${c.favoritos ?? 0}</strong><span>Favoritos</span></button>
            <button type="button" data-tela="tela-reservas"><strong>${c.reservas ?? 0}</strong><span>Reservas</span></button>
            <button type="button"><strong>${c.avaliacoes ?? 0}</strong><span>Avaliações</span></button>
            <button type="button"${c.restaurantes ? '' : ' data-tela="tela-cadastro"'}><strong>${c.restaurantes ?? 0}</strong><span>Restaurantes</span></button>
        </div>
        <div class="duas">
            <form data-acao="salvar-perfil" class="painel">
                <h3 style="margin-top:0">Seus dados</h3>
                <label>Nome completo <input id="pf-nome" required maxlength="255" value="${esc(p.name)}"></label>
                <label>E-mail <input id="pf-email" type="email" value="${esc(p.email)}" readonly></label>
                <label>CPF <input id="pf-cpf" value="${esc(cpfBR(p.cpf))}" readonly></label>
                <label>Telefone <input id="pf-tel" maxlength="30" value="${esc(p.telefone || '')}" placeholder="(00) 00000-0000"></label>
                <button class="primario">Salvar alterações</button>
            </form>
            <div class="painel">
                <h3 style="margin-top:0">Seus restaurantes</h3>
                ${restaurantes}
                <h3>Suas avaliações</h3>
                ${avaliacoes}
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

// ---------- Minhas reservas ----------
async function carregarMinhasReservas() {
    await tentar(async () => {
        const l = await api('/minhas-reservas');
        $('lista-reservas').innerHTML = l.map((r) => `<div>
            <span><strong>${esc(r.mesa.restaurante.nome)}</strong> · Mesa ${r.mesa.numero} · ${dataBR(r.data)} ${String(r.horario).slice(0, 5)} · ${r.num_pessoas} pessoa(s)</span>
            <span><span class="mesa ${r.status_confirmacao}">${r.status_confirmacao}</span>
            ${['pendente', 'confirmada'].includes(r.status_confirmacao) ? `<button class="mini" data-acao="res-status" data-id="${r.id}" data-v="cancelada" data-minhas="1">Cancelar</button>` : ''}</span></div>`).join('')
            || vazio('Você ainda não fez nenhuma reserva.');
    });
}

// ---------- Conta ----------
async function sair(chamar = true) {
    if (chamar && E.token) await api('/logout', { method: 'POST' }).catch(() => {});
    E.token = null; E.user = null; E.favs = new Set();
    localStorage.removeItem('vago_token'); localStorage.removeItem('vago_user');
    atualizarConta(); navegarPara('tela-feed');
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
    'mesa-status': async (b) => { await api(`/mesas/${b.dataset.id}`, { method: 'PATCH', corpo: { status: b.dataset.v } }); mostrarAba('reservar'); },
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
            mostrarAba('reservar');
            return;
        }
        if ($('m-x')) { $('m-x').value = x; $('m-y').value = y; }
        if ($('m-pos')) $('m-pos').textContent = `Posição coluna ${x + 1}, fileira ${y + 1} escolhida.`;
        toast('Posição escolhida para a nova mesa');
    },
    'res-status': async (b) => {
        await api(`/reservas/${b.dataset.id}`, { method: 'PATCH', corpo: { status_confirmacao: b.dataset.v } });
        b.dataset.minhas ? carregarMinhasReservas() : mostrarAba('reservar');
    },
    'fila-entrar': async () => { await api(`/restaurantes/${E.r.id}/fila`, { method: 'POST' }); toast('Você entrou na fila!'); mostrarAba('fila'); },
    'fila-sair': async () => { await api(`/restaurantes/${E.r.id}/fila`, { method: 'DELETE' }); mostrarAba('fila'); },
    'fila-chamar': async () => { const c = await api(`/restaurantes/${E.r.id}/fila/chamar`, { method: 'POST' }); toast(`Chamando ${c.user.name}!`); mostrarAba('fila'); },
    tema: () => aplicarTema(temaAtual() === 'escuro' ? 'claro' : 'escuro'),
};

async function alternarFavorito(id) {
    const { favorito } = await api(`/restaurantes/${id}/favorito`, { method: 'POST' });
    favorito ? E.favs.add(+id) : E.favs.delete(+id);
    document.querySelectorAll(`.fav[data-fav="${id}"]`).forEach((b) => b.classList.toggle('on', favorito));
    document.querySelectorAll(`.fav-topo[data-fav="${id}"]`).forEach((b) => (b.textContent = favorito ? '♥ Favorito' : '♡ Favoritar'));
}

document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tela],[data-acao],[data-aba],[data-rank],[data-abrir],[data-fav],[data-pagina]');
    if (!t || t.tagName === 'FORM') return;
    const d = t.dataset;
    if (d.tela) navegarPara(d.tela);
    else if (d.rank) { E.rank = d.rank; carregarRanking(); }
    else if (d.aba) mostrarAba(d.aba);
    else if (d.abrir) abrirRestaurante(d.abrir);
    else if (d.fav) tentar(() => alternarFavorito(d.fav));
    else if (d.pagina) carregarRestaurantes(+d.pagina);
    else if (d.acao && ACOES[d.acao]) tentar(() => ACOES[d.acao](t));
});

// ---------- Formulários ----------
const FORMS = {
    async login(f) {
        const r = await api('/login', { method: 'POST', corpo: { email: val('login-email'), password: $('login-senha').value } });
        E.token = r.token; guardarUsuario(r.usuario);
        localStorage.setItem('vago_token', r.token);
        f.reset();
        E.favs = new Set((await api('/favoritos')).map((x) => x.id));
        toast(`Bem-vindo, ${r.usuario.name}!`); navegarPara('tela-feed');
    },
    async 'cad-usuario'(f) {
        await api('/usuarios', { method: 'POST', corpo: {
            name: val('u-nome'), email: val('u-email'), password: $('u-senha').value,
            cpf: val('u-cpf') || null, telefone: val('u-tel') || null } });
        f.reset(); toast('Conta criada! Agora é só entrar.');
    },
    async 'cad-restaurante'(f) {
        await api('/restaurantes', { method: 'POST', corpo: {
            nome: val('cad-nome'), categoria: $('cad-categoria').value, telefone: val('cad-telefone'),
            endereco: val('cad-endereco'), descricao: val('cad-descricao'),
            capacidade_mesas: +$('cad-capacidade').value || 0, tempo_tolerancia: $('cad-tolerancia').value || '00:15' } });
        f.reset(); toast('Restaurante cadastrado! Você é o dono dele.'); navegarPara('tela-feed');
    },
    async 'add-prato'() {
        await api(`/restaurantes/${E.r.id}/cardapio`, { method: 'POST', corpo: {
            nome: val('p-nome'), preco: val('p-preco'), categoria: $('p-cat').value,
            descricao: val('p-desc') || null, foto: val('p-foto') || null } });
        mostrarAba('cardapio');
    },
    async 'add-promo'() {
        await api(`/restaurantes/${E.r.id}/promocoes`, { method: 'POST', corpo: { titulo: val('pr-titulo'), banner_url: val('pr-banner') || null } });
        mostrarAba('promocoes');
    },
    async 'add-mesa'() {
        const corpo = { numero: +val('m-num'), cadeiras: +val('m-cad') };
        if (val('m-x') !== '' && val('m-y') !== '') { corpo.pos_x = +val('m-x'); corpo.pos_y = +val('m-y'); }
        await api(`/restaurantes/${E.r.id}/mesas`, { method: 'POST', corpo });
        mostrarAba('reservar');
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
        toast('Resposta publicada!'); mostrarAba('cardapio');
    },
    async responder(f) {
        const id = f.dataset.id;
        await api(`/avaliacoes/${id}/resposta`, { method: 'PUT', corpo: { resposta: val(`rp-${id}`) } });
        toast('Resposta publicada!'); mostrarAba('avaliacoes');
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

// ---------- Início ----------
aplicarTema(temaAtual());
atualizarConta();
carregarCategorias();
carregarRestaurantes();
if (E.token) api('/favoritos').then((l) => { E.favs = new Set(l.map((x) => x.id)); carregarRestaurantes(); }).catch(() => {});
