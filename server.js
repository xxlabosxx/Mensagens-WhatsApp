import express from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Garantir pasta de uploads
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuração do Multer para upload de imagem e CSV
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const prefix = file.fieldname === 'csv' ? 'planilha-importada' : 'midia-atual';
    cb(null, `${prefix}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }
});

// Configurações iniciais limpas e neutras (prontas para qualquer professor/usuário)
const CONFIG_FILE = path.join(__dirname, 'config.json');
const DEFAULT_CONFIG = {
  spreadsheetUrl: '',
  modoColunas: 'auto', // 'auto' | 'manual'
  colNome: 0,
  colTelefone: 1,
  colStatus: -1,
  statusIgnorar: 'enviado',
  numeroConectar: '',
  numeroTeste: '',
  mensagemLegenda: '',
  enviarImagem: false,
  caminhoImagem: '',
  nomeArquivoImagem: '',
  pausaMinima: 25,
  pausaMaxima: 45
};

function temImagemValida(config) {
  if (!config?.caminhoImagem) return false;
  const abs = path.resolve(__dirname, config.caminhoImagem);
  return fs.existsSync(abs) && fs.statSync(abs).isFile();
}

function carregarConfig() {
  let cfg = { ...DEFAULT_CONFIG };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      cfg = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Erro ao ler config.json:', err.message);
  }
  return {
    ...cfg,
    temImagem: temImagemValida(cfg)
  };
}

function salvarConfig(novaConfig) {
  const atual = carregarConfig();
  const { temImagem: _ignorar, ...semDerivado } = { ...atual, ...novaConfig };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(semDerivado, null, 2), 'utf-8');
  return {
    ...semDerivado,
    temImagem: temImagemValida(semDerivado)
  };
}

// Estado global do WhatsApp e do Disparo
let sock = null;
let whatsappState = {
  status: 'disconnected', // 'disconnected' | 'connecting' | 'connected'
  qrDataUrl: null,
  pairingCode: null,
  connectedNumber: null,
  lastError: null
};

let disparoState = {
  ativo: false,
  pausado: false,
  cancelarSolicitado: false,
  modoTeste: false,
  total: 0,
  atual: 0,
  sucesso: 0,
  ignorados: 0,
  falhas: 0,
  aguardandoSegundos: 0,
  historico: []
};

// Clientes SSE (Server-Sent Events) para atualização em tempo real na interface
const sseClients = new Set();

function broadcastEvent(tipo, dados) {
  const payload = `data: ${JSON.stringify({ tipo, dados, timestamp: new Date().toISOString() })}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

function adicionarLog(nivel, mensagem, detalhe = '') {
  const item = {
    id: Date.now() + Math.random().toString(36).slice(2, 6),
    horario: new Date().toLocaleTimeString('pt-BR'),
    nivel, // 'info' | 'success' | 'warning' | 'error'
    mensagem,
    detalhe
  };
  disparoState.historico.unshift(item);
  if (disparoState.historico.length > 300) {
    disparoState.historico.pop();
  }
  broadcastEvent('log', item);
  broadcastEvent('disparo_state', disparoState);
}

function aguardar(segundos) {
  return new Promise((resolve) => setTimeout(resolve, segundos * 1000));
}

function gerarPausaAleatoria(min, max) {
  const minimo = Math.max(5, Number(min) || 25);
  const maximo = Math.max(minimo, Number(max) || 45);
  return Math.floor(Math.random() * (maximo - minimo + 1)) + minimo;
}

// ==================== PARSER INTELIGENTE DE PLANILHA (GOOGLE SHEETS E EXCEL BR) ====================

function normalizarTextoCabecalho(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function detectarDelimitadorCsv(primeiraLinha) {
  let virgulas = 0;
  let pontoEVirgula = 0;
  let emAspas = false;
  for (const ch of primeiraLinha) {
    if (ch === '"') emAspas = !emAspas;
    else if (!emAspas && ch === ',') virgulas++;
    else if (!emAspas && ch === ';') pontoEVirgula++;
  }
  return pontoEVirgula > virgulas ? ';' : ',';
}

function parseCsvLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function letraDaColuna(indice) {
  if (indice < 0) return 'Nenhuma';
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (indice < letras.length) return `Coluna ${letras[indice]}`;
  return `Coluna ${indice + 1}`;
}

function detectarColunasAutomaticamente(cabecalhos, amostrasLinhas) {
  const norm = cabecalhos.map(normalizarTextoCabecalho);

  let colNome = norm.findIndex((h) =>
    /(^|\b)(nome|membro|participante|pessoa|aluno|estudante|docente|professor|contato)(\b|$)/.test(h)
  );
  let colTelefone = norm.findIndex((h) =>
    /(whats|tel|fone|cel|numero|contato_tel|mobile|phone)/.test(h)
  );
  let colStatus = norm.findIndex((h) =>
    /(status|situacao|enviado|envio|controle)/.test(h)
  );

  // Se o cabeçalho não deixou claro qual é o telefone, analisa as primeiras linhas de dados
  if (colTelefone === -1 && amostrasLinhas.length > 0) {
    const numCols = Math.max(cabecalhos.length, ...amostrasLinhas.map((l) => l.length));
    let melhorCol = -1;
    let melhorPontos = 0;
    for (let c = 0; c < numCols; c++) {
      let pontos = 0;
      for (const row of amostrasLinhas.slice(0, 10)) {
        const digitos = String(row[c] || '').replace(/\D/g, '');
        if (digitos.length >= 10 && digitos.length <= 15) pontos++;
      }
      if (pontos > melhorPontos) {
        melhorPontos = pontos;
        melhorCol = c;
      }
    }
    if (melhorCol !== -1) colTelefone = melhorCol;
  }

  if (colNome === -1) {
    colNome = colTelefone === 0 ? 1 : 0;
  }
  if (colTelefone === -1) {
    colTelefone = colNome === 1 ? 0 : 1;
  }

  return { colNome, colTelefone, colStatus };
}

function extrairInfoGoogleSheets(inputUrlOrId) {
  if (!inputUrlOrId) return { sheetId: '', gid: '' };
  const limpo = inputUrlOrId.trim();
  const matchId = limpo.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const matchGid = limpo.match(/[?&#]gid=(\d+)/);
  const sheetId = matchId && matchId[1] ? matchId[1] : limpo.replace(/[^a-zA-Z0-9-_]/g, '');
  const gid = matchGid && matchGid[1] ? matchGid[1] : '';
  return { sheetId, gid };
}

export async function buscarContatosDaPlanilha(config) {
  const { sheetId, gid } = extrairInfoGoogleSheets(config.spreadsheetUrl);
  if (!sheetId || sheetId.length < 15) {
    throw new Error(
      'O link da planilha parece incompleto. Abra sua planilha no Google, copie o endereço da barra do navegador e cole aqui.'
    );
  }
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
  const resposta = await fetch(csvUrl, { redirect: 'follow' });
  if (!resposta.ok) {
    throw new Error(
      'Não foi possível acessar a planilha. Verifique se o link está correto e se ela foi compartilhada como "Qualquer pessoa com o link".'
    );
  }
  const textoCsv = await resposta.text();

  // Google Sheets retorna página HTML de login (status 200) quando a planilha é privada
  const inicio = textoCsv.trimStart().slice(0, 120).toLowerCase();
  if (inicio.startsWith('<!doctype html') || inicio.startsWith('<html')) {
    throw new Error(
      'Sua planilha do Google está PRIVADA! Clique no botão "Compartilhar" no canto superior direito da planilha e mude o Acesso Geral para "Qualquer pessoa com o link" (Leitor).'
    );
  }

  return extrairContatosDeTextoCsv(textoCsv, config);
}

function extrairContatosDeTextoCsv(textoCsvBruto, config) {
  const semBom = String(textoCsvBruto || '').replace(/^\uFEFF/, '');
  const todasLinhas = semBom.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (todasLinhas.length === 0) {
    return { cabecalhos: [], contatos: [], colunasUsadas: null };
  }

  const delimiter = detectarDelimitadorCsv(todasLinhas[0]);
  const cabecalhos = parseCsvLine(todasLinhas[0], delimiter);
  const linhasParseadas = todasLinhas.slice(1).map((l) => parseCsvLine(l, delimiter));

  let colNome = Number(config.colNome ?? 0);
  let colTelefone = Number(config.colTelefone ?? 1);
  let colStatus = Number(config.colStatus ?? -1);

  if (config.modoColunas !== 'manual') {
    const detectado = detectarColunasAutomaticamente(cabecalhos, linhasParseadas);
    colNome = detectado.colNome;
    colTelefone = detectado.colTelefone;
    colStatus = detectado.colStatus;
  }

  const statusIgnorar = String(config.statusIgnorar ?? 'enviado').trim().toLowerCase();
  const contatos = [];

  for (let idx = 0; idx < linhasParseadas.length; idx++) {
    const colunas = linhasParseadas[idx];
    const nome = (colunas[colNome] || '').replace(/^"|"$/g, '').trim();
    let telefoneLimpo = (colunas[colTelefone] || '').replace(/\D/g, '');
    const statusOriginal =
      colStatus >= 0 ? (colunas[colStatus] || '').replace(/^"|"$/g, '').trim() : '';
    const statusLower = statusOriginal.toLowerCase();

    if (!telefoneLimpo || telefoneLimpo.length < 10) continue;

    // Se o número tiver 10 ou 11 dígitos (DDD + número brasileiro sem DDI 55), adiciona 55 automaticamente
    if (telefoneLimpo.length === 10 || telefoneLimpo.length === 11) {
      telefoneLimpo = `55${telefoneLimpo}`;
    }

    const jaEnviado = colStatus >= 0 && statusIgnorar !== '' && statusLower === statusIgnorar;
    contatos.push({
      id: idx + 1,
      nome: nome || 'Membro sem nome',
      telefone: telefoneLimpo,
      statusPlanilha: statusOriginal || 'Pendente',
      selecionado: !jaEnviado,
      jaEnviado
    });
  }

  return {
    cabecalhos,
    contatos,
    colunasUsadas: {
      nome: `${letraDaColuna(colNome)}${cabecalhos[colNome] ? ` (${cabecalhos[colNome]})` : ''}`,
      telefone: `${letraDaColuna(colTelefone)}${cabecalhos[colTelefone] ? ` (${cabecalhos[colTelefone]})` : ''}`,
      status:
        colStatus >= 0
          ? `${letraDaColuna(colStatus)}${cabecalhos[colStatus] ? ` (${cabecalhos[colStatus]})` : ''}`
          : 'Não utilizada'
    }
  };
}

// ==================== CONEXÃO WHATSAPP VIA BAILEYS ====================
let reconexaoTimer = null;

async function conectarWhatsApp({ usarCodigoPareamento = false, numeroPareamento = '' } = {}) {
  if (sock && whatsappState.status === 'connected') {
    return;
  }

  if (reconexaoTimer) {
    clearTimeout(reconexaoTimer);
    reconexaoTimer = null;
  }

  whatsappState.status = 'connecting';
  whatsappState.lastError = null;
  whatsappState.pairingCode = null;
  broadcastEvent('whatsapp_state', whatsappState);

  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'sessao_whatsapp'));
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000
  });

  sock.ev.on('creds.update', saveCreds);

  if (usarCodigoPareamento && !sock.authState.creds.registered) {
    let numLimpo = String(numeroPareamento || '').replace(/\D/g, '');
    if (numLimpo.length === 10 || numLimpo.length === 11) {
      numLimpo = `55${numLimpo}`;
    }
    if (numLimpo.length < 12) {
      whatsappState.lastError = 'Digite um número de telefone válido com DDD (ex: 5518999999999).';
      whatsappState.status = 'disconnected';
      broadcastEvent('whatsapp_state', whatsappState);
    } else {
      setTimeout(async () => {
        try {
          if (!sock || sock.authState.creds.registered) return;
          const codigo = await sock.requestPairingCode(numLimpo);
          whatsappState.pairingCode = codigo;
          whatsappState.qrDataUrl = null;
          broadcastEvent('whatsapp_state', whatsappState);
          adicionarLog('info', `Código de pareamento gerado: ${codigo}`, 'Digite este código no seu WhatsApp em Aparelhos Conectados.');
        } catch (err) {
          whatsappState.lastError = `Erro ao gerar código de pareamento: ${err.message}`;
          broadcastEvent('whatsapp_state', whatsappState);
        }
      }, 3000);
    }
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !usarCodigoPareamento) {
      try {
        whatsappState.qrDataUrl = await QRCode.toDataURL(qr, {
          width: 280,
          margin: 2,
          color: { dark: '#1b4d3e', light: '#ffffff' }
        });
        broadcastEvent('whatsapp_state', whatsappState);
      } catch (err) {
        console.error('Erro ao converter QR Code:', err.message);
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const foiDeslogado = statusCode === DisconnectReason.loggedOut;

      whatsappState.status = 'disconnected';
      whatsappState.qrDataUrl = null;
      whatsappState.connectedNumber = null;
      broadcastEvent('whatsapp_state', whatsappState);

      if (!foiDeslogado) {
        adicionarLog('warning', `Conexão com o WhatsApp oscilou (código ${statusCode || 'desconhecido'}). Reconectando automaticamente...`);
        reconexaoTimer = setTimeout(() => {
          conectarWhatsApp({ usarCodigoPareamento: false });
        }, 3500);
      } else {
        whatsappState.pairingCode = null;
        whatsappState.lastError = 'Sessão encerrada pelo celular. Conecte novamente para enviar mensagens.';
        broadcastEvent('whatsapp_state', whatsappState);
        adicionarLog('warning', 'Sessão do WhatsApp desconectada.');
      }
    }

    if (connection === 'open') {
      const userJid = sock.user?.id || '';
      const numeroConectado = userJid.split(':')[0].split('@')[0];
      whatsappState.status = 'connected';
      whatsappState.qrDataUrl = null;
      whatsappState.pairingCode = null;
      whatsappState.connectedNumber = numeroConectado || 'Conectado';
      whatsappState.lastError = null;
      broadcastEvent('whatsapp_state', whatsappState);
      adicionarLog('success', `WhatsApp conectado com sucesso (${whatsappState.connectedNumber})!`);
    }
  });
}

