/**
 * SessionManager - Sessoes conversacionais ("pergunta -> aguarda resposta").
 *
 * Permite um fluxo moderno: o bot pergunta algo e trata a PROXIMA mensagem do
 * usuario como a resposta, sem precisar de comando. Ideal para configuracao
 * guiada por botoes.
 *
 * Totalmente generico e em memoria (leve). Expira em 5 min por padrao.
 *
 * Uso:
 *   const { SessionManager } = require('sonne-core')
 *   const sm = new SessionManager({ ttl: 5 * 60 * 1000 })
 *   sm.registrarHandler('definir_nome', async ({ valor, reply }) => {
 *     salvarNome(valor); reply('Nome salvo!')
 *   })
 *   // quando o dono clica no botao:
 *   sm.iniciar(jid, 'definir_nome')
 *   // ao chegar a proxima mensagem desse jid:
 *   const consumiu = await sm.processar(jid, texto, { reply, socket, from, info })
 */
class SessionManager {
  /**
   * @param {object} [opcoes]
   * @param {number} [opcoes.ttl=300000] tempo de vida da sessao em ms
   */
  constructor(opcoes = {}) {
    this.sessoes = new Map()
    this.ttl = opcoes.ttl || 5 * 60 * 1000
    this.callbacks = new Map()
  }

  /**
   * Registra um handler para uma acao.
   * handler recebe ({ jid, valor, dados, ...ctx }) e roda ao receber a resposta.
   */
  registrarHandler(acao, handler) {
    this.callbacks.set(acao, handler)
    return this
  }

  /** Inicia uma sessao de espera para um usuario. */
  iniciar(jid, acao, dados = {}) {
    this.sessoes.set(jid, { acao, dados, expira: Date.now() + this.ttl })
    return this
  }

  /** Sessao ativa do usuario (ou null se expirada/inexistente). */
  obter(jid) {
    const s = this.sessoes.get(jid)
    if (!s) return null
    if (Date.now() > s.expira) {
      this.sessoes.delete(jid)
      return null
    }
    return s
  }

  /** Encerra a sessao de um usuario. */
  encerrar(jid) { this.sessoes.delete(jid) }

  /** Usuario tem sessao ativa? */
  temSessao(jid) { return this.obter(jid) !== null }

  /**
   * Processa a mensagem de um usuario em sessao.
   * @returns {Promise<boolean>} true se consumiu a mensagem.
   */
  async processar(jid, valor, ctx = {}) {
    const sessao = this.obter(jid)
    if (!sessao) return false

    const v = (valor || '').trim()
    if (/^(cancelar|cancel|sair|voltar)$/i.test(v)) {
      this.encerrar(jid)
      if (ctx.reply) ctx.reply('✅ Operacao cancelada.')
      return true
    }

    const handler = this.callbacks.get(sessao.acao)
    if (!handler) {
      this.encerrar(jid)
      return false
    }

    try {
      await handler({ jid, valor: v, dados: sessao.dados, ...ctx })
    } catch (e) {
      if (ctx.reply) ctx.reply(`❌ Erro ao processar: ${e.message}`)
    } finally {
      this.encerrar(jid)
    }
    return true
  }

  /** Remove sessoes expiradas. */
  podar() {
    const agora = Date.now()
    for (const [jid, s] of this.sessoes) {
      if (agora > s.expira) this.sessoes.delete(jid)
    }
  }

  stats() {
    this.podar()
    return { sessoesAtivas: this.sessoes.size, handlers: this.callbacks.size }
  }
}

module.exports = SessionManager
