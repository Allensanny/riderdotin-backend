Ride request update:
- Backend emits real ride requests only when /api/ride/book is called.
- Driver gets full payload with pickup/drop/fare/distance.
- Same assigned ride is re-emitted every 10 seconds while ride.status remains 'assigned'.
- Repeat stops when driver accepts/rejects/start/completes or after safety max attempts.
