# HospiQ Architecture Diagrams

All diagrams are authored in Mermaid (`.mmd`) and rendered to SVG with dark theme.

## Diagrams

| Diagram | Source | Description |
|---------|--------|-------------|
| [Architecture Overview](architecture.svg) | [architecture.mmd](architecture.mmd) | 10-service Docker Compose architecture showing all layers: Gateway, Application, AI, Data, and Observability with protocol-labeled connections |
| [Voice Request Lifecycle](request-lifecycle.svg) | [request-lifecycle.mmd](request-lifecycle.mmd) | Full sequence from guest voice recording through transcription, AI classification, staff routing, and real-time status updates |
| [SLA Escalation Flow](escalation-flow.svg) | [escalation-flow.mmd](escalation-flow.mmd) | Timer-based escalation sequence when SLA thresholds are breached, including manager notification |
| [Circuit Breaker](circuit-breaker.svg) | [circuit-breaker.mmd](circuit-breaker.mmd) | State diagram for AI service circuit breaker pattern (CLOSED / OPEN / HALF_OPEN) with fallback behavior |
| [Data Model (ERD)](data-model.svg) | [data-model.mmd](data-model.mmd) | Entity-relationship diagram covering organizations, users, requests, workflows, transcriptions, AI classifications, and integrations |
| [Integration Dispatch](integration-flow.svg) | [integration-flow.mmd](integration-flow.mmd) | Adapter-based integration dispatch flow with per-provider payload mapping and retry logic |
| [Real-Time Communication](realtime-flow.svg) | [realtime-flow.mmd](realtime-flow.mmd) | Redis Pub/Sub channels feeding SSE (guest) and WebSocket (staff) connections through the Elysia API |

## Regenerating

To regenerate all SVGs after editing a `.mmd` file:

```bash
for f in docs/diagrams/*.mmd; do
  mmdc -i "$f" -o "${f%.mmd}.svg" -t dark -b transparent
done
```
