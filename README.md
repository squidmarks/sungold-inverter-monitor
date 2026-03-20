# Sungold Inverter Monitor

Node.js application for monitoring Sungold inverter on M/Y Jefferson 48 via Modbus TCP, with future MQTT integration for SignalK.

## Overview

This application connects to a Sungold inverter through a Waveshare RS-485 to WiFi bridge and polls real-time data including:

- **System Status**: Current operating mode (inverting, bypass, standby, etc.)
- **Battery**: SOC, voltage, current, temperature, BMS data, charge state
- **Solar PV**: Voltage, current, and power from both PV strings
- **AC Input**: L1/L2 voltage, current, power, frequency (shore power/generator)
- **Inverter Output**: L1/L2 voltage, current, frequency
- **Load**: L1/L2 current, active/apparent power, load percentage
- **Temperatures**: DC-DC heatsink, DC-AC heatsink, transformer, ambient
- **Energy Statistics**: Daily and lifetime kWh/Ah totals, runtime statistics

## Installation

```bash
npm install
```

## Configuration

Edit `.env` file with your settings:

```
INVERTER_HOST=192.168.1.194
INVERTER_PORT=8899
SLAVE_ID=1
MQTT_HOST=becoming-hub
MQTT_PORT=1883
POLL_INTERVAL_MS=5000
```

## Usage

Start monitoring:

```bash
npm start
```

Or with Node.js watch mode for development:

```bash
npm run dev
```

This will:
1. Start the Modbus TCP client and connect to the inverter
2. Launch a web server on port 3000 (configurable in `.env`)
3. Begin polling inverter data every 5 seconds
4. Display real-time data in the terminal
5. Serve a live dashboard at `http://localhost:3000`

**Access the Web Dashboard:**
- Local: `http://localhost:3000`
- From other devices: `http://<pi-ip-address>:3000`

The dashboard updates automatically in real-time using Server-Sent Events (SSE).

Press `Ctrl+C` to stop.

## Architecture

- **index.js** - Main entry point, handles initialization and graceful shutdown
- **config.js** - Configuration loader from .env file
- **registers.js** - Modbus register definitions from protocol specification
- **modbus-client.js** - Custom Modbus TCP client implementation with buffered responses
- **data-parser.js** - Parses raw register data into structured format
- **polling-service.js** - Manages periodic polling and error handling
- **terminal-formatter.js** - Formats data for terminal display
- **web-server.js** - Express server with SSE for real-time web dashboard
- **public/index.html** - Marine-themed web dashboard with live updates

## Protocol Details

Based on "MODBUS Monitoring Protocol Register Address Table-V2.00" from Sungold:

- **Protocol**: Modbus RTU over TCP
- **Function Codes**: 0x03 (read holding registers)
- **Max Registers per Read**: 32
- **Slave ID**: 1 (configurable)
- **Data Encoding**: 16-bit registers, 32-bit values in little-endian (low word first)
- **Scaling**: Various multipliers (0.1, 0.01, etc.) documented per register

## Next Steps

- [ ] Validate data accuracy against inverter display
- [ ] Add MQTT publisher for SignalK integration
- [ ] Map data to SignalK electrical paths
- [ ] Add system service configuration for auto-start on Pi
- [ ] Implement reconnection logic for network interruptions
- [ ] Add logging for historical data analysis

## Marine Electrical System

This inverter is configured as the central power distribution point:
- Shore power and generator feed the inverter input
- Main panel is powered by inverter output
- System operates in split-phase configuration (L1/L2)
- Integration with NMEA 2000 via SignalK for unified monitoring

## License

MIT
