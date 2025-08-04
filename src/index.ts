import { Path, Plugin, ServerAPI, Value } from '@signalk/server-api'
import {
  BatteryInformationRecord,
  ShipControlWsClient,
  TankInformationRecord,
} from './shipcontrol-ws-client'
import { PathValue, Update } from '@signalk/server-api/dist/deltas'

export default function (app: ServerAPI): Plugin {
  const error =
    app.error ||
    ((msg: string) => {
      console.error(msg)
    })
  const debug =
    app.debug ||
    ((msg: string) => {
      console.log(msg)
    })

  function updatePath(path: string, val: Value) {
    app.handleMessage(plugin.id, {
      updates: [{ values: [{ path: path as Path, value: val }] }],
    })
  }

  function updatePaths(values: PathValue[]) {
    app.handleMessage(plugin.id, {
      updates: [{ values }],
    })
  }

  let wsConnection: ShipControlWsClient | null = null

  const plugin: Plugin = {
    start: function (props: any) {
      wsConnection = new ShipControlWsClient(
        props.shipControllIp,
        props.shipControllWsPort,
        error,
        debug,
      )
      wsConnection.addErrorListener((err) => {
        error(
          `❌ Error from WS-Connection (${props.shipControllIp}:${
            props.shipControllWsPort
          }): ${JSON.stringify(err)}`,
        )
      })
      wsConnection.addTankInformationUpdateListener(
        (tankInformation: TankInformationRecord) => {
          const path = props.tankMappings.find(
            ({ tankName }: { tankName: string }) =>
              tankName === tankInformation.name,
          )?.path

          if (path) {
            updatePath(`${path}.currentLevel`, tankInformation.level / 100) // convert to ratio
          } else {
            debug(
              `Could not find a tank-mapping for tank with name ${tankInformation.name}`,
            )
          }
        },
      )
      wsConnection.addBatteryInformationUpdateListener(
        (batteryInformation: BatteryInformationRecord) => {
          const batteryMapping = props.batteryMappings.find(
            ({ batteryName }: { batteryName: string }) =>
              batteryName === batteryInformation.name,
          )

          if (batteryMapping?.path) {
            const valuesToUpdate: PathValue[] = [
              {
                path: `${batteryMapping.path}.voltage` as Path,
                value: batteryInformation.voltage,
              },
              {
                path: `${batteryMapping.path}.current` as Path,
                value: batteryInformation.current,
              },
              {
                path: `${batteryMapping.path}.capacity.stateOfCharge` as Path,
                value: batteryInformation.stateOfCharge,
              },
              {
                path: `${batteryMapping.path}.capacity.stateOfCharge` as Path,
                value: batteryInformation.stateOfCharge
                  ? batteryInformation.stateOfCharge / 100 // convert to ratio
                  : null,
              },
            ]
            if (batteryMapping.alias) {
              valuesToUpdate.push({
                path: `${batteryMapping.path}.alias` as Path,
                value: batteryMapping.alias,
              })
            }
            updatePaths(valuesToUpdate)
          } else {
            debug(
              `Could not find a battery-mapping for battery with name ${batteryInformation.name}`,
            )
          }
        },
      )
      wsConnection.connect()
    },

    stop: function () {
      wsConnection?.disconnect()
    },

    statusMessage: function () {
      return wsConnection ? `Running` : `Starting...`
    },

    enabledByDefault: false,
    id: 'signalk-shipcontrol',
    name: 'Ship Control Adapter',
    description:
      'Plugin that connects to Ship Control and provides information to SignalK like tank levels.',
    schema: {
      type: 'object',
      required: ['shipControllIp', 'shipControllWsPort'],
      properties: {
        shipControllIp: {
          type: 'string',
          title: 'IP address of Ship Control Server',
          default: undefined,
        },
        shipControllWsPort: {
          type: 'string',
          title: 'Websocket Port',
          default: undefined,
        },
        tankMappings: {
          type: 'array',
          title: 'Tank Mappings',
          items: {
            type: 'object',
            required: ['tankName', 'path'],
            properties: {
              tankName: {
                type: 'string',
                title: 'Name of the Tank in Ship Control (EP_1).',
              },
              path: {
                type: 'string',
                title: 'SignalK Path for this tank (e.g. tanks.freshWater.0)',
              },
            },
          },
        },
        batteryMappings: {
          type: 'array',
          title: 'Battery Mappings',
          items: {
            type: 'object',
            required: ['batteryName', 'path'],
            properties: {
              batteryName: {
                type: 'string',
                title: 'Name of the battery in Ship Control (GE_TD).',
              },
              path: {
                type: 'string',
                title:
                  'SignalK Path for this battery (e.g. electrical.batteries.10). voltage, current and capacity.stateOfCharge will be added',
              },
              alias: {
                type: 'string',
                title:
                  'Alias for this battery (e.g. Generator Starboard) will be added for informational purpose, if present',
              },
            },
          },
        },
      },
    },
  }

  return plugin
}
