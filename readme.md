# FastBasic Debugger

This a work-in-progress extension with the goal to provide a first class debugging experience for FastBasic in Visual Studio Code on **Windows**, **macOS**, and **Linux**.

**To debug:** Press F5, or use the **Debug File** button above the editor.  
**To run without debugging:** Press Ctrl+F5 (Cmd+F5 on Mac), or use the **Run File** button.

On first debug, the extension will prompt to download the FastBasic compiler and a platform-specific Atari emulator (Altirra on Windows, Atari800MacX on macOS). It will then configure that emulator to work for debugging. You can tweak the emulator settings (NTSC vs PAL, Enable Joystick, etc) while it is running.

**Advanced use:** You can create a custom `launch.json` to use a different emulator (e.g. Altirra via Wine on Mac, or Fujisan on any platform). See below.

 **If you encounter ISSUES,**  please let me know at: https://forums.atariage.com/topic/351055-fastbasic-debugger-extension-for-vscode/

## Features

* Automatically downloads the latest supported FastBasic and Atari emulator (Altirra on Windows, Atari800MacX on macOS) - If you are using Fujisan you have to download and install it manually.
* Compiles and run or debug in emulator with a single key press
* Inspect and change variables while debugging
* See variable value in decimal/hex along with address on hover
* Set breakpoints to stop code at any line
* Step through code, line by line
* Jump to specific line (careful! no scope checks)
* See all procedures in Outline view
* Navigate to a proc definition by pressing F12
* Atari BASIC inspired theme / syntax highlighting (Still a work in progress)

## Running or Debugging

You can start a session in two ways:

1. **Run view:** Open the Run and Debug view (Ctrl+Shift+D / Cmd+Shift+D), choose a launch configuration (e.g. **Debug FastBASIC (Fujisan)** or **Debug FastBASIC (Atari800MacX)**), then press **F5** to debug or **Ctrl+F5** / **Cmd+F5** to run without debugging.
2. **Editor buttons:** With a `.bas` file active, use the **Debug File** or **Run File** button above the editor. These use your **default launch configuration** (if set in settings) or the **default emulator** (see Settings below).

This extension will compile the source code to an XEX and run it in the emulator. If compiling fails, that message will be displayed in the Output pane.

When debugging, a "GET" statement will be added to the last line so the program waits for a final key press before exiting. When running without debugging, this line is not added.
  
## Variables

Variables will show while debugging is stopped on a line and can be viewed multiple ways:
1. In the Variables pane
2. By hovering over the variable name in source code. In this view, the value is shown in both decimal and hex, along with the address of where the variable exists in memory
3. By right clicking on a variable in source and adding it to the watch pane.

All variable types are supported:

* Integer: myVar
* Float: myVar%
* String: myVar$
* Arrays (Byte, Float, Integer, String)

**Note:** Arrays with more than 256 entries will not show contents, for performance reasons.


## Procedures 

* The outline view lists all Procedures in the file
* Clicking on the definition will show its code
* You can look at the definition of a @proc in code by pressing F12

## Theme

This is currently a work in progress, but I am working on a theme that gives an experience very close to writing original Atari BASIC, including font, with some color syntax highlighting as a bonus.

## Custom Emulator (Atari800MacX / Altirra)

On **Windows**, the default emulator is **Altirra**. On **macOS**, it is **Atari800MacX**. You can specify a custom emulator path in `launch.json` (e.g. to run Altirra via Wine on Mac for FujiNet development, or even better, use Fujisan with built-in Fujinet support on macOS and Linux).

Create a `launch.json` in the `.vscode` folder under your project, or use the Run view and click **Create a launch.json file**.

**Notes:**
1. **compilerPath** can be the path to the FastBasic **folder** (e.g. `C:\atari\fastbasic-4.7HF` or `/path/to/fastbasic-4.7HF`); the extension will use the `fastbasic` (or `fastbasic.exe`) executable inside it.
2. For a custom emulator, set **emulatorPath** to the executable (or e.g. `wine /path/to/Altirra64.exe` on Mac). Set **windowsPaths** to `true` when passing Windows-style paths to Altirra (e.g. under Wine).
3. When starting an emulator manually, map **H4:** to your project’s **bin** folder (e.g. in Altirra: System → Configure System → Peripherals → Devices → Add → Host Device (H:) → set H4 to the `bin` path).
4. You may need to close the emulator to end a debugging run.

