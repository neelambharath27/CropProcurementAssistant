# Phase 5 — Smart Centre, Slot & Live Queue Flow

Implemented in this build:

1. **Village → nearby procurement centres**
   - Farmer enters village/location.
   - Active centres are ranked by village/location/district match, then by current queue count.
   - Each centre shows the number of farmers currently registered in its queue.

2. **Expected procurement date → time slots**
   - Farmer selects a centre and procurement date.
   - Available one-hour slots are displayed with remaining capacity.
   - If an active centre has no slots for the selected date, default hourly slots are generated from its opening/closing time.

3. **Registration confirmation → unique centre token**
   - Crop registration is followed by a booking for the selected centre and slot.
   - The booking creates a token unique to the centre/date queue.
   - The confirmation screen prominently displays the token and centre.

4. **AI procurement recommendation**
   - Recommendations use crop-specific price data, queue wait, available capacity, price trend and farmer location match.
   - AI recommendations can be booked directly.

5. **Live queue prediction**
   - Farmer queue page refreshes every 10 seconds.
   - Shows current serving token, farmers ahead, position and estimated wait.
   - Estimated wait uses completed service history and current processing time.
   - When an earlier farmer completes procurement, that farmer leaves the active queue and the next farmer's wait is recalculated downward on the next refresh.

6. **Farmer authentication**
   - Farmer registration/login uses only name + mobile number.
   - Admin authentication remains separate.


## Time-slot behaviour
When a farmer selects an expected procurement date after choosing a centre,
the backend automatically creates one-hour appointment slots for that centre
using its configured opening and closing times. The farmer sees only slots
with remaining capacity and can select one before confirmation.
