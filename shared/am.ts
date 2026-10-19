export type AmAccountStatus = "creating" | "ready" | "failed" | "deleted";
export interface AmAccount {
  id: string;
  email: string | null;
  domain: string;
  status: AmAccountStatus;
  created_at: string;
  updated_at: string;
  inbox_count: number;
}
export interface AmMessage {
  id: string;
  provider_message_id: string;
  sender: string;
  subject: string;
  preview: string;
  received_at: string | null;
}
export interface AmMessageDetail {
  id: string;
  sender: string;
  subject: string;
  received_at: string | null;
  html: string | null;
  text: string | null;
  raw: string | null;
  otps: string[];
  links: { url: string; authentication: boolean }[];
  alight_candidate: boolean;
}
export interface AmWorkflow {
  id: string;
  account_id: string;
  status: string;
  current_step: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
export interface AmActivity {
  id: string;
  action: string;
  status: string;
  created_at: string;
}
export interface AmDomain {
  name: string;
  is_active: boolean;
}
export interface AmPage<T> {
  items: T[];
  next_cursor: string | null;
}
export interface AmService {
  private_admin?: boolean;
  database: boolean;
  inbox_adapter: boolean;
  detail_adapter: boolean;
  authorization: {
    valid: boolean;
    scopes: string[];
    reason: string;
    reference: string | null;
  };
  provider_contract: boolean;
  actions: Record<
    "send" | "verify" | "apply",
    { ready: boolean; reason: string }
  >;
  max_accounts: number;
}
export interface AmAccountDetail {
  account: AmAccount;
  workflows: AmWorkflow[];
  activity: AmActivity[];
  activity_next_cursor: string | null;
}
