import ModbusRTU from 'modbus-serial';

export class InverterModbusClient {
  constructor(host, port, slaveId) {
    this.host = host;
    this.port = port;
    this.slaveId = slaveId;
    this.client = new ModbusRTU();
    this.connected = false;
  }

  async connect() {
    try {
      await this.client.connectTCP(this.host, { port: this.port });
      this.client.setID(this.slaveId);
      this.client.setTimeout(5000);
      this.connected = true;
      console.log(`✓ Connected to inverter at ${this.host}:${this.port} (Slave ID: ${this.slaveId})`);
      return true;
    } catch (error) {
      console.error('✗ Failed to connect to inverter:', error.message);
      this.connected = false;
      return false;
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
      console.log('✓ Disconnected from inverter');
    }
  }

  async readRegisters(address, count) {
    if (!this.connected) {
      throw new Error('Not connected to inverter');
    }

    try {
      const result = await this.client.readHoldingRegisters(address, count);
      return result.data;
    } catch (error) {
      console.error(`✗ Error reading registers at 0x${address.toString(16).toUpperCase()}: ${error.message}`);
      throw error;
    }
  }

  async readRegisterGroups(groups) {
    const results = {};
    
    for (const group of groups) {
      try {
        const data = await this.readRegisters(group.address, group.count);
        results[group.name] = {
          address: group.address,
          data: data
        };
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
