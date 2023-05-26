// Small FastBasic code that is appended to the end of a program to 
// enable debugging.

export function GetEmulatorSettingsMac (binPath:string, executablePath:string) {
  return `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>AtariSwitchType</key>
	<integer>8</integer>
	<key>AtariType</key>
	<integer>8</integer>
	<key>ExeFile</key>
	<string>${executablePath}</string>
	<key>ExeFileEnabled</key>
	<true/>
	<key>HardDiskDir4</key>
	<string>${binPath}</string>
	<key>HardDrivesReadOnly</key>
	<false/>
  <key>MediaStatusDisplayed</key>
	<false/>
  <key>PadJoyDown</key>
	<integer>60</integer>
	<key>PadJoyDownLeft</key>
	<integer>66</integer>
	<key>PadJoyFire</key>
	<integer>25</integer>
	<key>PadJoyLeft</key>
	<integer>58</integer>
	<key>PadJoyRight</key>
	<integer>61</integer>
	<key>PadJoyUp</key>
	<integer>59</integer>
	<key>Joystick1Mode_v13</key>
	<integer>1</integer>
	<key>Joystick1MultiMode</key>
	<false/>
	
	<key>ShowFPS</key>
	<true/>
</dict>
</plist>
`;
}/*
<key>PaletteFile</key>
	<string>/Users/eric/Documents/atari/Palettes/new_stella_NTSC.pal</string>*/

export function GetEmulatorSettingsWin(binPath:string) {
  return `
  [User\\Software\\virtualdub.org\\Altirra\\Settings]
  "Display: Direct3D9" = 1
  "Display: 3D" = 0
  "Startup: Reuse program instance" = 1
  
  [User\\Software\\virtualdub.org\\Altirra\\Profiles\\00000000]
  "Devices" = "[{\\"tag\\": \\"hostfs\\",\\"params\\": {\\"readonly\\": false,\\"path4\\": \\"${binPath}\\"}}]"
  "Devices: CIO H: patch enabled" = 1		
  "Pause when inactive" = 0
  "Input: Active map names" = "Arrow Keys -> Joystick (port 1)"
  
  [User\\Software\\virtualdub.org\\Altirra\\DialogDefaults]
  "DiscardMemory" = "ok"
    `
}