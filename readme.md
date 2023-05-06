# FastBasic Debugger

The goal of this project is to provide a first class debugging experience for FastBasic in Visual Studio Code on Windows or Mac.

## Features

* Compile and run in emulator
* Inspect and change variables
* Set breakpoints
* Step through code, line by line
* Syntax highlighting (via [fill in source])

## Running or Debugging

With the "Run/Debug" split button in the editor header you can easily "run" or "debug" a FastBasic file without having to configure a debug configuration.
* "Running" a file compiles and runs it in the emulator.
* "Debugging" a file compiles debug information into the file before starting, then starts a debugging session.
  
## Variables

All variables in FastBasic are global. All variable types are supported:

- Integer: myVar
- Float: myVar%
- String: myVar$
- Arrays (Byte, Integer, String)


## Breakpoints

Breakpoints can be set in the breakpoint margin of the editor (even before a Mock Debug session was started).
If a Mock Debug session is active, breakpoints are "validated" according to these rules:

* if a line is empty or starts with `+` we don't allow to set a breakpoint but move the breakpoint down
* if a line starts with `-` we don't allow to set a breakpoint but move the breakpoint up
* a breakpoint on a line containing the word `lazy` is not immediately validated, but only after hitting it once.

## Data Breakpoints

Data Breakpoints can be set for different access modes in the VARIABLES view of the editor via the context menu.
The syntax `$variable` triggers a read access data breakpoint, the syntax `$variable=value` a write access data breakpoint.

Examples:
- Read Access: $i
- Write Access: $i=999

## Disassembly View

If a markdown line contains the word 'disassembly', the context menu's "Open Disassembly View" command is enabled and the Disassembly view shows (fake) assembly instructions and "instruction stepping" and "instruction breakpoints" are supported.

## Exceptions

If a line contains the word `exception` or the pattern `exception(name)` an exception is thrown.
To make the debugger stop when an exception is thrown, two "exception options" exist in the BREAKPOINTS view:
- **Named Exception**: if enabled and configured with a condition (e.g. `xxx`) the debugger will break on the `exception(xxx)` pattern.
- **Other Exceptions**: if enabled the debugger will break on the word `exception` and the `exception(...)` pattern.

## Output events

* If a line containes patterns like `log(xxx)`, `prio(xxx)`, `out(xxx)`, or `err(xxx)` the argument `xxx` is shown in the debug console as follows:
  * **log**: text is shown in debug console's default color to indicate that it is received from the debugger itself
  * **prio**: text is shown as a notification to indicate that it is received from the debugger itself and has high priority
  * **out**: text is shown in blue to indicate program output received from "stdout"
  * **err**: text is shown in red to indicate program output received from "stderr"
* If the argument `xxx` is `start` or `end`, a "log group" is started or ended.

Some examples:
```
prio(a high priority message)
out(some text from stdout)
err(some text from stderr)

log(start)
log(some text in group)
log(start)
log(some text on level 2 group)
log(more text on level 2 group)
log(end)
log(startCollapsed)
log(some text on a collapsed group)
log(end)
log(more text in group)
log(end)
````

## The End