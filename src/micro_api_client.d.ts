declare module 'micro-api-client' {
  export class JSONHTTPError extends Error {
    json: {
      msg?: string;
      error?: string;
      error_description?: string;
    };
  }

  export interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    audience?: string;
  }

  export default class API {
    apiURL: string;
    defaultHeaders: Record<string, string>;

    constructor(url: string, options?: Record<string, unknown>);
    request<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  }
}
