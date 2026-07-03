Backend update:
- Phone lock/minimize socket disconnect no longer auto-offlines driver.
- Added GET /api/driver/profile-id/:driverId so Android app can fetch RC/PAN/Aadhaar/DL document URLs reliably by driver ID.
- Existing /api/driver/profile/:phone remains unchanged.
