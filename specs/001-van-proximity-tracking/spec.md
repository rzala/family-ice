# Feature Specification: Van Proximity Tracking & Alerts

**Feature Branch**: `001-van-proximity-tracking`  
**Created**: 2026-06-22  
**Status**: Draft  
**Input**: Real-time ice cream van tracking POC ("Family Ice"): a live map of the van, tiered
proximity alerts (approaching / arriving / here), push notifications, and bidirectional
hand-raise / stop-here signaling between users and the driver; demonstrated against a van
approaching Kert utca 14, 2340 Kiskunlácháza.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the van and know it's coming to my street (Priority: P1)

A resident opens the app and sees the ice cream van moving on a live map. Even while the van is
still several streets away, the app tells them it is heading their way and roughly how long until
it reaches them, so they can decide whether to wait outside.

**Why this priority**: This is the core value and the heart of the demo — "the van is coming to
your street." It is viewable on its own and delivers value without any notifications or
interaction. Everything else builds on the live position feed.

**Independent Test**: Start the van moving along a route toward the resident's location and confirm
the app shows the van moving in near-real-time and surfaces a "coming to your street" indication
with an estimated arrival time while the van is still far away.

**Acceptance Scenarios**:

1. **Given** a resident has the app open and a van is on duty, **When** the van moves, **Then** the
   van's marker updates on the map within a couple of seconds.
2. **Given** the van is 1–3 km away and heading toward the resident, **When** the resident views the
   app, **Then** they see a "coming to your street" indication with an estimated time of arrival.
3. **Given** the van is far away and heading *away* from the resident, **When** the resident views
   the app, **Then** no "coming to your street" indication is shown.

---

### User Story 2 - Get notified as the van gets close (Priority: P2)

A resident does not need to keep the app open. As the van crosses meaningful distance thresholds,
they receive push notifications: first that the van is approaching, then that it is arriving on
their street, then that it has arrived — without being spammed by repeated alerts.

**Why this priority**: Notifications turn the live map into something useful in daily life and make
the demo compelling on a phone in someone's pocket. It depends on the position feed from P1.

**Independent Test**: With the app backgrounded, drive the van through the approaching → arriving →
here distances and confirm exactly one push notification per state arrives, in order.

**Acceptance Scenarios**:

1. **Given** a resident is subscribed to a van and the app is backgrounded, **When** the van comes
   within the "arriving" distance, **Then** the resident receives an "arriving" push notification.
2. **Given** the van has already triggered an "arriving" notification on this visit, **When** the van
   keeps sending positions within the same distance band, **Then** the resident receives no further
   "arriving" notifications for that visit.
3. **Given** the van reaches the resident's immediate vicinity, **When** it arrives, **Then** the
   resident receives a "the van is here" notification and the map highlights its arrival.

---

### User Story 3 - Raise my hand and have the driver stop (Priority: P3)

A resident taps "I want ice cream" to raise their hand, signalling they want the van to stop near
them. The driver sees waiting customers grouped by location and can confirm "I'll stop here," which
is communicated back to the waiting residents.

**Why this priority**: This completes the two-way experience and is the most interactive part of the
demo, but the product still delivers value (tracking + alerts) without it.

**Independent Test**: From a user device, raise a hand; confirm the driver device shows the request
with its location; have the driver confirm a stop; confirm the waiting user is told the van is
stopping.

**Acceptance Scenarios**:

1. **Given** a resident is near an on-duty van, **When** they raise their hand, **Then** the driver
   sees a stop request associated with that location.
2. **Given** several residents on the same street raise their hands, **When** the driver views
   requests, **Then** the requests are grouped so the driver sees how many people are waiting where.
3. **Given** the driver confirms a stop, **When** the confirmation is sent, **Then** the waiting
   residents are notified that the van is stopping near them.

---

### Edge Cases

- **Van goes offline / loses signal** mid-route: the app indicates the van's last-known position is
  stale rather than showing it frozen as if live.
- **Van approaches then leaves without stopping**: proximity state resets so that a later genuine
  approach can re-trigger notifications, but the user is not spammed during the single fly-by.
- **Out-of-order or duplicate position updates**: the system ignores stale positions and does not
  emit duplicate notifications.
- **User outside any van's range**: the user sees no proximity indications or alerts.
- **Van physically near a user but heading away**: no "coming to your street" indication (heading is
  considered, not distance alone).
