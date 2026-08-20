/**
 * @schedio/connector-airflow — maps an Airflow 3 instance into Schedio's
 * model. One export you need:
 *
 *   import { createAirflowConnector } from "@schedio/connector-airflow";
 *   const connector = createAirflowConnector({ id: "airflow-prod", baseUrl, auth });
 *   <GlanceView connector={connector} />
 *
 * See the README for config options, the DAG->Job mapping, and known
 * limitations.
 */
export { createAirflowConnector } from "./connector";
export type { AirflowAuth, AirflowBasicAuth, AirflowTokenAuth, AirflowConnectorConfig, AirflowScopeStrategy } from "./types";
