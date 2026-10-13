/**
 * AntiBan - Reduz o risco de banimento do WhatsApp imitando comportamento humano.
 *
 * ⚠️ Nenhum sistema garante 100% contra banimento. Este modulo REDUZ o risco
 * respeitando limites e humanizando o envio. Use sempre um numero dedicado.
 *
 * Camadas: fila serial, jitter, "digitando...", limites por janela
 * (minuto/hora/dia), anti-flood por destino, pausa noturna, warm-up,
 * cooldown por erros e variacao de texto (spintax).
 *
 * Esta versao da biblioteca e TOTALMENTE desacoplada:
 *   - config via objeto/funcao injetada (sem configManager fixo)
 *   - persistencia de estado via adaptador opcional { read, write }
 *   - logger injetado (silencioso por padrao)
 *   - callback onCooldown opcional (ex: avisar o dono)
 *
 * Uso:
 *   const { AntiBan } = require('sonne-core')
 *   const ab = new AntiBan({ perfil: 'equilibrado' })
 *   ab.setSocket(sock)
 *   await ab.enfileirar(jid, { text: 'oi' })
 */
const { log } = require('./logger.js')

const PERFIS = {
  seguro: {
    maxPorMinuto: 1, maxPorHora: 40, maxPorDia: 300,
    delayBaseMs: 45000, delayJitterMs: 20000, minIntervaloDestinoMs: 60000
  },
  equilibrado: {
    maxPorMinuto: 2, maxPorHora: 80, maxPorDia: 600,
    delayBaseMs: 25000, delayJitterMs: 15000, minIntervaloDestinoMs: 40000
  },
  turbo: {
    maxPorMinuto: 4, maxPorHora: 150, maxPorDia: 1000,
    delayBaseMs: 12000, delayJitterMs: 8000, minIntervaloDestinoMs: 25000
  }
}

const PADROES = {
  warmup: true,
  pausaNoturna: true,
  horaDormir: 0,
  horaAcordar: 7,
  simularDigitacao: true,
  variarTexto: true,
  cooldownErroMin: 15,
  // os limites/delays abaixo sao sobrescritos pelo perfil escolhido
  maxPorMinuto: 2, maxPorHora: 80, maxPorDia: 600,
  delayBaseMs: 25000, delayJitterMs: 15000, minIntervaloDestinoMs: 40000
}

class AntiBan {
  /**
   * @param {object} opcoes
   * @param {string} [opcoes.perfil='equilibrado'] seguro|equilibrado|turbo
   * @param {object} [opcoes.config] overrides pontuais dos valores do perfil
   * @param {object} [opcoes.store] adaptador de persistencia { read(): obj, write(obj) }
   * @param {function} [opcoes.onCooldown] callback(info) quando um cooldown ativa
   * @param {boolean} [opcoes.testMode] desativa delays reais (para testes)
   */
  constructor(opcoes = {}) {
    this.socket = null
    this.fila = []
    this.processando = false

    this._perfilNome = opcoes.perfil && PERFIS[opcoes.perfil] ? opcoes.perfil : 'equilibrado'
    this._config = { ...PADROES, ...PERFIS[this._perfilNome], ...(opcoes.config || {}) }
    this._store = opcoes.store || null
    this._onCooldown = typeof opcoes.onCooldown === 'function' ? opcoes.onCooldown : null
    this._testMode = opcoes.testMode === true

    this.contadores = {
      minuto: { count: 0, reset: Date.now() + 60000 },
      hora: { count: 0, reset: Date.now() + 3600000 },
      dia: { count: 0, reset: this._proximaMeiaNoite() }
    }
    this.ultimoEnvioDestino = new Map()
    this.cooldownAte = 0
    this.errosSeguidos = 0
    this.forcarLimites = false

    // ===== MODO ADAPTATIVO =====
    // Ajusta o ritmo sozinho: sucesso sobe a "saude" (acelera ate 1.0),
    // erro/rate-limit derruba (desacelera ate 0.3 e pode pausar). Assim o bot
    // posta o MAXIMO seguro e recua no primeiro sinal de risco.
    this._adaptativo = opcoes.adaptativo !== false // ligado por padrao
    this.saude = typeof opcoes.saudeInicial === 'number' ? opcoes.saudeInicial : 70 // 0-100
    this.enviosConsecutivosOk = 0

    this._carregarEstado()
  }

  static get PERFIS() { return PERFIS }

  get emTeste() {
    return this._testMode || process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined
  }

  _cfg(chave, padrao) {
    const v = this._config[chave]
    return v === undefined ? padrao : v
  }

  /** Ajusta um valor de config em tempo de execucao. */
  set(chave, valor) { this._config[chave] = valor; return this }