- **Multiple hand-raises at one location**: shown to the driver as a single grouped, counted request.
- **Notification permission denied**: live-map experience still works; the user is informed alerts
  are off.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a van's current location on a map and update it in near-real-time
  while the app is open.
- **FR-002**: System MUST indicate to a subscribed user that a van is approaching their area while it
  is still too far to be "arriving," including an estimated time of arrival.
- **FR-003**: System MUST classify a van's proximity to a user into three ordered states —
  *approaching*, *arriving*, and *here* — based on distance and the van's direction of travel.
- **FR-004**: System MUST notify a subscribed user when a van enters a proximity state relevant to
  them, including when the app is not in the foreground.
- **FR-005**: System MUST deliver each proximity-state notification to a given user at most once per
  van visit, suppressing repeats while the van remains in the same state.
- **FR-006**: Users MUST be able to subscribe to a van so they receive its proximity alerts.
- **FR-007**: Users MUST be able to raise a hand to signal they want a van to stop near their current
  location.
- **FR-008**: System MUST deliver hand-raise signals to the on-duty driver, grouped and counted by
  location.
- **FR-009**: A driver MUST be able to go on duty and broadcast their live location.
- **FR-010**: A driver MUST be able to confirm a stop, and that confirmation MUST be communicated back
  to the waiting users who raised their hands.
- **FR-011**: System MUST support two roles — *user* and *driver* — within a single application.
- **FR-012**: System MUST support a repeatable demonstration in which a van follows a fixed approach
  route to a fixed destination and triggers each proximity state in sequence.
- **FR-013**: System MUST use user location only for proximity computation and hand-raise handling,
  and MUST NOT retain precise user location history beyond what a hand-raise requires.
- **FR-014**: System MUST indicate when a van's position is stale (no recent update) rather than
  presenting it as current.

### Key Entities *(include if feature involves data)*

- **Van**: An ice cream van that can be on or off duty; has an identity, a current status, and a
  most-recent known position.
- **Van Position**: A timestamped location (with direction/speed) reported by a van as it moves.
- **User**: A resident who can view vans, subscribe, and raise their hand; has a location used for
  proximity and a way to receive notifications.
- **Subscription**: A link between a user and a van expressing that the user wants that van's alerts,
  with the distance at which they care.
- **Proximity Event**: A transition of a van into one of the *approaching / arriving / here* states
  relative to a specific user; the basis for a notification.
- **Hand-Raise**: A user's request, tied to a location and time, for a van to stop nearby; has a
  status (pending / acknowledged).
- **Stop Confirmation**: A driver's acknowledgement that they will stop, linked back to the
  hand-raises it satisfies.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user sees the van's position update on the map within ~2 seconds of the van moving.
- **SC-002**: A user is shown a "coming to your street" indication with an ETA whenever the van is
  roughly 1–3 km away and heading toward them.
- **SC-003**: A user receives an "arriving" alert by the time the van is within ~300 m, and a "here"
  alert by the time it is within ~50 m.
- **SC-004**: A user receives no more than one notification per proximity state per van visit.
- **SC-005**: After a user raises their hand, the driver sees the request within ~5 seconds, and the
  user sees the driver's stop confirmation within ~5 seconds.
- **SC-006**: The canonical demo — a van approaching Kert utca 14, 2340 Kiskunlácháza — runs
  repeatably and without any live external dependency, triggering approaching → arriving → here in
  sequence within a single run of about 5 minutes.
- **SC-007**: A newcomer can go from a clean checkout to the running demo in under 15 minutes.

## Assumptions

- **POC scope**: single town/route and at most ~5 vans (simulated); authentication is stubbed (no
  production identity); no payments; no anti-counterfeit/brand-enforcement logic.
- **Naming**: "Family Ice" is a pseudonym for the real "Family Frost" brand used for the POC; brand
  protection here means name-cover only, not a software feature.
- **Van location source**: for the POC the van's position comes from a route simulator plus a minimal
  driver application; real fleet/GPS hardware integration is out of scope.
- **User devices**: users run a mobile app and have granted location and notification permissions;
  users with permissions denied still get the live-map experience.
- **Proximity thresholds**: the ~3 km / ~300 m / ~50 m bands and ~2 s update cadence are sensible
  defaults and are tunable; they are not contractual product values.
- **Demo destination**: fixed at Kert utca 14, 2340 Kiskunlácháza (47.1754743, 18.9970884), with the
  approach route pre-captured so the demo runs offline.
- **Connectivity**: the local/demo environment is reliable; mobile network flakiness handling is
  best-effort for the POC.
