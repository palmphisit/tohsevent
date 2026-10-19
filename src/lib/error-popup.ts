// A tiny app-wide store for error popups: any client code calls showError(), and the
// <ErrorPopupHost/> mounted in the root layout renders them one at a time.

export interface ErrorPopup {
  id: number;
  title: string;
  message: string;
}

type Listener = (queue: ErrorPopup[]) => void;

let queue: ErrorPopup[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(queue);
}

/** Shows an error popup on the current page (repeats of the one already showing are dropped). */
export function showError(message: string, title = "เกิดข้อผิดพลาด"): void {
  if (queue.some((p) => p.message === message)) return;
  queue = [...queue, { id: nextId++, title, message }];
  emit();
}

export function dismissError(id: number): void {
  queue = queue.filter((p) => p.id !== id);
  emit();
}

export function subscribeErrors(listener: Listener): () => void {
  listeners.add(listener);
  listener(queue);
  return () => listeners.delete(listener);
}

/**
 * Thai text for the `?error=` codes Better Auth puts on the URL when a Google sign-in or
 * link fails (https://www.better-auth.com/docs/concepts/oauth).
 */
export const OAUTH_ERRORS: Record<string, { title: string; message: string }> = {
  account_already_linked_to_different_user: {
    title: "บัญชี Google นี้ใช้กับบัญชีอื่นอยู่แล้ว",
    message:
      "บัญชี Google ที่เลือกผูกอยู่กับผู้ใช้ Tohs Event อีกบัญชีหนึ่ง (เช่น เคยกด “ดำเนินการต่อด้วย Google” แล้วระบบสร้างบัญชีใหม่ให้) ให้ออกจากระบบแล้วเข้าสู่ระบบด้วย Google แทน หรือเลือกบัญชี Google อื่น",
  },
  account_not_linked: {
    title: "อีเมลนี้มีบัญชีอยู่แล้ว",
    message:
      "อีเมลนี้สมัครด้วยรหัสผ่านไว้แล้ว เข้าสู่ระบบด้วยอีเมลและรหัสผ่านก่อน แล้วกด “เชื่อม Google Drive” ในหน้าจัดการรูปเพื่อผูกบัญชี Google",
  },
  access_denied: { title: "ยกเลิกแล้ว", message: "คุณยกเลิกการเชื่อมต่อกับ Google" },
  email_does_not_match: {
    title: "อีเมลไม่ตรงกัน",
    message: "บัญชี Google ที่เลือกใช้อีเมลคนละอันกับบัญชีนี้ ลองเลือกบัญชี Google อื่น",
  },
  email_not_verified: { title: "อีเมลยังไม่ได้ยืนยัน", message: "บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล" },
  email_not_found: { title: "ไม่พบอีเมล", message: "Google ไม่ได้ส่งอีเมลของบัญชีมาให้ ลองเลือกบัญชีอื่น" },
  state_mismatch: {
    title: "หมดเวลาการเชื่อมต่อ",
    message: "การเชื่อมต่อกับ Google หมดเวลาหรือถูกเปิดจากแท็บอื่น ลองกดใหม่อีกครั้ง",
  },
  state_security_mismatch: {
    title: "หมดเวลาการเชื่อมต่อ",
    message: "การเชื่อมต่อกับ Google หมดเวลาหรือถูกเปิดจากแท็บอื่น ลองกดใหม่อีกครั้ง",
  },
  please_restart_the_process: { title: "ลองใหม่อีกครั้ง", message: "การเชื่อมต่อกับ Google ไม่สมบูรณ์ ลองกดใหม่อีกครั้ง" },
  unable_to_link_account: { title: "เชื่อมบัญชีไม่สำเร็จ", message: "ผูกบัญชี Google ไม่สำเร็จ ลองอีกครั้ง" },
  signup_disabled: { title: "สมัครด้วย Google ไม่ได้", message: "ตอนนี้ยังสมัครบัญชีใหม่ด้วย Google ไม่ได้" },
};

export const OAUTH_FALLBACK = { title: "เชื่อมต่อ Google ไม่สำเร็จ", message: "เกิดข้อผิดพลาดระหว่างเชื่อมต่อกับ Google ลองอีกครั้ง" };
