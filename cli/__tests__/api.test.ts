// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient } from '../api'

describe('createApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  describe('base URL resolution', () => {
    it('prefers the --api flag over env and default', async () => {
      vi.stubEnv('MY_HOLIDAY_API_URL', 'http://env.example/api/v1')
      const client = createApiClient({ api: 'http://flag.example/api/v1' })

      await client.request('/periods')

      expect(fetchMock).toHaveBeenCalledWith(
        'http://flag.example/api/v1/periods',
        expect.any(Object),
      )
    })

    it('falls back to MY_HOLIDAY_API_URL when no flag is given', async () => {
      vi.stubEnv('MY_HOLIDAY_API_URL', 'http://env.example/api/v1')
      const client = createApiClient()

      await client.request('/periods')

      expect(fetchMock).toHaveBeenCalledWith(
        'http://env.example/api/v1/periods',
        expect.any(Object),
      )
    })

    it('falls back to the localhost default when no flag or env is set', async () => {
      vi.stubEnv('MY_HOLIDAY_API_URL', undefined)
      const client = createApiClient()

      await client.request('/periods')

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/periods',
        expect.any(Object),
      )
    })
  })

  describe('authorization header', () => {
    it('sends a bearer token when one is provided', async () => {
      const client = createApiClient({ api: 'http://x', token: 'secret' })

      await client.request('/periods')

      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer secret')
    })

    it('omits the authorization header when no token is set', async () => {
      vi.stubEnv('MY_HOLIDAY_API_TOKEN', undefined)
      const client = createApiClient({ api: 'http://x' })

      await client.request('/periods')

      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(new Headers(init.headers).has('Authorization')).toBe(false)
    })
  })

  describe('error handling', () => {
    it('throws ApiError carrying status, body, and message on a non-2xx response', async () => {
      fetchMock.mockResolvedValue(new Response('not found', { status: 404 }))
      const client = createApiClient({ api: 'http://x' })

      const error = await client.request('/periods').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(404)
      expect((error as ApiError).body).toBe('not found')
      expect((error as ApiError).message).toContain('404')
    })
  })

  it('parses and returns the JSON body on success', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: '1' }]), { status: 200 }),
    )
    const client = createApiClient({ api: 'http://x' })

    const result = await client.request<{ id: string }[]>('/periods')

    expect(result).toEqual([{ id: '1' }])
  })

  describe('response robustness', () => {
    it('throws a wrapped ApiError, not a raw SyntaxError, when a 2xx body is not JSON', async () => {
      fetchMock.mockResolvedValue(new Response('not json', { status: 200 }))
      const client = createApiClient({ api: 'http://x' })

      const error = await client.request('/periods').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ApiError)
      expect(error).not.toBeInstanceOf(SyntaxError)
      expect((error as ApiError).message).toMatch(/json/i)
    })

    it('joins a trailing-slash base URL with a leading-slash path without doubling slashes', async () => {
      const client = createApiClient({ api: 'http://x/api/v1/' })

      await client.request('/periods')

      expect(fetchMock).toHaveBeenCalledWith(
        'http://x/api/v1/periods',
        expect.any(Object),
      )
    })
  })

  describe('requestText', () => {
    it('returns the raw body without JSON parsing', async () => {
      fetchMock.mockResolvedValue(new Response('BEGIN:VCALENDAR', { status: 200 }))
      const client = createApiClient({ api: 'http://x' })

      const text = await client.requestText('/export.ics')

      expect(text).toBe('BEGIN:VCALENDAR')
    })

    it('joins the URL and sends the auth header like request', async () => {
      const client = createApiClient({ api: 'http://x/api/v1/', token: 'secret' })

      await client.requestText('/export.csv')

      expect(fetchMock).toHaveBeenCalledWith('http://x/api/v1/export.csv', expect.any(Object))
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer secret')
    })

    it('throws ApiError on a non-2xx response', async () => {
      fetchMock.mockResolvedValue(new Response('boom', { status: 500 }))
      const client = createApiClient({ api: 'http://x' })

      const error = await client.requestText('/export.ics').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(500)
    })
  })
})
