import WebSocket from 'ws'

const HEARTBEAT_INTERVAL_MS = 5000
const RECONNECT_DELAY_MS = 3000

interface ShipControlMessage {
  class: string
  is_alived: boolean
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

export interface TankInformationRecord {
  tankName: string
  tankLevel: number
  tankCapacity: number
  tankAutoSwitchMode: boolean
  tankValveState: string
  tankModuleId: number
}

const tankInformationStore: { [tankType: string]: TankInformationRecord } = {}

export class ShipControlWsClient {
  private tankInformationUpdateListeners: Array<
    (tankInformation: TankInformationRecord) => void
  > = []
  private url: string
  private socket: WebSocket | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
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
    })

    this.socket.on('message', (data: WebSocket.RawData) => {
      this.handleMessage(data.toString())
    })

    this.socket.on('close', (code, reason) => {
      this.error(`⚠️ WebSocket closed: ${code} - ${reason.toString()}`)
      this.stopHeartbeat()
      if (this.socket) {
        this.debug(
          `🔁 will try to reconnect in ${RECONNECT_DELAY_MS / 1000}s...`,
        )
        setTimeout(() => this.connect(), RECONNECT_DELAY_MS)
      }
    })

    this.socket.on('error', (error) => {
      this.error('❌ WebSocket error:', error.toString())
    })
  }

  public disconnect(): void {
    this.socket?.close()
    this.socket = null
  }

  public addTankInformationUpdateListener(
    listener: (tankInformation: TankInformationRecord) => void,
  ): void {
    this.tankInformationUpdateListeners.push(listener)
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
    }
  }

  private handleTankMessage(tankLevelMessage: TankLevelMessage) {
    const tankInformation =
      this.convertTankLevelMessageToTankInformation(tankLevelMessage)
    tankInformationStore[tankLevelMessage.tank_type] = tankInformation
    this.notifyTankInformationUpdateListeners(tankInformation)
  }

  private convertTankLevelMessageToTankInformation(
    tankLevelMessage: TankLevelMessage,
  ): TankInformationRecord {
    return {
      tankName: tankLevelMessage.tank_type,
      tankLevel: tankLevelMessage.tank_level,
      tankCapacity: tankLevelMessage.tank_capacity,
      tankAutoSwitchMode: tankLevelMessage.tank_auto_switch_mode,
      tankValveState: tankLevelMessage.tank_valve_state,
      tankModuleId: tankLevelMessage.tank_module_id,
    }
  }

  private notifyTankInformationUpdateListeners(
    tankInformation: TankInformationRecord,
  ) {
    this.tankInformationUpdateListeners.forEach((listener) =>
      listener(tankInformation),
    )
  }
}
