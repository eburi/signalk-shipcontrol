# signalk-shipcontrol
SignalK-Plugin to get data like tank readings from Ship Control. If you have Ship Control on your boat, you can use this plugin to read data displayed in Ship Control

## Configuration

You need to provide the ip address of the host where Ship Control is located and the Websocket port that Ship Control uses to get the information about the ship. In my case (Lagoon 65) this is 9474.

At the moment only tank-levels are supported.
 
### Tank Mapping
The Tank Mapping can be done putting the plugin in Debug-Mode and then looking at what is written in the log. From there you should be able to figure out what the name of the tank is that your interested in. Then you can add the base-path for that tank in SignalK.

e.g. my freshwater tank is called EP_1 in Ship Control internally and I want that mapped to tanks.freshWater.0 (the plugin will update the path tanks.freshWater.0.currentLevel).