  _proximaMeiaNoite() {
    const d = new Date()
    d.setHours(24, 0, 0, 0)
    return d.getTime()
  }

  _carregarEstado() {
    let st = {}
    try { st = (this._store && this._store.read && this._store.read()) || {} } catch (e) { st = {} }
    if (st.inicioOperacao) {
      this.inicioOperacao = st.inicioOperacao
    } else {
      this.inicioOperacao = Date.now()
      this._salvarEstado()
    }
    if (st.diaContador && st.diaData) {
      const mesmoDia = new Date(st.diaData).toDateString() === new Date().toDateString()
      if (mesmoDia) this.contadores.dia.count = st.diaContador
    }
    // Restaura a saude adaptativa (continua de onde parou apos reinicio).
    if (typeof st.saude === 'number') this.saude = Math.max(0, Math.min(100, st.saude))
  }

  _salvarEstado() {
    if (!this._store || !this._store.write) return
    try {
      this._store.write({
        inicioOperacao: this.inicioOperacao,
        diaContador: this.contadores.dia.count,
        diaData: new Date().toISOString(),
        saude: Math.round(this.saude)
      })
    } catch (e) {}
  }

  diasOperando() {
    return Math.floor((Date.now() - this.inicioOperacao) / 86400000)
  }

  fatorWarmup() {
    if (!this._cfg('warmup', true)) return 1
    const d = this.diasOperando()
    if (d <= 1) return 0.3
    if (d <= 3) return 0.5
    if (d <= 6) return 0.75
    return 1
  }

  /**
   * Fator de VELOCIDADE adaptativo (multiplica os delays). Deriva da "saude":
   *   saude 100 -> 0.7 (envia 30% mais rapido que o perfil)
   *   saude 70  -> 1.0 (ritmo normal do perfil)
   *   saude 30  -> 1.8 (bem mais devagar)
   *   saude <15 -> alem de lento, pode pausar (ver _ajustarPosEnvio)
   * Retorna 1 quando o modo adaptativo esta desligado.
   */
  fatorAdaptativoDelay() {
    if (!this._adaptativo) return 1
    const s = Math.max(0, Math.min(100, this.saude))
    // Interpola linear: saude 100 => 0.7 ; saude 0 => 2.2
    return 2.2 - (s / 100) * 1.5
  }

  /** Multiplicador para os LIMITES por janela conforme a saude (menos saude = menos limite). */
  fatorAdaptativoLimite() {
    if (!this._adaptativo) return 1
    const s = Math.max(0, Math.min(100, this.saude))
    if (s >= 80) return 1
    if (s >= 50) return 0.8
    if (s >= 25) return 0.5
    return 0.3
  }

  /** Chamado apos um envio OK: sobe a saude gradualmente (acelera com cautela). */
  _registrarSucessoAdaptativo() {
    this.enviosConsecutivosOk++
    // Sobe mais rapido no comeco de uma sequencia boa, depois estabiliza.
    const ganho = this.enviosConsecutivosOk >= 10 ? 3 : 1.5
    this.saude = Math.min(100, this.saude + ganho)
  }

  /** Chamado apos erro/suspeita: derruba a saude (desacelera forte). */
  _registrarFalhaAdaptativa(grave = false) {
    this.enviosConsecutivosOk = 0
    this.saude = Math.max(0, this.saude - (grave ? 40 : 15))
  }

  setSocket(socket) { this.socket = socket; return this }

  _resetarContadores() {
    const agora = Date.now()
    for (const janela of ['minuto', 'hora', 'dia']) {
      if (agora >= this.contadores[janela].reset) {
        this.contadores[janela].count = 0
        if (janela === 'minuto') this.contadores[janela].reset = agora + 60000
        else if (janela === 'hora') this.contadores[janela].reset = agora + 3600000
        else this.contadores[janela].reset = this._proximaMeiaNoite()
      }
    }
  }

