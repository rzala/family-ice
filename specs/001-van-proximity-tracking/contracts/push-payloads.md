# Contract: Push Notification Payloads (background alerts)

Behind the `PushService` port (Principle I). Local: Expo Push. Cloud: SNS / Azure Notification Hubs /
FCM. Each payload corresponds to a de-duplicated proximity-state transition or a stop confirmation
(Principle IV — at most one per state per visit).

## Proximity alerts (user role)

### `approaching`
```json
{ "to": "ExponentPushToken[…]",
  "title": "🍦 Coming to your street",
  "body": "Family Ice is about 5 min away",
  "data": { "kind": "proximity", "state": "approaching", "vanId": "5f1c…", "etaSeconds": 300 } }
```

### `arriving`
```json
{ "to": "ExponentPushToken[…]",
  "title": "Family Ice is arriving",
  "body": "The van is reaching your street",
  "data": { "kind": "proximity", "state": "arriving", "vanId": "5f1c…" } }
```

### `here`
```json
{ "to": "ExponentPushToken[…]",
  "title": "The van is here! 🍦",
  "body": "Family Ice has arrived near you",
  "data": { "kind": "proximity", "state": "here", "vanId": "5f1c…" } }
```

## Stop confirmation (user role) — FR-010
```json
{ "to": "ExponentPushToken[…]",
  "title": "We're stopping near you",
  "body": "The driver confirmed your stop — head out!",
  "data": { "kind": "stop", "vanId": "5f1c…", "lat": 47.1755, "lng": 18.9971 } }
```

## Delivery rules
- Exactly one push per `(visit, state)` — backend checks the `notifications` unique constraint before
  calling `PushService.send` (FR-005).
- If `pushToken` is null, no push is attempted; the live map remains the experience (FR-004 / Edge).
- `data.kind` lets the app route a tapped notification to the correct screen (map vs. stop banner).
