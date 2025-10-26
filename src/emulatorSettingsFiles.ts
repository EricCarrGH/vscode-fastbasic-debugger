// Default emulator settings to setup H4 to enable debugging
/*
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