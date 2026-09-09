import type { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import type { IncomingMessage } from "node:http";
import type { ServerOptions } from "socket.io";
import { AuthService } from "../auth/auth.service";
import { readSessionToken } from "../auth/session-token";

export class SecureSocketIoAdapter extends IoAdapter {
  private readonly auth: AuthService;

  constructor(
    app: INestApplicationContext,
    private readonly allowedOrigins: string[]
  ) {
    super(app);
    this.auth = app.get(AuthService);
  }

  override createIOServer(port: number, options?: Partial<ServerOptions>) {
    const allowed = new Set(this.allowedOrigins);
    const secureOptions = {
      ...options,
      path: options?.path ?? "/socket.io",
      allowRequest: (
        request: IncomingMessage,
        callback: (error: string | null | undefined, success: boolean) => void
      ) => {
        const origin = request.headers.origin;
        if (typeof origin !== "string" || !allowed.has(origin)) {
          callback(null, false);
          return;
        }
        void this.auth
          .getUserFromToken(
            readSessionToken(request.headers.cookie, request.headers.authorization)
          )
          .then(() => callback(null, true))
          .catch(() => callback(null, false));
      },
      cors: {
        origin: this.allowedOrigins,
        credentials: true,
        methods: ["GET", "POST"]
      }
    } satisfies Partial<ServerOptions>;

    // Nest 12 declares this parameter as ServerOptions, while Socket.IO's
    // constructor intentionally accepts Partial<ServerOptions> and fills defaults.
    return super.createIOServer(port, secureOptions as ServerOptions);
  }
}
