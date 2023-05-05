A=1
B=A+5
? "XXX"
dim c4(3), c5(4), c6(5), c5b(4)


c4(2) = 4

c4(3) = c4(2) * 2

? "XXX"
dim d2(1) byte, d3(2) byte
? "XXX"
dim j4$(3), j5$(4)
? "XXX"
hw$="Hello World"
? Hw$
open #5,8,0,"H6:DEBUG.OUT"
' Read word array for bput [source,size, source,size, etc.]
dim ___DEBUG_BUF(2000)
___DEBUG_VARS = &___DEBUG_BUF
dpoke ___DEBUG_VARS,&A: dpoke ___DEBUG_VARS,22:inc ___DEBUG_VARS
dpoke ___DEBUG_VARS,&c4: dpoke ___DEBUG_VARS,8:inc ___DEBUG_VARS
dpoke ___DEBUG_VARS,&c5: dpoke ___DEBUG_VARS,10:inc ___DEBUG_VARS

for i=1 to 100
bput #5, &A, 256
next i
'bput #5, &c4,8
'bput #5, &c4,8
close #5
? "wrote"
GET ___DEBUG_KEY