# @taico/display

[![Socket Badge](https://badge.socket.dev/npm/package/@taico/display/0.4.1)](https://badge.socket.dev/npm/package/@taico/display/0.4.1)

`taico-display` keeps a Waveshare e-ink display synchronized with Taico task, worker, and active-execution status over Bluetooth LE.

```sh
taico-display --serverurl http://localhost:3000
```

The first run opens a local OAuth callback and prints the authorization URL. By default it scans for the `ai-monitor` peripheral; override it with `--device-name`. Credentials are stored per server in `~/.taico/display-credentials.json`.
