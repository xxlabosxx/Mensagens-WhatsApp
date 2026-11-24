// ==========================================================================
// Aplicação Cliente - Central de Comunicação Rede IF EcoSol
// ==========================================================================

// Fallback progressivo para <dialog closedby="any">
if (!('closedBy' in HTMLDialogElement.prototype)) {
  const outside = (e, dialog) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => {
      pressedOutside = outside(e, dialog);
    });
    dialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && outside(e, dialog)) dialog.close();
    });
  }
}

// Estado local
let listaContatos = [];
let temImagemNoServidor = false;

// Referências de DOM — Abas e Acordeão
const tablist = document.querySelector('.app-tablist');
const tabButtons = Array.from(document.querySelectorAll('.app-tab-btn'));
const tabPanels = [
  document.getElementById('panel-painel'),
  document.getElementById('panel-ajuda')
];
const btnIrParaAjuda = document.getElementById('btn-ir-para-ajuda');
const btnAjudaPlanilha = document.getElementById('btn-ajuda-planilha');
const btnVoltarPainel = document.getElementById('btn-voltar-painel');
const guiaAccordion = document.getElementById('guia-accordion');
const btnToggleAllFaq = document.getElementById('btn-toggle-all-faq');

// Referências de DOM — Painel Principal
const livePolite = document.getElementById('live-polite');
const liveAssertive = document.getElementById('live-assertive');

const headerConnectionPill = document.getElementById('header-connection-pill');
const headerStatusIcon = document.getElementById('header-status-icon');
const headerStatusText = document.getElementById('header-status-text');

const waConnectedBox = document.getElementById('wa-connected-box');
const waConnectedDetail = document.getElementById('wa-connected-detail');
const btnWaDisconnect = document.getElementById('btn-wa-disconnect');
const formConexao = document.getElementById('form-conexao');
const metodoCodigoRadio = document.getElementById('metodo-codigo');
const metodoQrRadio = document.getElementById('metodo-qr');
const campoNumeroPareamento = document.getElementById('campo-numero-pareamento');
const inputNumeroConectar = document.getElementById('numeroConectar');
const btnGerarConexao = document.getElementById('btn-gerar-conexao');
const painelPareamento = document.getElementById('painel-pareamento');
const pairingCodeValue = document.getElementById('pairing-code-value');
const painelQrcode = document.getElementById('painel-qrcode');
const qrImage = document.getElementById('qr-image');
const waErrorBox = document.getElementById('wa-error-box');
const waErrorText = document.getElementById('wa-error-text');

const formPlanilha = document.getElementById('form-planilha');
const inputSpreadsheetUrl = document.getElementById('spreadsheetUrl');
const modoColunasAuto = document.getElementById('modo-colunas-auto');
const modoColunasManual = document.getElementById('modo-colunas-manual');
const painelColunasManuais = document.getElementById('painel-colunas-manuais');
const selectColNome = document.getElementById('colNome');
const selectColTelefone = document.getElementById('colTelefone');
const selectColStatus = document.getElementById('colStatus');
const inputStatusIgnorar = document.getElementById('statusIgnorar');
const btnCarregarPlanilha = document.getElementById('btn-carregar-planilha');
const inputCsvFile = document.getElementById('input-csv-file');
const planilhaErrorBox = document.getElementById('planilha-error-box');
const planilhaErrorText = document.getElementById('planilha-error-text');
const planilhaColunasInfo = document.getElementById('planilha-colunas-info');

const formContatoManual = document.getElementById('form-contato-manual');
const inputManualNome = document.getElementById('manualNome');
const inputManualTelefone = document.getElementById('manualTelefone');

const contactsSummaryText = document.getElementById('contacts-summary-text');
const contactsTbody = document.getElementById('contacts-tbody');
const btnMarcarPendentes = document.getElementById('btn-marcar-pendentes');
const btnDesmarcarTodos = document.getElementById('btn-desmarcar-todos');
const btnLimparLista = document.getElementById('btn-limpar-lista');

const formMensagem = document.getElementById('form-mensagem');
const textareaMensagem = document.getElementById('mensagemLegenda');
const btnInserirNome = document.getElementById('btn-inserir-nome');
const btnInserirNomeCompleto = document.getElementById('btn-inserir-nome-completo');
const checkEnviarImagem = document.getElementById('enviarImagem');
const painelUploadImagem = document.getElementById('painel-upload-imagem');
const thumbContainer = document.getElementById('thumb-container');
const thumbImagemAtual = document.getElementById('thumb-imagem-atual');
const nomeArquivoImagem = document.getElementById('nome-arquivo-imagem');
const inputUploadImagem = document.getElementById('input-upload-imagem');
const btnRemoverImagem = document.getElementById('btn-remover-imagem');
const inputPausaMinima = document.getElementById('pausaMinima');
const inputPausaMaxima = document.getElementById('pausaMaxima');

