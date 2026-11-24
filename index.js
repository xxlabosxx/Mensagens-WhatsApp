import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';

const SPREADSHEET_ID = '1vrDksaIuEB3bOC0I99ak84uHjsnZU_X_OWAd6RbiK-k';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;
const CAMINHO_IMAGEM = './sintese.jpg';

const SEU_NUMERO_CONECTAR = '5518991458928';
const NUMERO_TESTE = '5518991458928';

const MENSAGEM_LEGENDA = 
  'Saiba o que rolou na última reunião da Rede IF EcoSol 😉 ' +
  'Vc tbm é importante nesta construção❗' +
  'Link da ata em: https://docs.google.com/document/d/1LoACZM2Vjy44nMo_7nLsiWHYMccsQk3x/edit?usp=drive_link&ouid=115258241775305827922&rtpof=true&sd=true.';

const PAUSA_MINIMA_SEGUNDOS = 50;
const PAUSA_MAXIMA_SEGUNDOS = 60;

const modoTeste = process.argv.includes('--teste');
let codigoSolicitado = false;

function aguardar(segundos) {
  return new Promise((resolve) => setTimeout(resolve, segundos * 1000));
}

function gerarPausaAleatoria(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function buscarContatosDaPlanilha() {
  const resposta = await fetch(CSV_URL);
  if (!resposta.ok) {
    throw new Error('Não foi possível acessar a planilha. Verifique se ela está compartilhada como "Qualquer pessoa com o link".');
  }
  const textoCsv = await resposta.text();
  const linhas = textoCsv.split(/\r?\n/).slice(1);
  const contatos = [];

  for (const linha of linhas) {
    if (!linha.trim()) continue;
    const colunas = linha.split(',');
    const nome = (colunas[0] || '').replace(/"/g, '').trim();
    const telefoneLimpo = (colunas[2] || '').replace(/\D/g, '');
    const status = (colunas[4] || '').replace(/"/g, '').trim().toLowerCase();

    if (telefoneLimpo && status !== 'enviado') {
      contatos.push({ nome, telefone: telefoneLimpo });
    }
  }
  return contatos;
}

async function iniciarDisparo() {
  if (!fs.existsSync(CAMINHO_IMAGEM)) {
    console.error(`Erro: Imagem não encontrada em ${CAMINHO_IMAGEM}`);
    process.exit(1);
  }

  const { state, saveCreds } = await useMultiFileAuthState('sessao_whatsapp');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000
  });

  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered && !codigoSolicitado) {
    codigoSolicitado = true;
    setTimeout(async () => {
      try {
        const numeroLimpo = SEU_NUMERO_CONECTAR.replace(/\D/g, '');
        const codigo = await sock.requestPairingCode(numeroLimpo);
        console.log('\n======================================================');
        console.log(`CÓDIGO DE PAREAMENTO: ${codigo}`);
        console.log('No celular: WhatsApp > Aparelhos conectados > Conectar aparelho > "Conectar com número de telefone"');
        console.log('======================================================\n');
      } catch (err) {
        console.error('Erro ao gerar código de pareamento:', err.message);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const deveReconectar = statusCode !== DisconnectReason.loggedOut;
      if (deveReconectar) {
        console.log(`Conexão fechada (código ${statusCode || 'desconhecido'}), tentando reconectar...`);
        await aguardar(3);
        iniciarDisparo();
      } else {
        console.log('Sessão desconectada. Apague a pasta "sessao_whatsapp" e tente novamente.');
      }
    }

    if (connection === 'open') {
      console.log('\nConectado ao WhatsApp com sucesso!\n');

      try {
        const listaEnvio = modoTeste
          ? [{ nome: 'Teste Próprio', telefone: NUMERO_TESTE.replace(/\D/g, '') }]
          : await buscarContatosDaPlanilha();

        console.log(modoTeste
          ? `MODO DE TESTE ATIVADO: Enviando apenas para ${NUMERO_TESTE}...`
          : `Total de contatos carregados da planilha: ${listaEnvio.length}\n`
        );

        const bufferImagem = fs.readFileSync(CAMINHO_IMAGEM);

        for (let i = 0; i < listaEnvio.length; i++) {
          const contato = listaEnvio[i];
          const jid = `${contato.telefone}@s.whatsapp.net`;

          try {
            const [existeNoWhats] = await sock.onWhatsApp(jid);
            if (!existeNoWhats?.exists) {
              console.log(`[${i + 1}/${listaEnvio.length}] Número sem WhatsApp ignorado: ${contato.nome} (${contato.telefone})`);
              continue;
            }

            await sock.sendMessage(existeNoWhats.jid, {
              image: bufferImagem,
              caption: MENSAGEM_LEGENDA
            });

            console.log(`[${i + 1}/${listaEnvio.length}] Enviado com sucesso para: ${contato.nome || 'Sem Nome'} (${contato.telefone})`);
          } catch (erroEnvio) {
            console.error(`[${i + 1}/${listaEnvio.length}] Falha ao enviar para ${contato.telefone}:`, erroEnvio.message);
          }

          if (i < listaEnvio.length - 1) {
            const tempoEspera = gerarPausaAleatoria(PAUSA_MINIMA_SEGUNDOS, PAUSA_MAXIMA_SEGUNDOS);
            console.log(`Aguardando ${tempoEspera} segundos antes do próximo envio...`);
            await aguardar(tempoEspera);
          }
        }

        console.log('\nProcesso concluído! Encerrando conexão...');
        await aguardar(3);
        sock.end();
        process.exit(0);
      } catch (erroGeral) {
        console.error('Erro durante o disparo:', erroGeral.message);
        process.exit(1);
      }
    }
  });
}

iniciarDisparo();