For reference, here is a sample file that loads Altirra using wine.
```
{
  "version": "0.2.0",
  "configurations": [

    {
      "type": "fastbasic",
      "request": "launch",
      "name": "Debug FastBASIC",
      "sourceFile": "${file}",
      "compilerPath": "",
      "emulatorPath": "wine /Users/eric/Documents/Altirra/Altirra64.exe",
      "windowsPaths": true
    }
  ]
}
```

## Fujisan Emulator

The extension supports **Fujisan** (libatari800-based emulator) on macOS, Windows, and Linux via its TCP Server API. You must use Fujisan 1.1.4 or newer. The latest version is always available here: https://github.com/pedgarcia/fujisan/releases

**Setup:** Fujisan must be running with the TCP server enabled (Tools → TCP Server). The extension configures **H4:** to your project’s `bin` folder automatically over TCP, so you do not need to map H4: manually in Fujisan.

Add a launch configuration in `.vscode/launch.json`:
```json
{
  "type": "fastbasic",
  "request": "launch",
  "name": "Debug FastBASIC (Fujisan)",
  "sourceFile": "${file}",
  "compilerPath": "/path/to/fastbasic",
  "emulatorType": "fujisan",
  "fujisanHost": "localhost",
  "fujisanPort": 6502,
  "bootMode": "warm",
}
```

You can set **compilerPath** to the folder that contains the FastBasic binary (e.g. `/path/to/fastbasic-4.7HF`); the extension will use the executable inside it. Set **autoConfigureH4** to `false` in the config if you prefer to map H4: manually in Fujisan.

**bootMode** in particular controls how the machine is reset before loading the XEX:
- `none` (default): no explicit boot before `media.load_xex`.
- `warm`: warm boot before loading.
- `cold`: perform a FujiNet restart sequence before loading.

Benefits: deploy and load XEX via TCP; H4: auto-configured for the current project; same step-by-step debugging as with other emulators.

## Settings

In **Settings** (search for **FastBasic**), you can set:

* **Default Emulator** — `atari800` or `fujisan`. Used when you use **Debug File** / **Run File** without a default launch config, or when a launch config does not specify `emulatorType`. On Windows, `atari800` uses Altirra; on macOS, it uses Atari800MacX.

* **Default Launch Configuration** — The name of a launch configuration from `launch.json` (e.g. `Debug FastBASIC (Fujisan)`). When set, **Debug File** and **Run File** use this configuration instead of building an inline config. Ensures the editor buttons use the same emulator and options as the Run view.

## Current Limitations

This is a work in progress, with the following limitations:

* The program opens files on #4 and #5 to communicate with the debugger, so your program must use different channels (e.g. #1, #2) for I/O. I chose #4 and #5 because these are not typically used.  
* You can only set/remove breakpoints when the program is stopped for debugging, or not running. This is to keep the program execution speed fast.
* If your program has a lot of variables (or arrays with many entries), there will be a noticeable pause when stepping through (F10) line by line.  This is because all variable memory is sent to the debugger after each line.
* These limitations may be solved in the future if needed, using a different approach from the H4: host drive for communication.

## FAQ / Troubleshooting

* **What if downloading/installing FastBasic or the Emulator fails?**
 Make sure you have selected a folder that you have write access to. Whichever folder you choose, the extension will create sub-folders inside it for FastBasic and the emulator.

* **I set a breakpoint and debug, but the code never stops at the breakpoint**
  1. Make sure your breakpoint is on a valid line that does something. It cannot be on a empty line, comments line, start or end of a PROC, or a DATA statement.
  2. Close the emulator and try debugging again.

## Under the Hood (how debugging works)

When you press F5, the following happens:

1. Special Debug FastBasic procs are appended to the end of your program, with a unique prefix so they do not interfere with your existing program. 
2. A "bin" folder is created within the folder where your source file exists. FastBasic creates intermediate files here, along with the final XEX file. 
3. The emulator is then configured to point the H4: host drive to the bin folder, which the FastBasic debug procs use to communicate with the extension by reading/writing temporary debug,* files.

For more details on how debugging works, see [debugFlow.md](debugFlow.md)