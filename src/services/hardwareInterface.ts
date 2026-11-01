/**
 * Hardware Integration Interface & Telemetry Abstraction
 * 
 * Defines the contract for physical medical telemetry sensors, microcontrollers (ESP32/STM32),
 * load cells (strain gauges for fluid weight), photodiode optical drop sensors,
 * and GSM/GPRS modem controllers.
 */

export interface OpticalDropSensorPayload {
  sensorId: string;
  bedId: string;
  irBeamInterrupted: boolean;
  dropCountSinceLastBeat: number;
  instantaneousDropIntervalMs: number;
  ambientLightVoltage: number;
  batteryLevelPct: number;
  timestamp: number;
}

export interface WeightFluidSensorPayload {
  sensorId: string;
  bedId: string;
  rawLoadCellGrams: number;
  calibratedNetVolumeMl: number;
  tareWeightGrams: number;
  temperatureCelsius: number;
  timestamp: number;
}

export interface ESP32TelemetryPacket {
  deviceMac: string;
  firmwareVersion: string;
  wifiRssiDbm: number;
  opticalSensor: OpticalDropSensorPayload;
  fluidLoadCell: WeightFluidSensorPayload;
  clampPositionPercent: number; // 0 = fully closed, 100 = full open
  tamperDetected: boolean;
}

export interface GSMModemCommand {
  type: 'SMS' | 'VOICE_CALL';
  recipientPhoneNumber: string;
  messageText?: string;
  callDurationLimitSec?: number;
  atCommandLog: string[];
}

export interface IHardwareSensorDriver {
  connect(endpoint: string): Promise<boolean>;
  disconnect(): Promise<void>;
  subscribeDrops(callback: (drop: OpticalDropSensorPayload) => void): () => void;
  subscribeWeight(callback: (weight: WeightFluidSensorPayload) => void): () => void;
  sendEmergencyClampCommand(bedId: string, clampClose: boolean): Promise<boolean>;
}

/**
 * Mock / Prototype Hardware Gateway implementation for demonstration
 */
export class SimulatedHardwareGateway implements IHardwareSensorDriver {
  private isConnected = false;

  async connect(endpoint: string = 'ws://192.168.1.150:8080/esp32'): Promise<boolean> {
    console.info(`[Hardware Interface] Connecting to simulated ESP32 node at ${endpoint}...`);
    this.isConnected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    console.info('[Hardware Interface] Disconnected hardware sensor driver.');
    this.isConnected = false;
  }

  subscribeDrops(callback: (drop: OpticalDropSensorPayload) => void): () => void {
    const interval = setInterval(() => {
      if (!this.isConnected) return;
      callback({
        sensorId: 'OPT-IR-B06',
        bedId: 'bed-06',
        irBeamInterrupted: true,
        dropCountSinceLastBeat: 1,
        instantaneousDropIntervalMs: 1800,
        ambientLightVoltage: 3.28,
        batteryLevelPct: 98,
        timestamp: Date.now(),
      });
    }, 2000);

    return () => clearInterval(interval);
  }

  subscribeWeight(callback: (weight: WeightFluidSensorPayload) => void): () => void {
    const interval = setInterval(() => {
      if (!this.isConnected) return;
      callback({
        sensorId: 'HX711-LC-B06',
        bedId: 'bed-06',
        rawLoadCellGrams: 472.5,
        calibratedNetVolumeMl: 468,
        tareWeightGrams: 28.0,
        temperatureCelsius: 22.4,
        timestamp: Date.now(),
      });
    }, 5000);

    return () => clearInterval(interval);
  }

  async sendEmergencyClampCommand(bedId: string, clampClose: boolean): Promise<boolean> {
    console.warn(`[Hardware Safety Actuator] Bed ${bedId} solenoid clamp ${clampClose ? 'ENGAGED (CLOSED)' : 'RELEASED'}`);
    return true;
  }
}

export const hardwareGateway = new SimulatedHardwareGateway();