// ==================== FILA DE DISPAROS ====================
async function executarFilaDisparo(listaContatos, opcoes) {
  disparoState.ativo = true;
  disparoState.pausado = false;
  disparoState.cancelarSolicitado = false;
  disparoState.modoTeste = Boolean(opcoes.modoTeste);
  disparoState.total = listaContatos.length;
  disparoState.atual = 0;
  disparoState.sucesso = 0;
  disparoState.ignorados = 0;
  disparoState.falhas = 0;
  disparoState.aguardandoSegundos = 0;
  broadcastEvent('disparo_state', disparoState);

  const enviarMidia = Boolean(opcoes.enviarImagem);
  let bufferImagem = null;

  if (enviarMidia) {
    if (!opcoes.caminhoImagem) {
      adicionarLog('error', 'Você marcou "Enviar imagem", mas ainda não escolheu nenhum arquivo de imagem na Etapa 3.');
      disparoState.ativo = false;
      broadcastEvent('disparo_state', disparoState);
      return;
    }
    const caminhoMidia = path.resolve(__dirname, opcoes.caminhoImagem);
    if (!fs.existsSync(caminhoMidia)) {
      adicionarLog('error', 'A imagem selecionada não foi encontrada no servidor. Escolha a imagem novamente na Etapa 3.');
      disparoState.ativo = false;
      broadcastEvent('disparo_state', disparoState);
      return;
    }
    bufferImagem = fs.readFileSync(caminhoMidia);
  }

  adicionarLog(
    'info',
    disparoState.modoTeste
      ? `Iniciando ENVIO DE TESTE para ${listaContatos[0]?.telefone}...`
      : `Iniciando disparo para ${listaContatos.length} contato(s) selecionado(s)...`
  );

  for (let i = 0; i < listaContatos.length; i++) {
    if (disparoState.cancelarSolicitado) {
      adicionarLog('warning', 'Disparo cancelado pelo usuário.');
      break;
    }

    while (disparoState.pausado && !disparoState.cancelarSolicitado) {
      await aguardar(1);
    }

    if (disparoState.cancelarSolicitado) {
      adicionarLog('warning', 'Disparo cancelado pelo usuário.');
      break;
    }

    if (!sock || whatsappState.status !== 'connected') {
      adicionarLog('error', 'Conexão com o WhatsApp foi perdida. Aguarde reconectar e tente novamente.');
      break;
    }

    const contato = listaContatos[i];
    disparoState.atual = i + 1;
    broadcastEvent('disparo_state', disparoState);

    const telefoneLimpo = String(contato.telefone || '').replace(/\D/g, '');
    const jid = `${telefoneLimpo}@s.whatsapp.net`;

    const primeiroNome = (contato.nome || '').split(' ')[0] || '';
    const textoFinal = String(opcoes.mensagemLegenda || '')
      .replace(/\{nome\}/gi, contato.nome || '')
      .replace(/\{primeiro_nome\}/gi, primeiroNome);

    try {
      const [existeNoWhats] = await sock.onWhatsApp(jid);
      if (!existeNoWhats?.exists) {
        disparoState.ignorados++;
        adicionarLog(
          'warning',
          `[${i + 1}/${listaContatos.length}] Número sem WhatsApp ignorado: ${contato.nome} (${telefoneLimpo})`
        );
        broadcastEvent('contato_status', { id: contato.id, telefone: telefoneLimpo, status: 'sem_whatsapp' });
        continue;
      }

      if (enviarMidia && bufferImagem) {
        await sock.sendMessage(existeNoWhats.jid, {
          image: bufferImagem,
          caption: textoFinal
        });
      } else {
        await sock.sendMessage(existeNoWhats.jid, {
          text: textoFinal
        });
      }

      disparoState.sucesso++;
      adicionarLog(
        'success',
        `[${i + 1}/${listaContatos.length}] Enviado com sucesso para: ${contato.nome || 'Sem Nome'} (${telefoneLimpo})`
      );
      broadcastEvent('contato_status', { id: contato.id, telefone: telefoneLimpo, status: 'enviado' });
    } catch (erroEnvio) {
      disparoState.falhas++;
      adicionarLog(
        'error',
        `[${i + 1}/${listaContatos.length}] Falha ao enviar para ${contato.nome} (${telefoneLimpo}): ${erroEnvio.message}`
      );
      broadcastEvent('contato_status', { id: contato.id, telefone: telefoneLimpo, status: 'erro' });
    }

    if (i < listaContatos.length - 1 && !disparoState.cancelarSolicitado) {
      const tempoEspera = gerarPausaAleatoria(opcoes.pausaMinima, opcoes.pausaMaxima);
      adicionarLog('info', `Pausa de segurança: aguardando ${tempoEspera} segundos antes do próximo envio...`);

      for (let seg = tempoEspera; seg > 0; seg--) {
        if (disparoState.cancelarSolicitado) break;
        while (disparoState.pausado && !disparoState.cancelarSolicitado) {
          await aguardar(1);
        }
        disparoState.aguardandoSegundos = seg;
        broadcastEvent('disparo_state', disparoState);
        await aguardar(1);
      }
      disparoState.aguardandoSegundos = 0;
      broadcastEvent('disparo_state', disparoState);
    }
  }

  disparoState.ativo = false;
  disparoState.pausado = false;
  disparoState.aguardandoSegundos = 0;
  broadcastEvent('disparo_state', disparoState);
  adicionarLog(
    'success',
    `Processo finalizado! Sucessos: ${disparoState.sucesso} | Ignorados (sem Whats): ${disparoState.ignorados} | Falhas: ${disparoState.falhas}`
  );
}

