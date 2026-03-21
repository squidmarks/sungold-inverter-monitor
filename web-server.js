import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class WebServer {
  constructor(port = 3000, config = {}, modbusClient = null) {
    this.port = port;
    this.config = config;
    this.modbusClient = modbusClient;
    this.app = express();
    this.clients = new Set();
    this.latestData = null;
    
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.use(express.static(path.join(__dirname, 'public')));
    this.app.use(express.json());

    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    this.app.get('/api/data', (req, res) => {
      res.json(this.latestData || {});
    });

    this.app.get('/api/config', (req, res) => {
      res.json({
        batteryCapacityAh: this.config.BATTERY_CAPACITY_AH || 200,
        minBatterySoc: this.config.MIN_BATTERY_SOC || 20
      });
    });

    // Read inverter configuration register
    this.app.get('/api/settings/:address', async (req, res) => {
      try {
        const address = parseInt(req.params.address, 16);
        if (!this.modbusClient || !this.modbusClient.connected) {
          return res.status(503).json({ error: 'Modbus client not connected' });
        }
        
        const values = await this.modbusClient.readRegisters(address, 1);
        res.json({ address, value: values[0] });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Write inverter configuration register
    this.app.post('/api/settings/:address', async (req, res) => {
      try {
        const address = parseInt(req.params.address, 16);
        const { value } = req.body;
        
        if (value === undefined || value === null) {
          return res.status(400).json({ error: 'Value is required' });
        }
        
        if (!this.modbusClient || !this.modbusClient.connected) {
          return res.status(503).json({ error: 'Modbus client not connected' });
        }
        
        const result = await this.modbusClient.writeSingleRegister(address, value);
        res.json({ success: true, ...result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/events', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      res.write('data: {"status": "connected"}\n\n');

      this.clients.add(res);

      req.on('close', () => {
        this.clients.delete(res);
      });
    });
  }

  broadcastData(data) {
    this.latestData = data;
    const dataString = `data: ${JSON.stringify(data)}\n\n`;
    
    for (const client of this.clients) {
      try {
        client.write(dataString);
      } catch (error) {
        this.clients.delete(client);
      }
    }
  }

  start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`✓ Web dashboard available at http://localhost:${this.port}`);
        console.log(`  Access from other devices: http://<pi-ip-address>:${this.port}`);
        resolve();
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.clients.clear();
      console.log('✓ Web server stopped');
    }
  }
}
