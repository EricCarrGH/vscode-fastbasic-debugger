AA%=12.34
AB%=56.78

A=1
B=A+5
? "XYZ"
dim c4(3), c5(4), c6(5), c5b(4), A4%(3), A5%(4)

c4(2) = 4
c4(3) = c4(2) * 2
dim d2(1) byte, d3(2) byte
dim j4$(3), j5$(100)
hw$="Hello World mister cowboy"
hw$="Hello World"
for i=0 to 3
  j4$(i)= "test-j4-string-": j4$(i)=+str$(i)
  j5$(i)= "test-j5-string-": j5$(i)=+str$(i)
  a4%(i) = 0.333*i
next

? Hw$


PROC TESTS
' Test memory dump
open #5,8,0,"H4:debug.in"
put #5, 2 ' memory dump
mem=&a:bput #5,&mem,2:size=22:bput #5,&size,2
mem=&hw$:bput #5,&mem,2:size=256:bput #5,&size,2
close #5:___DEBUG_ERR=err()
ENDPROC

@___DEBUG_BP 1
GET ___DEBUG_KEY
end




DIM ___DEBUG_MODE, ___DEBUG_MEM, ___DEBUG_LEN
PROC ___DEBUG_BP ___DEBUG_LINE
  ? "[BREAKPOINT]"
  close #5
  do
    open #5,4,0,"H4:debug.in"
    if err()=1 
      get #5,___DEBUG_MODE
      ? "[DEBUG MODE ";___DEBUG_MODE;"]"
      if ___DEBUG_MODE=0 or err()<>1 then exit

      if ___DEBUG_MODE=2  ' Dump memory to debugger. Multiples of (word loc, byte len)
      
        close #4:open #4,8,0,"H4:debug.out"
        do
          ' Retrieve next memory location and length to write out
          ___DEBUG_MEM = 0:bget #5,&___DEBUG_MEM,4:if ___DEBUG_MEM = 0 then exit
          
          ' The first mem/size block is for variables, so we dump the contents of MEM.
          ' All subsequent blocks are for array/string regions, so we 
          ' need to dump the contents that MEM *POINTS TO*.
          if ___DEBUG_MODE=1002 then ___DEBUG_MEM = &___DEBUG_MEM
          ___DEBUG_MODE=1002

          bput #4, ___DEBUG_MEM, ___DEBUG_LEN
        '  ? "wrote @";___DEBUG_MEM; " : "; ___DEBUG_LEN
          
        loop
        close #4
      elif ___DEBUG_MODE=3 ' Read and update memory from debugger. Multiples of (word loc, byte len)

      endif
      close #5
      'XIO #5, 33, 0, 0, "H4:debug.in"
      get k
    endif
    pause 10
  loop

  ? "[RESUME]"
ENDPROC

