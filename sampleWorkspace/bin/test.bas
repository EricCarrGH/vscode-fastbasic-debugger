@___DEBUG_POLL
@___DEBUG_CB 1:AA%=12.34
@___DEBUG_CB 2:AB%=56.78
@___DEBUG_CB 3:
@___DEBUG_CB 4:A=1
@___DEBUG_CB 5:B=A+5
@___DEBUG_CB 6:
@___DEBUG_CB 7:? "XYZ"
@___DEBUG_CB 8:dim c4(3), c5(4), c6(5), c5b(4), A4%(3), A5%(4)
@___DEBUG_CB 9:
@___DEBUG_CB 10:c4(2) = 4
@___DEBUG_CB 11:c4(3) = c4(2) * 2
@___DEBUG_CB 12:dim d2(1) byte, d3(2) byte
@___DEBUG_CB 13:
@___DEBUG_CB 14:dim j4$(3), j5$(5)
@___DEBUG_CB 15:hw$="Hello World mister cowboy"
@___DEBUG_CB 16:hw$="Hello World"
@___DEBUG_CB 17:
@___DEBUG_CB 18:? Hw$
@___DEBUG_CB 19:d3(0)=2:d3(1)=100
@___DEBUG_CB 20:for i=0 to 3
@___DEBUG_CB 21:  j4$(i)= "test-j4-string-": j4$(i)=+str$(i)
@___DEBUG_CB 22:  j5$(i)= "test-j5-string-": j5$(i)=+str$(i)
@___DEBUG_CB 23:  a4%(i) = 0.333*i
@___DEBUG_CB 24:next
@___DEBUG_CB 25:
@___DEBUG_CB 26:j5$(5)="TEST-5-MANUAL"
@___DEBUG_CB 27:j5$(4)="TEST-4-MANUAL"
@___DEBUG_CB 28:? "i: "; i; " @ "; &i
@___DEBUG_CB 29:
@___DEBUG_CB 30:
@___DEBUG_CB 31:
@___DEBUG_CB 32:
@___DEBUG_CB 33:
GET ___DEBUG_KEY
'___PROGRAM_END___

DIM ___DEBUG_MODE, ___DEBUG_MEM, ___DEBUG_LEN, ___DEBUG_BP(128), ___DEBUG_I
PROC ___DEBUG_CB ___DEBUG_LINE
  IF NOT ___DEBUG_BP(0) THEN EXIT
  FOR ___DEBUG_I = 1 TO ___DEBUG_BP(0)
    IF ___DEBUG_LINE = ___DEBUG_BP(___DEBUG_I) THEN EXIT
  NEXT
  IF ___DEBUG_I > ___DEBUG_BP(0) THEN EXIT
  ? "[BREAKPOINT @ "; ___DEBUG_LINE; "]"
  @___DEBUG_DUMP
  @___DEBUG_POLL
ENDPROC

PROC ___DEBUG_DUMP
  close #5:open #5,4,0,"H4:debug.mem"
  if err()<>1 THEN EXIT 
  close #4:open #4,8,0,"H4:debug.out"
  
  do
    ' Retrieve next memory location and length to write out
    ___DEBUG_MEM = 0:bget #5,&___DEBUG_MEM,4:if ___DEBUG_MEM = 0 then exit
    
    ' The first mem/size block is for variables, so we dump the contents of MEM.
    ' All subsequent blocks are for array/string regions, so we 
    ' need to dump the contents that MEM *POINTS TO*.
    if ___DEBUG_MODE=1002 then ___DEBUG_MEM = dpeek(___DEBUG_MEM)
    ___DEBUG_MODE=1002

    ' String array points to a second array that points to each string
    if ___DEBUG_LEN mod 256 = 0 and ___DEBUG_LEN > 256
      while ___DEBUG_LEN>0
        '  ? "str: @ ";dpeek(___DEBUG_MEM+i*2);":";$(dpeek(___DEBUG_MEM+i*2))
          bput #4, dpeek(___DEBUG_MEM), 256
          inc ___DEBUG_MEM: inc ___DEBUG_MEM
          ___DEBUG_LEN=___DEBUG_LEN-256
      wend
    else
      ' Just
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
  close #5
  do
    open #5,4,0,"H4:debug.in"
    if err()=1 
      get #5,___DEBUG_MODE
      ? "[DEBUG MODE ";___DEBUG_MODE;"]"
      if ___DEBUG_MODE=0 or err()<>1 then exit

      if ___DEBUG_MODE=1  ' Populate Breakpoint list received from debugger
        get #5, ___DEBUG_BP(0)
        bget #5,&___DEBUG_BP+2,___DEBUG_BP(0)*2
        close #5
        exit
      elif ___DEBUG_MODE=2  ' Dump memory to debugger. Multiples of (word loc, byte len)
        
      elif ___DEBUG_MODE=3 ' Read and update memory from debugger. Multiples of (word loc, byte len)

      endif
      close #5
      XIO #5, 33, 0, 0, "H4:debug.in"
      'get k
    endif
    pause 10
  loop

  ? "[RESUME]"
ENDPROC

