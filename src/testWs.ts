import { ShipControlWsClient } from './shipcontrol-ws-client'

const wsConnection = new ShipControlWsClient(
  'localhost',
  '9474',
  (...messages) => console.error('Error: ', ...messages),
  (...messages) => console.log('Log: ', ...messages),
)

console.log('connecting')
wsConnection.addErrorListener((error) =>
  console.error('❌ Error from WS-Connection:', JSON.stringify(error)),
)
wsConnection.addTankInformationUpdateListener((tankInformation) => {
  console.log(
    `🆕 Information for tank: ${tankInformation.tankName} - Level: ${tankInformation.tankLevel}%`,
  )
})
wsConnection.connect()