// ==================== ROTAS DA API ====================

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ tipo: 'whatsapp_state', dados: whatsappState })}\n\n`);
  res.write(`data: ${JSON.stringify({ tipo: 'disparo_state', dados: disparoState })}\n\n`);

  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });
});

app.get('/api/config', (_req, res) => {
  const config = carregarConfig();
  res.json({
    config,
    whatsappState,
    disparoState
  });
});

app.post('/api/config', (req, res) => {
  try {
    const configAtualizada = salvarConfig(req.body || {});
    res.json({ ok: true, config: configAtualizada });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// Download de planilha modelo pronta para Excel (BR) e Google Planilhas
app.get('/api/planilha/modelo', (_req, res) => {
  const bom = '\uFEFF';
  const conteudo =
    bom +
    [
      'Nome;WhatsApp;Status',
      'Maria Oliveira;5518999991111;Pendente',
      'Prof. João Santos;18999992222;Pendente',
      'Ana Souza (Exemplo já enviado);5518999993333;enviado'
    ].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="modelo-planilha-if-ecosol.csv"');
  res.send(conteudo);
});

app.get('/api/imagem-atual', (_req, res) => {
  const config = carregarConfig();
  if (!config.temImagem) {
    return res.status(404).json({ ok: false, erro: 'Nenhuma imagem selecionada.' });
  }
  const caminhoAbsoluto = path.resolve(__dirname, config.caminhoImagem);
  res.sendFile(caminhoAbsoluto);
});

app.post('/api/upload-imagem', upload.single('imagem'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, erro: 'Nenhum arquivo de imagem enviado.' });
  }
  const caminhoRelativo = `./uploads/${req.file.filename}`;
  const config = salvarConfig({
    caminhoImagem: caminhoRelativo,
    nomeArquivoImagem: req.file.originalname,
    enviarImagem: true
  });
  adicionarLog('info', `Imagem anexada: ${req.file.originalname}`);
  res.json({
    ok: true,
    caminhoImagem: caminhoRelativo,
    nomeOriginal: req.file.originalname,
    config
  });
});

app.post('/api/remover-imagem', (_req, res) => {
  const config = salvarConfig({
    caminhoImagem: '',
    nomeArquivoImagem: '',
    enviarImagem: false
  });
  adicionarLog('info', 'Anexo de imagem removido. O envio será feito apenas com texto.');
  res.json({ ok: true, config });
});

app.post('/api/planilha/carregar', async (req, res) => {
  try {
    const config = salvarConfig(req.body || {});
    const resultado = await buscarContatosDaPlanilha(config);
    adicionarLog(
      'info',
      `Planilha Google carregada: ${resultado.contatos.length} contato(s) encontrado(s).`
    );
    res.json({ ok: true, ...resultado });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

app.post('/api/planilha/upload-csv', upload.single('csv'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, erro: 'Selecione um arquivo CSV válido.' });
    }
    const config = carregarConfig();
    const conteudoCsv = fs.readFileSync(req.file.path, 'utf-8');
    const resultado = extrairContatosDeTextoCsv(conteudoCsv, config);
    adicionarLog(
      'info',
      `Arquivo "${req.file.originalname}" importado: ${resultado.contatos.length} contato(s) encontrado(s).`
    );
    res.json({ ok: true, ...resultado });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

app.post('/api/whatsapp/conectar', async (req, res) => {
  try {
    const { metodo, numeroConectar } = req.body || {};
    if (numeroConectar) {
      salvarConfig({ numeroConectar });
    }

    if (sock && whatsappState.status !== 'connected') {
      try {
        sock.end();
      } catch (_e) {
        // ignora
      }
      sock = null;
    }

    await conectarWhatsApp({
      usarCodigoPareamento: metodo === 'codigo',
      numeroPareamento: numeroConectar || carregarConfig().numeroConectar
    });

    res.json({ ok: true, whatsappState });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

app.post('/api/whatsapp/desconectar', async (_req, res) => {
  try {
    if (reconexaoTimer) {
      clearTimeout(reconexaoTimer);
      reconexaoTimer = null;
    }
    if (sock) {
      try {
        await sock.logout();
      } catch (_e) {
        try {
          sock.end();
        } catch (_e2) {
          // ignora
        }
      }
      sock = null;
    }
    const pastaSessao = path.join(__dirname, 'sessao_whatsapp');
    if (fs.existsSync(pastaSessao)) {
      fs.rmSync(pastaSessao, { recursive: true, force: true });
    }

    whatsappState = {
      status: 'disconnected',
      qrDataUrl: null,
      pairingCode: null,
      connectedNumber: null,
      lastError: null
    };
    broadcastEvent('whatsapp_state', whatsappState);
    adicionarLog('info', 'Sessão do WhatsApp desconectada e limpa. Outro aparelho pode ser conectado agora.');
    res.json({ ok: true, whatsappState });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

app.post('/api/disparo/iniciar', async (req, res) => {
  try {
    if (disparoState.ativo) {
      return res.status(400).json({ ok: false, erro: 'Já existe um disparo em andamento.' });
    }
    if (!sock || whatsappState.status !== 'connected') {
      return res.status(400).json({
        ok: false,
        erro: 'O WhatsApp ainda não está conectado. Conclua a Etapa 1 antes de enviar.'
      });
    }

    const {
      modoTeste,
      numeroTeste,
      contatos,
      mensagemLegenda,
      enviarImagem,
      pausaMinima,
      pausaMaxima
    } = req.body || {};

    const config = salvarConfig({
      ...(numeroTeste !== undefined ? { numeroTeste } : {}),
      ...(mensagemLegenda !== undefined ? { mensagemLegenda } : {}),
      ...(enviarImagem !== undefined ? { enviarImagem } : {}),
      ...(pausaMinima !== undefined ? { pausaMinima: Number(pausaMinima) } : {}),
      ...(pausaMaxima !== undefined ? { pausaMaxima: Number(pausaMaxima) } : {})
    });

    if (!config.mensagemLegenda || !config.mensagemLegenda.trim()) {
      return res.status(400).json({ ok: false, erro: 'Escreva o texto da mensagem na Etapa 3 antes de enviar.' });
    }

    if (config.enviarImagem && !config.temImagem) {
      return res.status(400).json({
        ok: false,
        erro: 'Você marcou a opção de enviar imagem, mas ainda não escolheu uma imagem na Etapa 3.'
      });
    }

    let listaFinal = [];
    if (modoTeste) {
      let numLimpo = String(config.numeroTeste || '').replace(/\D/g, '');
      if (numLimpo.length === 10 || numLimpo.length === 11) {
        numLimpo = `55${numLimpo}`;
      }
      if (numLimpo.length < 12) {
        return res.status(400).json({
          ok: false,
          erro: 'Informe um número de teste válido com DDD (ex: 18999999999 ou 5518999999999).'
        });
      }
      listaFinal = [{ id: 'teste', nome: 'Teste Próprio', telefone: numLimpo }];
    } else {
      listaFinal = Array.isArray(contatos) ? contatos.filter((c) => c.selecionado) : [];
      if (listaFinal.length === 0) {
        return res.status(400).json({
          ok: false,
          erro: 'Nenhum contato selecionado. Carregue sua planilha ou adicione contatos na Etapa 2.'
        });
      }
    }

    executarFilaDisparo(listaFinal, {
      modoTeste: Boolean(modoTeste),
      mensagemLegenda: config.mensagemLegenda,
      enviarImagem: config.enviarImagem,
      caminhoImagem: config.caminhoImagem,
      pausaMinima: config.pausaMinima,
      pausaMaxima: config.pausaMaxima
    });

    res.json({ ok: true, total: listaFinal.length });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

app.post('/api/disparo/pausar', (_req, res) => {
  if (!disparoState.ativo) {
    return res.status(400).json({ ok: false, erro: 'Não há disparo ativo no momento.' });
  }
  disparoState.pausado = !disparoState.pausado;
  broadcastEvent('disparo_state', disparoState);
  adicionarLog(
    'info',
    disparoState.pausado ? 'Disparo pausado temporariamente pelo usuário.' : 'Disparo retomado!'
  );
  res.json({ ok: true, pausado: disparoState.pausado });
});

app.post('/api/disparo/cancelar', (_req, res) => {
  if (!disparoState.ativo) {
    return res.status(400).json({ ok: false, erro: 'Não há disparo ativo no momento.' });
  }
  disparoState.cancelarSolicitado = true;
  disparoState.pausado = false;
  broadcastEvent('disparo_state', disparoState);
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n======================================================');
  console.log(`🌿 Painel Rede IF EcoSol rodando com sucesso!`);
  console.log(`👉 Acesse no navegador: http://localhost:${PORT}`);
  console.log('======================================================\n');

  if (fs.existsSync(path.join(__dirname, 'sessao_whatsapp', 'creds.json'))) {
    setTimeout(() => {
      conectarWhatsApp().catch((err) => {
        console.error('Falha na conexão inicial automática:', err.message);
      });
    }, 500);
  }
});
