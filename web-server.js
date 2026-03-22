import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class WebServer {
  constructor(port = 3000, config = {}, modbusClient = null, modbusLock = null) {
    this.port = port;
    this.config = config;
    this.modbusClient = modbusClient;
    this.modbusLock = modbusLock;
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

    // Batch read settings for a category (much faster than individual reads)
    this.app.get('/api/settings/batch/:category', async (req, res) => {
      try {
        const category = req.params.category.toUpperCase();
        const { CONFIG_REGISTERS } = await import('./registers.js');
        const settings = CONFIG_REGISTERS[category];
        
        if (!settings) {
          return res.status(404).json({ error: 'Category not found' });
        }
        
        if (!this.modbusClient || !this.modbusClient.connected) {
          return res.status(503).json({ error: 'Modbus client not connected' });
        }
        
        // Acquire lock once for entire batch
        if (this.modbusLock) {
          await this.modbusLock.acquire(10000);
        }
        
        try {
          const results = {};
          
          // Find min and max addresses to determine if we can do a single bulk read
          const addresses = settings.map(s => s.address);
          const minAddr = Math.min(...addresses);
          const maxAddr = Math.max(...addresses);
          const span = maxAddr - minAddr + 1;
          
          // If span is small (<=30 registers), do a single bulk read
          if (span <= 30) {
            const values = await this.modbusClient.readRegisters(minAddr, span);
            
            // Map values back to settings
            for (const setting of settings) {
              const offset = setting.address - minAddr;
              results[setting.key] = {
                value: values[offset],
                scaled: (values[offset] * setting.scale).toFixed(setting.scale < 1 ? 1 : 0),
                unit: setting.unit
              };
            }
          } else {
            // Address range is too large, read individually with short delays
            for (const setting of settings) {
              try {
                const values = await this.modbusClient.readRegisters(setting.address, 1);
                results[setting.key] = {
                  value: values[0],
                  scaled: (values[0] * setting.scale).toFixed(setting.scale < 1 ? 1 : 0),
                  unit: setting.unit
                };
              } catch (error) {
                // Register doesn't exist on this inverter model, mark as unavailable
                if (error.message.includes('Modbus exception 2') || error.message.includes('Illegal')) {
                  results[setting.key] = { unavailable: true };
                } else {
                  throw error;
                }
              }
              await new Promise(resolve => setTimeout(resolve, 150));
            }
          }
          
          res.json({ category, settings: results });
        } finally {
          if (this.modbusLock) {
            this.modbusLock.release();
          }
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Read inverter configuration register
    this.app.get('/api/settings/:address', async (req, res) => {
      try {
        const address = parseInt(req.params.address, 16);
        if (!this.modbusClient || !this.modbusClient.connected) {
          return res.status(503).json({ error: 'Modbus client not connected' });
        }
        
        // Acquire lock to prevent interference with polling
        if (this.modbusLock) {
          await this.modbusLock.acquire(5000);
        }
        
        try {
          const values = await this.modbusClient.readRegisters(address, 1);
          res.json({ address, value: values[0] });
        } finally {
          if (this.modbusLock) {
            this.modbusLock.release();
          }
        }
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
        
        // Acquire lock with longer timeout for write operations
        if (this.modbusLock) {
          await this.modbusLock.acquire(15000);
        }
        
        try {
          const result = await this.modbusClient.writeSingleRegister(address, value);
          // Give inverter time to process the write before releasing lock
          await new Promise(resolve => setTimeout(resolve, 200));
          res.json({ success: true, ...result });
        } finally {
          if (this.modbusLock) {
            this.modbusLock.release();
          }
        }
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
