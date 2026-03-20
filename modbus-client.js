import net from 'net';

export class InverterModbusClient {
  constructor(host, port, slaveId) {
    this.host = host;
    this.port = port;
    this.slaveId = slaveId;
    this.socket = null;
    this.connected = false;
    this.transactionId = 1;
  }

  calculateCRC(buffer) {
    let crc = 0xFFFF;
    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 0x0001) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc = crc >> 1;
        }
      }
    }
    return crc;
  }

  async connect() {
    return new Promise((resolve) => {
      try {
        this.socket = new net.Socket();
        this.socket.setTimeout(10000);
        
        this.socket.on('error', (err) => {
          console.error('✗ Socket error:', err.message);
          this.connected = false;
        });

        this.socket.on('close', () => {
          this.connected = false;
        });

        this.socket.on('timeout', () => {
          console.error('✗ Socket timeout');
          this.connected = false;
        });

        this.socket.connect({ host: this.host, port: this.port }, () => {
          this.connected = true;
          console.log(`✓ Connected to inverter at ${this.host}:${this.port} (Slave ID: ${this.slaveId})`);
          setTimeout(() => resolve(true), 200);
        });

        setTimeout(() => {
          if (!this.connected) {
            console.error('✗ Connection timeout');
            this.socket.destroy();
            resolve(false);
          }
        }, 10000);

      } catch (error) {
        console.error('✗ Failed to connect to inverter:', error.message);
        this.connected = false;
        resolve(false);
      }
    });
  }

  async disconnect() {
    if (this.socket) {
      this.socket.end();
      this.socket.destroy();
      this.connected = false;
      console.log('✓ Disconnected from inverter');
    }
  }

  buildModbusTCPRequest(slaveId, functionCode, startAddress, quantity) {
    const buffer = Buffer.alloc(12);
    
    buffer.writeUInt16BE(this.transactionId++, 0);
    buffer.writeUInt16BE(0, 2);
    buffer.writeUInt16BE(6, 4);
    buffer.writeUInt8(slaveId, 6);
    buffer.writeUInt8(functionCode, 7);
    buffer.writeUInt16BE(startAddress, 8);
    buffer.writeUInt16BE(quantity, 10);
    
    if (this.transactionId > 65535) this.transactionId = 1;
    
    return buffer;
  }

  async readRegisters(address, count) {
    if (!this.connected) {
      throw new Error('Not connected to inverter');
    }

    return new Promise((resolve, reject) => {
      const request = this.buildModbusTCPRequest(this.slaveId, 0x03, address, count);
      
      const timeout = setTimeout(() => {
        console.error(`Modbus read timeout at register 0x${address.toString(16)}`);
        this.socket.removeListener('data', dataHandler);
        this.connected = false;
        reject(new Error(`Timeout reading registers at 0x${address.toString(16)}`));
      }, 5000);

      let responseBuffer = Buffer.alloc(0);

      const dataHandler = (data) => {
        responseBuffer = Buffer.concat([responseBuffer, data]);
        
        if (responseBuffer.length < 9) {
          return;
        }

        const functionCode = responseBuffer[7];
        if (functionCode === 0x83) {
          clearTimeout(timeout);
          this.socket.removeListener('data', dataHandler);
          const exceptionCode = responseBuffer[8];
          reject(new Error(`Modbus exception ${exceptionCode}`));
          return;
        }

        const byteCount = responseBuffer[8];
        const expectedLength = 9 + byteCount;
        
        if (responseBuffer.length < expectedLength) {
          return;
        }

        clearTimeout(timeout);
        this.socket.removeListener('data', dataHandler);
        
        try {
          const values = [];
          for (let i = 0; i < count; i++) {
            const value = responseBuffer.readUInt16BE(9 + (i * 2));
            values.push(value);
          }
          resolve(values);
        } catch (error) {
          reject(error);
        }
      };

      this.socket.on('data', dataHandler);

      this.socket.write(request, (err) => {
        if (err) {
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  async readRegisterGroups(groups, delayMs = 100) {
    const results = {};
    
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      try {
        const data = await this.readRegisters(group.address, group.count);
        results[group.name] = {
          address: group.address,
          data: data
        };
        
        if (i < groups.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        results[group.name] = {
          address: group.address,
          error: error.message
        };
      }
    }
    
    return results;
  }

  parseValue(rawValue, type) {
    switch (type) {
      case 'int16':
        return rawValue > 32767 ? rawValue - 65536 : rawValue;
      case 'uint16':
        return rawValue;
      case 'uint32':
        return rawValue;
      default:
        return rawValue;
    }
  }

  parse32BitValue(registers, startIndex) {
    const lowWord = registers[startIndex];
    const highWord = registers[startIndex + 1];
    return (highWord << 16) | lowWord;
  }

  extractRegisterValue(registers, baseAddress, targetAddress, regDef) {
    const offset = targetAddress - baseAddress;
    
    if (offset < 0 || offset >= registers.length) {
      return null;
    }

    let rawValue;
    if (regDef.length === 2) {
      if (offset + 1 >= registers.length) {
        return null;
      }
      rawValue = this.parse32BitValue(registers, offset);
    } else {
      rawValue = registers[offset];
    }

    const parsedValue = this.parseValue(rawValue, regDef.type);
    const scaledValue = parsedValue * regDef.scale;
    
    return scaledValue;
  }
}
