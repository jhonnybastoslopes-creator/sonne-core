/**
 * Cleanup - Limpeza automatica de arquivos temporarios numa VPS.
 *
 * Previne acumulo de lixo em disco (util em VPS com espaco limitado). Remove
 * arquivos antigos de um diretorio temp e, opcionalmente, trunca logs grandes.
 * Totalmente parametrizavel.
 *
 * Uso:
 *   const { Cleanup } = require('sonne-core')
 *   const c = new Cleanup({
 *     tempDir: './temp',
 *     intervaloMs: 60 * 60 * 1000,
 *     maxAgeMs: 2 * 60 * 60 * 1000,
 *     maxArquivos: 50,
 *     ignorar: ['#nadapraver'],
 *     logDirs: ['~/.pm2/logs'],   // logs > maxLogBytes serao truncados
 *     maxLogBytes: 10 * 1024 * 1024
 *   })
 *   c.start()  // c.stop() para parar
 */
const fs = require('fs')
const path = require('path')
const { log } = require('./logger.js')

class Cleanup {
  constructor(opcoes = {}) {
    this.tempDir = opcoes.tempDir || './temp'
    this.intervaloMs = opcoes.intervaloMs || 60 * 60 * 1000
    this.maxAgeMs = opcoes.maxAgeMs || 2 * 60 * 60 * 1000
    this.maxArquivos = opcoes.maxArquivos || 50
    this.ignorar = new Set(opcoes.ignorar || [])
    this.logDirs = opcoes.logDirs || []
    this.maxLogBytes = opcoes.maxLogBytes || 10 * 1024 * 1024
    this.timer = null
  }

  start() {
    if (this.timer) return this
    this.timer = setInterval(() => this.executar(), this.intervaloMs)
    if (this.timer.unref) this.timer.unref()
    log.info(`Cleanup iniciado. Intervalo: ${Math.round(this.intervaloMs / 60000)} min`)
    setTimeout(() => this.executar(), 10000)
    return this
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    return this
  }

  /** Executa a limpeza agora. @returns {object} { removidos, bytesLiberados } */
  executar() {
    let removidos = 0
    let bytesLiberados = 0
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true })
        return { removidos, bytesLiberados }
      }

      let arquivos = []
      for (const file of fs.readdirSync(this.tempDir)) {
        if (this.ignorar.has(file)) continue
        const filePath = path.join(this.tempDir, file)
        try {
          const stat = fs.statSync(filePath)
          if (stat.isFile()) arquivos.push({ path: filePath, mtime: stat.mtimeMs, size: stat.size })
        } catch (e) {}
      }

      const agora = Date.now()
      for (const arq of arquivos) {
        if (agora - arq.mtime > this.maxAgeMs) {
          try { fs.unlinkSync(arq.path); removidos++; bytesLiberados += arq.size } catch (e) {}
        }
      }

      arquivos = arquivos.filter(a => fs.existsSync(a.path))
      if (arquivos.length > this.maxArquivos) {
        arquivos.sort((a, b) => a.mtime - b.mtime)
        const excedente = arquivos.length - this.maxArquivos
        for (let i = 0; i < excedente; i++) {
          try { fs.unlinkSync(arquivos[i].path); removidos++; bytesLiberados += arquivos[i].size } catch (e) {}
        }
      }

      this._truncarLogs()

      if (removidos > 0) {
        const mb = (bytesLiberados / 1024 / 1024).toFixed(2)
        log.success(`Cleanup: ${removidos} arquivo(s) removido(s), ${mb}MB liberado(s)`)
      }
    } catch (err) {
      log.error(`Cleanup erro: ${err.message}`)
    }
    return { removidos, bytesLiberados }
  }

  _truncarLogs() {
    for (const dir of this.logDirs) {
      const resolvido = dir.startsWith('~')
        ? path.join(process.env.HOME || process.env.USERPROFILE || '', dir.slice(1))
        : dir
      if (!resolvido || !fs.existsSync(resolvido)) continue
      try {
        for (const file of fs.readdirSync(resolvido)) {
          if (!file.endsWith('.log')) continue
          const fp = path.join(resolvido, file)
          try {
            if (fs.statSync(fp).size > this.maxLogBytes) {
              fs.truncateSync(fp, 0)
              log.info(`Log truncado: ${file}`)
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
  }
}

module.exports = Cleanup
