/**
 * services/apiClient.js — Reusable API Client with Auth
 * 
 * Centralised HTTP client for all backend communication.
 * Automatically attaches the Supabase access_token as a Bearer token.
 * Returns { data, error } tuples — never throws.
 * 
 * Depends on: services/auth.js (window.SecondBrainAuth)
 * 
 * Configuration:
 *   window.__ENV__.BACKEND_URL = 'http://127.0.0.1:8000'  (optional, has default)
 */

(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────────────
  const ENV = window.__ENV__ || {};
  const BASE_URL = (ENV.BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

  /**
   * Core request function.
   * @param {string} endpoint - API path (e.g. '/api/integrations/status')
   * @param {object} options
   * @param {string} [options.method='GET']
   * @param {object} [options.body] - Request body (will be JSON.stringify'd)
   * @param {object} [options.headers] - Additional headers
   * @param {boolean} [options.auth=true] - Whether to attach Bearer token
   * @returns {Promise<{data: any, error: string|null}>}
   */
  async function request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      auth = true,
    } = options;

    // Build headers
    const reqHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers,
    };

    // Attach auth token if requested and available
    if (auth && window.SecondBrainAuth) {
      try {
        const token = await window.SecondBrainAuth.getAccessToken();
        if (token) {
          reqHeaders['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('[apiClient] Failed to get access token:', err);
      }
    }

    // Build fetch options
    const fetchOpts = {
      method,
      headers: reqHeaders,
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const url = `${BASE_URL}${endpoint}`;
      const response = await fetch(url, fetchOpts);

      // Try to parse JSON response
      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMsg = (typeof data === 'object' && data?.detail)
          ? data.detail
          : `HTTP ${response.status}: ${response.statusText}`;
        console.warn(`[apiClient] ${method} ${endpoint} → ${response.status}`, errorMsg);
        return { data: null, error: errorMsg };
      }

      return { data, error: null };
    } catch (err) {
      // Network error, CORS issue, etc.
      const errorMsg = err.message || 'Network request failed';
      console.error(`[apiClient] ${method} ${endpoint} failed:`, errorMsg);
      return { data: null, error: errorMsg };
    }
  }

  // ── Convenience methods ────────────────────────────────────

  /**
   * GET request
   * @param {string} endpoint
   * @param {object} [options]
   * @returns {Promise<{data: any, error: string|null}>}
   */
  function get(endpoint, options = {}) {
    return request(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   * @param {string} endpoint
   * @param {object} body
   * @param {object} [options]
   * @returns {Promise<{data: any, error: string|null}>}
   */
  function post(endpoint, body = {}, options = {}) {
    return request(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   * @param {string} endpoint
   * @param {object} body
   * @param {object} [options]
   * @returns {Promise<{data: any, error: string|null}>}
   */
  function put(endpoint, body = {}, options = {}) {
    return request(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE request
   * @param {string} endpoint
   * @param {object} [options]
   * @returns {Promise<{data: any, error: string|null}>}
   */
  function del(endpoint, options = {}) {
    return request(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Upload a file via multipart/form-data.
   * @param {string} endpoint - API path (e.g. '/api/ingest/pdf')
   * @param {File} file - The File object from an input element
   * @param {object} [extraFields] - Additional form fields (key-value pairs)
   * @param {function} [onProgress] - Progress callback (0-100)
   * @returns {Promise<{data: any, error: string|null}>}
   */
  async function uploadFile(endpoint, file, extraFields = {}, onProgress = null) {
    const formData = new FormData();
    formData.append('file', file);

    // Append any extra form fields
    for (const [key, value] of Object.entries(extraFields)) {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    }

    // Build headers (NO Content-Type — browser sets it with boundary)
    const reqHeaders = {};
    if (window.SecondBrainAuth) {
      try {
        const token = await window.SecondBrainAuth.getAccessToken();
        if (token) {
          reqHeaders['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('[apiClient] Failed to get access token:', err);
      }
    }

    try {
      const url = `${BASE_URL}${endpoint}`;

      if (onProgress && typeof XMLHttpRequest !== 'undefined') {
        // Use XHR for progress tracking
        return new Promise((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', url);
          for (const [k, v] of Object.entries(reqHeaders)) {
            xhr.setRequestHeader(k, v);
          }
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          });
          xhr.addEventListener('load', () => {
            try {
              const data = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve({ data, error: null });
              } else {
                resolve({ data: null, error: data.detail || `HTTP ${xhr.status}` });
              }
            } catch {
              resolve({ data: null, error: `HTTP ${xhr.status}` });
            }
          });
          xhr.addEventListener('error', () => {
            resolve({ data: null, error: 'Network error during upload' });
          });
          xhr.send(formData);
        });
      }

      // Fallback to fetch (no progress)
      const response = await fetch(url, {
        method: 'POST',
        headers: reqHeaders,
        body: formData,
      });

      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMsg = (typeof data === 'object' && data?.detail)
          ? data.detail
          : `HTTP ${response.status}: ${response.statusText}`;
        return { data: null, error: errorMsg };
      }

      return { data, error: null };
    } catch (err) {
      return { data: null, error: err.message || 'Upload failed' };
    }
  }

  // ── Public API ─────────────────────────────────────────────
  window.SecondBrainAPI = {
    request,
    get,
    post,
    put,
    delete: del,
    uploadFile,
    BASE_URL,
  };
})();
