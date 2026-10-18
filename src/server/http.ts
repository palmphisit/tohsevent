import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: { code: "internal_error", message: "Something went wrong" } }, { status: 500 });
}

/** Wraps a route handler so thrown HttpErrors become JSON error responses. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function parseJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "invalid_body", z.prettifyError(parsed.error));
  return parsed.data;
}

export function parseObjectId(value: string, code = "not_found"): ObjectId {
  if (!ObjectId.isValid(value) || value.length !== 24) throw new HttpError(404, code);
  return new ObjectId(value);
}

/** Hashed client IP for abuse tracking without storing raw IPs (PDPA). */
export function clientIpHash(req: NextRequest): string | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("base64url").slice(0, 22);
}
