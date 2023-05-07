AA%=12.34
AB%=56.78

A=1
B=A+5


? "XYZ"
dim c4(3), c5(4), c6(5), c5b(4), A4%(3), A5%(4)

c4(2) = 4
c4(3) = c4(2) * 2
dim d2(1) byte, d3(2) byte

dim j4$(3), j5$(5)
hw$="Hello World mister cowboy"
hw$="Hello World"

? A

? Hw$
d3(0)=2:d3(1)=100

for i=0 to 3
  ' Some comment
  j4$(i)= "test-j4-string-": j4$(i)=+str$(i)
  j5$(i)= "test-j5-string-": j5$(i)=+str$(i)
  a4%(i) = 0.333*i
next

j5$(5)="TEST-5-MANUAL"
j5$(4)="TEST-4-MANUAL"
? "i: "; i; " @ "; &i





'___PROGRAM_END___

DIM ___DEBUG_MODE, ___DEBUG_MEM, ___DEBUG_LEN, ___DEBUG_I, ___DEBUG_BREAK_NEXT
DIM ___DEBUG_BP(128)
PROC ___DEBUG_CB ___DEBUG_LINE
  IF NOT ___DEBUG_BP(0) THEN EXIT
  IF NOT ___DEBUG_BREAK_NEXT
    FOR ___DEBUG_I = 1 TO ___DEBUG_BP(0)
      IF ___DEBUG_LINE = ___DEBUG_BP(___DEBUG_I) THEN EXIT
    NEXT
    IF ___DEBUG_I > ___DEBUG_BP(0) THEN EXIT
  ENDIF
  '? "[STOPPED @ "; ___DEBUG_LINE; "]"
  @___DEBUG_DUMP
  @___DEBUG_POLL
ENDPROC

PROC ___DEBUG_DUMP
  close #5:open #5,4,0,"H4:debug.mem"
  if err()<>1 THEN EXIT 
  close #4:open #4,8,0,"H4:debug.out"
  put #4, 2 ' Variable memory dump
  bput #4, &___DEBUG_LINE, 2
  ___DEBUG_I=0
  do
    ' Retrieve next memory location and length to write out
    ___DEBUG_MEM = 0:bget #5,&___DEBUG_MEM,4:if ___DEBUG_MEM = 0 then exit
    
    ' The first mem/size block is for variables, so we dump the contents of MEM.
    ' All subsequent blocks are for array/string regions, so we 
    ' need to dump the contents that MEM *POINTS TO*, and send that new location to the debugger
    if ___DEBUG_I
      IF ___DEBUG_MEM>0 THEN ___DEBUG_MEM = dpeek(___DEBUG_MEM)
       bput #4, &___DEBUG_MEM, 2
    endif

    INC ___DEBUG_I

    ' String array points to a second array that points to each string
    if ___DEBUG_LEN mod 256 = 0 and ___DEBUG_LEN > 256
      while ___DEBUG_LEN>0
          
          '? "str: @ ";dpeek(___DEBUG_MEM+i*2);":";$(dpeek(___DEBUG_MEM+i*2))
          bput #4, &___DEBUG_MEM, 2
          bput #4, dpeek(___DEBUG_MEM), 256
          IF ___DEBUG_MEM>0
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
    get #5,___DEBUG_MODE
    ? "[DEBUG MODE ";___DEBUG_MODE;"]"
    if ___DEBUG_MODE=0 or err()<>1 then exit

    if ___DEBUG_MODE=1        ' Continue (to next breakpoint)
      ___DEBUG_BREAK_NEXT=0
    elif ___DEBUG_MODE=3      ' Step forward to next line
      ___DEBUG_BREAK_NEXT=1
    endif
 
    ' Populate Breakpoint list received from debugger, then continue execution
    get #5, ___DEBUG_BP(0)
    bget #5,&___DEBUG_BP+2,___DEBUG_BP(0)*2
    
    ' Update any variable memory from debugger
    do    
      ___DEBUG_MEM = 0:bget #5,&___DEBUG_MEM,4:if ___DEBUG_MEM = 0 then exit
      bget #5, ___DEBUG_MEM, ___DEBUG_LEN    
    loop

    close #5
  endif

  ' Continue execution
  ' ? "[CONTINUE]"
ENDPROC

PROC  ___DEBUG_END
 get ___DEBUG_I
 close #4:open #4,8,0,"H4:debug.out"
 put #4, 9 ' End
 close #4
 XIO #5, 33, 0, 0, "H4:debug.in"
ENDPROC