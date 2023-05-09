i=1:? i

PROC SubAbc
  i=i+1
  ? "in sub":get k
  if i<2 then i=i+34
  exit
ENDPROC
? "out":get k
@SubAbc
? "out":get k
for j=0 to 1
i=i+1
? "in for":get k
next j
? "out":get k
@SubAbc
? "out":get k


? I
get k