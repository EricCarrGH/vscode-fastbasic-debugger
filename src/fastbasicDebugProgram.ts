// Small FastBasic code that is appended to the end of a program to 
// enable debugging.

export const DEBUG_PROGRAM = `
DIM ___DEBUG_MEM, ___DEBUG_LEN, ___DEBUG_I, ___DEBUG_LINE
 
' Called before any line set as a breakpoint, or by ___DEBUG_CHECK when stepping through
PROC ___DEBUG_BREAK

	' Short Assembly routine ($BA, $60) to retrieve the current stack pointer
	' Copies Stack Register to X register, which is returned to FastBasic
	___DEBUG_I = $60BA
	___DEBUG_I = usr(&___DEBUG_I)

	' Retrieve address of current line from 6502 stack ($100 + stack pointer + 3)
	___DEBUG_LINE=dpeek($103+peek(&___DEBUG_I+1))

	'PRINT ___DEBUG_LINE
  close #5:open #5,4,0,"H4:debug.mem"
  if err()<>1 THEN EXIT 
  close #4:open #4,8,0,"H4:debug.out"
  put #4, 1 ' Variable memory dump
  bput #4, &___DEBUG_LINE, 2
	
  ___DEBUG_I=0
  do
    ' Retrieve the next ___DEBUG_MEM, ___DEBUG_LEN combination (memory location and length to write out)
    ___DEBUG_MEM = 0:bget #5,&___DEBUG_MEM,4:if ___DEBUG_MEM = 0 then exit
    
    ' The first mem/size block is for variables, so we dump the contents of MEM.
    ' All subsequent blocks are for array/string regions, so we 
    ' need to dump the contents that MEM *POINTS TO*, and send that new location to the debugger
    if ___DEBUG_I
			___DEBUG_MEM = dpeek(___DEBUG_MEM)
       bput #4, &___DEBUG_MEM, 2
    endif

    INC ___DEBUG_I

    ' String array points to a second array that points to each string
		' TODO - support non strings with a len of 256!
    if ___DEBUG_LEN mod 256 = 0 and ___DEBUG_LEN > 256
      while ___DEBUG_LEN>0
          
          '? "str: @ ";dpeek(___DEBUG_MEM+i*2);":";$(dpeek(___DEBUG_MEM+i*2))
					
          bput #4, ___DEBUG_MEM, 2
          bput #4, dpeek(___DEBUG_MEM), 256
					if ___DEBUG_MEM >0
						inc ___DEBUG_MEM: inc ___DEBUG_MEM
					ENDIF

          ___DEBUG_LEN=___DEBUG_LEN-256
      wend
    else
      bput #4, ___DEBUG_MEM, ___DEBUG_LEN
      ' if ___DEBUG_LEN mod 256 = 0 then ? "str:";$(___DEBUG_MEM)
    ENDIF
    
    
  '  ? "wrote (was " ; ___DEBUG_MEMO ; ") @";___DEBUG_MEM; " : "; ___DEBUG_LEN
    
  loop
  close #4
  close #5
  XIO #5, 33, 0, 0, "H4:debug.in"
	@___DEBUG_POLL
ENDPROC

PROC ___DEBUG_POLL
  
  ' Wait for outgoing file to be removed by debugger
  do
    open #5,4,0,"H4:debug.out"
    if err()<>1
      close #5:exit
    endif
    close #5
    pause 10
  loop
  
  close #5:open #5,4,0,"H4:debug.in"
  if err()=1 
    get #5,___DEBUG_I
    if ___DEBUG_I=0 or err()<>1 then exit

		IF ___DEBUG_I = 3 ' JumpTo Line
			' Get stack location where we return to
			___DEBUG_I = $60BA
			___DEBUG_I = usr(&___DEBUG_I)

			' Update the return address on the stack to the new line (danger, Will Robinson!)
			bget #5, $103+peek(&___DEBUG_I+1), 2		
		ENDIF
 
    ' Loop through location/value updates (CHECK and Breakpoint)
    bget #5,&___DEBUG_LEN,2
		FOR ___DEBUG_I = 1 TO ___DEBUG_LEN
			bget #5,&___DEBUG_MEM,2
			bget #5,___DEBUG_MEM,2
		NEXT

    ' Update any variable memory from debugger
    do    
      ___DEBUG_MEM = 0:bget #5,&___DEBUG_MEM,4:if ___DEBUG_MEM = 0 then exit
      bget #5, ___DEBUG_MEM, ___DEBUG_LEN    
    loop

    close #5
  endif

	' Reference ___DEBUG_BREAK so FastBasic optimizer will keep it
	IF &___DEBUG_LINE = 0 THEN @___DEBUG_BREAK

  ' Continue execution
  ' ? "[CONTINUE]"
ENDPROC

PROC ___DEBUG_END
 close #4:open #4,8,0,"H4:debug.out"
 put #4, 9 ' End
 close #4
 XIO #5, 33, 0, 0, "H4:debug.in"
 get ___DEBUG_I
ENDPROC

' Called before every line when a breakpoint is not set, to check if stepping. 
PROC ___DEBUG_CHECK
  ' Stub code is added to reserve space. During runtime it is replaced with
  ' an exit or a call to the ___DEBUG_BREAK procedure
	___DEBUG_I = 0:___DEBUG_I = 0
ENDPROC

@___DEBUG_END
`.split("\n");