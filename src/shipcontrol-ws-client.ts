import WebSocket from 'ws'

const HEARTBEAT_INTERVAL_MS = 5000
const INFORMATION_REQUEST_INTERVAL_MS = 10000
const RECONNECT_DELAY_MS = 3000

interface ShipControlMessage {
  class: string
  is_alived: boolean
  obj_kind: string
}

interface TankLevelMessage extends ShipControlMessage {
  class: 'Tank'
  tank_auto_switch_mode: boolean
  tank_capacity: number
  tank_level: number
  tank_module_id: number
  tank_type: string
  tank_valve_state: string
}

interface BatteryMessage extends ShipControlMessage {
  class: 'Battery'
  battery_autonomy: number
  battery_available_capacity: number
  battery_current: number
  battery_dischargeable_ah: number
  battery_health_level: string // e.g. GREEN
  battery_manufacturer: string
  battery_module_id: number
  battery_nb_of_ibs: number
  battery_nominal_capacity: number
  battery_state_of_charge: number
  battery_state_of_health: number
  battery_temperature: number
  battery_temperature_level: string // e.g. GREEN
  battery_type: string
  battery_type_of_battery: string
  battery_voltage_level: number
  module_name: string
  offloading_max: number
  offloading_min: number
  offloading_time: string
  offloading_value: number
}

export interface TankInformationRecord {
  name: string
  level: number
  capacity: number
  autoSwitchMode: boolean
  valveState: string
  moduleId: number
}

export interface BatteryInformationRecord {
  name: string
  voltage: number
  current: number
  stateOfCharge: number
  healthLevel: string
  moduleId: number
}

export class ShipControlWsClient {
  private readonly errorListeners: Array<(error: Error) => void> = []
  private readonly tankInformationUpdateListeners: Array<
    (tankInformation: TankInformationRecord) => void
  > = []
  private readonly batteryInformationUpdateListeners: Array<
    (batteryInformation: BatteryInformationRecord) => void
  > = []
  private readonly tankInformationStore: {
    [tankType: string]: TankInformationRecord
  } = {}
  private readonly batteryInformationStore: {
    [batteryType: string]: BatteryInformationRecord
  } = {}

  private url: string
  private socket: WebSocket | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  private tankInformationRequestInterval: NodeJS.Timeout | null = null
  private batteryInformationRequestInterval: NodeJS.Timeout | null = null
  private error: (...messages: string[]) => void
  private debug: (...messages: string[]) => void

  constructor(
    ipAddress: string,
    wsPort: string,
    errorOutput: (...messages: string[]) => void = console.error,
    debugOutput: (...messages: string[]) => void = console.log,
  ) {
    this.url = `ws://${ipAddress}:${wsPort}`

    this.error = (...messages: string[]) => errorOutput(messages.join(' '))
    this.debug = (...messages: string[]) => debugOutput(messages.join(' '))
  }

  public connect(): void {
    this.socket = new WebSocket(this.url)

    this.socket.on('open', () => {
      this.debug('✅ WebSocket connected.')
      this.startHeartbeat()
      this.startTankInformationRequest()
    })

    this.socket.on('message', (data: WebSocket.RawData) => {
      this.handleMessage(data.toString())
    })

    this.socket.on('close', (code, reason) => {
      this.error(`⚠️ WebSocket closed: ${code} - ${reason.toString()}`)
      this.stopHeartbeat()
      this.stopTankInformationRequest()
      if (this.socket) {
        this.debug(
          `🔁 will try to reconnect in ${RECONNECT_DELAY_MS / 1000}s...`,
        )
        setTimeout(() => this.connect(), RECONNECT_DELAY_MS)
      }
    })

    this.socket.on('error', (error) => {
      this.error('❌ WebSocket error:', error.toString())
      this.notifyErrorListeners(error)
    })
  }

  public disconnect(): void {
    this.socket?.close()
    this.socket = null
  }

  public addErrorListener(listener: (error: Error) => void): void {
    this.errorListeners.push(listener)
  }

  public addTankInformationUpdateListener(
    listener: (tankInformation: TankInformationRecord) => void,
  ): void {
    this.tankInformationUpdateListeners.push(listener)
  }

