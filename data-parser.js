import { REGISTERS, MACHINE_STATES, CHARGE_STATES } from './registers.js';

export class InverterDataParser {
  constructor(modbusClient) {
    this.client = modbusClient;
  }

  parseSystemStatus(rawData) {
    const machineState = rawData.MACHINE_STATE?.data?.[0];
    const faultCodes = rawData.CURR_FCODE?.data || [];

    return {
      state: machineState,
      stateText: MACHINE_STATES[machineState] || `Unknown (${machineState})`,
      faultCodes: faultCodes.filter(code => code !== 0)
    };
  }

  parseBatteryData(rawData) {
    const data = rawData.BATTERY_DATA?.data;
    if (!data) return null;

    const baseAddr = 0x0100;

    return {
      soc: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.BAT_SOC.address, REGISTERS.DC_DATA.BAT_SOC),
      voltage: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.BAT_VOLT.address, REGISTERS.DC_DATA.BAT_VOLT),
      current: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.CHARGE_CURR.address, REGISTERS.DC_DATA.CHARGE_CURR),
      temperature: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.DEVICE_BAT_TEMPER.address, REGISTERS.DC_DATA.DEVICE_BAT_TEMPER),
      soh: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.BAT_SOH.address, REGISTERS.DC_DATA.BAT_SOH),
      ratedCapacity: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.BAT_RATED_CAPACITY.address, REGISTERS.DC_DATA.BAT_RATED_CAPACITY),
      remainCapacity: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.BAT_REMAIN_CAPACITY.address, REGISTERS.DC_DATA.BAT_REMAIN_CAPACITY),
      chargeState: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.CHARGE_STATE.address, REGISTERS.DC_DATA.CHARGE_STATE),
      chargeStateText: CHARGE_STATES[data[11]] || `Unknown (${data[11]})`,
      cycleCount: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.BATTERY_CYCLE_COUNT.address, REGISTERS.DC_DATA.BATTERY_CYCLE_COUNT),
      chargePower: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.CHARGE_POWER.address, REGISTERS.DC_DATA.CHARGE_POWER),
      bms: {
        voltage: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.BAT_BMS_VOLT.address, REGISTERS.DC_DATA.BAT_BMS_VOLT),
        current: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.BAT_BMS_CURR.address, REGISTERS.DC_DATA.BAT_BMS_CURR),
        temperature: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.BAT_BMS_TEMP.address, REGISTERS.DC_DATA.BAT_BMS_TEMP),
        chgLimitCurr: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.BAT_BMS_CHG_LIMIT_CURR.address, REGISTERS.DC_DATA.BAT_BMS_CHG_LIMIT_CURR),
        dchgLimitCurr: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.BAT_BMS_DCHG_LIMIT_CURR.address, REGISTERS.DC_DATA.BAT_BMS_DCHG_LIMIT_CURR),
        alarmH: data[24],
        alarmL: data[25],
        protectH: data[26],
        protectL: data[27]
      },
      pv1: {
        voltage: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.PV1_VOLT.address, REGISTERS.DC_DATA.PV1_VOLT),
        current: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.PV1_CURR.address, REGISTERS.DC_DATA.PV1_CURR),
        power: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.PV1_CHARGE_POWER.address, REGISTERS.DC_DATA.PV1_CHARGE_POWER),
      },
      pv2: {
        voltage: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.PV2_VOLT.address, REGISTERS.DC_DATA.PV2_VOLT),
        current: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.PV2_CURR.address, REGISTERS.DC_DATA.PV2_CURR),
        power: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.PV2_CHARGE_POWER.address, REGISTERS.DC_DATA.PV2_CHARGE_POWER),
      },
      pvTotalPower: this.client.extractRegisterValue(data, baseAddr, REGISTERS.DC_DATA.PV_TOTAL_POWER.address, REGISTERS.DC_DATA.PV_TOTAL_POWER),
    };
  }

  parseACData(rawData) {
    const data1 = rawData.AC_DATA_1?.data;
    const data2 = rawData.AC_DATA_2?.data;
    
    if (!data1) return null;

    const baseAddr1 = 0x0213;
    const baseAddr2 = 0x0233;

    return {
      grid: {
        l1: {
          voltage: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.GRID_VOLT_A.address, REGISTERS.INVERTER_DATA.GRID_VOLT_A),
          current: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.GRID_CURR_A.address, REGISTERS.INVERTER_DATA.GRID_CURR_A),
          activePower: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.GRID_ACTIVE_POWER_A.address, REGISTERS.INVERTER_DATA.GRID_ACTIVE_POWER_A),
          apparentPower: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.GRID_APPARENT_POWER_A.address, REGISTERS.INVERTER_DATA.GRID_APPARENT_POWER_A),
        },
        l2: {
          voltage: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.GRID_VOLT_B.address, REGISTERS.INVERTER_DATA.GRID_VOLT_B),
          current: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.GRID_CURR_B.address, REGISTERS.INVERTER_DATA.GRID_CURR_B),
          activePower: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.GRID_ACTIVE_POWER_B.address, REGISTERS.INVERTER_DATA.GRID_ACTIVE_POWER_B),
          apparentPower: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.GRID_APPARENT_POWER_B.address, REGISTERS.INVERTER_DATA.GRID_APPARENT_POWER_B),
        },
        frequency: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.GRID_FREQ.address, REGISTERS.INVERTER_DATA.GRID_FREQ),
      },
      inverter: {
        l1: {
          voltage: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.INV_VOLT_A.address, REGISTERS.INVERTER_DATA.INV_VOLT_A),
          current: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.INV_CURR_A.address, REGISTERS.INVERTER_DATA.INV_CURR_A),
        },
        l2: {
          voltage: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.INV_VOLT_B.address, REGISTERS.INVERTER_DATA.INV_VOLT_B),
          current: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.INV_CURR_B.address, REGISTERS.INVERTER_DATA.INV_CURR_B),
        },
        frequency: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.INV_FREQ.address, REGISTERS.INVERTER_DATA.INV_FREQ),
      },
      load: {
        l1: {
          current: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.LOAD_CURR_A.address, REGISTERS.INVERTER_DATA.LOAD_CURR_A),
          activePower: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.LOAD_ACTIVE_POWER_A.address, REGISTERS.INVERTER_DATA.LOAD_ACTIVE_POWER_A),
          apparentPower: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.LOAD_APPARENT_POWER_A.address, REGISTERS.INVERTER_DATA.LOAD_APPARENT_POWER_A),
          ratio: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.LOAD_RATIO_A.address, REGISTERS.INVERTER_DATA.LOAD_RATIO_A),
        },
        l2: {
          current: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.LOAD_CURR_B.address, REGISTERS.INVERTER_DATA.LOAD_CURR_B),
          activePower: data2 ? this.client.extractRegisterValue(data2, baseAddr2, REGISTERS.INVERTER_DATA.LOAD_ACTIVE_POWER_B.address, REGISTERS.INVERTER_DATA.LOAD_ACTIVE_POWER_B) : null,
          apparentPower: data2 ? this.client.extractRegisterValue(data2, baseAddr2, REGISTERS.INVERTER_DATA.LOAD_REACTIVE_POWER_B.address, REGISTERS.INVERTER_DATA.LOAD_REACTIVE_POWER_B) : null,
          ratio: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.LOAD_RATIO_B.address, REGISTERS.INVERTER_DATA.LOAD_RATIO_B),
        },
        powerFactor: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.LOAD_PF.address, REGISTERS.INVERTER_DATA.LOAD_PF),
      },
      temperatures: {
        dcDc: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.TEMPER_A.address, REGISTERS.INVERTER_DATA.TEMPER_A),
        dcAc: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.TEMPER_B.address, REGISTERS.INVERTER_DATA.TEMPER_B),
        transformer: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.TEMPER_C.address, REGISTERS.INVERTER_DATA.TEMPER_C),
        ambient: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.TEMPER_D.address, REGISTERS.INVERTER_DATA.TEMPER_D),
      },
      lineChargeCurrent: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.LINE_CHG_CURR.address, REGISTERS.INVERTER_DATA.LINE_CHG_CURR),
      busVoltage: this.client.extractRegisterValue(data1, baseAddr1, REGISTERS.INVERTER_DATA.BUS_VOLT_SUM.address, REGISTERS.INVERTER_DATA.BUS_VOLT_SUM),
    };
  }

  parseEnergyData(rawData) {
    const todayData = rawData.ENERGY_TODAY?.data;
    const totals1 = rawData.ENERGY_TOTALS_1?.data;
    const totals2 = rawData.ENERGY_TOTALS_2?.data;
    const totals3 = rawData.ENERGY_TOTALS_3?.data;
    const kwhToday = rawData.ENERGY_KWH_TODAY?.data;
    const kwhTotal = rawData.ENERGY_KWH_TOTAL?.data;

    if (!todayData) return null;

    const baseAddrToday = 0xF02C;
    const baseAddrTotals1 = 0xF032;
    const baseAddrTotals2 = 0xF03C;
    const baseAddrTotals3 = 0xF046;
    const baseAddrKwhToday = 0xF04D;
    const baseAddrKwhTotal = 0xF04F;

    return {
      today: {
        pvGeneration: this.client.extractRegisterValue(todayData, baseAddrToday, REGISTERS.ENERGY_STATS.GENERAT_ENERGY_TODAY.address, REGISTERS.ENERGY_STATS.GENERAT_ENERGY_TODAY),
        batteryChargeAh: this.client.extractRegisterValue(todayData, baseAddrToday, REGISTERS.ENERGY_STATS.BAT_CHG_AH_TODAY.address, REGISTERS.ENERGY_STATS.BAT_CHG_AH_TODAY),
        batteryDischargeAh: this.client.extractRegisterValue(todayData, baseAddrToday, REGISTERS.ENERGY_STATS.BAT_DISCHG_AH_TODAY.address, REGISTERS.ENERGY_STATS.BAT_DISCHG_AH_TODAY),
        loadConsumption: this.client.extractRegisterValue(todayData, baseAddrToday, REGISTERS.ENERGY_STATS.USED_ENERGY_TODAY.address, REGISTERS.ENERGY_STATS.USED_ENERGY_TODAY),
        batteryChargeKwh: kwhToday ? this.client.extractRegisterValue(kwhToday, baseAddrKwhToday, REGISTERS.ENERGY_STATS.BAT_CHG_KWH_TODAY.address, REGISTERS.ENERGY_STATS.BAT_CHG_KWH_TODAY) : null,
        batteryDischargeKwh: kwhToday ? this.client.extractRegisterValue(kwhToday, baseAddrKwhToday, REGISTERS.ENERGY_STATS.BAT_DISCHG_KWH_TODAY.address, REGISTERS.ENERGY_STATS.BAT_DISCHG_KWH_TODAY) : null,
        lineChargeAh: totals2 ? this.client.extractRegisterValue(totals2, baseAddrTotals2, REGISTERS.ENERGY_STATS.LINE_CHG_ENERGY_TDAY.address, REGISTERS.ENERGY_STATS.LINE_CHG_ENERGY_TDAY) : null,
        invWorkTime: totals2 ? this.client.extractRegisterValue(totals2, baseAddrTotals2, REGISTERS.ENERGY_STATS.INV_WORK_TIME_TODAY.address, REGISTERS.ENERGY_STATS.INV_WORK_TIME_TODAY) : null,
        lineWorkTime: totals2 ? this.client.extractRegisterValue(totals2, baseAddrTotals2, REGISTERS.ENERGY_STATS.LINE_WORK_TIME_TODAY.address, REGISTERS.ENERGY_STATS.LINE_WORK_TIME_TODAY) : null,
      },
      total: {
        workDays: totals1 && totals1[0],
        pvGeneration: totals1 ? this.client.parse32BitValue(totals1, 0) * 0.1 : null,
        batteryChargeAh: totals1 ? this.client.parse32BitValue(totals1, 2) : null,
        batteryDischargeAh: totals1 ? this.client.parse32BitValue(totals1, 4) : null,
        loadConsumption: totals1 ? this.client.parse32BitValue(totals1, 6) * 0.1 : null,
        batteryChargeKwh: kwhTotal ? this.client.parse32BitValue(kwhTotal, 0) * 0.1 : null,
        batteryDischargeKwh: kwhTotal ? this.client.parse32BitValue(kwhTotal, 2) * 0.1 : null,
        lineChargeAh: totals3 ? this.client.parse32BitValue(totals3, 0) : null,
        invWorkTime: totals3 ? totals3[4] : null,
        lineWorkTime: totals3 ? totals3[5] : null,
      }
    };
  }
}