  /** @returns {object} { ok, motivo, esperar } */
  podeEnviar(destino) {
    this._resetarContadores()
    const agora = Date.now()
    const fator = this.fatorWarmup()

    if (agora < this.cooldownAte) {
      return { ok: false, motivo: 'cooldown por erros', esperar: this.cooldownAte - agora }
    }

    if (this._cfg('pausaNoturna', true) && !this.emTeste) {
      const hora = new Date().getHours()
      const inicio = this._cfg('horaDormir', 0)
      const fim = this._cfg('horaAcordar', 7)
      const dormindo = inicio < fim
        ? (hora >= inicio && hora < fim)
        : (hora >= inicio || hora < fim)
      if (dormindo) return { ok: false, motivo: 'pausa noturna', esperar: 60000 }
    }

    if (!this.emTeste || this.forcarLimites) {
      // fator = warm-up (dias de operacao) * adaptativo (saude atual)
      const fatorTotal = fator * this.fatorAdaptativoLimite()
      const maxMinuto = Math.max(1, Math.floor(this._cfg('maxPorMinuto', 8) * fatorTotal))
      const maxHora = Math.max(1, Math.floor(this._cfg('maxPorHora', 120) * fatorTotal))
      const maxDia = Math.max(1, Math.floor(this._cfg('maxPorDia', 800) * fatorTotal))

      if (this.contadores.minuto.count >= maxMinuto) {
        return { ok: false, motivo: 'limite/minuto', esperar: this.contadores.minuto.reset - agora }
      }
      if (this.contadores.hora.count >= maxHora) {
        return { ok: false, motivo: 'limite/hora', esperar: this.contadores.hora.reset - agora }
      }
      if (this.contadores.dia.count >= maxDia) {
        return { ok: false, motivo: 'limite/dia', esperar: this.contadores.dia.reset - agora }
      }
    }

    if (destino) {
      const ultimo = this.ultimoEnvioDestino.get(destino) || 0
      const minIntervaloDestino = this._cfg('minIntervaloDestinoMs', 30000)
      if (!this.emTeste && agora - ultimo < minIntervaloDestino) {
        return { ok: false, motivo: 'intervalo por destino', esperar: minIntervaloDestino - (agora - ultimo) }
      }
    }

    return { ok: true }
  }

  _podarDestinos() {
    const agora = Date.now()
    const limite = Math.max(this._cfg('minIntervaloDestinoMs', 30000) * 4, 3600000)
    for (const [jid, ts] of this.ultimoEnvioDestino) {
      if (agora - ts > limite) this.ultimoEnvioDestino.delete(jid)
    }
  }

