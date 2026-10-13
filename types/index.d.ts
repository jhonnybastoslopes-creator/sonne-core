// Definições de tipos do sonne-core.

export type LogFn = (...args: any[]) => void

export interface Logger {
  debug?: LogFn
  info?: LogFn
  success?: LogFn
  warn?: LogFn
  error?: LogFn
}

export function setLogger(logger: Logger | null): void
export function enableConsoleLogger(): void
export const log: Required<Logger>

// ===== Buttons =====
export interface Botao {
  name: string
  buttonParamsJson: string
}

export interface SecaoLista {
  title: string
  rows: Array<{ header?: string; title: string; description?: string; id: string }>
}

export interface EnviarBotoesOpcoes {
  texto?: string
  titulo?: string
  rodape?: string
  botoes?: Botao[]
  imagem?: any
  modo?: 'nativo' | 'texto' | 'ambos'
}

export namespace Buttons {
  function quickReply(displayText: string, id: string): Botao
  function urlButton(displayText: string, url: string): Botao
  function copyButton(displayText: string, copyCode: string): Botao
  function callButton(displayText: string, phoneNumber: string): Botao
  function listButton(title: string, secoes: SecaoLista[]): Botao
  function enviar(socket: any, from: string, info: any, opcoes?: EnviarBotoesOpcoes): Promise<boolean>
  function enviarNativo(socket: any, from: string, opcoes: EnviarBotoesOpcoes): Promise<boolean>
  function enviarCapturandoKey(socket: any, from: string, opcoes: EnviarBotoesOpcoes): Promise<any | null>
  function montarMenuTexto(texto: string, botoes: Botao[], rodape: string): string
  function buildMixedNativeFlowBizNode(): any
}

// ===== AntiBan =====
export interface AntiBanPerfil {
  maxPorMinuto: number
  maxPorHora: number
  maxPorDia: number
  delayBaseMs: number
  delayJitterMs: number
  minIntervaloDestinoMs: number
}

export interface AntiBanStore {
  read(): any
  write(estado: any): void
}

export interface AntiBanOpcoes {
  perfil?: 'seguro' | 'equilibrado' | 'turbo'
  config?: Partial<AntiBanPerfil> & Record<string, any>
  store?: AntiBanStore
  onCooldown?: (info: { minutos: number; erro: string; saude?: number }) => void
  testMode?: boolean
  adaptativo?: boolean
  saudeInicial?: number
}

export class AntiBan {
  static readonly PERFIS: Record<'seguro' | 'equilibrado' | 'turbo', AntiBanPerfil>
  saude: number
  constructor(opcoes?: AntiBanOpcoes)
  setSocket(socket: any): this
  set(chave: string, valor: any): this
  enfileirar(destino: string, conteudo: any, opcoes?: { quoted?: any; prioridade?: boolean }): Promise<{ sucesso: boolean; erro?: string }>
  podeEnviar(destino?: string): { ok: boolean; motivo?: string; esperar?: number }
  aplicarPerfil(nome: string): { ok: boolean; perfil?: string; valores?: AntiBanPerfil; erro?: string }
  perfilAtual(): string
  status(): Record<string, any>
  variarTexto(texto: string): string
  diasOperando(): number
  fatorWarmup(): number
  fatorAdaptativoDelay(): number
  fatorAdaptativoLimite(): number
  limparFila(): void
  resetarEstado(): void
}

// ===== RateLimiter =====
export interface RateLimiterOpcoes {
  maxComandos?: number
  janelaMs?: number
  cooldownMs?: number
}

export class RateLimiter {
  constructor(opcoes?: RateLimiterOpcoes)
  configurar(opcoes: RateLimiterOpcoes): this
  verificar(sender: string, isDono?: boolean): { permitido: boolean; motivo?: string; avisar?: boolean }
  limpar(): void
  stats(): { usuariosRastreados: number }
}

// ===== Storage =====
export class Storage {
  constructor()
  withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T>
  readJSON<T = any>(filePath: string, fallback?: T): T
  writeJSON(filePath: string, data: any): boolean
  updateJSON<T = any>(filePath: string, mutator: (data: T) => T, fallback?: T): T
  updateJSONSafe<T = any>(filePath: string, mutator: (data: T) => T | Promise<T>, fallback?: T): Promise<T>
  ensureJSON<T = any>(filePath: string, inicial?: T): T
  clearCache(): void
}

// ===== DB =====
export interface DBOpcoes {
  path?: string
}

export class DB {
  constructor(opcoes?: DBOpcoes)
  readonly disponivel: boolean
  init(): boolean
  set(colecao: string, id: string, value: any): boolean
  get<T = any>(colecao: string, id: string): T | null
  del(colecao: string, id: string): boolean
  all<T = any>(colecao: string): Record<string, T>
  entries<T = any>(colecao: string): Array<[string, T]>
  count(colecao: string): number
  stats(): { ativo: boolean; tamanhoKB?: number; tabelas?: Record<string, number> }
  podarPorIdade(colecao: string, diasMax?: number): number
  compactar(): boolean
  setMeta(chave: string, value: any): boolean
  getMeta<T = any>(chave: string, padrao?: T): T
  importarSeVazio(colecao: string, objeto: Record<string, any>): number
  close(): void
}

// ===== Scheduler =====
export class Scheduler {
  constructor()
  horaAtual(date?: Date): string
  add(hhmm: string, fn: (hora: string) => void | Promise<void>): boolean
  remove(hhmm: string, fn?: Function): boolean
  onTick(fn: (hora: string) => void | Promise<void>): this
  listar(): string[]
  start(): this
  stop(): this
  tick(date?: Date): Promise<void>
}

// ===== SessionManager =====
export interface SessionManagerOpcoes {
  ttl?: number
}

export class SessionManager {
  constructor(opcoes?: SessionManagerOpcoes)
  registrarHandler(acao: string, handler: (ctx: any) => void | Promise<void>): this
  iniciar(jid: string, acao: string, dados?: any): this
  obter(jid: string): { acao: string; dados: any; expira: number } | null
  encerrar(jid: string): void
  temSessao(jid: string): boolean
  processar(jid: string, valor: string, ctx?: any): Promise<boolean>
  podar(): void
  stats(): { sessoesAtivas: number; handlers: number }
}

// ===== GroupCache =====
export interface GroupCacheOpcoes {
  ttl?: number
  maxEntradas?: number
}

export class GroupCache {
  constructor(opcoes?: GroupCacheOpcoes)
  configurar(opcoes: GroupCacheOpcoes): this
  get(socket: any, jid: string): Promise<any>
  set(jid: string, data: any): void
  invalidar(jid: string): void
  podarExpirados(): number
  limpar(): void
  stats(): { entradas: number; hits: number; misses: number; taxaAcerto: string }
}

// ===== Cleanup =====
export interface CleanupOpcoes {
  tempDir?: string
  intervaloMs?: number
  maxAgeMs?: number
  maxArquivos?: number
  ignorar?: string[]
  logDirs?: string[]
  maxLogBytes?: number
}

export class Cleanup {
  constructor(opcoes?: CleanupOpcoes)
  start(): this
  stop(): this
  executar(): { removidos: number; bytesLiberados: number }
}
