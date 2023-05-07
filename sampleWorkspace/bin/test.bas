@__DEBUG_POLL
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

? Hw$
d3(0)=2:d3(1)=100
for i=0 to 3
  j4$(i)= "test-j4-string-": j4$(i)=+str$(i)
  j5$(i)= "test-j5-string-": j5$(i)=+str$(i)
  a4%(i) = 0.333*i
next

j5$(5)="TEST-5-MANUAL"
j5$(4)="TEST-4-MANUAL"
? "i: "; i; " @ "; &i


PROC TESTS
' Test memory dump 
open #5,8,0,"H4:debug.in"
put #5, 2 ' memory dump
mem=&a:bput #5,&mem,2:size=22:bput #5,&size,2
mem=&hw$:bput #5,&mem,2:size=256:bput #5,&size,2
close #5:___DEBUG_ERR=err()
ENDPROC

GET ___DEBUG_KEY
end

DIM ___DEBUG_MODE, ___DEBUG_MEM, ___DEBUG_LEN, ___DEBUG_BP(128), ___DEBUG_I
PROC ___DEBUG_CB ___DEBUG_LINE
  IF NOT ___DEBUG_BP(0) THEN EXIT
  FOR ___DEBUG_I = 1 TO ___DEBUG_BP(0)
    IF ___DEBUG_LINE = ___DEBUG_BP(___DEBUG_I) THEN EXIT
  NEXT
  IF ___DEBUG_I > ___DEBUG_BP(0) THEN EXIT
  ? "[BREAKPOINT]"
  @__DEBUG_POLL
ENDPROC

PROC __DEBUG_POLL
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
        ? "[Read "; ___DEBUG_BP(0); " breakpoints ]"
        for i=0 to ___DEBUG_BP(0)
        ? i;"=";___DEBUG_BP(i)
        next
        close #5
        exit
      elif ___DEBUG_MODE=2  ' Dump memory to debugger. Multiples of (word loc, byte len)
         close #4:open #4,8,0,"H4:debug.out"
       
        do
          ' Retrieve next memory location and length to write out
          ___DEBUG_MEM = 0:bget #5,&___DEBUG_MEM,4:if ___DEBUG_MEM = 0 then exit
          
          ' The first mem/size block is for variables, so we dump the contents of MEM.
          ' All subsequent blocks are for array/string regions, so we 
          ' need to dump the contents that MEM *POINTS TO*.
          ___DEBUG_MEMO = ___DEBUG_MEM
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