  _delayHumano() {
    if (this.emTeste) return 5
    const base = this._cfg('delayBaseMs', 4000)
    const jitter = this._cfg('delayJitterMs', 4000)
    const bruto = base + Math.floor(Math.random() * jitter)
    // Modo adaptativo: acelera (saude alta) ou desacelera (saude baixa).
    return Math.round(bruto * this.fatorAdaptativoDelay())
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

  async _simularPresenca(destino, conteudo) {
    if (this.emTeste || !this.socket) return
    if (!this._cfg('simularDigitacao', true)) return
    if (typeof destino === 'string' && destino.endsWith('@newsletter')) return
    try {
      await this.socket.sendPresenceUpdate('composing', destino)
      const texto = conteudo.caption || conteudo.text || ''
      const ms = Math.min(5000, 800 + texto.length * 25)
      await this._sleep(ms)
      await this.socket.sendPresenceUpdate('paused', destino)
    } catch (e) {}
  }

  /**
   * Enfileira um envio. Resolve com { sucesso, erro? } quando processado.
   * @param {string} destino jid
   * @param {object} conteudo objeto do sendMessage
   * @param {object} opcoes { quoted, prioridade }
   */
  enfileirar(destino, conteudo, opcoes = {}) {
    return new Promise((resolve) => {
      const item = { destino, conteudo, opcoes, resolve }
      if (opcoes.prioridade) this.fila.unshift(item)
      else this.fila.push(item)
      this._processarFila()
    })
  }

  async _processarFila() {
    if (this.processando) return
    this.processando = true

    while (this.fila.length > 0) {
      const item = this.fila[0]
      const check = this.podeEnviar(item.destino)

      if (!check.ok) {
        const espera = Math.min(check.esperar || 5000, 60000)
        if (check.motivo === 'limite/dia' || check.motivo === 'pausa noturna') {
          log.warn(`AntiBan: ${check.motivo}. Pausando envios por ${Math.round(espera / 1000)}s`)
          this.processando = false
          setTimeout(() => this._processarFila(), espera)
          return
        }
        await this._sleep(espera)
        continue
      }

      this.fila.shift()
      const sucesso = await this._enviarReal(item)
      item.resolve(sucesso)

      if (this.fila.length > 0) await this._sleep(this._delayHumano())
    }

    this._podarDestinos()
    this.processando = false
  }

  /** Aplica um perfil (seguro|equilibrado|turbo). @returns {object} */
  aplicarPerfil(nome) {
    const perfil = PERFIS[nome]
    if (!perfil) return { ok: false, erro: 'Perfil invalido' }
    Object.assign(this._config, perfil)
    this._perfilNome = nome
    return { ok: true, perfil: nome, valores: perfil }
  }

  perfilAtual() {
    const p = PERFIS[this._perfilNome]
    if (p && Object.entries(p).every(([k, v]) => this._cfg(k, null) === v)) return this._perfilNome
    return 'personalizado'
  }

  async _enviarReal(item) {
    if (!this.socket || !this.socket.user) return { sucesso: false, erro: 'socket offline' }
    try {
      await this._simularPresenca(item.destino, item.conteudo)
      const opts = item.opcoes.quoted ? { quoted: item.opcoes.quoted } : {}
      await this.socket.sendMessage(item.destino, item.conteudo, opts)

      this.contadores.minuto.count++
      this.contadores.hora.count++
      this.contadores.dia.count++
      this.ultimoEnvioDestino.set(item.destino, Date.now())
      this.errosSeguidos = 0
      this._registrarSucessoAdaptativo() // envio OK -> sobe a saude (acelera)
      this._salvarEstado()
      return { sucesso: true }
    } catch (err) {
      this._tratarErro(err)
      return { sucesso: false, erro: err.message }
    }
  }

  _tratarErro(err) {
    this.errosSeguidos++
    const msg = (err.message || '').toLowerCase()
    const suspeito = msg.includes('rate') || msg.includes('limit') ||
      msg.includes('429') || msg.includes('forbidden') || msg.includes('spam') ||
      msg.includes('blocked') || this.errosSeguidos >= 3

    // Modo adaptativo: derruba a saude (desacelera). Suspeita = queda grave.
    this._registrarFalhaAdaptativa(suspeito)

    if (suspeito) {
      // Cooldown adaptativo: quanto menor a saude, maior a pausa.
      const baseMin = this._cfg('cooldownErroMin', 15)
      const cooldownMin = this.saude < 15 ? baseMin * 2 : baseMin
      this.cooldownAte = Date.now() + cooldownMin * 60000
      log.error(`AntiBan: comportamento suspeito! Saude=${Math.round(this.saude)}. Cooldown de ${cooldownMin}min.`)
      if (this._onCooldown) {
        try { this._onCooldown({ minutos: cooldownMin, erro: err.message, saude: Math.round(this.saude) }) } catch (e) {}
      }
    }
  }

  status() {
    this._resetarContadores()
    const fator = this.fatorWarmup() * this.fatorAdaptativoLimite()
    const delayBase = this._cfg('delayBaseMs', 4000)
    const delayJitter = this._cfg('delayJitterMs', 4000)
    const delayMedioS = Math.round(((delayBase + delayJitter / 2) * this.fatorAdaptativoDelay()) / 1000)
    const estadoSaude = this.saude >= 70 ? '🟢 ótima' : (this.saude >= 40 ? '🟡 cautela' : '🔴 recuando')
    return {
      perfil: this.perfilAtual(),
      adaptativo: this._adaptativo,
      saude: `${Math.round(this.saude)}/100 (${estadoSaude})`,
      diasOperando: this.diasOperando(),
      warmupFator: `${Math.round(this.fatorWarmup() * 100)}%`,
      ritmo: this.fatorAdaptativoDelay() < 1 ? 'acelerado' : (this.fatorAdaptativoDelay() > 1.3 ? 'reduzido' : 'normal'),
      filaPendente: this.fila.length,
      delayMedioS,
      destinosRastreados: this.ultimoEnvioDestino.size,
      enviosMinuto: `${this.contadores.minuto.count}/${Math.max(1, Math.floor(this._cfg('maxPorMinuto', 8) * fator))}`,
      enviosHora: `${this.contadores.hora.count}/${Math.max(1, Math.floor(this._cfg('maxPorHora', 120) * fator))}`,
      enviosDia: `${this.contadores.dia.count}/${Math.max(1, Math.floor(this._cfg('maxPorDia', 800) * fator))}`,
      emCooldown: Date.now() < this.cooldownAte,
      cooldownRestanteMin: Date.now() < this.cooldownAte ? Math.ceil((this.cooldownAte - Date.now()) / 60000) : 0
    }
  }

  /** Spintax simples: {a|b|c} -> escolhe um aleatorio. */
  variarTexto(texto) {
    if (!texto || !this._cfg('variarTexto', true)) return texto
    return texto.replace(/\{([^{}]+)\}/g, (m, grupo) => {
      if (!grupo.includes('|')) return m
      const opcoes = grupo.split('|')
      return opcoes[Math.floor(Math.random() * opcoes.length)]
    })
  }

  limparFila() {
    this.fila.forEach(i => i.resolve({ sucesso: false, erro: 'fila limpa' }))
    this.fila = []
  }

  resetarEstado() {
    const agora = Date.now()
    this.contadores.minuto = { count: 0, reset: agora + 60000 }
    this.contadores.hora = { count: 0, reset: agora + 3600000 }
    this.contadores.dia = { count: 0, reset: this._proximaMeiaNoite() }
    this.cooldownAte = 0
    this.errosSeguidos = 0
    this.ultimoEnvioDestino.clear()
    this.processando = false
    this.limparFila()
    this.inicioOperacao = agora
  }
}

module.exports = AntiBan
