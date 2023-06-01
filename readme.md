# FastBasic Debugger

The goal of this project is to provide a first class debugging experience for FastBasic in Visual Studio Code on Windows or Mac.

Press F5 to debug a file, or Ctrl+F5 to run it without debugging.

On first debug, the extension will prompt to download the FastBasic compilar and a platform specific Atari emulator. It will then configure that emulator to work for debugging. You can tweak the emulator settings (NTSC vs PAL, Enable Joystick, etc) while it is running.

## Features

* Automatically downloads the latest FastBasic and Atari Emulator (Altirra or AtariMacX)
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

To **debug**, press F5.
To **run** without any debugging code, press Ctrl-F5.

This extension will compile the source code to an XEX and run it in the emulator. If compiling fails, that message will be displayed in the Output pane. 

When debugging with F5, a "GET" statement will be added to the last line so the program waits for a final key press before exiting. When running via Ctrl+F5, this line is not added.
  
## Variables

Variables will show while debugging is stopped on a line and can be viewed multiple ways:
1. In the Variables pane
2. By hovering over the varible name in source code. In this view, the value is shown in both decimal and hex, along with the address of where the variable exists in memory
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

## Current Limitations

This is a work in progress, with the following limitations:

* The program opens files on #4 and #5 to communicate with the debugger, so your program must use different channels (e.g. #1, #2) for I/O. I chose #4 and #5 because these are not typically used.  
* You can only set/remove breakpoints when the program is stopped for debugging, or not running. This is to keep the program execution speed fast.
* If your program has a lot of variables (or arrays with many entries), tthere will be a noticable pause when stepping through (F10) line by line.  This is because all variable memory is sent to the debugger after each line.
* These limitations may be solved in the future if needed, using a different approach from the H4: host drive for communication.

## FAQ / Troubleshooting

* **What if downloading/installing FastBasic or the Emulator fails?**
 Make sure you have selected a folder that you have write access to. Whichever folder you choose, the extension will create sub-folders inside it for FastBasic and the emulator.

## Under the Hood (how debugging works)

(This section still a work in progress)
When you press F5, the following happens:

1. Special Debug FastBasic procs are appended to the end of your program, with a unique prefix so they do not interfere with your existing program. 
2. A "bin" folder is created within the folder where your source file exists. FastBasic creates intermediate files here, along with the final XEX file. 
3. The emulator is then configured to point the H4: host drive to the bin folder, which the FastBasic debug procs use to communicate with the extension by reading/writing temporary debug,* files.