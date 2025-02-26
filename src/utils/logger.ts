type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

export interface GlobalLogs {
  type: "create" | "update" | "delete" | string;
  module: "products" | "orders" | "customers" | string;
  date: Date;
  id: number | string;
  statut: "success" | "failed" | string;
  companyId: string,
}

export class Logger {
  private log(level: LogLevel, message: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    switch (level) {
      case "info":
        console.log(JSON.stringify(entry));
        break;
      case "warn":
        console.warn(JSON.stringify(entry));
        break;
      case "error":
        console.error(JSON.stringify(entry));
        break;
      case "debug":
        console.debug(JSON.stringify(entry));
        break;
    }
  }

  info(message: string, data?: unknown) {
    this.log("info", message, data);
  }

  warn(message: string, data?: unknown) {
    this.log("warn", message, data);
  }

  error(message: string, data?: unknown) {
    this.log("error", message, data);
  }

  debug(message: string, data?: unknown) {
    if (process.env.NODE_ENV !== "production") {
      this.log("debug", message, data);
    }
  }
}

// Create a singleton instance
export default new Logger();
