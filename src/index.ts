import { Path, Plugin, ServerAPI, Value } from '@signalk/server-api'
import {
  ShipControlWsClient,
  TankInformationRecord,
} from './shipcontrol-ws-client'

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

  let wsConnection: ShipControlWsClient | null = null

  const plugin: Plugin = {
    start: function (props: any) {
      wsConnection = new ShipControlWsClient(
        props.shoreControllIp,
        props.shoreControllWsPort,
        error,
        debug,
      )
      wsConnection.addTankInformationUpdateListener(
        (tankInformation: TankInformationRecord) => {
          const path = props.tankMappings.find(
            ({ tankName }: { tankName: string }) =>
              tankName === tankInformation.tankName,
          )?.path

          if (path) {
            updatePath(`${path}.currentLevel`, tankInformation.tankLevel / 100) // convert to ratio
          } else {
            debug(
              `Could not find a tank-mapping for tank with name ${tankInformation.tankName}`,
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
    name: 'Ship Control adapter for SignalK',
    description:
      'Plugin that connectes to Ship Control and provides information to SignalK like tank levels',
    schema: {
      type: 'object',
      required: ['shoreControllIp', 'shoreControllWsPort'],
      properties: {
        shoreControllIp: {
          type: 'string',
          title: 'IP address of Shore Control Server',
          default: undefined,
        },
        shoreControllWsPort: {
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
                title: 'Name of the Tank in Shore Control (EP_1).',
              },
              path: {
                type: 'string',
                title: 'SignalK Path for this tank (e.g. tanks.freshWater.0)',
              },
            },
          },
        },
      },
    },
  }

  return plugin
}