const inputNumeroTeste = document.getElementById('numeroTeste');
const btnEnviarTeste = document.getElementById('btn-enviar-teste');
const contadorSelecionadosFinal = document.getElementById('contador-selecionados-final');
const btnAbrirModalDisparo = document.getElementById('btn-abrir-modal-disparo');

const previewImageWrapper = document.getElementById('preview-image-wrapper');
const previewBubbleImg = document.getElementById('preview-bubble-img');
const previewBubbleText = document.getElementById('preview-bubble-text');

const badgeStatusDisparo = document.getElementById('badge-status-disparo');
const labelProgressoTexto = document.getElementById('label-progresso-texto');
const porcentagemProgresso = document.getElementById('porcentagem-progresso');
const barraProgressoEnvio = document.getElementById('barra-progresso-envio');
const timerPausaBox = document.getElementById('timer-pausa-box');
const timerSegundos = document.getElementById('timer-segundos');
const statSucesso = document.getElementById('stat-sucesso');
const statIgnorados = document.getElementById('stat-ignorados');
const statFalhas = document.getElementById('stat-falhas');
const controlesDisparoAtivo = document.getElementById('controles-disparo-ativo');
const btnPausarDisparo = document.getElementById('btn-pausar-disparo');
const btnCancelarDisparo = document.getElementById('btn-cancelar-disparo');
const btnBaixarRelatorio = document.getElementById('btn-baixar-relatorio');
const listaLogs = document.getElementById('lista-logs');

const confirmDialog = document.getElementById('confirm-disparo-dialog');
const modalTotalContatos = document.getElementById('modal-total-contatos');
const modalResumoPausa = document.getElementById('modal-resumo-pausa');
const modalResumoImagem = document.getElementById('modal-resumo-imagem');

function anunciarPolite(texto) {
  if (livePolite) {
    livePolite.textContent = '';
    setTimeout(() => {
      livePolite.textContent = texto;
    }, 60);
  }
}

function anunciarErroCritico(texto) {
  if (liveAssertive) {
    liveAssertive.textContent = '';
    setTimeout(() => {
      liveAssertive.textContent = texto;
    }, 60);
  }
}

// ==================== CONTROLE DE ABAS (`tabs` + `search-hidden-content`) ====================
const suportaFocusgroup = Object.hasOwn(HTMLElement.prototype, 'focusGroup');

function selecionarAba(indice, { focar = false } = {}) {
  tabButtons.forEach((tab, idx) => {
    const ativo = idx === indice;
    tab.setAttribute('aria-selected', String(ativo));
    tab.toggleAttribute('focusgroupstart', ativo);
    if (!suportaFocusgroup) {
      tab.tabIndex = ativo ? 0 : -1;
    }
    if (ativo) {
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' });
      if (focar) tab.focus();
    }
  });

  tabPanels.forEach((panel, idx) => {
    const ativo = idx === indice;
    if (ativo) {
      panel.hidden = false;
    } else {
      panel.hidden = true;
    }
  });

  document.title =
    indice === 1
      ? 'Guia Passo a Passo e Dúvidas | Rede IF EcoSol'
      : 'Disparador de Mensagens | Rede IF EcoSol';
}

// Inicialização do fallback de roving tabindex para navegadores sem focusgroup nativo
if (!suportaFocusgroup) {
  tabButtons.forEach((tab, idx) => {
    tab.tabIndex = idx === 0 ? 0 : -1;
  });

  tablist?.addEventListener('keydown', (e) => {
    const atual = tabButtons.indexOf(document.activeElement);
    if (atual === -1) return;

    let proximo = -1;
    if (e.key === 'ArrowRight') proximo = (atual + 1) % tabButtons.length;
    else if (e.key === 'ArrowLeft') proximo = (atual - 1 + tabButtons.length) % tabButtons.length;
    else if (e.key === 'Home') proximo = 0;
    else if (e.key === 'End') proximo = tabButtons.length - 1;

    if (proximo !== -1) {
      e.preventDefault();
      tabButtons[proximo].focus();
    }
  });
}

tabButtons.forEach((tab, idx) => {
  tab.addEventListener('click', () => selecionarAba(idx));
});

// Sincronizar aba ativa quando o usuário usa Ctrl+F (Find-in-Page) em conteúdo com hidden="until-found"
tabPanels.forEach((panel, idx) => {
  panel.addEventListener('beforematch', () => {
    selecionarAba(idx);
  });
});

