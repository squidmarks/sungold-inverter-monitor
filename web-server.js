import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class WebServer {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.clients = new Set();
    this.latestData = null;
    
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.use(express.static(path.join(__dirname, 'public')));

    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    this.app.get('/api/data', (req, res) => {
      res.json(this.latestData || {});
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
