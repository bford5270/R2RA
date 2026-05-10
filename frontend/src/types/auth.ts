export interface AuthUser {
  id: string
  display_name: string
  email: string
  global_role: string
  totp_enrolled: boolean
}

export interface LoginResponse {
  access_token: string
  token_type: string
  totp_required: boolean
}
