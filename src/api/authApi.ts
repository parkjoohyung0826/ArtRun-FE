import {API_BASE_URL} from '../config';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface UserResponse {
  userId: string;
  email: string;
  nickname: string;
  profileImageUrl?: string;
  provider?: string;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  isNewUser?: boolean;
  user: UserResponse;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest extends LoginRequest {
  nickname: string;
}

export interface SocialLoginRequest {
  provider: 'KAKAO' | 'GOOGLE';
  providerAccessToken: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown network error';
    throw new Error(`서버 연결 실패: ${message}`);
  }

  const bodyText = await response.text().catch(() => '');
  const body = bodyText
    ? (() => {
        try {
          return JSON.parse(bodyText);
        } catch {
          return null;
        }
      })()
    : null;

  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || `HTTP ${response.status}: API 요청 실패`);
  }

  return body;
}

function authHeaders(accessToken?: string) {
  return accessToken ? {Authorization: `Bearer ${accessToken}`} : undefined;
}

export function login(request: LoginRequest) {
  return requestJson<ApiResponse<AuthResponse>>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function signup(request: SignupRequest) {
  return requestJson<ApiResponse<AuthResponse>>('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function refreshToken(refreshTokenValue: string) {
  return requestJson<ApiResponse<AuthResponse>>('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({refreshToken: refreshTokenValue}),
  });
}

export function logout(accessToken?: string) {
  return requestJson<ApiResponse<null>>('/api/v1/auth/logout', {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function withdraw(accessToken?: string) {
  return requestJson<ApiResponse<null>>('/api/v1/auth/withdraw', {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function socialLogin(request: SocialLoginRequest) {
  return requestJson<ApiResponse<AuthResponse>>('/api/v1/auth/social-login', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
