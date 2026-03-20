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

  checkForErrors(data, context) {
    for (const key in data) {
      if (data[key].error) {
        throw new Error(`${context} error: ${data[key].error}`);
      }
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
      this.checkForErrors(systemStatusData, 'System status');
      console.log('System status read');
      
      const batteryData = await this.modbusClient.readRegisterGroups(batteryGroups);
      this.checkForErrors(batteryData, 'Battery data');
      console.log('Battery data read');
      
      const acData = await this.modbusClient.readRegisterGroups(acGroups);
      this.checkForErrors(acData, 'AC data');
      console.log('AC data read');
      
      const energyData = await this.modbusClient.readRegisterGroups(energyGroups);
      this.checkForErrors(energyData, 'Energy data');
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
      
      if (error.message.includes('Timed out') || error.message.includes('connection')) {
        console.log('Attempting to reconnect...');
        this.modbusClient.connected = false;
        const reconnected = await this.modbusClient.connect();
        if (!reconnected) {
          this.stop();
        }
      }
    }
  }
}
