# FastBasic Debugger

The goal of this project is to provide a first class debugging experience for FastBasic in Visual Studio Code on Windows or Mac.

Press F5 to debug a file, or Ctrl+F5 to run it without debugging.

On first debug, the extension will prompt to download the fastbasic compilar and an emulator.

## Features

* Will download/install FastBasic and Altirra or AtariMacX Atari emulator
* Compile and run in emulator
* Inspect and change variables
* See variable value in decimal/hex along with address on hover
* Set breakpoints
* Step through code, line by line
* Jump to specific line (careful! no scope checks)
* Atari BASIC inspired theme / syntax highlighting (Still a work in progress)
* See all procedures in Outline view

## Running or Debugging

With the "Run/Debug" split button in the editor header you can easily "run" or "debug" a FastBasic file without having to configure a debug configuration.

* "Running" a file compiles and runs it in the emulator.
* "Debugging" a file compiles debug information into the file before starting, then starts a debugging session. The program waits for a final key press before exiting.
  
## Variables

Variables can be viwed:
1. In the Variables pane
2. By hovering over the varible name in source code. In this view, the value is shown in both decimal and hex, along with the address of where the variable exists in memory

All variables in FastBasic are global. All variable types are supported:

* Integer: myVar
* Float: myVar%
* String: myVar$
* Arrays (Byte, Integer, String)

Arrays with a size greater than 256 will not show contents, for performance reasons


## Outline

* The outline view lists all Procedures in the file
* You can look at the definition of a proc by pressing F12