// Botões de atalho para ir e voltar entre Painel e Guia
btnIrParaAjuda?.addEventListener('click', () => {
  selecionarAba(1, { focar: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

btnAjudaPlanilha?.addEventListener('click', () => {
  selecionarAba(1);
  const topicoPlanilha = document.getElementById('guia-planilha');
  const topicoGoogle = document.getElementById('guia-google-sheets');
  if (topicoPlanilha) topicoPlanilha.open = true;
  if (topicoGoogle) topicoGoogle.open = true;
  topicoPlanilha?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

btnVoltarPainel?.addEventListener('click', () => {
  selecionarAba(0, { focar: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ==================== ACORDEÃO DO GUIA (ABRIR / RECOLHER TODOS) ====================
function alternarTodosTopicosGuia(expandir) {
  const itens = guiaAccordion?.querySelectorAll(':scope > details') || [];
  for (const details of itens) {
    details.open = expandir;
  }
  btnToggleAllFaq?.setAttribute('aria-expanded', String(expandir));
}

// Comando nativo `command="--toggle-all"`
document.addEventListener(
  'command',
  (event) => {
    if (event.command !== '--toggle-all') return;
    const expandir = event.source.getAttribute('aria-expanded') !== 'true';
    alternarTodosTopicosGuia(expandir);
  },
  { capture: true }
);

// Fallback para navegadores sem Invoker Commands (`commandForElement`)
if (!Object.hasOwn(HTMLButtonElement.prototype, 'commandForElement')) {
  btnToggleAllFaq?.addEventListener('click', () => {
    const expandir = btnToggleAllFaq.getAttribute('aria-expanded') !== 'true';
    alternarTodosTopicosGuia(expandir);
  });
}

// Mantém `aria-expanded` do botão sincronizado quando itens são abertos/fechados individualmente
document.addEventListener(
  'toggle',
  (event) => {
    if (!event.target.matches('#guia-accordion > details')) return;
    const itens = guiaAccordion.querySelectorAll(':scope > details');
    const todosAbertos = Array.prototype.every.call(itens, (d) => d.open);
    btnToggleAllFaq?.setAttribute('aria-expanded', String(todosAbertos));
  },
  { capture: true }
);

// ==================== VALIDAÇÃO ACESSÍVEL DE FORMULÁRIOS ====================
function configurarValidacaoAcessivel(inputEl, errorEl, mensagemCustomizada) {
  let foiEditado = false;

  inputEl.addEventListener('input', () => {
    foiEditado = true;
    inputEl.setCustomValidity('');
    inputEl.removeAttribute('aria-invalid');
    if (errorEl) errorEl.hidden = true;
  });

  inputEl.addEventListener('blur', () => {
    if (!foiEditado) return;
    if (!inputEl.checkValidity()) {
      inputEl.setAttribute('aria-invalid', 'true');
      if (errorEl) errorEl.hidden = false;
    }
  });

  inputEl.addEventListener('invalid', () => {
    if (mensagemCustomizada) {
      inputEl.setCustomValidity(mensagemCustomizada);
    }
    inputEl.setAttribute('aria-invalid', 'true');
    if (errorEl) errorEl.hidden = false;
  });
}

configurarValidacaoAcessivel(
  inputNumeroConectar,
  document.getElementById('numeroConectar-error'),
  'Digite seu número de telefone com DDD (10 a 15 dígitos).'
);

configurarValidacaoAcessivel(
  inputSpreadsheetUrl,
  document.getElementById('spreadsheetUrl-error'),
  'Cole o link completo da sua Planilha do Google Sheets.'
);

configurarValidacaoAcessivel(
  textareaMensagem,
  document.getElementById('mensagemLegenda-error'),
  'Escreva o texto da mensagem que será enviada.'
);

// ==================== PRÉ-VISUALIZAÇÃO DA MENSAGEM ====================
function atualizarPreviewMensagem() {
  const textoBruto = textareaMensagem.value || '';
  const exemploContato = listaContatos.find((c) => c.selecionado) || {
    nome: 'Maria Oliveira'
  };
  const primeiroNome = (exemploContato.nome || 'Maria').split(' ')[0];

  const textoFormatado = textoBruto
    .replace(/\{nome\}/gi, exemploContato.nome)
    .replace(/\{primeiro_nome\}/gi, primeiroNome);

  previewBubbleText.textContent = textoFormatado || '(Sua mensagem aparecerá aqui conforme você digita na Etapa 3...)';

  const deveMostrarAreaUpload = checkEnviarImagem.checked;
  painelUploadImagem.hidden = !deveMostrarAreaUpload;
  previewImageWrapper.hidden = !(deveMostrarAreaUpload && temImagemNoServidor);
  thumbContainer.hidden = !temImagemNoServidor;
  btnRemoverImagem.hidden = !temImagemNoServidor;
}

textareaMensagem.addEventListener('input', atualizarPreviewMensagem);
checkEnviarImagem.addEventListener('change', atualizarPreviewMensagem);

function inserirTagNoCursor(tag) {
  const start = textareaMensagem.selectionStart ?? textareaMensagem.value.length;
  const end = textareaMensagem.selectionEnd ?? textareaMensagem.value.length;
  const texto = textareaMensagem.value;
  textareaMensagem.value = `${texto.slice(0, start)}${tag}${texto.slice(end)}`;
  textareaMensagem.focus();
  const novaPos = start + tag.length;
  textareaMensagem.setSelectionRange(novaPos, novaPos);
  atualizarPreviewMensagem();
}

btnInserirNome.addEventListener('click', () => inserirTagNoCursor('{primeiro_nome}'));
btnInserirNomeCompleto.addEventListener('click', () => inserirTagNoCursor('{nome}'));

// ==================== ETAPA 1: WHATSAPP ====================
function atualizarMetodoConexaoUI() {
  const usarCodigo = metodoCodigoRadio.checked;
  campoNumeroPareamento.hidden = !usarCodigo;
  inputNumeroConectar.required = usarCodigo;
  btnGerarConexao.textContent = usarCodigo
    ? 'Gerar Código para Conectar WhatsApp'
    : 'Gerar QR Code na Tela';
}

metodoCodigoRadio.addEventListener('change', atualizarMetodoConexaoUI);
metodoQrRadio.addEventListener('change', atualizarMetodoConexaoUI);

function renderizarEstadoWhatsApp(state) {
  if (!state) return;

  if (state.status === 'connected') {
    headerConnectionPill.dataset.state = 'connected';
    headerStatusIcon.textContent = '🟢';
    headerStatusText.textContent = `WhatsApp Conectado (${state.connectedNumber || 'Ativo'})`;

    waConnectedBox.hidden = false;
    waConnectedDetail.textContent = `Conectado ao número ${state.connectedNumber || 'principal'}. Você já pode realizar testes ou iniciar envios.`;
    formConexao.hidden = true;
    painelPareamento.hidden = true;
    painelQrcode.hidden = true;
  } else if (state.status === 'connecting') {
    headerConnectionPill.dataset.state = 'connecting';
    headerStatusIcon.textContent = '🟡';
    headerStatusText.textContent = 'Aguardando Pareamento...';

    waConnectedBox.hidden = true;
    formConexao.hidden = false;

    if (state.pairingCode) {
      painelPareamento.hidden = false;
      pairingCodeValue.textContent = state.pairingCode;
      painelQrcode.hidden = true;
    } else if (state.qrDataUrl) {
      painelQrcode.hidden = false;
      qrImage.src = state.qrDataUrl;
      painelPareamento.hidden = true;
    }
  } else {
    headerConnectionPill.dataset.state = 'disconnected';
    headerStatusIcon.textContent = '🔴';
    headerStatusText.textContent = 'WhatsApp Desconectado';

    waConnectedBox.hidden = true;
    formConexao.hidden = false;
    painelPareamento.hidden = true;
    painelQrcode.hidden = true;
  }

  if (state.lastError) {
    waErrorBox.hidden = false;
    waErrorText.textContent = state.lastError;
  } else {
    waErrorBox.hidden = true;
  }
}

formConexao.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (metodoCodigoRadio.checked && !formConexao.checkValidity()) {
    const primeiroInvalido = formConexao.querySelector(':invalid');
    primeiroInvalido?.focus();
    return;
  }

  btnGerarConexao.disabled = true;
  const metodo = metodoCodigoRadio.checked ? 'codigo' : 'qr';

  try {
    const resp = await fetch('/api/whatsapp/conectar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metodo,
        numeroConectar: inputNumeroConectar.value.replace(/\D/g, '')
      })
    });
    const dados = await resp.json();
    if (!dados.ok) {
      anunciarErroCritico(dados.erro || 'Erro ao iniciar conexão.');
    } else {
      anunciarPolite(
        metodo === 'codigo'
          ? 'Gerando código de pareamento, aguarde alguns segundos...'
          : 'Gerando QR Code na tela, aguarde...'
      );
    }
  } catch (err) {
    anunciarErroCritico(`Falha de comunicação com o servidor: ${err.message}`);
  } finally {
    btnGerarConexao.disabled = false;
  }
});

btnWaDisconnect.addEventListener('click', async () => {
  btnWaDisconnect.disabled = true;
  try {
    await fetch('/api/whatsapp/desconectar', { method: 'POST' });
    anunciarPolite('WhatsApp desconectado com sucesso.');
  } finally {
    btnWaDisconnect.disabled = false;
  }
});

// ==================== ETAPA 2: CONTATOS E PLANILHA ====================
function atualizarModoColunasUI() {
  painelColunasManuais.hidden = !modoColunasManual.checked;
}

modoColunasAuto.addEventListener('change', atualizarModoColunasUI);
modoColunasManual.addEventListener('change', atualizarModoColunasUI);

function mostrarColunasDetectadas(colunasUsadas) {
  if (!colunasUsadas) {
    planilhaColunasInfo.hidden = true;
    return;
  }
  planilhaColunasInfo.hidden = false;
  planilhaColunasInfo.innerHTML =
    `<strong>✅ Colunas identificadas:</strong> Nome = <code>${colunasUsadas.nome}</code> • WhatsApp = <code>${colunasUsadas.telefone}</code> • Status = <code>${colunasUsadas.status}</code>`;
}

function atualizarContadoresContatos() {
  const total = listaContatos.length;
  const selecionados = listaContatos.filter((c) => c.selecionado).length;
  const jaEnviados = listaContatos.filter((c) => c.jaEnviado).length;

  if (total === 0) {
    contactsSummaryText.innerHTML =
      'Nenhum contato carregado ainda. Cole o link da planilha acima, envie um CSV ou adicione alguém abaixo.';
  } else {
    contactsSummaryText.innerHTML =
      `Total na lista: <strong>${total}</strong> | Marcados para envio: <strong>${selecionados}</strong>${jaEnviados > 0 ? ` | Já marcados como enviados: <strong>${jaEnviados}</strong>` : ''}`;
  }

  contadorSelecionadosFinal.textContent = String(selecionados);
  modalTotalContatos.textContent = String(selecionados);
  atualizarPreviewMensagem();
}

function renderizarTabelaContatos() {
  contactsTbody.innerHTML = '';

  if (listaContatos.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <th scope="row">Lista vazia</th>
      <td>—</td>
      <td>—</td>
      <td>Carregue uma planilha ou adicione uma pessoa abaixo.</td>
    `;
    contactsTbody.appendChild(tr);
    atualizarContadoresContatos();
    return;
  }

  for (const contato of listaContatos) {
    const tr = document.createElement('tr');
    tr.dataset.contactId = String(contato.id);

    const thNome = document.createElement('th');
    thNome.scope = 'row';
    thNome.textContent = contato.nome || 'Sem nome';

    const tdCheck = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'row-check';
    checkbox.checked = Boolean(contato.selecionado);
    checkbox.setAttribute('aria-label', `Selecionar ${contato.nome} para envio`);
    checkbox.addEventListener('change', () => {
      contato.selecionado = checkbox.checked;
      atualizarContadoresContatos();
    });
    tdCheck.appendChild(checkbox);

    const tdTel = document.createElement('td');
    tdTel.textContent = contato.telefone;

    const tdStatus = document.createElement('td');
    tdStatus.id = `status-cell-${contato.id}`;
    if (contato.statusEnvio === 'enviado') {
      tdStatus.textContent = '✅ Enviado agora';
    } else if (contato.statusEnvio === 'sem_whatsapp') {
      tdStatus.textContent = '⚠️ Sem WhatsApp';
    } else if (contato.statusEnvio === 'erro') {
      tdStatus.textContent = '❌ Erro no envio';
    } else if (contato.jaEnviado) {
      tdStatus.textContent = '☑️ Já enviado na planilha';
    } else {
      tdStatus.textContent = '⏳ Pendente';
    }

    tr.append(thNome, tdCheck, tdTel, tdStatus);
    contactsTbody.appendChild(tr);
  }

  atualizarContadoresContatos();
}

formPlanilha.addEventListener('submit', async (e) => {
  e.preventDefault();
  planilhaErrorBox.hidden = true;

  if (!formPlanilha.checkValidity()) {
    const primeiroInvalido = formPlanilha.querySelector(':invalid');
    primeiroInvalido?.focus();
    return;
  }

  btnCarregarPlanilha.disabled = true;
  btnCarregarPlanilha.textContent = 'Carregando Planilha...';

  try {
    const resp = await fetch('/api/planilha/carregar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spreadsheetUrl: inputSpreadsheetUrl.value.trim(),
        modoColunas: modoColunasManual.checked ? 'manual' : 'auto',
        colNome: Number(selectColNome.value || 0),
        colTelefone: Number(selectColTelefone.value || 1),
        colStatus: Number(selectColStatus.value ?? -1),
        statusIgnorar: inputStatusIgnorar.value.trim()
      })
    });
    const dados = await resp.json();
    if (!dados.ok) {
      planilhaErrorBox.hidden = false;
      planilhaErrorText.textContent = dados.erro || 'Não foi possível ler a planilha.';
      planilhaColunasInfo.hidden = true;
      anunciarErroCritico(dados.erro || 'Não foi possível ler a planilha.');
      adicionarItemLogLocal('error', dados.erro || 'Erro ao ler planilha.');
    } else {
      listaContatos = dados.contatos || [];
      mostrarColunasDetectadas(dados.colunasUsadas);
      renderizarTabelaContatos();
      anunciarPolite(`${listaContatos.length} contatos carregados da planilha.`);
    }
  } catch (err) {
    planilhaErrorBox.hidden = false;
    planilhaErrorText.textContent = `Erro ao carregar planilha: ${err.message}`;
    anunciarErroCritico(`Erro ao carregar planilha: ${err.message}`);
  } finally {
    btnCarregarPlanilha.disabled = false;
    btnCarregarPlanilha.textContent = 'Carregar Contatos da Planilha Google';
  }
});

inputCsvFile.addEventListener('change', async () => {
  const file = inputCsvFile.files?.[0];
  if (!file) return;
  planilhaErrorBox.hidden = true;

  // Primeiro salva o modo de colunas escolhido antes de importar o CSV
  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modoColunas: modoColunasManual.checked ? 'manual' : 'auto',
      colNome: Number(selectColNome.value || 0),
      colTelefone: Number(selectColTelefone.value || 1),
      colStatus: Number(selectColStatus.value ?? -1),
      statusIgnorar: inputStatusIgnorar.value.trim()
    })
  });

  const formData = new FormData();
  formData.append('csv', file);

  try {
    const resp = await fetch('/api/planilha/upload-csv', {
      method: 'POST',
      body: formData
    });
    const dados = await resp.json();
    if (dados.ok) {
      listaContatos = dados.contatos || [];
      mostrarColunasDetectadas(dados.colunasUsadas);
      renderizarTabelaContatos();
      anunciarPolite(`${listaContatos.length} contatos importados do arquivo CSV.`);
    } else {
      planilhaErrorBox.hidden = false;
      planilhaErrorText.textContent = dados.erro || 'Erro ao importar CSV.';
      anunciarErroCritico(dados.erro || 'Erro ao importar CSV.');
    }
  } catch (err) {
    planilhaErrorBox.hidden = false;
    planilhaErrorText.textContent = `Falha ao enviar CSV: ${err.message}`;
    anunciarErroCritico(`Falha ao enviar CSV: ${err.message}`);
  } finally {
    inputCsvFile.value = '';
  }
});

formContatoManual.addEventListener('submit', (e) => {
  e.preventDefault();
  let tel = inputManualTelefone.value.replace(/\D/g, '');
  if (tel.length === 10 || tel.length === 11) {
    tel = `55${tel}`;
  }
  if (tel.length < 12) {
    inputManualTelefone.focus();
    anunciarErroCritico('Informe um telefone válido com DDD para adicionar à lista.');
    return;
  }

  const nome = inputManualNome.value.trim() || 'Contato Avulso';
  listaContatos.unshift({
    id: `manual-${Date.now()}`,
    nome,
    telefone: tel,
    statusPlanilha: 'Manual',
    selecionado: true,
    jaEnviado: false
  });

  inputManualNome.value = '';
  inputManualTelefone.value = '';
  renderizarTabelaContatos();
  anunciarPolite(`${nome} adicionado à lista de envio.`);
});

btnMarcarPendentes.addEventListener('click', () => {
  for (const c of listaContatos) {
    c.selecionado = !c.jaEnviado;
  }
  renderizarTabelaContatos();
});

btnDesmarcarTodos.addEventListener('click', () => {
  for (const c of listaContatos) {
    c.selecionado = false;
  }
  renderizarTabelaContatos();
});

btnLimparLista.addEventListener('click', () => {
  listaContatos = [];
  planilhaColunasInfo.hidden = true;
  renderizarTabelaContatos();
  anunciarPolite('Lista de contatos limpa.');
});

// ==================== ETAPA 3: IMAGEM E MENSAGEM ====================
function atualizarMiniaturasImagem() {
  if (!temImagemNoServidor) {
    thumbImagemAtual.removeAttribute('src');
    previewBubbleImg.removeAttribute('src');
    atualizarPreviewMensagem();
    return;
  }
  const cacheBust = `/api/imagem-atual?t=${Date.now()}`;
  thumbImagemAtual.src = cacheBust;
  previewBubbleImg.src = cacheBust;
  atualizarPreviewMensagem();
}

inputUploadImagem.addEventListener('change', async () => {
  const file = inputUploadImagem.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('imagem', file);

  try {
    const resp = await fetch('/api/upload-imagem', {
      method: 'POST',
      body: formData
    });
    const dados = await resp.json();
    if (dados.ok) {
      temImagemNoServidor = true;
      checkEnviarImagem.checked = true;
      nomeArquivoImagem.innerHTML = `Imagem selecionada: <code>${dados.nomeOriginal}</code>`;
      atualizarMiniaturasImagem();
      anunciarPolite(`Imagem ${dados.nomeOriginal} anexada com sucesso.`);
    } else {
      anunciarErroCritico(dados.erro || 'Erro ao enviar imagem.');
    }
  } catch (err) {
    anunciarErroCritico(`Erro no upload da imagem: ${err.message}`);
  } finally {
    inputUploadImagem.value = '';
  }
});

btnRemoverImagem.addEventListener('click', async () => {
  const resp = await fetch('/api/remover-imagem', { method: 'POST' });
  const dados = await resp.json();
  if (dados.ok) {
    temImagemNoServidor = false;
    checkEnviarImagem.checked = false;
    nomeArquivoImagem.textContent = 'Nenhuma imagem escolhida ainda.';
    atualizarMiniaturasImagem();
    anunciarPolite('Imagem removida.');
  }
});

formMensagem.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!formMensagem.checkValidity()) {
    const primeiroInvalido = formMensagem.querySelector(':invalid');
    primeiroInvalido?.focus();
    return;
  }

  const resp = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mensagemLegenda: textareaMensagem.value,
      enviarImagem: checkEnviarImagem.checked,
      pausaMinima: Number(inputPausaMinima.value || 25),
      pausaMaxima: Number(inputPausaMaxima.value || 45)
    })
  });
  const dados = await resp.json();
  if (dados.ok) {
    anunciarPolite('Rascunho da mensagem salvo com sucesso.');
    adicionarItemLogLocal('success', 'Rascunho da mensagem salvo.');
  }
});

// ==================== ETAPA 4: TESTE E DISPARO ====================
async function solicitarDisparo({ modoTeste }) {
  try {
    const resp = await fetch('/api/disparo/iniciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modoTeste,
        numeroTeste: inputNumeroTeste.value.replace(/\D/g, ''),
        contatos: listaContatos,
        mensagemLegenda: textareaMensagem.value,
        enviarImagem: checkEnviarImagem.checked,
        pausaMinima: Number(inputPausaMinima.value || 25),
        pausaMaxima: Number(inputPausaMaxima.value || 45)
      })
    });
    const dados = await resp.json();
    if (!dados.ok) {
      anunciarErroCritico(dados.erro || 'Não foi possível iniciar o disparo.');
      adicionarItemLogLocal('error', dados.erro || 'Não foi possível iniciar o disparo.');
    } else {
      anunciarPolite(
        modoTeste
          ? 'Envio de teste iniciado! Verifique seu WhatsApp em instantes.'
          : `Disparo iniciado para ${dados.total} contatos.`
      );
    }
  } catch (err) {
    anunciarErroCritico(`Falha ao iniciar disparo: ${err.message}`);
  }
}

btnEnviarTeste.addEventListener('click', async () => {
  btnEnviarTeste.disabled = true;
  await solicitarDisparo({ modoTeste: true });
  setTimeout(() => {
    btnEnviarTeste.disabled = false;
  }, 2000);
});

btnAbrirModalDisparo.addEventListener('click', () => {
  const selecionados = listaContatos.filter((c) => c.selecionado).length;
  modalTotalContatos.textContent = String(selecionados);
  modalResumoPausa.textContent = `${inputPausaMinima.value || 25} a ${inputPausaMaxima.value || 45} segundos`;
  modalResumoImagem.textContent =
    checkEnviarImagem.checked && temImagemNoServidor
      ? 'Sim (imagem incluída)'
      : 'Não (apenas texto)';

  if (!confirmDialog.open) {
    confirmDialog.showModal();
  }
});

confirmDialog.addEventListener('close', () => {
  const escolha = confirmDialog.returnValue;
  confirmDialog.returnValue = '';
  if (escolha === 'confirm') {
    solicitarDisparo({ modoTeste: false });
  }
});

btnPausarDisparo.addEventListener('click', async () => {
  const resp = await fetch('/api/disparo/pausar', { method: 'POST' });
  const dados = await resp.json();
  if (dados.ok) {
    btnPausarDisparo.textContent = dados.pausado ? 'Retomar Envio' : 'Pausar Envio';
  }
});

btnCancelarDisparo.addEventListener('click', async () => {
  await fetch('/api/disparo/cancelar', { method: 'POST' });
});

// ==================== PROGRESSO E LOGS EM TEMPO REAL ====================
function renderizarEstadoDisparo(state) {
  if (!state) return;

  const total = state.total || 0;
  const concluidos = (state.sucesso || 0) + (state.ignorados || 0) + (state.falhas || 0);
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  labelProgressoTexto.textContent = `Progresso: ${concluidos} de ${total}`;
  porcentagemProgresso.textContent = `${pct}%`;
  barraProgressoEnvio.max = total > 0 ? total : 100;
  barraProgressoEnvio.value = total > 0 ? concluidos : 0;
  barraProgressoEnvio.textContent = `${pct}%`;

  statSucesso.textContent = String(state.sucesso || 0);
  statIgnorados.textContent = String(state.ignorados || 0);
  statFalhas.textContent = String(state.falhas || 0);

  if (state.ativo) {
    controlesDisparoAtivo.hidden = false;
    btnAbrirModalDisparo.disabled = true;
    btnPausarDisparo.textContent = state.pausado ? 'Retomar Envio' : 'Pausar Envio';
    badgeStatusDisparo.textContent = state.pausado
      ? '⏸️ Pausado'
      : state.modoTeste
        ? '🧪 Enviando Teste'
        : '🚀 Enviando...';
  } else {
    controlesDisparoAtivo.hidden = true;
    btnAbrirModalDisparo.disabled = false;
    badgeStatusDisparo.textContent = concluidos > 0 ? '✅ Concluído' : 'Aguardando';
  }

  if (state.ativo && state.aguardandoSegundos > 0) {
    timerPausaBox.hidden = false;
    timerSegundos.textContent = String(state.aguardandoSegundos);
  } else {
    timerPausaBox.hidden = true;
  }
}

function iconeParaNivel(nivel) {
  if (nivel === 'success') return '✅';
  if (nivel === 'warning') return '⚠️';
  if (nivel === 'error') return '❌';
  return 'ℹ️';
}

function adicionarItemLogLocal(nivel, mensagem, horario = new Date().toLocaleTimeString('pt-BR')) {
  const li = document.createElement('li');
  li.className = `log-item log-${nivel}`;

  const spanIcon = document.createElement('span');
  spanIcon.className = 'log-icon';
  spanIcon.setAttribute('aria-hidden', 'true');
  spanIcon.textContent = iconeParaNivel(nivel);

  const divBody = document.createElement('div');
  divBody.className = 'log-body';

  const spanTime = document.createElement('span');
  spanTime.className = 'log-time';
  spanTime.textContent = horario;

  const spanMsg = document.createElement('span');
  spanMsg.className = 'log-msg';
  spanMsg.textContent = mensagem;

  divBody.append(spanTime, spanMsg);
  li.append(spanIcon, divBody);

  listaLogs.prepend(li);
  while (listaLogs.children.length > 200) {
    listaLogs.lastElementChild?.remove();
  }
}

btnBaixarRelatorio.addEventListener('click', () => {
  const bom = '\uFEFF';
  const linhas = ['Nome;Telefone;Status_Planilha;Resultado_Disparo'];
  for (const c of listaContatos) {
    const nomeEscapado = `"${String(c.nome || '').replace(/"/g, '""')}"`;
    const resultado = c.statusEnvio || (c.jaEnviado ? 'ja_enviado_planilha' : 'nao_enviado');
    linhas.push(`${nomeEscapado};${c.telefone};${c.statusPlanilha || ''};${resultado}`);
  }
  const blob = new Blob([bom + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-envios-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// ==================== INICIALIZAÇÃO E SSE ====================
async function inicializarPainel() {
  try {
    const resp = await fetch('/api/config');
    const { config, whatsappState, disparoState } = await resp.json();

    if (config) {
      inputSpreadsheetUrl.value = config.spreadsheetUrl || '';
      if (config.modoColunas === 'manual') {
        modoColunasManual.checked = true;
      } else {
        modoColunasAuto.checked = true;
      }
      selectColNome.value = String(config.colNome ?? 0);
      selectColTelefone.value = String(config.colTelefone ?? 1);
      selectColStatus.value = String(config.colStatus ?? -1);
      inputStatusIgnorar.value = config.statusIgnorar ?? 'enviado';
      inputNumeroConectar.value = config.numeroConectar || '';
      inputNumeroTeste.value = config.numeroTeste || '';
      textareaMensagem.value = config.mensagemLegenda || '';
      temImagemNoServidor = Boolean(config.temImagem);
      checkEnviarImagem.checked = Boolean(config.enviarImagem && temImagemNoServidor);
      inputPausaMinima.value = String(config.pausaMinima ?? 25);
      inputPausaMaxima.value = String(config.pausaMaxima ?? 45);
      nomeArquivoImagem.innerHTML = temImagemNoServidor
        ? `Imagem selecionada: <code>${config.nomeArquivoImagem || config.caminhoImagem}</code>`
        : 'Nenhuma imagem escolhida ainda.';
    }

    atualizarMetodoConexaoUI();
    atualizarModoColunasUI();
    atualizarMiniaturasImagem();
    renderizarEstadoWhatsApp(whatsappState);
    renderizarEstadoDisparo(disparoState);

    if (disparoState?.historico?.length) {
      listaLogs.innerHTML = '';
      for (const item of [...disparoState.historico].reverse()) {
        adicionarItemLogLocal(item.nivel, item.mensagem, item.horario);
      }
    }

    if (config?.spreadsheetUrl) {
      formPlanilha.requestSubmit();
    }
  } catch (err) {
    console.error('Erro ao inicializar painel:', err);
  }

  const evtSource = new EventSource('/api/events');
  evtSource.onmessage = (event) => {
    try {
      const { tipo, dados } = JSON.parse(event.data);
      if (tipo === 'whatsapp_state') {
        renderizarEstadoWhatsApp(dados);
      } else if (tipo === 'disparo_state') {
        renderizarEstadoDisparo(dados);
      } else if (tipo === 'log') {
        adicionarItemLogLocal(dados.nivel, dados.mensagem, dados.horario);
      } else if (tipo === 'contato_status') {
        const contato = listaContatos.find((c) => String(c.id) === String(dados.id));
        if (contato) {
          contato.statusEnvio = dados.status;
          const celula = document.getElementById(`status-cell-${contato.id}`);
          if (celula) {
            if (dados.status === 'enviado') celula.textContent = '✅ Enviado agora';
            else if (dados.status === 'sem_whatsapp') celula.textContent = '⚠️ Sem WhatsApp';
            else if (dados.status === 'erro') celula.textContent = '❌ Erro no envio';
          }
        }
      }
    } catch (_err) {
      // ignora erro de parse
    }
  };
}

inicializarPainel();
