/** Structured geocode failure from `/api/geocode` (never silent). */
export class GeocodeError extends Error {
  readonly code: 'rate_limited' | 'upstream' | 'bad_request' | 'network'
  readonly status: number

  constructor(
    message: string,
    opts: {
      code: GeocodeError['code']
      status: number
    },
  ) {
    super(message)
    this.name = 'GeocodeError'
    this.code = opts.code
    this.status = opts.status
  }

  static userMessage(err: unknown): string {
    if (err instanceof GeocodeError) {
      if (err.code === 'rate_limited') {
        return 'Search is rate-limited right now. Wait a moment and try again.'
      }
      if (err.code === 'bad_request') return err.message
      return err.message || 'Place search failed. Try again.'
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      return ''
    }
    if (err instanceof Error) return err.message
    return 'Place search failed. Try again.'
  }
}