  public addBatteryInformationUpdateListener(
    listener: (batterInformation: BatteryInformationRecord) => void,
  ): void {
    this.batteryInformationUpdateListeners.push(listener)
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send('ALIVE')
        this.debug('⬆️ Sent: ALIVE')
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private startTankInformationRequest(): void {
    this.tankInformationRequestInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            cmd: 'fetch_map',
            params: 'Tanks',
            callback_id: 1,
          }),
        )
        this.debug('⬆️ Sent: Tank information request')
      }
    }, INFORMATION_REQUEST_INTERVAL_MS)
  }

  private stopTankInformationRequest(): void {
    if (this.tankInformationRequestInterval) {
      clearInterval(this.tankInformationRequestInterval)
      this.tankInformationRequestInterval = null
    }
  }

  private startBatteryInformationRequest(): void {
    this.batteryInformationRequestInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            cmd: 'fetch_map',
            params: 'Battery',
            callback_id: 2,
          }),
        )
        this.debug('⬆️ Sent: Battery information request')
      }
    }, INFORMATION_REQUEST_INTERVAL_MS)
  }

  private stopBatteryInformationRequest(): void {
    if (this.batteryInformationRequestInterval) {
      clearInterval(this.batteryInformationRequestInterval)
      this.batteryInformationRequestInterval = null
    }
  }

  private handleMessage(data: string): void {
    try {
      const json: object = JSON.parse(data)
      this.debug('⬇️ Received JSON message:', JSON.stringify(json))
      this.handleShipControlMessage(json as ShipControlMessage)
    } catch {
      if (data !== 'ALIVE') {
        this.error('⚠️ Received non-JSON message:', data)
      }
    }
  }

  private handleShipControlMessage(message: ShipControlMessage) {
    switch (message.class) {
      case 'Tank':
        this.handleTankMessage(message as TankLevelMessage)
        break
      case 'Battery':
        this.handleBatteryMessage(message as BatteryMessage)
        break
    }
  }

  private handleTankMessage(tankLevelMessage: TankLevelMessage) {
    const tankInformation =
      this.convertTankLevelMessageToTankInformation(tankLevelMessage)
    this.tankInformationStore[tankLevelMessage.tank_type] = tankInformation
    this.notifyTankInformationUpdateListeners(tankInformation)
  }

  private convertTankLevelMessageToTankInformation(
    tankLevelMessage: TankLevelMessage,
  ): TankInformationRecord {
    return {
      name: tankLevelMessage.tank_type,
      level: tankLevelMessage.tank_level,
      capacity: tankLevelMessage.tank_capacity,
      autoSwitchMode: tankLevelMessage.tank_auto_switch_mode,
      valveState: tankLevelMessage.tank_valve_state,
      moduleId: tankLevelMessage.tank_module_id,
    }
  }

  private handleBatteryMessage(batteryMessage: BatteryMessage) {
    const battteryInformation =
      this.convertBatteryMessageToBatterInformationRecord(batteryMessage)
    this.batteryInformationStore[battteryInformation.name] = battteryInformation
    this.notifyBatteryInformationUpdateListeners(battteryInformation)
  }

  private convertBatteryMessageToBatterInformationRecord(
    batteryMessage: BatteryMessage,
  ): BatteryInformationRecord {
    return {
      name: batteryMessage.battery_type,
      voltage: batteryMessage.battery_voltage_level,
      current: batteryMessage.battery_current,
      stateOfCharge: batteryMessage.battery_state_of_charge / 255,
      healthLevel: batteryMessage.battery_health_level,
      moduleId: batteryMessage.battery_module_id,
    }
  }

  private notifyTankInformationUpdateListeners(
    tankInformation: TankInformationRecord,
  ) {
    this.tankInformationUpdateListeners.forEach((listener) =>
      listener(tankInformation),
    )
  }

  private notifyBatteryInformationUpdateListeners(
    batteryInformation: BatteryInformationRecord,
  ) {
    this.batteryInformationUpdateListeners.forEach((listener) =>
      listener(batteryInformation),
    )
  }

  private notifyErrorListeners(error: Error) {
    this.errorListeners.forEach((listener) => listener(error))
  }
}
