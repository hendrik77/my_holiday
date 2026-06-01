const DEFAULT_API_URL = 'http://localhost:3001/api/v1'

export interface ApiClientOptions {
  /** Base URL of the API; overrides MY_HOLIDAY_API_URL and the default. */
  readonly api?: string
  /** Bearer token; overrides MY_HOLIDAY_API_TOKEN. */
  readonly token?: string
}

export interface ApiClient {
  /** Send a request and parse the JSON response body. */
  request<T>(path: string, init?: RequestInit): Promise<T>
  /** Send a request and return the raw response body (e.g. ICS/CSV exports). */
  requestText(path: string, init?: RequestInit): Promise<string>
}

/** Thrown when the API responds with a non-2xx status. */
export class ApiError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/**
 * Build an HTTP client bound to a base URL and optional bearer token.
 *
 * Base URL precedence: `options.api` > `MY_HOLIDAY_API_URL` > localhost default.
 * Token precedence: `options.token` > `MY_HOLIDAY_API_TOKEN` > none.
 */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = options.api ?? process.env.MY_HOLIDAY_API_URL ?? DEFAULT_API_URL
  const token = options.token ?? process.env.MY_HOLIDAY_API_TOKEN

  async function send(path: string, init: RequestInit = {}): Promise<{ status: number; body: string }> {
    const headers = new Headers(init.headers)
    if (init.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
    const response = await fetch(url, { ...init, headers })
    const body = await response.text()

    if (!response.ok) {
      throw new ApiError(
        response.status,
        body,
        `Request to ${path} failed with status ${response.status}`,
      )
    }

    return { status: response.status, body }
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { status, body } = await send(path, init)
    if (!body) {
      return undefined as T
    }
    try {
      return JSON.parse(body) as T
    } catch {
      throw new ApiError(
        status,
        body,
        `Request to ${path} returned ${status} but the body was not valid JSON`,
      )
    }
  }

  async function requestText(path: string, init?: RequestInit): Promise<string> {
    const { body } = await send(path, init)
    return body
  }

  return { request, requestText }
}
