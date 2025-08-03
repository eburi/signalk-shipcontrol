import { ShipControlWsClient } from './shipcontrol-ws-client'

const wsConnection = new ShipControlWsClient(
  'buttercupmonitor.local',
  '9474',
  () => {},
  () => {},
)

console.log('connecting')
wsConnection.addTankInformationUpdateListener((tankInformation) => {
  console.log(
    `🆕 Information for tank: ${tankInformation.tankName} - Level: ${tankInformation.tankLevel}%`,
  )
})
wsConnection.connect()
