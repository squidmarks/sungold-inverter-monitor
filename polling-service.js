import { REGISTER_GROUPS } from './registers.js';
import { InverterDataParser } from './data-parser.js';

export class PollingService {
  constructor(modbusClient, pollInterval, webServer = null, mqttPublisher = null) {
    this.modbusClient = modbusClient;
    this.pollInterval = pollInterval;
    this.webServer = webServer;
    this.mqttPublisher = mqttPublisher;
    this.parser = new InverterDataParser(modbusClient);
    this.isRunning = false;
    this.pollTimer = null;
  }

  async start() {
    if (this.isRunning) {
      console.log('Polling service is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting polling service (interval: ${this.pollInterval}ms)...\n`);
    
    await this.poll();
    
    this.pollTimer = setInterval(async () => {
      await this.poll();
    }, this.pollInterval);
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isRunning = false;
    console.log('Polling service stopped');
  }

  checkForErrors(data, context, required = false) {
    let hasAnyData = false;
    let errorCount = 0;
    
    for (const key in data) {
      if (data[key].error) {
        console.warn(`${context} - ${key}: ${data[key].error}`);
        errorCount++;
      } else if (data[key].data) {
        hasAnyData = true;
      }
    }
    
    if (required && !hasAnyData) {
      throw new Error(`${context}: Critical data unavailable (all register groups failed)`);
    }
  }

  async poll() {
    try {
      console.log('Poll cycle starting...');
      const systemStatusGroups = REGISTER_GROUPS.SYSTEM_STATUS;
      const batteryGroups = REGISTER_GROUPS.BATTERY;
      const acGroups = REGISTER_GROUPS.AC_GRID_INV_LOAD;
      const energyGroups = REGISTER_GROUPS.ENERGY;

      const systemStatusData = await this.modbusClient.readRegisterGroups(systemStatusGroups);
      this.checkForErrors(systemStatusData, 'System status', true);
      console.log('System status read');
      
      const batteryData = await this.modbusClient.readRegisterGroups(batteryGroups);
      this.checkForErrors(batteryData, 'Battery data', false);
      console.log('Battery data read');
      
      const acData = await this.modbusClient.readRegisterGroups(acGroups);
      this.checkForErrors(acData, 'AC data', false);
      console.log('AC data read');
      
      const energyData = await this.modbusClient.readRegisterGroups(energyGroups);
      this.checkForErrors(energyData, 'Energy data', false);
      console.log('Energy data read');

      const systemStatus = this.parser.parseSystemStatus(systemStatusData);
      const battery = this.parser.parseBatteryData(batteryData);
      const ac = this.parser.parseACData(acData);
      const energy = this.parser.parseEnergyData(energyData);

      const payload = {
        timestamp: new Date().toISOString(),
        inverterConnected: true,
        mqttConnected: this.mqttPublisher ? this.mqttPublisher.connected : false,
        systemStatus,
        battery,
        ac,
        energy
      };

      if (this.webServer) {
        console.log('Broadcasting to web clients...');
        this.webServer.broadcastData(payload);
      }

      if (this.mqttPublisher) {
        this.mqttPublisher.publishInverterData(payload);
      }
      
      console.log('Poll cycle completed');

    } catch (error) {
      console.error('Error during polling:', error.message);
      
      if (this.webServer) {
        this.webServer.broadcastData({
          timestamp: new Date().toISOString(),
          inverterConnected: false,
          mqttConnected: this.mqttPublisher ? this.mqttPublisher.connected : false,
          error: error.message
        });
      }
      
      if (error.message.includes('Timed out') || 
          error.message.includes('connection') || 
          error.message.includes('Not connected') ||
          error.message.includes('Critical data unavailable')) {
        console.log('Attempting to reconnect to inverter...');
        this.modbusClient.connected = false;
        try {
          const reconnected = await this.modbusClient.connect();
          if (reconnected) {
            console.log('✓ Reconnected to inverter');
          } else {
            console.error('Failed to reconnect, stopping polling');
            this.stop();
          }
        } catch (reconnectError) {
          console.error('Reconnection error:', reconnectError.message);
        }
      }
    }
  }
}
