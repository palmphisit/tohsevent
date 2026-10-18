import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

// Better Auth endpoints: /api/auth/sign-up/email, /api/auth/sign-in/email, /api/auth/sign-out, ...
export const { GET, POST } = toNextJsHandler((request: Request) => auth().handler(request));
