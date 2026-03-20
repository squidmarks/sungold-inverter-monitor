#!/usr/bin/env node

import { loadConfig } from './config.js';
import { InverterModbusClient } from './modbus-client.js';
import { PollingService } from './polling-service.js';
import { WebServer } from './web-server.js';

async function main() {
  const config = loadConfig();
  
  console.log('═'.repeat(80));
  console.log('  Sungold Inverter Monitor - M/Y Jefferson 48');
  console.log('═'.repeat(80));
  console.log(`\nConfiguration:`);
  console.log(`  Inverter:    ${config.INVERTER_HOST}:${config.INVERTER_PORT}`);
  console.log(`  Slave ID:    ${config.SLAVE_ID}`);
  console.log(`  Poll Rate:   ${config.POLL_INTERVAL_MS}ms`);
  console.log(`  Web Port:    ${config.WEB_PORT}`);
  console.log(`  MQTT:        ${config.MQTT_HOST}:${config.MQTT_PORT} (not connected yet)`);
  console.log('\nInitializing...\n');

  const webServer = new WebServer(config.WEB_PORT);
  await webServer.start();

  const modbusClient = new InverterModbusClient(
    config.INVERTER_HOST,
    config.INVERTER_PORT,
    config.SLAVE_ID
  );

  const connected = await modbusClient.connect();
  
  if (!connected) {
    console.error('\n✗ Failed to connect to inverter. Please check:');
    console.error('  - Inverter is powered on');
    console.error('  - RS-485 to WiFi bridge is connected and configured');
    console.error(`  - IP address ${config.INVERTER_HOST}:${config.INVERTER_PORT} is correct`);
    console.error('  - Network connectivity from this device to the bridge');
    webServer.stop();
    process.exit(1);
  }

  const pollingService = new PollingService(modbusClient, config.POLL_INTERVAL_MS, webServer);

  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    pollingService.stop();
    webServer.stop();
    await modbusClient.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\nShutting down...');
    pollingService.stop();
    webServer.stop();
    await modbusClient.disconnect();
    process.exit(0);
  });

  await pollingService.start();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
