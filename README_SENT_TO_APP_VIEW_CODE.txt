Backend/admin update:
- Send to App View button marks the code as visible for pre-login driver view.
- The app status endpoint returns sentToApp.
- The one-time view endpoint requires sentToApp=true.
- After the driver views the code once, reset request and sentToApp flags are cleared.
