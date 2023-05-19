# FastBasic Debugger

The goal of this project is to provide a first class debugging experience for FastBasic in Visual Studio Code on Windows or Mac.

## Features

* Compile and run in emulator
* Inspect and change variables
* See variable value in decimal/hex along with address on hover
* Set breakpoints
* Step through code, line by line
* Jump to specific line (careful! no scope checks)
* Syntax highlighting (via [fill in source])
* See all procedures in Outline view

## Running or Debugging

With the "Run/Debug" split button in the editor header you can easily "run" or "debug" a FastBasic file without having to configure a debug configuration.

* "Running" a file compiles and runs it in the emulator.
* "Debugging" a file compiles debug information into the file before starting, then starts a debugging session. The program waits for a final key press before exiting.
  
## Variables

All variables in FastBasic are global. All variable types are supported:

* Integer: myVar
* Float: myVar%
* String: myVar$
* Arrays (Byte, Integer, String)

## Outline

* The outline view lists all Procedures in the file
* You can look at the definition of a proc by pressing F12
