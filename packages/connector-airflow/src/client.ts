import type { AirflowAuth, AirflowDag, AirflowDagRun } from "./types";

function authHeader(auth: AirflowAuth): string {
  if (auth.type === "token") return `Bearer ${auth.token}`;
  const encoded =
    typeof btoa === "function"
      ? btoa(`${auth.username}:${auth.password}`)
      : Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
  return `Basic ${encoded}`;
}

export interface AirflowClientOptions {
  baseUrl: string;
  auth: AirflowAuth;
  fetchImpl: typeof fetch;
}

/** A thin wrapper over Airflow 3's REST API (`/api/v2/...`) — no dependency beyond `fetch`. */
export class AirflowClient {
  constructor(private readonly options: AirflowClientOptions) {}

  private async get<T>(path: string): Promise<T> {
    const res = await this.options.fetchImpl(`${this.options.baseUrl}${path}`, {
      headers: { Authorization: authHeader(this.options.auth), Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Airflow API request to ${path} failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  async listDags(limit = 200): Promise<AirflowDag[]> {
    const data = await this.get<{ dags: AirflowDag[] }>(`/api/v2/dags?limit=${limit}`);
    return data.dags;
  }

  async listDagRuns(dagId: string, limit: number): Promise<AirflowDagRun[]> {
    const data = await this.get<{ dag_runs: AirflowDagRun[] }>(
      `/api/v2/dags/${encodeURIComponent(dagId)}/dagRuns?limit=${limit}&order_by=-logical_date`,
    );
    return data.dag_runs;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await this.options.fetchImpl(`${this.options.baseUrl}/api/v2/monitor/health`, {
        headers: { Authorization: authHeader(this.options.auth), Accept: "application/json" },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
