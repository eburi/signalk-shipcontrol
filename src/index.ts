import { Path, ServerAPI, Value } from '@signalk/server-api'

interface Plugin {
  start: (app: any) => void
  started: boolean
  stop: () => void | Promise<void>
  statusMessage: (msg: string) => void
  id: string
  name: string
  description: string
  schema: any
}

export default function (app: ServerAPI) {
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

  function updatePath(path: Path, val: Value) {
    app.handleMessage(plugin.id, {
      updates: [{ values: [{ path: path, value: val }] }],
    })
  }

  let connected = false

  const plugin: Plugin = {
    start: function (props: any) {},

    stop: function () {},

    statusMessage: function () {
      return connected ? `connected` : `connecting...`
    },

    started: false,
    id: 'signalk-shipcontrol',
    name: 'Ship Control adapter for SignalK',
    description:
      'Plugin that connectes to Ship Control and provides information to SignalK like tank levels',
    schema: {
      type: 'object',
      properties: {
        shorecontrolIp: {
          type: 'string',
          title: 'IP address of Shore Control Server',
          default: undefined,
        },
        shorecontrolWsPort: {
          type: 'string',
          title: 'Websocket Port',
          default: undefined,
        },
      },
    },
  }

  return plugin
}
