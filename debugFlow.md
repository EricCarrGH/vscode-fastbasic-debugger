# BASIC DEBUGGING FLOW between Debugger (vscode) and Program (compiled FastBasic program)

## Communication is coordinated using two control files, and a third auxillary file:
1. debug.in  - Debugger to Program 
2. debug.out - Program to Debugger
3. debug.mem - Set of memory locations for Program uses to send a "var dump" to the Debugger

## Each side performes the following actions on the files to communicate:
1. Wait for no existience of outgoing response file
2. Check for the existence of the incoming file
3. Process incoming file
4. Respond as a two step process:
    1. First, write outgoing response file
    2. Second, delete incoming file to signal that the outgoing reponse file is ready to be read


## Debugging Process

Initialize the debugging session and establish breakpoints:

1. Debugger injects debugging code to FastBasic source file, and runs FastBasic compile to generate lst,lbl,xex.
3. Debugger parses lst/lbl files to build variable list and variable data request payload
4. Debugger retrieves list of breakpoints from vscode and writes "1:Breakpoint List" to program
5. Debugger starts emulator to run compiled XEX
6. Program processes "1:Breakpoint list",  and starts Standard Execution
7. At end, program sends "9:Program ended", and debugger stops debugging.

At this point, the debugger waits to hear back from the program to initiate a breakpoint.
This is because "1:Breakpoint list" will remain unti the program deletes it to signal a response.

## Standard Execution - 
1. Program checks before each line if a breakpoint (or "break on next line" flag) is set. If so:
2. Program sends "var dump"
3. Debugger parses "var dump", updates variables.
4. User can now inspect variables and intiates any of the following actions:

### Update Breakpoints
1. Debugger sends "1:Breakpoing list"
2. Program processes "1:Breakpoint list"
3. Debugger sends "ACK"

### Change Variable Value
1. Debugger sends "2:Set var value"
2. Program processes "2:Set var value"
3. Debugger sends "ACK"

### Step Forward One Line (Execute current line, then break on next line)
1. Debugger sends "3:Step Forward"
2. Program reads "3:Step Forward", sets "break on next line" flag
3. Program executes current line, resuming standard execution

### Resume Execution (until next breakpoint)
1. Debugger sends "4:Resume"
2. Program reads "4:Resume", clears "break on next line" flag
3. Program executes current line, resume standard execution