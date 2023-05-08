A=1
? "A = "; A
? "Again, A = "; A

hello$ = "Hello World"
? hello$

dim ID(3), player$(3)

for i=0 to 3
  id(i) = i
  player$(i) = "PLAYER "
  player$(i) =+str$(i)
next i

for i=0 to 3
  ? "Hello "; player$(i)
next i
